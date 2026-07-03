/**
 * lib/summary/interpret.ts
 *
 * Plain-language interpretation layer.
 *
 * CONTRACT (hard constraints — never violate):
 *  1. This function runs AFTER buildReport() has returned. It reads the finished
 *     Report object only. It never calls Mireye, never sees raw field data, and
 *     must never run before the report is complete.
 *  2. No LLM, no network call, no async, no randomness. Pure TypeScript lookup.
 *     Same input always produces the same output.
 *  3. Never produce a verdict, recommendation, or buy/no-buy judgment.
 *     Every sentence is: FINDING -> PLAIN MEANING for this use -> NEXT ACTION.
 *  4. If this function throws for any reason, the caller catches and returns [].
 *     The existing report must render completely unaffected.
 */

import type { Report } from "@/lib/report";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type IntendedUse =
  | "residential"
  | "cabin-recreational"
  | "small-acreage-agriculture"
  | "investment";

/**
 * One plain-language interpretation entry produced for a triggered flag.
 * The UI renders these ordered by descending severity.
 */
export interface Interpretation {
  /** The sourceField that triggered this entry (for deduplication and ordering). */
  sourceField: string;
  /** Severity carried through from the original RedFlag for color coding. */
  severity: string;
  /** The fully resolved plain-language sentence (finding -> meaning -> action). */
  sentence: string;
}

// ---------------------------------------------------------------------------
// Lookup table
//
// Keys are the `sourceField` values used in SEVERITY_RULES in report.ts.
// Each entry maps an IntendedUse (or the special key "all") to a sentence
// template. Templates may contain {VALUE}, which is replaced with the
// formatted evidence string already produced by report.ts.
//
// Sentence structure: FINDING -> PLAIN MEANING for this use -> NEXT ACTION.
// Never a verdict. Never "you should buy/avoid." Never "this is safe/risky."
// ---------------------------------------------------------------------------

type UseMap = Partial<Record<IntendedUse | "all", string>>;

/**
 * LOOKUP — the complete plain-language sentence table.
 *
 * Every flag supported by SEVERITY_RULES in report.ts has an entry here.
 * Extend this object (and only this object) when new flags are added.
 * The rest of the function is flag-agnostic.
 */
const LOOKUP: Record<string, UseMap> = {
  // -- FLOODPLAIN -----------------------------------------------------------
  within_floodplain_polygon: {
    residential:
      "This parcel sits inside a FEMA flood zone — mandatory flood insurance applies to any permanent structure and stricter foundation and elevation requirements will govern construction; get a flood insurance quote and a flood-zone elevation certificate before going under contract.",
    "cabin-recreational":
      "This parcel is in a FEMA flood zone — flood insurance is likely required even for a seasonal structure, and rebuilding after storm damage may involve additional permitting and elevation compliance; check quote and permit requirements with the local building department before purchase.",
    "small-acreage-agriculture":
      "Flood zone status has less impact on open land use than on structures, but any barns, equipment sheds, or future housing added here would face mandatory flood insurance and elevation requirements; confirm before planning any permanent structures on this parcel.",
    investment:
      "This parcel is in a FEMA flood zone, which increases insurance costs and constrains buildability for any future owner or tenant; factor this into resale value and commission a flood zone determination survey before pricing the investment.",
  },

  // -- PROTECTED AREA -------------------------------------------------------
  intersects_protected_area: {
    all: "This parcel overlaps a federally protected area — development is typically restricted or requires federal review regardless of intended use; request a formal determination from the managing agency before purchase to understand what activities are permitted.",
  },

  // -- CRITICAL HABITAT -----------------------------------------------------
  intersects_critical_habitat: {
    all: "This parcel overlaps designated critical habitat under the Endangered Species Act — ground disturbance, construction, or habitat alteration may require federal review or be prohibited; request a formal Section 7 or Section 10 determination from the U.S. Fish & Wildlife Service before purchase.",
  },

  // -- CONSERVATION EASEMENT ------------------------------------------------
  intersects_conservation_easement: {
    residential:
      "A conservation easement is recorded on this parcel — certain uses, structures, or site alterations may be permanently restricted by the easement holder regardless of zoning; review the full easement terms with a real estate attorney before closing.",
    "cabin-recreational":
      "A conservation easement burdens this parcel — recreational structures, clearing, or site modifications may be prohibited or limited under its terms; obtain a copy of the easement document and review allowable uses before purchase.",
    "small-acreage-agriculture":
      "A conservation easement is on record here — tilling, drainage improvements, or structure placement may be restricted in ways that affect farming plans; review the easement terms with an attorney to confirm which agricultural activities remain permitted.",
    investment:
      "A conservation easement limits what future owners can do with this parcel, directly constraining its development potential and resale value; obtain and review the full easement terms, including holder contact information, before valuing the investment.",
  },

  // -- WETLAND --------------------------------------------------------------
  intersects_wetland: {
    residential:
      "Part of this parcel intersects a mapped wetland — building in or near this area typically requires a federal wetland delineation and a Section 404 permit from the Army Corps of Engineers; get a jurisdictional determination before finalizing any site plan or construction budget.",
    "cabin-recreational":
      "Part of this parcel intersects a mapped wetland — even light structures, grading, or site prep near that area may require federal permitting; get a jurisdictional determination from the Army Corps of Engineers before purchase to know what you can actually build.",
    "small-acreage-agriculture":
      "Wetland overlap may restrict tilling, drainage improvements, or structure placement in that portion of the parcel — a violation can trigger significant federal penalties; confirm exact boundaries with a certified wetland delineation survey before planning any land improvements.",
    investment:
      "Wetland overlap can significantly reduce the net buildable area of this parcel, directly affecting its development value; commission a delineation survey to quantify what portion is actually usable before pricing the investment.",
  },

  // -- WATER FEATURE (NHD) --------------------------------------------------
  intersects_nhd_area: {
    residential:
      "This parcel intersects a mapped National Hydrography water feature — riparian setbacks and potential floodplain designations may constrain where a home or septic system can be placed; verify applicable setback distances with the county planning office before any site planning.",
    "cabin-recreational":
      "This parcel intersects a mapped water feature — riparian setbacks may restrict how close any structure can be sited; check local setback rules with the county planning office before purchase to understand the buildable envelope.",
    "small-acreage-agriculture":
      "A mapped water feature crosses this parcel — irrigation withdrawals or drainage modifications near it may require state water rights permits; confirm with your state water resources agency before planning any irrigation or drainage work.",
    investment:
      "A mapped water feature intersects this parcel and may impose setbacks that reduce net buildable area for future development; verify applicable setback requirements with the county before valuing the land.",
  },

  // -- STEEP SLOPE ----------------------------------------------------------
  slope_degrees: {
    residential:
      "The slope here ({VALUE}) increases foundation, grading, and septic system costs and may affect driveway design — get a site evaluation and cost estimate from a local civil engineer before finalizing a construction budget.",
    "cabin-recreational":
      "The slope here ({VALUE}) means even a modest cabin will require additional site work and a more complex foundation — walk the parcel and get a rough build estimate from a local contractor before committing.",
    "small-acreage-agriculture":
      "The slope here ({VALUE}) limits which areas are suitable for cultivation or safe equipment operation — walk the parcel to identify the usable flat areas before settling on a crop plan or purchasing equipment.",
    investment:
      "Steep terrain ({VALUE}) increases site-prep, grading, and foundation costs for any future owner — factor higher development costs into your comparable analysis and resale expectations.",
  },

  // -- HIGH WILDFIRE --------------------------------------------------------
  wildfire_annual_frequency: {
    residential:
      "Wildfire frequency here is elevated ({VALUE}) — homeowners insurance may be harder to obtain or significantly more expensive, and defensible space clearance requirements will likely apply; check fire insurance availability in this ZIP code before purchase, as uninsurability can affect mortgage eligibility.",
    "cabin-recreational":
      "Elevated wildfire frequency ({VALUE}) means a cabin here may be difficult or expensive to insure and could be subject to mandatory defensible space clearance orders; check fire insurance availability before purchase, as coverage gaps create significant financial exposure.",
    "small-acreage-agriculture":
      "Elevated wildfire frequency ({VALUE}) poses a risk to any structures, stored crops, equipment, or livestock housing on the land — check commercial farm insurance options, particularly if you plan to build or store significant assets on site.",
    investment:
      "Elevated wildfire risk ({VALUE}) affects insurability and long-term resale value for any structure on this parcel — factor reduced insurance availability and potential defensible space costs into your investment risk assessment.",
  },

  // -- NO ROAD ACCESS -------------------------------------------------------
  nearest_major_road_distance_m: {
    all: "No major road was found within practical distance of this parcel ({VALUE} to nearest) — confirm there is a legally recorded access easement, because its absence can make land effectively unusable regardless of its other characteristics; a title search and easement review are required and are not covered by this tool.",
  },

  // -- FAR FROM GRID --------------------------------------------------------
  nearest_transmission_line_distance_m: {
    residential:
      "The nearest power transmission line is {VALUE} away — grid extension at this distance can cost tens of thousands of dollars depending on terrain and utility rules; get an extension quote from the local electric cooperative or utility before finalizing a construction budget.",
    "cabin-recreational":
      "Grid power is {VALUE} away — at this distance, an off-grid solar, battery, or generator system is often more cost-effective than a grid extension; get quotes for both options and compare before purchase.",
    "small-acreage-agriculture":
      "The nearest transmission line is {VALUE} away — electric-powered irrigation, lighting, or equipment charging may require a costly grid extension; confirm utility extension availability and cost before planning any electrical infrastructure.",
    investment:
      "Grid power is {VALUE} away — the cost to extend utility service this far can materially reduce the parcel's effective value for any future development; get a utility extension estimate and factor it into your per-acre valuation.",
  },

  // -- SEISMIC --------------------------------------------------------------
  seismic_design_category: {
    residential:
      "This area carries elevated seismic risk (Design Category {VALUE}) — any home built here will need reinforced foundation engineering to meet code, adding to construction cost; get a licensed structural engineer's estimate before finalizing a build budget.",
    "cabin-recreational":
      "Elevated seismic risk (Design Category {VALUE}) applies here — even a modest cabin will need seismic-rated foundation work to meet building code; factor this into your construction budget before purchase.",
    "small-acreage-agriculture":
      "Seismic risk (Design Category {VALUE}) primarily affects structures rather than open farmland — relevant if you plan to build barns, grain storage, or worker housing later; consult a structural engineer when planning any construction on this parcel.",
    investment:
      "Seismic Design Category {VALUE} increases construction and insurance costs for any future structure — relevant to resale value if the land is likely to be developed; disclose this designation to potential buyers and factor it into development cost estimates.",
  },

  // -- SURFACE WATER --------------------------------------------------------
  surface_water_permanence_pct: {
    residential:
      "Surface water is present here a significant portion of the time ({VALUE}) — this may indicate seasonal flooding or poor drainage that affects septic system siting and foundation design; commission a soil perc test and drainage assessment before budgeting construction.",
    "cabin-recreational":
      "Surface water is present here a significant portion of the time ({VALUE}) — this may limit access during wet seasons and affect where any structure can be placed; visit the site in wet season before purchase to understand seasonal conditions.",
    "small-acreage-agriculture":
      "Significant surface water presence ({VALUE}) may indicate drainage issues that limit cultivation in parts of the parcel — a soil drainage assessment will confirm which areas are suitable for your intended crop or livestock use.",
    investment:
      "Persistent surface water ({VALUE}) can reduce usable acreage and complicate future development; commission a drainage assessment to understand the net buildable or usable area before valuing the parcel.",
  },

  // -- VEGETATION DECLINE ---------------------------------------------------
  ndvi_change_5y: {
    residential:
      "Vegetation health on this parcel has been declining over the past five years (NDVI change: {VALUE}) — this can indicate drought stress, soil problems, or pest damage; walk the land and consult a local agronomist or arborist before purchase to understand the cause.",
    "cabin-recreational":
      "Vegetation health has been declining over five years (NDVI change: {VALUE}) — this could affect the visual character of the land or indicate underlying soil or water issues; visit during the growing season and inspect the tree cover before purchase.",
    "small-acreage-agriculture":
      "A five-year decline in vegetation health ({VALUE}) is a meaningful signal for agricultural land — it may reflect soil depletion, overgrazing, or water stress; request soil test results from the seller or commission your own before making an offer.",
    investment:
      "Declining vegetation health over five years ({VALUE}) can indicate underlying soil or water conditions that reduce the land's productive or aesthetic value; get a soil and water assessment before pricing the parcel.",
  },
};

// ---------------------------------------------------------------------------
// Zero-flags sentences (one per intended use)
// ---------------------------------------------------------------------------

const ZERO_FLAGS: Record<IntendedUse, string> = {
  residential:
    "No major geospatial red flags were found for residential use based on available public data — this does not replace a title search, zoning approval, or septic and utility feasibility checks; see the Exclusions section below for the full list of items not covered by this report.",
  "cabin-recreational":
    "No major geospatial red flags were found for cabin or recreational use based on available public data — this does not replace a title search, zoning verification, or access easement confirmation; see the Exclusions section below for items not covered.",
  "small-acreage-agriculture":
    "No major geospatial red flags were found for small-acreage agriculture use based on available public data — this does not replace a soil survey, water rights review, or zoning confirmation for agricultural operations; see the Exclusions section below.",
  investment:
    "No major geospatial red flags were found for investment use based on available public data — this does not replace a title search, zoning review, or infrastructure feasibility assessment; see the Exclusions section below for items not covered by this report.",
};

// ---------------------------------------------------------------------------
// Severity ordering (mirrors the severityOrder array in report.ts)
// ---------------------------------------------------------------------------

const SEVERITY_ORDER: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  info: 4,
};

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function isValidUse(use: string): use is IntendedUse {
  return [
    "residential",
    "cabin-recreational",
    "small-acreage-agriculture",
    "investment",
  ].includes(use);
}

/**
 * Resolve a sentence template for a given sourceField and intended use.
 * Falls back to "all" if no use-specific entry exists.
 * Returns null if the field has no lookup entry (skip it silently).
 */
function resolveSentence(
  sourceField: string,
  use: IntendedUse,
  evidence: string,
): string | null {
  const useMap = LOOKUP[sourceField];
  if (!useMap) return null;

  const template = useMap[use] ?? useMap["all"];
  if (!template) return null;

  // Substitute {VALUE} with the already-formatted evidence string from report.ts
  return template.replace(/\{VALUE\}/g, evidence);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * interpret — pure, deterministic, synchronous.
 *
 * Reads the finished Report object produced by buildReport() and returns
 * an ordered list of Interpretation entries (highest severity first).
 *
 * Guarantees:
 *  - Runs strictly after buildReport() returns — reads finished data only.
 *  - No network, no LLM, no external dependencies, no side effects.
 *  - Same input always produces the same output.
 *  - Returns [] on any error — existing report renders completely unaffected.
 *  - Never produces a verdict, recommendation, or buy/no-buy judgment.
 *
 * @param report       The fully built Report object from buildReport().
 * @param intendedUse  The user's stated purpose ("residential" | "cabin-recreational" | ...).
 * @returns  Ordered Interpretation[] highest severity first, or [] on error.
 */
export function interpret(report: Report, intendedUse: string): Interpretation[] {
  try {
    const use: IntendedUse = isValidUse(intendedUse) ? intendedUse : "residential";

    // Zero flags -> single zero-flags sentence
    if (report.redFlags.length === 0) {
      return [
        {
          sourceField: "__zero_flags__",
          severity: "info",
          sentence: ZERO_FLAGS[use],
        },
      ];
    }

    // Sort by severity descending (critical first). report.ts already sorts
    // redFlags this way, but we re-sort here to stay self-contained and safe
    // against future changes to buildReport().
    const sorted = [...report.redFlags].sort(
      (a, b) =>
        (SEVERITY_ORDER[a.severity] ?? 99) - (SEVERITY_ORDER[b.severity] ?? 99),
    );

    const seen = new Set<string>();
    const results: Interpretation[] = [];

    for (const flag of sorted) {
      // Deduplicate: one interpretation per sourceField (highest severity wins
      // because we iterate critical -> high -> medium -> low -> info).
      if (seen.has(flag.sourceField)) continue;
      seen.add(flag.sourceField);

      const sentence = resolveSentence(flag.sourceField, use, flag.evidence);

      // If a flag has no lookup entry (e.g. a new field added later to
      // SEVERITY_RULES), skip it silently. The full evidence is still visible
      // in the Flags & Encumbrances section below.
      if (!sentence) continue;

      results.push({
        sourceField: flag.sourceField,
        severity: flag.severity,
        sentence,
      });
    }

    return results;
  } catch {
    // Constraint: if anything goes wrong, return empty so the caller
    // degrades gracefully without touching the rest of the report.
    return [];
  }
}
