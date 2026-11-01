import { afterEach, describe, expect, it } from 'vitest'
import { getLang, setLang, translate, translateMessage } from './index'
import { catalog } from './messages/catalog'
import { common } from './messages/common'
import { orders } from './messages/orders'
import { requests } from './messages/requests'
import { settings } from './messages/settings'

const sections = [common, orders, catalog, settings, requests]
const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort()

afterEach(() => setLang('en'))

describe('admin dictionaries', () => {
  it('has a Hindi text for every key with the same placeholders, and no duplicate keys', () => {
    const keys: string[] = []
    for (const section of sections) {
      const en = section.en as Record<string, string>
      const hi = section.hi as Record<string, string>
      for (const key of Object.keys(en)) {
        keys.push(key)
        expect(hi[key]?.trim()).toBeTruthy()
        expect(placeholders(hi[key])).toEqual(placeholders(en[key]))
      }
    }
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('switches language and remembers it', () => {
    setLang('hi')
    expect(getLang()).toBe('hi')
    expect(localStorage.getItem('kirana-admin-language')).toBe('hi')
    expect(translate('hi', 'action.OUT_FOR_DELIVERY')).toBe('डिलीवरी के लिए भेजें')
    expect(translate('en', 'action.OUT_FOR_DELIVERY')).toBe('Dispatch')
  })

  it('translates known form messages and leaves others as they are', () => {
    setLang('hi')
    expect(translateMessage('Required')).toBe('ज़रूरी है')
    expect(translateMessage('Something specific')).toBe('Something specific')
  })
})
