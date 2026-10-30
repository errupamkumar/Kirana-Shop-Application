import { useEffect } from 'react'

/** Sets the browser tab title, e.g. "Orders · Kirana Admin", so open tabs and history are easy to tell apart. */
export function usePageTitle(title: string) {
  useEffect(() => {
    document.title = `${title} · Kirana Admin`
  }, [title])
}
