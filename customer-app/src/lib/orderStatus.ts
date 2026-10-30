import type { OrderDetail, OrderStatus, PaymentStatus } from './types';

export const STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING_PAYMENT: 'Awaiting payment',
  PLACED: 'Order placed',
  PACKED: 'Packed',
  OUT_FOR_DELIVERY: 'Out for delivery',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
};

/** Badge colours per status (background + text). */
export const STATUS_TONE: Record<OrderStatus, string> = {
  PENDING_PAYMENT: 'bg-amber-100 text-amber-800',
  PLACED: 'bg-blue-100 text-blue-800',
  PACKED: 'bg-violet-100 text-violet-800',
  OUT_FOR_DELIVERY: 'bg-orange-100 text-orange-800',
  DELIVERED: 'bg-brand-100 text-brand-700',
  CANCELLED: 'bg-gray-200 text-gray-700',
};

export const PAYMENT_LABEL: Record<PaymentStatus, string> = {
  PENDING: 'Payment pending',
  PAID: 'Paid online',
  FAILED: 'Payment failed',
  REFUND_PENDING: 'Refund in progress',
  COD_PENDING: 'Pay cash on delivery',
  COD_COLLECTED: 'Paid in cash',
};

/** Payment line in context: a cancelled cash order was simply never charged. */
export function paymentLabel(status: OrderStatus, paymentStatus: PaymentStatus): string {
  return status === 'CANCELLED' && paymentStatus === 'COD_PENDING' ? 'Not charged' : PAYMENT_LABEL[paymentStatus];
}

/** Tracking steps; no delivery countdowns, only what has happened and when. */
export const TRACK_STEPS: OrderStatus[] = ['PLACED', 'PACKED', 'OUT_FOR_DELIVERY', 'DELIVERED'];

export interface TrackStep {
  status: OrderStatus;
  label: string;
  done: boolean;
  current: boolean;
  at: string | null;
}

export function trackingSteps(order: Pick<OrderDetail, 'status' | 'history'>): TrackStep[] {
  const reached = order.status === 'CANCELLED' || order.status === 'PENDING_PAYMENT' ? -1 : TRACK_STEPS.indexOf(order.status);
  return TRACK_STEPS.map((status, index) => ({
    status,
    label: STATUS_LABEL[status],
    done: index <= reached,
    current: index === reached,
    at: [...order.history].reverse().find((h) => h.toStatus === status)?.createdAt ?? null,
  }));
}

const time = new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', hour: 'numeric', minute: '2-digit', day: 'numeric', month: 'short' });

export function formatTime(iso: string | null | undefined): string {
  return iso ? time.format(new Date(iso)) : '';
}
