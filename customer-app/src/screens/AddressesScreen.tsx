import { Briefcase, CircleCheck, House, MapPin, Pencil, Plus, Trash2 } from 'lucide-react-native';
import { FlatList, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NarrowColumn } from '../components/Screen';
import { toast } from '../components/Toast';
import { Button, EmptyView, ErrorView, Skeleton } from '../components/ui';
import { useAddresses, useDeleteAddress } from '../hooks/queries';
import { errorMessage } from '../lib/api';
import { showAlert } from '../lib/dialog';
import type { AppScreenProps } from '../navigation/types';
import { useCheckoutStore } from '../store/session';
import { colors } from '../theme';

const LABEL_ICON: Record<string, typeof House> = { Home: House, Work: Briefcase };

export function AddressesScreen({ navigation, route }: AppScreenProps<'Addresses'>) {
  const select = route.params?.select === true || String(route.params?.select) === 'true';
  const insets = useSafeAreaInsets();
  const addresses = useAddresses();
  const remove = useDeleteAddress();
  const { addressId, setAddressId } = useCheckoutStore();

  function confirmDelete(id: number, label: string) {
    showAlert(`Delete "${label}" address?`, undefined, [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () =>
          remove.mutate(id, {
            onSuccess: () => {
              if (addressId === id) setAddressId(null);
              toast.success('Address deleted');
            },
            onError: (e) => showAlert('Could not delete', errorMessage(e)),
          }),
      },
    ]);
  }

  if (addresses.error) return <ErrorView message={errorMessage(addresses.error)} onRetry={() => void addresses.refetch()} />;
  if (!addresses.data) {
    return (
      <NarrowColumn className="gap-3 p-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </NarrowColumn>
    );
  }

  return (
    <View className="flex-1 bg-gray-50">
      <FlatList
        data={addresses.data}
        keyExtractor={(a) => String(a.id)}
        contentContainerStyle={{ padding: 12, gap: 10, paddingBottom: 110, flexGrow: 1, width: '100%', maxWidth: 560, alignSelf: 'center' }}
        ListHeaderComponent={
          select && addresses.data.length > 0 ? <Text className="mb-1 px-1 text-sm text-gray-500">Choose where to deliver this order</Text> : undefined
        }
        ListEmptyComponent={
          <EmptyView emoji="🏠" title="No saved addresses" message="Add one so we can check delivery and bring your order to the right door." />
        }
        renderItem={({ item }) => {
          const selected = select && item.id === addressId;
          const Icon = LABEL_ICON[item.label] ?? MapPin;
          return (
            <Pressable
              accessibilityRole={select ? 'radio' : 'button'}
              accessibilityState={select ? { checked: selected } : undefined}
              accessibilityLabel={`${item.label}, ${item.line1}`}
              onPress={() => {
                if (select) {
                  setAddressId(item.id);
                  if (navigation.canGoBack()) navigation.goBack();
                  else navigation.navigate('Tabs');
                } else {
                  navigation.navigate('AddressForm', { addressId: item.id });
                }
              }}
              className={`flex-row rounded-2xl border-2 bg-white p-4 ${selected ? 'border-brand-500' : 'border-transparent'}`}
            >
              <View className="h-10 w-10 items-center justify-center rounded-xl bg-gray-100">
                <Icon size={20} color={colors.ink} />
              </View>
              <View className="ml-3 flex-1">
                <View className="flex-row items-center">
                  <Text className="font-extrabold text-gray-900">{item.label}</Text>
                  {item.isDefault && (
                    <Text className="ml-2 overflow-hidden rounded-md bg-gray-100 px-1.5 py-0.5 text-[10px] font-bold text-gray-600">DEFAULT</Text>
                  )}
                  {selected && <CircleCheck size={16} color={colors.brand} style={{ marginLeft: 6 }} />}
                </View>
                <Text className="mt-1 text-gray-700">
                  {item.line1}
                  {item.line2 ? `, ${item.line2}` : ''}
                </Text>
                {item.landmark && <Text className="text-xs text-gray-500">Near {item.landmark}</Text>}
                <Text className="text-xs text-gray-500">PIN {item.pincode}</Text>
                <View className="mt-3 flex-row gap-5">
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Edit ${item.label}`}
                    hitSlop={8}
                    onPress={() => navigation.navigate('AddressForm', { addressId: item.id })}
                    className="flex-row items-center"
                  >
                    <Pencil size={14} color={colors.brandDark} />
                    <Text className="ml-1 font-bold text-brand-600">Edit</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Delete ${item.label}`}
                    hitSlop={8}
                    onPress={() => confirmDelete(item.id, item.label)}
                    className="flex-row items-center"
                  >
                    <Trash2 size={14} color={colors.danger} />
                    <Text className="ml-1 font-bold text-danger">Delete</Text>
                  </Pressable>
                </View>
              </View>
            </Pressable>
          );
        }}
      />
      <View className="absolute bottom-0 left-0 right-0 border-t border-gray-100 bg-white px-4 pt-3" style={{ paddingBottom: Math.max(insets.bottom, 12) }}>
        <NarrowColumn>
          <Button title="Add new address" variant="outline" icon={Plus} onPress={() => navigation.navigate('AddressForm')} />
        </NarrowColumn>
      </View>
    </View>
  );
}
