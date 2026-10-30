import type { RazorpaySuccess } from 'react-native-razorpay';
import type { OrderDetail } from './types';

export type RazorpayResult =
  | { ok: true; data: RazorpaySuccess }
  | { ok: false; cancelled: boolean; message: string };

/**
 * Opens Razorpay checkout for an order in PENDING_PAYMENT. The native module only exists in a development
 * or release build (not Expo Go), so it is loaded lazily.
 */
export async function openRazorpay(order: OrderDetail, storeName: string, phone: string): Promise<RazorpayResult> {
  if (!order.payment?.keyId) {
    return { ok: false, cancelled: false, message: 'Online payment is not configured' };
  }
  let RazorpayCheckout: typeof import('react-native-razorpay').default;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    RazorpayCheckout = require('react-native-razorpay').default;
  } catch {
    return { ok: false, cancelled: false, message: 'Online payment needs the full app build (not Expo Go)' };
  }
  try {
    const data = await RazorpayCheckout.open({
      key: order.payment.keyId,
      order_id: order.payment.gatewayOrderId,
      amount: order.payment.amountPaise,
      currency: order.payment.currency,
      name: storeName,
      description: `Order ${order.orderNumber}`,
      prefill: { contact: phone },
      theme: { color: '#0c831f' },
    });
    return { ok: true, data };
  } catch (e) {
    const err = e as { code?: number; description?: string; error?: { description?: string } };
    // Razorpay uses code 0 / 2 for a user-cancelled checkout
    const cancelled = err.code === 0 || err.code === 2;
    return {
      ok: false,
      cancelled,
      message: cancelled ? 'Payment cancelled' : err.error?.description ?? err.description ?? 'Payment failed',
    };
  }
}
