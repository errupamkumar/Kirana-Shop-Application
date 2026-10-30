import { addMoney, formatPrice } from './money';
import type { PaymentMethod } from './types';

// Display-side copies of the store rules. The server re-checks everything at order time.

/** "Add ₹X more to enable order", or null once the minimum is met. */
export function minOrderMessage(itemSubtotal: number, minOrderAmount: number): string | null {
  const remaining = addMoney(minOrderAmount, -itemSubtotal);
  return remaining > 0 ? `Add ${formatPrice(remaining)} more to enable order` : null;
}

/** 0..1 progress toward the minimum order. */
export function minOrderProgress(itemSubtotal: number, minOrderAmount: number): number {
  if (minOrderAmount <= 0) return 1;
  return Math.max(0, Math.min(1, itemSubtotal / minOrderAmount));
}

export function deliveryFee(itemSubtotal: number, deliveryCharge: number, freeDeliveryAbove: number | null): number {
  return freeDeliveryAbove != null && itemSubtotal >= freeDeliveryAbove ? 0 : deliveryCharge;
}

/** "Add ₹Y more for free delivery", or null when already free or there is no threshold. */
export function freeDeliveryMessage(itemSubtotal: number, freeDeliveryAbove: number | null): string | null {
  if (freeDeliveryAbove == null) return null;
  const remaining = addMoney(freeDeliveryAbove, -itemSubtotal);
  return remaining > 0 ? `Add ${formatPrice(remaining)} more for free delivery` : null;
}

export interface PlaceOrderState {
  itemSubtotal: number;
  minOrderAmount: number;
  serviceable: boolean | null;
  storeOpen: boolean;
  paymentMethod: PaymentMethod | null;
  validating: boolean;
  hasAddress: boolean;
  hasBlockingIssues: boolean;
}

/**
 * Place Order is disabled when itemSubtotal < minOrderAmount, the address is not serviceable,
 * the store is closed, no payment method is chosen, a quote is in flight, or the server reported a problem.
 */
export function placeOrderDisabledReason(s: PlaceOrderState): string | null {
  if (!s.storeOpen) return 'Store is closed right now';
  if (s.itemSubtotal < s.minOrderAmount) return minOrderMessage(s.itemSubtotal, s.minOrderAmount);
  if (!s.hasAddress) return 'Add a delivery address';
  if (s.serviceable !== true) return "We don't deliver to this address yet";
  if (!s.paymentMethod) return 'Choose a payment method';
  if (s.validating) return 'Checking prices…';
  if (s.hasBlockingIssues) return 'Fix the items marked above';
  return null;
}

export function isPlaceOrderDisabled(s: PlaceOrderState): boolean {
  return placeOrderDisabledReason(s) !== null;
}

/** New key per checkout attempt; reused for retries of the same attempt. */
export function newIdempotencyKey(): string {
  const random = Math.random().toString(36).slice(2, 10);
  return `app-${Date.now().toString(36)}-${random}`;
}
