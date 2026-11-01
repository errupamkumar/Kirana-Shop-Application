import { CircleCheck, PackageSearch, ShoppingBasket } from 'lucide-react-native';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NarrowColumn } from '../components/Screen';
import { Button } from '../components/ui';
import { useT } from '../i18n';
import type { AppScreenProps } from '../navigation/types';
import { colors } from '../theme';

export function OrderSuccessScreen({ navigation, route }: AppScreenProps<'OrderSuccess'>) {
  const orderId = Number(route.params?.orderId);
  const orderNumber = route.params?.orderNumber;
  const t = useT();
  return (
    <SafeAreaView className="flex-1 items-center justify-center bg-white p-6">
      <NarrowColumn maxWidth={420} className="items-center">
        <View className="h-28 w-28 items-center justify-center rounded-full bg-brand-50">
          <View className="h-20 w-20 items-center justify-center rounded-full bg-brand-500">
            <CircleCheck size={44} color={colors.white} />
          </View>
        </View>
        <Text accessibilityRole="header" className="mt-6 text-2xl font-extrabold text-gray-900">
          {t('success.title')}
        </Text>
        {orderNumber && <Text className="mt-2 font-semibold text-gray-700">{t('success.number', { number: orderNumber })}</Text>}
        <Text className="mt-2 text-center text-gray-500">
          {t('success.body')}
        </Text>
        <View className="mt-10 w-full gap-3">
          <Button title={t('success.track')} icon={PackageSearch} onPress={() => navigation.replace('OrderDetail', { orderId })} />
          <Button title={t('success.continue')} icon={ShoppingBasket} variant="outline" onPress={() => navigation.navigate('Tabs')} />
        </View>
      </NarrowColumn>
    </SafeAreaView>
  );
}
