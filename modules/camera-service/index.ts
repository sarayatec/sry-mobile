import { requireNativeModule } from 'expo-modules-core';

let mod: any = null;
try { mod = requireNativeModule('CameraService'); } catch {}

export function startCameraService(): void {
  try { mod?.start(); } catch {}
}

export function stopCameraService(): void {
  try { mod?.stop(); } catch {}
}

export function isBatteryOptimizationIgnored(): boolean {
  try { return !!mod?.isBatteryOptimizationIgnored(); } catch { return false; }
}

export function requestDisableBatteryOptimization(): void {
  try { mod?.requestDisableBatteryOptimization(); } catch {}
}
