import {
  BASELINE_FIELDS,
  QUICK_HAZARD_FIELDS,
  type BaselineResult,
} from "./mireye/fields";

export type Severity = "critical" | "high" | "medium" | "low" | "info";

export type CheckCategory =
  | "terrain"
  | "environmental"
  | "habitat"
  | "buildability"
  | "hazards"
  | "access";

export type RedFlag = {
  severity: Severity;
  title: string;
  evidence: string;
  sourceField: string;
  sourceCitation: string;
  category: CheckCategory;
};

export type ClearCheck = {
  field: string;
  label: string;
  value: string;
  category: CheckCategory;
};

export type ReportSummary = {
  totalChecks: number;
  clearCount: number;
  flagsBySeverity: Record<Severity, number>;
};

export type Report = {
  redFlags: RedFlag[];
  clearChecks: ClearCheck[];
  notCovered: string[];
  summary: ReportSummary;
};

const SEVERITY_RULES: Record<
  string,
  { threshold: unknown; severity: Severity; message: string }[]
> = {
  within_floodplain_polygon: [
    {
      threshold: true,
      severity: "critical",
      message: "Property lies within a FEMA floodplain polygon",
    },
  ],
  intersects_wetland: [
    {
      threshold: true,
      severity: "high",
      message: "Property intersects a mapped wetland",
    },
  ],
  intersects_nhd_area: [
    {
      threshold: true,
      severity: "high",
      message:
        "Property intersects a National Hydrography Dataset water feature",
    },
  ],
  slope_degrees: [
    {
      threshold: 30,
      severity: "critical",
      message: "Slope exceeds 30° — severe landslide/erosion risk",
    },
    {
      threshold: 15,
      severity: "high",
      message: "Slope exceeds 15° — potential stability concerns",
    },
  ],
  wildfire_annual_frequency: [
    {
      threshold: 0.01,
      severity: "critical",
      message: "Annual wildfire probability > 1%",
    },
    {
      threshold: 0.001,
      severity: "high",
      message: "Elevated wildfire frequency detected",
    },
  ],
  intersects_conservation_easement: [
    {
      threshold: true,
      severity: "high",
      message: "Property burdened by a conservation easement",
    },
  ],
  intersects_protected_area: [
    {
      threshold: true,
      severity: "high",
      message: "Property overlaps a protected area",
    },
  ],
  intersects_critical_habitat: [
    {
      threshold: true,
      severity: "high",
      message: "Property intersects designated critical habitat",
    },
  ],
  seismic_design_category: [
    {
      threshold: "E",
      severity: "critical",
      message: "Seismic Design Category E — very high seismic risk",
    },
    {
      threshold: "D",
      severity: "high",
      message: "Seismic Design Category D — high seismic risk",
    },
  ],
  surface_water_permanence_pct: [
    {
      threshold: 50,
      severity: "medium",
      message: "Surface water present > 50% of the time",
    },
  ],
  lcms_class: [
    { threshold: "Tree", severity: "info", message: "Land cover is forested" },
  ],
  ndvi_change_5y: [
    {
      threshold: -0.15,
      severity: "medium",
      message: "Vegetation health declining (NDVI drop > 0.15 over 5 years)",
    },
  ],
  nearest_major_road_distance_m: [
    {
      threshold: 5000,
      severity: "medium",
      message: "Nearest major road > 5 km — access may be difficult",
    },
    {
      threshold: 1000,
      severity: "low",
      message: "Nearest major road > 1 km — verify access",
    },
  ],
  parcel_zoning: [
    {
      threshold: null,
      severity: "info",
      message:
        "Parcel zoning data unavailable on free Regrid tier — verify locally",
    },
  ],
  nearest_transmission_line_distance_m: [
    {
      threshold: 5000,
      severity: "medium",
      message:
        "Nearest transmission line > 5 km — grid connection may be costly",
    },
  ],
};

const FIELD_CITATIONS: Record<string, string> = {
  within_floodplain_polygon: "FEMA National Flood Hazard Layer",
  intersects_wetland: "U.S. Fish & Wildlife Wetlands Inventory",
  intersects_nhd_area: "USGS National Hydrography Dataset",
  slope_degrees: "USGS 3D Elevation Program",
  wildfire_annual_frequency: "USFS Wildfire Hazard Potential",
  intersects_conservation_easement: "National Conservation Easement Database",
  intersects_protected_area: "USGS Protected Areas Database",
  intersects_critical_habitat: "U.S. Fish & Wildlife Critical Habitat",
  seismic_design_category: "USGS Seismic Hazard Model",
  surface_water_permanence_pct: "JRC Global Surface Water Explorer",
  lcms_class: "USFS Land Cover Monitoring System",
  ndvi_change_5y: "Landsat Vegetation Health Index",
  nearest_major_road_distance_m: "OpenStreetMap Road Network",
  parcel_zoning: "County Parcel Records",
  nearest_transmission_line_distance_m: "Homeland Infrastructure Database",
  elevation: "USGS 3D Elevation Program",
  coast_distance_m: "NOAA Shoreline Data",
  tree_canopy_pct: "USGS National Land Cover Database",
  ndvi_current: "Landsat Vegetation Health Index",
  parcel_id: "County Parcel Records",
  parcel_area_m2: "County Parcel Records",
  parcel_owner: "County Parcel Records",
  parcel_match_type: "County Parcel Records",
  political_region: "U.S. Census Bureau",
  political_county: "U.S. Census Bureau",
  political_locality: "U.S. Census Bureau",
  tract_geoid: "U.S. Census Bureau",
  surface_management_agency: "BLM Surface Management Agency",
  seismic_pga_2pct_50yr_g: "USGS Seismic Hazard Model",
};

/** Human-readable labels for field names shown in the Clear Checks section */
const FIELD_LABELS: Record<string, string> = {
  elevation: "Elevation",
  slope_degrees: "Slope",
  coast_distance_m: "Distance to coast",
  within_floodplain_polygon: "FEMA floodplain",
  intersects_wetland: "Wetland overlap",
  intersects_nhd_area: "Water feature overlap",
  surface_water_permanence_pct: "Surface water presence",
  lcms_class: "Land cover type",
  land_use_class: "Land use classification",
  tree_canopy_pct: "Tree canopy cover",
  ndvi_current: "Vegetation health (NDVI)",
  ndvi_change_5y: "Vegetation trend (5-year)",
  nearest_major_road_distance_m: "Nearest major road",
  nearest_major_road_name: "Major road name",
  parcel_id: "Parcel ID",
  parcel_area_m2: "Parcel area",
  parcel_owner: "Parcel owner",
  parcel_zoning: "Zoning designation",
  parcel_match_type: "Parcel match type",
  political_region: "State",
  political_county: "County",
  political_locality: "City/Town",
  tract_geoid: "Census tract",
  intersects_conservation_easement: "Conservation easement",
  intersects_protected_area: "Protected area overlap",
  intersects_critical_habitat: "Critical habitat overlap",
  surface_management_agency: "Surface management agency",
  wildfire_annual_frequency: "Annual wildfire probability",
  seismic_pga_2pct_50yr_g: "Seismic ground acceleration",
  seismic_design_category: "Seismic design category",
  nearest_transmission_line_distance_m: "Nearest power line",
  wetland_type: "Wetland type",
  wetland_subtype: "Wetland subtype",
  wetland_acres: "Wetland size",
  wetlands_within_500m_count: "Nearby wetlands (500 m)",
  nearest_flowline_name: "Nearest stream/river",
  huc_12_name: "Watershed name",
  soil_drainage_class: "Soil drainage class",
  nearest_dam_distance_m: "Nearest dam",
  nearest_dam_hazard_potential: "Dam hazard potential",
  high_hazard_dams_within_10km: "High-hazard dams nearby",
  soil_shrink_swell_class: "Soil shrink-swell class",
  bedrock_depth_cm: "Depth to bedrock",
  landslide_susceptibility_index: "Landslide susceptibility",
  soil_map_unit_name: "Soil type",
  aspect_cardinal: "Slope direction",
  design_wind_speed_mph: "Design wind speed",
  nearest_urban_area_distance_m: "Nearest urban area",
  housing_units_density_per_km2: "Housing density",
  nearest_waterbody_name: "Nearest lake/pond",
  protected_area_name: "Protected area name",
  protected_area_gap_status: "Protection status (GAP)",
  protected_area_designation: "Protection designation",
  easement_holder: "Easement holder",
  easement_type: "Easement type",
  easement_acres: "Easement area",
  critical_habitat_status: "Critical habitat status",
  critical_habitat_species: "Protected species",
  critical_habitat_listing_status: "Species listing status",
  nearest_rail_line_distance_m: "Nearest rail line",
  nearest_substation_distance_m: "Nearest substation",
  nearest_substation_status: "Substation status",
  electric_utility_service_territory: "Electric utility",
  nearest_public_water_system_name: "Water system",
  fiber_broadband_available: "Fiber broadband",
};

const FIELD_CATEGORIES: Record<string, CheckCategory> = {
  elevation: "terrain",
  slope_degrees: "terrain",
  aspect_cardinal: "terrain",
  bedrock_depth_cm: "terrain",
  landslide_susceptibility_index: "terrain",
  soil_shrink_swell_class: "terrain",
  soil_map_unit_name: "terrain",
  soil_drainage_class: "terrain",

  intersects_wetland: "environmental",
  intersects_nhd_area: "environmental",
  surface_water_permanence_pct: "environmental",
  lcms_class: "environmental",
  land_use_class: "environmental",
  tree_canopy_pct: "environmental",
  ndvi_current: "environmental",
  ndvi_change_5y: "environmental",
  wetland_type: "environmental",
  wetland_subtype: "environmental",
  wetland_acres: "environmental",
  wetlands_within_500m_count: "environmental",
  nearest_flowline_name: "environmental",
  nearest_waterbody_name: "environmental",
  huc_12_name: "environmental",
  intersects_conservation_easement: "habitat",
  intersects_protected_area: "habitat",
  intersects_critical_habitat: "habitat",
  protected_area_name: "habitat",
  protected_area_gap_status: "habitat",
  protected_area_designation: "habitat",
  easement_holder: "habitat",
  easement_type: "habitat",
  easement_acres: "habitat",
  critical_habitat_status: "habitat",
  critical_habitat_species: "habitat",
  critical_habitat_listing_status: "habitat",
  surface_management_agency: "habitat",

  parcel_id: "buildability",
  parcel_area_m2: "buildability",
  parcel_owner: "buildability",
  parcel_zoning: "buildability",
  parcel_match_type: "buildability",
  political_region: "buildability",
  political_county: "buildability",
  political_locality: "buildability",
  tract_geoid: "buildability",

  within_floodplain_polygon: "hazards",
  wildfire_annual_frequency: "hazards",
  seismic_pga_2pct_50yr_g: "hazards",
  seismic_design_category: "hazards",
  design_wind_speed_mph: "hazards",
  nearest_dam_distance_m: "hazards",
  nearest_dam_hazard_potential: "hazards",
  high_hazard_dams_within_10km: "hazards",
  coast_distance_m: "hazards",

  nearest_major_road_distance_m: "access",
  nearest_major_road_name: "access",
  nearest_transmission_line_distance_m: "access",
  nearest_rail_line_distance_m: "access",
  nearest_substation_distance_m: "access",
  nearest_substation_status: "access",
  electric_utility_service_territory: "access",
  nearest_public_water_system_name: "access",
  fiber_broadband_available: "access",
  nearest_urban_area_distance_m: "access",
  housing_units_density_per_km2: "access",
};

/** Format a raw Mireye field value into a human-readable string */
function formatEvidence(field: string, value: unknown): string {
  if (value === null || value === undefined) return "N/A";
  if (typeof value === "boolean") return value ? "Yes" : "No";

  if (typeof value === "number") {
    switch (field) {
      case "elevation":
        return `${value.toFixed(1)} m (${(value * 3.281).toFixed(0)} ft)`;
      case "slope_degrees":
        return `${value.toFixed(1)}°`;
      case "coast_distance_m":
      case "nearest_major_road_distance_m":
      case "nearest_transmission_line_distance_m":
      case "nearest_dam_distance_m":
      case "nearest_urban_area_distance_m":
      case "nearest_rail_line_distance_m":
      case "nearest_substation_distance_m":
        if (value >= 1000) return `${(value / 1000).toFixed(1)} km`;
        return `${Math.round(value)} m`;
      case "parcel_area_m2":
        if (value >= 4047)
          return `${(value / 4047).toFixed(2)} acres (${Math.round(value).toLocaleString()} m²)`;
        return `${Math.round(value).toLocaleString()} m²`;
      case "wildfire_annual_frequency": {
        if (value <= 0) return "Negligible";
        const odds = Math.round(1 / value);
        return `~1 in ${odds.toLocaleString()} per year`;
      }
      case "seismic_pga_2pct_50yr_g":
        return `${value.toFixed(3)}g`;
      case "surface_water_permanence_pct":
      case "tree_canopy_pct":
        return `${Math.round(value)}%`;
      case "ndvi_current":
      case "ndvi_change_5y":
        return value.toFixed(2);
      case "bedrock_depth_cm":
        return `${Math.round(value)} cm`;
      case "wetland_acres":
      case "easement_acres":
        return `${value.toFixed(1)} acres`;
      case "design_wind_speed_mph":
        return `${Math.round(value)} mph`;
      case "housing_units_density_per_km2":
        return `${value.toFixed(1)} per km²`;
      default:
        if (Number.isInteger(value)) return value.toLocaleString();
        return value.toFixed(2);
    }
  }

  return String(value);
}

function evaluateSeverity(field: string, value: unknown): RedFlag | null {
  const rules = SEVERITY_RULES[field];
  if (!rules) return null;
  const cat = FIELD_CATEGORIES[field] ?? "buildability";

  for (const rule of rules) {
    if (rule.threshold === true && value === true) {
      return {
        severity: rule.severity,
        title: rule.message,
        evidence: formatEvidence(field, value),
        sourceField: field,
        sourceCitation: FIELD_CITATIONS[field] ?? "Public geospatial data",
        category: cat,
      };
    }
    if (typeof rule.threshold === "number" && typeof value === "number") {
      const passes =
        rule.threshold >= 0 ? value > rule.threshold : value < rule.threshold;
      if (!passes) continue;
      return {
        severity: rule.severity,
        title: rule.message,
        evidence: formatEvidence(field, value),
        sourceField: field,
        sourceCitation: FIELD_CITATIONS[field] ?? "Public geospatial data",
        category: cat,
      };
    }
    if (typeof rule.threshold === "string" && value === rule.threshold) {
      return {
        severity: rule.severity,
        title: rule.message,
        evidence: formatEvidence(field, value),
        sourceField: field,
        sourceCitation: FIELD_CITATIONS[field] ?? "Public geospatial data",
        category: cat,
      };
    }
    if (rule.threshold === null && value === null) {
      return {
        severity: rule.severity,
        title: rule.message,
        evidence: "Not available",
        sourceField: field,
        sourceCitation: FIELD_CITATIONS[field] ?? "Public geospatial data",
        category: cat,
      };
    }
  }
  return null;
}

export function buildReport(
  baseline: BaselineResult,
  quickHazard: Record<string, unknown>,
  branchResults: Record<string, Record<string, unknown>>,
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

  const severityOrder: Severity[] = [
    "critical",
    "high",
    "medium",
    "low",
    "info",
  ];
  redFlags.sort(
    (a, b) =>
      severityOrder.indexOf(a.severity) - severityOrder.indexOf(b.severity),
  );

  const allKnownFields = [...BASELINE_FIELDS, ...QUICK_HAZARD_FIELDS];
  for (const branch of Object.values(branchResults)) {
    for (const field of Object.keys(branch)) {
      if (!allKnownFields.includes(field as (typeof BASELINE_FIELDS)[number])) {
        allKnownFields.push(field as (typeof BASELINE_FIELDS)[number]);
      }
    }
  }

  const RELATED_FIELDS: Record<string, string[]> = {
    intersects_protected_area: [
      "protected_area_name",
      "protected_area_gap_status",
      "protected_area_designation",
      "surface_management_agency",
    ],
    intersects_critical_habitat: [
      "critical_habitat_status",
      "critical_habitat_species",
      "critical_habitat_listing_status",
    ],
    intersects_conservation_easement: [
      "easement_holder",
      "easement_type",
      "easement_acres",
    ],
    intersects_wetland: ["wetland_type", "wetland_subtype", "wetland_acres"],
  };

  const flaggedFields = new Set(redFlags.map((rf) => rf.sourceField));
  for (const rf of redFlags) {
    const related = RELATED_FIELDS[rf.sourceField];
    if (related) {
      for (const r of related) flaggedFields.add(r);
    }
  }

  const clearChecks: ClearCheck[] = allKnownFields
    .filter((f) => checkedFields.has(f) && !flaggedFields.has(f))
    .map((f) => ({
      field: f,
      label: FIELD_LABELS[f] ?? f,
      value: formatEvidence(f, allData[f] ?? null),
      category: FIELD_CATEGORIES[f] ?? "buildability",
    }));

  const flagsBySeverity: Record<Severity, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    info: 0,
  };
  for (const flag of redFlags) {
    flagsBySeverity[flag.severity]++;
  }

  const summary: ReportSummary = {
    totalChecks: checkedFields.size,
    clearCount: clearChecks.length,
    flagsBySeverity,
  };

  const notCovered = [
    "Title ownership & chain of title",
    "Liens, encumbrances, judgments",
    "HOA / POA covenants, fees, restrictions",
    "Mineral rights, water rights, timber rights",
    "Septic / well permitting & feasibility",
    "Local building codes & permit requirements",
    "Survey boundaries & encroachments",
    "Insurance availability & cost",
  ];

  return { redFlags, clearChecks, notCovered, summary };
}
