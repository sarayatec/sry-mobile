import { Platform } from 'react-native';
import { requireNativeModule } from 'expo-modules-core';

let mod: any = null;
if (Platform.OS === 'android') {
  try { mod = requireNativeModule('BootModule'); } catch {}
}

export function isBootLaunch(): boolean {
  try { return mod?.isBootLaunch() ?? false; } catch { return false; }
}

export function moveToBackground(): void {
  try { mod?.moveToBackground(); } catch {}
}
