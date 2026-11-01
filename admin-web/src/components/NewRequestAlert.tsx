import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { t } from '@/i18n'
import { usePendingRequestsFeed } from '@/lib/queries'
import { chime } from '@/lib/chime'

/** Plays the chime and shows a pop-up for list photos / voice notes that arrive while the admin is open. */
export function NewRequestAlert() {
  const navigate = useNavigate()
  const { data } = usePendingRequestsFeed()
  const seen = useRef<Set<number> | null>(null)

  useEffect(() => {
    if (!data) return
    const ids = data.content.map((r) => r.id)
    if (seen.current === null) {
      // First load: remember what is already waiting, alert only for later arrivals
      seen.current = new Set(ids)
      return
    }
    const fresh = data.content.filter((r) => !seen.current!.has(r.id))
    fresh.forEach((r) => seen.current!.add(r.id))
    if (fresh.length > 0) {
      chime()
      fresh.forEach((r) => {
        const what = [r.imageUrl ? t('requests.photo') : null, r.audioUrl ? t('requests.voice') : null].filter(Boolean).join(' + ')
        toast.info(t('requests.new', { id: r.id }), {
          description: t('requests.newBody', { customer: r.customerName ?? r.customerPhone, what }),
          action: { label: t('requests.open'), onClick: () => navigate(`/requests?open=${r.id}`) },
          duration: 15_000,
        })
      })
    }
  }, [data, navigate])

  return null
}
