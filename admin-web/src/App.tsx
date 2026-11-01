import { lazy, Suspense } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createBrowserRouter, Navigate, Outlet, RouterProvider } from 'react-router'
import { Toaster } from '@/components/ui/sonner'
import { AppLayout, RequireAuth } from '@/components/AppLayout'
import { LoadingRows } from '@/components/common'
import { RouteError } from '@/components/RouteError'
import { AuthProvider, useAuth } from '@/lib/auth'

const LoginPage = lazy(() => import('@/pages/LoginPage'))
const DashboardPage = lazy(() => import('@/pages/DashboardPage'))
const OrdersPage = lazy(() => import('@/pages/OrdersPage'))
const RequestsPage = lazy(() => import('@/pages/RequestsPage'))
const ProductsPage = lazy(() => import('@/pages/ProductsPage'))
const CategoriesPage = lazy(() => import('@/pages/CategoriesPage'))
const StoreSettingsPage = lazy(() => import('@/pages/StoreSettingsPage'))
const InvoicePage = lazy(() => import('@/pages/InvoicePage'))

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 5_000, refetchOnWindowFocus: true },
  },
})

function Lazy() {
  return (
    <Suspense fallback={<div className="p-6"><LoadingRows /></div>}>
      <Outlet />
    </Suspense>
  )
}

function AdminOnly({ children }: { children: React.ReactNode }) {
  const { admin } = useAuth()
  return admin?.role === 'ADMIN' ? <>{children}</> : <Navigate to="/" replace />
}

const router = createBrowserRouter([
  {
    element: <Lazy />,
    errorElement: <RouteError />,
    children: [
      { path: '/login', element: <LoginPage /> },
      { path: '/orders/:id/invoice', element: <RequireAuth><InvoicePage /></RequireAuth> },
      {
        element: (
          <RequireAuth>
            <AppLayout />
          </RequireAuth>
        ),
        children: [
          {
            element: <Lazy />,
            children: [
              { index: true, element: <DashboardPage /> },
              { path: 'orders', element: <OrdersPage /> },
              { path: 'requests', element: <RequestsPage /> },
              { path: 'products', element: <ProductsPage /> },
              { path: 'categories', element: <CategoriesPage /> },
              { path: 'settings', element: <AdminOnly><StoreSettingsPage /></AdminOnly> },
            ],
          },
        ],
      },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
])

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RouterProvider router={router} />
        <Toaster position="top-right" richColors closeButton />
      </AuthProvider>
    </QueryClientProvider>
  )
}
