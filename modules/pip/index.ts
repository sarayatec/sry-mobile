import { requireNativeModule } from 'expo-modules-core';

let PipModule: any = null;
try {
  PipModule = requireNativeModule('Pip');
} catch {}

export function enterPiP(): void {
  if (!PipModule) return;
  try { PipModule.enter(); } catch {}
}

/** Android 12+: auto-enter PiP on Home press without JS intervention */
export function setAutoEnterPiP(enabled: boolean): void {
  if (!PipModule) return;
  try { PipModule.setAutoEnter(enabled); } catch {}
}

export function isPiPSupported(): boolean {
  if (!PipModule) return false;
  try { return PipModule.isSupported() === true; } catch { return false; }
}
