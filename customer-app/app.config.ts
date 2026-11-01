import type { ExpoConfig, ConfigContext } from 'expo/config';

// Load the monorepo root .env (does not override variables already set).
try {
  process.loadEnvFile('../.env');
} catch {
  // no root .env; fall back to the environment / defaults
}

// APP_ENV is set per build profile in eas.json; local development builds default to "development"
const appEnv = process.env.APP_ENV ?? 'development';
const isProduction = appEnv === 'production' || appEnv === 'preview';

// Default to HTTPS production API URL for preview/production builds, or Android emulator localhost for dev
const defaultApiBaseUrl = isProduction
  ? 'https://api.140-245-221-84.sslip.io'
  : 'http://10.0.2.2:8080';
const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL ?? defaultApiBaseUrl;

if (isProduction && !apiBaseUrl.startsWith('https://')) {
  throw new Error(`EXPO_PUBLIC_API_BASE_URL must be an https:// URL for ${appEnv} builds (got ${apiBaseUrl})`);
}

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Kirana',
  slug: 'kiranaapp',
  owner: 'rupamexpos-team',
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
    permissions: ['ACCESS_COARSE_LOCATION', 'ACCESS_FINE_LOCATION', 'CAMERA', 'RECORD_AUDIO'],
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
    // Order requests: a photo of a handwritten list and/or a voice note
    [
      'expo-image-picker',
      {
        photosPermission: 'Kirana uses your photos so you can send a picture of your shopping list to the store.',
        cameraPermission: 'Kirana uses the camera so you can photograph your shopping list for the store.',
      },
    ],
    [
      'expo-audio',
      {
        microphonePermission: 'Kirana uses the microphone so you can tell the store what you need in a voice note.',
      },
    ],
  ],
  extra: {
    apiBaseUrl,
    appEnv,
    eas: {
      projectId: '73e90c82-6673-46f1-9816-85fa22644261',
    },
  },
});