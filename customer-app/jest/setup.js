// Native module mocks for unit tests
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// The app defaults to Hindi; unit tests assert the English copy
require('../src/i18n').useLanguageStore.setState({ lang: 'en' });
