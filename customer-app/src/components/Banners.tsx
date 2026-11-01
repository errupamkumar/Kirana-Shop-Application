import { useNavigation } from '@react-navigation/native';
import { CircleCheck, Clock, MapPin, MapPinOff, RefreshCw } from 'lucide-react-native';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useServiceability } from '../hooks/useServiceability';
import { useT } from '../i18n';
import type { StoreConfig } from '../lib/types';
import { colors } from '../theme';

/** Green "Delivering to you" / red "We don't deliver here yet" based on live GPS. */
export function ServiceabilityBanner() {
  const navigation = useNavigation();
  const { status, check, request, refresh } = useServiceability();
  const t = useT();

  if (status === 'needsPermission' || status === 'unknown') {
    return (
      <View className="mt-3 flex-row items-center rounded-2xl border border-amber-200 bg-amber-50 p-3">
        <View className="h-10 w-10 items-center justify-center rounded-full bg-amber-100">
          <MapPin size={20} color="#b45309" />
        </View>
        <View className="ml-3 flex-1">
          <Text className="font-bold text-gray-900">{t('banner.checkTitle')}</Text>
          <Text className="text-xs text-gray-600">{t('banner.checkBody')}</Text>
        </View>
        <Pressable accessibilityRole="button" onPress={() => void request()} className="ml-2 rounded-lg bg-brand-500 px-3 py-2 active:bg-brand-600">
          <Text className="font-bold text-white">{t('banner.allow')}</Text>
        </Pressable>
      </View>
    );
  }
  if (status === 'denied' || status === 'error') {
    return (
      <Pressable
        accessibilityRole="button"
        onPress={() => (status === 'error' ? void refresh() : navigation.navigate('Addresses', { select: true }))}
        className="mt-3 flex-row items-center rounded-2xl bg-gray-100 p-3 active:opacity-70"
      >
        <View className="h-10 w-10 items-center justify-center rounded-full bg-white">
          {status === 'error' ? <RefreshCw size={18} color={colors.inkSoft} /> : <MapPinOff size={18} color={colors.inkSoft} />}
        </View>
        <View className="ml-3 flex-1">
          <Text className="font-bold text-gray-900">{status === 'error' ? t('banner.errorTitle') : t('banner.offTitle')}</Text>
          <Text className="text-xs text-gray-600">
            {status === 'error' ? t('banner.errorBody') : t('banner.offBody')}
          </Text>
        </View>
      </Pressable>
    );
  }
  if (status === 'locating' || !check) {
    return (
      <View className="mt-3 flex-row items-center rounded-2xl bg-gray-100 p-3">
        <ActivityIndicator color={colors.brand} />
        <Text className="ml-3 text-gray-700">{t('banner.checking')}</Text>
      </View>
    );
  }
  return check.serviceable ? (
    <View accessibilityRole="summary" className="mt-3 flex-row items-center rounded-2xl bg-brand-50 p-3">
      <CircleCheck size={22} color={colors.brand} />
      <View className="ml-3">
        <Text className="font-bold text-brand-700">{t('banner.delivering')}</Text>
        <Text className="text-xs text-brand-700">{t('banner.distance', { km: check.distanceKm })}</Text>
      </View>
    </View>
  ) : (
    <View accessibilityRole="alert" className="mt-3 flex-row items-center rounded-2xl bg-red-50 p-3">
      <MapPinOff size={22} color={colors.danger} />
      <View className="ml-3 flex-1">
        <Text className="font-bold text-danger">{t('banner.notDelivering')}</Text>
        <Text className="text-xs text-danger">
          {t('banner.outside', { km: check.distanceKm, radius: check.radiusKm })}
        </Text>
      </View>
    </View>
  );
}

export function StoreClosedBanner({ config }: { config: StoreConfig | undefined }) {
  const t = useT();
  if (!config || config.storeOpen) return null;
  return (
    <View accessibilityRole="alert" className="mt-3 flex-row items-center rounded-2xl bg-gray-900 p-3">
      <Clock size={22} color={colors.accent} />
      <View className="ml-3 flex-1">
        <Text className="font-bold text-white">{t('banner.closedTitle')}</Text>
        <Text className="mt-0.5 text-xs text-gray-300">{config.storeClosedMessage ?? t('banner.closedBody')}</Text>
      </View>
    </View>
  );
}
