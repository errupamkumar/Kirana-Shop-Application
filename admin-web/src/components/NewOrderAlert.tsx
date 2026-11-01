import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { t } from '@/i18n'
import { chime } from '@/lib/chime'
import { formatInr } from '@/lib/format'
import { useNewOrdersFeed } from '@/lib/queries'

/** Polls PLACED orders every 10 s; plays a sound and toasts for orders not seen before. */
export function NewOrderAlert() {
  const navigate = useNavigate()
  const { data } = useNewOrdersFeed(true)
  const seen = useRef<Set<number> | null>(null)

  useEffect(() => {
    if (!data) return
    const ids = data.content.map((o) => o.id)
    if (seen.current === null) {
      // First load: remember what is already there, alert only for later arrivals
      seen.current = new Set(ids)
      return
    }
    const fresh = data.content.filter((o) => !seen.current!.has(o.id))
    fresh.forEach((o) => seen.current!.add(o.id))
    if (fresh.length > 0) {
      chime()
      fresh.forEach((o) =>
        toast.success(t('orders.newOrder', { number: o.orderNumber }), {
          description: t('orders.newOrderBody', { n: o.itemCount, total: formatInr(o.total), method: o.paymentMethod }),
          action: { label: t('orders.open'), onClick: () => navigate(`/orders?open=${o.id}`) },
          duration: 15_000,
        }),
      )
    }
  }, [data, navigate])

  return null
}
