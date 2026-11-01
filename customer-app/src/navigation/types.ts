import type { NativeStackScreenProps } from '@react-navigation/native-stack';

// Params are plain values (ids, strings) so every screen also works as a web URL and survives a refresh.

export type AuthStackParamList = {
  Login: undefined;
  Otp: { phone: string; resendAfterSeconds: number };
};

export type TabParamList = {
  Home: undefined;
  Orders: undefined;
  Profile: undefined;
};

export type AppStackParamList = {
  Tabs: undefined;
  Category: { categoryId: number; name?: string };
  Search: undefined;
  Cart: undefined;
  Addresses: { select?: boolean } | undefined;
  AddressForm: { addressId?: number } | undefined;
  OrderSuccess: { orderId: number; orderNumber: string };
  OrderDetail: { orderId: number };
  /** Send a list photo and/or voice note; mode opens with that card first. */
  RequestOrder: { mode?: 'photo' | 'voice' } | undefined;
  Requests: undefined;
  RequestDetail: { requestId: number };
};

export type AuthScreenProps<T extends keyof AuthStackParamList> = NativeStackScreenProps<AuthStackParamList, T>;
export type AppScreenProps<T extends keyof AppStackParamList> = NativeStackScreenProps<AppStackParamList, T>;

declare global {
  namespace ReactNavigation {
    interface RootParamList extends AppStackParamList, TabParamList {}
  }
}
