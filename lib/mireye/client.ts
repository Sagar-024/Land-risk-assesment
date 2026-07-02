export async function fetchMireyeFields(
  lat: number,
  lng: number,
  fields: readonly string[]
): Promise<Record<string, unknown>> {
  const baseUrl = process.env.MIREYE_BASE_URL;
  const token = process.env.MIREYE_API_TOKEN;

  if (!baseUrl || !token) {
    throw new Error('Mireye config missing: set MIREYE_BASE_URL and MIREYE_API_TOKEN');
  }

  const params = new URLSearchParams({
    lat: lat.toString(),
    lng: lng.toString(),
    fields: fields.join(','),
  });

  const res = await fetch(`${baseUrl}/v1/fetch?${params}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Mireye API error ${res.status}: ${text}`);
  }

  return res.json();
}