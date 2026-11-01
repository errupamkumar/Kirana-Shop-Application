import { useState } from 'react'
import { ExternalLink, MapPin, RotateCw, ZoomIn, ZoomOut } from 'lucide-react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { useT } from '@/i18n'
import { mediaUrl } from '@/lib/env'
import { formatDateTime, formatInr, mapsUrl } from '@/lib/format'
import { REQUEST_CLASS, requestStatusLabel, statusLabel } from '@/lib/orderStatus'
import { useOrderRequest } from '@/lib/queries'
import type { OrderRequest } from '@/lib/types'
import { cn } from '@/lib/utils'
import { ErrorState, LoadingRows } from './common'
import { OrderBuilder } from './OrderBuilder'

export function RequestBadge({ status }: { status: OrderRequest['status'] }) {
  useT()
  return (
    <span className={cn('inline-flex rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap', REQUEST_CLASS[status])}>
      {requestStatusLabel(status)}
    </span>
  )
}

/** Handwriting is easier to read with zoom and rotation (photos are often taken sideways). */
function PhotoViewer({ url }: { url: string }) {
  const t = useT()
  const [rotation, setRotation] = useState(0)
  const [zoom, setZoom] = useState(1)
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1">
        <Button type="button" size="sm" variant="outline" onClick={() => setRotation((r) => (r + 90) % 360)}>
          <RotateCw /> {t('request.rotate')}
        </Button>
        <Button type="button" size="icon" variant="outline" className="size-8" aria-label={t('request.zoomIn')} onClick={() => setZoom((z) => Math.min(3, z + 0.5))}>
          <ZoomIn />
        </Button>
        <Button type="button" size="icon" variant="outline" className="size-8" aria-label={t('request.zoomOut')} onClick={() => setZoom((z) => Math.max(1, z - 0.5))}>
          <ZoomOut />
        </Button>
        <Button type="button" size="sm" variant="ghost" asChild>
          <a href={url} target="_blank" rel="noreferrer">
            {t('request.fullSize')} <ExternalLink />
          </a>
        </Button>
      </div>
      <div className="flex max-h-[60vh] items-center justify-center overflow-auto rounded-md border bg-muted/50 p-2">
        <img
          src={url}
          alt={t('request.photoAlt')}
          className="max-w-full origin-center transition-transform"
          style={{ transform: `rotate(${rotation}deg) scale(${zoom})` }}
        />
      </div>
    </div>
  )
}

export function RequestDrawer({ requestId, onClose }: { requestId: number | null; onClose: () => void }) {
  const t = useT()
  const { data: r, isLoading, error, refetch } = useOrderRequest(requestId)
  const image = mediaUrl(r?.imageUrl)
  const audio = mediaUrl(r?.audioUrl)

  return (
    <Sheet open={requestId != null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="overflow-y-auto data-[side=right]:w-full data-[side=right]:sm:max-w-5xl">
        <SheetHeader>
          <SheetTitle>{t('requests.item', { id: requestId ?? '' })}</SheetTitle>
          <SheetDescription>{r ? t('request.sentAt', { time: formatDateTime(r.createdAt) }) : t('request.loading')}</SheetDescription>
        </SheetHeader>
        <div className="px-4 pb-6">
          {error ? (
            <ErrorState error={error} onRetry={() => void refetch()} />
          ) : isLoading || !r ? (
            <LoadingRows rows={6} />
          ) : (
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="space-y-5">
                <RequestBadge status={r.status} />
                {image && (
                  <section>
                    <h3 className="mb-2 text-sm font-semibold">{t('request.photo')}</h3>
                    <PhotoViewer url={image} />
                  </section>
                )}
                {audio && (
                  <section>
                    <h3 className="mb-2 text-sm font-semibold">{t('request.voice')}</h3>
                    <audio controls preload="metadata" src={audio} className="w-full" />
                  </section>
                )}
                {r.note && (
                  <section>
                    <h3 className="mb-1 text-sm font-semibold">{t('request.note')}</h3>
                    <p className="rounded-md bg-amber-50 p-2 text-sm text-amber-950 dark:bg-amber-500/15 dark:text-amber-100">{r.note}</p>
                  </section>
                )}
                <Separator />
                <section className="space-y-1 text-sm">
                  <h3 className="mb-2 font-semibold">{t('request.deliverTo')}</h3>
                  <p className="font-medium">
                    {r.customerName ?? t('common.customer')} ·{' '}
                    <a href={`tel:${r.customerPhone}`} className="underline">
                      {r.customerPhone}
                    </a>
                  </p>
                  <p>
                    {r.address.line1}
                    {r.address.line2 && `, ${r.address.line2}`}
                  </p>
                  {r.address.landmark && <p className="text-muted-foreground">{t('drawer.near', { landmark: r.address.landmark })}</p>}
                  <p>{t('drawer.pinDistance', { pincode: r.address.pincode, km: r.distanceKm })}</p>
                  <a
                    href={mapsUrl(r.address.lat, r.address.lng)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-emerald-700 hover:underline"
                  >
                    <MapPin className="size-4" /> {t('drawer.maps')} <ExternalLink className="size-3" />
                  </a>
                </section>
              </div>

              <div>
                {r.status === 'PENDING' ? (
                  <OrderBuilder key={r.id} requestId={r.id} />
                ) : r.status === 'ACCEPTED' ? (
                  <div className="space-y-3 rounded-md border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-500/30 dark:bg-emerald-500/10">
                    <p className="font-semibold">{t('request.acceptedTitle', { number: r.orderNumber ?? '' })}</p>
                    {r.orderStatus && (
                      <p className="text-sm">{t('request.acceptedBody', { status: statusLabel(r.orderStatus), total: formatInr(r.orderTotal) })}</p>
                    )}
                    {r.orderId != null && (
                      <Button asChild size="sm">
                        <Link to={`/orders?open=${r.orderId}`}>{t('request.openOrder')}</Link>
                      </Button>
                    )}
                  </div>
                ) : r.status === 'REJECTED' ? (
                  <div className="space-y-1 rounded-md border border-red-200 bg-red-50 p-4 text-sm dark:border-red-500/30 dark:bg-red-500/10">
                    <p className="font-semibold">{t('request.rejectedTitle')}</p>
                    {r.rejectReason && <p>{r.rejectReason}</p>}
                  </div>
                ) : (
                  <p className="rounded-md bg-muted p-4 text-sm">{t('request.cancelledTitle')}</p>
                )}
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
