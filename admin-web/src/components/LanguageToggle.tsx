import { Languages } from 'lucide-react'
import { LANGUAGES, setLang, useLang, useT } from '@/i18n'
import { cn } from '@/lib/utils'

/** हिंदी | English switch. Hindi is the default; the choice is remembered in this browser. */
export function LanguageToggle({ className }: { className?: string }) {
  const lang = useLang()
  const t = useT()
  return (
    <div role="radiogroup" aria-label={t('layout.language')} className={cn('flex items-center gap-1.5', className)}>
      <Languages className="size-4 text-muted-foreground" aria-hidden />
      <div className="flex rounded-full border bg-background p-0.5">
        {LANGUAGES.map((l) => (
          <button
            key={l.code}
            type="button"
            role="radio"
            aria-checked={l.code === lang}
            onClick={() => setLang(l.code)}
            className={cn(
              'rounded-full px-2.5 py-1 text-xs font-medium transition-colors',
              l.code === lang ? 'bg-emerald-600 text-white' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {l.label}
          </button>
        ))}
      </div>
    </div>
  )
}
