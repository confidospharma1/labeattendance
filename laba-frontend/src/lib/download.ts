import { Capacitor } from '@capacitor/core';

const blobToBase64 = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

/** Filename from a Content-Disposition header, if present. */
export function filenameFrom(disposition: string | undefined, fallback: string) {
  const m = /filename="?([^";]+)"?/i.exec(disposition || '');
  return m ? m[1] : fallback;
}

/**
 * Save a downloaded file. In a browser it triggers a normal download; inside the Android app
 * (where blob links do nothing) it writes the file to Documents/J-Track and opens the share sheet
 * so it can be opened in Excel, saved to Drive or sent on WhatsApp.
 * Resolves only once the file has been handed over, so callers can act on success.
 */
export async function saveFile(blob: Blob, filename: string): Promise<{ savedTo: string }> {
  if (Capacitor.isNativePlatform()) {
    const [{ Filesystem, Directory }, { Share }] = await Promise.all([import('@capacitor/filesystem'), import('@capacitor/share')]);
    const data = await blobToBase64(blob);
    let uri: string;
    let savedTo: string;
    try {
      const res = await Filesystem.writeFile({ path: `J-Track/${filename}`, data, directory: Directory.Documents, recursive: true });
      uri = res.uri;
      savedTo = `Documents/J-Track/${filename}`;
    } catch {
      // Some Android versions refuse Documents without storage permission; the app cache always works.
      const res = await Filesystem.writeFile({ path: filename, data, directory: Directory.Cache });
      uri = res.uri;
      savedTo = 'the share sheet (save it to Files or Drive)';
    }
    try {
      await Share.share({ title: filename, url: uri, dialogTitle: 'Open or save the Excel file' });
    } catch {
      // Documents copy is already on the phone; a cache-only copy is lost if the share sheet is closed.
      if (!savedTo.startsWith('Documents')) throw new Error('The file was not saved. Choose where to save it in the share sheet.');
    }
    return { savedTo };
  }

  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => window.URL.revokeObjectURL(url), 30_000);
  return { savedTo: 'your Downloads folder' };
}
