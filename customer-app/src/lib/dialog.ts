import { Alert, Platform, type AlertButton } from 'react-native';

/**
 * Alert.alert on Android/iOS. React Native Web's Alert does nothing, so the browser build falls back to
 * window.alert / window.confirm (OK runs the first non-cancel button, Cancel runs the cancel button).
 */
export function showAlert(title: string, message?: string, buttons?: AlertButton[]) {
  if (Platform.OS !== 'web') {
    Alert.alert(title, message, buttons);
    return;
  }
  const text = message ? `${title}\n\n${message}` : title;
  const cancel = buttons?.find((b) => b.style === 'cancel');
  const action = buttons?.find((b) => b.style !== 'cancel');
  if (buttons && buttons.length > 1 && action) {
    if (window.confirm(`${text}\n\nOK = ${action.text ?? 'Continue'}`)) action.onPress?.();
    else cancel?.onPress?.();
    return;
  }
  window.alert(text);
  buttons?.[0]?.onPress?.();
}
