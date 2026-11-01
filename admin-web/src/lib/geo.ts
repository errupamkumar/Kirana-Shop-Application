export interface LatLng {
  lat: number
  lng: number
}

export interface Place extends LatLng {
  name: string
}

const round6 = (n: number) => Math.round(n * 1e6) / 1e6

function valid(lat: number, lng: number): LatLng | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null
  return { lat: round6(lat), lng: round6(lng) }
}

const NUM = String.raw`(-?\d{1,3}(?:\.\d+)?)`
const PATTERNS = [
  // Google Maps place links: !3d<lat>!4d<lng> is the pin itself (the @ part is only the view centre)
  new RegExp(String.raw`!3d${NUM}!4d${NUM}`),
  new RegExp(String.raw`[?&](?:q|query|ll|center|destination|daddr)=(?:loc:)?${NUM},\s*${NUM}`),
  new RegExp(String.raw`@${NUM},${NUM}`),
  new RegExp(String.raw`geo:${NUM},${NUM}`),
  new RegExp(String.raw`^\s*${NUM}\s*[,\s]\s*${NUM}\s*$`),
]
// 25°05'46.0"N 85°18'47.2"E, as Google Maps shows a dropped pin
const DMS = /(\d{1,3})°\s*(\d{1,2})['′]\s*(\d{1,2}(?:\.\d+)?)["″]?\s*([NS])[\s,]+(\d{1,3})°\s*(\d{1,2})['′]\s*(\d{1,2}(?:\.\d+)?)["″]?\s*([EW])/i

/** Reads a point from typed coordinates, a Google Maps / geo: link, or degrees-minutes-seconds. */
export function parseLatLng(text: string): LatLng | null {
  let s = text.trim()
  try {
    s = decodeURIComponent(s)
  } catch {
    // keep the raw text
  }
  for (const re of PATTERNS) {
    const m = s.match(re)
    if (m) return valid(Number(m[1]), Number(m[2]))
  }
  const d = s.match(DMS)
  if (d) {
    const part = (deg: string, min: string, sec: string, hemi: string) =>
      (Number(deg) + Number(min) / 60 + Number(sec) / 3600) * (/[SW]/i.test(hemi) ? -1 : 1)
    return valid(part(d[1], d[2], d[3], d[4]), part(d[5], d[6], d[7], d[8]))
  }
  return null
}

/** maps.app.goo.gl links hide the coordinates behind a redirect the browser cannot follow for us. */
export function isShortMapsLink(text: string): boolean {
  return /(?:maps\.app\.goo\.gl|goo\.gl\/maps)\//i.test(text)
}

const NOMINATIM = 'https://nominatim.openstreetmap.org/search'
let lastSearch = 0

/**
 * Place search on OpenStreetMap (Nominatim). Called only when the owner presses Search (the service
 * allows at most one request a second and no search-as-you-type). Plain fetch: no API token is sent.
 */
export async function searchPlaces(query: string, lang: string, signal?: AbortSignal): Promise<Place[]> {
  const wait = lastSearch + 1100 - Date.now()
  if (wait > 0) await new Promise((r) => setTimeout(r, wait))
  lastSearch = Date.now()
  const params = new URLSearchParams({ format: 'jsonv2', limit: '5', countrycodes: 'in', 'accept-language': `${lang},en`, q: query })
  const res = await fetch(`${NOMINATIM}?${params}`, { signal, headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error(`Search failed (${res.status})`)
  const rows = (await res.json()) as { display_name: string; lat: string; lon: string }[]
  return rows.flatMap((r) => {
    const p = valid(Number(r.lat), Number(r.lon))
    return p ? [{ ...p, name: r.display_name }] : []
  })
}
