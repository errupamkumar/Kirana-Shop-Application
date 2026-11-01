import { useNavigation } from '@react-navigation/native';
import { ChevronRight, LogOut, MapPin, NotebookPen, Phone, ReceiptText, Store } from 'lucide-react-native';
import { useState } from 'react';
import { Linking, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LanguageToggle } from '../components/LanguageToggle';
import { NarrowColumn } from '../components/Screen';
import { toast } from '../components/Toast';
import { Button, Card, MenuRow } from '../components/ui';
import { useStoreConfig, useUpdateMe } from '../hooks/queries';
import { t as tNow, useT } from '../i18n';
import { errorMessage } from '../lib/api';
import { showAlert } from '../lib/dialog';
import { formatPrice } from '../lib/money';
import { useAuthStore } from '../store/session';
import { colors } from '../theme';

export function ProfileScreen() {
  const navigation = useNavigation();
  const { user, setUser, signOut } = useAuthStore();
  const config = useStoreConfig();
  const update = useUpdateMe();
  const t = useT();
  const [name, setName] = useState(user?.name ?? '');
  const initial = (user?.name?.trim()?.[0] ?? '🙂').toUpperCase();
  const chevron = <ChevronRight size={18} color={colors.muted} />;

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-gray-50">
      <ScrollView contentContainerStyle={{ padding: 12, paddingBottom: 40 }}>
        <NarrowColumn className="gap-3">
          <View className="flex-row items-center px-1 pb-1 pt-2">
            <View className="h-14 w-14 items-center justify-center rounded-full bg-accent">
              <Text className="text-2xl font-extrabold text-gray-900">{initial}</Text>
            </View>
            <View className="ml-3">
              <Text accessibilityRole="header" className="text-xl font-extrabold text-gray-900">
                {user?.name || t('account.title')}
              </Text>
              <Text className="text-gray-500">{user?.phone}</Text>
            </View>
          </View>

          <Card className="flex-row items-center justify-between">
            <Text className="font-semibold text-gray-800">{t('common.language')}</Text>
            <LanguageToggle compact />
          </Card>

          <Card>
            <Text className="text-sm font-semibold text-gray-700">{t('account.nameLabel')}</Text>
            <TextInput
              accessibilityLabel={t('account.nameLabel')}
              value={name}
              onChangeText={setName}
              maxLength={120}
              placeholder={t('account.namePlaceholder')}
              placeholderTextColor={colors.muted}
              className="mt-1 h-12 rounded-xl border border-gray-300 px-3 text-gray-900"
            />
            <Button
              title={t('account.saveName')}
              variant="outline"
              className="mt-3"
              disabled={!name.trim() || name.trim() === user?.name}
              loading={update.isPending}
              onPress={() =>
                update.mutate(name.trim(), {
                  onSuccess: (me) => {
                    setUser(me);
                    toast.success(tNow('account.nameSaved'));
                  },
                  onError: (e) => showAlert(tNow('account.couldNotSave'), errorMessage(e)),
                })
              }
            />
          </Card>

          <Card className="py-1">
            <MenuRow icon={ReceiptText} label={t('account.myOrders')} hint={t('account.myOrdersHint')} onPress={() => navigation.navigate('Orders')} trailing={chevron} />
            <View className="h-px bg-gray-100" />
            <MenuRow icon={NotebookPen} label={t('account.myRequests')} hint={t('account.myRequestsHint')} onPress={() => navigation.navigate('Requests')} trailing={chevron} />
            <View className="h-px bg-gray-100" />
            <MenuRow icon={MapPin} label={t('account.addresses')} hint={t('account.addressesHint')} onPress={() => navigation.navigate('Addresses')} trailing={chevron} />
          </Card>

          {config.data && (
            <Card className="py-1">
              <MenuRow icon={Store} label={config.data.storeName} hint={config.data.storeAddress} />
              <View className="h-px bg-gray-100" />
              <MenuRow
                icon={Phone}
                label={t('account.callStore')}
                hint={config.data.storePhone}
                onPress={() => void Linking.openURL(`tel:${config.data.storePhone}`)}
                trailing={chevron}
              />
              <Text className="pb-3 pt-1 text-xs text-gray-500">
                {t('account.rules', { km: config.data.maxDeliveryRadiusKm, min: formatPrice(config.data.minOrderAmount) })}
                {config.data.freeDeliveryAbove != null ? t('account.rulesFree', { amount: formatPrice(config.data.freeDeliveryAbove) }) : ''}
              </Text>
            </Card>
          )}

          <Button
            title={t('account.logout')}
            variant="danger"
            icon={LogOut}
            onPress={() =>
              showAlert(tNow('account.logoutTitle'), tNow('account.logoutBody'), [
                { text: tNow('account.stay'), style: 'cancel' },
                { text: tNow('account.logout'), style: 'destructive', onPress: () => void signOut() },
              ])
            }
          />
        </NarrowColumn>
      </ScrollView>
    </SafeAreaView>
  );
}
