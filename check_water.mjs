import "dotenv/config";

const BASE_URL = process.env.MIREYE_BASE_URL ?? "https://api.mireye.com/v1";
const TOKEN = process.env.MIREYE_API_TOKEN;

const fields = [
  "nearest_public_water_system_name",
  "public_water_system_population_served"
];

async function main() {
  const address = "Indian Rocks Beach, FL";
  const lat = 27.8966;
  const lng = -82.8488;
  console.log(`Coords: ${lat}, ${lng}`);

  const res = await fetch(`${BASE_URL}/fetch`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${TOKEN}`,
    },
    body: JSON.stringify({ lat, lng, fields }),
  });

  const responseJson = await res.json();
  console.log(JSON.stringify(responseJson.fields, null, 2));
}
main();
