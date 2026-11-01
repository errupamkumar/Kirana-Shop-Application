import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useT } from '@/i18n'
import { actionLabel, nextStatuses } from '@/lib/orderStatus'
import type { OrderStatus } from '@/lib/types'

/**
 * Only the transitions the state machine allows for the current status. Cancelling asks for a reason.
 */
export function StatusActions({
  status,
  busy,
  onChange,
}: {
  status: OrderStatus
  busy?: boolean
  onChange: (status: OrderStatus, note?: string) => void
}) {
  const [cancelOpen, setCancelOpen] = useState(false)
  const [reason, setReason] = useState('')
  const t = useT()
  const next = nextStatuses(status)

  if (next.length === 0) {
    return <p className="text-sm text-muted-foreground">{t('statusActions.closed')}</p>
  }

  return (
    <div className="flex flex-wrap gap-2">
      {next
        .filter((s) => s !== 'CANCELLED')
        .map((s) => (
          <Button key={s} disabled={busy} onClick={() => onChange(s)}>
            {busy && <Loader2 className="animate-spin" />}
            {actionLabel(s)}
          </Button>
        ))}
      {next.includes('CANCELLED') && (
        <Button variant="outline" className="text-destructive" disabled={busy} onClick={() => setCancelOpen(true)}>
          {actionLabel('CANCELLED')}
        </Button>
      )}

      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('statusActions.cancelTitle')}</DialogTitle>
            <DialogDescription>{t('statusActions.cancelBody')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="cancel-reason">{t('statusActions.reason')}</Label>
            <Textarea
              id="cancel-reason"
              value={reason}
              maxLength={300}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t('statusActions.reasonPlaceholder')}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelOpen(false)}>
              {t('statusActions.keep')}
            </Button>
            <Button
              variant="destructive"
              disabled={!reason.trim() || busy}
              onClick={() => {
                onChange('CANCELLED', reason.trim())
                setCancelOpen(false)
                setReason('')
              }}
            >
              {actionLabel('CANCELLED')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
