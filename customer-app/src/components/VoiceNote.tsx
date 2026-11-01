import { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus, useAudioRecorder, useAudioRecorderState } from 'expo-audio';
import { Mic, Pause, Play, RotateCcw, Square, Trash2 } from 'lucide-react-native';
import { useEffect, useRef } from 'react';
import { Pressable, Text, View } from 'react-native';
import { t as tNow, useT } from '../i18n';
import { showAlert } from '../lib/dialog';
import { audioFile, type LocalFile } from '../lib/upload';
import { colors } from '../theme';

/** Longest voice note the store will listen to. */
export const MAX_VOICE_SECONDS = 120;

export function formatSeconds(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Play / pause with a progress bar, for a local recording or the signed link from the server. */
export function VoiceNotePlayer({ uri, seconds }: { uri: string; seconds?: number | null }) {
  const t = useT();
  const player = useAudioPlayer(uri);
  const status = useAudioPlayerStatus(player);
  const total = status.duration > 0 ? status.duration : (seconds ?? 0);
  const progress = total > 0 ? Math.min(1, status.currentTime / total) : 0;

  useEffect(() => {
    if (status.didJustFinish) {
      player.pause();
      void player.seekTo(0);
    }
  }, [status.didJustFinish, player]);

  return (
    <View className="flex-row items-center rounded-xl bg-gray-100 p-2">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={status.playing ? t('request.pause') : t('request.play')}
        onPress={() => (status.playing ? player.pause() : player.play())}
        className="h-10 w-10 items-center justify-center rounded-full bg-brand-500 active:bg-brand-600"
      >
        {status.playing ? <Pause size={18} color={colors.white} /> : <Play size={18} color={colors.white} />}
      </Pressable>
      <View className="mx-3 h-1.5 flex-1 overflow-hidden rounded-full bg-gray-300">
        <View className="h-1.5 rounded-full bg-brand-500" style={{ width: `${progress * 100}%` }} />
      </View>
      <Text className="w-12 text-right text-sm font-semibold tabular-nums text-gray-700">
        {formatSeconds(status.playing || status.currentTime > 0 ? status.currentTime : total)}
      </Text>
    </View>
  );
}

/**
 * Record a voice note (m4a on phones, webm in browsers). Stops by itself at {@link MAX_VOICE_SECONDS}.
 * Reports the finished file through onRecorded; onRecorded(null) when it is deleted.
 */
export function VoiceRecorder({ value, seconds, onRecorded }: {
  value: LocalFile | null;
  seconds: number | null;
  onRecorded: (file: LocalFile | null, seconds: number | null) => void;
}) {
  const t = useT();
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const state = useAudioRecorderState(recorder, 250);
  const stopping = useRef(false);

  async function start() {
    try {
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) {
        showAlert(tNow('request.micDenied'), tNow('request.micDeniedBody'));
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
    } catch {
      showAlert(tNow('request.recordFailed'), tNow('request.micDeniedBody'));
    }
  }

  async function stop() {
    if (stopping.current) return;
    stopping.current = true;
    try {
      const recordedSeconds = state.durationMillis / 1000;
      await recorder.stop();
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
      const uri = recorder.uri ?? state.url;
      if (uri) onRecorded(audioFile(uri), recordedSeconds);
    } finally {
      stopping.current = false;
    }
  }

  // Stop at the time limit
  useEffect(() => {
    if (state.isRecording && state.durationMillis >= MAX_VOICE_SECONDS * 1000) void stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.isRecording, state.durationMillis]);

  if (state.isRecording) {
    return (
      <View className="flex-row items-center rounded-xl border border-red-200 bg-red-50 p-3">
        <View className="h-3 w-3 rounded-full bg-red-500" />
        <Text className="ml-2 flex-1 font-semibold tabular-nums text-red-700">
          {t('request.recording', { time: formatSeconds(state.durationMillis / 1000) })}
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => void stop()}
          className="flex-row items-center rounded-lg bg-red-600 px-3 py-2 active:bg-red-700"
        >
          <Square size={14} color={colors.white} fill={colors.white} />
          <Text className="ml-1.5 font-bold text-white">{t('request.stop')}</Text>
        </Pressable>
      </View>
    );
  }

  if (value) {
    return (
      <View className="gap-2">
        <VoiceNotePlayer key={value.uri} uri={value.uri} seconds={seconds} />
        <View className="flex-row gap-2">
          <Pressable accessibilityRole="button" onPress={() => void start()} className="flex-row items-center rounded-lg px-2 py-1.5 active:bg-gray-100">
            <RotateCcw size={14} color={colors.brandDark} />
            <Text className="ml-1 text-sm font-bold text-brand-600">{t('request.recordAgain')}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => onRecorded(null, null)} className="flex-row items-center rounded-lg px-2 py-1.5 active:bg-gray-100">
            <Trash2 size={14} color={colors.danger} />
            <Text className="ml-1 text-sm font-bold text-danger">{t('request.deleteVoice')}</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => void start()}
      className="flex-row items-center justify-center rounded-xl border-2 border-dashed border-brand-500 bg-brand-50 py-4 active:bg-brand-100"
    >
      <View className="h-11 w-11 items-center justify-center rounded-full bg-brand-500">
        <Mic size={22} color={colors.white} />
      </View>
      <Text className="ml-3 text-base font-bold text-brand-700">{t('request.record')}</Text>
    </Pressable>
  );
}
