import "dotenv/config";
import * as fs from "fs";

const BASE_URL = process.env.MIREYE_BASE_URL ?? "https://api.mireye.com/v1";
const TOKEN = process.env.MIREYE_API_TOKEN;

const COMBINED_INITIAL_FIELDS = [
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
  "intersects_conservation_easement",
  "intersects_protected_area",
  "intersects_critical_habitat",
  "surface_management_agency",
  "wildfire_annual_frequency",
  "seismic_pga_2pct_50yr_g",
  "seismic_design_category"
];

async function main() {
  const lat = 34.138300;
  const lng = -118.359126;

  const res = await fetch(`${BASE_URL}/fetch`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${TOKEN}`,
    },
    body: JSON.stringify({ lat, lng, fields: COMBINED_INITIAL_FIELDS }),
  });

  if (!res.ok) {
    throw new Error(`Mireye API Error ${res.status}: ${await res.text()}`);
  }

  const responseJson = await res.json();

  // Save the full, untruncated JSON file to the workspace
  fs.writeFileSync("actual_api_response.json", JSON.stringify(responseJson, null, 2), "utf-8");
  console.log("Full JSON response saved to: actual_api_response.json\n");

  console.log("=== FIELD MEASURED VALUES ===");
  for (const field of COMBINED_INITIAL_FIELDS) {
    const data = responseJson.fields?.[field];
    if (data) {
      console.log(`${field}: ${JSON.stringify(data.value)} (${data.unit ?? 'no unit'})`);
    } else {
      console.log(`${field}: Not Found`);
    }
  }
}

main().catch(console.error);
