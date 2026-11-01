import { Image } from 'expo-image';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { Camera, ImagePlus, MapPin, Mic, NotebookPen, RefreshCw, Send, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { KeyboardAvoidingView, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NarrowColumn } from '../components/Screen';
import { toast } from '../components/Toast';
import { Button, Card, SectionTitle } from '../components/ui';
import { VoiceRecorder } from '../components/VoiceNote';
import { useAddresses, useCreateRequest, useStoreConfig } from '../hooks/queries';
import { addressLabel, t as tNow, useT } from '../i18n';
import { apiError, errorMessage } from '../lib/api';
import { showAlert } from '../lib/dialog';
import type { LocalFile } from '../lib/upload';
import type { AppScreenProps } from '../navigation/types';
import { useCheckoutStore } from '../store/session';
import { colors } from '../theme';

/** Long side of the uploaded list photo: sharp enough to read handwriting, small enough for a slow connection. */
const PHOTO_MAX_SIDE = 1600;

async function shrink(asset: ImagePicker.ImagePickerAsset): Promise<LocalFile> {
  const landscape = (asset.width ?? 0) > (asset.height ?? 0);
  const context = ImageManipulator.manipulate(asset.uri);
  if (Math.max(asset.width ?? 0, asset.height ?? 0) > PHOTO_MAX_SIDE) {
    context.resize(landscape ? { width: PHOTO_MAX_SIDE } : { height: PHOTO_MAX_SIDE });
  }
  const image = await context.renderAsync();
  const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.72 });
  return { uri: saved.uri, name: 'shopping-list.jpg', type: 'image/jpeg' };
}

function PhotoCard({ photo, onChange }: { photo: LocalFile | null; onChange: (file: LocalFile | null) => void }) {
  const t = useT();
  const [busy, setBusy] = useState(false);

  async function pick(source: 'camera' | 'gallery') {
    try {
      if (source === 'camera') {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          showAlert(tNow('request.cameraDenied'), tNow('request.cameraDeniedBody'));
          return;
        }
      }
      const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.9 };
      const result = source === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
      if (result.canceled || !result.assets[0]) return;
      setBusy(true);
      onChange(await shrink(result.assets[0]));
    } catch {
      showAlert(tNow('request.photoFailed'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <SectionTitle title={t('request.photoTitle')} icon={NotebookPen} />
      {photo ? (
        <View>
          <Image
            source={{ uri: photo.uri }}
            accessibilityLabel={t('request.photoA11y')}
            contentFit="contain"
            style={{ width: '100%', height: 340, borderRadius: 12, backgroundColor: '#f3f4f6' }}
          />
          <View className="mt-2 flex-row gap-2">
            <Pressable accessibilityRole="button" onPress={() => void pick('camera')} className="flex-row items-center rounded-lg px-2 py-1.5 active:bg-gray-100">
              <RefreshCw size={14} color={colors.brandDark} />
              <Text className="ml-1 text-sm font-bold text-brand-600">{t('request.retake')}</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => onChange(null)} className="flex-row items-center rounded-lg px-2 py-1.5 active:bg-gray-100">
              <Trash2 size={14} color={colors.danger} />
              <Text className="ml-1 text-sm font-bold text-danger">{t('request.removePhoto')}</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <View>
          <Text className="mb-3 text-sm text-gray-600">{t('request.photoHint')}</Text>
          <View className="flex-row gap-2">
            <Button title={t('request.takePhoto')} icon={Camera} className="flex-1" loading={busy} onPress={() => void pick('camera')} />
            <Button title={t('request.choosePhoto')} icon={ImagePlus} variant="outline" className="flex-1" disabled={busy} onPress={() => void pick('gallery')} />
          </View>
        </View>
      )}
    </Card>
  );
}

export function RequestOrderScreen({ navigation, route }: AppScreenProps<'RequestOrder'>) {
  const t = useT();
  const insets = useSafeAreaInsets();
  const voiceFirst = route.params?.mode === 'voice';
  const config = useStoreConfig();
  const addresses = useAddresses();
  const selectedId = useCheckoutStore((s) => s.addressId);
  const address = addresses.data?.find((a) => a.id === selectedId) ?? addresses.data?.find((a) => a.isDefault) ?? addresses.data?.[0];
  const create = useCreateRequest();
  const [photo, setPhoto] = useState<LocalFile | null>(null);
  const [voice, setVoice] = useState<LocalFile | null>(null);
  const [voiceSeconds, setVoiceSeconds] = useState<number | null>(null);
  const [note, setNote] = useState('');

  const closed = config.data != null && !config.data.storeOpen;
  const blocked = closed ? t('request.closed') : !photo && !voice ? t('request.needMedia') : !address ? t('request.needAddress') : null;

  function send() {
    if (!address || blocked) return;
    create.mutate(
      { addressId: address.id, image: photo, audio: voice, audioSeconds: voiceSeconds, note },
      {
        onSuccess: (request) => {
          toast.success(tNow('request.sent'));
          navigation.replace('RequestDetail', { requestId: request.id });
        },
        onError: (e) =>
          showAlert(tNow('request.sendFailed'), apiError(e)?.code === 'TOO_MANY_ATTEMPTS' ? tNow('request.tooMany') : errorMessage(e)),
      },
    );
  }

  const photoCard = <PhotoCard photo={photo} onChange={setPhoto} />;
  const voiceCard = (
    <Card>
      <SectionTitle title={t('request.voiceTitle')} icon={Mic} />
      <Text className="mb-3 text-sm text-gray-600">{t('request.voiceHint')}</Text>
      <VoiceRecorder
        value={voice}
        seconds={voiceSeconds}
        onRecorded={(file, seconds) => {
          setVoice(file);
          setVoiceSeconds(seconds);
        }}
      />
    </Card>
  );

  return (
    <KeyboardAvoidingView behavior="padding" className="flex-1">
      <ScrollView className="flex-1 bg-gray-50" contentContainerStyle={{ padding: 12, paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
        <NarrowColumn className="gap-3">
          <View className="rounded-2xl bg-accent p-4">
            <Text className="leading-5 text-gray-900">{t('request.intro')}</Text>
          </View>

          {voiceFirst ? voiceCard : photoCard}
          {voiceFirst ? photoCard : voiceCard}

          <Card>
            <Text className="mb-1 text-sm font-semibold text-gray-700">{t('request.noteTitle')}</Text>
            <TextInput
              accessibilityLabel={t('request.noteTitle')}
              value={note}
              onChangeText={setNote}
              maxLength={500}
              multiline
              placeholder={t('request.notePlaceholder')}
              placeholderTextColor={colors.muted}
              className="min-h-[64px] rounded-xl border border-gray-300 px-3 py-2 text-gray-900"
              style={{ textAlignVertical: 'top' }}
            />
          </Card>

          <Card>
            <SectionTitle
              title={t('request.deliverTo')}
              icon={MapPin}
              right={
                <Pressable
                  accessibilityRole="button"
                  hitSlop={8}
                  onPress={() => (address ? navigation.navigate('Addresses', { select: true }) : navigation.navigate('AddressForm'))}
                >
                  <Text className="font-bold text-brand-600">{address ? t('common.change') : t('request.addAddress')}</Text>
                </Pressable>
              }
            />
            {address ? (
              <Text className="text-gray-700">
                <Text className="font-bold text-gray-900">{addressLabel(address.label)}</Text> · {address.line1}
                {address.line2 ? `, ${address.line2}` : ''} · {address.pincode}
              </Text>
            ) : (
              <Text className="text-gray-500">{t('request.needAddress')}</Text>
            )}
          </Card>
        </NarrowColumn>
      </ScrollView>

      <View className="border-t border-gray-100 bg-white px-4 pt-3" style={{ paddingBottom: Math.max(insets.bottom, 12) }}>
        <NarrowColumn>
          <Text className={`mb-2 text-center text-sm ${blocked ? 'font-semibold text-gray-600' : 'text-gray-500'}`}>{blocked ?? t('request.sendHint')}</Text>
          <Button
            title={create.isPending ? t('request.sending') : t('request.send')}
            icon={Send}
            disabled={!!blocked}
            loading={create.isPending}
            onPress={send}
          />
        </NarrowColumn>
      </View>
    </KeyboardAvoidingView>
  );
}
