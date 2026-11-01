import { dateLocale, t, useLanguageStore, type MessageKey } from '../i18n';
import type { OrderDetail, OrderStatus, PaymentStatus, RequestStatus } from './types';

const STATUS_KEY: Record<OrderStatus, MessageKey> = {
  PENDING_PAYMENT: 'status.PENDING_PAYMENT',
  PLACED: 'status.PLACED',
  ACCEPTED: 'status.ACCEPTED',
  PACKED: 'status.PACKED',
  OUT_FOR_DELIVERY: 'status.OUT_FOR_DELIVERY',
  DELIVERED: 'status.DELIVERED',
  CANCELLED: 'status.CANCELLED',
};

export function statusLabel(status: OrderStatus): string {
  return t(STATUS_KEY[status]);
}

/** Badge colours per status (background + text). */
export const STATUS_TONE: Record<OrderStatus, string> = {
  PENDING_PAYMENT: 'bg-amber-100 text-amber-800',
  PLACED: 'bg-blue-100 text-blue-800',
  ACCEPTED: 'bg-teal-100 text-teal-800',
  PACKED: 'bg-violet-100 text-violet-800',
  OUT_FOR_DELIVERY: 'bg-orange-100 text-orange-800',
  DELIVERED: 'bg-brand-100 text-brand-700',
  CANCELLED: 'bg-gray-200 text-gray-700',
};

const PAYMENT_KEY: Record<PaymentStatus, MessageKey> = {
  PENDING: 'payment.PENDING',
  PAID: 'payment.PAID',
  FAILED: 'payment.FAILED',
  REFUND_PENDING: 'payment.REFUND_PENDING',
  COD_PENDING: 'payment.COD_PENDING',
  COD_COLLECTED: 'payment.COD_COLLECTED',
};

/** Payment line in context: a cancelled cash order was simply never charged. */
export function paymentLabel(status: OrderStatus, paymentStatus: PaymentStatus): string {
  return status === 'CANCELLED' && paymentStatus === 'COD_PENDING' ? t('payment.notCharged') : t(PAYMENT_KEY[paymentStatus]);
}

export const REQUEST_TONE: Record<RequestStatus, string> = {
  PENDING: 'bg-amber-100 text-amber-800',
  ACCEPTED: 'bg-brand-100 text-brand-700',
  REJECTED: 'bg-red-100 text-red-700',
  CANCELLED: 'bg-gray-200 text-gray-700',
};

export function requestStatusLabel(status: RequestStatus): string {
  return t(`requestStatus.${status}`);
}

/** Tracking steps; no delivery countdowns, only what has happened and when. Every order is accepted before packing. */
export const TRACK_STEPS: OrderStatus[] = ['PLACED', 'ACCEPTED', 'PACKED', 'OUT_FOR_DELIVERY', 'DELIVERED'];

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
    label: statusLabel(status),
    done: index <= reached,
    current: index === reached,
    at: [...order.history].reverse().find((h) => h.toStatus === status)?.createdAt ?? null,
  }));
}

const formatters = new Map<string, Intl.DateTimeFormat>();

/** "31 Oct, 10:30 pm" in the chosen language (India time). */
export function formatTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const locale = dateLocale(useLanguageStore.getState().lang);
  let format = formatters.get(locale);
  if (!format) {
    format = new Intl.DateTimeFormat(locale, { timeZone: 'Asia/Kolkata', hour: 'numeric', minute: '2-digit', day: 'numeric', month: 'short' });
    formatters.set(locale, format);
  }
  return format.format(new Date(iso));
}
