import { useEffect, useState } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { isRouteErrorResponse, useRouteError } from 'react-router'
import { Button } from '@/components/ui/button'

const RELOAD_KEY = 'kirana.admin.chunkReloadAt'

/** Browsers word a failed lazy-page download differently; all mean "this page's code could not be fetched". */
function isChunkLoadError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '')
  return /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i.test(
    message,
  )
}

/**
 * Route error screen. A page whose code can no longer be fetched (the dev server restarted, or a new version
 * was deployed while the tab was open) reloads once automatically; anything else shows a friendly message.
 */
/** At most one automatic reload per 10 s, so an unreachable server cannot cause a reload loop. */
function mayAutoReload(): boolean {
  try {
    return Date.now() - Number(sessionStorage.getItem(RELOAD_KEY) ?? 0) > 10_000
  } catch {
    return false
  }
}

export function RouteError() {
  const error = useRouteError()
  const chunkError = isChunkLoadError(error)
  const [reloading] = useState(() => chunkError && mayAutoReload())

  useEffect(() => {
    if (!reloading) return
    try {
      sessionStorage.setItem(RELOAD_KEY, String(Date.now()))
    } catch {
      // ignore
    }
    window.location.reload()
  }, [reloading])

  if (reloading) return null

  const message = chunkError
    ? 'This page could not be loaded. The admin server may have restarted or moved. Check that it is running and that you are on the right address (normally http://localhost:5173).'
    : isRouteErrorResponse(error)
      ? `${error.status} ${error.statusText}`
      : error instanceof Error
        ? error.message
        : 'Something went wrong.'

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <div role="alert" className="max-w-md rounded-lg border bg-background p-8 text-center shadow-sm">
        <AlertTriangle className="mx-auto size-8 text-destructive" />
        <h1 className="mt-4 text-lg font-semibold">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted-foreground">{message}</p>
        <div className="mt-6 flex justify-center gap-2">
          <Button onClick={() => window.location.reload()}>
            <RefreshCw /> Reload
          </Button>
          <Button variant="outline" onClick={() => window.location.assign('/')}>
            Go to dashboard
          </Button>
        </div>
      </div>
    </main>
  )
}
