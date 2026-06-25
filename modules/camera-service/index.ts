import { requireNativeModule } from 'expo-modules-core';

let mod: any = null;
try { mod = requireNativeModule('CameraService'); } catch {}

// Persistent session foreground service — start on login, stop on logout.
export function startSessionService(): void {
  try { mod?.startSession(); } catch {}
}

export function stopSessionService(): void {
  try { mod?.stopSession(); } catch {}
}

// Toggle streaming flag (controls PiP) without stopping the session service.
export function setStreaming(active: boolean): void {
  try { mod?.setStreaming(active); } catch {}
}

// Back-compat
export function startCameraService(): void {
  try { mod?.setStreaming(true); } catch {}
}

export function stopCameraService(): void {
  try { mod?.setStreaming(false); } catch {}
}

export function isBatteryOptimizationIgnored(): boolean {
  try { return !!mod?.isBatteryOptimizationIgnored(); } catch { return false; }
}

export function requestDisableBatteryOptimization(): void {
  try { mod?.requestDisableBatteryOptimization(); } catch {}
}
