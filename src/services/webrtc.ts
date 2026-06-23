import { AppState, AppStateStatus, Platform } from 'react-native';
import { io, Socket } from 'socket.io-client';
import { enterPiP, setAutoEnterPiP, isPiPSupported } from '../../modules/pip';
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

// Show an ongoing notification so Android keeps the process alive (camera continues in background)
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
      // Active call: keep camera alive via foreground notification + PiP
      await showBackgroundNotif();
      if (Platform.OS === 'android') {
        setTimeout(() => enterPiP(), 150);
      }
    } else {
      // No active call: release camera so the green indicator disappears
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

  // stream:start: just pre-warm the camera — peer is created only in handleOffer
  socket.on('stream:start', () => {
    warmUpStream();
  });

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

  // Single code path for creating peer connections
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

// Singleton: prevents double getUserMedia calls
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
    throw err;
  });

  return streamPromise;
}

function releaseStream() {
  localStream?.getTracks().forEach(t => t.stop());
  localStream = null;
  streamPromise = null;
}

async function warmUpStream() {
  try { await acquireStream(); } catch {}
}

async function handleOffer(adminSocketId: string, offer: RTCSessionDescriptionInit) {
  try {
    // Close existing peer first (re-watch scenario)
    if (peerConns[adminSocketId]) {
      peerConns[adminSocketId].close();
      delete peerConns[adminSocketId];
    }

    const stream = await acquireStream();
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    peerConns[adminSocketId] = pc;

    stream.getTracks().forEach(track => pc.addTrack(track, stream));

    // Android 12+: enable auto-enter PiP as soon as we have an active peer
    // so Home/screen-lock triggers PiP automatically without JS intervention
    if (Platform.OS === 'android') setAutoEnterPiP(true);

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
  } catch {}
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
  // Only release stream and hide notif when no more active peers
  if (Object.keys(peerConns).length === 0) {
    releaseStream();
    hideBackgroundNotif();
    // Disable auto-enter PiP when no active streaming session
    if (Platform.OS === 'android') setAutoEnterPiP(false);
  }
}

function closeAllPeers() {
  Object.keys(peerConns).forEach(id => peerConns[id]?.close());
  peerConns = {};
  releaseStream();
  hideBackgroundNotif();
  if (Platform.OS === 'android') setAutoEnterPiP(false);
}
