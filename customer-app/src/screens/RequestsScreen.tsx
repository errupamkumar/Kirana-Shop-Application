import { Camera, ChevronRight, Mic, NotebookPen } from 'lucide-react-native';
import { FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { NarrowColumn } from '../components/Screen';
import { Button, EmptyView, ErrorView, Skeleton } from '../components/ui';
import { useMyRequests } from '../hooks/queries';
import { useT } from '../i18n';
import { errorMessage } from '../lib/api';
import { formatTime, REQUEST_TONE, requestStatusLabel } from '../lib/orderStatus';
import type { AppScreenProps } from '../navigation/types';
import { colors } from '../theme';

export function RequestsScreen({ navigation }: AppScreenProps<'Requests'>) {
  const t = useT();
  const requests = useMyRequests();

  if (requests.error) return <ErrorView message={errorMessage(requests.error)} onRetry={() => void requests.refetch()} />;
  if (!requests.data) {
    return (
      <NarrowColumn maxWidth={720} className="gap-3 p-4">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </NarrowColumn>
    );
  }

  return (
    <FlatList
      className="bg-gray-50"
      data={requests.data.content}
      keyExtractor={(r) => String(r.id)}
      contentContainerStyle={{ padding: 12, gap: 10, flexGrow: 1, width: '100%', maxWidth: 720, alignSelf: 'center' }}
      refreshControl={<RefreshControl refreshing={requests.isRefetching} onRefresh={() => void requests.refetch()} colors={[colors.brand]} />}
      ListHeaderComponent={
        requests.data.content.length > 0 ? (
          <Button title={t('requests.sendNew')} icon={NotebookPen} variant="outline" onPress={() => navigation.navigate('RequestOrder')} />
        ) : undefined
      }
      ListEmptyComponent={
        <EmptyView
          emoji="📝"
          title={t('requests.emptyTitle')}
          message={t('requests.emptyBody')}
          action={<Button title={t('requests.sendNew')} icon={NotebookPen} onPress={() => navigation.navigate('RequestOrder')} />}
        />
      }
      renderItem={({ item }) => (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('requests.a11y', { id: item.id, status: requestStatusLabel(item.status) })}
          onPress={() => navigation.navigate('RequestDetail', { requestId: item.id })}
          className="flex-row items-center rounded-2xl border border-gray-100 bg-white p-4 active:bg-gray-50"
        >
          <View className="h-11 w-11 items-center justify-center rounded-xl bg-brand-50">
            {item.imageUrl ? <Camera size={20} color={colors.brand} /> : <Mic size={20} color={colors.brand} />}
          </View>
          <View className="ml-3 flex-1">
            <View className="flex-row items-center justify-between">
              <Text className="font-extrabold text-gray-900">{t('requests.item', { id: item.id })}</Text>
              <Text className={`overflow-hidden rounded-full px-2 py-0.5 text-[11px] font-bold ${REQUEST_TONE[item.status]}`}>
                {requestStatusLabel(item.status)}
              </Text>
            </View>
            <Text className="mt-1 text-gray-700">
              {[
                item.imageUrl ? t('requests.photo') : null,
                item.audioUrl ? (item.audioSeconds ? t('requests.voice', { seconds: item.audioSeconds }) : t('requests.voiceShort')) : null,
              ]
                .filter(Boolean)
                .join(' + ')}
              {item.orderNumber ? ` · ${item.orderNumber}` : ''}
            </Text>
            <Text className="mt-0.5 text-xs text-gray-400">{formatTime(item.createdAt)}</Text>
          </View>
          <ChevronRight size={18} color={colors.muted} style={{ marginLeft: 6 }} />
        </Pressable>
      )}
    />
  );
}
