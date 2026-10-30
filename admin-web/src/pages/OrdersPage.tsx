import { useMemo, useState } from 'react'
import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from '@tanstack/react-table'
import { RefreshCw, Search } from 'lucide-react'
import { useSearchParams } from 'react-router'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { EmptyState, ErrorState, LoadingRows, PageHeader, Pagination, StatusBadge, selectClass } from '@/components/common'
import { OrderDrawer } from '@/components/OrderDrawer'
import { formatDateTime, formatInr } from '@/lib/format'
import { ALL_STATUSES, paymentLabel, STATUS_LABEL } from '@/lib/orderStatus'
import { useOrders } from '@/lib/queries'
import type { OrderStatus, OrderSummary } from '@/lib/types'
import { usePageTitle } from '@/lib/usePageTitle'

const columns: ColumnDef<OrderSummary>[] = [
  {
    header: 'Order',
    accessorKey: 'orderNumber',
    cell: ({ row }) => <span className="font-medium">{row.original.orderNumber}</span>,
  },
  {
    header: 'Customer',
    id: 'customer',
    cell: ({ row }) => (
      <div className="leading-tight">
        <div>{row.original.customerName ?? '—'}</div>
        <div className="text-xs text-muted-foreground">{row.original.customerPhone}</div>
      </div>
    ),
  },
  { header: 'Items', accessorKey: 'itemCount' },
  {
    header: 'Total',
    accessorKey: 'total',
    cell: ({ row }) => <span className="tabular-nums">{formatInr(row.original.total)}</span>,
  },
  {
    header: 'Payment',
    id: 'payment',
    cell: ({ row }) => (
      <div className="flex flex-col gap-1">
        <Badge variant="outline">{row.original.paymentMethod}</Badge>
        <span className="text-xs text-muted-foreground">{paymentLabel(row.original.status, row.original.paymentStatus)}</span>
      </div>
    ),
  },
  { header: 'Status', accessorKey: 'status', cell: ({ row }) => <StatusBadge status={row.original.status} /> },
  { header: 'Placed', accessorKey: 'placedAt', cell: ({ row }) => formatDateTime(row.original.placedAt) },
]

export default function OrdersPage() {
  usePageTitle('Orders')
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
        title="Orders"
        description="Updates every 10 seconds. New orders play a sound."
        actions={
          <Button variant="outline" size="sm" onClick={() => void refetch()} disabled={isFetching}>
            <RefreshCw className={isFetching ? 'animate-spin' : undefined} /> Refresh
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
            aria-label="Search order number or phone"
            placeholder="Order number or phone"
            className="w-full pl-8 sm:w-64"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onBlur={() => setParam('q', search.trim() || undefined)}
          />
        </form>
        <select
          aria-label="Status"
          className={`${selectClass} col-span-2 w-full sm:col-span-1 sm:w-auto`}
          value={status ?? ''}
          onChange={(e) => setParam('status', e.target.value || undefined)}
        >
          <option value="">All statuses</option>
          {ALL_STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </select>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground sm:flex-row sm:items-center sm:gap-2 sm:text-sm">
          From
          <Input type="date" className="w-full sm:w-40" value={from ?? ''} onChange={(e) => setParam('from', e.target.value || undefined)} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground sm:flex-row sm:items-center sm:gap-2 sm:text-sm">
          To
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
            Clear filters
          </Button>
        )}
      </div>

      {error ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : isLoading ? (
        <LoadingRows />
      ) : !data || data.content.length === 0 ? (
        <EmptyState message="No orders match these filters." />
      ) : (
        <>
        {/* Phones: one card per order */}
        <ul className="space-y-2 md:hidden" aria-label="Orders">
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
                    {o.customerName ?? 'Customer'} · {o.customerPhone}
                  </span>
                  <span className="font-semibold tabular-nums">{formatInr(o.total)}</span>
                </div>
                <div className="mt-1 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span>
                    {o.itemCount} items · {o.paymentMethod} · {paymentLabel(o.status, o.paymentStatus)}
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
