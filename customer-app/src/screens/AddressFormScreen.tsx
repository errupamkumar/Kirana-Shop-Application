import * as Location from 'expo-location';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, CircleAlert, CircleCheck, ExternalLink, LocateFixed } from 'lucide-react-native';
import { useEffect, useLayoutEffect, useState } from 'react';
import { KeyboardAvoidingView, Linking, Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import { NarrowColumn } from '../components/Screen';
import { toast } from '../components/Toast';
import { Button, Card, ErrorView, SectionTitle, Skeleton } from '../components/ui';
import { useAddresses, useSaveAddress } from '../hooks/queries';
import { checkServiceability, currentCoords } from '../hooks/useServiceability';
import { apiError, errorMessage } from '../lib/api';
import { showAlert } from '../lib/dialog';
import type { Address, LocationCheck } from '../lib/types';
import type { AppScreenProps } from '../navigation/types';
import { useCheckoutStore } from '../store/session';
import { colors } from '../theme';

const LABELS = ['Home', 'Work', 'Other'];
/** ~11 m at the equator: small enough to fine-tune the pin. */
const NUDGE = 0.0001;

function Input({ label, error, ...props }: React.ComponentProps<typeof TextInput> & { label: string; error?: string }) {
  return (
    <View className="mb-3">
      <Text className="mb-1 text-sm font-semibold text-gray-700">{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.muted}
        className={`h-12 rounded-xl border px-3 text-gray-900 ${error ? 'border-danger' : 'border-gray-300'}`}
        {...props}
      />
      {error && <Text className="mt-1 text-xs text-danger">{error}</Text>}
    </View>
  );
}

function AddressForm({ existing, onSaved }: { existing?: Address; onSaved: () => void }) {
  const save = useSaveAddress();
  const setAddressId = useCheckoutStore((s) => s.setAddressId);
  const [label, setLabel] = useState(existing?.label ?? 'Home');
  const [line1, setLine1] = useState(existing?.line1 ?? '');
  const [line2, setLine2] = useState(existing?.line2 ?? '');
  const [landmark, setLandmark] = useState(existing?.landmark ?? '');
  const [pincode, setPincode] = useState(existing?.pincode ?? '');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(existing ? { lat: existing.lat, lng: existing.lng } : null);
  const [isDefault, setIsDefault] = useState(existing?.isDefault ?? false);
  const [locating, setLocating] = useState(false);
  const [check, setCheck] = useState<LocationCheck | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [manual, setManual] = useState(false);
  const [latText, setLatText] = useState(existing ? String(existing.lat) : '');
  const [lngText, setLngText] = useState(existing ? String(existing.lng) : '');

  /** Manual entry for customers who keep location off: paste the numbers from Google Maps. */
  function setManualCoords(latValue: string, lngValue: string) {
    setLatText(latValue);
    setLngText(lngValue);
    const lat = Number(latValue);
    const lng = Number(lngValue);
    const valid = latValue.trim() !== '' && lngValue.trim() !== '' && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
    setCoords(valid ? { lat: Number(lat.toFixed(6)), lng: Number(lng.toFixed(6)) } : null);
  }

  // Show whether the pinned point is inside the delivery radius
  useEffect(() => {
    if (!coords) return;
    const timer = setTimeout(() => {
      checkServiceability(coords.lat, coords.lng).then(setCheck).catch(() => setCheck(null));
    }, 300);
    return () => clearTimeout(timer);
  }, [coords]);

  async function fillFromGps() {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      showAlert('Location permission needed', 'Allow location to pin your address automatically, or enter the coordinates manually.');
      setManual(true);
      return;
    }
    setLocating(true);
    try {
      const found = await currentCoords();
      setCoords(found);
      setLatText(String(found.lat));
      setLngText(String(found.lng));
    } catch {
      showAlert('Could not get your location', 'Please try again, or enter the coordinates manually.');
      setManual(true);
    } finally {
      setLocating(false);
    }
  }

  function nudge(dLat: number, dLng: number) {
    if (!coords) return;
    const moved = { lat: Number((coords.lat + dLat).toFixed(6)), lng: Number((coords.lng + dLng).toFixed(6)) };
    setCoords(moved);
    setLatText(String(moved.lat));
    setLngText(String(moved.lng));
  }

  function submit() {
    const next: Record<string, string> = {};
    if (!line1.trim()) next.line1 = 'Required';
    if (!/^[1-9]\d{5}$/.test(pincode)) next.pincode = 'Enter a 6 digit PIN code';
    if (!coords) next.location = 'Pin the location with "Use current location" or enter coordinates';
    setErrors(next);
    if (Object.keys(next).length > 0 || !coords) return;
    save.mutate(
      {
        id: existing?.id,
        body: { label, line1: line1.trim(), line2: line2.trim() || null, landmark: landmark.trim() || null, pincode, lat: coords.lat, lng: coords.lng, isDefault },
      },
      {
        onSuccess: (saved) => {
          setAddressId(saved.id);
          toast.success(existing ? 'Address updated' : 'Address saved');
          onSaved();
        },
        onError: (e) => {
          const details = apiError(e)?.details as Record<string, string> | undefined;
          if (details) setErrors(details);
          showAlert('Could not save address', errorMessage(e));
        },
      },
    );
  }

  const nudges: [string, number, number, typeof ArrowUp][] = [
    ['North', NUDGE, 0, ArrowUp],
    ['South', -NUDGE, 0, ArrowDown],
    ['East', 0, NUDGE, ArrowRight],
    ['West', 0, -NUDGE, ArrowLeft],
  ];

  return (
    <KeyboardAvoidingView behavior="padding" className="flex-1">
      <ScrollView className="flex-1 bg-gray-50" contentContainerStyle={{ padding: 12, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <NarrowColumn className="gap-3">
          <Card>
            <SectionTitle title="Delivery location" icon={LocateFixed} />
            <Button
              title={locating ? 'Locating…' : coords ? 'Use current location again' : 'Use current location'}
              variant="outline"
              icon={LocateFixed}
              loading={locating}
              onPress={() => void fillFromGps()}
            />
            {coords && (
              <View className="mt-3">
                <Text className="text-xs text-gray-500">
                  Pinned at {coords.lat.toFixed(6)}, {coords.lng.toFixed(6)}
                </Text>
                <Text className="mt-2 text-xs text-gray-600">Adjust the pin if it is slightly off (about 11 m per tap):</Text>
                <View className="mt-1.5 flex-row flex-wrap gap-2">
                  {nudges.map(([name, dLat, dLng, Icon]) => (
                    <Pressable
                      key={name}
                      accessibilityRole="button"
                      accessibilityLabel={`Move pin ${name}`}
                      onPress={() => nudge(dLat, dLng)}
                      className="flex-row items-center rounded-lg border border-gray-300 px-2.5 py-1.5 active:bg-gray-100"
                    >
                      <Icon size={14} color={colors.inkSoft} />
                      <Text className="ml-1 text-xs font-semibold text-gray-700">{name}</Text>
                    </Pressable>
                  ))}
                  <Pressable
                    accessibilityRole="link"
                    onPress={() => void Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${coords.lat},${coords.lng}`)}
                    className="flex-row items-center rounded-lg px-2.5 py-1.5"
                  >
                    <Text className="text-xs font-bold text-brand-600">Check on map</Text>
                    <ExternalLink size={12} color={colors.brandDark} style={{ marginLeft: 4 }} />
                  </Pressable>
                </View>
                {check && (
                  <View className={`mt-3 flex-row items-center rounded-xl p-2.5 ${check.serviceable ? 'bg-brand-50' : 'bg-red-50'}`}>
                    {check.serviceable ? <CircleCheck size={16} color={colors.brand} /> : <CircleAlert size={16} color={colors.danger} />}
                    <Text className={`ml-2 flex-1 text-sm font-semibold ${check.serviceable ? 'text-brand-700' : 'text-danger'}`}>
                      {check.serviceable
                        ? `We deliver here (${check.distanceKm} km from the store)`
                        : `We don't deliver here yet (${check.distanceKm} km away, we deliver within ${check.radiusKm} km)`}
                    </Text>
                  </View>
                )}
              </View>
            )}
            <Pressable accessibilityRole="button" onPress={() => setManual((m) => !m)} className="mt-3 self-start" hitSlop={6}>
              <Text className="text-sm font-bold text-brand-600">{manual ? 'Hide manual entry' : 'Location off? Enter coordinates manually'}</Text>
            </Pressable>
            {manual && (
              <View className="mt-2">
                <Text className="mb-2 text-xs text-gray-600">
                  In Google Maps, long-press your building and copy the two numbers shown (latitude, longitude).
                </Text>
                <View className="flex-row gap-2">
                  <TextInput
                    accessibilityLabel="Latitude"
                    value={latText}
                    onChangeText={(t) => setManualCoords(t, lngText)}
                    keyboardType="numbers-and-punctuation"
                    placeholder="Latitude e.g. 12.9716"
                    placeholderTextColor={colors.muted}
                    className="h-11 flex-1 rounded-xl border border-gray-300 px-3 text-gray-900"
                  />
                  <TextInput
                    accessibilityLabel="Longitude"
                    value={lngText}
                    onChangeText={(t) => setManualCoords(latText, t)}
                    keyboardType="numbers-and-punctuation"
                    placeholder="Longitude e.g. 77.5946"
                    placeholderTextColor={colors.muted}
                    className="h-11 flex-1 rounded-xl border border-gray-300 px-3 text-gray-900"
                  />
                </View>
              </View>
            )}
            {errors.location && <Text className="mt-2 text-xs text-danger">{errors.location}</Text>}
          </Card>

          <Card>
            <Text className="mb-2 text-sm font-semibold text-gray-700">Save as</Text>
            <View className="mb-4 flex-row gap-2">
              {LABELS.map((l) => (
                <Pressable
                  key={l}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: label === l }}
                  onPress={() => setLabel(l)}
                  className={`rounded-full border px-4 py-1.5 ${label === l ? 'border-brand-500 bg-brand-50' : 'border-gray-300 active:bg-gray-100'}`}
                >
                  <Text className={label === l ? 'font-bold text-brand-700' : 'text-gray-700'}>{l}</Text>
                </Pressable>
              ))}
            </View>
            <Input label="House / flat / floor, building" value={line1} onChangeText={setLine1} maxLength={200} error={errors.line1} placeholder="e.g. Flat 12, Lake View Apartments" />
            <Input label="Area, street (optional)" value={line2} onChangeText={setLine2} maxLength={200} />
            <Input label="Landmark (optional)" value={landmark} onChangeText={setLandmark} maxLength={120} placeholder="e.g. Opposite the temple" />
            <Input
              label="PIN code"
              value={pincode}
              onChangeText={(t) => setPincode(t.replace(/\D/g, '').slice(0, 6))}
              keyboardType="number-pad"
              maxLength={6}
              error={errors.pincode}
            />
            <View className="flex-row items-center justify-between pt-1">
              <Text className="text-gray-700">Make this my default address</Text>
              <Switch accessibilityLabel="Default address" value={isDefault} onValueChange={setIsDefault} trackColor={{ true: colors.brand }} />
            </View>
          </Card>

          <Button title={existing ? 'Save changes' : 'Save address'} loading={save.isPending} onPress={submit} />
        </NarrowColumn>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

export function AddressFormScreen({ navigation, route }: AppScreenProps<'AddressForm'>) {
  const addressId = route.params?.addressId != null ? Number(route.params.addressId) : undefined;
  const addresses = useAddresses();
  const existing = addressId != null ? addresses.data?.find((a) => a.id === addressId) : undefined;

  useLayoutEffect(() => {
    navigation.setOptions({ title: addressId != null ? 'Edit address' : 'Add address' });
  }, [navigation, addressId]);

  if (addressId != null && !existing) {
    if (addresses.error) return <ErrorView message={errorMessage(addresses.error)} onRetry={() => void addresses.refetch()} />;
    if (addresses.data) return <ErrorView message="This address no longer exists." />;
    return (
      <View className="gap-3 p-4">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-72 w-full" />
      </View>
    );
  }

  return (
    <AddressForm
      key={existing?.id ?? 'new'}
      existing={existing}
      onSaved={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Addresses'))}
    />
  );
}
