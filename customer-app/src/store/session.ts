import { create } from 'zustand';
import { api, setSessionLostHandler, tokens } from '../lib/api';
import type { CustomerAuthResponse, Me, PaymentMethod } from '../lib/types';
import { useCartStore } from './cart';

type Status = 'loading' | 'signedOut' | 'signedIn';

interface AuthState {
  status: Status;
  user: Me | null;
  bootstrap: () => Promise<void>;
  signIn: (auth: CustomerAuthResponse) => Promise<void>;
  signOut: () => Promise<void>;
  setUser: (user: Me) => void;
}

export const useAuthStore = create<AuthState>()((set) => ({
  status: 'loading',
  user: null,
  bootstrap: async () => {
    try {
      if (!(await tokens.load())) {
        set({ status: 'signedOut' });
        return;
      }
      const { data } = await api.get<Me>('/app/me');
      set({ status: 'signedIn', user: data });
    } catch {
      // Offline or session expired: back to login keeps things simple and safe
      set({ status: 'signedOut', user: null });
    }
  },
  signIn: async (auth) => {
    await tokens.save(auth.accessToken, auth.refreshToken);
    set({ status: 'signedIn', user: auth.user });
  },
  signOut: async () => {
    const refreshToken = tokens.refresh();
    if (refreshToken) {
      await api.post('/auth/logout', { refreshToken }).catch(() => undefined);
    }
    await tokens.clear();
    useCartStore.getState().clear();
    set({ status: 'signedOut', user: null });
  },
  setUser: (user) => set({ user }),
}));

setSessionLostHandler(() => useAuthStore.setState({ status: 'signedOut', user: null }));

/** Checkout choices that survive navigating to the address list and back. */
interface CheckoutState {
  addressId: number | null;
  paymentMethod: PaymentMethod | null;
  setAddressId: (id: number | null) => void;
  setPaymentMethod: (method: PaymentMethod | null) => void;
}

export const useCheckoutStore = create<CheckoutState>()((set) => ({
  addressId: null,
  paymentMethod: null,
  setAddressId: (addressId) => set({ addressId }),
  setPaymentMethod: (paymentMethod) => set({ paymentMethod }),
}));
