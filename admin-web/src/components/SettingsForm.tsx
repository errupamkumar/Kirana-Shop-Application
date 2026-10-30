import { useEffect } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { Crosshair, ExternalLink, Loader2 } from 'lucide-react'
import { Controller, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { mapsUrl } from '@/lib/format'
import { settingsSchema, toNumberOrNull, type SettingsForm as SettingsValues } from '@/lib/schemas'
import { Field } from './common'

function SwitchRow({ id, label, description, children }: { id: string; label: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-md border p-3">
      <div>
        <label htmlFor={id} className="text-sm font-medium">
          {label}
        </label>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
      {children}
    </div>
  )
}

/** Store rules form. Client validation mirrors the server; the server re-validates everything. */
export function SettingsForm({
  initial,
  saving,
  onSubmit,
}: {
  initial: SettingsValues
  saving?: boolean
  onSubmit: (values: SettingsValues) => void
}) {
  const form = useForm<SettingsValues>({ resolver: zodResolver(settingsSchema), defaultValues: initial })
  const { errors } = form.formState
  const num = { setValueAs: toNumberOrNull }
  const online = form.watch('onlinePaymentEnabled')
  const open = form.watch('storeOpen')
  const lat = form.watch('storeLat')
  const lng = form.watch('storeLng')
  const secretSet = form.watch('gatewaySecretSet')

  useEffect(() => {
    form.reset(initial)
  }, [initial, form])

  function fillCurrentLocation() {
    if (!navigator.geolocation) {
      toast.error('Location is not available in this browser')
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        form.setValue('storeLat', Number(pos.coords.latitude.toFixed(6)), { shouldDirty: true, shouldValidate: true })
        form.setValue('storeLng', Number(pos.coords.longitude.toFixed(6)), { shouldDirty: true, shouldValidate: true })
        toast.success('Location filled in. Check it on the map before saving.')
      },
      () => toast.error('Could not get your location'),
      { enableHighAccuracy: true, timeout: 10_000 },
    )
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6" noValidate aria-label="Store settings">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Store details</CardTitle>
          <CardDescription>Shown in the app and on invoices.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Store name" htmlFor="storeName" error={errors.storeName?.message}>
            <Input id="storeName" {...form.register('storeName')} />
          </Field>
          <Field label="Phone" htmlFor="storePhone" error={errors.storePhone?.message}>
            <Input id="storePhone" {...form.register('storePhone')} />
          </Field>
          <Field label="Address" htmlFor="storeAddress" error={errors.storeAddress?.message} className="sm:col-span-2">
            <Textarea id="storeAddress" rows={2} {...form.register('storeAddress')} />
          </Field>
          <Field label="GSTIN (optional)" htmlFor="gstin" error={errors.gstin?.message}>
            <Input id="gstin" {...form.register('gstin')} />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Location and delivery area</CardTitle>
          <CardDescription>Orders are accepted only within the radius of this point.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <Field label="Latitude" htmlFor="storeLat" error={errors.storeLat?.message}>
            <Input id="storeLat" type="number" step="0.000001" {...form.register('storeLat', num)} />
          </Field>
          <Field label="Longitude" htmlFor="storeLng" error={errors.storeLng?.message}>
            <Input id="storeLng" type="number" step="0.000001" {...form.register('storeLng', num)} />
          </Field>
          <Field label="Delivery radius (km)" htmlFor="maxDeliveryRadiusKm" error={errors.maxDeliveryRadiusKm?.message} hint="0.5 to 20 km">
            <Input id="maxDeliveryRadiusKm" type="number" step="0.1" {...form.register('maxDeliveryRadiusKm', num)} />
          </Field>
          <div className="flex flex-wrap gap-2 sm:col-span-3">
            <Button type="button" variant="outline" size="sm" onClick={fillCurrentLocation}>
              <Crosshair /> Use my current location
            </Button>
            {Number.isFinite(lat) && Number.isFinite(lng) && (
              <Button type="button" variant="ghost" size="sm" asChild>
                <a href={mapsUrl(lat, lng)} target="_blank" rel="noreferrer">
                  Preview on map <ExternalLink />
                </a>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Order rules</CardTitle>
          <CardDescription>All amounts compare against the item subtotal.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Minimum order (₹)" htmlFor="minOrderAmount" error={errors.minOrderAmount?.message}>
            <Input id="minOrderAmount" type="number" step="0.01" {...form.register('minOrderAmount', num)} />
          </Field>
          <Field label="Delivery charge (₹)" htmlFor="deliveryCharge" error={errors.deliveryCharge?.message}>
            <Input id="deliveryCharge" type="number" step="0.01" {...form.register('deliveryCharge', num)} />
          </Field>
          <Field
            label="Free delivery above (₹, optional)"
            htmlFor="freeDeliveryAbove"
            error={errors.freeDeliveryAbove?.message}
            hint="Leave blank to always charge delivery"
          >
            <Input id="freeDeliveryAbove" type="number" step="0.01" {...form.register('freeDeliveryAbove', num)} />
          </Field>
          <Field label="Low-stock alert at" htmlFor="lowStockThreshold" error={errors.lowStockThreshold?.message} hint="Units left">
            <Input id="lowStockThreshold" type="number" {...form.register('lowStockThreshold', num)} />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Payments</CardTitle>
          <CardDescription>At least one method must stay enabled.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <SwitchRow id="codEnabled" label="Cash on delivery">
            <Controller
              control={form.control}
              name="codEnabled"
              render={({ field }) => (
                <Switch
                  id="codEnabled"
                  checked={field.value}
                  onCheckedChange={(v) => {
                    field.onChange(v)
                    void form.trigger('codEnabled')
                  }}
                />
              )}
            />
          </SwitchRow>
          <SwitchRow id="onlinePaymentEnabled" label="Online payment (Razorpay)">
            <Controller
              control={form.control}
              name="onlinePaymentEnabled"
              render={({ field }) => <Switch id="onlinePaymentEnabled" checked={field.value} onCheckedChange={field.onChange} />}
            />
          </SwitchRow>
          {errors.codEnabled?.message && (
            <p role="alert" className="text-xs text-destructive">
              {errors.codEnabled.message}
            </p>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Razorpay key id" htmlFor="gatewayKeyId" error={errors.gatewayKeyId?.message}>
              <Input id="gatewayKeyId" autoComplete="off" placeholder="rzp_live_…" {...form.register('gatewayKeyId')} />
            </Field>
            <Field
              label="Razorpay key secret"
              htmlFor="gatewaySecret"
              error={errors.gatewaySecret?.message}
              hint={secretSet ? 'Secret is set; leave blank to keep it' : online ? 'Required for online payment' : 'Write-only'}
            >
              <Input id="gatewaySecret" type="password" autoComplete="new-password" {...form.register('gatewaySecret')} />
            </Field>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Store status</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <SwitchRow id="storeOpen" label="Store is open" description="When closed, customers can browse but not order.">
            <Controller
              control={form.control}
              name="storeOpen"
              render={({ field }) => <Switch id="storeOpen" checked={field.value} onCheckedChange={field.onChange} />}
            />
          </SwitchRow>
          {!open && (
            <Field label="Message shown while closed" htmlFor="storeClosedMessage" error={errors.storeClosedMessage?.message}>
              <Input id="storeClosedMessage" placeholder="Closed today, back tomorrow at 8 AM" {...form.register('storeClosedMessage')} />
            </Field>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => form.reset(initial)} disabled={!form.formState.isDirty}>
          Discard changes
        </Button>
        <Button type="submit" disabled={saving}>
          {saving && <Loader2 className="animate-spin" />}
          Save settings
        </Button>
      </div>
    </form>
  )
}
