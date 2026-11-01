import { Printer } from 'lucide-react'
import { useParams } from 'react-router'
import { Button } from '@/components/ui/button'
import { ErrorState, LoadingRows } from '@/components/common'
import { formatDateTime, formatInr } from '@/lib/format'
import { localName, useLang, useT } from '@/i18n'
import { paymentLabel } from '@/lib/orderStatus'
import { useInvoice } from '@/lib/queries'
import { usePageTitle } from '@/lib/usePageTitle'

/** Printable invoice; the toolbar is hidden when printing (print: utilities). */
export default function InvoicePage() {
  const t = useT()
  const lang = useLang()
  usePageTitle(t('invoice.title'))
  const id = Number(useParams().id)
  const { data, isLoading, error, refetch } = useInvoice(id)

  if (error) return <div className="p-8"><ErrorState error={error} onRetry={() => void refetch()} /></div>
  if (isLoading || !data) return <div className="p-8"><LoadingRows /></div>
  const { store, order } = data

  return (
    <div className="min-h-screen bg-muted/40 py-8 print:bg-white print:py-0">
      <div className="mx-auto mb-4 flex max-w-2xl justify-end print:hidden">
        <Button onClick={() => window.print()}>
          <Printer /> {t('invoice.print')}
        </Button>
      </div>
      <article className="mx-auto max-w-2xl bg-white p-8 text-sm text-neutral-900 shadow print:max-w-none print:p-0 print:shadow-none">
        <header className="flex justify-between gap-6 border-b pb-4">
          <div>
            <h1 className="text-xl font-bold">{store.name}</h1>
            <p className="text-neutral-600">{store.address}</p>
            <p className="text-neutral-600">{t('invoice.phone', { phone: store.phone })}</p>
            {store.gstin && <p className="text-neutral-600">{t('invoice.gstin', { gstin: store.gstin })}</p>}
          </div>
          <div className="text-right">
            <h2 className="text-lg font-semibold">{t('invoice.title')}</h2>
            <p>{order.orderNumber}</p>
            <p className="text-neutral-600">{formatDateTime(order.placedAt)}</p>
          </div>
        </header>

        <section className="grid grid-cols-2 gap-6 border-b py-4">
          <div>
            <h3 className="font-semibold">{t('invoice.billTo')}</h3>
            <p>{order.address.name ?? t('common.customer')}</p>
            <p>{order.address.phone}</p>
            <p>
              {order.address.line1}
              {order.address.line2 && `, ${order.address.line2}`}
            </p>
            {order.address.landmark && <p>{t('drawer.near', { landmark: order.address.landmark })}</p>}
            <p>{t('invoice.pin', { pincode: order.address.pincode })}</p>
          </div>
          <div className="text-right">
            <h3 className="font-semibold">{t('invoice.payment')}</h3>
            <p>{order.paymentMethod === 'COD' ? t('invoice.cod') : t('invoice.online')}</p>
            <p>{paymentLabel(order.status, order.paymentStatus)}</p>
          </div>
        </section>

        <table className="mt-4 w-full">
          <thead>
            <tr className="border-b text-left">
              <th className="py-2">{t('invoice.item')}</th>
              <th className="py-2 text-right">{t('invoice.mrp')}</th>
              <th className="py-2 text-right">{t('invoice.price')}</th>
              <th className="py-2 text-right">{t('invoice.qty')}</th>
              <th className="py-2 text-right">{t('invoice.amount')}</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((item, i) => (
              <tr key={i} className="border-b">
                <td className="py-2">
                  {localName({ name: item.productName, nameHi: item.productNameHi }, lang)}
                  {item.variantLabel ? ` (${item.variantLabel})` : ''}
                </td>
                <td className="py-2 text-right tabular-nums">{formatInr(item.mrp)}</td>
                <td className="py-2 text-right tabular-nums">{formatInr(item.sellingPrice)}</td>
                <td className="py-2 text-right">{item.qty}</td>
                <td className="py-2 text-right tabular-nums">{formatInr(item.lineTotal)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={4} className="pt-3 text-right">{t('drawer.subtotal')}</td>
              <td className="pt-3 text-right tabular-nums">{formatInr(order.itemSubtotal)}</td>
            </tr>
            <tr>
              <td colSpan={4} className="text-right">{t('drawer.deliveryFee')}</td>
              <td className="text-right tabular-nums">{order.deliveryFee === 0 ? t('common.free') : formatInr(order.deliveryFee)}</td>
            </tr>
            <tr className="text-base font-bold">
              <td colSpan={4} className="pt-2 text-right">{t('drawer.total')}</td>
              <td className="pt-2 text-right tabular-nums">{formatInr(order.total)}</td>
            </tr>
          </tfoot>
        </table>
        <p className="mt-8 text-center text-xs text-neutral-500">{t('invoice.thanks', { store: store.name })}</p>
      </article>
    </div>
  )
}
