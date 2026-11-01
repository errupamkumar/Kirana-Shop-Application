import { t } from '@/i18n'
import type { OrderStatus, PaymentStatus, RequestStatus } from './types'

/** Mirrors OrderStateMachine (ADMIN actor) on the server: every order is accepted before it is packed and dispatched. */
const ADMIN_NEXT: Record<OrderStatus, OrderStatus[]> = {
  PENDING_PAYMENT: ['CANCELLED'],
  PLACED: ['ACCEPTED', 'CANCELLED'],
  ACCEPTED: ['PACKED', 'CANCELLED'],
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

export function statusLabel(status: OrderStatus): string {
  return t(`status.${status}`)
}

/** Button text for moving an order to a status. */
export function actionLabel(status: OrderStatus): string {
  return t(`action.${status}`)
}

export const STATUS_CLASS: Record<OrderStatus, string> = {
  PENDING_PAYMENT: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
  PLACED: 'bg-blue-100 text-blue-800 dark:bg-blue-500/15 dark:text-blue-300',
  ACCEPTED: 'bg-teal-100 text-teal-800 dark:bg-teal-500/15 dark:text-teal-300',
  PACKED: 'bg-violet-100 text-violet-800 dark:bg-violet-500/15 dark:text-violet-300',
  OUT_FOR_DELIVERY: 'bg-orange-100 text-orange-800 dark:bg-orange-500/15 dark:text-orange-300',
  DELIVERED: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300',
  CANCELLED: 'bg-neutral-200 text-neutral-700 dark:bg-neutral-500/20 dark:text-neutral-300',
}

/** Payment label in context: a cancelled cash order was simply never charged. */
export function paymentLabel(status: OrderStatus, paymentStatus: PaymentStatus): string {
  return status === 'CANCELLED' && paymentStatus === 'COD_PENDING' ? t('payment.notCharged') : t(`payment.${paymentStatus}`)
}

export const ALL_STATUSES: OrderStatus[] = ['PENDING_PAYMENT', 'PLACED', 'ACCEPTED', 'PACKED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED']

export function requestStatusLabel(status: RequestStatus): string {
  return t(`requestStatus.${status}`)
}

export const REQUEST_CLASS: Record<RequestStatus, string> = {
  PENDING: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
  ACCEPTED: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300',
  REJECTED: 'bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-300',
  CANCELLED: 'bg-neutral-200 text-neutral-700 dark:bg-neutral-500/20 dark:text-neutral-300',
}
