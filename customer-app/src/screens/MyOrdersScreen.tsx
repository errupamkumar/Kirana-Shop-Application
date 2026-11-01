import { useNavigation } from '@react-navigation/native';
import { ChevronRight, NotebookPen, ReceiptText } from 'lucide-react-native';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NarrowColumn } from '../components/Screen';
import { Button, EmptyView, ErrorView, Skeleton } from '../components/ui';
import { useMyOrders, useMyRequests } from '../hooks/queries';
import { useT } from '../i18n';
import { errorMessage } from '../lib/api';
import { formatInr } from '../lib/money';
import { formatTime, paymentLabel, statusLabel, STATUS_TONE } from '../lib/orderStatus';
import { colors } from '../theme';

export function MyOrdersScreen() {
  const navigation = useNavigation();
  const orders = useMyOrders();
  const requests = useMyRequests();
  const t = useT();
  const list = orders.data?.pages.flatMap((p) => p.content) ?? [];
  const requestList = requests.data?.content ?? [];
  const waiting = requestList.filter((r) => r.status === 'PENDING').length;
  const requestsBanner =
    requestList.length > 0 ? (
      <Pressable
        accessibilityRole="button"
        onPress={() => navigation.navigate('Requests')}
        className="flex-row items-center rounded-2xl border border-brand-100 bg-brand-50 p-3 active:opacity-80"
      >
        <View className="h-10 w-10 items-center justify-center rounded-xl bg-white">
          <NotebookPen size={20} color={colors.brand} />
        </View>
        <View className="ml-3 flex-1">
          <Text className="font-extrabold text-gray-900">{t('orders.requestsBanner')}</Text>
          <Text className="text-xs text-gray-600">
            {waiting > 0 ? t('orders.requestsBannerBody', { count: waiting }) : t('orders.requestsBannerNone')}
          </Text>
        </View>
        <ChevronRight size={18} color={colors.muted} />
      </Pressable>
    ) : undefined;

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-gray-50">
      <View className="border-b border-gray-100 bg-white px-4 pb-3 pt-3">
        <NarrowColumn maxWidth={720}>
          <Text accessibilityRole="header" className="text-2xl font-extrabold text-gray-900">
            {t('orders.title')}
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
          refreshControl={
            <RefreshControl
              refreshing={orders.isRefetching}
              onRefresh={() => {
                void orders.refetch();
                void requests.refetch();
              }}
              colors={[colors.brand]}
            />
          }
          ListHeaderComponent={requestsBanner}
          onEndReached={() => orders.hasNextPage && !orders.isFetchingNextPage && void orders.fetchNextPage()}
          ListFooterComponent={orders.isFetchingNextPage ? <ActivityIndicator color={colors.brand} /> : undefined}
          ListEmptyComponent={
            <EmptyView
              emoji="🧾"
              title={t('orders.emptyTitle')}
              message={t('orders.emptyBody')}
              action={<Button title={t('orders.startShopping')} onPress={() => navigation.navigate('Home')} />}
            />
          }
          renderItem={({ item }) => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('orders.a11y', { number: item.orderNumber, status: statusLabel(item.status), total: formatInr(item.total) })}
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
                    {statusLabel(item.status)}
                  </Text>
                </View>
                <Text className="mt-1 text-gray-700">
                  {item.itemCount === 1 ? t('orders.oneItem') : t('orders.items', { count: item.itemCount })} · <Text className="font-bold">{formatInr(item.total)}</Text>
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
