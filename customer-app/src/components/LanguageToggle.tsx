import { Languages } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';
import { LANGUAGES, useLanguageStore, useT } from '../i18n';
import { colors } from '../theme';

/** हिंदी | English switch. Hindi is the default; the choice is remembered on this device. */
export function LanguageToggle({ compact }: { compact?: boolean }) {
  const lang = useLanguageStore((s) => s.lang);
  const setLang = useLanguageStore((s) => s.setLang);
  const t = useT();
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={t('common.language')} className="flex-row items-center">
      {!compact && <Languages size={18} color={colors.inkSoft} />}
      <View className={`flex-row rounded-full border border-gray-200 bg-white p-0.5 ${compact ? '' : 'ml-2'}`}>
        {LANGUAGES.map((l) => {
          const selected = l.code === lang;
          return (
            <Pressable
              key={l.code}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              onPress={() => setLang(l.code)}
              hitSlop={4}
              className={`rounded-full px-3 py-1.5 ${selected ? 'bg-brand-500' : ''}`}
            >
              <Text className={`text-sm font-bold ${selected ? 'text-white' : 'text-gray-700'}`}>{l.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
