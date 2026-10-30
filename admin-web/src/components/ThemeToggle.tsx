import { Monitor, Moon, Sun } from 'lucide-react'
import { useTheme } from '@/lib/theme'
import { Button } from '@/components/ui/button'

const NEXT = { light: 'dark', dark: 'system', system: 'light' } as const
const LABEL = { light: 'Light theme', dark: 'Dark theme', system: 'System theme' } as const

/** Cycles light → dark → follow the system. */
export function ThemeToggle() {
  const { theme = 'system', setTheme } = useTheme()
  const current = (theme in NEXT ? theme : 'system') as keyof typeof NEXT
  const Icon = current === 'light' ? Sun : current === 'dark' ? Moon : Monitor
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={`${LABEL[current]} (click to change)`}
      title={`${LABEL[current]} (click to change)`}
      onClick={() => setTheme(NEXT[current])}
    >
      <Icon />
    </Button>
  )
}
