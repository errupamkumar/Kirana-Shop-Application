import Constants from 'expo-constants';
import { Platform } from 'react-native';

/** API origin from app.config.ts `extra.apiBaseUrl` (EXPO_PUBLIC_API_BASE_URL, default http://10.0.2.2:8080). */
const configured: string = (
  (Constants.expoConfig?.extra?.apiBaseUrl as string | undefined) ??
  process.env.EXPO_PUBLIC_API_BASE_URL ??
  'http://10.0.2.2:8080'
).replace(/\/$/, '');

/** 10.0.2.2 is the Android emulator's alias for the PC; the browser build talks to localhost directly. */
export const API_BASE_URL = Platform.OS === 'web' ? configured.replace('10.0.2.2', 'localhost') : configured;

/** Uploaded media is a server path (/media/...); absolute URLs pass through. */
export function mediaUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  return url.startsWith('/') ? `${API_BASE_URL}${url}` : url;
}
