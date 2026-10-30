import { ShieldCheck, Smartphone } from 'lucide-react-native';
import { useState } from 'react';
import { KeyboardAvoidingView, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NarrowColumn } from '../components/Screen';
import { Button } from '../components/ui';
import { api, errorMessage } from '../lib/api';
import type { AuthScreenProps } from '../navigation/types';
import { colors } from '../theme';

export function isValidMobile(digits: string): boolean {
  return /^[6-9]\d{9}$/.test(digits);
}

export function LoginScreen({ navigation }: AuthScreenProps<'Login'>) {
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const valid = isValidMobile(phone);

  async function sendOtp() {
    if (!valid || loading) return;
    setError(null);
    setLoading(true);
    try {
      const { data } = await api.post<{ phone: string; resendAfterSeconds: number }>('/app/auth/otp/send', { phone });
      navigation.navigate('Otp', { phone, resendAfterSeconds: data.resendAfterSeconds });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
      {/* Padding on Android too: with edge-to-edge the window no longer resizes for the keyboard */}
      <KeyboardAvoidingView behavior="padding" className="flex-1">
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
          <View className="bg-accent px-6 pb-10 pt-12">
            <NarrowColumn maxWidth={440}>
              <View className="h-16 w-16 items-center justify-center rounded-2xl bg-white" style={{ elevation: 2 }}>
                <Text className="text-3xl">🛒</Text>
              </View>
              <Text accessibilityRole="header" className="mt-6 text-3xl font-extrabold leading-9 text-gray-900">
                Groceries from your neighbourhood kirana
              </Text>
              <Text className="mt-2 text-gray-800">Fresh stock, fair prices, delivered by the store you know.</Text>
            </NarrowColumn>
          </View>

          <View className="flex-1 px-6 pt-8">
            <NarrowColumn maxWidth={440} className="flex-1 justify-between">
              <View>
                <Text className="text-lg font-extrabold text-gray-900">Log in or sign up</Text>
                <Text className="mt-1 text-gray-500">We&apos;ll send a 6 digit code to your mobile number.</Text>
                <View
                  className={`mt-5 h-14 flex-row items-center rounded-xl border px-4 ${error ? 'border-danger' : 'border-gray-300'}`}
                >
                  <Smartphone size={20} color={colors.inkSoft} />
                  <Text className="ml-2 mr-2 text-base font-bold text-gray-800">+91</Text>
                  <TextInput
                    accessibilityLabel="Mobile number"
                    value={phone}
                    onChangeText={(t) => {
                      setPhone(t.replace(/\D/g, '').slice(0, 10));
                      setError(null);
                    }}
                    onSubmitEditing={() => void sendOtp()}
                    keyboardType="number-pad"
                    textContentType="telephoneNumber"
                    autoComplete="tel"
                    placeholder="10 digit mobile number"
                    placeholderTextColor={colors.muted}
                    maxLength={10}
                    autoFocus
                    className="h-full flex-1 text-base tracking-wider text-gray-900"
                  />
                </View>
                {error ? (
                  <Text accessibilityRole="alert" className="mt-2 text-danger">
                    {error}
                  </Text>
                ) : (
                  phone.length === 10 &&
                  !valid && <Text className="mt-2 text-danger">Indian mobile numbers start with 6, 7, 8 or 9.</Text>
                )}
              </View>

              <View className="pb-6 pt-8">
                <Button title="Send OTP" disabled={!valid} loading={loading} onPress={() => void sendOtp()} />
                <View className="mt-4 flex-row items-center justify-center">
                  <ShieldCheck size={14} color={colors.muted} />
                  <Text className="ml-1 text-xs text-gray-400">Your number is only used to log in and for delivery updates.</Text>
                </View>
              </View>
            </NarrowColumn>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
