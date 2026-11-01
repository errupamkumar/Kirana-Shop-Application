import { Image } from 'expo-image';
import { CircleCheck, CircleX, Clock, MapPin, Mic, NotebookPen, ReceiptText, XCircle } from 'lucide-react-native';
import { useLayoutEffect } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { NarrowColumn } from '../components/Screen';
import { toast } from '../components/Toast';
import { Button, Card, ErrorView, SectionTitle, Skeleton } from '../components/ui';
import { VoiceNotePlayer } from '../components/VoiceNote';
import { useCancelRequest, useRequest } from '../hooks/queries';
import { addressLabel, t as tNow, useT } from '../i18n';
import { errorMessage } from '../lib/api';
import { showAlert } from '../lib/dialog';
import { mediaUrl } from '../lib/env';
import { formatInr } from '../lib/money';
import { formatTime, REQUEST_TONE, requestStatusLabel, statusLabel } from '../lib/orderStatus';
import type { AppScreenProps } from '../navigation/types';
import { colors } from '../theme';

export function RequestDetailScreen({ navigation, route }: AppScreenProps<'RequestDetail'>) {
  const t = useT();
  const requestId = Number(route.params?.requestId);
  const request = useRequest(requestId);
  const cancel = useCancelRequest();

  useLayoutEffect(() => {
    navigation.setOptions({ title: t('requests.item', { id: requestId }) });
  }, [navigation, requestId, t]);

  if (request.error) return <ErrorView message={errorMessage(request.error)} onRetry={() => void request.refetch()} />;
  if (!request.data) {
    return (
      <NarrowColumn className="gap-3 p-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-72 w-full" />
      </NarrowColumn>
    );
  }
  const r = request.data;
  const imageUri = mediaUrl(r.imageUrl);
  const audioUri = mediaUrl(r.audioUrl);

  function confirmCancel() {
    showAlert(tNow('requestDetail.cancelTitle'), tNow('requestDetail.cancelBody'), [
      { text: tNow('requestDetail.keep'), style: 'cancel' },
      {
        text: tNow('requestDetail.cancel'),
        style: 'destructive',
        onPress: () =>
          cancel.mutate(r.id, {
            onSuccess: () => toast.success(tNow('requestDetail.cancelled')),
            onError: (e) => showAlert(tNow('order.couldNotCancel'), errorMessage(e)),
          }),
      },
    ]);
  }

  const status =
    r.status === 'PENDING' ? (
      <View>
        <View className="flex-row items-center">
          <Clock size={24} color="#b45309" />
          <Text className="ml-2 flex-1 text-xl font-extrabold text-gray-900">{t('requestDetail.waitingTitle')}</Text>
        </View>
        <Text className="mt-1 text-gray-600">{t('requestDetail.waitingBody')}</Text>
        <Button title={t('requestDetail.cancel')} variant="danger" icon={XCircle} className="mt-3" loading={cancel.isPending} onPress={confirmCancel} />
      </View>
    ) : r.status === 'ACCEPTED' ? (
      <View>
        <View className="flex-row items-center">
          <CircleCheck size={24} color={colors.brand} />
          <Text className="ml-2 flex-1 text-xl font-extrabold text-gray-900">{t('requestDetail.acceptedTitle')}</Text>
        </View>
        {r.orderNumber && r.orderTotal != null && (
          <Text className="mt-1 text-gray-700">
            {t('requestDetail.acceptedBody', { number: r.orderNumber, total: formatInr(r.orderTotal) })}
            {r.orderStatus ? ` · ${statusLabel(r.orderStatus)}` : ''}
          </Text>
        )}
        {r.orderId != null && (
          <Button
            title={t('requestDetail.viewOrder')}
            icon={ReceiptText}
            className="mt-3"
            onPress={() => navigation.navigate('OrderDetail', { orderId: Number(r.orderId) })}
          />
        )}
      </View>
    ) : r.status === 'REJECTED' ? (
      <View accessibilityRole="alert">
        <View className="flex-row items-center">
          <CircleX size={24} color={colors.danger} />
          <Text className="ml-2 flex-1 text-xl font-extrabold text-gray-900">{t('requestDetail.rejectedTitle')}</Text>
        </View>
        {r.rejectReason && <Text className="mt-1 text-gray-700">{r.rejectReason}</Text>}
        <Button title={t('requestDetail.sendAgain')} icon={NotebookPen} variant="outline" className="mt-3" onPress={() => navigation.replace('RequestOrder')} />
      </View>
    ) : (
      <View className="flex-row items-center">
        <CircleX size={24} color={colors.muted} />
        <Text className="ml-2 flex-1 text-xl font-extrabold text-gray-900">{t('requestDetail.cancelledTitle')}</Text>
      </View>
    );

  return (
    <ScrollView
      className="flex-1 bg-gray-50"
      contentContainerStyle={{ padding: 12, paddingBottom: 40 }}
      refreshControl={<RefreshControl refreshing={request.isRefetching} onRefresh={() => void request.refetch()} colors={[colors.brand]} />}
    >
      <NarrowColumn className="gap-3">
        <Card>
          <View className="mb-3 flex-row items-center justify-between">
            <Text className="text-xs text-gray-500">{t('requestDetail.sentAt', { time: formatTime(r.createdAt) })}</Text>
            <Text className={`overflow-hidden rounded-full px-2 py-0.5 text-[11px] font-bold ${REQUEST_TONE[r.status]}`}>
              {requestStatusLabel(r.status)}
            </Text>
          </View>
          {status}
        </Card>

        {imageUri && (
          <Card>
            <SectionTitle title={t('requestDetail.photo')} icon={NotebookPen} />
            <Image
              source={{ uri: imageUri }}
              accessibilityLabel={t('request.photoA11y')}
              contentFit="contain"
              style={{ width: '100%', height: 420, borderRadius: 12, backgroundColor: '#f3f4f6' }}
            />
          </Card>
        )}

        {audioUri && (
          <Card>
            <SectionTitle title={t('requestDetail.voice')} icon={Mic} />
            <VoiceNotePlayer uri={audioUri} seconds={r.audioSeconds} />
          </Card>
        )}

        {r.note && (
          <Card>
            <SectionTitle title={t('requestDetail.note')} icon={NotebookPen} />
            <Text className="text-gray-800">{r.note}</Text>
          </Card>
        )}

        <Card>
          <SectionTitle title={t('request.deliverTo')} icon={MapPin} />
          <Text className="text-gray-800">
            {r.address.label ? <Text className="font-bold">{addressLabel(r.address.label)} · </Text> : null}
            {r.address.line1}
            {r.address.line2 ? `, ${r.address.line2}` : ''} · {r.address.pincode}
          </Text>
        </Card>
      </NarrowColumn>
    </ScrollView>
  );
}
