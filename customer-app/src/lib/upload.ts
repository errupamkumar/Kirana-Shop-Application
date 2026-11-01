import { Platform } from 'react-native';

/** A photo or recording on the device, as returned by the image picker or the audio recorder. */
export interface LocalFile {
  uri: string;
  name: string;
  type: string;
}

/** React Native's FormData takes {uri, name, type}; browsers need the actual Blob behind a blob: or data: URL. */
export async function appendFile(form: FormData, field: string, file: LocalFile): Promise<void> {
  if (Platform.OS === 'web') {
    const blob = await (await fetch(file.uri)).blob();
    form.append(field, blob, file.name);
    return;
  }
  form.append(field, { uri: file.uri, name: file.name, type: file.type } as unknown as Blob);
}

/** File name and type for a recording, from its URI (m4a on phones, webm in browsers). */
export function audioFile(uri: string, mimeType?: string | null): LocalFile {
  // Browsers record WebM behind an extension-less blob: URL; the server checks the real format from the bytes anyway
  const webm = mimeType?.includes('webm') || uri.endsWith('.webm') || (Platform.OS === 'web' && !mimeType);
  const ext = webm ? 'webm' : mimeType?.includes('ogg') ? 'ogg' : 'm4a';
  const type = ext === 'webm' ? 'audio/webm' : ext === 'ogg' ? 'audio/ogg' : 'audio/mp4';
  return { uri, name: `voice-note.${ext}`, type };
}
