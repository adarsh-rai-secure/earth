// Nominatim geocoder (OpenStreetMap). Free, rate-limited to 1 req/sec.
// Requires User-Agent header per their usage policy.

export type GeocodeHit = {
  lat: number;
  lng: number;
  displayName: string;
};

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const USER_AGENT = "earth-amaearth-build/1.0 (https://earth-rouge.vercel.app)";

export async function geocodeAddress(address: string): Promise<GeocodeHit> {
  const url = `${NOMINATIM_URL}?q=${encodeURIComponent(address)}&format=json&limit=1&addressdetails=0`;
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Nominatim ${res.status}: ${body.slice(0, 200)}`);
  }
  const data = (await res.json()) as Array<{ lat: string; lon: string; display_name: string }>;
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error(`Nominatim: no result for "${address}"`);
  }
  const hit = data[0];
  return { lat: Number(hit.lat), lng: Number(hit.lon), displayName: hit.display_name };
}
