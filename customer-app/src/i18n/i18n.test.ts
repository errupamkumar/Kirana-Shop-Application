import { AxiosError, type AxiosResponse } from 'axios';
import { errorMessage } from '../lib/api';
import { addressLabel, hasMessage, localName, t, translate, useLanguageStore, type MessageKey } from './index';
import { account } from './messages/account';
import { auth } from './messages/auth';
import { cart } from './messages/cart';
import { common } from './messages/common';
import { home } from './messages/home';
import { orders } from './messages/orders';
import { requests } from './messages/requests';

const sections = [common, auth, home, cart, orders, account, requests];
const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

function apiFailure(code: string, message: string, details: Record<string, unknown> = {}) {
  return new AxiosError('failed', 'ERR_BAD_REQUEST', undefined, undefined, {
    status: 400,
    data: { code, message, details },
  } as AxiosResponse);
}

afterEach(() => useLanguageStore.setState({ lang: 'en' }));

describe('dictionaries', () => {
  it('has a non-empty Hindi text for every English key, with the same placeholders', () => {
    for (const section of sections) {
      const en = section.en as Record<string, string>;
      const hi = section.hi as Record<string, string>;
      for (const key of Object.keys(en)) {
        expect(hi[key]?.trim()).toBeTruthy();
        expect(placeholders(hi[key])).toEqual(placeholders(en[key]));
      }
    }
  });

  it('has no key defined in two sections', () => {
    const keys = sections.flatMap(({ en }) => Object.keys(en));
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe('translate', () => {
  it('defaults to Hindi in the app and fills placeholders', () => {
    expect(translate('hi', 'cart.placeOrder', { amount: '₹598' })).toBe('ऑर्डर करें · ₹598');
    expect(translate('en', 'cart.placeOrder', { amount: '₹598' })).toBe('Place order · ₹598');
    expect(translate('en', 'otp.resendIn')).toContain('{seconds}');
  });

  it('follows the chosen language', () => {
    useLanguageStore.setState({ lang: 'hi' });
    expect(t('tabs.orders')).toBe('ऑर्डर');
    useLanguageStore.setState({ lang: 'en' });
    expect(t('tabs.orders')).toBe('Orders');
  });

  it('picks the Hindi name only in Hindi and only when set', () => {
    const rice = { name: 'Basmati Rice', nameHi: 'बासमती चावल' };
    expect(localName(rice, 'hi')).toBe('बासमती चावल');
    expect(localName(rice, 'en')).toBe('Basmati Rice');
    expect(localName({ name: 'Lux soap', nameHi: null }, 'hi')).toBe('Lux soap');
  });

  it('shows saved address labels in the chosen language', () => {
    useLanguageStore.setState({ lang: 'hi' });
    expect(addressLabel('Home')).toBe('घर');
    expect(addressLabel('Shop')).toBe('Shop');
    expect(hasMessage('address.label.Work' satisfies MessageKey)).toBe(true);
  });
});

describe('error messages', () => {
  it('keeps the server wording in English and translates by code in Hindi', () => {
    const error = apiFailure('OUT_OF_STOCK', 'Some items just went out of stock');
    expect(errorMessage(error)).toBe('Some items just went out of stock');
    useLanguageStore.setState({ lang: 'hi' });
    expect(errorMessage(error)).toBe('कुछ सामान अभी-अभी ख़त्म हो गए।');
    expect(errorMessage(apiFailure('OTP_INVALID', 'Wrong code', { attemptsLeft: 2 }))).toBe('कोड गलत है। 2 कोशिशें बाकी हैं।');
  });

  it("shows the store's own closed message as written", () => {
    useLanguageStore.setState({ lang: 'hi' });
    expect(errorMessage(apiFailure('STORE_CLOSED', 'दिवाली पर दुकान बंद है'))).toBe('दिवाली पर दुकान बंद है');
  });
});
