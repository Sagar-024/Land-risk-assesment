export async function geocodeAddress(
  address: string,
): Promise<{ lat: number; lng: number }> {
  const encoded = encodeURIComponent(address);
  const url = `https://geocoding.geo.census.gov/geocoder/locations/onelineaddress?address=${encoded}&benchmark=Public_AR_Current&format=json`;

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Census geocoder error ${res.status}`);
  }

  const data = await res.json();
  const matches = data.result?.addressMatches;

  if (!matches?.length) {
    throw new Error(
      `Address not found. Try a full address like "1600 Pennsylvania Ave NW, Washington, DC 20500"`,
    );
  }

  const { x: lng, y: lat } = matches[0].coordinates;
  return { lat, lng };
}
