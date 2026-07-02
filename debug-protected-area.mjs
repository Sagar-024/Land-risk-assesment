/**
 * Follow-up: Check ALL conservation_habitat branch fields for Indian Rocks Beach
 * to determine if the entire PAD-US join is broken or just the name/bool pair.
 */

import "dotenv/config";

const BASE_URL = process.env.MIREYE_BASE_URL ?? "https://api.mireye.com/v1";
const TOKEN = process.env.MIREYE_API_TOKEN;

// All fields from the conservation_habitat branch
const BRANCH_FIELDS = [
  "intersects_protected_area",
  "intersects_conservation_easement",
  "intersects_critical_habitat",
  "protected_area_name",
  "protected_area_gap_status",
  "protected_area_designation",
  "easement_holder",
  "easement_type",
  "easement_acres",
  "critical_habitat_status",
  "critical_habitat_species",
  "critical_habitat_listing_status",
];

async function fetchFields(lat, lng, fields) {
  const res = await fetch(`${BASE_URL}/fetch`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${TOKEN}`,
    },
    body: JSON.stringify({ lat, lng, fields }),
  });
  if (!res.ok) throw new Error(`Mireye ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const result = {};
  for (const [key, field] of Object.entries(data.fields ?? {})) {
    result[key] = field.value;
  }
  return result;
}

async function main() {
  console.log(
    "=== Full Conservation Branch Fields — Indian Rocks Beach, FL ===\n",
  );
  console.log("Coordinates: 27.883, -82.851\n");

  const result = await fetchFields(27.883, -82.851, BRANCH_FIELDS);

  for (const field of BRANCH_FIELDS) {
    const val = result[field];
    const status = val === null || val === false ? "✅ clean" : "⚠️  CHECK";
    console.log(`  ${field}: ${JSON.stringify(val)}  ${status}`);
  }

  console.log(
    "\n--- Comparison: Midway Atoll (actual Papahanaumokuakea area) ---\n",
  );
  const midway = await fetchFields(28.207, -177.381, BRANCH_FIELDS);
  for (const field of BRANCH_FIELDS) {
    console.log(`  ${field}: ${JSON.stringify(midway[field])}`);
  }
}

main().catch(console.error);
