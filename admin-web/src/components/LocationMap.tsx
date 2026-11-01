import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { LatLng } from '@/lib/geo'

const PIN = `<svg viewBox="0 0 24 24" width="36" height="36" aria-hidden="true"><path d="M12 22.5s7.5-6.4 7.5-12.6a7.5 7.5 0 1 0-15 0c0 6.2 7.5 12.6 7.5 12.6z" fill="currentColor" stroke="#fff" stroke-width="1.5"/><circle cx="12" cy="9.9" r="2.8" fill="#fff"/></svg>`
const INDIA: L.LatLngTuple = [22.5, 79]

const ok = (n: number | null | undefined): n is number => typeof n === 'number' && Number.isFinite(n)

/** Fits the delivery circle, or centres on the pin when there is no circle (or no layout yet). */
function showArea({ map, circle }: { map: L.Map; circle: L.Circle }, centre: L.LatLngExpression) {
  if (map.hasLayer(circle) && map.getSize().x > 0) map.fitBounds(circle.getBounds(), { padding: [16, 16] })
  else map.setView(centre, 15)
}

/**
 * OpenStreetMap with the store pin and its delivery circle. Clicking the map or dragging the pin
 * reports a new point; outside changes (typed numbers, search, current location) move the view to the pin.
 */
export function LocationMap({
  lat,
  lng,
  radiusKm,
  onPick,
  label,
}: {
  lat: number | null
  lng: number | null
  radiusKm: number | null
  onPick: (point: LatLng) => void
  label: string
}) {
  const box = useRef<HTMLDivElement>(null)
  const parts = useRef<{ map: L.Map; pin: L.Marker; circle: L.Circle } | null>(null)
  const picked = useRef<LatLng | null>(null)
  const shown = useRef(false)
  const pickRef = useRef(onPick)
  useEffect(() => {
    pickRef.current = onPick
  }, [onPick])

  useEffect(() => {
    if (!box.current) return
    const map = L.map(box.current, { center: INDIA, zoom: 5, scrollWheelZoom: false })
    map.attributionControl.setPrefix(false)
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>',
    }).addTo(map)
    const pin = L.marker(INDIA, {
      draggable: true,
      autoPan: true,
      title: label,
      icon: L.divIcon({ className: 'store-pin', html: PIN, iconSize: [36, 36], iconAnchor: [18, 34] }),
    })
    const circle = L.circle(INDIA, { radius: 1000, className: 'store-radius', interactive: false })
    const report = (p: L.LatLng) => {
      const point = { lat: Math.round(p.lat * 1e6) / 1e6, lng: Math.round(p.lng * 1e6) / 1e6 }
      picked.current = point
      pickRef.current(point)
    }
    pin.on('drag', () => circle.setLatLng(pin.getLatLng()))
    pin.on('dragend', () => report(pin.getLatLng()))
    map.on('click', (e: L.LeafletMouseEvent) => report(e.latlng))
    parts.current = { map, pin, circle }
    // A new map (also React's dev double mount) starts by showing the whole delivery area
    shown.current = false

    const resize = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => map.invalidateSize())
    resize?.observe(box.current)
    return () => {
      resize?.disconnect()
      map.remove()
      parts.current = null
    }
    // The map is created once; the title is only a tooltip
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Pin and circle follow the form values
  useEffect(() => {
    const p = parts.current
    if (!p) return
    if (!ok(lat) || !ok(lng)) {
      p.pin.remove()
      p.circle.remove()
      return
    }
    p.pin.setLatLng([lat, lng]).addTo(p.map)
    p.circle.setLatLng([lat, lng])
    if (ok(radiusKm) && radiusKm > 0) p.circle.setRadius(radiusKm * 1000).addTo(p.map)
    else p.circle.remove()
  }, [lat, lng, radiusKm])

  // The view moves to the pin only when the change did not come from the map itself
  useEffect(() => {
    const p = parts.current
    if (!p || !ok(lat) || !ok(lng)) return
    if (!shown.current) {
      shown.current = true
      showArea(p, [lat, lng])
      return
    }
    if (picked.current?.lat === lat && picked.current?.lng === lng) return
    const timer = setTimeout(() => p.map.setView([lat, lng], Math.max(p.map.getZoom(), 16)), 400)
    return () => clearTimeout(timer)
  }, [lat, lng])

  // A new radius zooms to show the whole delivery area
  const lastRadius = useRef(radiusKm)
  useEffect(() => {
    const p = parts.current
    if (!p || radiusKm === lastRadius.current) return
    lastRadius.current = radiusKm
    const timer = setTimeout(() => showArea(p, p.pin.getLatLng()), 500)
    return () => clearTimeout(timer)
  }, [radiusKm])

  return <div ref={box} role="region" aria-label={label} className="isolate h-72 w-full overflow-hidden rounded-md border sm:h-96" />
}
