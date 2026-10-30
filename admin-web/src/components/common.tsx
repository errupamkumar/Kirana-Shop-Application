import { useRef, useState, type ReactNode } from 'react'
import { AlertTriangle, ImageIcon, Inbox, Loader2, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { apiErrorMessage } from '@/lib/api'
import { mediaUrl } from '@/lib/env'
import { STATUS_CLASS, STATUS_LABEL } from '@/lib/orderStatus'
import { uploadImage } from '@/lib/queries'
import type { OrderStatus } from '@/lib/types'
import { cn } from '@/lib/utils'

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

export function StatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span className={cn('inline-flex rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap', STATUS_CLASS[status])}>
      {STATUS_LABEL[status]}
    </span>
  )
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center gap-3 rounded-lg border border-dashed p-10 text-center">
      <AlertTriangle className="size-6 text-destructive" />
      <p className="text-sm text-muted-foreground">{apiErrorMessage(error, 'Could not load data')}</p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  )
}

export function EmptyState({ message, action }: { message: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed p-10 text-center">
      <Inbox className="size-6 text-muted-foreground" />
      <p className="text-sm text-muted-foreground">{message}</p>
      {action}
    </div>
  )
}

export function LoadingRows({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  )
}

export function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
  className,
}: {
  label: string
  htmlFor: string
  error?: string
  hint?: string
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : (
        hint && <p className="text-xs text-muted-foreground">{hint}</p>
      )}
    </div>
  )
}

export function Thumb({ url, alt, className }: { url: string | null | undefined; alt: string; className?: string }) {
  const src = mediaUrl(url)
  return src ? (
    <img src={src} alt={alt} className={cn('size-10 rounded-md border object-cover', className)} />
  ) : (
    <div className={cn('flex size-10 items-center justify-center rounded-md border bg-muted', className)}>
      <ImageIcon className="size-4 text-muted-foreground" />
    </div>
  )
}

/** Uploads one jpg/png/webp (max 2 MB) and reports the stored URL. */
export function ImageUpload({ value, onChange }: { value: string; onChange: (url: string) => void }) {
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)

  async function handle(file: File | undefined) {
    if (!file) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      toast.error('Use a JPG, PNG or WebP image')
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image must be at most 2 MB')
      return
    }
    setBusy(true)
    try {
      onChange(await uploadImage(file))
      toast.success('Image uploaded')
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Upload failed'))
    } finally {
      setBusy(false)
      if (input.current) input.current.value = ''
    }
  }

  return (
    <div className="flex items-center gap-3">
      <Thumb url={value} alt="Preview" className="size-14" />
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => void handle(e.target.files?.[0])}
      />
      <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => input.current?.click()}>
        {busy ? <Loader2 className="animate-spin" /> : <Upload />}
        {value ? 'Replace image' : 'Upload image'}
      </Button>
      {value && (
        <Button type="button" variant="ghost" size="sm" onClick={() => onChange('')}>
          Remove
        </Button>
      )}
    </div>
  )
}

export function Pagination({ page, totalPages, onPage }: { page: number; totalPages: number; onPage: (page: number) => void }) {
  if (totalPages <= 1) return null
  return (
    <div className="mt-4 flex items-center justify-end gap-2 text-sm">
      <Button variant="outline" size="sm" disabled={page === 0} onClick={() => onPage(page - 1)}>
        Previous
      </Button>
      <span className="text-muted-foreground">
        Page {page + 1} of {totalPages}
      </span>
      <Button variant="outline" size="sm" disabled={page + 1 >= totalPages} onClick={() => onPage(page + 1)}>
        Next
      </Button>
    </div>
  )
}

export const selectClass =
  'h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50'
