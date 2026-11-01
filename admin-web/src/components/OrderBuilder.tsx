import { useEffect, useState } from 'react'
import { Loader2, Minus, PackagePlus, Plus, Search, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { localName, t as tNow, useLang, useT } from '@/i18n'
import { apiErrorMessage } from '@/lib/api'
import { formatInr } from '@/lib/format'
import { useAcceptRequest, useProducts, useRejectRequest, useStoreRules } from '@/lib/queries'
import { addCatalogLine, draftTotals, toAcceptBody, type DraftLine } from '@/lib/requestOrder'
import { Thumb } from './common'

function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), ms)
    return () => clearTimeout(timer)
  }, [value, ms])
  return debounced
}

/** Catalog search with one "Add" per size; out-of-stock and hidden sizes cannot be added. */
function CatalogSearch({ onAdd }: { onAdd: (line: Omit<DraftLine, 'key' | 'qty'>) => void }) {
  const t = useT()
  const lang = useLang()
  const [text, setText] = useState('')
  const q = useDebounced(text.trim(), 250)
  const products = useProducts({ q: q || undefined, active: true, page: 0 })
  const list = q.length >= 2 ? (products.data?.content ?? []).slice(0, 8) : []

  return (
    <div className="space-y-2">
      <Label htmlFor="builder-search">{t('builder.search')}</Label>
      <div className="relative">
        <Search className="pointer-events-none absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
        <Input
          id="builder-search"
          className="pl-8"
          placeholder={t('builder.searchPlaceholder')}
          value={text}
          onChange={(e) => setText(e.target.value)}
          autoComplete="off"
        />
        {products.isFetching && q.length >= 2 && <Loader2 className="absolute top-2.5 right-2.5 size-4 animate-spin text-muted-foreground" />}
      </div>
      {q.length >= 2 && !products.isFetching && list.length === 0 && (
        <p className="text-sm text-muted-foreground">{t('builder.noResults', { q })}</p>
      )}
      {list.length > 0 && (
        <ul className="max-h-72 divide-y overflow-y-auto rounded-md border">
          {list.flatMap((p) =>
            p.variants
              .filter((v) => v.active)
              .map((v) => {
                const name = localName(p, lang)
                return (
                  <li key={v.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                    <Thumb url={p.imageUrl} alt={name} className="size-9" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">
                        {name} <span className="text-muted-foreground">{v.label}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatInr(v.sellingPrice)} · {v.stockQty > 0 ? t('builder.inStock', { n: v.stockQty }) : t('builder.outOfStock')}
                      </div>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={v.stockQty === 0}
                      onClick={() => onAdd({ variantId: v.id, name, label: v.label, price: v.sellingPrice, stock: v.stockQty })}
                    >
                      <Plus /> {t('builder.add')}
                    </Button>
                  </li>
                )
              }),
          )}
        </ul>
      )}
    </div>
  )
}

/** Something the store sells that is not in the catalog, priced by hand (no stock tracking). */
function CustomItem({ onAdd }: { onAdd: (line: Omit<DraftLine, 'key'>) => void }) {
  const t = useT()
  const [name, setName] = useState('')
  const [label, setLabel] = useState('')
  const [price, setPrice] = useState('')
  const [qty, setQty] = useState('1')

  function add() {
    const p = Number(price)
    const n = Math.max(1, Math.min(99, Math.round(Number(qty) || 1)))
    if (!name.trim() || !(p > 0)) {
      toast.error(tNow('builder.customInvalid'))
      return
    }
    onAdd({ variantId: null, name: name.trim(), label: label.trim(), price: Math.round(p * 100) / 100, qty: n, stock: null })
    setName('')
    setLabel('')
    setPrice('')
    setQty('1')
  }

  return (
    <fieldset className="space-y-2 rounded-md border border-dashed p-3">
      <legend className="px-1 text-sm font-medium">{t('builder.custom')}</legend>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-[2fr_1fr_1fr_0.8fr]">
        <div className="col-span-2 space-y-1 sm:col-span-1">
          <Label htmlFor="custom-name" className="text-xs">{t('builder.customName')}</Label>
          <Input id="custom-name" value={name} onChange={(e) => setName(e.target.value)} placeholder={t('builder.customNamePlaceholder')} maxLength={160} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="custom-label" className="text-xs">{t('builder.customLabel')}</Label>
          <Input id="custom-label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder={t('builder.customLabelPlaceholder')} maxLength={40} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="custom-price" className="text-xs">{t('builder.customPrice')}</Label>
          <Input id="custom-price" type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="custom-qty" className="text-xs">{t('builder.customQty')}</Label>
          <Input id="custom-qty" type="number" min="1" max="99" value={qty} onChange={(e) => setQty(e.target.value)} />
        </div>
      </div>
      <Button type="button" size="sm" variant="secondary" onClick={add}>
        <PackagePlus /> {t('builder.addCustom')}
      </Button>
    </fieldset>
  )
}

/** Build the order from a list request, then accept it (creates an ACCEPTED order) or decline it with a reason. */
export function OrderBuilder({ requestId }: { requestId: number }) {
  const t = useT()
  const rules = useStoreRules()
  const accept = useAcceptRequest()
  const reject = useRejectRequest()
  const [lines, setLines] = useState<DraftLine[]>([])
  const [note, setNote] = useState('')
  const [rejectOpen, setRejectOpen] = useState(false)
  const [reason, setReason] = useState('')
  const totals = draftTotals(lines, rules.data)
  const busy = accept.isPending || reject.isPending

  function setQty(key: string, qty: number) {
    setLines((current) =>
      current.map((l) => {
        if (l.key !== key) return l
        const max = l.variantId != null ? Math.min(50, l.stock ?? 50) : 99
        return { ...l, qty: Math.max(1, Math.min(max, Math.round(qty) || 1)) }
      }),
    )
  }

  function submit() {
    accept.mutate(
      { id: requestId, body: toAcceptBody(lines, note) },
      {
        onSuccess: (r) => toast.success(tNow('builder.accepted', { number: r.orderNumber ?? '' })),
        onError: (e) => toast.error(apiErrorMessage(e)),
      },
    )
  }

  return (
    <section className="space-y-4">
      <div>
        <h3 className="font-semibold">{t('builder.title')}</h3>
        <p className="text-sm text-muted-foreground">{t('builder.hint')}</p>
      </div>

      <CatalogSearch onAdd={(line) => setLines((current) => addCatalogLine(current, line))} />
      <CustomItem onAdd={(line) => setLines((current) => [...current, { ...line, key: `c${Date.now()}` }])} />

      <div>
        <h4 className="mb-2 text-sm font-semibold">{t('builder.lines')}</h4>
        {lines.length === 0 ? (
          <p className="rounded-md bg-muted p-3 text-sm text-muted-foreground">{t('builder.empty')}</p>
        ) : (
          <ul className="divide-y rounded-md border">
            {lines.map((l) => (
              <li key={l.key} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">
                    {l.name} {l.label && <span className="text-muted-foreground">{l.label}</span>}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {formatInr(l.price)}
                    {l.variantId == null && ` · ${t('builder.free')}`}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button type="button" size="icon" variant="outline" className="size-7" onClick={() => setQty(l.key, l.qty - 1)} aria-label="−">
                    <Minus />
                  </Button>
                  <Input
                    aria-label={t('builder.qtyA11y', { name: l.name })}
                    type="number"
                    className="h-7 w-14 text-center"
                    value={l.qty}
                    onChange={(e) => setQty(l.key, Number(e.target.value))}
                  />
                  <Button type="button" size="icon" variant="outline" className="size-7" onClick={() => setQty(l.key, l.qty + 1)} aria-label="+">
                    <Plus />
                  </Button>
                </div>
                <span className="w-20 text-right font-medium tabular-nums">{formatInr(l.price * l.qty)}</span>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="size-7"
                  aria-label={t('builder.removeA11y', { name: l.name })}
                  onClick={() => setLines((current) => current.filter((x) => x.key !== l.key))}
                >
                  <Trash2 />
                </Button>
              </li>
            ))}
          </ul>
        )}
        <dl className="mt-3 space-y-1 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">{t('builder.subtotal')}</dt>
            <dd className="tabular-nums">{formatInr(totals.subtotal)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">{t('builder.deliveryFee')}</dt>
            <dd className="tabular-nums">{lines.length > 0 && totals.fee === 0 ? t('common.free') : formatInr(totals.fee)}</dd>
          </div>
          <div className="flex justify-between text-base font-semibold">
            <dt>{t('builder.total')}</dt>
            <dd className="tabular-nums">{formatInr(totals.total)}</dd>
          </div>
        </dl>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="builder-note">{t('builder.noteLabel')}</Label>
        <Textarea id="builder-note" rows={2} maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('builder.notePlaceholder')} />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" disabled={lines.length === 0 || busy} onClick={submit}>
          {accept.isPending && <Loader2 className="animate-spin" />}
          {t('builder.accept')}
        </Button>
        <Button type="button" variant="outline" className="text-destructive" disabled={busy} onClick={() => setRejectOpen(true)}>
          {t('builder.reject')}
        </Button>
      </div>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('builder.rejectTitle')}</DialogTitle>
            <DialogDescription>{t('builder.rejectBody')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="reject-reason">{t('builder.rejectReason')}</Label>
            <Textarea id="reject-reason" rows={3} maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t('builder.rejectPlaceholder')} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>
              {t('common.keep')}
            </Button>
            <Button
              variant="destructive"
              disabled={!reason.trim() || reject.isPending}
              onClick={() =>
                reject.mutate(
                  { id: requestId, body: { reason: reason.trim() } },
                  {
                    onSuccess: () => {
                      setRejectOpen(false)
                      toast.success(tNow('builder.rejected'))
                    },
                    onError: (e) => toast.error(apiErrorMessage(e)),
                  },
                )
              }
            >
              {t('builder.rejectConfirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}
