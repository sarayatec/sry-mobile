import { requireNativeModule } from 'expo-modules-core';

let PipModule: any = null;
try {
  PipModule = requireNativeModule('Pip');
} catch {}

export function enterPiP(): void {
  if (!PipModule) return;
  try {
    PipModule.enter();
  } catch {}
}
