import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { settingsSchema, toSettingsRequest, type SettingsForm as Values } from '@/lib/schemas'
import { SettingsForm } from './SettingsForm'

const valid: Values = {
  storeName: 'Sharma Kirana Store',
  storePhone: '+919876543210',
  storeAddress: '12, MG Road, Bengaluru',
  gstin: '',
  storeLat: 12.971599,
  storeLng: 77.594566,
  maxDeliveryRadiusKm: 5,
  minOrderAmount: 500,
  deliveryCharge: 30,
  freeDeliveryAbove: 1000,
  codEnabled: true,
  onlinePaymentEnabled: false,
  gatewayKeyId: '',
  gatewaySecret: '',
  gatewaySecretSet: false,
  storeOpen: true,
  storeClosedMessage: '',
  lowStockThreshold: 5,
}

function issues(values: Partial<Values>) {
  const result = settingsSchema.safeParse({ ...valid, ...values })
  return result.success ? {} : Object.fromEntries(result.error.issues.map((i) => [i.path.join('.'), i.message]))
}

describe('settings schema (mirrors server rules)', () => {
  it('accepts the seeded defaults', () => {
    expect(issues({})).toEqual({})
  })

  it('requires at least one payment method', () => {
    expect(issues({ codEnabled: false, onlinePaymentEnabled: false })).toHaveProperty('codEnabled')
  })

  it('requires key id and secret for online payment unless a secret is stored', () => {
    const missing = issues({ onlinePaymentEnabled: true })
    expect(missing).toHaveProperty('gatewayKeyId')
    expect(missing).toHaveProperty('gatewaySecret')
    expect(issues({ onlinePaymentEnabled: true, gatewayKeyId: 'rzp_test_1', gatewaySecretSet: true })).toEqual({})
  })

  it('limits the radius to 0.5 - 20 km', () => {
    expect(issues({ maxDeliveryRadiusKm: 0.4 })).toHaveProperty('maxDeliveryRadiusKm')
    expect(issues({ maxDeliveryRadiusKm: 20.5 })).toHaveProperty('maxDeliveryRadiusKm')
    expect(issues({ maxDeliveryRadiusKm: 0.5 })).toEqual({})
    expect(issues({ maxDeliveryRadiusKm: 20 })).toEqual({})
  })

  it('accepts any amount with up to 2 decimals and rejects more', () => {
    // 19.99 * 100 and 37.8 * 100 are not exact in floating point
    expect(issues({ minOrderAmount: 19.99, deliveryCharge: 37.8, freeDeliveryAbove: 1.13 })).toEqual({})
    expect(issues({ deliveryCharge: 9.95 })).toEqual({})
    expect(issues({ deliveryCharge: 9.951 })).toHaveProperty('deliveryCharge')
  })

  it('allows no free-delivery threshold but rejects zero and negatives', () => {
    expect(issues({ freeDeliveryAbove: null })).toEqual({})
    expect(issues({ freeDeliveryAbove: 0 })).toHaveProperty('freeDeliveryAbove')
    expect(issues({ minOrderAmount: -1 })).toHaveProperty('minOrderAmount')
  })

  it('never sends the secret-set flag and sends a blank secret as null', () => {
    const body = toSettingsRequest(valid)
    expect(body).not.toHaveProperty('gatewaySecretSet')
    expect(body.gatewaySecret).toBeNull()
    expect(body.gstin).toBeNull()
  })
})

describe('SettingsForm', () => {
  it('blocks submit and explains when both payment methods are off', async () => {
    const onSubmit = vi.fn()
    render(<SettingsForm initial={valid} onSubmit={onSubmit} />)
    await userEvent.click(screen.getByRole('switch', { name: 'Cash on delivery' }))
    await userEvent.click(screen.getByRole('button', { name: 'Save settings' }))
    expect(await screen.findAllByText('At least one payment method must stay enabled')).not.toHaveLength(0)
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('asks for Razorpay credentials when online payment is switched on', async () => {
    const onSubmit = vi.fn()
    render(<SettingsForm initial={valid} onSubmit={onSubmit} />)
    await userEvent.click(screen.getByRole('switch', { name: 'Online payment (Razorpay)' }))
    await userEvent.click(screen.getByRole('button', { name: 'Save settings' }))
    expect(await screen.findByText('Key id is required for online payment')).toBeInTheDocument()
    expect(screen.getByText('Secret is required for online payment')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('shows a range error for the radius and a required error for blank amounts', async () => {
    const onSubmit = vi.fn()
    render(<SettingsForm initial={valid} onSubmit={onSubmit} />)
    const radius = screen.getByLabelText('Delivery radius (km)')
    await userEvent.clear(radius)
    await userEvent.type(radius, '25')
    await userEvent.clear(screen.getByLabelText('Minimum order (₹)'))
    await userEvent.click(screen.getByRole('button', { name: 'Save settings' }))
    expect(await screen.findByText('At most 20 km')).toBeInTheDocument()
    expect(screen.getByText('Required')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('submits valid values, including a changed minimum order', async () => {
    const onSubmit = vi.fn()
    render(<SettingsForm initial={valid} onSubmit={onSubmit} />)
    const min = screen.getByLabelText('Minimum order (₹)')
    await userEvent.clear(min)
    await userEvent.type(min, '250')
    await userEvent.click(screen.getByRole('button', { name: 'Save settings' }))
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ minOrderAmount: 250, codEnabled: true })
  })

  it('tells the owner a stored secret is kept when left blank', () => {
    render(<SettingsForm initial={{ ...valid, gatewaySecretSet: true }} onSubmit={vi.fn()} />)
    expect(screen.getByText('Secret is set; leave blank to keep it')).toBeInTheDocument()
  })
})
