// Mirrors the backend DTOs used by the customer app (com.kirana.*).

export type PaymentMethod = 'COD' | 'ONLINE';

export type ErrorCode =
  | 'OUT_OF_RADIUS'
  | 'BELOW_MIN_ORDER'
  | 'STORE_CLOSED'
  | 'PAYMENT_METHOD_DISABLED'
  | 'VARIANT_INACTIVE'
  | 'OUT_OF_STOCK'
  | 'PRICE_CHANGED'
  | 'INVALID_STATUS_TRANSITION'
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'OTP_INVALID'
  | 'OTP_RATE_LIMITED'
  | 'TOO_MANY_ATTEMPTS'
  | 'PAYMENT_VERIFICATION_FAILED'
  | 'PAYMENT_GATEWAY_ERROR'
  | 'INTERNAL_ERROR';

export interface ApiErrorBody {
  code: ErrorCode;
  message: string;
  details: Record<string, unknown>;
}

export interface Page<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export interface StoreConfig {
  storeName: string;
  storePhone: string;
  storeAddress: string;
  storeLat: number;
  storeLng: number;
  maxDeliveryRadiusKm: number;
  minOrderAmount: number;
  deliveryCharge: number;
  freeDeliveryAbove: number | null;
  codEnabled: boolean;
  onlinePaymentEnabled: boolean;
  gatewayKeyId: string | null;
  allowedPaymentMethods: PaymentMethod[];
  storeOpen: boolean;
  storeClosedMessage: string | null;
}

export interface Me {
  id: number;
  phone: string;
  name: string | null;
}

export interface CustomerAuthResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: string;
  user: Me;
  newUser: boolean;
}

export interface Category {
  id: number;
  name: string;
  slug: string;
  imageUrl: string | null;
}

export interface Variant {
  id: number;
  label: string;
  mrp: number;
  sellingPrice: number;
  discountPercent: number;
  inStock: boolean;
}

export interface Product {
  id: number;
  categoryId: number;
  name: string;
  description: string | null;
  brand: string | null;
  imageUrl: string | null;
  variants: Variant[];
}

export interface Catalog {
  categories: Category[];
  sections: { category: Category; products: Product[] }[];
}

export interface LocationCheck {
  serviceable: boolean;
  distanceKm: number;
  radiusKm: number;
}

export interface Address {
  id: number;
  label: string;
  line1: string;
  line2: string | null;
  landmark: string | null;
  pincode: string;
  lat: number;
  lng: number;
  isDefault: boolean;
}

export interface AddressInput {
  label: string;
  line1: string;
  line2?: string | null;
  landmark?: string | null;
  pincode: string;
  lat: number;
  lng: number;
  isDefault?: boolean;
}

export interface QuoteLine {
  variantId: number;
  productId: number | null;
  productName: string | null;
  variantLabel: string | null;
  imageUrl: string | null;
  mrp: number | null;
  sellingPrice: number | null;
  qty: number;
  lineTotal: number;
  issue: 'OUT_OF_STOCK' | 'VARIANT_INACTIVE' | null;
}

export interface Violation {
  code: ErrorCode;
  message: string;
  variantIds: number[];
}

export interface CartQuote {
  lines: QuoteLine[];
  itemSubtotal: number;
  deliveryFee: number;
  total: number;
  minOrderAmount: number;
  amountToMinOrder: number;
  freeDeliveryAbove: number | null;
  amountToFreeDelivery: number | null;
  serviceable: boolean | null;
  distanceKm: number | null;
  radiusKm: number;
  allowedPaymentMethods: PaymentMethod[];
  paymentMethod: PaymentMethod | null;
  storeOpen: boolean;
  storeClosedMessage: string | null;
  violations: Violation[];
  canPlaceOrder: boolean;
}

export type OrderStatus = 'PENDING_PAYMENT' | 'PLACED' | 'PACKED' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'CANCELLED';

export type PaymentStatus = 'PENDING' | 'PAID' | 'FAILED' | 'REFUND_PENDING' | 'COD_PENDING' | 'COD_COLLECTED';

export interface OrderSummary {
  id: number;
  orderNumber: string;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  total: number;
  itemCount: number;
  placedAt: string;
}

export interface OrderDetail {
  id: number;
  orderNumber: string;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  itemSubtotal: number;
  deliveryFee: number;
  total: number;
  distanceKm: number;
  customerNote: string | null;
  cancelReason: string | null;
  placedAt: string;
  deliveredAt: string | null;
  address: {
    label: string | null;
    name: string | null;
    phone: string;
    line1: string;
    line2: string | null;
    landmark: string | null;
    pincode: string;
  };
  items: {
    variantId: number | null;
    productName: string;
    variantLabel: string;
    imageUrl: string | null;
    mrp: number;
    sellingPrice: number;
    qty: number;
    lineTotal: number;
  }[];
  history: {
    fromStatus: OrderStatus | null;
    toStatus: OrderStatus;
    changedByType: 'CUSTOMER' | 'ADMIN' | 'SYSTEM';
    note: string | null;
    createdAt: string;
  }[];
  canCancel: boolean;
  payment: {
    gateway: string;
    gatewayOrderId: string;
    keyId: string | null;
    amountPaise: number;
    currency: string;
    status: PaymentStatus;
  } | null;
}
