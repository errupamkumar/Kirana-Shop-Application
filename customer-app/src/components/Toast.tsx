import { CircleAlert, CircleCheck, Info } from 'lucide-react-native';
import { useEffect } from 'react';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { create } from 'zustand';
import { colors } from '../theme';

type ToastKind = 'success' | 'error' | 'info';

interface ToastState {
  message: string | null;
  kind: ToastKind;
  id: number;
  show: (message: string, kind?: ToastKind) => void;
  hide: () => void;
}

const useToastStore = create<ToastState>()((set) => ({
  message: null,
  kind: 'info',
  id: 0,
  show: (message, kind = 'info') => set((s) => ({ message, kind, id: s.id + 1 })),
  hide: () => set({ message: null }),
}));

/** Short, non-blocking feedback ("Name saved", "Address deleted"). Decisions still use showAlert. */
export const toast = {
  success: (message: string) => useToastStore.getState().show(message, 'success'),
  error: (message: string) => useToastStore.getState().show(message, 'error'),
  info: (message: string) => useToastStore.getState().show(message, 'info'),
};

const ICON = { success: CircleCheck, error: CircleAlert, info: Info };
const ICON_COLOR = { success: '#4ade80', error: '#f87171', info: '#93c5fd' };

/** Rendered once near the app root; shows the latest toast for 2.8 s. */
export function ToastHost() {
  const { message, kind, id, hide } = useToastStore();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(hide, 2800);
    return () => clearTimeout(timer);
  }, [message, id, hide]);

  if (!message) return null;
  const Icon = ICON[kind];
  return (
    <View pointerEvents="none" className="absolute left-0 right-0 items-center px-4" style={{ bottom: insets.bottom + 96 }}>
      <View
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
        className="max-w-md flex-row items-center rounded-2xl px-4 py-3"
        style={{ backgroundColor: colors.ink, elevation: 8 }}
      >
        <Icon size={18} color={ICON_COLOR[kind]} />
        <Text className="ml-2 flex-shrink font-semibold text-white">{message}</Text>
      </View>
    </View>
  );
}
