import { AppState, AppStateStatus, Platform } from 'react-native';
import { io, Socket } from 'socket.io-client';
import { enterPiP, setAutoEnterPiP } from '../../modules/pip';
import { startSessionService, stopSessionService, setStreaming, setNativeSessionId } from '../../modules/camera-service';
import {
  mediaDevices,
  RTCPeerConnection,
  RTCIceCandidate,
  RTCSessionDescription,
  MediaStream,
} from 'react-native-webrtc';
import * as Notifications from 'expo-notifications';
import { sryLog, setLogSessionId } from '../utils/log';
import { useDebugStore } from '../stores/debugStore';
import { writeCrashLog } from '../../modules/camera-service';

const SIGNAL_URL = 'https://sry.sarayatec.com';
const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  {
    urls: [
      'turn:152.42.210.72:3478',
      'turn:152.42.210.72:3478?transport=tcp',
    ],
    username: 'sryuser',
    credential: 'Sry2024turn',
  },
];

let socket: Socket | null = null;
let localStream: MediaStream | null = null;
let streamPromise: Promise<MediaStream> | null = null;
let peerConns: Record<string, RTCPeerConnection> = {};
let currentFacingMode: 'environment' | 'user' = 'environment';
let appStateSubscription: ReturnType<typeof AppState.addEventListener> | null = null;
let bgNotifId: string | null = null;
// Guard: prevents releaseStream() during peer reconnect (handleOffer closes old peer
// which fires connectionstatechange → closePeer before new peer is established).
let isReconnecting = false;
// Background track monitor — polls readyState every 5s while in background
let _bgMonitorInterval: ReturnType<typeof setInterval> | null = null;

// ── ICE candidate queue ───────────────────────────────────────────────────────
// Candidates that arrive before RTCPeerConnection exists or before
// setRemoteDescription() completes are stored here keyed by adminSocketId.
// They are flushed immediately after setRemoteDescription() resolves.
const pendingCandidates: Record<string, RTCIceCandidateInit[]> = {};
// Tracks which peers have had setRemoteDescription() complete — only after
// this is true can we safely call addIceCandidate().
const remoteDescReady: Set<string> = new Set();
// ─────────────────────────────────────────────────────────────────────────────

// ── ICE-race instrumentation ──────────────────────────────────────────────────
let _probeOfferT = 0;
let _probePcT    = 0;
let _probeDropped   = 0;
let _probeAdded     = 0;
let _probeCandidateN = 0;

// ── ICE candidate tracking ────────────────────────────────────────────────────
interface _IceCandInfo { type: string; protocol: string; address: string; port: number; raw: string; }
let _localCandidates: _IceCandInfo[]  = [];
let _remoteCandidates: _IceCandInfo[] = [];
let _selectedPair: string | null = null;

function _parseCandInfo(candidate: any): _IceCandInfo {
  // SDP candidate line e.g.:
  // candidate:foundation 1 udp 2122194687 192.168.1.5 54321 typ host ...
  const raw   = String(candidate?.candidate ?? candidate ?? '');
  const parts = raw.split(' ');
  const proto   = (parts[2] ?? candidate?.protocol ?? 'unknown').toLowerCase();
  const addr    = parts[4] ?? candidate?.address ?? candidate?.ip ?? '?';
  const port    = parseInt(parts[5] ?? '0', 10);
  const typIdx  = parts.indexOf('typ');
  const type    = typIdx >= 0 ? (parts[typIdx + 1] ?? 'unknown') : (candidate?.type ?? 'unknown');
  return { type, protocol: proto, address: addr, port, raw: raw.substring(0, 120) };
}

function _iceCandLog(direction: 'LOCAL' | 'REMOTE', info: _IceCandInfo) {
  const line = `[ICE_CAND] ${direction} type=${info.type} proto=${info.protocol} addr=${info.address} port=${info.port}`;
  console.warn(line);
  useDebugStore.getState().addLog(line);
}

function _iceFailureSummary(label: string) {
  const localHost  = _localCandidates.filter(c => c.type === 'host');
  const localSrflx = _localCandidates.filter(c => c.type === 'srflx');
  const localRelay = _localCandidates.filter(c => c.type === 'relay');
  const remHost    = _remoteCandidates.filter(c => c.type === 'host');
  const remSrflx   = _remoteCandidates.filter(c => c.type === 'srflx');
  const remRelay   = _remoteCandidates.filter(c => c.type === 'relay');

  const lines = [
    `[ICE_SUMMARY] === ${label} ===`,
    `[ICE_SUMMARY] LOCAL  total=${_localCandidates.length} host=${localHost.length} srflx=${localSrflx.length} relay=${localRelay.length}`,
    `[ICE_SUMMARY] REMOTE total=${_remoteCandidates.length} host=${remHost.length} srflx=${remSrflx.length} relay=${remRelay.length}`,
    `[ICE_SUMMARY] SELECTED_PAIR=${_selectedPair ?? 'none'}`,
  ];

  _localCandidates.forEach((c, i) =>
    lines.push(`[ICE_SUMMARY] LOCAL[${i}] type=${c.type} proto=${c.protocol} addr=${c.address} port=${c.port}`));
  _remoteCandidates.forEach((c, i) =>
    lines.push(`[ICE_SUMMARY] REMOTE[${i}] type=${c.type} proto=${c.protocol} addr=${c.address} port=${c.port}`));

  lines.forEach(l => { console.warn(l); useDebugStore.getState().addLog(l); });
}
// ─────────────────────────────────────────────────────────────────────────────

function _probeIceLog(msg: string) {
  const rel = _probeOfferT > 0 ? `+${Date.now() - _probeOfferT}ms` : 'T+?';
  const line = `[ICE-PROBE] ${rel} ${msg}`;
  console.warn(line);
  try {
    const { useDebugStore } = require('../stores/debugStore');
    useDebugStore.getState().addLog(line);
  } catch (_) {}
}

// ── Queue lifecycle instrumentation ──────────────────────────────────────────
// Tracks every push, flush, add, and delete on pendingCandidates.
// Purpose: prove exactly where Queued=8 / Added=0 / Pending=0 occurs.
let _queueOfferPeerId = 'UNSET'; // peerId from the current handleOffer invocation

function _queueLog(msg: string) {
  const rel = _probeOfferT > 0 ? `+${Date.now() - _probeOfferT}ms` : 'T+?';
  const line = `[QUEUE_LIFECYCLE] ${rel} ${msg}`;
  console.warn(line);
  try {
    const { useDebugStore } = require('../stores/debugStore');
    useDebugStore.getState().addLog(line);
  } catch (_) {}
}

function _deletePendingCandidates(peerId: string, reason: string) {
  const sizeBefore = pendingCandidates[peerId]?.length ?? 0;
  delete pendingCandidates[peerId];
  _queueLog(`QUEUE_DELETE peerId=${peerId} reason=${reason} sizeBefore=${sizeBefore} offerPeerId=${_queueOfferPeerId} match=${peerId === _queueOfferPeerId}`);
}
// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

// ── Signaling-state instrumentation ──────────────────────────────────────────
// Temporary: proves which mechanism causes signalingState to be invalid at createAnswer.
// Remove after mechanism confirmed.
let _sigT0 = 0;               // Date.now() when current handleOffer started
let _sigInvocation = 0;       // increments each handleOffer call — detects concurrent invocations
let _sigPcId = 0;             // increments each new RTCPeerConnection — detects PC identity changes

function _diagTs(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}.${String(d.getMilliseconds()).padStart(3,'0')}`;
}

function _sigLog(invId: number, pcId: number, msg: string, pc?: any) {
  const rel = _sigT0 > 0 ? `+${Date.now() - _sigT0}ms` : 'T+?';
  const ss  = pc ? (pc.signalingState    ?? '?') : '-';
  const cs  = pc ? (pc.connectionState   ?? '?') : '-';
  const is  = pc ? (pc.iceConnectionState ?? '?') : '-';
  const line = `[SIG-PROBE] ${rel} inv=${invId} pc=${pcId} sig=${ss} conn=${cs} ice=${is} | ${msg}`;
  console.warn(line);
  try {
    const { useDebugStore } = require('../stores/debugStore');
    useDebugStore.getState().addLog(line);
  } catch (_) {}
}
// ─────────────────────────────────────────────────────────────────────────────

// ─── Session tracking ─────────────────────────────────────────────────────────
let currentSessionId  = 'none';
let sessionStartTime  = 0;       // Date.now() at session start

function generateSessionId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

function startSession(reason: string, adminSocketId: string) {
  currentSessionId = generateSessionId();
  sessionStartTime = Date.now();
  setLogSessionId(currentSessionId);
  setNativeSessionId(currentSessionId);
  useDebugStore.getState().setSessionId(currentSessionId);
  sryLog('Session', 'startSession', 'SESSION_STARTED', {
    sessionId: currentSessionId,
    reason,
    adminSocketId,
  });
}

function endSession(reason: string, extra?: Record<string, unknown>) {
  const durationSec = sessionStartTime > 0 ? Math.round((Date.now() - sessionStartTime) / 1000) : 0;
  sryLog('Session', 'endSession', 'SESSION_FINISHED', {
    sessionId: currentSessionId,
    durationSec,
    reason,
    streamAlive: !!localStream,
    streamLive: localStream?.getVideoTracks().some(t => t.readyState === 'live') ?? false,
    activePeers: Object.keys(peerConns).length,
    socketConnected: socket?.connected ?? false,
    ...extra,
  });
  currentSessionId = 'none';
  sessionStartTime = 0;
  setLogSessionId('none');
  setNativeSessionId('none');
  useDebugStore.getState().setSessionId('none');
}
// ─────────────────────────────────────────────────────────────────────────────

async function showBackgroundNotif() {
  if (bgNotifId) return;
  try {
    await Notifications.requestPermissionsAsync();
    const id = await Notifications.scheduleNotificationAsync({
      content: { title: 'SRY Field', body: 'جلسة العمل نشطة', sticky: true, data: { background: true } },
      trigger: null,
    });
    bgNotifId = id;
    sryLog('Notif', 'showBackgroundNotif', 'SHOWN', { notifId: id });
  } catch (err) {
    sryLog('Notif', 'showBackgroundNotif', 'ERROR', { err: String(err) });
  }
}

async function hideBackgroundNotif() {
  if (!bgNotifId) return;
  try { await Notifications.dismissNotificationAsync(bgNotifId); } catch {}
  sryLog('Notif', 'hideBackgroundNotif', 'DISMISSED', { notifId: bgNotifId });
  bgNotifId = null;
}

// ── Background camera continuity instrumentation ──────────────────────────────
// Attaches ended/mute/unmute listeners to every track on a stream so we can
// identify the FIRST event that kills the feed while the app is backgrounded.
function attachTrackListeners(stream: MediaStream) {
  stream.getTracks().forEach((track: any) => {
    track.addEventListener('ended', () => {
      sryLog('Camera', 'track', 'TRACK_ENDED', {
        kind: track.kind,
        id: (track.id ?? '').slice(0, 8),
        readyState: track.readyState,
        enabled: track.enabled,
        muted: track.muted,
        appState: AppState.currentState,
        peerCount: Object.keys(peerConns).length,
        iceStates: Object.entries(peerConns)
          .map(([id, pc]) => `${id.slice(-4)}:${(pc as any).iceConnectionState}`)
          .join(','),
      });
    });
    track.addEventListener('mute', () => {
      sryLog('Camera', 'track', 'TRACK_MUTED', {
        kind: track.kind,
        readyState: track.readyState,
        appState: AppState.currentState,
      });
    });
    track.addEventListener('unmute', () => {
      sryLog('Camera', 'track', 'TRACK_UNMUTED', {
        kind: track.kind,
        readyState: track.readyState,
        appState: AppState.currentState,
      });
    });
  });
  sryLog('Camera', 'attachTrackListeners', 'ATTACHED', {
    streamId: (stream as any).id?.slice(0, 8) ?? 'unknown',
    trackKinds: stream.getTracks().map((t: any) => t.kind).join(','),
  });
}

function _snapshotSenders(label: string) {
  Object.entries(peerConns).forEach(([peerId, pc]) => {
    const senders: any[] = (pc as any).getSenders?.() ?? [];
    senders.forEach((sender: any, i: number) => {
      sryLog('WebRTC', 'sender', label, {
        peerId: peerId.slice(-6),
        idx: i,
        kind: sender.track?.kind ?? 'none',
        readyState: sender.track?.readyState ?? 'none',
        enabled: sender.track?.enabled ?? false,
        muted: sender.track?.muted ?? false,
        iceState: (pc as any).iceConnectionState ?? 'unknown',
        connState: (pc as any).connectionState ?? 'unknown',
      });
    });
    if (senders.length === 0) {
      sryLog('WebRTC', 'sender', label, {
        peerId: peerId.slice(-6),
        senderCount: 0,
        iceState: (pc as any).iceConnectionState ?? 'unknown',
      });
    }
  });
}

function startBgMonitor() {
  if (_bgMonitorInterval) return;
  sryLog('BgMonitor', 'startBgMonitor', 'STARTED', {});
  _bgMonitorInterval = setInterval(() => {
    const videoTrack: any = localStream?.getVideoTracks()[0];
    const audioTrack: any = localStream?.getAudioTracks()[0];
    const appState = AppState.currentState;
    sryLog('BgMonitor', 'poll', 'TRACK_POLL', {
      appState,
      streamActive: (localStream as any)?.active ?? false,
      videoReadyState: videoTrack?.readyState ?? 'none',
      videoEnabled: videoTrack?.enabled ?? false,
      videoMuted: videoTrack?.muted ?? false,
      audioReadyState: audioTrack?.readyState ?? 'none',
      peerCount: Object.keys(peerConns).length,
      iceStates: Object.entries(peerConns)
        .map(([id, pc]) => `${id.slice(-4)}:${(pc as any).iceConnectionState}`)
        .join(','),
      connStates: Object.entries(peerConns)
        .map(([id, pc]) => `${id.slice(-4)}:${(pc as any).connectionState}`)
        .join(','),
    });
    // Snapshot sender tracks too — catches the moment sender.track goes to 'ended'
    _snapshotSenders('BG_POLL');
    // If track died while in background — this is the root event we're hunting
    if (videoTrack?.readyState === 'ended') {
      sryLog('BgMonitor', 'poll', 'VIDEO_ENDED_DETECTED_STOPPING_MONITOR', { appState });
      stopBgMonitor();
    }
  }, 5000);
}

function stopBgMonitor() {
  if (_bgMonitorInterval) {
    clearInterval(_bgMonitorInterval);
    _bgMonitorInterval = null;
    sryLog('BgMonitor', 'stopBgMonitor', 'STOPPED', {});
  }
}
// ─────────────────────────────────────────────────────────────────────────────

async function onAppStateChange(state: AppStateStatus) {
  const peerCount = Object.keys(peerConns).length;
  const videoTrack: any = localStream?.getVideoTracks()[0];
  const audioTrack: any = localStream?.getAudioTracks()[0];
  sryLog('AppState', 'onAppStateChange', state.toUpperCase(), {
    peerCount,
    hasStream: !!localStream,
    streamActive: (localStream as any)?.active ?? false,
    videoReadyState: videoTrack?.readyState ?? 'none',
    videoEnabled: videoTrack?.enabled ?? false,
    videoMuted: videoTrack?.muted ?? false,
    audioReadyState: audioTrack?.readyState ?? 'none',
    socketConnected: socket?.connected ?? false,
  });
  // Snapshot sender state at the instant of AppState change
  _snapshotSenders(`APPSTATE_${state.toUpperCase()}`);

  // With Camera1 forced (see scripts/patch-webrtc-camera1.js) + camera-type
  // foreground service + WakeLock, capture continues with screen off and in
  // the background. So we DO NOT tear down the connection — we keep it alive.
  if (state === 'background' || state === 'inactive') {
    if (peerCount > 0) {
      sryLog('AppState', 'onAppStateChange', 'SHOW_BACKGROUND_NOTIF', { peerCount });
      await showBackgroundNotif();
      localStream?.getTracks().forEach(t => { t.enabled = true; });
      sryLog('AppState', 'onAppStateChange', 'TRACKS_ENABLED', {
        videoTracks: localStream?.getVideoTracks().length ?? 0,
        audioTracks: localStream?.getAudioTracks().length ?? 0,
      });
      if (Platform.OS === 'android') {
        sryLog('AppState', 'onAppStateChange', 'ENTER_PIP_SCHEDULED', {});
        setTimeout(() => {
          sryLog('AppState', 'onAppStateChange', 'ENTER_PIP_FIRING', {});
          enterPiP();
        }, 150);
      }
      // Start background monitor — polls track state every 5s to catch the exact moment it dies
      startBgMonitor();
    } else {
      sryLog('AppState', 'onAppStateChange', 'NO_PEERS_BACKGROUND', {});
    }
    // No releaseStream() — stream stays alive for next offer even with no peers.
  } else if (state === 'active') {
    stopBgMonitor();
    // Snapshot sender state immediately on return to foreground
    _snapshotSenders('APPSTATE_ACTIVE_RETURN');
    hideBackgroundNotif();
    if (Platform.OS === 'android' && peerCount > 0) {
      // Re-enable tracks in case Android disabled them; do NOT close the peer.
      localStream?.getTracks().forEach((t: any) => { t.enabled = true; });
      sryLog('AppState', 'onAppStateChange', 'TRACKS_RE_ENABLED_ACTIVE', { peerCount });
    } else if (Platform.OS === 'android' && peerCount === 0 && socket?.connected) {
      // Returned to foreground with no active stream — ask admin to re-offer.
      sryLog('AppState', 'onAppStateChange', 'EMIT_READY_FOR_STREAM', {});
      socket.emit('employee:ready-for-stream');
    }
  }
}

export function startSignaling(employeeId: string, name: string) {
  sryLog('Socket', 'startSignaling', 'CALLED', { employeeId, name });

  if (socket?.connected) {
    sryLog('Socket', 'startSignaling', 'ALREADY_CONNECTED', { socketId: socket.id });
    return;
  }

  // Start a persistent foreground service for the WHOLE session so the OS
  // (Samsung/Xiaomi) cannot kill the process when another app is opened or the
  // screen turns off. Without this, the socket disconnects and the employee
  // disappears from the admin dashboard.
  if (Platform.OS === 'android') {
    sryLog('Service', 'startSignaling', 'STARTING_SESSION_SERVICE', {});
    startSessionService();
    useDebugStore.getState().setFgs('running');
  }

  useDebugStore.getState().setSocket('connecting');
  appStateSubscription = AppState.addEventListener('change', onAppStateChange);
  sryLog('AppState', 'startSignaling', 'APPSTATE_LISTENER_REGISTERED', {});

  socket = io(SIGNAL_URL, {
    transports: ['websocket'],
    reconnection: true,
    reconnectionDelay: 3000,
  });
  sryLog('Socket', 'startSignaling', 'IO_CREATED', { url: SIGNAL_URL });

  socket.on('connect', () => {
    sryLog('Socket', 'connect', 'CONNECTED', { socketId: socket?.id });
    useDebugStore.getState().setSocket('connected', socket?.id ?? '');
    socket!.emit('employee:register', { employeeId, name });
    sryLog('Socket', 'connect', 'REGISTERED', { employeeId, name });
  });

  socket.on('disconnect', (reason) => {
    useDebugStore.getState().setSocket('disconnected');
    sryLog('Socket', 'disconnect', 'DISCONNECTED', {
      reason,
      peerCount: Object.keys(peerConns).length,
    });
    closeAllPeers();
  });

  socket.on('reconnect_attempt', (attempt: number) => {
    sryLog('Socket', 'reconnect_attempt', 'TRYING', { attempt });
  });

  socket.on('reconnect', (attempt: number) => {
    sryLog('Socket', 'reconnect', 'SUCCESS', { attempt, socketId: socket?.id });
  });

  socket.on('reconnect_error', (err: Error) => {
    sryLog('Socket', 'reconnect_error', 'FAILED', { err: err.message });
  });

  socket.on('reconnect_failed', () => {
    sryLog('Socket', 'reconnect_failed', 'EXHAUSTED', {});
  });

  socket.on('stream:start', () => {
    sryLog('Socket', 'stream:start', 'RECEIVED', {});
    /* intentionally empty */
  });

  socket.on('stream:stop', ({ adminSocketId }: { adminSocketId?: string }) => {
    sryLog('Socket', 'stream:stop', 'RECEIVED', {
      adminSocketId: adminSocketId ?? 'ALL',
      peerCount: Object.keys(peerConns).length,
    });
    if (adminSocketId) closePeer(adminSocketId);
    else closeAllPeers();
  });

  socket.on('camera:flip', ({ facingMode }: { facingMode: 'environment' | 'user' }) => {
    sryLog('Socket', 'camera:flip', 'RECEIVED', { facingMode });
    switchCamera(facingMode);
  });

  socket.on('webrtc:offer', async ({ from, offer }: { from: string; offer: RTCSessionDescriptionInit }) => {
    // ICE-race probe: reset counters and record offer arrival time
    _probeOfferT    = Date.now();
    _probePcT       = 0;
    _probeDropped   = 0;
    _probeAdded     = 0;
    _probeCandidateN = 0;
    // Reset ICE candidate tracking for this session
    _localCandidates  = [];
    _remoteCandidates = [];
    _selectedPair     = null;
    _probeIceLog(`OFFER received from=${from} type=${offer.type}`);
    useDebugStore.getState().resetSessionDiag();
    useDebugStore.getState().setOfferReceived(_diagTs());
    sryLog('WebRTC', 'webrtc:offer', 'RECEIVED', {
      from,
      offerType: offer.type,
      peerExists: !!peerConns[from],
    });
    await handleOffer(from, offer);
  });

  socket.on('webrtc:ice', ({ from, candidate }: { from: string; candidate: RTCIceCandidateInit }) => {
    if (!candidate) return;
    _probeCandidateN++;
    const pc = peerConns[from];
    const ready = remoteDescReady.has(from);

    if (pc && ready) {
      // Remote description is set — safe to add immediately
      _probeAdded++;
      const _remInfo = _parseCandInfo(candidate);
      _remoteCandidates.push(_remInfo);
      _iceCandLog('REMOTE', _remInfo);
      pc.addIceCandidate(new RTCIceCandidate(candidate));
      sryLog('WebRTC', 'webrtc:ice', 'ADDED', {
        from, n: _probeCandidateN, added: _probeAdded,
        queued: pendingCandidates[from]?.length ?? 0,
        type: (candidate as any).type ?? '?',
      });
    } else {
      // PC not created yet OR setRemoteDescription not complete — queue it
      if (!pendingCandidates[from]) pendingCandidates[from] = [];
      pendingCandidates[from].push(candidate);
      const qSize = pendingCandidates[from].length;
      _probeDropped = 0;
      // ── QUEUE_PUSH ────────────────────────────────────────────────────────
      _queueLog(`QUEUE_PUSH peerId=${from} queueLength=${qSize} offerPeerId=${_queueOfferPeerId} peerIdMatch=${from === _queueOfferPeerId} hasPc=${!!pc} remoteDescReady=${ready}`);
      // ─────────────────────────────────────────────────────────────────────
      sryLog('WebRTC', 'webrtc:ice', 'QUEUED', {
        from, n: _probeCandidateN, queueSize: qSize,
        hasPc: !!pc, remoteDescReady: ready,
        type: (candidate as any).type ?? '?',
      });
    }

    const store = useDebugStore.getState();
    store.setIceCounts(
      _probeCandidateN,
      _probeAdded,
      0,
      (pendingCandidates[from] ?? []).length,
    );
  });
}

export function stopSignaling() {
  sryLog('Socket', 'stopSignaling', 'CALLED', {
    peerCount: Object.keys(peerConns).length,
    hasStream: !!localStream,
  });

  // End the current session before tearing everything down
  if (currentSessionId !== 'none') {
    endSession('logout', {
      resourcesReleased: 'socket peers stream service',
      resourcesKept: 'none',
    });
  }

  appStateSubscription?.remove();
  appStateSubscription = null;
  hideBackgroundNotif();
  closeAllPeers();
  socket?.disconnect();
  socket = null;
  releaseStream();
  // Tear down the persistent session service on logout
  if (Platform.OS === 'android') {
    sryLog('Service', 'stopSignaling', 'STOPPING_SESSION_SERVICE', {});
    stopSessionService();
  }
}

function acquireStream(facingMode: 'environment' | 'user' = currentFacingMode): Promise<MediaStream> {
  sryLog('Camera', 'acquireStream', 'CALLED', {
    requestedFacing: facingMode,
    currentFacing: currentFacingMode,
    hasStream: !!localStream,
    streamLive: localStream?.getVideoTracks().some(t => t.readyState === 'live') ?? false,
    hasPromise: !!streamPromise,
  });

  if (localStream && facingMode === currentFacingMode) {
    sryLog('Camera', 'acquireStream', 'REUSED', {
      streamId: (localStream as any).id ?? 'unknown',
      videoTracks: localStream.getVideoTracks().length,
      audioTracks: localStream.getAudioTracks().length,
      videoState: localStream.getVideoTracks()[0]?.readyState ?? 'none',
      audioState: localStream.getAudioTracks()[0]?.readyState ?? 'none',
    });
    return Promise.resolve(localStream);
  }
  if (streamPromise && facingMode === currentFacingMode) {
    sryLog('Camera', 'acquireStream', 'AWAITING_EXISTING_PROMISE', { facingMode });
    return streamPromise;
  }
  releaseStream();
  currentFacingMode = facingMode;
  sryLog('Camera', 'acquireStream', 'CALLING_GETUSERMEDIA', { facingMode, width: 640, height: 480 });
  streamPromise = (mediaDevices.getUserMedia({
    video: { facingMode, width: 640, height: 480 },
    audio: true,
  }) as Promise<MediaStream>).then(stream => {
    localStream = stream;
    streamPromise = null;
    sryLog('Camera', 'getUserMedia', 'SUCCESS', {
      streamId: (stream as any).id ?? 'unknown',
      videoTracks: stream.getVideoTracks().length,
      audioTracks: stream.getAudioTracks().length,
      videoTrackId: stream.getVideoTracks()[0]?.id ?? 'none',
      audioTrackId: stream.getAudioTracks()[0]?.id ?? 'none',
      videoState: stream.getVideoTracks()[0]?.readyState ?? 'none',
      audioState: stream.getAudioTracks()[0]?.readyState ?? 'none',
    });
    // Attach ended/mute/unmute listeners so we catch the FIRST event that kills the track
    attachTrackListeners(stream);
    useDebugStore.getState().setCamera('ok');
    useDebugStore.getState().setMic(stream.getAudioTracks().length > 0 ? 'ok' : 'error');
    return stream;
  }).catch(err => {
    streamPromise = null;
    useDebugStore.getState().setCamera('error');
    useDebugStore.getState().setMic('error');
    useDebugStore.getState().setException(`getUserMedia: ${String(err)}`);
    writeCrashLog(`getUserMedia FAILED err=${String(err)}`);
    sryLog('Camera', 'getUserMedia', 'ERROR', { err: String(err), name: (err as any)?.name });
    throw err;
  });
  return streamPromise;
}

function releaseStream() {
  if (localStream) {
    const tracks = localStream.getTracks();
    sryLog('Camera', 'releaseStream', 'CALLED', {
      streamId: (localStream as any).id ?? 'unknown',
      trackCount: tracks.length,
      states: tracks.map(t => `${t.kind}:${t.readyState}`).join(','),
    });
    tracks.forEach(t => t.stop());
  } else {
    sryLog('Camera', 'releaseStream', 'CALLED_NO_STREAM', {});
  }
  localStream = null;
  streamPromise = null;
}

async function handleOffer(adminSocketId: string, offer: RTCSessionDescriptionInit) {
  // Record the peerId this handleOffer invocation owns — compared against ice handler peerId
  _queueOfferPeerId = adminSocketId;
  _queueLog(`QUEUE_OFFER_PEER_SET peerId=${adminSocketId} pendingAtEntry=${pendingCandidates[adminSocketId]?.length ?? 0}`);

  // Signaling probe: track concurrent invocations
  _sigT0 = Date.now();
  const _myInvId = ++_sigInvocation;
  _sigLog(_myInvId, 0, `ENTRY hasExistingPeer=${!!peerConns[adminSocketId]} concurrentInv=${_sigInvocation}`);

  // ── Session management ──────────────────────────────────────────────────────
  if (peerConns[adminSocketId]) {
    // Existing session ending — a new offer is replacing it
    endSession('new_offer_replacing', {
      adminSocketId,
      resourcesReleased: 'peer',
      resourcesKept: 'stream socket service',
    });
  }
  // Each offer (new or replacement) starts a fresh session
  startSession('offer_received', adminSocketId);
  // ────────────────────────────────────────────────────────────────────────────

  sryLog('WebRTC', 'handleOffer', 'ENTRY', {
    adminSocketId,
    offerType: offer.type,
    hasExistingPeer: !!peerConns[adminSocketId],
    totalPeers: Object.keys(peerConns).length,
    isReconnecting,
  });

  try {
    if (peerConns[adminSocketId]) {
      // Set guard BEFORE close() so the connectionstatechange event that fires
      // synchronously inside close() does not call releaseStream() via closePeer.
      isReconnecting = true;
      _queueLog(`QUEUE_OLD_PEER_CLOSE peerId=${adminSocketId} pendingBeforeClose=${pendingCandidates[adminSocketId]?.length ?? 0} isReconnecting=true`);
      sryLog('WebRTC', 'handleOffer', 'CLOSING_OLD_PEER', { adminSocketId });
      peerConns[adminSocketId].close();
      delete peerConns[adminSocketId];
      _queueLog(`QUEUE_OLD_PEER_CLOSED peerId=${adminSocketId} pendingAfterClose=${pendingCandidates[adminSocketId]?.length ?? 0} note=closePeer-may-have-fired-async`);
      sryLog('WebRTC', 'handleOffer', 'OLD_PEER_CLOSED', { adminSocketId });
    }

    // Mark streaming (enables PiP) — session service already running from login
    if (Platform.OS === 'android') {
      sryLog('Service', 'handleOffer', 'SET_STREAMING_TRUE', {});
      setStreaming(true);
      setAutoEnterPiP(true);
      sryLog('WebRTC', 'handleOffer', 'WAITING_PIP_SETUP', { delayMs: 400 });
      await new Promise(r => setTimeout(r, 400));
    }

    const isStreamAlive = localStream?.getVideoTracks().some(t => t.readyState === 'live');
    sryLog('Camera', 'handleOffer', 'STREAM_ALIVE_CHECK', {
      isStreamAlive: !!isStreamAlive,
      hasLocalStream: !!localStream,
      videoTrackState: localStream?.getVideoTracks()[0]?.readyState ?? 'none',
    });

    if (!isStreamAlive) {
      sryLog('Camera', 'handleOffer', 'RELEASING_DEAD_STREAM', {});
      releaseStream();
      sryLog('Camera', 'handleOffer', 'WAITING_AFTER_RELEASE', { delayMs: 300 });
      await new Promise(r => setTimeout(r, 300));
    }

    sryLog('Camera', 'handleOffer', 'ACQUIRING_STREAM', { facingMode: currentFacingMode });
    const stream = await acquireStream();
    if (!stream) {
      sryLog('Camera', 'handleOffer', 'ACQUIRE_RETURNED_NULL', {});
      return;
    }
    sryLog('Camera', 'handleOffer', 'STREAM_ACQUIRED', {
      streamId: (stream as any).id ?? 'unknown',
      videoTracks: stream.getVideoTracks().length,
      audioTracks: stream.getAudioTracks().length,
    });

    if (!isStreamAlive) {
      sryLog('Camera', 'handleOffer', 'WAITING_CAMERA_STABILIZE', { delayMs: 1500 });
      await new Promise(r => setTimeout(r, 1500));
    }

    sryLog('WebRTC', 'handleOffer', 'CREATING_PC', { adminSocketId });
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    const _myPcId = ++_sigPcId;
    peerConns[adminSocketId] = pc;
    isReconnecting = false; // new peer registered — safe to release stream again if needed
    _probePcT = Date.now();
    _probeIceLog(`PC created dropped_so_far=${_probeDropped} added_so_far=${_probeAdded} (candidates that arrived before this are lost)`);
    _sigLog(_myInvId, _myPcId, `PC_CREATED peerConnsHasMe=${peerConns[adminSocketId] === pc}`, pc);
    sryLog('WebRTC', 'handleOffer', 'PC_CREATED', { adminSocketId, isReconnecting });

    stream.getTracks().forEach(track => {
      sryLog('WebRTC', 'addTrack', track.kind.toUpperCase(), {
        trackId: track.id,
        kind: track.kind,
        readyState: track.readyState,
        enabled: track.enabled,
      });
      pc.addTrack(track, stream);
    });

    pc.addEventListener('icecandidate', (e: any) => {
      if (e.candidate) {
        const info = _parseCandInfo(e.candidate);
        _localCandidates.push(info);
        _iceCandLog('LOCAL', info);
        if (info.type === 'relay') useDebugStore.getState().setTurn('ok');
        sryLog('WebRTC', 'icecandidate', 'LOCAL_CANDIDATE', {
          type: info.type, protocol: info.protocol,
          address: info.address, port: info.port,
        });
        socket?.emit('webrtc:ice', { to: adminSocketId, candidate: e.candidate });
      } else {
        sryLog('WebRTC', 'icecandidate', 'GATHERING_COMPLETE', {});
      }
    });

    pc.addEventListener('selectedcandidatepairchange', (e: any) => {
      const local  = e.candidate?.local  ?? e.localCandidate;
      const remote = e.candidate?.remote ?? e.remoteCandidate;
      if (local && remote) {
        _selectedPair = `local:${local.type}/${local.protocol}/${local.address}:${local.port} ↔ remote:${remote.type}/${remote.protocol}/${remote.address}:${remote.port}`;
        sryLog('WebRTC', 'selectedcandidatepairchange', 'PAIR', { pair: _selectedPair });
      }
    });

    pc.addEventListener('iceconnectionstatechange', () => {
      const iceState = (pc as any).iceConnectionState ?? 'unknown';
      useDebugStore.getState().setIce(iceState);
      _probeIceLog(`ICE_STATE=${iceState} total_dropped=${_probeDropped} total_added=${_probeAdded}`);
      if (iceState === 'failed') {
        useDebugStore.getState().setTurn('failed');
        writeCrashLog(`ICE connection FAILED adminSocketId=${adminSocketId}`);
        _iceFailureSummary('ICE_FAILED');
      }
      sryLog('WebRTC', 'iceconnectionstatechange', iceState.toUpperCase(), {
        adminSocketId,
      });
    });

    pc.addEventListener('icegatheringstatechange', () => {
      sryLog('WebRTC', 'icegatheringstatechange', ((pc as any).iceGatheringState ?? 'unknown').toUpperCase(), {
        adminSocketId,
      });
    });

    pc.addEventListener('signalingstatechange', () => {
      sryLog('WebRTC', 'signalingstatechange', ((pc as any).signalingState ?? 'unknown').toUpperCase(), {
        adminSocketId,
      });
    });

    pc.addEventListener('connectionstatechange', () => {
      const s = (pc as any).connectionState;
      const peerConnsIsMe = peerConns[adminSocketId] === pc;
      _sigLog(_myInvId, _myPcId, `connectionstatechange=${s} peerConnsIsMe=${peerConnsIsMe} willClose=${s === 'failed' || s === 'closed'}`, pc);
      sryLog('WebRTC', 'connectionstatechange', (s ?? 'unknown').toUpperCase(), {
        adminSocketId,
        peerCount: Object.keys(peerConns).length,
      });
      if (s === 'failed' || s === 'closed') {
        // ── QUEUE_LIFECYCLE: log that connectionstatechange is triggering closePeer ──
        _queueLog(`QUEUE_CONN_STATE_TRIGGER_CLOSE peerId=${adminSocketId} connState=${s} pendingSize=${pendingCandidates[adminSocketId]?.length ?? 0} peerConnsIsMe=${peerConnsIsMe}`);
        // ─────────────────────────────────────────────────────────────────────────────
        closePeer(adminSocketId);
      }
    });

    _sigLog(_myInvId, _myPcId, `BEFORE_SET_REMOTE_DESC peerConnsIsMe=${peerConns[adminSocketId] === pc}`, pc);
    sryLog('WebRTC', 'handleOffer', 'SET_REMOTE_DESCRIPTION', { adminSocketId });
    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    // ── CRITICAL PROBE: signalingState immediately after setRemoteDescription ──
    _sigLog(_myInvId, _myPcId, `AFTER_SET_REMOTE_DESC peerConnsIsMe=${peerConns[adminSocketId] === pc}`, pc);
    _probeIceLog(`setRemoteDescription DONE signalingState=${(pc as any).signalingState}`);
    useDebugStore.getState().setRemoteDescApplied(_diagTs(), (pc as any).signalingState ?? 'unknown');

    // ── Flush queued ICE candidates ───────────────────────────────────────────
    remoteDescReady.add(adminSocketId);
    const queued = pendingCandidates[adminSocketId] ?? [];

    // BEFORE_FLUSH — always logged regardless of queue size
    _queueLog(`BEFORE_FLUSH peerId=${adminSocketId} queueLength=${queued.length} remoteDescNotNull=${pc.remoteDescription != null} allPendingKeys=${JSON.stringify(Object.keys(pendingCandidates))}`);

    if (queued.length > 0) {
      let _addedCount = 0;
      queued.forEach((c, i) => {
        try {
          const _remInfo = _parseCandInfo(c);
          _remoteCandidates.push(_remInfo);
          _iceCandLog('REMOTE', _remInfo);
          pc.addIceCandidate(new RTCIceCandidate(c));
          _probeAdded++;
          _addedCount++;
          _queueLog(`QUEUE_ADD_SUCCESS candidateIndex=${i} runningAdded=${_probeAdded} pcSigState=${(pc as any).signalingState ?? '?'}`);
        } catch (addErr) {
          _queueLog(`QUEUE_ADD_FAILURE candidateIndex=${i} error=${String(addErr)} pcSigState=${(pc as any).signalingState ?? '?'}`);
        }
      });
      _deletePendingCandidates(adminSocketId, 'flush_complete');
      // AFTER_FLUSH — logged only when loop body was reached
      _queueLog(`AFTER_FLUSH addedCount=${_addedCount} remainingQueue=${pendingCandidates[adminSocketId]?.length ?? 0}`);
    } else {
      _queueLog(`FLUSH_SKIPPED_EMPTY_QUEUE peerId=${adminSocketId} allPendingKeys=${JSON.stringify(Object.keys(pendingCandidates))}`);
    }

    // Update panel with final counts after flush
    useDebugStore.getState().setIceCounts(
      _probeCandidateN, _probeAdded, 0,
      (pendingCandidates[adminSocketId] ?? []).length,
    );
    // ─────────────────────────────────────────────────────────────────────────
    sryLog('WebRTC', 'handleOffer', 'SET_REMOTE_DESCRIPTION_DONE', {
      signalingState: (pc as any).signalingState,
    });

    // ── CRITICAL PROBE: signalingState immediately before createAnswer ────────
    _sigLog(_myInvId, _myPcId, `BEFORE_CREATE_ANSWER peerConnsIsMe=${peerConns[adminSocketId] === pc}`, pc);
    _probeIceLog('createAnswer START');
    sryLog('WebRTC', 'handleOffer', 'CREATE_ANSWER', { adminSocketId });
    const answer = await pc.createAnswer();
    _sigLog(_myInvId, _myPcId, `AFTER_CREATE_ANSWER peerConnsIsMe=${peerConns[adminSocketId] === pc}`, pc);
    _probeIceLog(`createAnswer DONE type=${answer.type}`);
    useDebugStore.getState().setAnswerCreated(_diagTs());
    sryLog('WebRTC', 'handleOffer', 'CREATE_ANSWER_DONE', { answerType: answer.type });

    await pc.setLocalDescription(answer);
    _sigLog(_myInvId, _myPcId, `AFTER_SET_LOCAL_DESC`, pc);
    sryLog('WebRTC', 'handleOffer', 'SET_LOCAL_DESCRIPTION_DONE', {
      signalingState: (pc as any).signalingState,
    });

    socket?.emit('webrtc:answer', { to: adminSocketId, answer });
    useDebugStore.getState().setAnswerSent(_diagTs());
    _probeIceLog(`ANSWER_SENT to=${adminSocketId} SUMMARY: dropped=${_probeDropped} added=${_probeAdded} pcCreatedAt=+${_probePcT - _probeOfferT}ms`);
    sryLog('WebRTC', 'handleOffer', 'ANSWER_SENT', { to: adminSocketId });

  } catch (err) {
    isReconnecting = false;
    // ── CRITICAL PROBE: state at the time of exception ────────────────────────
    _sigLog(_myInvId, _myPcId, `CATCH err=${String(err)} peerConnsIsMe=${peerConns[adminSocketId] === pc}`, pc);
    useDebugStore.getState().setException(`handleOffer: ${String(err)}`);
    writeCrashLog(`handleOffer ERROR adminSocketId=${adminSocketId} err=${String(err)}`);
    sryLog('WebRTC', 'handleOffer', 'ERROR', { err: String(err), adminSocketId });
    console.error('[webrtc] handleOffer error:', err);
  }
}

async function switchCamera(facingMode: 'environment' | 'user') {
  sryLog('Camera', 'switchCamera', 'CALLED', {
    requested: facingMode,
    current: currentFacingMode,
    peerCount: Object.keys(peerConns).length,
  });
  if (facingMode === currentFacingMode) {
    sryLog('Camera', 'switchCamera', 'SKIPPED_SAME_FACING', { facingMode });
    return;
  }
  try {
    releaseStream();
    const stream = await acquireStream(facingMode);
    const videoTrack = stream.getVideoTracks()[0];
    if (!videoTrack) {
      sryLog('Camera', 'switchCamera', 'NO_VIDEO_TRACK', {});
      return;
    }
    sryLog('Camera', 'switchCamera', 'REPLACING_TRACK', {
      newTrackId: videoTrack.id,
      newFacing: facingMode,
      peerCount: Object.keys(peerConns).length,
    });
    await Promise.all(
      Object.values(peerConns).map(async (pc: any) => {
        const sender = pc.getSenders?.().find((s: any) => s.track?.kind === 'video');
        if (sender) {
          await sender.replaceTrack(videoTrack);
          sryLog('Camera', 'switchCamera', 'TRACK_REPLACED', { newTrackId: videoTrack.id });
        } else {
          sryLog('Camera', 'switchCamera', 'NO_VIDEO_SENDER_FOUND', {});
        }
      })
    );
    sryLog('Camera', 'switchCamera', 'SUCCESS', { newFacing: facingMode });
  } catch (err) {
    sryLog('Camera', 'switchCamera', 'ERROR', { err: String(err) });
  }
}

function closePeer(adminSocketId: string) {
  const peerExists = !!peerConns[adminSocketId];
  const targetPc = peerConns[adminSocketId] as any;
  // ── QUEUE_LIFECYCLE: log closePeer call ───────────────────────────────────
  _queueLog(`QUEUE_CLOSE_PEER_CALLED peerId=${adminSocketId} pendingSize=${pendingCandidates[adminSocketId]?.length ?? 0} isReconnecting=${isReconnecting} offerPeerId=${_queueOfferPeerId} peerIdMatch=${adminSocketId === _queueOfferPeerId}`);
  // ─────────────────────────────────────────────────────────────────────────
  _sigLog(_sigInvocation, _sigPcId,
    `closePeer CALLED peerExists=${peerExists} sig=${targetPc?.signalingState ?? 'N/A'} conn=${targetPc?.connectionState ?? 'N/A'}`);
  sryLog('WebRTC', 'closePeer', 'CALLED', {
    adminSocketId,
    peerExists,
    isReconnecting,
    totalBefore: Object.keys(peerConns).length,
  });
  peerConns[adminSocketId]?.close();
  delete peerConns[adminSocketId];
  // Clean up queue state for this peer
  _deletePendingCandidates(adminSocketId, 'closePeer');
  remoteDescReady.delete(adminSocketId);
  const remaining = Object.keys(peerConns).length;
  sryLog('WebRTC', 'closePeer', 'PEER_REMOVED', { adminSocketId, remaining });
  if (remaining === 0) {
    hideBackgroundNotif();
    if (Platform.OS === 'android') {
      sryLog('Service', 'closePeer', 'SET_STREAMING_FALSE', {});
      setStreaming(false);
      setAutoEnterPiP(false);
    }
    // Stream intentionally kept alive: admin may reconnect imminently.
    // releaseStream() is only called in stopSignaling() on logout.
    sryLog('Camera', 'closePeer', 'STREAM_KEPT_ALIVE', {
      hasStream: !!localStream,
      streamLive: localStream?.getVideoTracks().some(t => t.readyState === 'live') ?? false,
    });
  }
}

function closeAllPeers() {
  const count = Object.keys(peerConns).length;
  sryLog('WebRTC', 'closeAllPeers', 'CALLED', { count });
  Object.keys(peerConns).forEach(id => {
    sryLog('WebRTC', 'closeAllPeers', 'CLOSING', { id });
    peerConns[id]?.close();
    _deletePendingCandidates(id, 'closeAllPeers');
    remoteDescReady.delete(id);
  });
  peerConns = {};
  hideBackgroundNotif();
  if (Platform.OS === 'android') {
    sryLog('Service', 'closeAllPeers', 'SET_STREAMING_FALSE', {});
    setStreaming(false);
    setAutoEnterPiP(false);
  }
  // Stream kept alive — released only on logout (stopSignaling).
  sryLog('Camera', 'closeAllPeers', 'STREAM_KEPT_ALIVE', {
    hasStream: !!localStream,
    streamLive: localStream?.getVideoTracks().some(t => t.readyState === 'live') ?? false,
  });
}
