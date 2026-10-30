import { MessageSquareText } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NarrowColumn } from '../components/Screen';
import { Button } from '../components/ui';
import { api, errorMessage } from '../lib/api';
import type { CustomerAuthResponse } from '../lib/types';
import type { AuthScreenProps } from '../navigation/types';
import { useAuthStore } from '../store/session';
import { colors } from '../theme';

const CODE_LENGTH = 6;

export function OtpScreen({ route, navigation }: AuthScreenProps<'Otp'>) {
  const phone = route.params?.phone;
  const signIn = useAuthStore((s) => s.signIn);
  const [otp, setOtp] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [wait, setWait] = useState(Number(route.params?.resendAfterSeconds ?? 30));

  // Opened without a phone (e.g. browser refresh on this page): start again from the login screen
  useEffect(() => {
    if (!phone) navigation.replace('Login');
  }, [phone, navigation]);

  useEffect(() => {
    if (wait <= 0) return;
    const timer = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(timer);
  }, [wait]);

  async function verify(code = otp) {
    if (code.length !== CODE_LENGTH || loading) return;
    setError(null);
    setLoading(true);
    try {
      const { data } = await api.post<CustomerAuthResponse>('/app/auth/otp/verify', { phone, otp: code });
      await signIn(data);
    } catch (e) {
      setError(errorMessage(e));
      setOtp('');
      setLoading(false);
    }
  }

  async function resend() {
    setError(null);
    try {
      const { data } = await api.post<{ resendAfterSeconds: number }>('/app/auth/otp/send', { phone });
      setWait(data.resendAfterSeconds);
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  if (!phone) return null;

  return (
    <SafeAreaView edges={['bottom']} className="flex-1 bg-white">
      <KeyboardAvoidingView behavior="padding" className="flex-1">
        <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 24 }} keyboardShouldPersistTaps="handled">
          <NarrowColumn maxWidth={440} className="flex-1">
            <View className="h-14 w-14 items-center justify-center rounded-2xl bg-brand-50">
              <MessageSquareText size={26} color={colors.brand} />
            </View>
            <Text accessibilityRole="header" className="mt-5 text-2xl font-extrabold text-gray-900">
              Enter verification code
            </Text>
            <Text className="mt-2 text-gray-500">
              Sent by SMS to <Text className="font-bold text-gray-800">+91 {phone}</Text>
            </Text>

            {/* One input, drawn as six boxes: works with SMS autofill and paste */}
            <Pressable accessible={false} className="mt-8">
              <View className="flex-row justify-between" pointerEvents="none">
                {Array.from({ length: CODE_LENGTH }, (_, i) => {
                  const active = i === otp.length && !loading;
                  return (
                    <View
                      key={i}
                      className={`h-14 w-12 items-center justify-center rounded-xl border-2 ${
                        error ? 'border-danger' : active ? 'border-brand-500' : otp[i] ? 'border-gray-400' : 'border-gray-200'
                      }`}
                    >
                      <Text className="text-2xl font-extrabold text-gray-900">{otp[i] ?? ''}</Text>
                    </View>
                  );
                })}
              </View>
              <TextInput
                accessibilityLabel="One time password"
                value={otp}
                onChangeText={(t) => {
                  const code = t.replace(/\D/g, '').slice(0, CODE_LENGTH);
                  setOtp(code);
                  setError(null);
                  if (code.length === CODE_LENGTH) void verify(code);
                }}
                keyboardType="number-pad"
                textContentType="oneTimeCode"
                autoComplete="sms-otp"
                maxLength={CODE_LENGTH}
                autoFocus
                caretHidden
                className="absolute inset-0 text-transparent"
                style={{ opacity: 0.02 }}
              />
            </Pressable>

            {error && (
              <Text accessibilityRole="alert" className="mt-3 text-danger">
                {error}
              </Text>
            )}
            <View className="mt-5 flex-row items-center">
              {wait > 0 ? (
                <Text className="text-gray-500">Resend code in {wait}s</Text>
              ) : (
                <Pressable accessibilityRole="button" onPress={() => void resend()} hitSlop={8}>
                  <Text className="font-bold text-brand-600">Resend code</Text>
                </Pressable>
              )}
              <Text className="mx-2 text-gray-300">·</Text>
              <Pressable accessibilityRole="button" onPress={() => navigation.goBack()} hitSlop={8}>
                <Text className="font-bold text-gray-600">Change number</Text>
              </Pressable>
            </View>
            <View className="flex-1" />
            <Button title="Verify and continue" className="mt-8" disabled={otp.length !== CODE_LENGTH} loading={loading} onPress={() => void verify()} />
          </NarrowColumn>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
