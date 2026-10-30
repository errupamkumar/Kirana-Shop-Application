import type { LucideIcon } from 'lucide-react-native';
import { ActivityIndicator, Pressable, Text, View, type PressableProps } from 'react-native';
import { colors } from '../theme';

type Variant = 'primary' | 'outline' | 'ghost' | 'danger';

const containerClass: Record<Variant, string> = {
  primary: 'bg-brand-500 active:bg-brand-600',
  outline: 'border border-brand-500 bg-white active:bg-brand-50',
  ghost: 'bg-transparent active:bg-gray-100',
  danger: 'border border-danger bg-white active:bg-red-50',
};

const textClass: Record<Variant, string> = {
  primary: 'text-white',
  outline: 'text-brand-600',
  ghost: 'text-brand-600',
  danger: 'text-danger',
};

const iconColor: Record<Variant, string> = {
  primary: colors.white,
  outline: colors.brandDark,
  ghost: colors.brandDark,
  danger: colors.danger,
};

export function Button({
  title,
  variant = 'primary',
  loading,
  disabled,
  icon: Icon,
  className,
  ...props
}: PressableProps & { title: string; variant?: Variant; loading?: boolean; icon?: LucideIcon; className?: string }) {
  const off = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!off, busy: !!loading }}
      disabled={off}
      className={`h-12 flex-row items-center justify-center rounded-xl px-5 ${off ? 'opacity-50' : ''} ${containerClass[variant]} ${className ?? ''}`}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={iconColor[variant]} className="mr-2" />
      ) : (
        Icon && <Icon size={18} color={iconColor[variant]} style={{ marginRight: 8 }} />
      )}
      <Text className={`text-base font-bold ${textClass[variant]}`}>{title}</Text>
    </Pressable>
  );
}

export function Skeleton({ className, style }: { className?: string; style?: object }) {
  return <View className={`rounded-xl bg-gray-200 ${className ?? ''}`} style={style} />;
}

export function SkeletonGrid({ count = 6, cardWidth }: { count?: number; cardWidth?: number }) {
  return (
    <View className="flex-row flex-wrap gap-3 p-4" accessibilityLabel="Loading">
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} className="h-60" style={{ width: cardWidth ?? '47%' }} />
      ))}
    </View>
  );
}

/** Friendly empty state with an illustration, a title, a hint and an optional action. */
export function EmptyView({
  title,
  message,
  emoji = '🛍️',
  action,
}: {
  title: string;
  message?: string;
  emoji?: string;
  action?: React.ReactNode;
}) {
  return (
    <View className="flex-1 items-center justify-center p-8">
      <View className="h-24 w-24 items-center justify-center rounded-full bg-brand-50">
        <Text className="text-5xl">{emoji}</Text>
      </View>
      <Text className="mt-5 text-center text-lg font-extrabold text-gray-900">{title}</Text>
      {message && <Text className="mt-2 max-w-xs text-center text-gray-500">{message}</Text>}
      {action && <View className="mt-6 w-full max-w-xs">{action}</View>}
    </View>
  );
}

export function ErrorView({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View className="items-center p-8" accessibilityRole="alert">
      <Text className="text-4xl">📡</Text>
      <Text className="mt-3 text-center font-semibold text-gray-800">{message}</Text>
      {onRetry && <Button title="Try again" variant="outline" className="mt-4" onPress={onRetry} />}
    </View>
  );
}

export function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return <View className={`rounded-2xl border border-gray-100 bg-white p-4 ${className ?? ''}`}>{children}</View>;
}

export function SectionTitle({ title, icon: Icon, right }: { title: string; icon?: LucideIcon; right?: React.ReactNode }) {
  return (
    <View className="mb-3 flex-row items-center justify-between">
      <View className="flex-row items-center">
        {Icon && <Icon size={18} color={colors.ink} style={{ marginRight: 8 }} />}
        <Text className="text-base font-extrabold text-gray-900">{title}</Text>
      </View>
      {right}
    </View>
  );
}

export function Row({ label, value, strong, valueClass }: { label: string; value: string; strong?: boolean; valueClass?: string }) {
  return (
    <View className="flex-row justify-between py-1">
      <Text className={strong ? 'text-base font-bold text-gray-900' : 'text-gray-600'}>{label}</Text>
      <Text className={`${strong ? 'text-base font-bold text-gray-900' : 'text-gray-800'} ${valueClass ?? ''}`}>{value}</Text>
    </View>
  );
}

/** Tappable list row with a leading icon and trailing chevron (profile menu, settings). */
export function MenuRow({
  icon: Icon,
  label,
  hint,
  onPress,
  trailing,
}: {
  icon: LucideIcon;
  label: string;
  hint?: string;
  onPress?: () => void;
  trailing?: React.ReactNode;
}) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} className="flex-row items-center py-3 active:opacity-60">
      <View className="h-9 w-9 items-center justify-center rounded-xl bg-gray-100">
        <Icon size={18} color={colors.ink} />
      </View>
      <View className="ml-3 flex-1">
        <Text className="font-semibold text-gray-900">{label}</Text>
        {hint && <Text className="text-xs text-gray-500">{hint}</Text>}
      </View>
      {trailing}
    </Pressable>
  );
}
