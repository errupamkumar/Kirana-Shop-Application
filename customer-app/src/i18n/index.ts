import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useSyncExternalStore } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { account } from './messages/account';
import { auth } from './messages/auth';
import { cart } from './messages/cart';
import { common } from './messages/common';
import { home } from './messages/home';
import { orders } from './messages/orders';
import { requests } from './messages/requests';

/** Hindi is the default; English is optional. */
export type Lang = 'hi' | 'en';
export const LANGUAGES: { code: Lang; label: string }[] = [
  { code: 'hi', label: 'हिंदी' },
  { code: 'en', label: 'English' },
];

const en = { ...common.en, ...auth.en, ...home.en, ...cart.en, ...orders.en, ...account.en, ...requests.en };
export type MessageKey = keyof typeof en;
const hi: Record<MessageKey, string> = { ...common.hi, ...auth.hi, ...home.hi, ...cart.hi, ...orders.hi, ...account.hi, ...requests.hi };
const dictionaries: Record<Lang, Record<MessageKey, string>> = { en, hi };

export type Vars = Record<string, string | number>;

interface LanguageState {
  lang: Lang;
  setLang: (lang: Lang) => void;
}

export const useLanguageStore = create<LanguageState>()(
  persist((set) => ({ lang: 'hi', setLang: (lang) => set({ lang }) }), {
    name: 'kirana-language',
    storage: createJSONStorage(() => AsyncStorage),
  }),
);

export function translate(lang: Lang, key: MessageKey, vars?: Vars): string {
  const template = dictionaries[lang][key] ?? en[key];
  return vars ? template.replace(/\{(\w+)\}/g, (match, name: string) => (name in vars ? String(vars[name]) : match)) : template;
}

export function hasMessage(key: string): key is MessageKey {
  return key in en;
}

/** Outside React (alerts, error messages): the language chosen right now. */
export function t(key: MessageKey, vars?: Vars): string {
  return translate(useLanguageStore.getState().lang, key, vars);
}

export function useLang(): Lang {
  return useLanguageStore((s) => s.lang);
}

/** `t` bound to the current language; components re-render when it changes. */
export function useT(): (key: MessageKey, vars?: Vars) => string {
  const lang = useLang();
  return useCallback((key: MessageKey, vars?: Vars) => translate(lang, key, vars), [lang]);
}

/** Store-entered names: the Hindi one in Hindi mode when the store set it, otherwise the English one. */
export function localName(item: { name: string; nameHi?: string | null }, lang: Lang): string {
  return lang === 'hi' && item.nameHi ? item.nameHi : item.name;
}

/** Saved address labels are stored in English (Home, Work, Other); show them in the chosen language. */
export function addressLabel(label: string | null | undefined): string {
  if (!label) return '';
  const key = `address.label.${label}`;
  return hasMessage(key) ? t(key) : label;
}

export function dateLocale(lang: Lang): string {
  return lang === 'hi' ? 'hi-IN' : 'en-IN';
}

/** True once the saved language has been read, so the first screen is not drawn in the wrong language. */
export function useLanguageReady(): boolean {
  return useSyncExternalStore(
    (onChange) => useLanguageStore.persist.onFinishHydration(onChange),
    () => useLanguageStore.persist.hasHydrated(),
    () => true,
  );
}
