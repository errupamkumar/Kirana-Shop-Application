import { useNavigation } from '@react-navigation/native';
import { ChevronRight, ReceiptText } from 'lucide-react-native';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NarrowColumn } from '../components/Screen';
import { Button, EmptyView, ErrorView, Skeleton } from '../components/ui';
import { useMyOrders } from '../hooks/queries';
import { errorMessage } from '../lib/api';
import { formatInr } from '../lib/money';
import { formatTime, paymentLabel, STATUS_LABEL, STATUS_TONE } from '../lib/orderStatus';
import { colors } from '../theme';

export function MyOrdersScreen() {
  const navigation = useNavigation();
  const orders = useMyOrders();
  const list = orders.data?.pages.flatMap((p) => p.content) ?? [];

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-gray-50">
      <View className="border-b border-gray-100 bg-white px-4 pb-3 pt-3">
        <NarrowColumn maxWidth={720}>
          <Text accessibilityRole="header" className="text-2xl font-extrabold text-gray-900">
            My orders
          </Text>
        </NarrowColumn>
      </View>
      {orders.error ? (
        <ErrorView message={errorMessage(orders.error)} onRetry={() => void orders.refetch()} />
      ) : orders.isLoading ? (
        <NarrowColumn maxWidth={720} className="gap-3 p-4">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </NarrowColumn>
      ) : (
        <FlatList
          data={list}
          keyExtractor={(o) => String(o.id)}
          contentContainerStyle={{ padding: 12, gap: 10, flexGrow: 1, width: '100%', maxWidth: 720, alignSelf: 'center' }}
          refreshControl={<RefreshControl refreshing={orders.isRefetching} onRefresh={() => void orders.refetch()} colors={[colors.brand]} />}
          onEndReached={() => orders.hasNextPage && !orders.isFetchingNextPage && void orders.fetchNextPage()}
          ListFooterComponent={orders.isFetchingNextPage ? <ActivityIndicator color={colors.brand} /> : undefined}
          ListEmptyComponent={
            <EmptyView
              emoji="🧾"
              title="No orders yet"
              message="When you place an order, you can follow it here."
              action={<Button title="Start shopping" onPress={() => navigation.navigate('Home')} />}
            />
          }
          renderItem={({ item }) => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Order ${item.orderNumber}, ${STATUS_LABEL[item.status]}, ${formatInr(item.total)}`}
              onPress={() => navigation.navigate('OrderDetail', { orderId: item.id })}
              className="flex-row items-center rounded-2xl border border-gray-100 bg-white p-4 active:bg-gray-50"
            >
              <View className="h-11 w-11 items-center justify-center rounded-xl bg-gray-100">
                <ReceiptText size={20} color={colors.ink} />
              </View>
              <View className="ml-3 flex-1">
                <View className="flex-row items-center justify-between">
                  <Text className="font-extrabold text-gray-900">{item.orderNumber}</Text>
                  <Text className={`overflow-hidden rounded-full px-2 py-0.5 text-[11px] font-bold ${STATUS_TONE[item.status]}`}>
                    {STATUS_LABEL[item.status]}
                  </Text>
                </View>
                <Text className="mt-1 text-gray-700">
                  {item.itemCount} {item.itemCount === 1 ? 'item' : 'items'} · <Text className="font-bold">{formatInr(item.total)}</Text>
                </Text>
                <Text className="mt-0.5 text-xs text-gray-400">
                  {formatTime(item.placedAt)} · {paymentLabel(item.status, item.paymentStatus)}
                </Text>
              </View>
              <ChevronRight size={18} color={colors.muted} style={{ marginLeft: 6 }} />
            </Pressable>
          )}
        />
      )}
    </SafeAreaView>
  );
}
