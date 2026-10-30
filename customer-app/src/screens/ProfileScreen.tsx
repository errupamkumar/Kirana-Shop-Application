import { useNavigation } from '@react-navigation/native';
import { ChevronRight, LogOut, MapPin, Phone, ReceiptText, Store } from 'lucide-react-native';
import { useState } from 'react';
import { Linking, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NarrowColumn } from '../components/Screen';
import { toast } from '../components/Toast';
import { Button, Card, MenuRow } from '../components/ui';
import { useStoreConfig, useUpdateMe } from '../hooks/queries';
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
                {user?.name || 'Your account'}
              </Text>
              <Text className="text-gray-500">{user?.phone}</Text>
            </View>
          </View>

          <Card>
            <Text className="text-sm font-semibold text-gray-700">Your name</Text>
            <TextInput
              accessibilityLabel="Your name"
              value={name}
              onChangeText={setName}
              maxLength={120}
              placeholder="So the store knows who to deliver to"
              placeholderTextColor={colors.muted}
              className="mt-1 h-12 rounded-xl border border-gray-300 px-3 text-gray-900"
            />
            <Button
              title="Save name"
              variant="outline"
              className="mt-3"
              disabled={!name.trim() || name.trim() === user?.name}
              loading={update.isPending}
              onPress={() =>
                update.mutate(name.trim(), {
                  onSuccess: (me) => {
                    setUser(me);
                    toast.success('Name saved');
                  },
                  onError: (e) => showAlert('Could not save', errorMessage(e)),
                })
              }
            />
          </Card>

          <Card className="py-1">
            <MenuRow icon={ReceiptText} label="My orders" hint="Track and view past orders" onPress={() => navigation.navigate('Orders')} trailing={chevron} />
            <View className="h-px bg-gray-100" />
            <MenuRow icon={MapPin} label="Saved addresses" hint="Add or edit delivery addresses" onPress={() => navigation.navigate('Addresses')} trailing={chevron} />
          </Card>

          {config.data && (
            <Card className="py-1">
              <MenuRow icon={Store} label={config.data.storeName} hint={config.data.storeAddress} />
              <View className="h-px bg-gray-100" />
              <MenuRow
                icon={Phone}
                label="Call the store"
                hint={config.data.storePhone}
                onPress={() => void Linking.openURL(`tel:${config.data.storePhone}`)}
                trailing={chevron}
              />
              <Text className="pb-3 pt-1 text-xs text-gray-500">
                We deliver within {config.data.maxDeliveryRadiusKm} km · minimum order {formatPrice(config.data.minOrderAmount)}
                {config.data.freeDeliveryAbove != null ? ` · free delivery above ${formatPrice(config.data.freeDeliveryAbove)}` : ''}
              </Text>
            </Card>
          )}

          <Button
            title="Log out"
            variant="danger"
            icon={LogOut}
            onPress={() =>
              showAlert('Log out?', 'Your cart will be cleared.', [
                { text: 'Stay', style: 'cancel' },
                { text: 'Log out', style: 'destructive', onPress: () => void signOut() },
              ])
            }
          />
        </NarrowColumn>
      </ScrollView>
    </SafeAreaView>
  );
}
