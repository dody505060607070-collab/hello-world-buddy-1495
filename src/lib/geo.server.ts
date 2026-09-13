// استخراج إحداثيات العقار من رابط خرائط جوجل (بما فيها الروابط المختصرة)
export type Coords = { latitude: number; longitude: number };

function valid(lat: number, lng: number): Coords | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  if (lat === 0 && lng === 0) return null;
  return { latitude: lat, longitude: lng };
}

export function extractCoordsFromUrl(url: string): Coords | null {
  const decoded = (() => {
    try {
      return decodeURIComponent(url);
    } catch {
      return url;
    }
  })();

  const patterns: RegExp[] = [
    /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/,
    /@(-?\d+\.\d+),(-?\d+\.\d+)/,
    /[?&](?:q|query|ll|daddr|destination|center)=(-?\d+\.\d+),\s*(-?\d+\.\d+)/,
    /\/(-?\d+\.\d+),(-?\d+\.\d+)/,
  ];
  for (const pattern of patterns) {
    const match = decoded.match(pattern);
    if (match) {
      const coords = valid(Number(match[1]), Number(match[2]));
      if (coords) return coords;
    }
  }
  return null;
}

async function followRedirects(url: string, maxHops = 6): Promise<string> {
  let current = url;
  for (let i = 0; i < maxHops; i += 1) {
    const response = await fetch(current, {
      redirect: "manual",
      headers: { "user-agent": "Mozilla/5.0 (compatible; RashoudiBot/1.0)" },
    });
    const next = response.headers.get("location");
    if (!next) return current;
    current = new URL(next, current).toString();
    const coords = extractCoordsFromUrl(current);
    if (coords) return current;
  }
  return current;
}

function extractPlaceQuery(url: string): string | null {
  try {
    const parsed = new URL(url);
    const q = parsed.searchParams.get("q") ?? parsed.searchParams.get("query");
    if (q && !/^-?\d+\.\d+,/.test(q)) return q;
    const placeMatch = parsed.pathname.match(/\/place\/([^/@]+)/);
    if (placeMatch?.[1]) return decodeURIComponent(placeMatch[1].replace(/\+/g, " "));
  } catch {
    /* ignore */
  }
  return null;
}

async function geocode(query: string): Promise<Coords | null> {
  const endpoint = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=sa&q=${encodeURIComponent(
    query,
  )}`;
  const response = await fetch(endpoint, {
    headers: { "user-agent": "RashoudiRealEstate/1.0 (contact: info@al-rashudi.com)" },
  });
  if (!response.ok) return null;
  const rows = (await response.json()) as { lat?: string; lon?: string }[];
  const first = rows?.[0];
  if (!first?.lat || !first.lon) return null;
  return valid(Number(first.lat), Number(first.lon));
}

export async function resolveMapUrlToCoords(
  mapUrl: string | null | undefined,
  fallbackQuery?: string | null,
): Promise<Coords | null> {
  if (mapUrl) {
    const direct = extractCoordsFromUrl(mapUrl);
    if (direct) return direct;
    try {
      const finalUrl = await followRedirects(mapUrl);
      const coords = extractCoordsFromUrl(finalUrl);
      if (coords) return coords;
      const placeQuery = extractPlaceQuery(finalUrl);
      if (placeQuery) {
        const geocoded = await geocode(placeQuery);
        if (geocoded) return geocoded;
      }
    } catch {
      /* ignore network issues */
    }
  }
  if (fallbackQuery) {
    try {
      return await geocode(fallbackQuery);
    } catch {
      return null;
    }
  }
  return null;
}
