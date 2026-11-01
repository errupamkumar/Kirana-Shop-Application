import { AlertTriangle, Clock, IndianRupee, NotebookPen, ShoppingBag } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Link } from 'react-router'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState, ErrorState, PageHeader, StatusBadge } from '@/components/common'
import { dateLocale, getLang, useT } from '@/i18n'
import { formatInr } from '@/lib/format'
import { ALL_STATUSES } from '@/lib/orderStatus'
import { useDashboard } from '@/lib/queries'
import type { Dashboard } from '@/lib/types'
import { usePageTitle } from '@/lib/usePageTitle'

// Single-series charts: categorical slot 1 of the reference palette; text stays in ink tokens.
// CSS variables (index.css) so light and dark themes each get their validated step
const SERIES = 'var(--series-1)'
const GRID = 'var(--chart-grid)'
const AXIS_TEXT = 'var(--muted-foreground)'

function Kpi({ label, value, icon: Icon, hint }: { label: string; value: string; icon: typeof ShoppingBag; hint?: string }) {
  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
          {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
        </div>
        <Icon className="size-5 text-muted-foreground" />
      </CardContent>
    </Card>
  )
}

const dayLabel = (iso: string) =>
  new Intl.DateTimeFormat(dateLocale(getLang()), { weekday: 'short', day: 'numeric' }).format(new Date(`${iso}T00:00:00`))

function DayChart({ data, dataKey, title, format }: {
  data: Dashboard['last7Days']
  dataKey: 'orders' | 'revenue'
  title: string
  format: (n: number) => string
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke={GRID} strokeWidth={1} />
            <XAxis dataKey="date" tickFormatter={dayLabel} tick={{ fill: AXIS_TEXT, fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis
              allowDecimals={dataKey === 'revenue'}
              tickFormatter={(n: number) => (dataKey === 'revenue' ? `₹${n >= 1000 ? `${Math.round(n / 1000)}k` : n}` : String(n))}
              tick={{ fill: AXIS_TEXT, fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              width={44}
            />
            <Tooltip
              cursor={{ fill: 'var(--muted)', opacity: 0.5 }}
              contentStyle={{ background: 'var(--popover)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--popover-foreground)' }}
              labelStyle={{ color: 'var(--popover-foreground)', fontWeight: 600 }}
              labelFormatter={(label) => dayLabel(String(label))}
              formatter={(value) => [format(Number(value)), title]}
            />
            <Bar dataKey={dataKey} fill={SERIES} maxBarSize={24} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

export default function DashboardPage() {
  const t = useT()
  usePageTitle(t('dashboard.title'))
  const { data, isLoading, error, refetch } = useDashboard()

  return (
    <>
      <PageHeader title={t('dashboard.title')} description={t('dashboard.description')} />
      {error ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : isLoading || !data ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <Kpi label={t('dashboard.todayOrders')} value={String(data.todayOrders)} icon={ShoppingBag} />
            <Kpi label={t('dashboard.todayRevenue')} value={formatInr(data.todayRevenue)} icon={IndianRupee} hint={t('dashboard.deliveredOrders')} />
            <Link to="/orders" className="rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <Kpi label={t('dashboard.toFulfil')} value={String(data.pendingOrders)} icon={Clock} hint={t('dashboard.toFulfilHint')} />
            </Link>
            <Link to="/requests" className="rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <Kpi label={t('dashboard.requestsWaiting')} value={String(data.pendingRequests)} icon={NotebookPen} hint={t('dashboard.requestsHint')} />
            </Link>
            <Kpi label={t('dashboard.lowStockVariants')} value={String(data.lowStockCount)} icon={AlertTriangle} hint={t('dashboard.stockAtMost', { n: data.lowStockThreshold })} />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('dashboard.byStatus')}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3">
              {ALL_STATUSES.map((status) => (
                <Link
                  key={status}
                  to={`/orders?status=${status}`}
                  className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-muted"
                >
                  <StatusBadge status={status} />
                  <span className="font-semibold tabular-nums">{data.countsByStatus[status] ?? 0}</span>
                </Link>
              ))}
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <DayChart data={data.last7Days} dataKey="orders" title={t('dashboard.ordersChart')} format={(n) => t('dashboard.ordersTooltip', { n })} />
            <DayChart data={data.last7Days} dataKey="revenue" title={t('dashboard.revenueChart')} format={formatInr} />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('dashboard.lowStock')}</CardTitle>
            </CardHeader>
            <CardContent>
              {data.lowStock.length === 0 ? (
                <EmptyState message={t('dashboard.allStocked')} />
              ) : (
                <ul className="divide-y">
                  {data.lowStock.map((item) => (
                    <li key={item.variantId} className="flex items-center justify-between gap-3 py-2 text-sm">
                      <span>
                        <Link to={`/products?q=${encodeURIComponent(item.productName)}`} className="font-medium hover:underline">
                          {item.productName}
                        </Link>{' '}
                        <span className="text-muted-foreground">
                          {item.variantLabel} · {item.sku}
                        </span>
                      </span>
                      <span className={item.stockQty === 0 ? 'font-semibold text-destructive' : 'font-semibold'}>
                        {item.stockQty === 0 ? t('dashboard.outOfStock') : t('dashboard.left', { n: item.stockQty })}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </>
  )
}
