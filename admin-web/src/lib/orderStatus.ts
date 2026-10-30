import type { OrderStatus, PaymentStatus } from './types'

/** Mirrors OrderStateMachine (ADMIN actor) on the server. */
const ADMIN_NEXT: Record<OrderStatus, OrderStatus[]> = {
  PENDING_PAYMENT: ['CANCELLED'],
  PLACED: ['PACKED', 'CANCELLED'],
  PACKED: ['OUT_FOR_DELIVERY', 'CANCELLED'],
  OUT_FOR_DELIVERY: ['DELIVERED', 'CANCELLED'],
  DELIVERED: [],
  CANCELLED: [],
}

export function nextStatuses(status: OrderStatus): OrderStatus[] {
  return ADMIN_NEXT[status]
}

export function isTerminal(status: OrderStatus): boolean {
  return ADMIN_NEXT[status].length === 0
}

export const STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING_PAYMENT: 'Awaiting payment',
  PLACED: 'Placed',
  PACKED: 'Packed',
  OUT_FOR_DELIVERY: 'Out for delivery',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
}

/** Button text for moving an order to a status. */
export const ACTION_LABEL: Record<OrderStatus, string> = {
  PENDING_PAYMENT: 'Awaiting payment',
  PLACED: 'Mark placed',
  PACKED: 'Mark packed',
  OUT_FOR_DELIVERY: 'Out for delivery',
  DELIVERED: 'Mark delivered',
  CANCELLED: 'Cancel order',
}

export const STATUS_CLASS: Record<OrderStatus, string> = {
  PENDING_PAYMENT: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
  PLACED: 'bg-blue-100 text-blue-800 dark:bg-blue-500/15 dark:text-blue-300',
  PACKED: 'bg-violet-100 text-violet-800 dark:bg-violet-500/15 dark:text-violet-300',
  OUT_FOR_DELIVERY: 'bg-orange-100 text-orange-800 dark:bg-orange-500/15 dark:text-orange-300',
  DELIVERED: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300',
  CANCELLED: 'bg-neutral-200 text-neutral-700 dark:bg-neutral-500/20 dark:text-neutral-300',
}

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  PENDING: 'Payment pending',
  PAID: 'Paid',
  FAILED: 'Payment failed',
  REFUND_PENDING: 'Refund pending',
  COD_PENDING: 'Collect cash',
  COD_COLLECTED: 'Cash collected',
}

/** Payment label in context: a cancelled cash order was simply never charged. */
export function paymentLabel(status: OrderStatus, paymentStatus: PaymentStatus): string {
  return status === 'CANCELLED' && paymentStatus === 'COD_PENDING' ? 'Not charged' : PAYMENT_STATUS_LABEL[paymentStatus]
}

export const ALL_STATUSES: OrderStatus[] = ['PENDING_PAYMENT', 'PLACED', 'PACKED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED']
