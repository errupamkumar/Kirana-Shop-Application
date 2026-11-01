import { useCallback, useSyncExternalStore } from 'react'
import { catalog } from './messages/catalog'
import { common } from './messages/common'
import { orders } from './messages/orders'
import { requests } from './messages/requests'
import { settings } from './messages/settings'

/** Hindi is the default; English is optional. The choice is remembered in this browser. */
export type Lang = 'hi' | 'en'
export const LANGUAGES: { code: Lang; label: string }[] = [
  { code: 'hi', label: 'हिंदी' },
  { code: 'en', label: 'English' },
]

const en = { ...common.en, ...orders.en, ...catalog.en, ...settings.en, ...requests.en }
export type MessageKey = keyof typeof en
const hi: Record<MessageKey, string> = { ...common.hi, ...orders.hi, ...catalog.hi, ...settings.hi, ...requests.hi }
const dictionaries: Record<Lang, Record<MessageKey, string>> = { en, hi }

const STORAGE_KEY = 'kirana-admin-language'
const listeners = new Set<() => void>()

function stored(): Lang {
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    return value === 'en' || value === 'hi' ? value : 'hi'
  } catch {
    return 'hi'
  }
}

let current: Lang = stored()

export function getLang(): Lang {
  return current
}

export function setLang(lang: Lang): void {
  current = lang
  try {
    localStorage.setItem(STORAGE_KEY, lang)
  } catch {
    // private mode: the choice lasts for this tab only
  }
  if (typeof document !== 'undefined') document.documentElement.lang = lang
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export type Vars = Record<string, string | number>

export function translate(lang: Lang, key: MessageKey, vars?: Vars): string {
  const template = dictionaries[lang][key] ?? en[key]
  return vars ? template.replace(/\{(\w+)\}/g, (match, name: string) => (name in vars ? String(vars[name]) : match)) : template
}

export function hasMessage(key: string): key is MessageKey {
  return key in en
}

/** Outside React (toasts, error messages): the language chosen right now. */
export function t(key: MessageKey, vars?: Vars): string {
  return translate(current, key, vars)
}

export function useLang(): Lang {
  return useSyncExternalStore(subscribe, getLang, getLang)
}

/** `t` bound to the current language; components re-render when it changes. */
export function useT(): (key: MessageKey, vars?: Vars) => string {
  const lang = useLang()
  return useCallback((key: MessageKey, vars?: Vars) => translate(lang, key, vars), [lang])
}

/** Form validation messages are written in English in the schemas; show the Hindi one when there is one. */
export function translateMessage(message: string): string {
  const key = `v.${message}`
  return hasMessage(key) ? t(key) : message
}

/** Store-entered names: Hindi in Hindi mode when set, otherwise the English one. */
export function localName(item: { name: string; nameHi?: string | null }, lang: Lang): string {
  return lang === 'hi' && item.nameHi ? item.nameHi : item.name
}

export function dateLocale(lang: Lang): string {
  return lang === 'hi' ? 'hi-IN' : 'en-IN'
}
