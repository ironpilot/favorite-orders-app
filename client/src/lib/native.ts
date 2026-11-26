import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';
import { Keyboard, KeyboardStyle } from '@capacitor/keyboard';

export const isNative = (): boolean => Capacitor.isNativePlatform();

async function applyTheme(dark: boolean): Promise<void> {
  await StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light }).catch(() => undefined);
  if (Capacitor.getPlatform() === 'ios') {
    await Keyboard.setStyle({ style: dark ? KeyboardStyle.Dark : KeyboardStyle.Light }).catch(() => undefined);
  }
}

/** Native polish (status bar, splash screen, keyboard) following the system light/dark theme. No-op on the web/PWA. */
export async function initNative(): Promise<void> {
  if (!isNative()) return;
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  await applyTheme(media.matches);
  media.addEventListener('change', (e) => void applyTheme(e.matches));
  await SplashScreen.hide().catch(() => undefined);
}
