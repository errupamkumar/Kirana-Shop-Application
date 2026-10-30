import { Banknote, CircleAlert, CircleCheck, Clock, CreditCard, MapPin, ReceiptText, ShoppingBasket, Trash2, Truck } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ProductImage } from '../components/ProductImage';
import { QtyStepper } from '../components/QtyStepper';
import { Container } from '../components/Screen';
import { Button, Card, EmptyView, Row, SectionTitle } from '../components/ui';
import { useAddresses, useCartQuote, usePlaceOrder, useStoreConfig, useVerifyPayment } from '../hooks/queries';
import { useLayout } from '../hooks/useLayout';
import { apiError, errorMessage } from '../lib/api';
import {
  deliveryFee as localDeliveryFee,
  freeDeliveryMessage,
  minOrderMessage,
  minOrderProgress,
  newIdempotencyKey,
  placeOrderDisabledReason,
} from '../lib/checkout';
import { showAlert } from '../lib/dialog';
import { formatInr, formatPrice } from '../lib/money';
import { openRazorpay } from '../lib/razorpay';
import type { Address, CartQuote, OrderDetail, PaymentMethod, StoreConfig } from '../lib/types';
import type { AppScreenProps } from '../navigation/types';
import { cartItems, itemSubtotal, mrpSavings, useCartStore, type CartItem } from '../store/cart';
import { useAuthStore, useCheckoutStore } from '../store/session';
import { colors } from '../theme';

const BLOCKING = ['STORE_CLOSED', 'VARIANT_INACTIVE', 'OUT_OF_STOCK', 'OUT_OF_RADIUS', 'PAYMENT_METHOD_DISABLED'];
const PAYMENT: Record<PaymentMethod, { label: string; hint: string; icon: typeof Banknote }> = {
  COD: { label: 'Cash on delivery', hint: 'Pay cash or UPI to the delivery person', icon: Banknote },
  ONLINE: { label: 'Pay online', hint: 'UPI, cards, net banking (Razorpay)', icon: CreditCard },
};

// ---------- Sections ----------

function MinOrderCard({ subtotal, minOrder }: { subtotal: number; minOrder: number }) {
  const message = minOrderMessage(subtotal, minOrder);
  return (
    <Card>
      <View className="mb-2 flex-row items-center justify-between">
        <Text className="font-bold text-gray-900">Minimum order {formatPrice(minOrder)}</Text>
        {message ? <ShoppingBasket size={18} color="#b45309" /> : <CircleCheck size={18} color={colors.brand} />}
      </View>
      <View
        className="h-2 overflow-hidden rounded-full bg-gray-200"
        accessibilityRole="progressbar"
        accessibilityLabel="Progress to minimum order"
        accessibilityValue={{ min: 0, max: 100, now: Math.round(minOrderProgress(subtotal, minOrder) * 100) }}
      >
        <View className="h-2 rounded-full bg-brand-500" style={{ width: `${minOrderProgress(subtotal, minOrder) * 100}%` }} />
      </View>
      <Text className={`mt-2 text-sm ${message ? 'font-semibold text-amber-700' : 'font-semibold text-brand-700'}`}>
        {message ?? 'Minimum order reached'}
      </Text>
    </Card>
  );
}

function ItemsCard({ list, issues }: { list: CartItem[]; issues: Map<number, string | null> }) {
  const { increment, decrement, remove } = useCartStore.getState();
  return (
    <Card>
      <SectionTitle title={`${list.length} ${list.length === 1 ? 'item' : 'items'} in your cart`} icon={ShoppingBasket} />
      {list.map((item, index) => {
        const issue = issues.get(item.variantId);
        return (
          <View key={item.variantId} className={`flex-row items-center py-3 ${index > 0 ? 'border-t border-gray-100' : ''}`}>
            <ProductImage url={item.imageUrl} name={item.productName} size={56} />
            <View className="ml-3 flex-1 pr-2">
              <Text numberOfLines={2} className="font-semibold text-gray-900">
                {item.productName}
              </Text>
              <Text className="text-xs text-gray-500">{item.variantLabel}</Text>
              {issue ? (
                <View className="mt-1 flex-row items-center">
                  <CircleAlert size={14} color={colors.danger} />
                  <Text className="ml-1 text-xs font-bold text-danger">{issue === 'OUT_OF_STOCK' ? 'Not enough stock' : 'No longer available'}</Text>
                  <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${item.productName}`} onPress={() => remove(item.variantId)} className="ml-3 flex-row items-center">
                    <Trash2 size={13} color={colors.brandDark} />
                    <Text className="ml-0.5 text-xs font-bold text-brand-600">Remove</Text>
                  </Pressable>
                </View>
              ) : (
                <Text className="mt-0.5 text-sm font-extrabold text-gray-900">
                  {formatPrice(item.sellingPrice * item.qty)}
                  {item.mrp > item.sellingPrice && (
                    <Text className="text-xs font-normal text-gray-400 line-through"> {formatPrice(item.mrp * item.qty)}</Text>
                  )}
                </Text>
              )}
            </View>
            <QtyStepper
              qty={item.qty}
              label={`${item.productName} ${item.variantLabel}`}
              onIncrement={() => increment(item.variantId)}
              onDecrement={() => decrement(item.variantId)}
            />
          </View>
        );
      })}
    </Card>
  );
}

function BillCard({ items, quote, subtotal, fee, total, cfg }: {
  items: Record<number, CartItem>;
  quote: CartQuote | undefined;
  subtotal: number;
  fee: number;
  total: number;
  cfg: StoreConfig | undefined;
}) {
  const freeMessage = cfg ? freeDeliveryMessage(subtotal, cfg.freeDeliveryAbove) : null;
  const savings = mrpSavings(items);
  return (
    <Card>
      <SectionTitle title="Bill details" icon={ReceiptText} />
      <Row label="Item total" value={formatInr(quote?.itemSubtotal ?? subtotal)} />
      {savings > 0 && <Row label="You save on MRP" value={`− ${formatInr(savings)}`} valueClass="text-brand-600" />}
      <Row label="Delivery fee" value={fee === 0 ? 'FREE' : formatInr(fee)} valueClass={fee === 0 ? 'font-bold text-brand-600' : undefined} />
      {freeMessage && (
        <View className="mt-1 flex-row items-center rounded-lg bg-brand-50 px-2 py-1.5">
          <Truck size={14} color={colors.brand} />
          <Text className="ml-1.5 text-xs font-semibold text-brand-700">{freeMessage}</Text>
        </View>
      )}
      <View className="my-2 h-px bg-gray-100" />
      <Row label="To pay" value={formatInr(total)} strong />
    </Card>
  );
}

function AddressCard({ address, quote, onChange }: { address: Address | undefined; quote: CartQuote | undefined; onChange: () => void }) {
  const radiusViolation = quote?.violations.find((v) => v.code === 'OUT_OF_RADIUS');
  return (
    <Card>
      <SectionTitle
        title="Deliver to"
        icon={MapPin}
        right={
          <Pressable accessibilityRole="button" onPress={onChange} hitSlop={8}>
            <Text className="font-bold text-brand-600">{address ? 'Change' : 'Add address'}</Text>
          </Pressable>
        }
      />
      {address ? (
        <Text className="text-gray-700">
          <Text className="font-bold text-gray-900">{address.label}</Text> · {address.line1}
          {address.line2 ? `, ${address.line2}` : ''} · {address.pincode}
        </Text>
      ) : (
        <Text className="text-gray-500">Add an address to check delivery and see the final total.</Text>
      )}
      {radiusViolation && (
        <View className="mt-2 flex-row items-start">
          <CircleAlert size={16} color={colors.danger} />
          <Text className="ml-1.5 flex-1 text-sm font-semibold text-danger">{radiusViolation.message}</Text>
        </View>
      )}
      {quote?.serviceable && quote.distanceKm != null && (
        <View className="mt-2 flex-row items-center">
          <CircleCheck size={14} color={colors.brand} />
          <Text className="ml-1 text-xs font-semibold text-brand-700">We deliver here ({quote.distanceKm} km)</Text>
        </View>
      )}
    </Card>
  );
}

function PaymentCard({
  allowed,
  paymentMethod,
  setPaymentMethod,
  note,
  setNote,
}: {
  allowed: PaymentMethod[];
  paymentMethod: PaymentMethod | null;
  setPaymentMethod: (m: PaymentMethod) => void;
  note: string;
  setNote: (n: string) => void;
}) {
  return (
    <Card>
      <SectionTitle title="Payment" icon={Banknote} />
      {allowed.length === 0 && <Text className="text-gray-500">No payment method is available right now.</Text>}
      {allowed.map((method) => {
        const option = PAYMENT[method];
        const checked = paymentMethod === method;
        return (
          <Pressable
            key={method}
            accessibilityRole="radio"
            accessibilityState={{ checked }}
            accessibilityLabel={option.label}
            onPress={() => setPaymentMethod(method)}
            className={`mb-2 flex-row items-center rounded-xl border p-3 ${checked ? 'border-brand-500 bg-brand-50' : 'border-gray-200 active:bg-gray-50'}`}
          >
            <option.icon size={20} color={checked ? colors.brand : colors.inkSoft} />
            <View className="ml-3 flex-1">
              <Text className="font-bold text-gray-900">{option.label}</Text>
              <Text className="text-xs text-gray-500">{option.hint}</Text>
            </View>
            <View className={`h-5 w-5 items-center justify-center rounded-full border-2 ${checked ? 'border-brand-500' : 'border-gray-300'}`}>
              {checked && <View className="h-2.5 w-2.5 rounded-full bg-brand-500" />}
            </View>
          </Pressable>
        );
      })}
      <TextInput
        accessibilityLabel="Note for the store"
        value={note}
        onChangeText={setNote}
        maxLength={300}
        placeholder="Note for the store (optional), e.g. ring the bell twice"
        placeholderTextColor={colors.muted}
        className="mt-1 h-11 rounded-xl border border-gray-200 px-3 text-gray-900"
      />
    </Card>
  );
}

// ---------- Screen ----------

export function CartScreen({ navigation }: AppScreenProps<'Cart'>) {
  const insets = useSafeAreaInsets();
  const layout = useLayout();
  const items = useCartStore((s) => s.items);
  const { remove, syncPrices, clear } = useCartStore.getState();
  const user = useAuthStore((s) => s.user);
  const config = useStoreConfig();
  const addresses = useAddresses();
  const { addressId, setAddressId, paymentMethod, setPaymentMethod } = useCheckoutStore();
  const [note, setNote] = useState('');
  const [paying, setPaying] = useState(false);
  const place = usePlaceOrder();
  const verify = useVerifyPayment();

  const list = cartItems(items);
  const address = addresses.data?.find((a) => a.id === addressId);
  const allowed = useMemo(() => config.data?.allowedPaymentMethods ?? [], [config.data]);

  // Default address and payment method (COD first when allowed)
  useEffect(() => {
    if (addresses.data && !address) {
      const fallback = addresses.data.find((a) => a.isDefault) ?? addresses.data[0];
      setAddressId(fallback?.id ?? null);
    }
  }, [addresses.data, address, setAddressId]);
  useEffect(() => {
    if (config.data && (!paymentMethod || !allowed.includes(paymentMethod))) {
      setPaymentMethod(allowed.includes('COD') ? 'COD' : (allowed[0] ?? null));
    }
  }, [config.data, allowed, paymentMethod, setPaymentMethod]);

  // Stable request identity: only changes when variant ids, quantities, address or payment change
  const itemsKey = JSON.stringify(list.map((i) => ({ variantId: i.variantId, qty: i.qty })));
  const selectedAddressId = address?.id ?? null;
  const request = { items: list.map((i) => ({ variantId: i.variantId, qty: i.qty })), addressId: selectedAddressId, paymentMethod };
  const quote = useCartQuote(request);

  // One idempotency key per checkout attempt; a changed cart is a new attempt
  const idempotencyKey = useRef(newIdempotencyKey());
  useEffect(() => {
    idempotencyKey.current = newIdempotencyKey();
  }, [itemsKey, selectedAddressId, paymentMethod]);

  // Show the prices the server will charge
  useEffect(() => {
    if (quote.data) syncPrices(quote.data.lines);
  }, [quote.data, syncPrices]);

  if (list.length === 0) {
    return (
      <EmptyView
        emoji="🧺"
        title="Your cart is empty"
        message="Fresh groceries are a tap away. Add a few items to get started."
        action={<Button title="Start shopping" onPress={() => navigation.navigate('Tabs')} />}
      />
    );
  }

  const cfg = config.data;
  const subtotal = itemSubtotal(items);
  const minOrder = cfg?.minOrderAmount ?? 0;
  const fee = quote.data?.deliveryFee ?? (cfg ? localDeliveryFee(subtotal, cfg.deliveryCharge, cfg.freeDeliveryAbove) : 0);
  const total = quote.data?.total ?? subtotal + fee;
  const violations = quote.data?.violations ?? [];
  const issues = new Map(quote.data?.lines.filter((l) => l.issue).map((l) => [l.variantId, l.issue]) ?? []);

  const disabledReason = placeOrderDisabledReason({
    itemSubtotal: subtotal,
    minOrderAmount: minOrder,
    serviceable: quote.data?.serviceable ?? null,
    storeOpen: cfg?.storeOpen ?? false,
    paymentMethod,
    validating: quote.validating || !cfg,
    hasAddress: !!address,
    hasBlockingIssues: violations.some((v) => BLOCKING.includes(v.code)),
  });

  function finish(order: OrderDetail) {
    clear();
    navigation.replace('OrderSuccess', { orderId: order.id, orderNumber: order.orderNumber });
  }

  async function payOnline(order: OrderDetail) {
    setPaying(true);
    const result = await openRazorpay(order, cfg?.storeName ?? 'Kirana', user?.phone ?? '');
    if (!result.ok) {
      setPaying(false);
      // The order exists and holds the stock; it can be paid from the order screen within 15 minutes
      clear();
      navigation.replace('OrderDetail', { orderId: order.id });
      showAlert(result.cancelled ? 'Payment not completed' : 'Payment failed', `${result.message}. You can retry from the order screen.`);
      return;
    }
    verify.mutate(
      {
        orderId: order.id,
        razorpayOrderId: result.data.razorpay_order_id,
        razorpayPaymentId: result.data.razorpay_payment_id,
        signature: result.data.razorpay_signature,
      },
      {
        onSuccess: (paid) => {
          setPaying(false);
          finish(paid);
        },
        onError: (e) => {
          setPaying(false);
          clear();
          navigation.replace('OrderDetail', { orderId: order.id });
          showAlert('Payment not confirmed', errorMessage(e));
        },
      },
    );
  }

  function placeOrder(expectedTotal: number) {
    if (!address || !paymentMethod) return;
    place.mutate(
      {
        idempotencyKey: idempotencyKey.current,
        body: { items: request.items, addressId: address.id, paymentMethod, expectedTotal, note: note.trim() || undefined },
      },
      {
        onSuccess: (order) => (order.status === 'PENDING_PAYMENT' ? void payOnline(order) : finish(order)),
        onError: (e) => {
          const body = apiError(e);
          if (body?.code === 'PRICE_CHANGED') {
            const fresh = (body.details.quote as CartQuote | undefined)?.total;
            void quote.refetch();
            showAlert('Prices updated', fresh != null ? `Your new total is ${formatInr(fresh)}.` : body.message, [
              { text: 'Review', style: 'cancel' },
              ...(fresh != null ? [{ text: 'Place order', onPress: () => placeOrder(fresh) }] : []),
            ]);
          } else if (body?.code === 'OUT_OF_STOCK' || body?.code === 'VARIANT_INACTIVE') {
            const ids = ((body.details.variantIds as number[] | undefined) ??
              (body.details.violations as { variantIds: number[] }[] | undefined)?.flatMap((v) => v.variantIds) ??
              []) as number[];
            void quote.refetch();
            showAlert('Some items are unavailable', body.message, [
              { text: 'Review', style: 'cancel' },
              { text: 'Remove them', onPress: () => ids.forEach((id) => remove(id)) },
            ]);
          } else {
            showAlert('Could not place order', errorMessage(e));
          }
        },
      },
    );
  }

  const busy = place.isPending || paying || verify.isPending;
  const otherViolations = violations.filter((v) => v.code !== 'BELOW_MIN_ORDER' && v.code !== 'OUT_OF_RADIUS');
  const changeAddress = () => (address ? navigation.navigate('Addresses', { select: true }) : navigation.navigate('AddressForm'));

  const placeButton = (
    <View>
      {disabledReason && !busy && (
        <Text className="mb-2 text-center text-sm font-semibold text-gray-600">{disabledReason}</Text>
      )}
      <Button
        title={busy ? (paying ? 'Waiting for payment…' : 'Placing order…') : `Place order · ${formatInr(total)}`}
        disabled={!!disabledReason}
        loading={busy}
        onPress={() => quote.data && placeOrder(quote.data.total)}
      />
    </View>
  );

  const closedBanner = cfg && !cfg.storeOpen && (
    <View accessibilityRole="alert" className="flex-row items-center rounded-2xl bg-gray-900 p-4">
      <Clock size={20} color={colors.accent} />
      <View className="ml-3 flex-1">
        <Text className="font-bold text-white">Store is closed</Text>
        <Text className="text-gray-300">{cfg.storeClosedMessage ?? 'Ordering is paused for now.'}</Text>
      </View>
    </View>
  );

  const problems = otherViolations.map((v) => (
    <View key={v.code} accessibilityRole="alert" className="flex-row items-start rounded-xl bg-red-50 p-3">
      <CircleAlert size={16} color={colors.danger} />
      <Text className="ml-2 flex-1 text-sm font-semibold text-danger">{v.message}</Text>
    </View>
  ));

  if (layout.isWide) {
    return (
      <ScrollView className="flex-1 bg-gray-50" contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">
        <Container className="flex-row items-start gap-5">
          <View className="flex-[1.4] gap-3">
            {closedBanner}
            <MinOrderCard subtotal={subtotal} minOrder={minOrder} />
            <ItemsCard list={list} issues={issues} />
          </View>
          <View className="flex-1 gap-3">
            <BillCard items={items} quote={quote.data} subtotal={subtotal} fee={fee} total={total} cfg={cfg} />
            <AddressCard address={address} quote={quote.data} onChange={changeAddress} />
            <PaymentCard allowed={allowed} paymentMethod={paymentMethod} setPaymentMethod={setPaymentMethod} note={note} setNote={setNote} />
            {problems}
            {placeButton}
          </View>
        </Container>
      </ScrollView>
    );
  }

  return (
    <View className="flex-1 bg-gray-50">
      <ScrollView contentContainerStyle={{ padding: 12, gap: 12, paddingBottom: 150 }} keyboardShouldPersistTaps="handled">
        {closedBanner}
        <MinOrderCard subtotal={subtotal} minOrder={minOrder} />
        <ItemsCard list={list} issues={issues} />
        <BillCard items={items} quote={quote.data} subtotal={subtotal} fee={fee} total={total} cfg={cfg} />
        <AddressCard address={address} quote={quote.data} onChange={changeAddress} />
        <PaymentCard allowed={allowed} paymentMethod={paymentMethod} setPaymentMethod={setPaymentMethod} note={note} setNote={setNote} />
        {problems}
      </ScrollView>
      <View className="absolute bottom-0 left-0 right-0 border-t border-gray-100 bg-white px-4 pt-3" style={{ paddingBottom: Math.max(insets.bottom, 12) }}>
        {placeButton}
      </View>
    </View>
  );
}
