import { describe, expect, it } from 'vitest'
import { addCatalogLine, draftTotals, toAcceptBody, type DraftLine } from './requestOrder'

const rules = { deliveryCharge: 30, freeDeliveryAbove: 1000 }
const atta = { variantId: 7, name: 'Whole Wheat Atta', label: '5 kg', price: 259, stock: 10 }

describe('order built from a list request', () => {
  it('adds a catalog size once and bumps its quantity after that', () => {
    let lines: DraftLine[] = []
    lines = addCatalogLine(lines, atta)
    lines = addCatalogLine(lines, atta)
    expect(lines).toHaveLength(1)
    expect(lines[0].qty).toBe(2)
  })

  it('charges delivery below the free threshold and none from it up (no minimum order)', () => {
    const small: DraftLine[] = [{ ...atta, key: 'a', qty: 1 }]
    expect(draftTotals(small, rules)).toEqual({ subtotal: 259, fee: 30, total: 289 })
    const big: DraftLine[] = [{ ...atta, key: 'a', qty: 4 }]
    expect(draftTotals(big, rules)).toEqual({ subtotal: 1036, fee: 0, total: 1036 })
    expect(draftTotals([], rules).total).toBe(0)
  })

  it('splits catalog and free-text lines for the API', () => {
    const lines: DraftLine[] = [
      { ...atta, key: 'a', qty: 2 },
      { key: 'c1', variantId: null, name: ' Lux soap ', label: '', price: 35, qty: 3, stock: null },
    ]
    expect(toAcceptBody(lines, '  sent fresh  ')).toEqual({
      items: [{ variantId: 7, qty: 2 }],
      customItems: [{ name: 'Lux soap', label: null, price: 35, qty: 3 }],
      note: 'sent fresh',
    })
  })
})
