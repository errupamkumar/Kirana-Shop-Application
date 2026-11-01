import { useMemo, useState } from 'react'
import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from '@tanstack/react-table'
import { NotebookPen, RefreshCw, Search } from 'lucide-react'
import { useSearchParams } from 'react-router'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { EmptyState, ErrorState, LoadingRows, PageHeader, Pagination, StatusBadge, selectClass } from '@/components/common'
import { OrderDrawer } from '@/components/OrderDrawer'
import { formatDateTime, formatInr } from '@/lib/format'
import { t, useT } from '@/i18n'
import { ALL_STATUSES, paymentLabel, statusLabel } from '@/lib/orderStatus'
import { useOrders } from '@/lib/queries'
import type { OrderStatus, OrderSummary } from '@/lib/types'
import { usePageTitle } from '@/lib/usePageTitle'

const columns: ColumnDef<OrderSummary>[] = [
  {
    header: () => t('orders.colOrder'),
    accessorKey: 'orderNumber',
    cell: ({ row }) => (
      <span className="inline-flex items-center gap-1.5 font-medium">
        {row.original.orderNumber}
        {row.original.requestId != null && <NotebookPen className="size-3.5 text-emerald-600" aria-label={t('orders.fromRequest')} />}
      </span>
    ),
  },
  {
    header: () => t('orders.colCustomer'),
    id: 'customer',
    cell: ({ row }) => (
      <div className="leading-tight">
        <div>{row.original.customerName ?? '—'}</div>
        <div className="text-xs text-muted-foreground">{row.original.customerPhone}</div>
      </div>
    ),
  },
  { header: () => t('orders.colItems'), accessorKey: 'itemCount' },
  {
    header: () => t('orders.colTotal'),
    accessorKey: 'total',
    cell: ({ row }) => <span className="tabular-nums">{formatInr(row.original.total)}</span>,
  },
  {
    header: () => t('orders.colPayment'),
    id: 'payment',
    cell: ({ row }) => (
      <div className="flex flex-col gap-1">
        <Badge variant="outline">{row.original.paymentMethod}</Badge>
        <span className="text-xs text-muted-foreground">{paymentLabel(row.original.status, row.original.paymentStatus)}</span>
      </div>
    ),
  },
  { header: () => t('orders.colStatus'), accessorKey: 'status', cell: ({ row }) => <StatusBadge status={row.original.status} /> },
  { header: () => t('orders.colPlaced'), accessorKey: 'placedAt', cell: ({ row }) => formatDateTime(row.original.placedAt) },
]

export default function OrdersPage() {
  const tr = useT()
  usePageTitle(tr('orders.title'))
  const [params, setParams] = useSearchParams()
  const [search, setSearch] = useState(params.get('q') ?? '')
  const status = (params.get('status') as OrderStatus | null) ?? undefined
  const from = params.get('from') ?? undefined
  const to = params.get('to') ?? undefined
  const q = params.get('q') ?? undefined
  const page = Number(params.get('page') ?? 0)
  const openId = params.get('open') ? Number(params.get('open')) : null

  const filters = useMemo(() => ({ status, from, to, q, page }), [status, from, to, q, page])
  const { data, isLoading, isFetching, error, refetch } = useOrders(filters)

  function setParam(key: string, value: string | undefined) {
    setParams((prev) => {
      const next = new URLSearchParams(prev)
      if (value) next.set(key, value)
      else next.delete(key)
      if (key !== 'page' && key !== 'open') next.delete('page')
      return next
    })
  }

  const table = useReactTable({ data: data?.content ?? [], columns, getCoreRowModel: getCoreRowModel() })

  return (
    <>
      <PageHeader
        title={tr('orders.title')}
        description={tr('orders.description')}
        actions={
          <Button variant="outline" size="sm" onClick={() => void refetch()} disabled={isFetching}>
            <RefreshCw className={isFetching ? 'animate-spin' : undefined} /> {tr('orders.refresh')}
          </Button>
        }
      />

      <div className="mb-4 grid grid-cols-2 items-end gap-3 sm:flex sm:flex-wrap">
        <form
          className="relative col-span-2 sm:col-span-1"
          onSubmit={(e) => {
            e.preventDefault()
            setParam('q', search.trim() || undefined)
          }}
        >
          <Search className="pointer-events-none absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
          <Input
            aria-label={tr('orders.search')}
            placeholder={tr('orders.searchPlaceholder')}
            className="w-full pl-8 sm:w-64"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onBlur={() => setParam('q', search.trim() || undefined)}
          />
        </form>
        <select
          aria-label={tr('orders.status')}
          className={`${selectClass} col-span-2 w-full sm:col-span-1 sm:w-auto`}
          value={status ?? ''}
          onChange={(e) => setParam('status', e.target.value || undefined)}
        >
          <option value="">{tr('orders.allStatuses')}</option>
          {ALL_STATUSES.map((s) => (
            <option key={s} value={s}>
              {statusLabel(s)}
            </option>
          ))}
        </select>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground sm:flex-row sm:items-center sm:gap-2 sm:text-sm">
          {tr('orders.from')}
          <Input type="date" className="w-full sm:w-40" value={from ?? ''} onChange={(e) => setParam('from', e.target.value || undefined)} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground sm:flex-row sm:items-center sm:gap-2 sm:text-sm">
          {tr('orders.to')}
          <Input type="date" className="w-full sm:w-40" value={to ?? ''} onChange={(e) => setParam('to', e.target.value || undefined)} />
        </label>
        {(status || from || to || q) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearch('')
              setParams(new URLSearchParams())
            }}
          >
            {tr('orders.clearFilters')}
          </Button>
        )}
      </div>

      {error ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : isLoading ? (
        <LoadingRows />
      ) : !data || data.content.length === 0 ? (
        <EmptyState message={tr('orders.none')} />
      ) : (
        <>
        {/* Phones: one card per order */}
        <ul className="space-y-2 md:hidden" aria-label={tr('orders.title')}>
          {data.content.map((o) => (
            <li key={o.id}>
              <button
                type="button"
                onClick={() => setParam('open', String(o.id))}
                className="w-full rounded-lg border bg-background p-3 text-left transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{o.orderNumber}</span>
                  <StatusBadge status={o.status} />
                </div>
                <div className="mt-1 flex items-center justify-between gap-2 text-sm">
                  <span className="truncate text-muted-foreground">
                    {o.customerName ?? tr('common.customer')} · {o.customerPhone}
                  </span>
                  <span className="font-semibold tabular-nums">{formatInr(o.total)}</span>
                </div>
                <div className="mt-1 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span>
                    {tr('orders.items', { n: o.itemCount })} · {o.paymentMethod} · {paymentLabel(o.status, o.paymentStatus)}
                  </span>
                  <span>{formatDateTime(o.placedAt)}</span>
                </div>
              </button>
            </li>
          ))}
        </ul>
        <div className="hidden rounded-lg border bg-background md:block">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((group) => (
                <TableRow key={group.id}>
                  {group.headers.map((header) => (
                    <TableHead key={header.id}>{flexRender(header.column.columnDef.header, header.getContext())}</TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  className="cursor-pointer"
                  tabIndex={0}
                  onClick={() => setParam('open', String(row.original.id))}
                  onKeyDown={(e) => e.key === 'Enter' && setParam('open', String(row.original.id))}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        </>
      )}
      {data && <Pagination page={data.page} totalPages={data.totalPages} onPage={(p) => setParam('page', String(p))} />}

      <OrderDrawer orderId={openId} onClose={() => setParam('open', undefined)} />
    </>
  )
}
