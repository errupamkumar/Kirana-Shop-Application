import { Monitor, Moon, Sun } from 'lucide-react'
import { useTheme } from '@/lib/theme'
import { Button } from '@/components/ui/button'
import { useT } from '@/i18n'

const NEXT = { light: 'dark', dark: 'system', system: 'light' } as const
const LABEL = { light: 'theme.light', dark: 'theme.dark', system: 'theme.system' } as const

/** Cycles light → dark → follow the system. */
export function ThemeToggle() {
  const { theme = 'system', setTheme } = useTheme()
  const t = useT()
  const current = (theme in NEXT ? theme : 'system') as keyof typeof NEXT
  const Icon = current === 'light' ? Sun : current === 'dark' ? Moon : Monitor
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={t('theme.click', { theme: t(LABEL[current]) })}
      title={t('theme.click', { theme: t(LABEL[current]) })}
      onClick={() => setTheme(NEXT[current])}
    >
      <Icon />
    </Button>
  )
}
