import type { AcceptRequestBody } from './types'

/** A line in the order the store builds from a list request: a catalog size (variantId) or a free-text item. */
export interface DraftLine {
  key: string
  variantId: number | null
  name: string
  label: string
  price: number
  qty: number
  /** Stock left for catalog items; free-text items are not tracked. */
  stock: number | null
}

export interface DeliveryRules {
  deliveryCharge: number
  freeDeliveryAbove: number | null
}

const round2 = (n: number) => Math.round(n * 100) / 100

/** Mirrors the server: free delivery from the threshold up, otherwise the flat charge. No minimum order for requests. */
export function draftTotals(lines: DraftLine[], rules: DeliveryRules | undefined) {
  const subtotal = round2(lines.reduce((sum, l) => sum + l.price * l.qty, 0))
  const fee = !rules || lines.length === 0 ? 0 : rules.freeDeliveryAbove != null && subtotal >= rules.freeDeliveryAbove ? 0 : rules.deliveryCharge
  return { subtotal, fee, total: round2(subtotal + fee) }
}

/** Adds a catalog size, or bumps its quantity when it is already in the order. */
export function addCatalogLine(lines: DraftLine[], line: Omit<DraftLine, 'key' | 'qty'>): DraftLine[] {
  const existing = lines.find((l) => l.variantId === line.variantId)
  if (existing) return lines.map((l) => (l === existing ? { ...l, qty: Math.min(l.qty + 1, 50) } : l))
  return [...lines, { ...line, key: `v${line.variantId}`, qty: 1 }]
}

export function toAcceptBody(lines: DraftLine[], note: string): AcceptRequestBody {
  return {
    items: lines.filter((l) => l.variantId != null).map((l) => ({ variantId: l.variantId!, qty: l.qty })),
    customItems: lines
      .filter((l) => l.variantId == null)
      .map((l) => ({ name: l.name.trim(), label: l.label.trim() || null, price: l.price, qty: l.qty })),
    note: note.trim() || null,
  }
}
