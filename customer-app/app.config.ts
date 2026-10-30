import type { ExpoConfig, ConfigContext } from 'expo/config';

// Load the monorepo root .env (does not override variables already set).
try {
  process.loadEnvFile('../.env');
} catch {
  // no root .env; fall back to the environment / defaults
}

// Android emulator reaches the host machine at 10.0.2.2
const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://10.0.2.2:8080';

// APP_ENV is set per build profile in eas.json; local development builds default to "development"
const appEnv = process.env.APP_ENV ?? 'development';
const isProduction = appEnv === 'production' || appEnv === 'preview';
if (isProduction && !apiBaseUrl.startsWith('https://')) {
  throw new Error(`EXPO_PUBLIC_API_BASE_URL must be an https:// URL for ${appEnv} builds (got ${apiBaseUrl})`);
}

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Kirana',
  slug: 'kirana-customer',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'light',
  scheme: 'kirana',
  android: {
    package: 'com.kirana.customer',
    adaptiveIcon: {
      backgroundColor: '#0c831f',
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
    permissions: ['ACCESS_COARSE_LOCATION', 'ACCESS_FINE_LOCATION'],
  },
  plugins: [
    'expo-dev-client',
    'expo-secure-store',
    'expo-image',
    [
      'expo-build-properties',
      {
        // Only development builds may call the local backend over plain HTTP; release builds are HTTPS-only
        android: { usesCleartextTraffic: !isProduction },
      },
    ],
    [
      'expo-location',
      {
        locationWhenInUsePermission:
          'Kirana uses your location to check whether we deliver to you.',
      },
    ],
  ],
  extra: {
    apiBaseUrl,
    appEnv,
  },
});
