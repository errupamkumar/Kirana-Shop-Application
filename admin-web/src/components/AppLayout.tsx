import { useState } from 'react'
import { LayoutDashboard, LogOut, Menu, Package, Settings, ShoppingBag, Store, Tags } from 'lucide-react'
import { NavLink, Navigate, Outlet, useLocation } from 'react-router'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { useAuth } from '@/lib/auth'
import { cn } from '@/lib/utils'
import { NewOrderAlert } from './NewOrderAlert'
import { ThemeToggle } from './ThemeToggle'

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/orders', label: 'Orders', icon: ShoppingBag },
  { to: '/products', label: 'Products', icon: Package },
  { to: '/categories', label: 'Categories', icon: Tags },
  { to: '/settings', label: 'Settings', icon: Settings, adminOnly: true },
]

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { admin } = useAuth()
  const location = useLocation()
  if (!admin) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  return <>{children}</>
}

function Brand() {
  return (
    <div className="flex items-center gap-2">
      <span className="flex size-8 items-center justify-center rounded-lg bg-emerald-600 text-white">
        <Store className="size-4" />
      </span>
      <span className="font-semibold">Kirana Admin</span>
    </div>
  )
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const { admin } = useAuth()
  const items = NAV.filter((item) => !item.adminOnly || admin?.role === 'ADMIN')
  return (
    <nav className="flex flex-col gap-1" aria-label="Main">
      {items.map(({ to, label, icon: Icon, end }) => (
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
          {label}
        </NavLink>
      ))}
    </nav>
  )
}

export function AppLayout() {
  const { admin, logout } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const initials = (admin?.name ?? admin?.email ?? '?').slice(0, 1).toUpperCase()

  return (
    <div className="min-h-screen bg-muted/30 lg:grid lg:grid-cols-[232px_1fr]">
      <a
        href="#main"
        className="sr-only z-50 rounded-md bg-background px-3 py-2 text-sm font-medium shadow focus:not-sr-only focus:fixed focus:left-3 focus:top-3"
      >
        Skip to content
      </a>

      {/* Desktop sidebar */}
      <aside className="hidden border-r bg-background lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col">
        <div className="px-5 py-4">
          <Brand />
        </div>
        <div className="flex-1 px-3">
          <NavLinks />
        </div>
        <p className="px-5 py-4 text-xs text-muted-foreground">Signed in as {admin?.role === 'ADMIN' ? 'owner' : 'staff'}</p>
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
            <SheetDescription className="sr-only">Main navigation</SheetDescription>
          </SheetHeader>
          <div className="px-3 py-3">
            <NavLinks onNavigate={() => setMenuOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-2 border-b bg-background/95 px-3 py-2.5 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:px-6">
          <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open menu" onClick={() => setMenuOpen(true)}>
            <Menu />
          </Button>
          <div className="lg:hidden">
            <Brand />
          </div>
          <div className="flex-1" />
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
          <Button variant="outline" size="sm" onClick={() => void logout()} aria-label="Log out">
            <LogOut />
            <span className="hidden sm:inline">Log out</span>
          </Button>
        </header>
        <main id="main" tabIndex={-1} className="flex-1 p-4 outline-none md:p-6">
          <div className="mx-auto w-full max-w-7xl">
            <Outlet />
          </div>
        </main>
      </div>
      <NewOrderAlert />
    </div>
  )
}
