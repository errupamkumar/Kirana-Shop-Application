import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { addMoney, timesMoney } from '../lib/money';

export const MAX_QTY_PER_ITEM = 50;

/** Snapshot of what the customer saw; prices are display only, checkout uses the server quote. */
export interface CartItem {
  variantId: number;
  productId: number;
  productName: string;
  /** Hindi name when the store set one (shown in Hindi mode). */
  productNameHi?: string | null;
  variantLabel: string;
  imageUrl: string | null;
  sellingPrice: number;
  mrp: number;
  qty: number;
}

interface CartState {
  items: Record<number, CartItem>;
  add: (item: Omit<CartItem, 'qty'>) => void;
  increment: (variantId: number) => void;
  decrement: (variantId: number) => void;
  remove: (variantId: number) => void;
  /** Applies server prices from a quote so the cart shows what will be charged. */
  syncPrices: (prices: { variantId: number; sellingPrice: number | null; mrp: number | null }[]) => void;
  clear: () => void;
}

export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      items: {},
      add: (item) =>
        set((state) => {
          const existing = state.items[item.variantId];
          const qty = Math.min((existing?.qty ?? 0) + 1, MAX_QTY_PER_ITEM);
          return { items: { ...state.items, [item.variantId]: { ...item, qty } } };
        }),
      increment: (variantId) =>
        set((state) => {
          const item = state.items[variantId];
          if (!item || item.qty >= MAX_QTY_PER_ITEM) return state;
          return { items: { ...state.items, [variantId]: { ...item, qty: item.qty + 1 } } };
        }),
      decrement: (variantId) =>
        set((state) => {
          const item = state.items[variantId];
          if (!item) return state;
          const { [variantId]: _removed, ...rest } = state.items;
          return { items: item.qty <= 1 ? rest : { ...state.items, [variantId]: { ...item, qty: item.qty - 1 } } };
        }),
      remove: (variantId) =>
        set((state) => {
          const { [variantId]: _removed, ...rest } = state.items;
          return { items: rest };
        }),
      syncPrices: (prices) =>
        set((state) => {
          let changed = false;
          const items = { ...state.items };
          for (const p of prices) {
            const item = items[p.variantId];
            if (item && p.sellingPrice != null && p.mrp != null && (item.sellingPrice !== p.sellingPrice || item.mrp !== p.mrp)) {
              items[p.variantId] = { ...item, sellingPrice: p.sellingPrice, mrp: p.mrp };
              changed = true;
            }
          }
          return changed ? { items } : state;
        }),
      clear: () => set({ items: {} }),
    }),
    { name: 'kirana-cart', version: 1, storage: createJSONStorage(() => AsyncStorage) },
  ),
);

// ---- Derived values (pure, so they are easy to test and to use as selectors) ----

export function cartItems(items: Record<number, CartItem>): CartItem[] {
  return Object.values(items);
}

export function itemCount(items: Record<number, CartItem>): number {
  return cartItems(items).reduce((sum, i) => sum + i.qty, 0);
}

export function itemSubtotal(items: Record<number, CartItem>): number {
  return addMoney(...cartItems(items).map((i) => timesMoney(i.sellingPrice, i.qty)));
}

export function mrpSavings(items: Record<number, CartItem>): number {
  return addMoney(...cartItems(items).map((i) => timesMoney(i.mrp - i.sellingPrice, i.qty)));
}

export const useItemCount = () => useCartStore((s) => itemCount(s.items));
export const useItemSubtotal = () => useCartStore((s) => itemSubtotal(s.items));
export const useQty = (variantId: number) => useCartStore((s) => s.items[variantId]?.qty ?? 0);
