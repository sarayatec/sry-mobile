/**
 * Structured debug logger for SRY Field.
 *
 * Every line printed to adb logcat (tag "ReactNativeJS") follows this format:
 *   [HH:MM:SS.mmm] [js-main] [Component] [Method] STATE | key=val key=val
 *
 * To filter in logcat:
 *   adb logcat -s ReactNativeJS SRYLifecycle SRYService SRYModule
 */

function ts(): string {
  const d = new Date();
  const h  = String(d.getHours()).padStart(2, '0');
  const m  = String(d.getMinutes()).padStart(2, '0');
  const s  = String(d.getSeconds()).padStart(2, '0');
  const ms = String(d.getMilliseconds()).padStart(3, '0');
  return `${h}:${m}:${s}.${ms}`;
}

export function sryLog(
  component: string,
  method: string,
  state: string,
  values?: Record<string, unknown>
): void {
  const valStr = values
    ? ' | ' + Object.entries(values).map(([k, v]) => `${k}=${v}`).join(' ')
    : '';
  console.log(`[${ts()}] [js-main] [${component}] [${method}] ${state}${valStr}`);
}
