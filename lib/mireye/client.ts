export async function fetchMireyeFields(
  lat: number,
  lng: number,
  fields: readonly string[],
): Promise<Record<string, unknown>> {
  const baseUrl = process.env.MIREYE_BASE_URL ?? "https://api.mireye.com/v1";
  const token = process.env.MIREYE_API_TOKEN;

  if (!token) {
    throw new Error("MIREYE_API_TOKEN not configured");
  }

  const res = await fetch(`${baseUrl}/fetch`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ lat, lng, fields: Array.from(fields) }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Mireye API error ${res.status}: ${text}`);
  }

  const data = await res.json();
  const fieldValues: Record<string, unknown> = {};
  for (const [key, field] of Object.entries(data.fields ?? {}) as [
    string,
    { value: unknown },
  ][]) {
    fieldValues[key] = field.value;
  }
  return fieldValues;
}
