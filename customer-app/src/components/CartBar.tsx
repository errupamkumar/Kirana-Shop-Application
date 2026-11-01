import { useNavigation } from '@react-navigation/native';
import { ChevronRight, ShoppingBag } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MAX_CONTENT_WIDTH } from '../hooks/useLayout';
import { useT } from '../i18n';
import { formatPrice } from '../lib/money';
import { useItemCount, useItemSubtotal } from '../store/cart';
import { colors } from '../theme';

/** Floating bottom bar with item count and subtotal; hidden when the cart is empty. */
export function CartBar({ bottomOffset = 0 }: { bottomOffset?: number }) {
  const navigation = useNavigation();
  const count = useItemCount();
  const subtotal = useItemSubtotal();
  const insets = useSafeAreaInsets();
  const t = useT();
  if (count === 0) return null;

  return (
    <View pointerEvents="box-none" className="absolute left-0 right-0 items-center px-3" style={{ bottom: bottomOffset + Math.max(insets.bottom, 10) }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('cartBar.a11y', { count, total: formatPrice(subtotal) })}
        onPress={() => navigation.navigate('Cart')}
        className="w-full flex-row items-center justify-between rounded-2xl bg-brand-500 px-4 py-3 active:bg-brand-600"
        style={{ maxWidth: Math.min(MAX_CONTENT_WIDTH, 560), elevation: 6, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } }}
      >
        <View className="flex-row items-center">
          <View className="mr-3 h-10 w-10 items-center justify-center rounded-xl bg-white/20">
            <ShoppingBag size={20} color={colors.white} />
          </View>
          <View>
            <Text className="text-xs font-semibold text-white/90">
              {count === 1 ? t('cartBar.oneItem') : t('cartBar.items', { count })}
            </Text>
            <Text className="text-base font-extrabold text-white">{formatPrice(subtotal)}</Text>
          </View>
        </View>
        <View className="flex-row items-center">
          <Text className="text-base font-bold text-white">{t('cartBar.view')}</Text>
          <ChevronRight size={20} color={colors.white} />
        </View>
      </Pressable>
    </View>
  );
}
