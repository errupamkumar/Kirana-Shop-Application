// Response types mirroring the backend DTOs (com.kirana.*). Request types are inferred from Zod in schemas.ts.

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
  | 'INTERNAL_ERROR'

export interface ApiErrorBody {
  code: ErrorCode
  message: string
  details: Record<string, unknown>
}

export interface Page<T> {
  content: T[]
  page: number
  size: number
  totalElements: number
  totalPages: number
}

export type AdminRole = 'ADMIN' | 'STAFF'

export interface AdminProfile {
  id: number
  email: string
  name: string
  role: AdminRole
}

export interface TokenPair {
  accessToken: string
  refreshToken: string
  expiresIn: number
  tokenType: string
}

export interface AdminAuthResponse extends TokenPair {
  admin: AdminProfile
}

export type PaymentMethod = 'COD' | 'ONLINE'

export interface StoreSettings {
  storeName: string
  storePhone: string
  storeAddress: string
  gstin: string | null
  storeLat: number
  storeLng: number
  maxDeliveryRadiusKm: number
  minOrderAmount: number
  deliveryCharge: number
  freeDeliveryAbove: number | null
  codEnabled: boolean
  onlinePaymentEnabled: boolean
  gatewayKeyId: string | null
  gatewaySecretSet: boolean
  storeOpen: boolean
  storeClosedMessage: string | null
  lowStockThreshold: number
  updatedAt: string
  updatedBy: string | null
}

export interface Category {
  id: number
  name: string
  slug: string
  imageUrl: string | null
  sortOrder: number
  active: boolean
  productCount: number
}

export interface Variant {
  id: number
  label: string
  sku: string
  mrp: number
  sellingPrice: number
  discountPercent: number
  stockQty: number
  active: boolean
  sortOrder: number
}

export interface Product {
  id: number
  categoryId: number
  categoryName: string
  name: string
  description: string | null
  brand: string | null
  imageUrl: string | null
  active: boolean
  variants: Variant[]
  createdAt: string
  updatedAt: string
}

export type OrderStatus = 'PENDING_PAYMENT' | 'PLACED' | 'PACKED' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'CANCELLED'

export type PaymentStatus = 'PENDING' | 'PAID' | 'FAILED' | 'REFUND_PENDING' | 'COD_PENDING' | 'COD_COLLECTED'

export interface OrderSummary {
  id: number
  orderNumber: string
  status: OrderStatus
  paymentMethod: PaymentMethod
  paymentStatus: PaymentStatus
  total: number
  itemCount: number
  customerName: string | null
  customerPhone: string
  placedAt: string
}

export interface OrderItem {
  variantId: number | null
  productName: string
  variantLabel: string
  imageUrl: string | null
  mrp: number
  sellingPrice: number
  qty: number
  lineTotal: number
}

export interface StatusHistory {
  fromStatus: OrderStatus | null
  toStatus: OrderStatus
  changedByType: 'CUSTOMER' | 'ADMIN' | 'SYSTEM'
  note: string | null
  createdAt: string
}

export interface AddressSnapshot {
  label: string | null
  name: string | null
  phone: string
  line1: string
  line2: string | null
  landmark: string | null
  pincode: string
  lat: number
  lng: number
}

export interface OrderDetail {
  id: number
  orderNumber: string
  status: OrderStatus
  paymentMethod: PaymentMethod
  paymentStatus: PaymentStatus
  itemSubtotal: number
  deliveryFee: number
  total: number
  distanceKm: number
  customerNote: string | null
  cancelReason: string | null
  placedAt: string
  deliveredAt: string | null
  address: AddressSnapshot
  items: OrderItem[]
  history: StatusHistory[]
  canCancel: boolean
  allowedNextStatuses: OrderStatus[]
  payment: { gateway: string; gatewayOrderId: string; status: PaymentStatus } | null
}

export interface Invoice {
  store: { name: string; address: string; phone: string; gstin: string | null }
  order: OrderDetail
  generatedAt: string
}

export interface Dashboard {
  todayOrders: number
  todayRevenue: number
  countsByStatus: Record<OrderStatus, number>
  pendingOrders: number
  lowStockThreshold: number
  lowStockCount: number
  lowStock: { variantId: number; productId: number; productName: string; variantLabel: string; sku: string; stockQty: number }[]
  last7Days: { date: string; orders: number; revenue: number }[]
}
