import { Minus, Plus } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';
import { useT } from '../i18n';
import { MAX_QTY_PER_ITEM } from '../store/cart';
import { colors } from '../theme';

/** Green "− qty +" control that replaces the ADD button once an item is in the cart. */
export function QtyStepper({
  qty,
  onIncrement,
  onDecrement,
  label,
  compact,
}: {
  qty: number;
  onIncrement: () => void;
  onDecrement: () => void;
  label: string;
  compact?: boolean;
}) {
  const t = useT();
  const height = compact ? 34 : 38;
  const atMax = qty >= MAX_QTY_PER_ITEM;
  return (
    <View style={{ height, minWidth: compact ? 78 : 92 }} className="flex-row items-center justify-between rounded-lg bg-brand-500">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('stepper.remove', { label })}
        hitSlop={8}
        onPress={onDecrement}
        className="h-full justify-center px-2 active:opacity-60"
      >
        <Minus size={16} color={colors.white} strokeWidth={3} />
      </Pressable>
      <Text accessibilityLabel={t('stepper.inCart', { qty })} className="font-extrabold text-white">
        {qty}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('stepper.add', { label })}
        accessibilityState={{ disabled: atMax }}
        hitSlop={8}
        disabled={atMax}
        onPress={onIncrement}
        className={`h-full justify-center px-2 active:opacity-60 ${atMax ? 'opacity-40' : ''}`}
      >
        <Plus size={16} color={colors.white} strokeWidth={3} />
      </Pressable>
    </View>
  );
}
