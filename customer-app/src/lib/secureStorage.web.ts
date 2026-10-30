/**
 * Browser testing build: there is no keystore on the web, so tokens live in localStorage.
 * Fine for local testing; the real app stores them in the device keystore (secureStorage.ts).
 */
export const secureStorage = {
  get: async (key: string) => {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set: async (key: string, value: string) => {
    try {
      localStorage.setItem(key, value);
    } catch {
      // storage blocked (private mode): the session lasts until reload
    }
  },
  remove: async (key: string) => {
    try {
      localStorage.removeItem(key);
    } catch {
      // ignore
    }
  },
};
