import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import type {
  Address,
  AddressInput,
  CartQuote,
  Catalog,
  Me,
  OrderDetail,
  OrderStatus,
  OrderSummary,
  Page,
  PaymentMethod,
  Product,
  StoreConfig,
} from '../lib/types';

export const keys = {
  config: ['config'] as const,
  catalog: ['catalog'] as const,
  products: (categoryId?: number, q?: string) => ['products', categoryId ?? null, q ?? ''] as const,
  addresses: ['addresses'] as const,
  quote: (body: unknown) => ['quote', body] as const,
  myOrders: ['orders', 'my'] as const,
  order: (id: number) => ['orders', id] as const,
};

/** Store rules; refetched whenever the app returns to the foreground (focusManager in App.tsx). */
export function useStoreConfig() {
  return useQuery({
    queryKey: keys.config,
    queryFn: async () => (await api.get<StoreConfig>('/app/config')).data,
    staleTime: 0,
  });
}

export function useCatalog() {
  return useQuery({ queryKey: keys.catalog, queryFn: async () => (await api.get<Catalog>('/app/catalog')).data });
}

/** Category id → name from the (shared, cached) catalog query; used for placeholder illustrations. */
export function useCategoryName(categoryId: number): string | undefined {
  return useQuery({
    queryKey: keys.catalog,
    queryFn: async () => (await api.get<Catalog>('/app/catalog')).data,
    select: (catalog) => catalog.categories.find((c) => c.id === categoryId)?.name,
  }).data;
}

export function useProducts(categoryId?: number, q?: string) {
  return useInfiniteQuery({
    queryKey: keys.products(categoryId, q),
    queryFn: async ({ pageParam }) =>
      (await api.get<Page<Product>>('/app/products', { params: { categoryId, q: q || undefined, page: pageParam, size: 20 } })).data,
    initialPageParam: 0,
    getNextPageParam: (last) => (last.page + 1 < last.totalPages ? last.page + 1 : undefined),
    enabled: categoryId != null || (q?.trim().length ?? 0) >= 2,
  });
}

// ---- Addresses ----

export function useAddresses() {
  return useQuery({ queryKey: keys.addresses, queryFn: async () => (await api.get<Address[]>('/app/addresses')).data });
}

export function useSaveAddress() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, body }: { id?: number; body: AddressInput }) =>
      id ? (await api.put<Address>(`/app/addresses/${id}`, body)).data : (await api.post<Address>('/app/addresses', body)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.addresses }),
  });
}

export function useDeleteAddress() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => api.delete(`/app/addresses/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.addresses }),
  });
}

// ---- Cart quote ----

export function useDebounced<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

export interface QuoteRequest {
  items: { variantId: number; qty: number }[];
  addressId: number | null;
  paymentMethod: PaymentMethod | null;
}

/** Server quote for the cart (debounced 400 ms). `validating` is true while the inputs settle or a request runs. */
export function useCartQuote(request: QuoteRequest) {
  // Debounce the serialized request: a string is stable across renders, a fresh object is not
  const requestKey = JSON.stringify(request);
  const debouncedKey = useDebounced(requestKey, 400);
  const debounced = JSON.parse(debouncedKey) as QuoteRequest;
  const settled = debouncedKey === requestKey;
  const query = useQuery({
    queryKey: keys.quote(debounced),
    queryFn: async () =>
      (
        await api.post<CartQuote>('/app/cart/validate', {
          items: debounced.items,
          addressId: debounced.addressId ?? undefined,
          paymentMethod: debounced.paymentMethod ?? undefined,
        })
      ).data,
    enabled: debounced.items.length > 0,
    placeholderData: (previous) => previous,
    staleTime: 0,
  });
  return { ...query, validating: !settled || query.isFetching };
}

// ---- Orders ----

export interface PlaceOrderBody {
  items: { variantId: number; qty: number }[];
  addressId: number;
  paymentMethod: PaymentMethod;
  expectedTotal: number;
  note?: string;
}

export function usePlaceOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ body, idempotencyKey }: { body: PlaceOrderBody; idempotencyKey: string }) =>
      (await api.post<OrderDetail>('/app/orders', body, { headers: { 'Idempotency-Key': idempotencyKey } })).data,
    onSuccess: (order) => {
      qc.setQueryData(keys.order(order.id), order);
      void qc.invalidateQueries({ queryKey: keys.myOrders });
      void qc.invalidateQueries({ queryKey: keys.catalog });
      void qc.invalidateQueries({ queryKey: ['products'] });
    },
  });
}

export function useMyOrders() {
  return useInfiniteQuery({
    queryKey: keys.myOrders,
    queryFn: async ({ pageParam }) =>
      (await api.get<Page<OrderSummary>>('/app/orders/my', { params: { page: pageParam, size: 20 } })).data,
    initialPageParam: 0,
    getNextPageParam: (last) => (last.page + 1 < last.totalPages ? last.page + 1 : undefined),
  });
}

const TERMINAL: OrderStatus[] = ['DELIVERED', 'CANCELLED'];

/** Order tracking; polls every 15 s until the order is delivered or cancelled. */
export function useOrder(id: number) {
  return useQuery({
    queryKey: keys.order(id),
    queryFn: async () => (await api.get<OrderDetail>(`/app/orders/${id}`)).data,
    refetchInterval: (query) => (query.state.data && TERMINAL.includes(query.state.data.status) ? false : 15_000),
  });
}

export function useCancelOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason }: { id: number; reason?: string }) =>
      (await api.post<OrderDetail>(`/app/orders/${id}/cancel`, { reason })).data,
    onSuccess: (order) => {
      qc.setQueryData(keys.order(order.id), order);
      void qc.invalidateQueries({ queryKey: keys.myOrders });
    },
  });
}

export function useVerifyPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { orderId: number; razorpayOrderId: string; razorpayPaymentId: string; signature: string }) =>
      (await api.post<OrderDetail>('/app/payments/razorpay/verify', body)).data,
    onSuccess: (order) => {
      qc.setQueryData(keys.order(order.id), order);
      void qc.invalidateQueries({ queryKey: keys.myOrders });
    },
  });
}

export function useUpdateMe() {
  return useMutation({ mutationFn: async (name: string) => (await api.put<Me>('/app/me', { name })).data });
}
