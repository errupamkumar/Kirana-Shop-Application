import { keepPreviousData, useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query'
import { api } from './api'
import type {
  Category,
  Dashboard,
  Invoice,
  OrderDetail,
  OrderStatus,
  OrderSummary,
  Page,
  Product,
  StoreSettings,
  Variant,
} from './types'

export const keys = {
  dashboard: ['dashboard'] as const,
  settings: ['settings'] as const,
  categories: ['categories'] as const,
  products: (params: ProductFilters) => ['products', params] as const,
  product: (id: number) => ['product', id] as const,
  orders: (params: OrderFilters) => ['orders', params] as const,
  order: (id: number) => ['order', id] as const,
  invoice: (id: number) => ['invoice', id] as const,
}

// ---- Dashboard ----

export function useDashboard() {
  return useQuery({
    queryKey: keys.dashboard,
    queryFn: async () => (await api.get<Dashboard>('/admin/dashboard')).data,
    refetchInterval: 30_000,
  })
}

// ---- Settings ----

export function useSettings() {
  return useQuery({ queryKey: keys.settings, queryFn: async () => (await api.get<StoreSettings>('/admin/settings')).data })
}

export function useSaveSettings() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: unknown) => (await api.put<StoreSettings>('/admin/settings', body)).data,
    onSuccess: (data) => {
      qc.setQueryData(keys.settings, data)
      void qc.invalidateQueries({ queryKey: keys.dashboard })
    },
  })
}

// ---- Categories ----

export function useCategories() {
  return useQuery({ queryKey: keys.categories, queryFn: async () => (await api.get<Category[]>('/admin/categories')).data })
}

export function useSaveCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, body }: { id?: number; body: unknown }) =>
      id
        ? (await api.put<Category>(`/admin/categories/${id}`, body)).data
        : (await api.post<Category>('/admin/categories', body)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.categories }),
  })
}

export function useDeleteCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) =>
      (await api.delete<{ deleted: boolean; deactivated: boolean }>(`/admin/categories/${id}`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.categories }),
  })
}

// ---- Products ----

export interface ProductFilters {
  q?: string
  categoryId?: number
  active?: boolean
  page: number
}

export function useProducts(filters: ProductFilters) {
  return useQuery({
    queryKey: keys.products(filters),
    queryFn: async () => (await api.get<Page<Product>>('/admin/products', { params: { ...filters, size: 20 } })).data,
    placeholderData: keepPreviousData,
  })
}

export function useSaveProduct() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, body }: { id?: number; body: unknown }) =>
      id
        ? (await api.put<Product>(`/admin/products/${id}`, body)).data
        : (await api.post<Product>('/admin/products', body)).data,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['products'] })
      void qc.invalidateQueries({ queryKey: keys.categories })
    },
  })
}

type ProductPages = [QueryKey, Page<Product> | undefined][]

/** Applies a change to every cached product page; returns a rollback. */
function patchCachedProducts(qc: ReturnType<typeof useQueryClient>, update: (p: Product) => Product) {
  const snapshot = qc.getQueriesData<Page<Product>>({ queryKey: ['products'] }) as ProductPages
  qc.setQueriesData<Page<Product>>({ queryKey: ['products'] }, (page) =>
    page ? { ...page, content: page.content.map(update) } : page,
  )
  return () => snapshot.forEach(([key, data]) => qc.setQueryData(key, data))
}

/** Optimistic product active switch. */
export function useToggleProduct() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, active }: { id: number; active: boolean }) =>
      (await api.patch<Product>(`/admin/products/${id}/active`, { active })).data,
    onMutate: async ({ id, active }) => {
      await qc.cancelQueries({ queryKey: ['products'] })
      return { rollback: patchCachedProducts(qc, (p) => (p.id === id ? { ...p, active } : p)) }
    },
    onError: (_e, _v, ctx) => ctx?.rollback(),
    onSettled: () => qc.invalidateQueries({ queryKey: ['products'] }),
  })
}

export interface VariantPatch {
  stockQty?: number
  mrp?: number
  sellingPrice?: number
  active?: boolean
}

/** Optimistic inline variant edit (stock, prices, active). */
export function usePatchVariant() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, patch }: { id: number; patch: VariantPatch }) =>
      (await api.patch<Variant>(`/admin/variants/${id}`, patch)).data,
    onMutate: async ({ id, patch }) => {
      await qc.cancelQueries({ queryKey: ['products'] })
      return {
        rollback: patchCachedProducts(qc, (p) => ({
          ...p,
          variants: p.variants.map((v) => (v.id === id ? { ...v, ...patch } : v)),
        })),
      }
    },
    onError: (_e, _v, ctx) => ctx?.rollback(),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ['products'] })
      void qc.invalidateQueries({ queryKey: keys.dashboard })
    },
  })
}

export async function uploadImage(file: File): Promise<string> {
  const form = new FormData()
  form.append('file', file)
  const { data } = await api.post<{ url: string }>('/admin/uploads/image', form)
  return data.url
}

// ---- Orders ----

export interface OrderFilters {
  status?: OrderStatus
  from?: string
  to?: string
  q?: string
  page: number
}

export function useOrders(filters: OrderFilters) {
  return useQuery({
    queryKey: keys.orders(filters),
    queryFn: async () => (await api.get<Page<OrderSummary>>('/admin/orders', { params: { ...filters, size: 20 } })).data,
    placeholderData: keepPreviousData,
    refetchInterval: 10_000,
  })
}

/** Latest PLACED orders, polled for the new-order alert. */
export function useNewOrdersFeed(enabled: boolean) {
  return useQuery({
    queryKey: ['orders', 'feed'],
    queryFn: async () =>
      (await api.get<Page<OrderSummary>>('/admin/orders', { params: { status: 'PLACED', size: 20, page: 0 } })).data,
    refetchInterval: 10_000,
    refetchIntervalInBackground: true,
    enabled,
  })
}

export function useOrder(id: number | null) {
  return useQuery({
    queryKey: keys.order(id ?? 0),
    queryFn: async () => (await api.get<OrderDetail>(`/admin/orders/${id}`)).data,
    enabled: id != null,
    refetchInterval: 10_000,
  })
}

export function useUpdateOrderStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, status, note }: { id: number; status: OrderStatus; note?: string }) =>
      (await api.patch<OrderDetail>(`/admin/orders/${id}/status`, { status, note: note || null })).data,
    onSuccess: (data) => {
      qc.setQueryData(keys.order(data.id), data)
      void qc.invalidateQueries({ queryKey: ['orders'] })
      void qc.invalidateQueries({ queryKey: keys.dashboard })
      void qc.invalidateQueries({ queryKey: ['products'] })
    },
  })
}

export function useInvoice(id: number) {
  return useQuery({ queryKey: keys.invoice(id), queryFn: async () => (await api.get<Invoice>(`/admin/orders/${id}/invoice`)).data })
}
