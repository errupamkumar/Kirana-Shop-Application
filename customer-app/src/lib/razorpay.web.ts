import type { OrderDetail } from './types';
import type { RazorpayResult } from './razorpay';

/** Razorpay's checkout is a native module; in the browser build online payment cannot be opened. */
export async function openRazorpay(_order: OrderDetail, _storeName: string, _phone: string): Promise<RazorpayResult> {
  return { ok: false, cancelled: false, message: 'Online payment works in the Android app, not in the browser preview' };
}
