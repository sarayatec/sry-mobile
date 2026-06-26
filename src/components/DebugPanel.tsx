import { useRef, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Share,
  PermissionsAndroid,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDebugStore } from '../stores/debugStore';
import {
  readDebugLog,
  readCrashLog,
  getDeviceInfo,
  exportLogs,
  clearDebugLogs,
  getWakeLockHeld,
} from '../../modules/camera-service';

type StatusColor = 'ok' | 'warn' | 'err' | 'dim';

function statusColor(color: StatusColor): string {
  switch (color) {
    case 'ok':   return '#22c55e';
    case 'warn': return '#f59e0b';
    case 'err':  return '#ef4444';
    default:     return '#6b7280';
  }
}

function mediaColor(s: string): StatusColor {
  if (s === 'ok')     return 'ok';
  if (s === 'error' || s === 'denied') return 'err';
  return 'dim';
}

function fgsColor(s: string): StatusColor {
  if (s === 'running') return 'ok';
  if (s === 'failed' || s === 'crashed') return 'err';
  return 'dim';
}

function socketColor(s: string): StatusColor {
  if (s === 'connected')   return 'ok';
  if (s === 'connecting')  return 'warn';
  if (s === 'error')       return 'err';
  return 'dim';
}

function iceColor(s: string): StatusColor {
  if (s === 'connected' || s === 'completed') return 'ok';
  if (s === 'failed' || s === 'closed')       return 'err';
  if (s === 'checking')                        return 'warn';
  return 'dim';
}

function Row({ label, value, color }: { label: string; value: string; color?: StatusColor }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, color ? { color: statusColor(color) } : null]}>{value}</Text>
    </View>
  );
}

interface Props {
  visible: boolean;
  onClose(): void;
}

export default function DebugPanel({ visible, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const logsRef = useRef<ScrollView>(null);

  const {
    cameraStatus, micStatus, fgsStatus, socketStatus, socketId,
    iceState, turnState, wakeLockHeld, sessionId, currentException,
    logs, clearLogs,
  } = useDebugStore();

  const handleExport = useCallback(async () => {
    try {
      // Build runtime state snapshot
      const state = {
        cameraStatus, micStatus, fgsStatus, socketStatus, socketId,
        iceState, turnState, wakeLockHeld: getWakeLockHeld(), sessionId, currentException,
        logLineCount: logs.length,
        exportedAt: new Date().toISOString(),
      };
      const stateJson = JSON.stringify(state, null, 2);

      // Try to create zip in external files dir
      const zipPath = exportLogs(stateJson);

      // Always share as text (works on any device without file manager)
      const debugText = readDebugLog(500);
      const crashText = readCrashLog();
      const deviceInfo = getDeviceInfo();

      const shareText = [
        '=== DEVICE INFO ===',
        deviceInfo,
        '',
        '=== RUNTIME STATE ===',
        stateJson,
        '',
        '=== CRASH LOG ===',
        crashText || '(empty)',
        '',
        '=== DEBUG LOG (last 500 lines) ===',
        debugText || '(empty)',
      ].join('\n');

      await Share.share({
        message: shareText,
        title: 'SRY Debug Logs',
      });

      if (zipPath && !zipPath.startsWith('ERROR')) {
        // Show zip path as additional info
        Share.share({
          message: `Zip saved to: ${zipPath}\n\nYou can access it via file manager under Android/data/com.sarayatec.sryfield/files/`,
          title: 'SRY Zip Path',
        }).catch(() => {});
      }
    } catch (err) {
      Share.share({ message: `Export failed: ${String(err)}`, title: 'Export Error' }).catch(() => {});
    }
  }, [cameraStatus, micStatus, fgsStatus, socketStatus, socketId, iceState, turnState, sessionId, currentException, logs]);

  const handleClear = useCallback(() => {
    clearLogs();
    clearDebugLogs();
  }, [clearLogs]);

  // Check permissions on demand
  const handleCheckPerms = useCallback(async () => {
    if (Platform.OS !== 'android') return;
    const results: Record<string, string> = {};
    const perms = [
      'CAMERA', 'RECORD_AUDIO', 'ACCESS_FINE_LOCATION',
      'ACCESS_BACKGROUND_LOCATION', 'POST_NOTIFICATIONS',
    ] as const;
    for (const p of perms) {
      const key = (PermissionsAndroid.PERMISSIONS as any)[p];
      if (key) {
        try {
          results[p] = await PermissionsAndroid.check(key) ? 'granted' : 'denied';
        } catch {
          results[p] = 'error';
        }
      }
    }
    useDebugStore.getState().setPermissions(results);
    useDebugStore.getState().setWakeLock(getWakeLockHeld());
  }, []);

  const permissions = useDebugStore((s) => s.permissions);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>تشخيص النظام</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          {/* Status section */}
          <Text style={styles.section}>الحالة</Text>
          <Row label="الكاميرا"          value={cameraStatus}  color={mediaColor(cameraStatus)} />
          <Row label="الميكروفون"         value={micStatus}     color={mediaColor(micStatus)} />
          <Row label="خدمة الخلفية (FGS)" value={fgsStatus}     color={fgsColor(fgsStatus)} />
          <Row label="Socket"             value={socketStatus}  color={socketColor(socketStatus)} />
          {socketId ? <Row label="Socket ID" value={socketId.substring(0, 16)} /> : null}
          <Row label="ICE State"          value={iceState}      color={iceColor(iceState)} />
          <Row label="TURN"               value={turnState}     color={turnState === 'ok' ? 'ok' : turnState === 'failed' ? 'err' : 'dim'} />
          <Row label="WakeLock"           value={wakeLockHeld ? 'held' : 'not held'} color={wakeLockHeld ? 'ok' : 'warn'} />
          <Row label="Session ID"         value={sessionId === 'none' ? 'none' : sessionId.substring(0, 8) + '…'} />

          {/* Exception */}
          {currentException ? (
            <>
              <Text style={[styles.section, { color: '#ef4444' }]}>آخر استثناء</Text>
              <View style={styles.exBox}>
                <Text style={styles.exText}>{currentException}</Text>
              </View>
            </>
          ) : null}

          {/* Permissions */}
          <View style={styles.permHeader}>
            <Text style={styles.section}>الأذونات</Text>
            <TouchableOpacity onPress={handleCheckPerms} style={styles.checkBtn}>
              <Text style={styles.checkBtnText}>تحقق</Text>
            </TouchableOpacity>
          </View>
          {Object.entries(permissions).map(([k, v]) => (
            <Row key={k} label={k} value={v} color={v === 'granted' ? 'ok' : 'err'} />
          ))}
          {Object.keys(permissions).length === 0 && (
            <Text style={styles.hint}>اضغط "تحقق" لعرض حالة الأذونات</Text>
          )}

          {/* Log lines */}
          <View style={styles.permHeader}>
            <Text style={styles.section}>السجل ({logs.length} سطر)</Text>
          </View>
          <ScrollView
            ref={logsRef}
            style={styles.logBox}
            onContentSizeChange={() => logsRef.current?.scrollToEnd({ animated: false })}
          >
            {logs.length === 0
              ? <Text style={styles.hint}>لا توجد سجلات بعد</Text>
              : logs.map((line, i) => (
                  <Text key={i} style={styles.logLine}>{line}</Text>
                ))
            }
          </ScrollView>

          {/* Action buttons */}
          <View style={styles.actions}>
            <TouchableOpacity onPress={handleExport} style={[styles.btn, styles.btnExport]}>
              <Text style={styles.btnText}>تصدير السجلات (debug.zip)</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleClear} style={[styles.btn, styles.btnClear]}>
              <Text style={styles.btnText}>مسح السجلات</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container:     { flex: 1, backgroundColor: '#0f172a' },
  header:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1e3a5f' },
  title:         { color: '#e2e8f0', fontSize: 18, fontWeight: '700' },
  closeBtn:      { padding: 6 },
  closeBtnText:  { color: '#94a3b8', fontSize: 20, fontWeight: '300' },
  scroll:        { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 40 },
  section:       { color: '#94a3b8', fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginTop: 16, marginBottom: 6 },
  row:           { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#1e293b' },
  label:         { color: '#94a3b8', fontSize: 13 },
  value:         { color: '#e2e8f0', fontSize: 13, fontFamily: 'monospace', flexShrink: 1, textAlign: 'right' },
  exBox:         { backgroundColor: '#1e1b4b', borderRadius: 6, padding: 10, marginBottom: 4 },
  exText:        { color: '#fca5a5', fontSize: 12, fontFamily: 'monospace' },
  permHeader:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  checkBtn:      { backgroundColor: '#1e3a5f', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4, marginTop: 12 },
  checkBtnText:  { color: '#93c5fd', fontSize: 12 },
  hint:          { color: '#475569', fontSize: 12, fontStyle: 'italic', paddingVertical: 6 },
  logBox:        { backgroundColor: '#020617', borderRadius: 6, padding: 8, maxHeight: 320, marginBottom: 8 },
  logLine:       { color: '#64748b', fontSize: 10, fontFamily: 'monospace', lineHeight: 15 },
  actions:       { marginTop: 12, gap: 10 },
  btn:           { paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  btnExport:     { backgroundColor: '#1d4ed8' },
  btnClear:      { backgroundColor: '#1e293b', borderWidth: 1, borderColor: '#475569' },
  btnText:       { color: '#e2e8f0', fontSize: 14, fontWeight: '600' },
});
