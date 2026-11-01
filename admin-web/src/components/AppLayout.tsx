import { useState } from 'react'
import { LayoutDashboard, LogOut, Menu, NotebookPen, Package, Settings, ShoppingBag, Store, Tags } from 'lucide-react'
import { NavLink, Navigate, Outlet, useLocation } from 'react-router'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { useT, type MessageKey } from '@/i18n'
import { useAuth } from '@/lib/auth'
import { usePendingRequestsFeed } from '@/lib/queries'
import { cn } from '@/lib/utils'
import { LanguageToggle } from './LanguageToggle'
import { NewOrderAlert } from './NewOrderAlert'
import { NewRequestAlert } from './NewRequestAlert'
import { ThemeToggle } from './ThemeToggle'

const NAV: { to: string; label: MessageKey; icon: typeof Store; end?: boolean; adminOnly?: boolean; badge?: 'requests' }[] = [
  { to: '/', label: 'nav.dashboard', icon: LayoutDashboard, end: true },
  { to: '/orders', label: 'nav.orders', icon: ShoppingBag },
  { to: '/requests', label: 'nav.requests', icon: NotebookPen, badge: 'requests' },
  { to: '/products', label: 'nav.products', icon: Package },
  { to: '/categories', label: 'nav.categories', icon: Tags },
  { to: '/settings', label: 'nav.settings', icon: Settings, adminOnly: true },
]

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { admin } = useAuth()
  const location = useLocation()
  if (!admin) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  return <>{children}</>
}

function Brand() {
  const t = useT()
  return (
    <div className="flex items-center gap-2">
      <span className="flex size-8 items-center justify-center rounded-lg bg-emerald-600 text-white">
        <Store className="size-4" />
      </span>
      <span className="font-semibold">{t('layout.brand')}</span>
    </div>
  )
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const { admin } = useAuth()
  const t = useT()
  const pending = usePendingRequestsFeed().data?.totalElements ?? 0
  const items = NAV.filter((item) => !item.adminOnly || admin?.role === 'ADMIN')
  return (
    <nav className="flex flex-col gap-1" aria-label={t('layout.main')}>
      {items.map(({ to, label, icon: Icon, end, badge }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
              isActive
                ? 'bg-emerald-50 font-medium text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )
          }
        >
          <Icon className="size-4" />
          <span className="flex-1">{t(label)}</span>
          {badge === 'requests' && pending > 0 && (
            <span className="rounded-full bg-amber-500 px-1.5 py-0.5 text-[11px] leading-none font-semibold text-white tabular-nums">{pending}</span>
          )}
        </NavLink>
      ))}
    </nav>
  )
}

export function AppLayout() {
  const { admin, logout } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const t = useT()
  const initials = (admin?.name ?? admin?.email ?? '?').slice(0, 1).toUpperCase()

  return (
    <div className="min-h-screen bg-muted/30 lg:grid lg:grid-cols-[232px_1fr]">
      <a
        href="#main"
        className="sr-only z-50 rounded-md bg-background px-3 py-2 text-sm font-medium shadow focus:not-sr-only focus:fixed focus:left-3 focus:top-3"
      >
        {t('layout.skip')}
      </a>

      {/* Desktop sidebar */}
      <aside className="hidden border-r bg-background lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col">
        <div className="px-5 py-4">
          <Brand />
        </div>
        <div className="flex-1 px-3">
          <NavLinks />
        </div>
        <div className="space-y-3 px-5 py-4">
          <LanguageToggle />
          <p className="text-xs text-muted-foreground">{admin?.role === 'ADMIN' ? t('layout.signedInOwner') : t('layout.signedInStaff')}</p>
        </div>
      </aside>

      {/* Mobile / tablet navigation */}
      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side="left" className="w-72 p-0">
          <SheetHeader className="border-b px-5 py-4">
            <SheetTitle asChild>
              <div>
                <Brand />
              </div>
            </SheetTitle>
            <SheetDescription className="sr-only">{t('layout.mainNav')}</SheetDescription>
          </SheetHeader>
          <div className="px-3 py-3">
            <NavLinks onNavigate={() => setMenuOpen(false)} />
          </div>
          <LanguageToggle className="px-5 py-2" />
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-2 border-b bg-background/95 px-3 py-2.5 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:px-6">
          <Button variant="ghost" size="icon" className="lg:hidden" aria-label={t('layout.openMenu')} onClick={() => setMenuOpen(true)}>
            <Menu />
          </Button>
          <div className="lg:hidden">
            <Brand />
          </div>
          <div className="flex-1" />
          <LanguageToggle className="hidden sm:flex lg:hidden" />
          <ThemeToggle />
          <div className="hidden text-right text-sm leading-tight sm:block">
            <div className="font-medium">{admin?.name}</div>
            <div className="text-xs text-muted-foreground">
              {admin?.email} · {admin?.role}
            </div>
          </div>
          <span
            aria-hidden
            className="flex size-8 items-center justify-center rounded-full bg-emerald-100 text-sm font-semibold text-emerald-800 sm:hidden dark:bg-emerald-500/20 dark:text-emerald-300"
          >
            {initials}
          </span>
          <Button variant="outline" size="sm" onClick={() => void logout()} aria-label={t('layout.logout')}>
            <LogOut />
            <span className="hidden sm:inline">{t('layout.logout')}</span>
          </Button>
        </header>
        <main id="main" tabIndex={-1} className="flex-1 p-4 outline-none md:p-6">
          <div className="mx-auto w-full max-w-7xl">
            <Outlet />
          </div>
        </main>
      </div>
      <NewOrderAlert />
      <NewRequestAlert />
    </div>
  )
}
