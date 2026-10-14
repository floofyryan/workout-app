import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

/** Lets the user pick a file and returns its text, or null if cancelled. */
export async function pickTextFile(types: string[]): Promise<string | null> {
  const res = await DocumentPicker.getDocumentAsync({ type: types, copyToCacheDirectory: true });
  if (res.canceled || !res.assets?.[0]) return null;
  return new File(res.assets[0].uri).text();
}

/** Writes text to a temp file and opens the share sheet (save to Drive, email, etc.). */
export async function shareTextFile(filename: string, content: string, mimeType: string) {
  const file = new File(Paths.cache, filename);
  if (file.exists) file.delete();
  file.create();
  file.write(content);
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, { mimeType, dialogTitle: filename });
  } else {
    throw new Error('Sharing is not available on this device.');
  }
}

export function dateStamp(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
