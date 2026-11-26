import { Capacitor } from '@capacitor/core';
import { Clipboard } from '@capacitor/clipboard';

/** Copies text with the Capacitor Clipboard plugin, falling back to `navigator.clipboard` on the PWA. Works offline. */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (Capacitor.isNativePlatform()) await Clipboard.write({ string: text });
    else if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(text);
    else return false;
    return true;
  } catch {
    return false;
  }
}
