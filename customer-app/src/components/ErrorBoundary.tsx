import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

interface State {
  error: Error | null;
}

/** Last line of defence: a render crash shows a recoverable screen instead of a blank app. */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Visible in Metro / logcat; a crash reporter (Sentry, Crashlytics) would hook in here
    console.error('App crashed', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <View className="flex-1 items-center justify-center bg-white p-8">
        <Text className="text-5xl">😕</Text>
        <Text className="mt-4 text-center text-xl font-extrabold text-gray-900">Something went wrong</Text>
        <Text className="mt-2 text-center text-gray-500">
          Sorry about that. Your cart is saved. Try again, and if it keeps happening, restart the app.
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => this.setState({ error: null })}
          className="mt-6 rounded-xl bg-brand-500 px-6 py-3 active:bg-brand-600"
        >
          <Text className="font-bold text-white">Try again</Text>
        </Pressable>
      </View>
    );
  }
}
