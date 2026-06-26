# SRY Field — Session ID Correlation Guide

Every streaming session has a unique UUID that appears in every log line
(JS and Android) for the duration of that session. This makes it trivial
to isolate one session from hours of continuous log output.

---

## Format

**JavaScript (ReactNativeJS)**
```
[12:30:11.412] [js-main] [Session:6f8d7f40] [WebRTC] [handleOffer] ENTRY | adminSocketId=abc123
```

**Android/Kotlin (SRYLifecycle / SRYService / SRYModule)**
```
[12:30:11.450] [main] [Session:6f8d7f40] [CameraForegroundService] [onStartCommand] WAKELOCK_ACQUIRED
[12:30:11.460] [main] [Session:6f8d7f40] [MainActivity] [onPause] CALLED
```

**When idle (no active session)**
```
[Session:none]
```

---

## How Session IDs are created

A new UUID is generated in `src/services/webrtc.ts` → `generateSessionId()` every time `handleOffer()` is called. This covers both cases:

| Trigger | Result |
|---------|--------|
| Admin sends a first offer | New session UUID generated |
| Admin reconnects (new offer replaces old peer) | Previous session ends (`SESSION_FINISHED`), new UUID generated |

The UUID is a standard v4 format:
```
xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
```
Example: `6f8d7f40-a112-4d17-b89d-3c4f710e9a21`

Log lines use only the first 8 hex characters (`6f8d7f40`) as the prefix for readability.

---

## How Session IDs are propagated

### JavaScript side

`setLogSessionId(id)` (exported from `src/utils/log.ts`) writes the UUID into a module-level variable `_sessionId`. All subsequent `sryLog()` calls in any file automatically include `[Session:xxxxxxxx]` — no per-call change required.

Files that benefit automatically (all call `sryLog`):
- `src/services/webrtc.ts`
- `src/services/location.ts`
- `app/(app)/_layout.tsx`

### Android / Kotlin side

`setNativeSessionId(id)` (exported from `modules/camera-service/index.ts`) calls the Expo module function `CameraServiceModule.setSessionId()`, which writes the UUID into the `SRYSession` Kotlin singleton:

```kotlin
// modules/camera-service/android/.../SRYSession.kt
object SRYSession {
  @Volatile var sessionId: String = "none"
  @Volatile var startMs: Long = 0L
  fun short(): String = if (sessionId == "none") "none" else sessionId.take(8)
  fun elapsedMs(): Long = if (startMs > 0L) System.currentTimeMillis() - startMs else 0L
}
```

All Kotlin log helpers read `SRYSession.short()` at the moment of logging:

| File | How it reads SRYSession |
|------|------------------------|
| `CameraForegroundService.kt` | `SRYSession.short()` in `srvLog()` helper |
| `CameraServiceModule.kt` | `SRYSession.short()` in `modLog()` helper |
| `MainActivity` (via `with-pip.js`) | `try { com.sarayatec.cameraservice.SRYSession.short() }` |
| `MainActivity` (via `with-lifecycle-logs.js`) | same in `sryLifecycleLog()` helper |

Both JS and Android sides are set atomically from `handleOffer()`:
```typescript
// webrtc.ts — startSession()
setLogSessionId(currentSessionId);   // JS side
setNativeSessionId(currentSessionId); // Android side (async, ~1-2ms delay)
```

---

## Session lifecycle events

### SESSION_STARTED
Logged in `webrtc.ts → startSession()` when a new offer arrives:
```
[Session:6f8d7f40] [Session] [startSession] SESSION_STARTED | sessionId=6f8d7f40-... reason=offer_received adminSocketId=xyz
```

### SESSION_FINISHED
Logged in `webrtc.ts → endSession()` in two situations:

**1. Logout** — `stopSignaling()` is called:
```
[Session:6f8d7f40] [Session] [endSession] SESSION_FINISHED | sessionId=6f8d7f40-... durationSec=142 reason=logout streamAlive=true streamLive=true activePeers=1 socketConnected=true resourcesReleased=socket peers stream service resourcesKept=none
```

**2. New offer replaces current session** — admin reconnects and sends a fresh offer:
```
[Session:6f8d7f40] [Session] [endSession] SESSION_FINISHED | sessionId=6f8d7f40-... durationSec=38 reason=new_offer_replacing adminSocketId=xyz resourcesReleased=peer resourcesKept=stream socket service
```
Immediately followed by:
```
[Session:a3b19c2e] [Session] [startSession] SESSION_STARTED | sessionId=a3b19c2e-... reason=offer_received
```

---

## Filtering logs for a single session

### Full session trace (all components)
```bash
adb logcat -s ReactNativeJS SRYLifecycle SRYService SRYModule | grep "Session:6f8d7f40"
```

### Session start and end only
```bash
adb logcat -s ReactNativeJS | grep -E "SESSION_STARTED|SESSION_FINISHED"
```

### Everything for all active sessions (hide idle logs)
```bash
adb logcat -s ReactNativeJS SRYLifecycle SRYService SRYModule | grep -v "Session:none"
```

### Save a full session to file then filter
```bash
# record
adb logcat -s ReactNativeJS SRYLifecycle SRYService SRYModule > sry_full.log

# find session IDs in the log
grep "SESSION_STARTED" sry_full.log

# extract one complete session
grep "Session:6f8d7f40" sry_full.log > session_6f8d7f40.log
```

---

## What SESSION_FINISHED tells you

| Field | Meaning |
|-------|---------|
| `durationSec` | How long this streaming session lasted in seconds |
| `reason` | `logout` = clean shutdown; `new_offer_replacing` = admin reconnected |
| `streamAlive` | Was `localStream` non-null at session end? (`false` = camera was already dead) |
| `streamLive` | Was the video track in `live` state? (`false` = track stopped before session ended) |
| `activePeers` | How many RTCPeerConnections were open at session end |
| `socketConnected` | Was the socket still connected at session end? (`false` = socket died during session) |
| `resourcesReleased` | What was torn down |
| `resourcesKept` | What was intentionally kept alive for the next session |

---

## Note on location task background context

The `SRY_BG_LOCATION` task runs in a **separate JS context** managed by `expo-task-manager`. It does not share module-level state with the main app context, so `_sessionId` in `log.ts` will always read as `"none"` inside the background task.

Location task logs will show `[Session:none]` even during an active streaming session. This is expected. All other JS logs (from the main context) and all Kotlin logs (via `SRYSession`) will show the correct session ID.
