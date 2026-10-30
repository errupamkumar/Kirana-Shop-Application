import * as SecureStore from 'expo-secure-store';

/** Device keystore on Android/iOS. The web build uses secureStorage.web.ts instead. */
export const secureStorage = {
  get: (key: string) => SecureStore.getItemAsync(key),
  set: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  remove: (key: string) => SecureStore.deleteItemAsync(key),
};
