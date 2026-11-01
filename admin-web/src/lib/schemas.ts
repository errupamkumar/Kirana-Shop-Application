import { z } from 'zod'
import type { StoreSettings } from './types'

// Request schemas mirroring the backend's Bean Validation. Number inputs register with toNumberOrNull.

/** RHF setValueAs for number inputs: '' becomes null so "Required" errors show instead of NaN. */
export const toNumberOrNull = (value: unknown): number | null =>
  value === '' || value === null || value === undefined ? null : Number(value)

const num = (label = 'Required') => z.number({ error: label }).refine((n) => Number.isFinite(n), label)
// n * 100 is inexact for many valid amounts (19.99 * 100 = 1998.9999999999998), so compare with a tolerance
const money = () =>
  num()
    .min(0, 'Must be 0 or more')
    .refine((n) => Math.abs(Math.round(n * 100) - n * 100) < 1e-6, 'At most 2 decimals')

export const loginSchema = z.object({
  email: z.email('Enter a valid email'),
  password: z.string().min(1, 'Required'),
})
export type LoginForm = z.infer<typeof loginSchema>

export const settingsSchema = z
  .object({
    storeName: z.string().trim().min(1, 'Required').max(120),
    storePhone: z.string().trim().min(1, 'Required').max(20),
    storeAddress: z.string().trim().min(1, 'Required').max(300),
    gstin: z.string().trim().regex(/^$|^[0-9A-Z]{15}$/, 'Must be 15 uppercase letters/digits'),
    storeLat: num().min(-90, 'Between -90 and 90').max(90, 'Between -90 and 90'),
    storeLng: num().min(-180, 'Between -180 and 180').max(180, 'Between -180 and 180'),
    maxDeliveryRadiusKm: num().min(0.5, 'At least 0.5 km').max(20, 'At most 20 km'),
    minOrderAmount: money(),
    deliveryCharge: money(),
    freeDeliveryAbove: money().refine((n) => n > 0, 'Must be more than 0').nullable(),
    codEnabled: z.boolean(),
    onlinePaymentEnabled: z.boolean(),
    gatewayKeyId: z.string().trim().max(100),
    gatewaySecret: z.string().max(200),
    /** Read-only context from the server: a secret is already stored. Not sent. */
    gatewaySecretSet: z.boolean(),
    storeOpen: z.boolean(),
    storeClosedMessage: z.string().max(300),
    lowStockThreshold: num().int('Whole number').min(0).max(1000),
  })
  .superRefine((v, ctx) => {
    if (!v.codEnabled && !v.onlinePaymentEnabled) {
      ctx.addIssue({ code: 'custom', path: ['codEnabled'], message: 'At least one payment method must stay enabled' })
    }
    if (v.onlinePaymentEnabled) {
      if (!v.gatewayKeyId) {
        ctx.addIssue({ code: 'custom', path: ['gatewayKeyId'], message: 'Key id is required for online payment' })
      }
      if (!v.gatewaySecret && !v.gatewaySecretSet) {
        ctx.addIssue({ code: 'custom', path: ['gatewaySecret'], message: 'Secret is required for online payment' })
      }
    }
  })
export type SettingsForm = z.infer<typeof settingsSchema>

export function toSettingsForm(s: StoreSettings): SettingsForm {
  return {
    storeName: s.storeName,
    storePhone: s.storePhone,
    storeAddress: s.storeAddress,
    gstin: s.gstin ?? '',
    storeLat: s.storeLat,
    storeLng: s.storeLng,
    maxDeliveryRadiusKm: s.maxDeliveryRadiusKm,
    minOrderAmount: s.minOrderAmount,
    deliveryCharge: s.deliveryCharge,
    freeDeliveryAbove: s.freeDeliveryAbove,
    codEnabled: s.codEnabled,
    onlinePaymentEnabled: s.onlinePaymentEnabled,
    gatewayKeyId: s.gatewayKeyId ?? '',
    gatewaySecret: '',
    gatewaySecretSet: s.gatewaySecretSet,
    storeOpen: s.storeOpen,
    storeClosedMessage: s.storeClosedMessage ?? '',
    lowStockThreshold: s.lowStockThreshold,
  }
}

/** PUT /admin/settings body. A blank secret keeps the stored one. */
export function toSettingsRequest(form: SettingsForm) {
  const { gatewaySecretSet: _ignored, ...rest } = form
  void _ignored
  return {
    ...rest,
    gstin: rest.gstin || null,
    gatewayKeyId: rest.gatewayKeyId || null,
    gatewaySecret: rest.gatewaySecret || null,
    storeClosedMessage: rest.storeClosedMessage || null,
  }
}

export const variantSchema = z
  .object({
    id: z.number().nullable(),
    label: z.string().trim().min(1, 'Required').max(40),
    sku: z
      .string()
      .trim()
      .min(1, 'Required')
      .max(60)
      .regex(/^[A-Za-z0-9._-]+$/, 'Letters, digits, . _ - only'),
    mrp: money().refine((n) => n >= 0.01, 'Must be more than 0'),
    sellingPrice: money(),
    stockQty: num().int('Whole number').min(0, 'Must be 0 or more'),
    /** Stock when the form opened; the server applies only the change, keeping orders placed meanwhile. */
    stockQtyLoaded: z.number().nullable(),
    active: z.boolean(),
  })
  .refine((v) => v.sellingPrice <= v.mrp, { path: ['sellingPrice'], message: 'Cannot exceed MRP' })

export const productSchema = z
  .object({
    categoryId: num('Choose a category'),
    name: z.string().trim().min(1, 'Required').max(160),
    nameHi: z.string().trim().max(160),
    description: z.string().max(2000),
    brand: z.string().trim().max(80),
    imageUrl: z.string().max(500),
    active: z.boolean(),
    variants: z.array(variantSchema).min(1, 'Add at least one variant').max(20),
  })
  .superRefine((v, ctx) => {
    const seen = new Set<string>()
    v.variants.forEach((variant, index) => {
      const sku = variant.sku.trim().toUpperCase()
      if (sku && seen.has(sku)) {
        ctx.addIssue({ code: 'custom', path: ['variants', index, 'sku'], message: 'SKU repeated' })
      }
      seen.add(sku)
    })
  })
export type ProductForm = z.infer<typeof productSchema>

export function toProductRequest(form: ProductForm) {
  return {
    ...form,
    nameHi: form.nameHi || null,
    description: form.description || null,
    brand: form.brand || null,
    imageUrl: form.imageUrl || null,
    variants: form.variants.map((v, index) => ({ ...v, sortOrder: index })),
  }
}

export const categorySchema = z.object({
  name: z.string().trim().min(1, 'Required').max(80),
  nameHi: z.string().trim().max(80),
  slug: z
    .string()
    .trim()
    .max(90)
    .regex(/^$|^[a-z0-9]+(-[a-z0-9]+)*$/, 'Lowercase words separated by -'),
  imageUrl: z.string().max(500),
  sortOrder: num().int('Whole number').min(0),
  active: z.boolean(),
})
export type CategoryForm = z.infer<typeof categorySchema>
