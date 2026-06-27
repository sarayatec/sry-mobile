/**
 * Debug Sync — uploads debug.zip to the server after every export.
 *
 * The server stores each session under:
 *   debug-sessions/YYYY-MM-DD_HH-mm-ss_SESSIONID/
 * and exposes:
 *   GET /api/debug/sessions/latest  ← for Claude "analyze latest session"
 *   GET /api/debug/sessions/:key
 *   GET /api/debug/sessions         ← list all
 */

import { writeBatchDebugLog } from '../../modules/camera-service';
import { useDebugStore } from '../stores/debugStore';

const UPLOAD_URL = 'https://sry.sarayatec.com/api/debug/upload';

export interface SyncResult {
  ok: boolean;
  sessionKey?: string;
  url?: string;
  error?: string;
}

/**
 * Flush in-memory logs to the native debug.log file, then upload the zip.
 * Call this BEFORE exportLogs() so the zip contains the actual log content.
 */
export function flushLogsToFile(): void {
  const { logs } = useDebugStore.getState();
  if (logs.length > 0) {
    writeBatchDebugLog(logs);
  }
}

/**
 * Upload a debug zip to the server.
 * @param zipPath - absolute path returned by exportLogs()
 * @param sessionId - streaming session UUID from debugStore
 * @param meta - runtime state snapshot (already built by DebugPanel)
 */
export async function uploadDebugZip(
  zipPath: string,
  sessionId: string,
  meta: Record<string, unknown>,
): Promise<SyncResult> {
  if (!zipPath || zipPath.startsWith('ERROR') || zipPath.trim() === '') {
    return { ok: false, error: 'Invalid zip path: ' + zipPath };
  }

  const sessionKey = _buildKey(sessionId);
  const uri = zipPath.startsWith('file://') ? zipPath : `file://${zipPath}`;
  const fileName = `${sessionKey}.zip`;

  try {
    const form = new FormData();
    // React Native FormData accepts { uri, type, name } objects
    form.append('file', { uri, type: 'application/zip', name: fileName } as unknown as Blob);
    form.append('sessionId', sessionId);
    form.append('sessionKey', sessionKey);
    form.append('meta', JSON.stringify(meta));

    const res = await fetch(UPLOAD_URL, {
      method: 'POST',
      body: form,
      // Do NOT set Content-Type — let fetch set multipart/form-data with boundary
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      return { ok: false, error: `HTTP ${res.status}: ${body.slice(0, 200)}` };
    }

    const json = (await res.json()) as { sessionKey: string; url: string };
    return { ok: true, sessionKey: json.sessionKey, url: json.url };
  } catch (e: unknown) {
    return { ok: false, error: (e as Error)?.message ?? String(e) };
  }
}

function _buildKey(sessionId: string): string {
  const d = new Date();
  const p = (n: number, w = 2) => String(n).padStart(w, '0');
  const date = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  const time = `${p(d.getHours())}-${p(d.getMinutes())}-${p(d.getSeconds())}`;
  const safe = sessionId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8) || 'unknown';
  return `${date}_${time}_${safe}`;
}
