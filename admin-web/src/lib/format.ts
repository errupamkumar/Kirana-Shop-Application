import { dateLocale, getLang } from '@/i18n'

const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 })

export function formatInr(amount: number | null | undefined): string {
  return amount == null ? '—' : inr.format(amount)
}

const formatters = new Map<string, Intl.DateTimeFormat>()

/** Cached per language: dates and month names follow the chosen language, always in India time. */
function formatter(kind: 'dateTime' | 'date'): Intl.DateTimeFormat {
  const locale = dateLocale(getLang())
  const key = `${kind}:${locale}`
  let format = formatters.get(key)
  if (!format) {
    format =
      kind === 'dateTime'
        ? new Intl.DateTimeFormat(locale, { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
        : new Intl.DateTimeFormat(locale, { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric' })
    formatters.set(key, format)
  }
  return format
}

/** Timestamps are UTC from the API and shown in India time. */
export function formatDateTime(iso: string | null | undefined): string {
  return iso ? formatter('dateTime').format(new Date(iso)) : '—'
}

export function formatDate(iso: string | null | undefined): string {
  return iso ? formatter('date').format(new Date(iso)) : '—'
}

export function mapsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
}
