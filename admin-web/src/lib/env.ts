/** API origin, e.g. http://localhost:8080 (from VITE_API_BASE_URL in the root .env). */
export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080').replace(/\/$/, '')

/** Uploaded media is stored as a server path (/media/...); absolute URLs are used as is. */
export function mediaUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined
  return url.startsWith('/') ? `${API_BASE_URL}${url}` : url
}
