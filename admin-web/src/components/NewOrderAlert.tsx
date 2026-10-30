import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { formatInr } from '@/lib/format'
import { useNewOrdersFeed } from '@/lib/queries'

/** Short two-tone chime with Web Audio (no asset). Browsers may block it until the page was clicked once. */
function chime() {
  try {
    const ctx = new AudioContext()
    ;[880, 1320].forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + i * 0.18)
      gain.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + i * 0.18 + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + i * 0.18 + 0.3)
      osc.connect(gain).connect(ctx.destination)
      osc.start(ctx.currentTime + i * 0.18)
      osc.stop(ctx.currentTime + i * 0.18 + 0.32)
    })
    setTimeout(() => void ctx.close(), 1000)
  } catch {
    // audio not available
  }
}

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
        toast.success(`New order ${o.orderNumber}`, {
          description: `${o.itemCount} items · ${formatInr(o.total)} · ${o.paymentMethod}`,
          action: { label: 'Open', onClick: () => navigate(`/orders?open=${o.id}`) },
          duration: 15_000,
        }),
      )
    }
  }, [data, navigate])

  return null
}
