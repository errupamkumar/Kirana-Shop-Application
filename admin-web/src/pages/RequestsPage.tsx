import { Mic, RefreshCw } from 'lucide-react'
import { useSearchParams } from 'react-router'
import { Button } from '@/components/ui/button'
import { EmptyState, ErrorState, LoadingRows, PageHeader, Pagination, selectClass } from '@/components/common'
import { RequestBadge, RequestDrawer } from '@/components/RequestDrawer'
import { useT } from '@/i18n'
import { mediaUrl } from '@/lib/env'
import { formatDateTime, formatInr } from '@/lib/format'
import { requestStatusLabel } from '@/lib/orderStatus'
import { useOrderRequests } from '@/lib/queries'
import type { RequestStatus } from '@/lib/types'
import { usePageTitle } from '@/lib/usePageTitle'

const STATUSES: RequestStatus[] = ['PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED']

/** List photos and voice notes from customers; open one to read or listen and build the order. */
export default function RequestsPage() {
  const t = useT()
  usePageTitle(t('requests.title'))
  const [params, setParams] = useSearchParams()
  // Waiting requests first; "all" shows everything
  const status = params.get('status') ?? 'PENDING'
  const page = Number(params.get('page') ?? 0)
  const openId = params.get('open') ? Number(params.get('open')) : null
  const { data, isLoading, isFetching, error, refetch } = useOrderRequests(status === 'all' ? '' : status, page)

  function setParam(key: string, value: string | undefined) {
    setParams((prev) => {
      const next = new URLSearchParams(prev)
      if (value) next.set(key, value)
      else next.delete(key)
      if (key !== 'page' && key !== 'open') next.delete('page')
      return next
    })
  }

  return (
    <>
      <PageHeader
        title={t('requests.title')}
        description={t('requests.description')}
        actions={
          <Button variant="outline" size="sm" onClick={() => void refetch()} disabled={isFetching}>
            <RefreshCw className={isFetching ? 'animate-spin' : undefined} /> {t('orders.refresh')}
          </Button>
        }
      />

      <div className="mb-4 flex items-center gap-2">
        <label htmlFor="request-status" className="text-sm text-muted-foreground">
          {t('requests.filter')}
        </label>
        <select id="request-status" className={selectClass} value={status} onChange={(e) => setParam('status', e.target.value)}>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {requestStatusLabel(s)}
            </option>
          ))}
          <option value="all">{t('requests.all')}</option>
        </select>
      </div>

      {error ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : isLoading || !data ? (
        <LoadingRows />
      ) : data.content.length === 0 ? (
        <EmptyState message={t('requests.none')} />
      ) : (
        <>
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-label={t('requests.title')}>
            {data.content.map((r) => {
              const image = mediaUrl(r.imageUrl)
              return (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => setParam('open', String(r.id))}
                    className="flex w-full gap-3 rounded-lg border bg-background p-3 text-left transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  >
                    {image ? (
                      <img src={image} alt="" className="size-20 shrink-0 rounded-md border object-cover" />
                    ) : (
                      <span className="flex size-20 shrink-0 items-center justify-center rounded-md border bg-emerald-50 dark:bg-emerald-500/10">
                        <Mic className="size-7 text-emerald-700 dark:text-emerald-300" />
                      </span>
                    )}
                    <span className="min-w-0 flex-1 space-y-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className="font-medium">{t('requests.item', { id: r.id })}</span>
                        <RequestBadge status={r.status} />
                      </span>
                      <span className="block truncate text-sm">
                        {r.customerName ?? t('common.customer')} · {r.customerPhone}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {[
                          r.imageUrl ? t('requests.photo') : null,
                          r.audioUrl ? (r.audioSeconds ? t('requests.voiceSeconds', { seconds: r.audioSeconds }) : t('requests.voice')) : null,
                        ]
                          .filter(Boolean)
                          .join(' + ')}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {formatDateTime(r.createdAt)}
                        {r.orderNumber && ` · ${r.orderNumber} · ${formatInr(r.orderTotal)}`}
                      </span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
          <Pagination page={data.page} totalPages={data.totalPages} onPage={(p) => setParam('page', String(p))} />
        </>
      )}

      <RequestDrawer requestId={openId} onClose={() => setParam('open', undefined)} />
    </>
  )
}
