import { Check, ChevronRight, CircleX, ClipboardCheck, CreditCard, MapPin, NotebookPen, Package, PackageCheck, Phone, ReceiptText, Truck, XCircle } from 'lucide-react-native';
import { useLayoutEffect, useState } from 'react';
import { Linking, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { Container } from '../components/Screen';
import { Button, Card, ErrorView, Row, SectionTitle, Skeleton } from '../components/ui';
import { useCancelOrder, useOrder, useStoreConfig, useVerifyPayment } from '../hooks/queries';
import { useLayout } from '../hooks/useLayout';
import { addressLabel, localName, t as tNow, useLang, useT } from '../i18n';
import { errorMessage } from '../lib/api';
import { showAlert } from '../lib/dialog';
import { formatInr } from '../lib/money';
import { formatTime, paymentLabel, statusLabel, trackingSteps } from '../lib/orderStatus';
import { openRazorpay } from '../lib/razorpay';
import type { OrderDetail, OrderStatus } from '../lib/types';
import type { AppScreenProps } from '../navigation/types';
import { useAuthStore } from '../store/session';
import { colors } from '../theme';
import { toast } from '../components/Toast';

const STEP_ICON: Partial<Record<OrderStatus, typeof Package>> = {
  PLACED: ReceiptText,
  ACCEPTED: ClipboardCheck,
  PACKED: Package,
  OUT_FOR_DELIVERY: Truck,
  DELIVERED: PackageCheck,
};

function Tracking({ order }: { order: OrderDetail }) {
  const t = useT();
  const steps = trackingSteps(order);
  return (
    <View className="mt-4">
      {steps.map((step, index) => {
        const Icon = STEP_ICON[step.status] ?? Package;
        return (
          <View key={step.status} className="flex-row">
            <View className="items-center">
              <View
                className={`h-9 w-9 items-center justify-center rounded-full ${
                  step.done ? 'bg-brand-500' : 'border-2 border-gray-200 bg-white'
                }`}
              >
                {step.done ? <Check size={18} color={colors.white} strokeWidth={3} /> : <Icon size={16} color={colors.muted} />}
              </View>
              {index < steps.length - 1 && (
                <View className={`w-0.5 flex-1 ${steps[index + 1].done ? 'bg-brand-500' : 'bg-gray-200'}`} style={{ minHeight: 26 }} />
              )}
            </View>
            <View className="ml-3 pb-5 pt-1.5">
              <Text className={step.done ? 'font-extrabold text-gray-900' : 'font-semibold text-gray-400'}>{step.label}</Text>
              {step.at ? (
                <Text className="text-xs text-gray-500">{formatTime(step.at)}</Text>
              ) : (
                <Text className="text-xs text-gray-300">{t('order.pending')}</Text>
              )}
            </View>
          </View>
        );
      })}
    </View>
  );
}

export function OrderDetailScreen({ navigation, route }: AppScreenProps<'OrderDetail'>) {
  const orderId = Number(route.params?.orderId);
  const layout = useLayout();
  const order = useOrder(orderId);
  const t = useT();
  const lang = useLang();
  const cancel = useCancelOrder();
  const verify = useVerifyPayment();
  const config = useStoreConfig();
  const phone = useAuthStore((s) => s.user?.phone ?? '');
  const [paying, setPaying] = useState(false);

  useLayoutEffect(() => {
    if (order.data) navigation.setOptions({ title: order.data.orderNumber });
  }, [navigation, order.data]);

  if (order.error) return <ErrorView message={errorMessage(order.error)} onRetry={() => void order.refetch()} />;
  if (!order.data) {
    return (
      <Container className="gap-3 p-4">
        <Skeleton className="h-56 w-full" />
        <Skeleton className="h-40 w-full" />
      </Container>
    );
  }
  const o = order.data;

  function confirmCancel() {
    showAlert(tNow('order.cancelTitle'), tNow('order.cancelBody'), [
      { text: tNow('order.keep'), style: 'cancel' },
      {
        text: tNow('order.cancel'),
        style: 'destructive',
        onPress: () =>
          cancel.mutate(
            { id: o.id },
            { onSuccess: () => toast.success(tNow('order.cancelled')), onError: (e) => showAlert(tNow('order.couldNotCancel'), errorMessage(e)) },
          ),
      },
    ]);
  }

  async function payNow() {
    setPaying(true);
    const result = await openRazorpay(o, config.data?.storeName ?? 'Kirana', phone);
    if (!result.ok) {
      setPaying(false);
      if (!result.cancelled) showAlert(tNow('order.paymentFailed'), result.message);
      return;
    }
    verify.mutate(
      {
        orderId: o.id,
        razorpayOrderId: result.data.razorpay_order_id,
        razorpayPaymentId: result.data.razorpay_payment_id,
        signature: result.data.razorpay_signature,
      },
      {
        onSettled: () => setPaying(false),
        onSuccess: () => toast.success(tNow('order.paymentReceived')),
        onError: (e) => showAlert(tNow('order.paymentNotConfirmed'), errorMessage(e)),
      },
    );
  }

  const statusCard = (
    <Card>
      {o.status === 'CANCELLED' ? (
        <View accessibilityRole="alert" className="flex-row items-start">
          <CircleX size={28} color={colors.danger} />
          <View className="ml-3 flex-1">
            <Text className="text-xl font-extrabold text-gray-900">{t('order.cancelledTitle')}</Text>
            {o.cancelReason && <Text className="mt-1 text-gray-600">{o.cancelReason}</Text>}
            {o.paymentStatus === 'REFUND_PENDING' && <Text className="mt-1 font-semibold text-brand-700">{t('order.refund')}</Text>}
          </View>
        </View>
      ) : o.status === 'PENDING_PAYMENT' ? (
        <View>
          <View className="flex-row items-center">
            <CreditCard size={24} color="#b45309" />
            <Text className="ml-2 text-xl font-extrabold text-gray-900">{t('order.completePayment')}</Text>
          </View>
          <Text className="mt-1 text-gray-600">{t('order.reserved')}</Text>
          <Button title={t('order.pay', { amount: formatInr(o.total) })} className="mt-3" loading={paying || verify.isPending} onPress={() => void payNow()} />
        </View>
      ) : (
        <View>
          <Text accessibilityRole="header" className="text-xl font-extrabold text-gray-900">
            {statusLabel(o.status)}
          </Text>
          <Text className="mt-0.5 text-sm text-gray-500">
            {o.status === 'DELIVERED' ? t('order.enjoy') : t('order.autoUpdate')}
          </Text>
          <Tracking order={o} />
        </View>
      )}
      {o.canCancel && <Button title={t('order.cancel')} variant="danger" icon={XCircle} className="mt-2" loading={cancel.isPending} onPress={confirmCancel} />}
    </Card>
  );

  const billCard = (
    <Card>
      <SectionTitle title={o.items.length === 1 ? t('order.oneItem') : t('order.items', { count: o.items.length })} icon={ReceiptText} />
      {o.items.map((item, i) => (
        <View key={i} className="flex-row justify-between py-1.5">
          <Text className="flex-1 pr-3 text-gray-800">
            {localName({ name: item.productName, nameHi: item.productNameHi }, lang)}
            {item.variantLabel ? <Text className="text-gray-500"> ({item.variantLabel})</Text> : null} × {item.qty}
          </Text>
          <Text className="font-semibold text-gray-900">{formatInr(item.lineTotal)}</Text>
        </View>
      ))}
      <View className="my-2 h-px bg-gray-100" />
      <Row label={t('order.itemTotal')} value={formatInr(o.itemSubtotal)} />
      <Row label={t('order.deliveryFee')} value={o.deliveryFee === 0 ? t('order.free') : formatInr(o.deliveryFee)} valueClass={o.deliveryFee === 0 ? 'font-bold text-brand-600' : undefined} />
      <Row label={t('order.total')} value={formatInr(o.total)} strong />
      <Text className="mt-1 text-xs font-semibold text-gray-500">{paymentLabel(o.status, o.paymentStatus)}</Text>
    </Card>
  );

  const addressCard = (
    <Card>
      <SectionTitle title={t('order.deliveringTo')} icon={MapPin} />
      <Text className="text-gray-800">
        {o.address.label ? <Text className="font-bold">{addressLabel(o.address.label)} · </Text> : null}
        {o.address.line1}
        {o.address.line2 ? `, ${o.address.line2}` : ''}
      </Text>
      {o.address.landmark && <Text className="text-xs text-gray-500">{t('order.near', { landmark: o.address.landmark })}</Text>}
      <Text className="text-xs text-gray-500">{t('order.pin', { pincode: o.address.pincode })}</Text>
      {o.customerNote && <Text className="mt-2 rounded-lg bg-amber-50 p-2 text-sm text-gray-700">{t('order.note', { note: o.customerNote })}</Text>}
      <Text className="mt-2 text-xs text-gray-400">{t('order.placedAt', { time: formatTime(o.placedAt) })}</Text>
      {config.data?.storePhone && (
        <Pressable
          accessibilityRole="link"
          onPress={() => void Linking.openURL(`tel:${config.data.storePhone}`)}
          className="mt-3 flex-row items-center self-start rounded-lg border border-gray-200 px-3 py-2 active:bg-gray-50"
        >
          <Phone size={14} color={colors.brandDark} />
          <Text className="ml-1.5 font-bold text-brand-600">{t('order.callStore')}</Text>
        </Pressable>
      )}
    </Card>
  );

  const requestCard = o.requestId != null && (
    <Pressable
      accessibilityRole="button"
      onPress={() => navigation.navigate('RequestDetail', { requestId: Number(o.requestId) })}
      className="flex-row items-center rounded-2xl border border-brand-100 bg-brand-50 p-4 active:opacity-80"
    >
      <NotebookPen size={22} color={colors.brand} />
      <View className="ml-3 flex-1">
        <Text className="font-extrabold text-gray-900">{t('order.fromRequest')}</Text>
        <Text className="text-xs text-gray-600">{t('order.fromRequestBody')}</Text>
      </View>
      <Text className="font-bold text-brand-600">{t('order.viewRequest')}</Text>
      <ChevronRight size={16} color={colors.brandDark} />
    </Pressable>
  );

  return (
    <ScrollView
      className="flex-1 bg-gray-50"
      contentContainerStyle={{ padding: layout.isWide ? 20 : 12, paddingBottom: 40 }}
      refreshControl={<RefreshControl refreshing={order.isRefetching} onRefresh={() => void order.refetch()} colors={[colors.brand]} />}
    >
      {layout.isWide ? (
        <Container className="flex-row items-start gap-5">
          <View className="flex-1 gap-3">
            {statusCard}
            {requestCard}
          </View>
          <View className="flex-1 gap-3">
            {billCard}
            {addressCard}
          </View>
        </Container>
      ) : (
        <View className="gap-3">
          {statusCard}
          {requestCard}
          {billCard}
          {addressCard}
        </View>
      )}
    </ScrollView>
  );
}
