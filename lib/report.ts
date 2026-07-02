import { BASELINE_FIELDS, QUICK_HAZARD_FIELDS, type BaselineResult } from './mireye/fields';

export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export type RedFlag = {
  severity: Severity;
  title: string;
  evidence: string;
  sourceField: string;
  sourceCitation: string;
};

export type Report = {
  redFlags: RedFlag[];
  noFlagsFound: string[];
  notCovered: string[];
};

const SEVERITY_RULES: Record<string, { threshold: unknown; severity: Severity; message: string }[]> = {
  within_floodplain_polygon: [
    { threshold: true, severity: 'critical', message: 'Property lies within a FEMA floodplain polygon' },
  ],
  intersects_wetland: [
    { threshold: true, severity: 'high', message: 'Property intersects a mapped wetland' },
  ],
  intersects_nhd_area: [
    { threshold: true, severity: 'high', message: 'Property intersects a National Hydrography Dataset water feature' },
  ],
  slope_degrees: [
    { threshold: 30, severity: 'critical', message: 'Slope exceeds 30° — severe landslide/erosion risk' },
    { threshold: 15, severity: 'high', message: 'Slope exceeds 15° — potential stability concerns' },
  ],
  wildfire_annual_frequency: [
    { threshold: 0.01, severity: 'critical', message: 'Annual wildfire probability > 1%' },
    { threshold: 0.001, severity: 'high', message: 'Elevated wildfire frequency detected' },
  ],
  intersects_conservation_easement: [
    { threshold: true, severity: 'high', message: 'Property burdened by a conservation easement' },
  ],
  intersects_protected_area: [
    { threshold: true, severity: 'high', message: 'Property overlaps a protected area' },
  ],
  intersects_critical_habitat: [
    { threshold: true, severity: 'high', message: 'Property intersects designated critical habitat' },
  ],
  seismic_design_category: [
    { threshold: 'E', severity: 'critical', message: 'Seismic Design Category E — very high seismic risk' },
    { threshold: 'D', severity: 'high', message: 'Seismic Design Category D — high seismic risk' },
  ],
  surface_water_permanence_pct: [
    { threshold: 50, severity: 'medium', message: 'Surface water present > 50% of the time' },
  ],
  lcms_class: [
    { threshold: 'Tree', severity: 'info', message: 'Land cover is forested' },
  ],
  ndvi_change_5y: [
    { threshold: -0.15, severity: 'medium', message: 'Vegetation health declining (NDVI drop > 0.15 over 5 years)' },
  ],
  nearest_major_road_distance_m: [
    { threshold: 5000, severity: 'medium', message: 'Nearest major road > 5 km — access may be difficult' },
    { threshold: 1000, severity: 'low', message: 'Nearest major road > 1 km — verify access' },
  ],
  parcel_zoning: [
    { threshold: null, severity: 'info', message: 'Parcel zoning data unavailable on free Regrid tier — verify locally' },
  ],
  nearest_transmission_line_distance_m: [
    { threshold: 5000, severity: 'medium', message: 'Nearest transmission line > 5 km — grid connection may be costly' },
  ],
};

const FIELD_CITATIONS: Record<string, string> = {
  within_floodplain_polygon: 'FEMA Floodplain Polygon (via Mireye)',
  intersects_wetland: 'NWI Wetlands (via Mireye)',
  intersects_nhd_area: 'USGS National Hydrography Dataset (via Mireye)',
  slope_degrees: 'USGS 3DEP DEM (via Mireye)',
  wildfire_annual_frequency: 'USFS Wildfire Hazard Potential (via Mireye)',
  intersects_conservation_easement: 'NCED Conservation Easements (via Mireye)',
  intersects_protected_area: 'PAD-US Protected Areas (via Mireye)',
  intersects_critical_habitat: 'USFWS Critical Habitat (via Mireye)',
  seismic_design_category: 'USGS Seismic Design Category (via Mireye)',
  surface_water_permanence_pct: 'JRC Global Surface Water (via Mireye)',
  lcms_class: 'LCMS Land Cover (via Mireye)',
  ndvi_change_5y: 'Landsat NDVI 5-year Trend (via Mireye)',
  nearest_major_road_distance_m: 'OpenStreetMap Major Roads (via Mireye)',
  parcel_zoning: 'Regrid Parcel Zoning (free tier — often null)',
  nearest_transmission_line_distance_m: 'Homeland Infrastructure Transmission Lines (via Mireye)',
  elevation: 'USGS 3DEP Elevation (via Mireye)',
  coast_distance_m: 'NOAA Coastline (via Mireye)',
  tree_canopy_pct: 'NLCD Tree Canopy (via Mireye)',
  ndvi_current: 'Landsat NDVI Current (via Mireye)',
  parcel_id: 'Regrid Parcel ID (via Mireye)',
  parcel_area_m2: 'Regrid Parcel Area (via Mireye)',
  parcel_owner: 'Regrid Parcel Owner (via Mireye)',
  parcel_match_type: 'Regrid Parcel Match Type (via Mireye)',
  political_region: 'Census State (via Mireye)',
  political_county: 'Census County (via Mireye)',
  political_locality: 'Census Place (via Mireye)',
  tract_geoid: 'Census Tract GEOID (via Mireye)',
  surface_management_agency: 'BLM Surface Management Agency (via Mireye)',
  seismic_pga_2pct_50yr_g: 'USGS PGA 2% in 50yr (via Mireye)',
};

function evaluateSeverity(field: string, value: unknown): RedFlag | null {
  const rules = SEVERITY_RULES[field];
  if (!rules) return null;

  for (const rule of rules) {
    if (rule.threshold === true && value === true) {
      return {
        severity: rule.severity,
        title: rule.message,
        evidence: String(value),
        sourceField: field,
        sourceCitation: FIELD_CITATIONS[field] ?? 'Mireye API',
      };
    }
    if (typeof rule.threshold === 'number' && typeof value === 'number') {
      const passes = rule.threshold >= 0 ? value > rule.threshold : value < rule.threshold;
      if (!passes) continue;
      return {
        severity: rule.severity,
        title: rule.message,
        evidence: String(value),
        sourceField: field,
        sourceCitation: FIELD_CITATIONS[field] ?? 'Mireye API',
      };
    }
    if (typeof rule.threshold === 'string' && value === rule.threshold) {
      return {
        severity: rule.severity,
        title: rule.message,
        evidence: String(value),
        sourceField: field,
        sourceCitation: FIELD_CITATIONS[field] ?? 'Mireye API',
      };
    }
    if (rule.threshold === null && value === null) {
      return {
        severity: rule.severity,
        title: rule.message,
        evidence: 'null (not available)',
        sourceField: field,
        sourceCitation: FIELD_CITATIONS[field] ?? 'Mireye API',
      };
    }
  }
  return null;
}

export function buildReport(
  baseline: BaselineResult,
  quickHazard: Record<string, unknown>,
  branchResults: Record<string, Record<string, unknown>>
): Report {
  const allData: Record<string, unknown> = { ...baseline, ...quickHazard };
  for (const branch of Object.values(branchResults)) {
    Object.assign(allData, branch);
  }

  const redFlags: RedFlag[] = [];
  const checkedFields = new Set<string>();

  for (const [field, value] of Object.entries(allData)) {
    if (value === undefined) continue;
    checkedFields.add(field);
    const flag = evaluateSeverity(field, value);
    if (flag) redFlags.push(flag);
  }

  const severityOrder: Severity[] = ['critical', 'high', 'medium', 'low', 'info'];
  redFlags.sort((a, b) => severityOrder.indexOf(a.severity) - severityOrder.indexOf(b.severity));

  const allKnownFields = [...BASELINE_FIELDS, ...QUICK_HAZARD_FIELDS];
  for (const branch of Object.values(branchResults)) {
    for (const field of Object.keys(branch)) {
      if (!allKnownFields.includes(field as typeof BASELINE_FIELDS[number])) {
        allKnownFields.push(field as typeof BASELINE_FIELDS[number]);
      }
    }
  }

  const noFlagsFound = allKnownFields
    .filter((f) => checkedFields.has(f) && !redFlags.some((rf) => rf.sourceField === f))
    .map((f) => `${f}: ${allData[f] ?? 'N/A'}`);

  const notCovered = [
    'Title ownership & chain of title',
    'Liens, encumbrances, judgments',
    'HOA / POA covenants, fees, restrictions',
    'Mineral rights, water rights, timber rights',
    'Septic / well permitting & feasibility',
    'Local building codes & permit requirements',
    'Survey boundaries & encroachments',
    'Insurance availability & cost',
  ];

  return { redFlags, noFlagsFound, notCovered };
}