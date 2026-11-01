import {
  deliveryFee,
  freeDeliveryMessage,
  isPlaceOrderDisabled,
  minOrderMessage,
  minOrderProgress,
  newIdempotencyKey,
  placeOrderDisabledReason,
  type PlaceOrderState,
} from './checkout';
import { formatInr, formatPrice } from './money';
import { trackingSteps } from './orderStatus';

describe('minimum order message', () => {
  it('asks for the remaining amount below the minimum', () => {
    expect(minOrderMessage(320, 500)).toBe('Add ₹180 more to enable order');
    expect(minOrderMessage(499.99, 500)).toBe('Add ₹0.01 more to enable order');
  });

  it('is null at or above the minimum', () => {
    expect(minOrderMessage(500, 500)).toBeNull();
    expect(minOrderMessage(650, 500)).toBeNull();
  });

  it('reports progress between 0 and 1', () => {
    expect(minOrderProgress(250, 500)).toBe(0.5);
    expect(minOrderProgress(900, 500)).toBe(1);
    expect(minOrderProgress(0, 0)).toBe(1);
  });
});

describe('delivery fee', () => {
  it('is free at the threshold and charged just below it', () => {
    expect(deliveryFee(1000, 30, 1000)).toBe(0);
    expect(deliveryFee(999.99, 30, 1000)).toBe(30);
  });

  it('is never free without a threshold', () => {
    expect(deliveryFee(100000, 30, null)).toBe(30);
    expect(freeDeliveryMessage(100, null)).toBeNull();
  });

  it('nudges toward free delivery', () => {
    expect(freeDeliveryMessage(640, 1000)).toBe('Add ₹360 more for free delivery');
    expect(freeDeliveryMessage(1000, 1000)).toBeNull();
  });
});

describe('Place Order button', () => {
  const ready: PlaceOrderState = {
    itemSubtotal: 600,
    minOrderAmount: 500,
    serviceable: true,
    storeOpen: true,
    paymentMethod: 'COD',
    validating: false,
    hasAddress: true,
    hasBlockingIssues: false,
  };

  it('is enabled when every rule passes', () => {
    expect(isPlaceOrderDisabled(ready)).toBe(false);
    expect(placeOrderDisabledReason(ready)).toBeNull();
  });

  it.each<[string, Partial<PlaceOrderState>, string]>([
    ['below minimum', { itemSubtotal: 499.99 }, 'Add ₹0.01 more to enable order'],
    ['not serviceable', { serviceable: false }, "We don't deliver to this address yet"],
    ['serviceability unknown', { serviceable: null }, "We don't deliver to this address yet"],
    ['store closed', { storeOpen: false }, 'Store is closed right now'],
    ['no payment method', { paymentMethod: null }, 'Choose a payment method'],
    ['quote in flight', { validating: true }, 'Checking prices…'],
    ['no address', { hasAddress: false }, 'Add a delivery address'],
    ['server reported a problem', { hasBlockingIssues: true }, 'Fix the items marked above'],
  ])('is disabled when %s', (_name, patch, reason) => {
    expect(isPlaceOrderDisabled({ ...ready, ...patch })).toBe(true);
    expect(placeOrderDisabledReason({ ...ready, ...patch })).toBe(reason);
  });

  it('allows exactly the minimum', () => {
    expect(isPlaceOrderDisabled({ ...ready, itemSubtotal: 500 })).toBe(false);
  });
});

describe('helpers', () => {
  it('formats rupees', () => {
    expect(formatInr(1234.5)).toBe('₹1,234.50');
    expect(formatPrice(38)).toBe('₹38');
    expect(formatPrice(38.5)).toBe('₹38.50');
  });

  it('creates distinct idempotency keys', () => {
    const keys = new Set(Array.from({ length: 50 }, () => newIdempotencyKey()));
    expect(keys.size).toBe(50);
    expect([...keys][0].length).toBeLessThanOrEqual(100);
  });

  it('builds tracking steps from history', () => {
    const steps = trackingSteps({
      status: 'PACKED',
      history: [
        { fromStatus: null, toStatus: 'PLACED', changedByType: 'CUSTOMER', note: null, createdAt: '2026-10-30T05:00:00Z' },
        { fromStatus: 'PLACED', toStatus: 'PACKED', changedByType: 'ADMIN', note: null, createdAt: '2026-10-30T05:10:00Z' },
      ],
    });
    // Placed, Accepted, Packed, Out for delivery, Delivered
    expect(steps.map((s) => s.status)).toEqual(['PLACED', 'ACCEPTED', 'PACKED', 'OUT_FOR_DELIVERY', 'DELIVERED']);
    expect(steps.map((s) => s.done)).toEqual([true, true, true, false, false]);
    expect(steps[2].current).toBe(true);
    expect(steps[2].at).toBe('2026-10-30T05:10:00Z');
    expect(steps[1].at).toBeNull();
    expect(steps[3].at).toBeNull();

    const cancelled = trackingSteps({ status: 'CANCELLED', history: [] });
    expect(cancelled.every((s) => !s.done)).toBe(true);
  });
});
