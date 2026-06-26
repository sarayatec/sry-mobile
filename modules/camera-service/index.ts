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

// Keep screen on (black-screen streaming mode) — activity stays RESUMED so
// camera and audio never pause regardless of what the user does.
export function keepScreenOn(active: boolean): void {
  try { mod?.keepScreenOn(active); } catch {}
}

// Propagates the current streaming session UUID to the Android layer so all
// Kotlin log calls (CameraForegroundService, MainActivity lifecycle, etc.)
// include the same session ID as the JS logs.
export function setNativeSessionId(sessionId: string): void {
  try { mod?.setSessionId(sessionId); } catch {}
}

export function isBatteryOptimizationIgnored(): boolean {
  try { return !!mod?.isBatteryOptimizationIgnored(); } catch { return false; }
}

export function requestDisableBatteryOptimization(): void {
  try { mod?.requestDisableBatteryOptimization(); } catch {}
}

// ── Debug file I/O ────────────────────────────────────────────────────────────

export function writeDebugLog(line: string): void {
  try { mod?.writeDebugLog(line); } catch {}
}

export function writeCrashLog(line: string): void {
  try { mod?.writeCrashLog(line); } catch {}
}

// Read last N lines of debug.log (pass 0 for all). Returns empty string if none.
export function readDebugLog(maxLines = 200): string {
  try { return mod?.readDebugLog(maxLines) ?? ''; } catch { return ''; }
}

export function readCrashLog(): string {
  try { return mod?.readCrashLog() ?? ''; } catch { return ''; }
}

// Create debug.zip in app-specific external storage.
// Pass a JSON string snapshot of current runtime state.
// Returns absolute path to the zip file.
export function exportLogs(stateJson: string): string {
  try { return mod?.exportLogs(stateJson) ?? ''; } catch { return ''; }
}

export function getDeviceInfo(): string {
  try { return mod?.getDeviceInfo() ?? '{}'; } catch { return '{}'; }
}

export function clearDebugLogs(): void {
  try { mod?.clearLogs(); } catch {}
}

export function getWakeLockHeld(): boolean {
  try { return !!mod?.getWakeLockHeld(); } catch { return false; }
}
