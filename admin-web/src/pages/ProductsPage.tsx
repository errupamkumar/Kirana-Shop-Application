import { useMemo, useState } from 'react'
import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from '@tanstack/react-table'
import { Pencil, Plus, Search } from 'lucide-react'
import { useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { EmptyState, ErrorState, LoadingRows, PageHeader, Pagination, Thumb, selectClass } from '@/components/common'
import { ProductFormDialog } from '@/components/ProductFormDialog'
import { apiErrorMessage } from '@/lib/api'
import { formatInr } from '@/lib/format'
import { useCategories, usePatchVariant, useProducts, useToggleProduct } from '@/lib/queries'
import type { Product, Variant } from '@/lib/types'
import { usePageTitle } from '@/lib/usePageTitle'

/** Stock cell: edit inline, saves on Enter or blur. */
function StockInput({ variant }: { variant: Variant }) {
  const patch = usePatchVariant()
  const [value, setValue] = useState(String(variant.stockQty))
  const [synced, setSynced] = useState(variant.stockQty)
  if (variant.stockQty !== synced) {
    // Server value changed (refetch or another edit): show it
    setSynced(variant.stockQty)
    setValue(String(variant.stockQty))
  }

  function commit() {
    const qty = Number(value)
    if (!Number.isInteger(qty) || qty < 0) {
      toast.error('Stock must be a whole number, 0 or more')
      setValue(String(variant.stockQty))
      return
    }
    if (qty === variant.stockQty) return
    patch.mutate(
      { id: variant.id, patch: { stockQty: qty } },
      { onError: (e) => toast.error(apiErrorMessage(e)), onSuccess: () => toast.success(`Stock updated: ${variant.sku}`) },
    )
  }

  return (
    <Input
      aria-label={`Stock for ${variant.sku}`}
      type="number"
      min="0"
      className={`h-8 w-20 ${variant.stockQty === 0 ? 'border-destructive text-destructive' : ''}`}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
    />
  )
}

function VariantRows({ product }: { product: Product }) {
  const patch = usePatchVariant()
  return (
    <ul className="space-y-1.5">
      {product.variants.map((v) => (
        <li key={v.id} className="flex flex-wrap items-center gap-2 text-sm">
          <span className="w-20 font-medium">{v.label}</span>
          <span className="w-28 tabular-nums">
            {formatInr(v.sellingPrice)}
            {v.mrp > v.sellingPrice && <span className="ml-1 text-xs text-muted-foreground line-through">{formatInr(v.mrp)}</span>}
          </span>
          <StockInput variant={v} />
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            disabled={v.stockQty === 0}
            onClick={() => patch.mutate({ id: v.id, patch: { stockQty: 0 } }, { onError: (e) => toast.error(apiErrorMessage(e)) })}
          >
            Out of stock
          </Button>
          <Switch
            aria-label={`${v.sku} active`}
            checked={v.active}
            onCheckedChange={(active) => patch.mutate({ id: v.id, patch: { active } }, { onError: (e) => toast.error(apiErrorMessage(e)) })}
          />
        </li>
      ))}
    </ul>
  )
}

export default function ProductsPage() {
  usePageTitle('Products')
  const [params, setParams] = useSearchParams()
  const [search, setSearch] = useState(params.get('q') ?? '')
  const [editing, setEditing] = useState<Product | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const q = params.get('q') ?? undefined
  const categoryId = params.get('categoryId') ? Number(params.get('categoryId')) : undefined
  const activeParam = params.get('active')
  const active = activeParam === null ? undefined : activeParam === 'true'
  const page = Number(params.get('page') ?? 0)

  const filters = useMemo(() => ({ q, categoryId, active, page }), [q, categoryId, active, page])
  const { data, isLoading, error, refetch } = useProducts(filters)
  const categories = useCategories()
  const toggle = useToggleProduct()

  function setParam(key: string, value: string | undefined) {
    setParams((prev) => {
      const next = new URLSearchParams(prev)
      if (value) next.set(key, value)
      else next.delete(key)
      if (key !== 'page') next.delete('page')
      return next
    })
  }

  const columns = useMemo<ColumnDef<Product>[]>(
    () => [
      {
        header: 'Product',
        id: 'product',
        cell: ({ row }) => (
          <div className="flex items-center gap-3">
            <Thumb url={row.original.imageUrl} alt={row.original.name} />
            <div className="leading-tight">
              <div className="font-medium">{row.original.name}</div>
              <div className="text-xs text-muted-foreground">
                {row.original.brand ?? 'No brand'} · {row.original.categoryName}
              </div>
            </div>
          </div>
        ),
      },
      { header: 'Variants: price · stock · active', id: 'variants', cell: ({ row }) => <VariantRows product={row.original} /> },
      {
        header: 'Visible',
        id: 'active',
        cell: ({ row }) => (
          <Switch
            aria-label={`${row.original.name} visible`}
            checked={row.original.active}
            onCheckedChange={(value) =>
              toggle.mutate({ id: row.original.id, active: value }, { onError: (e) => toast.error(apiErrorMessage(e)) })
            }
          />
        ),
      },
      {
        header: '',
        id: 'edit',
        cell: ({ row }) => (
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Edit ${row.original.name}`}
            onClick={() => {
              setEditing(row.original)
              setDialogOpen(true)
            }}
          >
            <Pencil />
          </Button>
        ),
      },
    ],
    [toggle],
  )

  const table = useReactTable({ data: data?.content ?? [], columns, getCoreRowModel: getCoreRowModel() })

  return (
    <>
      <PageHeader
        title="Products"
        description="Edit stock inline; switches save immediately."
        actions={
          <Button
            onClick={() => {
              setEditing(null)
              setDialogOpen(true)
            }}
          >
            <Plus /> New product
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
            aria-label="Search products"
            placeholder="Search name or brand"
            className="w-full pl-8 sm:w-64"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onBlur={() => setParam('q', search.trim() || undefined)}
          />
        </form>
        <select
          aria-label="Category"
          className={`${selectClass} w-full sm:w-auto`}
          value={categoryId ?? ''}
          onChange={(e) => setParam('categoryId', e.target.value || undefined)}
        >
          <option value="">All categories</option>
          {categories.data?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select aria-label="Visibility" className={`${selectClass} w-full sm:w-auto`} value={activeParam ?? ''} onChange={(e) => setParam('active', e.target.value || undefined)}>
          <option value="">Visible and hidden</option>
          <option value="true">Visible only</option>
          <option value="false">Hidden only</option>
        </select>
      </div>

      {error ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : isLoading ? (
        <LoadingRows />
      ) : !data || data.content.length === 0 ? (
        <EmptyState message="No products found." />
      ) : (
        <>
        {/* Phones: one card per product with the same inline controls */}
        <ul className="space-y-3 md:hidden" aria-label="Products">
          {data.content.map((p) => (
            <li key={p.id} className={`rounded-lg border bg-background p-3 ${p.active ? '' : 'opacity-60'}`}>
              <div className="flex items-start gap-3">
                <Thumb url={p.imageUrl} alt={p.name} className="size-12" />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{p.name}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {p.brand ?? 'No brand'} · {p.categoryName}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Switch
                    aria-label={`${p.name} visible`}
                    checked={p.active}
                    onCheckedChange={(value) => toggle.mutate({ id: p.id, active: value }, { onError: (e) => toast.error(apiErrorMessage(e)) })}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Edit ${p.name}`}
                    onClick={() => {
                      setEditing(p)
                      setDialogOpen(true)
                    }}
                  >
                    <Pencil />
                  </Button>
                </div>
              </div>
              <div className="mt-3 border-t pt-3">
                <VariantRows product={p} />
              </div>
            </li>
          ))}
        </ul>
        <div className="hidden overflow-x-auto rounded-lg border bg-background md:block">
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
                <TableRow key={row.id} className={row.original.active ? undefined : 'opacity-60'}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="align-top">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        </>
      )}
      {data && <Pagination page={data.page} totalPages={data.totalPages} onPage={(p) => setParam('page', String(p))} />}

      <ProductFormDialog open={dialogOpen} product={editing} onClose={() => setDialogOpen(false)} />
    </>
  )
}
