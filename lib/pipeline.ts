/**
 * V2 Land Purchase Risk Assessment — Pipeline
 *
 * 6 stages:
 *   1. Geocode     (Census → Nominatim fallback, highway-name variants)
 *   2. Fetch       (3 parallel Mireye batches × ≤50 fields = 128 curated fields)
 *   3. Manifest    (closed-set dict with full provenance per field)
 *   4. LLM         (OpenCode API, structured JSON, every finding cites ≥1 field)
 *   5. Validate    (rejects findings with bogus citations; splits into 3 buckets)
 *   6. Render      (returns structured PipelineResult)
 *
 * LLM client: native fetch to OpenCode API (no external SDK dependency)
 */

// ───────── Curated field set (128 fields in 3 batches) ─────────
// BATCH_A (47): Parcel identity + legal + conservation + terrain + hydrology + geotech
// BATCH_B (41): Hazards + climate + land cover + neighborhood
// BATCH_C (40): Built environment + access + services + utilities + industrial proximity
export const BATCH_A: string[] = [
  // Parcel identity & legal (10)
  'parcel_id','parcel_apn','parcel_address','parcel_area_m2','parcel_owner','parcel_zoning',
  'political_locality','political_county','political_region','tract_geoid',
  // Conservation & regulatory (16)
  'intersects_protected_area','protected_area_name','protected_area_manager','protected_area_designation',
  'protected_area_gap_status','protected_area_public_access',
  'intersects_conservation_easement','easement_holder','easement_type','easement_acres',
  'intersects_critical_habitat','critical_habitat_species','critical_habitat_listing_status','critical_habitat_status',
  'special_use_airspace_type','surface_management_agency',
  // Terrain & hydrology (21)
  'elevation','slope_degrees','aspect_degrees','coast_distance_m','within_floodplain_polygon',
  'intersects_nhd_area','intersects_wetland','nearest_wetland_distance_m','wetland_type','wetland_subtype',
  'wetland_acres','wetlands_within_100m_count','wetlands_within_500m_count',
  'nearest_waterbody_name','nearest_flowline_name','surface_water_permanence_pct',
  'soil_drainage_class','soil_shrink_swell_class','soil_map_unit_name','bedrock_depth_cm','prime_farmland_classification',
];
export const BATCH_B: string[] = [
  // Hazards (25)
  'seismic_pga_2pct_50yr_g','seismic_design_category','landslide_susceptibility_index',
  'wildfire_annual_frequency','hail_annual_frequency','tornado_annual_frequency','lightning_annual_flash_days',
  'design_wind_speed_mph','nearest_dam_distance_m','nearest_dam_hazard_potential','high_hazard_dams_within_10km',
  'superfund_sites_within_radius_count','nearest_superfund_distance_m',
  'brownfields_within_radius_count','nearest_brownfield_distance_m',
  'nearest_hazardous_facility_distance_m','nearest_hazardous_facility_name',
  'in_air_quality_nonattainment','in_air_quality_maintenance',
  'air_quality_nonattainment_pollutants','air_quality_maintenance_pollutants',
  'air_quality_worst_classification','air_district_name',
  'nearest_class_i_area_distance_m','nearest_class_i_area_name',
  // Climate — buyer-relevant (7)
  'mean_annual_dry_bulb_temperature_degc','mean_annual_relative_humidity_pct',
  'mean_annual_snow_cover_days','days_above_32c_annual_count','drought_category',
  'mean_wind_speed_100m_ms','prevailing_wind_direction_100m_cardinal',
  // Land cover (8)
  'land_use_class','lcms_class','tree_canopy_pct','ndvi_current','ndvi_change_5y',
  'is_cultivated','cdl_class','dominant_crop_5y',
  // Neighborhood context (1)
  'housing_units_within_1km',
];
export const BATCH_C: string[] = [
  // Existing buildings (4)
  'primary_building_footprint_sqm','primary_building_height_m','primary_building_num_floors','primary_building_overture_class',
  // Road access (7)
  'nearest_road_distance_m','nearest_road_name','nearest_road_class','nearest_road_surface',
  'nearest_major_road_distance_m','nearest_major_road_name','roads_within_500m_count',
  // Emergency & community services (8)
  'nearest_fire_station_distance_m','nearest_fire_station_name',
  'nearest_hospital_distance_m','nearest_hospital_name',
  'nearest_school_distance_m','nearest_school_name',
  'nearest_grocery_store_distance_m','nearest_lodging_distance_m',
  // Transport & urban context (6)
  'nearest_airport_distance_m','nearest_airport_name','nearest_urban_area_distance_m','poi_count_1km',
  'nearest_rail_line_distance_m','nearest_port_name',
  // Residential utilities (7)
  'electric_utility_service_territory','nearest_public_water_system_name',
  'fiber_broadband_available','fiber_provider_count','mobile_5g_coverage_class',
  'nearest_substation_distance_m','nearest_groundwater_well_depth_to_water_m',
  // Industrial/infrastructure proximity (8)
  'nearest_power_plant_distance_m','nearest_power_plant_name','nearest_power_plant_primary_fuel',
  'nearest_wind_turbine_distance_m','nearest_wind_turbine_total_height_m',
  'nearest_interstate_gas_pipeline_distance_m','nearest_interstate_gas_pipeline_operator',
  'nearest_petroleum_pipeline_distance_m',
];

// ───────── Types ─────────
export interface GeocodeResult {
  lat: number; lng: number; matched: string; source: 'census' | 'nominatim';
}
export interface ManifestEntry {
  value: any; unit: string | null;
  source: string | null; source_url: string | null;
  confidence: string | null; dataset_vintage: string | null;
  fetched_at: string | null;
  notes: string | null; status: string | null;
  description: string | null; interpretation_hints: string | null;
  null_meaning: string | null; layer: string | null;
}
export type Manifest = Record<string, ManifestEntry>;

export interface Finding {
  id: string;
  title: string;
  severity: 'critical' | 'high' | 'moderate' | 'low' | 'info';
  category: string;
  evidence_field_ids: string[];
  body: string;
  recommendation?: string;
}
export interface LLMReport {
  executive_summary: string;
  findings: Finding[];
  property_profile: {
    location: string;
    terrain: string;
    environment: string;
    infrastructure: string;
    parcel: string;
  };
  recommended_due_diligence: string[];
  exclusions_and_limitations: string[];
}
export interface ValidationIssue {
  finding_id?: string;
  type: string;
  detail: string;
}
export interface Validation {
  issues: ValidationIssue[];
  flags: Finding[];        // critical + high
  moderate: Finding[];     // moderate
  clear_checks: Finding[]; // low + info
  all_findings: Finding[];
}
export interface Timings {
  geocode_ms: number; fetch_ms: number; manifest_ms: number;
  llm_ms: number; validate_ms: number; render_ms: number; total_ms: number;
}
export interface PipelineResult {
  ok: boolean;
  error?: string;
  address: string;
  land_use: string;
  geocode?: GeocodeResult;
  fetch?: {
    latency_ms: number;
    batch_latencies: { A: number; B: number; C: number };
    fetched_at: string;
    field_count: number;
    partial_failure_count: number;
    partial_failures: any[];
  };
  manifest?: Manifest;
  llm_parsed?: LLMReport;
  validation?: Validation;
  timings?: Timings;
  llm_usage?: any;
}

// ───────── Config ─────────
const MIREYE_BASE = process.env.MIREYE_BASE_URL || 'https://api.mireye.com/v1';
const MIREYE_TOKEN = process.env.MIREYE_API_TOKEN || '';
const MIREYE_HEADERS: Record<string, string> = {
  'Authorization': `Bearer ${MIREYE_TOKEN}`,
  'Content-Type': 'application/json',
};

const OPENCODE_API_URL = process.env.OPENCODE_API_URL || 'https://opencode.ai/zen/v1/chat/completions';
const OPENCODE_MODEL = process.env.OPENCODE_MODEL || 'deepseek-v4-flash-free';

// ───────── Field catalog (module-level memoize — fetched once per process) ─────────
let _catalog: { fields_detail: Record<string, any> } | null = null;

async function loadCatalog(): Promise<{ fields_detail: Record<string, any> }> {
  if (_catalog) return _catalog;
  const r = await fetch(`${MIREYE_BASE}/meta/fields`, { headers: MIREYE_HEADERS });
  if (!r.ok) throw new Error(`catalog fetch failed: ${r.status}`);
  const data = await r.json();
  const fields_detail: Record<string, any> = {};
  for (const f of data.fields) fields_detail[f.name] = f;
  _catalog = { fields_detail };
  return _catalog;
}

// ───────── Stage 1: Geocode ─────────
function addressVariants(address: string): string[] {
  const variants = [address];
  if (address.includes('Highway 1')) {
    variants.push(address.replace('Highway 1', 'CA-1'));
    variants.push(address.replace('Highway 1', 'Cabrillo Highway'));
    variants.push(address.replace('Highway 1', 'State Route 1'));
  }
  if (address.includes('Highway')) variants.push(address.replace('Highway', 'Hwy'));
  if (address.includes('Hwy')) variants.push(address.replace('Hwy', 'Highway'));
  return Array.from(new Set(variants));
}

async function censusGeocode(address: string): Promise<GeocodeResult | null> {
  const url = new URL('https://geocoding.geo.census.gov/geocoder/locations/onelineaddress');
  url.searchParams.set('address', address);
  url.searchParams.set('benchmark', 'Public_AR_Current');
  url.searchParams.set('format', 'json');
  try {
    const r = await fetch(url.toString(), { signal: AbortSignal.timeout(20000) });
    if (!r.ok) return null;
    const data = await r.json();
    const matches = data?.result?.addressMatches || [];
    if (!matches.length) return null;
    const c = matches[0].coordinates;
    return { lat: c.y, lng: c.x, matched: matches[0].matchedAddress, source: 'census' };
  } catch { return null; }
}

async function nominatimGeocode(address: string): Promise<GeocodeResult | null> {
  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('q', address);
  url.searchParams.set('format', 'json');
  url.searchParams.set('limit', '1');
  url.searchParams.set('countrycodes', 'us');
  try {
    const r = await fetch(url.toString(), {
      headers: { 'User-Agent': 'land-dd-probe/1.0' },
      signal: AbortSignal.timeout(20000),
    });
    if (!r.ok) return null;
    const arr = await r.json();
    if (!arr.length) return null;
    return {
      lat: parseFloat(arr[0].lat), lng: parseFloat(arr[0].lon),
      matched: arr[0].display_name, source: 'nominatim',
    };
  } catch { return null; }
}

async function geocode(address: string): Promise<GeocodeResult | null> {
  const variants = addressVariants(address);
  for (const v of variants) {
    const g = await censusGeocode(v);
    if (g) return g;
  }
  await new Promise(r => setTimeout(r, 1000));
  for (const v of variants) {
    const g = await nominatimGeocode(v);
    if (g) return g;
    await new Promise(r => setTimeout(r, 1000));
  }
  return null;
}

// ───────── Stage 2: Parallel Fetch ─────────
async function fetchBatch(lat: number, lng: number, fields: string[], label: 'A' | 'B' | 'C') {
  const t0 = Date.now();
  const r = await fetch(`${MIREYE_BASE}/fetch`, {
    method: 'POST',
    headers: MIREYE_HEADERS,
    body: JSON.stringify({ lat, lng, fields }),
    signal: AbortSignal.timeout(120000),
  });
  if (!r.ok) {
    const text = await r.text().catch(() => '');
    throw new Error(`batch ${label} failed: ${r.status} ${text.slice(0, 200)}`);
  }
  const body = await r.json();
  return {
    label,
    latency_ms: Date.now() - t0,
    fields: (body.fields || {}) as Record<string, any>,
    partial_failures: (body.partial_failures || []) as any[],
  };
}

async function parallelFetch(lat: number, lng: number) {
  const t0 = Date.now();
  const [a, b, c] = await Promise.all([
    fetchBatch(lat, lng, BATCH_A, 'A'),
    fetchBatch(lat, lng, BATCH_B, 'B'),
    fetchBatch(lat, lng, BATCH_C, 'C'),
  ]);
  return {
    lat, lng,
    fetched_at: new Date().toISOString(),
    fields: { ...a.fields, ...b.fields, ...c.fields },
    partial_failures: [...a.partial_failures, ...b.partial_failures, ...c.partial_failures],
    latency_ms: Date.now() - t0,
    batch_latencies: { A: a.latency_ms, B: b.latency_ms, C: c.latency_ms },
  };
}

// ───────── Stage 3: Manifest Builder ─────────
function buildManifest(fetchResult: Awaited<ReturnType<typeof parallelFetch>>, catalog: { fields_detail: Record<string, any> }): Manifest {
  const manifest: Manifest = {};
  for (const [fname, fdata] of Object.entries(fetchResult.fields)) {
    if (typeof fdata !== 'object' || fdata === null) continue;
    const meta = catalog.fields_detail[fname] || {};
    manifest[fname] = {
      value: fdata.value ?? null,
      unit: fdata.unit ?? null,
      source: fdata.source ?? null,
      source_url: fdata.source_url ?? null,
      confidence: fdata.confidence ?? null,
      dataset_vintage: fdata.dataset_vintage ?? null,
      fetched_at: fdata.fetched_at ?? null,
      notes: fdata.notes ?? null,
      status: fdata.status ?? null,
      description: meta.description ?? null,
      interpretation_hints: meta.interpretation_hints ?? null,
      null_meaning: meta.null_meaning ?? null,
      layer: meta.layer ?? null,
    };
  }
  for (const pf of fetchResult.partial_failures) {
    const fname = pf.field;
    if (fname && !manifest[fname]) {
      manifest[fname] = {
        value: null, unit: null, source: pf.source ?? null, source_url: null,
        confidence: null, dataset_vintage: null, fetched_at: fetchResult.fetched_at,
        notes: `partial_failure: ${pf.error || ''}`,
        status: 'partial_failure', description: null, interpretation_hints: null,
        null_meaning: null, layer: null,
      };
    }
  }
  return manifest;
}

// ───────── Stage 4: LLM Reasoner ─────────
const SYSTEM_PROMPT = `You are a senior land due diligence consultant with 20 years of experience writing evidence-anchored reports for prospective land buyers.

Your job: synthesize a verified Mireye evidence manifest into a structured land purchase risk assessment that reads like it was written by a human consultant — not by AI.

═══ ABSOLUTE RULES (violations make the report unusable) ═══

1. CLOSED-SET EVIDENCE. You may ONLY reference fields that exist in the EVIDENCE MANIFEST. The manifest is a closed set. Every finding MUST cite at least one field_id in \`evidence_field_ids\`. Cited fields MUST be exact keys from the manifest.

2. NO INVENTED ENTITIES. If a utility name, road name, hospital name, species name, or any other named entity is not present in a manifest field's value, you MAY NOT mention it. State "not reported in available evidence" instead.

3. NO INVENTED RISK CATEGORIES. If no field in the manifest addresses a risk (e.g. sinkholes, radon, lead pipes), do NOT mention that risk. Only synthesize from what is present.

4. EXACT NUMBERS. Numeric values mentioned in \`body\` text MUST exactly match the manifest value (round to 1 decimal place for display). Do NOT round, exaggerate, or transform numbers.

5. NULL IS EVIDENCE. A null value IS evidence. If \`within_floodplain_polygon\` is null, that means FEMA NFHL data is unavailable for this point — say so explicitly, do NOT infer flood safety. Distinguish clearly between:
   - "X is true" (positive boolean in manifest)
   - "X is false" (negative boolean in manifest)
   - "X is not reported" (null value or field absent)

6. NO INTERPRETATION OF UNDEFINED CODES. If a manifest field returns a code you do not have an official definition for (e.g. zoning code "CT", "R-1", "OR"), report the RAW CODE ONLY. NEVER say "likely commercial" or "probably residential" — you do not have the jurisdiction's zoning ordinance. Say: "zoning code CT (verify permitted uses with the county zoning office)".

7. NO HEDGING WITH "LIKELY". Never say "likely protected area", "appears to be", "probably indicates". Either the manifest says it (report it as fact) or it doesn't (don't mention it). The word "likely" is banned unless you are explicitly flagging a data anomaly (see rule 8).

8. FLAG DATA ANOMALIES EXPLICITLY. If a manifest value is geographically inconsistent or suspicious, you MUST flag it. Say: "The supplied data reports [X]. This appears geographically inconsistent for this location and should be verified with the source authority before relying on it."

9. SEVERITY CALIBRATION:
   - critical: legally blocks the intended use OR imminent life-safety hazard
   - high: material financial/physical risk likely to affect purchase decision
   - moderate: risk worth disclosing but typically manageable
   - low: GENUINELY REASSURING — use ONLY when data actively eliminates a buyer concern. Examples: parcel is outside FEMA floodplain, no superfund sites within radius, fiber broadband confirmed, paved road access confirmed, no wetlands on parcel. Do NOT use for neutral or mixed observations.
   - info: NEUTRAL PROPERTY CONTEXT — purely factual, neither reassuring nor concerning (e.g., parcel APN, zoning code, building footprint size, mean temperature, wind direction). Do NOT use for anything that could affect buildability, cost, or suitability.
   CRITICAL: Cautionary or mixed observations (e.g., moderate shrink-swell soils, shallow bedrock, proximity to pipelines, high snow cover days, steep slope) are at minimum MODERATE. Never downgrade them to low/info.

10. SYNTHESIS ACROSS FIELDS IS ENCOURAGED — but only across manifest fields. Example: elevation < 10m + within_floodplain_polygon=true + coast_distance_m < 1000 → compound coastal flood risk.

11. NO LEGAL INTERPRETATION. Do NOT reference case law, regulatory tests, court decisions, or legal standards by name (e.g., "post-Sackett test", "Rapanos", "Section 404 jurisdiction", "WOTUS", "Clean Water Act applicability"). Instead say: "[risk description] — verify regulatory applicability with [relevant agency, e.g., Army Corps of Engineers, state environmental agency]."

═══ EXECUTIVE SUMMARY — must answer 3 questions ═══

The executive_summary MUST answer these three questions in 3-5 sentences total, in this order:
1. What is the single biggest problem? Lead with it. Be decisive.
2. What is good? One sentence on the strongest positive.
3. What should the buyer verify first? One sentence on the highest-priority next step.

Do NOT write a generic overview. Do NOT list everything. Be decisive and specific.

═══ RECOMMENDATIONS — must tie to evidence ═══

Every \`recommendation\` field MUST name the specific evidence that triggers it. Never write a generic recommendation. Bad: "Conduct Phase I ESA." Good: "Conduct Phase I ESA — 2 brownfields within 8km (nearest 1.2km) and a hazardous facility 2km away."

═══ PROPERTY PROFILE — structured, not paragraph ═══

The property_profile MUST be a JSON object with these 5 keys, each a 1-2 sentence factual statement using only manifest evidence:
{
  "location": "County, state, locality, nearest road",
  "terrain": "Elevation, slope, aspect, coast distance if coastal",
  "environment": "Land cover, wetlands, protected areas, critical habitat, contamination proximity",
  "infrastructure": "Roads, utilities (power/fiber/water), emergency services, nearest urban area",
  "parcel": "APN, area, owner, zoning code (raw, no interpretation), existing buildings if any"
}
Format: Separate each distinct fact with " • " (space-bullet-space). Do NOT write a prose paragraph. Keep each section to 3–5 bullet facts. Example: "Monterey County, California • Locality: Big Sur, unincorporated • Nearest road: CA-1 (0 m from parcel edge)". Report raw codes, do not interpret them.

═══ OUTPUT FORMAT ═══

Respond with a single JSON object (no markdown fences, no prose outside JSON) with this exact shape:
{
  "executive_summary": "3-5 sentences answering the 3 required questions",
  "findings": [
    {
      "id": "FLOOD-01",
      "title": "short headline (≤80 chars)",
      "severity": "critical|high|moderate|low|info",
      "category": "flood|seismic|wildfire|contamination|geotechnical|access|utility|regulatory|environmental|climate|infrastructure|other",
      "evidence_field_ids": ["field_name_from_manifest"],
      "body": "2-4 sentence evidence-anchored explanation. Every claim must be traceable to a cited field.",
      "recommendation": "specific next step for the buyer, WITH the evidence that triggers it"
    }
  ],
  "property_profile": {
    "location": "...",
    "terrain": "...",
    "environment": "...",
    "infrastructure": "...",
    "parcel": "..."
  },
  "recommended_due_diligence": ["action 1 — with triggering evidence", "action 2 — with triggering evidence"],
  "exclusions_and_limitations": ["limitation 1", "limitation 2"]
}`;

function buildUserPrompt(address: string, landUse: string, manifest: Manifest): string {
  const compact: Record<string, any> = {};
  const hints: Record<string, string> = {};
  for (const [fname, fdata] of Object.entries(manifest)) {
    compact[fname] = {
      value: fdata.value, unit: fdata.unit, source: fdata.source,
      confidence: fdata.confidence, status: fdata.status,
    };
    if (fdata.null_meaning && fdata.value === null) compact[fname].null_meaning = fdata.null_meaning;
    if (fdata.interpretation_hints && fdata.value !== null) {
      const firstSentence = fdata.interpretation_hints.split(/[.]\s/)[0] + '.';
      hints[fname] = firstSentence;
    }
  }
  return `# LAND DUE DILIGENCE REQUEST

## Subject Property
- Address: ${address}
- Intended Land Use: ${landUse}

## EVIDENCE MANIFEST (closed set — cite ONLY these field_ids)
${JSON.stringify(compact, null, 2)}

## INTERPRETATION HINTS (from Mireye field catalog, for non-null fields only)
${Object.keys(hints).length ? JSON.stringify(hints, null, 2) : '{}'}

## Task
Synthesize the evidence into the structured JSON report per the system rules. Every claim must trace to a cited field_id. Every named entity must appear in a manifest value.`;
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('TIMEOUT')), ms);
    p.then(v => { clearTimeout(timer); resolve(v); },
           e => { clearTimeout(timer); reject(e); });
  });
}

async function llmReason(
  address: string, landUse: string, manifest: Manifest,
): Promise<{ parsed: LLMReport; ms: number; usage?: any }> {
  const attempt = async () => {
    const userPrompt = buildUserPrompt(address, landUse, manifest);
    const t0 = Date.now();
    const apiKey = process.env.OPENCODE_API_KEY || '';
    const response = await fetch(OPENCODE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: OPENCODE_MODEL,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0,
        max_tokens: 16384,
        response_format: { type: 'json_object' },
      }),
    });
    const ms = Date.now() - t0;
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`LLM API error ${response.status}: ${text.slice(0, 200)}`);
    }
    const data = await response.json();
    let content: string = data?.choices?.[0]?.message?.content || '';
    const usage = data?.usage || null;
    content = content.trim();
    if (content.startsWith('```')) {
      const lines = content.split('\n');
      if (lines[0].startsWith('```')) lines.shift();
      if (lines.length && lines[lines.length - 1].trim() === '```') lines.pop();
      content = lines.join('\n');
    }
    let parsed: LLMReport;
    try {
      parsed = JSON.parse(content);
    } catch {
      const m = content.match(/\{[\s\S]*\}/);
      if (m) parsed = JSON.parse(m[0]);
      else throw new Error('LLM did not return valid JSON');
    }
    return { parsed, ms, usage };
  };

  try {
    return await withTimeout(attempt(), 90000);
  } catch {
    // Retry once on timeout or transient error
    return await withTimeout(attempt(), 90000);
  }
}

// ───────── Stage 4 (streaming): LLM Reasoner with SSE token stream ─────────
async function llmReasonStream(
  address: string, landUse: string, manifest: Manifest,
  onToken: (token: string) => void,
): Promise<{ parsed: LLMReport; ms: number }> {
  const userPrompt = buildUserPrompt(address, landUse, manifest);
  const t0 = Date.now();
  const apiKey = process.env.OPENCODE_API_KEY || '';

  const response = await fetch(OPENCODE_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: OPENCODE_MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0,
      max_tokens: 16384,
      stream: true,
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`LLM API error ${response.status}: ${text.slice(0, 200)}`);
  }

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let content = '';
  let buf = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const msgs = buf.split('\n\n');
      buf = msgs.pop() || '';
      for (const msg of msgs) {
        for (const line of msg.split('\n')) {
          if (!line.startsWith('data:')) continue;
          const payload = line.slice(5).trim();
          if (!payload || payload === '[DONE]') continue;
          try {
            const obj = JSON.parse(payload);
            const delta = obj?.choices?.[0]?.delta?.content;
            if (delta) { content += delta; onToken(delta); }
          } catch { /* partial JSON — safe to ignore */ }
        }
      }
    }
  } catch { /* network error mid-stream — parse what we have */ }
  finally { reader.releaseLock(); }

  if (!content) throw new Error('LLM stream returned no content');

  const ms = Date.now() - t0;
  content = content.trim();
  if (content.startsWith('```')) {
    const lines = content.split('\n');
    if (lines[0].startsWith('```')) lines.shift();
    while (lines.length && lines[lines.length - 1].trim() === '') lines.pop();
    if (lines.length && lines[lines.length - 1].trim().startsWith('```')) lines.pop();
    content = lines.join('\n');
  }
  let parsed: LLMReport;
  try {
    parsed = JSON.parse(content);
  } catch (e: any) {
    const m = content.match(/\{[\s\S]*\}/);
    if (m) {
      try { parsed = JSON.parse(m[0]); }
      catch (e2: any) { throw new Error(`LLM JSON parse failed: ${e2.message}`); }
    } else throw new Error('LLM did not return valid JSON');
  }
  return { parsed, ms };
}

// ───────── Stage 5: Validator ─────────
function validateReport(parsed: LLMReport, manifest: Manifest): Validation {
  const issues: ValidationIssue[] = [];
  const validFindings: Finding[] = [];
  const manifestKeys = new Set(Object.keys(manifest));

  const findings = parsed.findings || [];
  findings.forEach((f, i) => {
    const fid = f.id || `F${i}`;
    let cited = f.evidence_field_ids || [];
    const badCites = cited.filter(c => !manifestKeys.has(c));
    if (badCites.length) {
      issues.push({ finding_id: fid, type: 'bogus_citation',
                    detail: `Cited fields not in manifest: ${badCites.join(', ')}` });
      cited = cited.filter(c => manifestKeys.has(c));
      if (!cited.length) {
        issues.push({ finding_id: fid, type: 'no_valid_citation', detail: 'Finding dropped' });
        return;
      }
      f.evidence_field_ids = cited;
    }
    if (!cited.length) {
      issues.push({ finding_id: fid, type: 'no_citation', detail: 'Finding dropped' });
      return;
    }
    validFindings.push(f);
  });

  for (const req of ['executive_summary', 'findings', 'property_profile', 'recommended_due_diligence', 'exclusions_and_limitations']) {
    if (!(req in parsed)) issues.push({ type: 'missing_top_level', detail: req });
  }

  const flags = validFindings.filter(f => f.severity === 'critical' || f.severity === 'high');
  const moderate = validFindings.filter(f => f.severity === 'moderate');
  const clear_checks = validFindings.filter(f => f.severity === 'low' || f.severity === 'info');

  return { issues, flags, moderate, clear_checks, all_findings: validFindings };
}

// ───────── Stage 6: Orchestrator (sync) ─────────
export async function runPipeline(address: string, landUse: string): Promise<PipelineResult> {
  const t0 = Date.now();
  const timings: Timings = { geocode_ms: 0, fetch_ms: 0, manifest_ms: 0, llm_ms: 0, validate_ms: 0, render_ms: 0, total_ms: 0 };
  try {
    const catalog = await loadCatalog();

    const tg0 = Date.now();
    const geo = await geocode(address);
    timings.geocode_ms = Date.now() - tg0;
    if (!geo) return { ok: false, error: 'geocode_failed', address, land_use: landUse, timings };

    const tf0 = Date.now();
    const fetchResp = await parallelFetch(geo.lat, geo.lng);
    timings.fetch_ms = Date.now() - tf0;

    const tm0 = Date.now();
    const manifest = buildManifest(fetchResp, catalog);
    timings.manifest_ms = Date.now() - tm0;

    const tl0 = Date.now();
    const { parsed, ms: llmMs, usage } = await llmReason(address, landUse, manifest);
    timings.llm_ms = llmMs;

    const tv0 = Date.now();
    const validation = validateReport(parsed, manifest);
    timings.validate_ms = Date.now() - tv0;
    timings.render_ms = 1;
    timings.total_ms = Date.now() - t0;

    return {
      ok: true, address, land_use: landUse, geocode: geo,
      fetch: {
        latency_ms: fetchResp.latency_ms,
        batch_latencies: fetchResp.batch_latencies,
        fetched_at: fetchResp.fetched_at,
        field_count: Object.keys(manifest).length,
        partial_failure_count: fetchResp.partial_failures.length,
        partial_failures: fetchResp.partial_failures,
      },
      manifest, llm_parsed: parsed, validation, timings,
      llm_usage: usage,
    };
  } catch (e: any) {
    timings.total_ms = Date.now() - t0;
    return { ok: false, error: e.message || String(e), address, land_use: landUse, timings };
  }
}

// ───────── Streaming orchestrator ─────────
export async function runPipelineStream(
  address: string, landUse: string,
  onEvent: (event: any) => void,
): Promise<void> {
  const t0 = Date.now();
  const timings: Timings = { geocode_ms: 0, fetch_ms: 0, manifest_ms: 0, llm_ms: 0, validate_ms: 0, render_ms: 0, total_ms: 0 };
  try {
    const catalog = await loadCatalog();

    onEvent({ type: 'stage', stage: 'geocode', status: 'start' });
    const tg0 = Date.now();
    const geo = await geocode(address);
    timings.geocode_ms = Date.now() - tg0;
    if (!geo) { onEvent({ type: 'error', error: 'geocode_failed' }); return; }
    onEvent({ type: 'stage', stage: 'geocode', status: 'done', data: geo });

    onEvent({ type: 'stage', stage: 'fetch', status: 'start' });
    const tf0 = Date.now();
    const fetchResp = await parallelFetch(geo.lat, geo.lng);
    timings.fetch_ms = Date.now() - tf0;
    onEvent({ type: 'stage', stage: 'fetch', status: 'done',
              data: { latency_ms: fetchResp.latency_ms,
                      field_count: Object.keys(fetchResp.fields).length,
                      partial_failure_count: fetchResp.partial_failures.length } });

    const tm0 = Date.now();
    const manifest = buildManifest(fetchResp, catalog);
    timings.manifest_ms = Date.now() - tm0;

    onEvent({ type: 'stage', stage: 'llm', status: 'start' });
    const tl0 = Date.now();
    const { parsed, ms: llmMs } = await llmReasonStream(address, landUse, manifest, (token) => {
      onEvent({ type: 'llm_token', token });
    });
    timings.llm_ms = llmMs;
    onEvent({ type: 'stage', stage: 'llm', status: 'done', data: { ms: llmMs } });

    onEvent({ type: 'stage', stage: 'validate', status: 'start' });
    const tv0 = Date.now();
    const validation = validateReport(parsed, manifest);
    timings.validate_ms = Date.now() - tv0;
    timings.render_ms = 1;
    timings.total_ms = Date.now() - t0;
    onEvent({ type: 'stage', stage: 'validate', status: 'done',
              data: { flags: validation.flags.length, moderate: validation.moderate.length,
                      clear_checks: validation.clear_checks.length, issues: validation.issues.length } });

    const result: PipelineResult = {
      ok: true, address, land_use: landUse, geocode: geo,
      fetch: {
        latency_ms: fetchResp.latency_ms,
        batch_latencies: fetchResp.batch_latencies,
        fetched_at: fetchResp.fetched_at,
        field_count: Object.keys(manifest).length,
        partial_failure_count: fetchResp.partial_failures.length,
        partial_failures: fetchResp.partial_failures,
      },
      manifest, llm_parsed: parsed, validation, timings,
    };
    onEvent({ type: 'complete', result });
  } catch (e: any) {
    timings.total_ms = Date.now() - t0;
    onEvent({ type: 'error', error: e.message || String(e) });
  }
}
