export const BASELINE_FIELDS = [
  "elevation",
  "slope_degrees",
  "coast_distance_m",
  "within_floodplain_polygon",
  "intersects_wetland",
  "intersects_nhd_area",
  "surface_water_permanence_pct",
  "lcms_class",
  "land_use_class",
  "tree_canopy_pct",
  "ndvi_current",
  "ndvi_change_5y",
  "nearest_major_road_distance_m",
  "nearest_major_road_name",
  "parcel_id",
  "parcel_area_m2",
  "parcel_owner",
  "parcel_zoning",
  "parcel_match_type",
  "political_region",
  "political_county",
  "political_locality",
  "tract_geoid",
] as const;

export const QUICK_HAZARD_FIELDS = [
  "intersects_conservation_easement",
  "intersects_protected_area",
  "intersects_critical_habitat",
  "surface_management_agency",
  "wildfire_annual_frequency",
  "seismic_pga_2pct_50yr_g",
  "seismic_design_category",
] as const;

export type BaselineResult = Record<
  (typeof BASELINE_FIELDS)[number] | (typeof QUICK_HAZARD_FIELDS)[number],
  unknown
>;

export type ConditionalBranch = {
  id: string;
  trigger: (baseline: BaselineResult) => boolean;
  fields: readonly string[];
};

function get(obj: BaselineResult, key: string): unknown {
  return obj[key as keyof BaselineResult];
}

export const CONDITIONAL_BRANCHES: readonly ConditionalBranch[] = [
  {
    id: "near_water",
    trigger: (b) =>
      ((get(b, "nearest_wetland_distance_m") as number | null) !== null &&
        (get(b, "nearest_wetland_distance_m") as number) < 100) ||
      get(b, "intersects_wetland") === true ||
      get(b, "intersects_nhd_area") === true ||
      (get(b, "surface_water_permanence_pct") as number) > 0,
    fields: [
      "wetland_type",
      "wetland_subtype",
      "wetland_acres",
      "wetlands_within_500m_count",
      "nearest_flowline_name",
      "huc_12_name",
      "soil_drainage_class",
      "nearest_dam_distance_m",
      "nearest_dam_hazard_potential",
      "high_hazard_dams_within_10km",
    ] as const,
  },
  {
    id: "steep_slope",
    trigger: (b) => (get(b, "slope_degrees") as number) > 15,
    fields: [
      "soil_shrink_swell_class",
      "bedrock_depth_cm",
      "landslide_susceptibility_index",
      "soil_map_unit_name",
      "aspect_cardinal",
    ] as const,
  },
  {
    id: "high_fire_risk",
    trigger: (b) =>
      (get(b, "wildfire_annual_frequency") as number) > 0.001 ||
      (get(b, "lcms_class") === "Tree" &&
        (get(b, "tree_canopy_pct") as number) > 60) ||
      (get(b, "ndvi_change_5y") as number) < -0.15,
    fields: [
      "design_wind_speed_mph",
      "nearest_urban_area_distance_m",
      "housing_units_density_per_km2",
    ] as const,
  },
  {
    id: "floodplain_proximity",
    trigger: (b) =>
      get(b, "within_floodplain_polygon") === true ||
      ((get(b, "elevation") as number) < 10 &&
        (get(b, "coast_distance_m") as number) < 5000),
    fields: [
      "intersects_nhd_area",
      "nearest_flowline_name",
      "nearest_waterbody_name",
      "huc_12_name",
      "design_wind_speed_mph",
    ] as const,
  },
  {
    id: "conservation_habitat",
    trigger: (b) =>
      get(b, "intersects_conservation_easement") === true ||
      get(b, "intersects_protected_area") === true ||
      get(b, "intersects_critical_habitat") === true,
    fields: [
      "protected_area_name",
      "protected_area_gap_status",
      "protected_area_designation",
      "easement_holder",
      "easement_type",
      "easement_acres",
      "critical_habitat_status",
      "critical_habitat_species",
      "critical_habitat_listing_status",
    ] as const,
  },
  {
    id: "no_road_access",
    trigger: (b) => {
      const d = get(b, "nearest_major_road_distance_m") as number | null;
      return d === null || d > 1000;
    },
    fields: ["nearest_rail_line_distance_m"] as const,
  },
  {
    id: "far_from_grid",
    trigger: (b) => {
      const d = get(b, "nearest_transmission_line_distance_m") as number | null;
      return d === null || d > 5000;
    },
    fields: [
      "nearest_substation_distance_m",
      "nearest_substation_status",
      "electric_utility_service_territory",
      "nearest_public_water_system_name",
      "fiber_broadband_available",
    ] as const,
  },
] as const;

export type FieldGroup =
  | typeof BASELINE_FIELDS
  | typeof QUICK_HAZARD_FIELDS
  | ConditionalBranch["fields"];
export type AllMireyeFields =
  | (typeof BASELINE_FIELDS)[number]
  | (typeof QUICK_HAZARD_FIELDS)[number]
  | FieldGroup[number];
