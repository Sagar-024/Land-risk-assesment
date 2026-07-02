export async function geocodeAddress(address: string): Promise<{ lat: number; lng: number }> {
  const params = new URLSearchParams({
    address,
    benchmark: 'Public_AR_Current',
    format: 'json',
  });

  const res = await fetch(`https://geocoding.geo.census.gov/geocoder/locations/onelineaddress?${params}`);

  if (!res.ok) {
    throw new Error(`Census geocoder error ${res.status}`);
  }

  const data = await res.json();

  const matches = data.result?.addressMatches;
  if (!matches?.length) {
    throw new Error(`Address not found: ${address}`);
  }

  const { coordinates } = matches[0];
  return { lat: coordinates.y, lng: coordinates.x };
}