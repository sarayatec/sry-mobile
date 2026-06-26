# SRY Field — Debug Logging Map

All log lines follow a common structured format:

**JavaScript (adb logcat tag: `ReactNativeJS`)**
```
[HH:MM:SS.mmm] [js-main] [Component] [Method] STATE | key=val key=val
```

**Android/Kotlin (adb logcat tags: `SRYLifecycle`, `SRYService`, `SRYModule`)**
```
[HH:MM:SS.mmm] [thread-name] [ClassName] [method] STATE extra=val
```

---

## Logcat filter commands

```bash
# All SRY debug output
adb logcat -s ReactNativeJS SRYLifecycle SRYService SRYModule

# Only WebRTC + camera events
adb logcat -s ReactNativeJS | grep -E "\[(WebRTC|Camera)\]"

# Only Android lifecycle
adb logcat -s SRYLifecycle

# Only foreground service
adb logcat -s SRYService

# Save to file
adb logcat -s ReactNativeJS SRYLifecycle SRYService SRYModule > sry_debug.log
```

---

## Log points by file

### `src/utils/log.ts` (NEW)
Exports `sryLog(component, method, state, values?)` used by all JS/TS files.

---

### `src/services/webrtc.ts`

| Component | Method | State | Values |
|-----------|--------|-------|--------|
| Socket | startSignaling | CALLED | employeeId, name |
| Socket | startSignaling | ALREADY_CONNECTED | socketId |
| Service | startSignaling | STARTING_SESSION_SERVICE | — |
| AppState | startSignaling | APPSTATE_LISTENER_REGISTERED | — |
| Socket | startSignaling | IO_CREATED | url |
| Socket | connect | CONNECTED | socketId |
| Socket | connect | REGISTERED | employeeId, name |
| Socket | disconnect | DISCONNECTED | reason, peerCount |
| Socket | reconnect_attempt | TRYING | attempt |
| Socket | reconnect | SUCCESS | attempt, socketId |
| Socket | reconnect_error | FAILED | err |
| Socket | reconnect_failed | EXHAUSTED | — |
| Socket | stream:start | RECEIVED | — |
| Socket | stream:stop | RECEIVED | adminSocketId, peerCount |
| Socket | camera:flip | RECEIVED | facingMode |
| WebRTC | webrtc:offer | RECEIVED | from, offerType, peerExists |
| WebRTC | webrtc:ice | RECEIVED | from, hasPeer, candidate(60 chars) |
| Socket | stopSignaling | CALLED | peerCount, hasStream |
| Service | stopSignaling | STOPPING_SESSION_SERVICE | — |
| Camera | acquireStream | CALLED | requestedFacing, currentFacing, hasStream, streamLive, hasPromise |
| Camera | acquireStream | REUSED | streamId, videoTracks, audioTracks, videoState, audioState |
| Camera | acquireStream | AWAITING_EXISTING_PROMISE | facingMode |
| Camera | acquireStream | CALLING_GETUSERMEDIA | facingMode, width, height |
| Camera | getUserMedia | SUCCESS | streamId, videoTracks, audioTracks, videoTrackId, audioTrackId, videoState, audioState |
| Camera | getUserMedia | ERROR | err, name |
| Camera | releaseStream | CALLED | streamId, trackCount, states |
| Camera | releaseStream | CALLED_NO_STREAM | — |
| WebRTC | handleOffer | ENTRY | adminSocketId, offerType, hasExistingPeer, totalPeers, isReconnecting |
| WebRTC | handleOffer | CLOSING_OLD_PEER | adminSocketId |
| WebRTC | handleOffer | OLD_PEER_CLOSED | adminSocketId |
| Service | handleOffer | SET_STREAMING_TRUE | — |
| WebRTC | handleOffer | WAITING_PIP_SETUP | delayMs |
| Camera | handleOffer | STREAM_ALIVE_CHECK | isStreamAlive, hasLocalStream, videoTrackState |
| Camera | handleOffer | RELEASING_DEAD_STREAM | — |
| Camera | handleOffer | WAITING_AFTER_RELEASE | delayMs |
| Camera | handleOffer | ACQUIRING_STREAM | facingMode |
| Camera | handleOffer | ACQUIRE_RETURNED_NULL | — |
| Camera | handleOffer | STREAM_ACQUIRED | streamId, videoTracks, audioTracks |
| Camera | handleOffer | WAITING_CAMERA_STABILIZE | delayMs |
| WebRTC | handleOffer | CREATING_PC | adminSocketId |
| WebRTC | handleOffer | PC_CREATED | adminSocketId, isReconnecting |
| WebRTC | addTrack | VIDEO | trackId, kind, readyState, enabled |
| WebRTC | addTrack | AUDIO | trackId, kind, readyState, enabled |
| WebRTC | icecandidate | LOCAL_CANDIDATE | type, protocol, candidate(80 chars) |
| WebRTC | icecandidate | GATHERING_COMPLETE | — |
| WebRTC | iceconnectionstatechange | \<STATE\> | adminSocketId |
| WebRTC | icegatheringstatechange | \<STATE\> | adminSocketId |
| WebRTC | signalingstatechange | \<STATE\> | adminSocketId |
| WebRTC | connectionstatechange | \<STATE\> | adminSocketId, peerCount |
| WebRTC | handleOffer | SET_REMOTE_DESCRIPTION | adminSocketId |
| WebRTC | handleOffer | SET_REMOTE_DESCRIPTION_DONE | signalingState |
| WebRTC | handleOffer | CREATE_ANSWER | adminSocketId |
| WebRTC | handleOffer | CREATE_ANSWER_DONE | answerType |
| WebRTC | handleOffer | SET_LOCAL_DESCRIPTION_DONE | signalingState |
| WebRTC | handleOffer | ANSWER_SENT | to |
| WebRTC | handleOffer | ERROR | err, adminSocketId |
| Camera | switchCamera | CALLED | requested, current, peerCount |
| Camera | switchCamera | SKIPPED_SAME_FACING | facingMode |
| Camera | switchCamera | NO_VIDEO_TRACK | — |
| Camera | switchCamera | REPLACING_TRACK | newTrackId, newFacing, peerCount |
| Camera | switchCamera | TRACK_REPLACED | newTrackId |
| Camera | switchCamera | NO_VIDEO_SENDER_FOUND | — |
| Camera | switchCamera | SUCCESS | newFacing |
| Camera | switchCamera | ERROR | err |
| WebRTC | closePeer | CALLED | adminSocketId, peerExists, isReconnecting, totalBefore |
| WebRTC | closePeer | PEER_REMOVED | adminSocketId, remaining |
| Service | closePeer | SET_STREAMING_FALSE | — |
| Camera | closePeer | STREAM_KEPT_ALIVE | hasStream, streamLive |
| WebRTC | closeAllPeers | CALLED | count |
| WebRTC | closeAllPeers | CLOSING | id |
| Service | closeAllPeers | SET_STREAMING_FALSE | — |
| Camera | closeAllPeers | STREAM_KEPT_ALIVE | hasStream, streamLive |
| AppState | onAppStateChange | \<STATE\> | peerCount, hasStream, streamLive, socketConnected |
| AppState | onAppStateChange | SHOW_BACKGROUND_NOTIF | peerCount |
| AppState | onAppStateChange | TRACKS_ENABLED | videoTracks, audioTracks |
| AppState | onAppStateChange | ENTER_PIP_SCHEDULED | — |
| AppState | onAppStateChange | ENTER_PIP_FIRING | — |
| AppState | onAppStateChange | NO_PEERS_BACKGROUND | — |
| AppState | onAppStateChange | TRACKS_RE_ENABLED_ACTIVE | peerCount |
| AppState | onAppStateChange | EMIT_READY_FOR_STREAM | — |
| Notif | showBackgroundNotif | SHOWN | notifId |
| Notif | showBackgroundNotif | ERROR | err |
| Notif | hideBackgroundNotif | DISMISSED | notifId |

---

### `src/services/location.ts`

| Component | Method | State | Values |
|-----------|--------|-------|--------|
| Location | defineLocationTask | ALREADY_DEFINED | task |
| Location | defineLocationTask | DEFINING | task |
| Location | defineLocationTask | DEFINED | task |
| Location | taskCallback | ERROR | message |
| Location | taskCallback | EMPTY_LOCATIONS | — |
| Location | taskCallback | LOCATION_RECEIVED | lat, lng, accuracy, heading, speed, locCount |
| Location | taskCallback | UPLOAD_SUCCESS | lat, lng |
| Location | taskCallback | UPLOAD_ERROR | err |
| Location | requestPermissions | CALLED | — |
| Location | requestPermissions | FOREGROUND | status |
| Location | requestPermissions | FOREGROUND_DENIED | — |
| Location | requestPermissions | BACKGROUND | status |
| Location | requestPermissions | ALL_GRANTED | — |
| Location | requestPermissions | BACKGROUND_DENIED | — |
| Location | startTracking | CALLED | — |
| Location | startTracking | ALREADY_RUNNING | — |
| Location | startTracking | STARTING | timeInterval, distanceInterval |
| Location | startTracking | STARTED | — |
| Location | stopTracking | CALLED | — |
| Location | stopTracking | STOPPED | — |
| Location | stopTracking | WAS_NOT_RUNNING | — |
| Location | isTracking | CHECK | result |

---

### `app/(app)/_layout.tsx`

| Component | Method | State | Values |
|-----------|--------|-------|--------|
| AppLayout | useEffect[boot] | CHECK | isBootLaunch |
| AppLayout | useEffect[boot] | MOVING_TO_BACKGROUND | — |
| AppLayout | useEffect[battery] | CHECK | userId, ignored |
| AppLayout | useEffect[battery] | SHOWING_BATTERY_ALERT | — |
| AppLayout | useEffect[battery] | USER_CONFIRMED_BATTERY | — |
| AppLayout | useEffect[pushToken] | CALLED | userId |
| AppLayout | useEffect[pushToken] | PERMISSION | status |
| AppLayout | useEffect[pushToken] | TOKEN_OBTAINED | token(truncated) |
| AppLayout | useEffect[pushToken] | TOKEN_SENT | — |
| AppLayout | useEffect[pushToken] | ERROR | err |
| AppLayout | useEffect[signaling] | NO_USER_SKIP | — |
| AppLayout | useEffect[signaling] | STARTING | userId, name |
| AppLayout | useEffect[signaling] | CANCELLED_AFTER_PERMISSIONS | — |
| AppLayout | useEffect[signaling] | CALLING_START_SIGNALING | userId |
| AppLayout | useEffect[signaling] | TRACKING_CHECK | alreadyRunning |
| AppLayout | useEffect[signaling] | LOCATION_PERMISSION | granted |
| AppLayout | useEffect[signaling] | CALLING_START_TRACKING | — |
| AppLayout | useEffect[signaling] | CLEANUP_STOP_SIGNALING | userId |
| AppLayout | LogoutBtn | LOGOUT_CONFIRMED | — |
| AppLayout | HideBtn | PRESSED | — |
| AppLayout | BlackScreenOverlay | DISMISSED | — |
| Permissions | requestAllPermissions | CALLED | — |
| Permissions | requestAllPermissions | RESULT | camera, audio |
| Permissions | requestAllPermissions | ERROR | err |

---

### `modules/camera-service/android/.../CameraForegroundService.kt`
**logcat tag: `SRYService`**

| Method | State | Extra |
|--------|-------|-------|
| onCreate | CALLED | — |
| onCreate | CHANNEL_CREATED | — |
| onStartCommand | CALLED | startId, flags |
| onStartCommand | START_FOREGROUND_TYPED | sdk, type |
| onStartCommand | FOREGROUND_STARTED | type=CAMERA\|MIC\|DATA_SYNC |
| onStartCommand | FOREGROUND_FALLBACK | err |
| onStartCommand | FOREGROUND_STARTED | type=DATA_SYNC_ONLY |
| onStartCommand | START_FOREGROUND_LEGACY | sdk |
| onStartCommand | FOREGROUND_STARTED | type=LEGACY |
| onStartCommand | WAKELOCK_ACQUIRED | tag, capMs |
| onStartCommand | WAKELOCK_ALREADY_HELD | isHeld |
| onStartCommand | RETURNING_START_STICKY | — |
| onDestroy | CALLED | wakeLockHeld |
| onDestroy | WAKELOCK_RELEASED | — |
| onDestroy | WAKELOCK_NOT_HELD | — |
| onDestroy | FOREGROUND_STOPPED | — |

---

### `modules/camera-service/android/.../CameraServiceModule.kt`
**logcat tag: `SRYModule`**

| Method | State | Extra |
|--------|-------|-------|
| launchService | CALLED | sdk |
| launchService | START_FOREGROUND_SERVICE | — |
| launchService | START_SERVICE_LEGACY | — |
| startSession | CALLED | — |
| startSession | NO_CONTEXT | — |
| stopSession | CALLED | — |
| stopSession | NO_CONTEXT | — |
| stopSession | PREFS_CLEARED | key |
| stopSession | SERVICE_STOPPED | — |
| setStreaming | CALLED | active |
| setStreaming | NO_CONTEXT | — |
| setStreaming | PREFS_WRITTEN | key, value |
| setStreaming | ENSURING_SERVICE_RUNNING | — |
| keepScreenOn | CALLED | keepOn |
| keepScreenOn | NO_ACTIVITY | — |
| keepScreenOn | FLAG_ADDED | FLAG_KEEP_SCREEN_ON |
| keepScreenOn | FLAG_CLEARED | FLAG_KEEP_SCREEN_ON |
| start | CALLED | (back-compat alias) |
| stop | CALLED | (back-compat alias) |
| isBatteryOptimizationIgnored | LEGACY_TRUE | sdk |
| isBatteryOptimizationIgnored | RESULT | ignored, pkg |
| requestDisableBatteryOptimization | CALLED | — |
| requestDisableBatteryOptimization | LEGACY_SKIP | — |
| requestDisableBatteryOptimization | ALREADY_IGNORED | — |
| requestDisableBatteryOptimization | DIALOG_OPENED | direct |
| requestDisableBatteryOptimization | DIRECT_FAILED | err |
| requestDisableBatteryOptimization | DIALOG_OPENED | settings_list |
| requestDisableBatteryOptimization | FALLBACK_FAILED | err |

---

### `scripts/with-pip.js` → injected into `MainActivity.kt`
**logcat tag: `SRYLifecycle`**

| Method | State | Extra |
|--------|-------|-------|
| onUserLeaveHint | CALLED | — |
| onUserLeaveHint | PIP_ENTER_SUCCESS | — |
| onUserLeaveHint | PIP_ENTER_FAILED | err |
| onUserLeaveHint | PIP_SKIPPED_OLD_API | sdk |
| onPictureInPictureModeChanged | CALLED | isInPiP |
| onPictureInPictureModeChanged | REORDER_TO_FRONT | — |

---

### `scripts/with-lifecycle-logs.js` → injected into `MainActivity.kt` (NEW)
**logcat tag: `SRYLifecycle`**

| Method | State | Extra |
|--------|-------|-------|
| onCreate | CALLED | — |
| onStart | CALLED | — |
| onResume | CALLED | — |
| onPause | CALLED | — |
| onStop | CALLED | — |
| onDestroy | CALLED | — |
| onNewIntent | CALLED | action, extras |
| onTrimMemory | CALLED | level (80=COMPLETE, 60=MODERATE, 40=BACKGROUND) |

---

## Key scenarios and what to look for in the log

### Stream survives switching to WhatsApp

Expected log sequence when pressing Home:
```
[AppState] [onAppStateChange] INACTIVE | peerCount=1 hasStream=true
[AppState] [onAppStateChange] SHOW_BACKGROUND_NOTIF
[AppState] [onAppStateChange] TRACKS_ENABLED
[AppState] [onAppStateChange] ENTER_PIP_SCHEDULED
[SRYLifecycle] [MainActivity] [onUserLeaveHint] CALLED
[SRYLifecycle] [MainActivity] [onUserLeaveHint] PIP_ENTER_SUCCESS
[AppState] [onAppStateChange] BACKGROUND
[SRYLifecycle] [MainActivity] [onPause] CALLED
[SRYLifecycle] [MainActivity] [onStop] CALLED
```

**If `PIP_ENTER_FAILED` appears** → PiP failed; camera depends on foreground service + WakeLock only.

**If `onTrimMemory level=80`** → OS is about to kill the process; battery optimization not exempted.

**If `[Socket] [disconnect]` appears** → socket was killed by OS (battery optimization / OEM killer).

### Admin reconnects

Expected:
```
[WebRTC] [closeAllPeers] or [closePeer] CALLED
[Camera] [closePeer/closeAllPeers] STREAM_KEPT_ALIVE | hasStream=true streamLive=true
[WebRTC] [webrtc:offer] RECEIVED
[Camera] [handleOffer] STREAM_ALIVE_CHECK | isStreamAlive=true
[Camera] [acquireStream] REUSED   ← GOOD: no getUserMedia delay
[WebRTC] [handleOffer] ANSWER_SENT
```

**If `STREAM_ALIVE_CHECK isStreamAlive=false`** → stream was somehow released; camera will re-open (slow).

### Screen locked mid-stream

```
[SRYLifecycle] [MainActivity] [onPause] CALLED
[AppState] [onAppStateChange] INACTIVE
[AppState] [onAppStateChange] BACKGROUND
[SRYService] [CameraForegroundService] [onStartCommand] WAKELOCK_ACQUIRED  ← CPU stays alive
[WebRTC] [connectionstatechange] CONNECTED  ← should NOT change to failed
```

**If `connectionstatechange FAILED` appears after screen lock** → OEM battery killer is active.
