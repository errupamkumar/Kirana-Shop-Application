import { useCallback, useEffect, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { Crosshair, ExternalLink, Loader2, MapPin, Search } from 'lucide-react'
import { Controller, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { t as tNow, useLang, useT } from '@/i18n'
import { mapsUrl } from '@/lib/format'
import { isShortMapsLink, parseLatLng, searchPlaces, type LatLng, type Place } from '@/lib/geo'
import { settingsSchema, toNumberOrNull, type SettingsForm as SettingsValues } from '@/lib/schemas'
import { Field } from './common'
import { LocationMap } from './LocationMap'

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
  const t = useT()
  const { errors } = form.formState
  const num = { setValueAs: toNumberOrNull }
  const online = form.watch('onlinePaymentEnabled')
  const open = form.watch('storeOpen')
  const lat = form.watch('storeLat')
  const lng = form.watch('storeLng')
  const radius = form.watch('maxDeliveryRadiusKm')
  const secretSet = form.watch('gatewaySecretSet')
  const lang = useLang()
  const [query, setQuery] = useState('')
  const [places, setPlaces] = useState<Place[] | null>(null)
  const [finding, setFinding] = useState(false)

  useEffect(() => {
    form.reset(initial)
  }, [initial, form])

  const setPoint = useCallback(
    (p: LatLng) => {
      form.setValue('storeLat', p.lat, { shouldDirty: true, shouldValidate: true })
      form.setValue('storeLng', p.lng, { shouldDirty: true, shouldValidate: true })
    },
    [form],
  )

  /** Coordinates and map links are read here; anything else is a place search. */
  async function find() {
    const text = query.trim() || form.getValues('storeAddress').trim()
    if (!text) {
      toast.error(tNow('settings.findEmpty'))
      return
    }
    const point = parseLatLng(text)
    if (point) {
      setPoint(point)
      setPlaces(null)
      toast.success(tNow('settings.pointSet'))
      return
    }
    if (isShortMapsLink(text)) {
      toast.error(tNow('settings.shortLink'), { duration: 10_000 })
      return
    }
    setFinding(true)
    try {
      setPlaces(await searchPlaces(text, lang))
    } catch {
      toast.error(tNow('settings.findFailed'))
    } finally {
      setFinding(false)
    }
  }

  function choosePlace(place: Place) {
    setPoint(place)
    setPlaces(null)
    toast.success(tNow('settings.pointSet'))
  }

  function fillCurrentLocation() {
    if (!navigator.geolocation) {
      toast.error(tNow('settings.noGeo'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPoint({ lat: Number(pos.coords.latitude.toFixed(6)), lng: Number(pos.coords.longitude.toFixed(6)) })
        // Desktop browsers usually locate by network, which can be kilometres off
        const accuracy = pos.coords.accuracy
        if (accuracy > 150) {
          const dist =
            accuracy >= 1000 ? tNow('settings.unitKm', { n: (accuracy / 1000).toFixed(1) }) : tNow('settings.unitM', { n: Math.round(accuracy) })
          toast.warning(tNow('settings.geoApprox', { dist }), { duration: 10_000 })
        } else {
          toast.success(tNow('settings.geoFilled'))
        }
      },
      () => toast.error(tNow('settings.geoFailed')),
      { enableHighAccuracy: true, timeout: 10_000 },
    )
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6" noValidate aria-label={t('settings.formLabel')}>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('settings.details')}</CardTitle>
          <CardDescription>{t('settings.detailsBody')}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label={t('settings.storeName')} htmlFor="storeName" error={errors.storeName?.message}>
            <Input id="storeName" {...form.register('storeName')} />
          </Field>
          <Field label={t('settings.phone')} htmlFor="storePhone" error={errors.storePhone?.message}>
            <Input id="storePhone" {...form.register('storePhone')} />
          </Field>
          <Field label={t('settings.address')} htmlFor="storeAddress" error={errors.storeAddress?.message} className="sm:col-span-2">
            <Textarea id="storeAddress" rows={2} {...form.register('storeAddress')} />
          </Field>
          <Field label={t('settings.gstin')} htmlFor="gstin" error={errors.gstin?.message}>
            <Input id="gstin" {...form.register('gstin')} />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('settings.location')}</CardTitle>
          <CardDescription>{t('settings.locationBody')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="placeSearch" className="text-sm font-medium">
              {t('settings.findLabel')}
            </label>
            <div className="flex gap-2">
              <Input
                id="placeSearch"
                value={query}
                autoComplete="off"
                placeholder={t('settings.findPlaceholder')}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  // Enter searches instead of saving the whole form
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    void find()
                  }
                }}
              />
              <Button type="button" variant="secondary" onClick={() => void find()} disabled={finding}>
                {finding ? <Loader2 className="animate-spin" /> : <Search />} {t('settings.find')}
              </Button>
            </div>
            {places &&
              (places.length === 0 ? (
                <p role="status" className="text-xs text-muted-foreground">
                  {t('settings.noResults')}
                </p>
              ) : (
                <ul aria-label={t('settings.results')} className="divide-y rounded-md border">
                  {places.map((p) => (
                    <li key={`${p.lat},${p.lng}`}>
                      <button
                        type="button"
                        onClick={() => choosePlace(p)}
                        className="flex w-full items-start gap-2 px-3 py-2 text-left text-sm hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
                      >
                        <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                        <span>{p.name}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ))}
          </div>
          <LocationMap
            lat={Number.isFinite(lat) ? lat : null}
            lng={Number.isFinite(lng) ? lng : null}
            radiusKm={Number.isFinite(radius) ? radius : null}
            onPick={setPoint}
            label={t('settings.mapLabel')}
          />
          <p className="text-xs text-muted-foreground">{t('settings.mapHint')}</p>
          <div className="grid gap-4 sm:grid-cols-3">
          <Field label={t('settings.latitude')} htmlFor="storeLat" error={errors.storeLat?.message}>
            <Input id="storeLat" type="number" step="0.000001" {...form.register('storeLat', num)} />
          </Field>
          <Field label={t('settings.longitude')} htmlFor="storeLng" error={errors.storeLng?.message}>
            <Input id="storeLng" type="number" step="0.000001" {...form.register('storeLng', num)} />
          </Field>
          <Field label={t('settings.radius')} htmlFor="maxDeliveryRadiusKm" error={errors.maxDeliveryRadiusKm?.message} hint={t('settings.radiusHint')}>
            <Input id="maxDeliveryRadiusKm" type="number" step="0.1" {...form.register('maxDeliveryRadiusKm', num)} />
          </Field>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={fillCurrentLocation}>
              <Crosshair /> {t('settings.useLocation')}
            </Button>
            {Number.isFinite(lat) && Number.isFinite(lng) && (
              <Button type="button" variant="ghost" size="sm" asChild>
                <a href={mapsUrl(lat, lng)} target="_blank" rel="noreferrer">
                  {t('settings.preview')} <ExternalLink />
                </a>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('settings.rules')}</CardTitle>
          <CardDescription>{t('settings.rulesBody')}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label={t('settings.minOrder')} htmlFor="minOrderAmount" error={errors.minOrderAmount?.message}>
            <Input id="minOrderAmount" type="number" step="0.01" {...form.register('minOrderAmount', num)} />
          </Field>
          <Field label={t('settings.deliveryCharge')} htmlFor="deliveryCharge" error={errors.deliveryCharge?.message}>
            <Input id="deliveryCharge" type="number" step="0.01" {...form.register('deliveryCharge', num)} />
          </Field>
          <Field
            label={t('settings.freeAbove')}
            htmlFor="freeDeliveryAbove"
            error={errors.freeDeliveryAbove?.message}
            hint={t('settings.freeAboveHint')}
          >
            <Input id="freeDeliveryAbove" type="number" step="0.01" {...form.register('freeDeliveryAbove', num)} />
          </Field>
          <Field label={t('settings.lowStock')} htmlFor="lowStockThreshold" error={errors.lowStockThreshold?.message} hint={t('settings.lowStockHint')}>
            <Input id="lowStockThreshold" type="number" {...form.register('lowStockThreshold', num)} />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('settings.payments')}</CardTitle>
          <CardDescription>{t('settings.paymentsBody')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <SwitchRow id="codEnabled" label={t('settings.cod')}>
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
          <SwitchRow id="onlinePaymentEnabled" label={t('settings.online')}>
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
            <Field label={t('settings.keyId')} htmlFor="gatewayKeyId" error={errors.gatewayKeyId?.message}>
              <Input id="gatewayKeyId" autoComplete="off" placeholder="rzp_live_…" {...form.register('gatewayKeyId')} />
            </Field>
            <Field
              label={t('settings.keySecret')}
              htmlFor="gatewaySecret"
              error={errors.gatewaySecret?.message}
              hint={secretSet ? t('settings.secretSet') : online ? t('settings.secretRequired') : t('settings.writeOnly')}
            >
              <Input id="gatewaySecret" type="password" autoComplete="new-password" {...form.register('gatewaySecret')} />
            </Field>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('settings.status')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <SwitchRow id="storeOpen" label={t('settings.open')} description={t('settings.openBody')}>
            <Controller
              control={form.control}
              name="storeOpen"
              render={({ field }) => <Switch id="storeOpen" checked={field.value} onCheckedChange={field.onChange} />}
            />
          </SwitchRow>
          {!open && (
            <Field label={t('settings.closedMessage')} htmlFor="storeClosedMessage" error={errors.storeClosedMessage?.message}>
              <Input id="storeClosedMessage" placeholder={t('settings.closedPlaceholder')} {...form.register('storeClosedMessage')} />
            </Field>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => form.reset(initial)} disabled={!form.formState.isDirty}>
          {t('settings.discard')}
        </Button>
        <Button type="submit" disabled={saving}>
          {saving && <Loader2 className="animate-spin" />}
          {t('settings.save')}
        </Button>
      </div>
    </form>
  )
}
