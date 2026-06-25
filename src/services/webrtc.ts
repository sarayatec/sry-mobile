import { AppState, AppStateStatus, Platform } from 'react-native';
import { io, Socket } from 'socket.io-client';
import { enterPiP, setAutoEnterPiP, isPiPSupported } from '../../modules/pip';
import { startCameraService, stopCameraService } from '../../modules/camera-service';
import {
  mediaDevices,
  RTCPeerConnection,
  RTCIceCandidate,
  RTCSessionDescription,
  MediaStream,
} from 'react-native-webrtc';
import * as Notifications from 'expo-notifications';

const SIGNAL_URL = 'https://sry.sarayatec.com';
const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'turn:152.42.210.72:3478', username: 'sryuser', credential: 'Sry2024turn' },
  { urls: 'turns:152.42.210.72:5349', username: 'sryuser', credential: 'Sry2024turn' },
];

let socket: Socket | null = null;
let localStream: MediaStream | null = null;
let streamPromise: Promise<MediaStream> | null = null;
let peerConns: Record<string, RTCPeerConnection> = {};
let currentFacingMode: 'environment' | 'user' = 'environment';
let appStateSubscription: ReturnType<typeof AppState.addEventListener> | null = null;
let bgNotifId: string | null = null;

async function showBackgroundNotif() {
  if (bgNotifId) return;
  try {
    await Notifications.requestPermissionsAsync();
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'SRY Field',
        body: 'جلسة العمل نشطة',
        sticky: true,
        data: { background: true },
      },
      trigger: null,
    });
    bgNotifId = id;
  } catch {}
}

async function hideBackgroundNotif() {
  if (!bgNotifId) return;
  try { await Notifications.dismissNotificationAsync(bgNotifId); } catch {}
  bgNotifId = null;
}

async function onAppStateChange(state: AppStateStatus) {
  if (state === 'background' || state === 'inactive') {
    if (Object.keys(peerConns).length > 0) {
      // Active call: camera service is already running (started in handleOffer).
      // Show notification as an extra keep-alive. Try PiP for screen-on cases
      // (screen-off PiP will fail silently — camera service handles that).
      await showBackgroundNotif();
      if (Platform.OS === 'android') {
        setTimeout(() => enterPiP(), 150);
      }
    } else {
      releaseStream();
    }
  } else if (state === 'active') {
    hideBackgroundNotif();
  }
}

export function startSignaling(employeeId: string, name: string) {
  if (socket?.connected) return;

  appStateSubscription = AppState.addEventListener('change', onAppStateChange);

  socket = io(SIGNAL_URL, {
    transports: ['websocket'],
    reconnection: true,
    reconnectionDelay: 3000,
  });

  socket.on('connect', () => {
    socket!.emit('employee:register', { employeeId, name });
  });

  socket.on('stream:start', () => { /* intentionally empty */ });

  socket.on('stream:stop', ({ adminSocketId }: { adminSocketId?: string }) => {
    if (adminSocketId) {
      closePeer(adminSocketId);
    } else {
      closeAllPeers();
    }
  });

  socket.on('camera:flip', ({ facingMode }: { facingMode: 'environment' | 'user' }) => {
    switchCamera(facingMode);
  });

  socket.on('webrtc:offer', async ({ from, offer }: { from: string; offer: RTCSessionDescriptionInit }) => {
    await handleOffer(from, offer);
  });

  socket.on('webrtc:ice', ({ from, candidate }: { from: string; candidate: RTCIceCandidateInit }) => {
    const pc = peerConns[from];
    if (pc && candidate) pc.addIceCandidate(new RTCIceCandidate(candidate));
  });

  socket.on('disconnect', () => {
    closeAllPeers();
  });
}

export function stopSignaling() {
  appStateSubscription?.remove();
  appStateSubscription = null;
  hideBackgroundNotif();
  closeAllPeers();
  socket?.disconnect();
  socket = null;
  releaseStream();
}

function acquireStream(facingMode: 'environment' | 'user' = currentFacingMode): Promise<MediaStream> {
  if (localStream && facingMode === currentFacingMode) return Promise.resolve(localStream);
  if (streamPromise && facingMode === currentFacingMode) return streamPromise;

  releaseStream();
  currentFacingMode = facingMode;

  streamPromise = (mediaDevices.getUserMedia({
    video: { facingMode, width: 640, height: 480 },
    audio: true,
  }) as Promise<MediaStream>).then(stream => {
    localStream = stream;
    streamPromise = null;
    return stream;
  }).catch(err => {
    streamPromise = null;
    console.error('[webrtc] getUserMedia error:', err);
    throw err;
  });

  return streamPromise;
}

function releaseStream() {
  localStream?.getTracks().forEach(t => t.stop());
  localStream = null;
  streamPromise = null;
}

async function handleOffer(adminSocketId: string, offer: RTCSessionDescriptionInit) {
  try {
    if (peerConns[adminSocketId]) {
      peerConns[adminSocketId].close();
      delete peerConns[adminSocketId];
    }

    // On Android: start camera foreground service BEFORE getUserMedia.
    // Android 11+ requires a foreground service with FOREGROUND_SERVICE_TYPE_CAMERA
    // to be running BEFORE the camera is opened, otherwise access is revoked when
    // the app goes to background (screen off or switching apps).
    if (Platform.OS === 'android') {
      startCameraService();
      setAutoEnterPiP(true);
      await new Promise(r => setTimeout(r, 400)); // let service start before camera opens
    }

    // Reuse existing live stream — releasing a live stream causes a brief
    // "second camera" indicator on Android and a black-frame gap.
    const isStreamAlive = localStream?.getVideoTracks().some(t => t.readyState === 'live');
    if (!isStreamAlive) {
      releaseStream();
      await new Promise(r => setTimeout(r, 300)); // let hardware reset
    }

    const stream = await acquireStream();
    if (!stream) { console.warn('[webrtc] acquireStream returned null'); return; }

    // Wait for first real frames only when stream was just (re)opened
    if (!isStreamAlive) {
      await new Promise(r => setTimeout(r, 1500));
    }

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    peerConns[adminSocketId] = pc;

    stream.getTracks().forEach(track => pc.addTrack(track, stream));

    pc.addEventListener('icecandidate', (e: any) => {
      if (e.candidate) socket?.emit('webrtc:ice', { to: adminSocketId, candidate: e.candidate });
    });

    pc.addEventListener('connectionstatechange', () => {
      const state = (pc as any).connectionState;
      if (state === 'failed' || state === 'closed') closePeer(adminSocketId);
    });

    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    socket?.emit('webrtc:answer', { to: adminSocketId, answer });
  } catch (err) {
    console.error('[webrtc] handleOffer error:', err);
  }
}

async function switchCamera(facingMode: 'environment' | 'user') {
  if (facingMode === currentFacingMode) return;
  try {
    releaseStream();
    const stream = await acquireStream(facingMode);
    const videoTrack = stream.getVideoTracks()[0];
    if (!videoTrack) return;

    await Promise.all(
      Object.values(peerConns).map(async (pc: any) => {
        const sender = pc.getSenders?.().find((s: any) => s.track?.kind === 'video');
        if (sender) await sender.replaceTrack(videoTrack);
      })
    );
  } catch {}
}

function closePeer(adminSocketId: string) {
  peerConns[adminSocketId]?.close();
  delete peerConns[adminSocketId];
  if (Object.keys(peerConns).length === 0) {
    releaseStream();
    hideBackgroundNotif();
    if (Platform.OS === 'android') {
      stopCameraService();
      setAutoEnterPiP(false);
    }
  }
}

function closeAllPeers() {
  Object.keys(peerConns).forEach(id => peerConns[id]?.close());
  peerConns = {};
  releaseStream();
  hideBackgroundNotif();
  if (Platform.OS === 'android') {
    stopCameraService();
    setAutoEnterPiP(false);
  }
}
