import { ExternalLink, MapPin, Printer } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { apiErrorMessage } from '@/lib/api'
import { formatDateTime, formatInr, mapsUrl } from '@/lib/format'
import { paymentLabel, STATUS_LABEL } from '@/lib/orderStatus'
import { useOrder, useUpdateOrderStatus } from '@/lib/queries'
import type { OrderStatus } from '@/lib/types'
import { ErrorState, LoadingRows, StatusBadge } from './common'
import { StatusActions } from './StatusActions'

export function OrderDrawer({ orderId, onClose }: { orderId: number | null; onClose: () => void }) {
  const { data: order, isLoading, error, refetch } = useOrder(orderId)
  const update = useUpdateOrderStatus()

  function changeStatus(status: OrderStatus, note?: string) {
    if (!order) return
    update.mutate(
      { id: order.id, status, note },
      {
        onSuccess: (o) => toast.success(`${o.orderNumber}: ${STATUS_LABEL[o.status]}`),
        onError: (e) => toast.error(apiErrorMessage(e)),
      },
    )
  }

  return (
    <Sheet open={orderId != null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{order ? order.orderNumber : 'Order'}</SheetTitle>
          <SheetDescription>{order ? `Placed ${formatDateTime(order.placedAt)}` : 'Loading order'}</SheetDescription>
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

              <StatusActions status={order.status} busy={update.isPending} onChange={changeStatus} />

              {order.cancelReason && (
                <p className="rounded-md bg-muted p-3 text-sm">
                  <span className="font-medium">Cancel reason:</span> {order.cancelReason}
                </p>
              )}

              <section>
                <h3 className="mb-2 text-sm font-semibold">Items</h3>
                <ul className="divide-y rounded-md border">
                  {order.items.map((item, i) => (
                    <li key={i} className="flex justify-between gap-3 px-3 py-2 text-sm">
                      <span>
                        {item.productName} <span className="text-muted-foreground">({item.variantLabel})</span> × {item.qty}
                      </span>
                      <span className="tabular-nums">{formatInr(item.lineTotal)}</span>
                    </li>
                  ))}
                </ul>
                <dl className="mt-3 space-y-1 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Item subtotal</dt>
                    <dd className="tabular-nums">{formatInr(order.itemSubtotal)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Delivery fee</dt>
                    <dd className="tabular-nums">{order.deliveryFee === 0 ? 'FREE' : formatInr(order.deliveryFee)}</dd>
                  </div>
                  <div className="flex justify-between font-semibold">
                    <dt>Total</dt>
                    <dd className="tabular-nums">{formatInr(order.total)}</dd>
                  </div>
                </dl>
              </section>

              <Separator />

              <section className="space-y-1 text-sm">
                <h3 className="mb-2 font-semibold">Deliver to</h3>
                <p className="font-medium">
                  {order.address.name ?? 'Customer'} · <a href={`tel:${order.address.phone}`} className="underline">{order.address.phone}</a>
                </p>
                <p>
                  {order.address.line1}
                  {order.address.line2 && `, ${order.address.line2}`}
                </p>
                {order.address.landmark && <p className="text-muted-foreground">Near {order.address.landmark}</p>}
                <p>PIN {order.address.pincode} · {order.distanceKm} km from store</p>
                <a
                  href={mapsUrl(order.address.lat, order.address.lng)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-emerald-700 hover:underline"
                >
                  <MapPin className="size-4" /> Open in Google Maps <ExternalLink className="size-3" />
                </a>
                {order.customerNote && (
                  <p className="mt-2 rounded-md bg-amber-50 p-2">
                    <span className="font-medium">Note:</span> {order.customerNote}
                  </p>
                )}
              </section>

              <Separator />

              <section>
                <h3 className="mb-2 text-sm font-semibold">History</h3>
                <ol className="space-y-2 border-l pl-4">
                  {order.history.map((h, i) => (
                    <li key={i} className="text-sm">
                      <span className="font-medium">{STATUS_LABEL[h.toStatus]}</span>{' '}
                      <span className="text-muted-foreground">
                        {formatDateTime(h.createdAt)} · {h.changedByType.toLowerCase()}
                      </span>
                      {h.note && <p className="text-muted-foreground">{h.note}</p>}
                    </li>
                  ))}
                </ol>
              </section>

              <Button variant="outline" asChild>
                <a href={`/orders/${order.id}/invoice`} target="_blank" rel="noreferrer">
                  <Printer /> Print invoice
                </a>
              </Button>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
