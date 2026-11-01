import { ExternalLink, MapPin, NotebookPen, Printer } from 'lucide-react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { apiErrorMessage } from '@/lib/api'
import { formatDateTime, formatInr, mapsUrl } from '@/lib/format'
import { localName, t as tNow, useLang, useT } from '@/i18n'
import { paymentLabel, statusLabel } from '@/lib/orderStatus'
import { useOrder, useUpdateOrderStatus } from '@/lib/queries'
import type { OrderStatus } from '@/lib/types'
import { ErrorState, LoadingRows, StatusBadge } from './common'
import { StatusActions } from './StatusActions'

export function OrderDrawer({ orderId, onClose }: { orderId: number | null; onClose: () => void }) {
  const { data: order, isLoading, error, refetch } = useOrder(orderId)
  const update = useUpdateOrderStatus()
  const t = useT()
  const lang = useLang()

  function changeStatus(status: OrderStatus, note?: string) {
    if (!order) return
    update.mutate(
      { id: order.id, status, note },
      {
        onSuccess: (o) => toast.success(tNow('drawer.updated', { number: o.orderNumber, status: statusLabel(o.status) })),
        onError: (e) => toast.error(apiErrorMessage(e)),
      },
    )
  }

  return (
    <Sheet open={orderId != null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="overflow-y-auto data-[side=right]:w-full data-[side=right]:sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{order ? order.orderNumber : t('drawer.order')}</SheetTitle>
          <SheetDescription>{order ? t('drawer.placed', { time: formatDateTime(order.placedAt) }) : t('drawer.loading')}</SheetDescription>
        </SheetHeader>
        <div className="space-y-5 px-4 pb-6">
          {error ? (
            <ErrorState error={error} onRetry={() => void refetch()} />
          ) : isLoading || !order ? (
            <LoadingRows rows={6} />
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={order.status} />
                <Badge variant="outline">{order.paymentMethod}</Badge>
                <Badge variant="secondary">{paymentLabel(order.status, order.paymentStatus)}</Badge>
              </div>

              {order.status === 'PLACED' && <p className="rounded-md bg-blue-50 p-2 text-sm text-blue-900 dark:bg-blue-500/15 dark:text-blue-100">{t('drawer.acceptHint')}</p>}
              <StatusActions status={order.status} busy={update.isPending} onChange={changeStatus} />

              {order.requestId != null && (
                <div className="flex items-center gap-3 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm dark:border-emerald-500/30 dark:bg-emerald-500/10">
                  <NotebookPen className="size-5 shrink-0 text-emerald-700 dark:text-emerald-300" />
                  <div className="flex-1">
                    <p className="font-medium">{t('drawer.fromRequest', { id: order.requestId })}</p>
                    <p className="text-muted-foreground">{t('drawer.fromRequestBody')}</p>
                  </div>
                  <Button variant="outline" size="sm" asChild>
                    <Link to={`/requests?open=${order.requestId}`}>{t('drawer.viewRequest')}</Link>
                  </Button>
                </div>
              )}

              {order.cancelReason && (
                <p className="rounded-md bg-muted p-3 text-sm">
                  <span className="font-medium">{t('drawer.cancelReason')}</span> {order.cancelReason}
                </p>
              )}

              <section>
                <h3 className="mb-2 text-sm font-semibold">{t('drawer.items')}</h3>
                <ul className="divide-y rounded-md border">
                  {order.items.map((item, i) => (
                    <li key={i} className="flex justify-between gap-3 px-3 py-2 text-sm">
                      <span>
                        {localName({ name: item.productName, nameHi: item.productNameHi }, lang)}{' '}
                        {item.variantLabel && <span className="text-muted-foreground">({item.variantLabel})</span>} × {item.qty}
                      </span>
                      <span className="tabular-nums">{formatInr(item.lineTotal)}</span>
                    </li>
                  ))}
                </ul>
                <dl className="mt-3 space-y-1 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">{t('drawer.subtotal')}</dt>
                    <dd className="tabular-nums">{formatInr(order.itemSubtotal)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">{t('drawer.deliveryFee')}</dt>
                    <dd className="tabular-nums">{order.deliveryFee === 0 ? t('common.free') : formatInr(order.deliveryFee)}</dd>
                  </div>
                  <div className="flex justify-between font-semibold">
                    <dt>{t('drawer.total')}</dt>
                    <dd className="tabular-nums">{formatInr(order.total)}</dd>
                  </div>
                </dl>
              </section>

              <Separator />

              <section className="space-y-1 text-sm">
                <h3 className="mb-2 font-semibold">{t('drawer.deliverTo')}</h3>
                <p className="font-medium">
                  {order.address.name ?? t('common.customer')} · <a href={`tel:${order.address.phone}`} className="underline">{order.address.phone}</a>
                </p>
                <p>
                  {order.address.line1}
                  {order.address.line2 && `, ${order.address.line2}`}
                </p>
                {order.address.landmark && <p className="text-muted-foreground">{t('drawer.near', { landmark: order.address.landmark })}</p>}
                <p>{t('drawer.pinDistance', { pincode: order.address.pincode, km: order.distanceKm })}</p>
                <a
                  href={mapsUrl(order.address.lat, order.address.lng)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-emerald-700 hover:underline"
                >
                  <MapPin className="size-4" /> {t('drawer.maps')} <ExternalLink className="size-3" />
                </a>
                {order.customerNote && (
                  <p className="mt-2 rounded-md bg-amber-50 p-2 text-amber-950 dark:bg-amber-500/15 dark:text-amber-100">
                    <span className="font-medium">{t('drawer.note')}</span> {order.customerNote}
                  </p>
                )}
              </section>

              <Separator />

              <section>
                <h3 className="mb-2 text-sm font-semibold">{t('drawer.history')}</h3>
                <ol className="space-y-2 border-l pl-4">
                  {order.history.map((h, i) => (
                    <li key={i} className="text-sm">
                      <span className="font-medium">{statusLabel(h.toStatus)}</span>{' '}
                      <span className="text-muted-foreground">
                        {formatDateTime(h.createdAt)} · {t(`actor.${h.changedByType}`)}
                      </span>
                      {h.note && <p className="text-muted-foreground">{h.note}</p>}
                    </li>
                  ))}
                </ol>
              </section>

              <Button variant="outline" asChild>
                <a href={`/orders/${order.id}/invoice`} target="_blank" rel="noreferrer">
                  <Printer /> {t('drawer.invoice')}
                </a>
              </Button>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
