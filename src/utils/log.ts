/**
 * Structured debug logger for SRY Field.
 *
 * Every line printed to adb logcat (tag "ReactNativeJS") follows this format:
 *   [HH:MM:SS.mmm] [js-main] [Session:xxxxxxxx] [Component] [Method] STATE | key=val
 *
 * Session ID is set once per streaming session via setLogSessionId().
 * All subsequent sryLog() calls include it automatically — no per-call change needed.
 *
 * To filter in logcat:
 *   adb logcat -s ReactNativeJS SRYLifecycle SRYService SRYModule
 *   adb logcat -s ReactNativeJS | grep "Session:6f8d7f40"
 */

let _sessionId    = 'none';
let _sessionShort = 'none';   // first 8 hex chars — used as the log prefix

function ts(): string {
  const d  = new Date();
  const h  = String(d.getHours()).padStart(2, '0');
  const m  = String(d.getMinutes()).padStart(2, '0');
  const s  = String(d.getSeconds()).padStart(2, '0');
  const ms = String(d.getMilliseconds()).padStart(3, '0');
  return `${h}:${m}:${s}.${ms}`;
}

/** Called by webrtc.ts whenever a new streaming session starts or ends. */
export function setLogSessionId(id: string): void {
  _sessionId    = id;
  _sessionShort = id === 'none' ? 'none' : id.substring(0, 8);
}

/** Returns the full UUID of the current streaming session. */
export function getLogSessionId(): string {
  return _sessionId;
}

export function sryLog(
  component: string,
  method: string,
  state: string,
  values?: Record<string, unknown>
): void {
  const sessionPrefix = `[Session:${_sessionShort}] `;
  const valStr = values
    ? ' | ' + Object.entries(values).map(([k, v]) => `${k}=${v}`).join(' ')
    : '';
  console.log(`[${ts()}] [js-main] ${sessionPrefix}[${component}] [${method}] ${state}${valStr}`);
}
