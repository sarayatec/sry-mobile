# SRY Field — Test Plan v1.0

**Build:** commit `adfe12c` (session correlation IDs + debug instrumentation)
**Date:** 2026-06-26
**Purpose:** Verify that the camera, microphone, GPS, WebRTC connection, and
Foreground Service remain alive under real-world conditions after the fixes
committed in `fecdb13` through `adfe12c`.

---

## 1. Scope

This plan covers functional validation of the SRY Field Android mobile app.
It does not cover the web admin dashboard, the REST API, or the signal server
except where those components are needed to complete a scenario.

### In Scope
- Camera streaming lifecycle
- Microphone streaming lifecycle
- GPS location tracking
- Socket.IO signaling connection
- WebRTC peer connection
- Android Foreground Service
- WakeLock behavior
- Picture-in-Picture (PiP)
- Activity lifecycle under system interruptions
- Network changes and recovery
- Battery optimization interactions
- Boot autostart

### Out of Scope
- Admin dashboard UI
- REST API correctness
- Server-side signal relay logic
- iOS behavior

---

## 2. Test Environment

### Device Requirements
| Item | Requirement |
|------|-------------|
| OS | Android 10+ (API 29+). At least one test device should be Android 14 (API 34). |
| OEM | Minimum two brands: one stock Android (Pixel / Nokia) and one OEM-aggressive (Samsung / Xiaomi / OPPO) |
| RAM | 4 GB minimum |
| Camera | Working rear and front cameras |
| Network | Wi-Fi and mobile data (SIM with data plan) |
| Battery | Not plugged in during battery/Doze tests |

### Software Requirements
| Item | Requirement |
|------|-------------|
| ADB | Installed and USB debugging enabled on device |
| Admin browser | Chrome on desktop, logged in to `https://sry.sarayatec.com` |
| APK | Built from commit `adfe12c`, installed via `adb install -r sry-field.apk` |
| Battery optimization | Initially NOT exempted (to test the exemption flow) |

### Log Collection Setup
```bash
# Start log collection before every test session
adb logcat -c   # clear buffer
adb logcat -s ReactNativeJS SRYLifecycle SRYService SRYModule > session_$(date +%Y%m%d_%H%M%S).log &
```

---

## 3. Definitions

| Term | Meaning |
|------|---------|
| **Stream active** | Admin browser shows live video from employee device |
| **Stream frozen** | Admin browser shows a still frame or spinning indicator |
| **Stream dead** | Admin browser shows "employee offline" or blank |
| **Session ID** | 8-char hex prefix from `[Session:xxxxxxxx]` in logs |
| **FGSN** | Foreground Service Notification — the sticky "SRY Field / جلسة عمل نشطة" notification |
| **PiP** | Picture-in-Picture window — small floating video overlay |
| **WakeLock** | `SRYField::CameraStreamLock` PARTIAL_WAKE_LOCK |
| **FGS** | Foreground Service (`CameraForegroundService`) |
| **TURN relay** | `152.42.210.72:3478` / `:5349` |

---

## 4. Precondition Checklist (Run Before Any Test)

- [ ] APK installed from commit `adfe12c`
- [ ] Device connected via USB, ADB recognized (`adb devices`)
- [ ] Log collection command running in a terminal
- [ ] Admin browser open at `https://sry.sarayatec.com`, admin logged in
- [ ] Device screen brightness set to max (prevents premature screen-off)
- [ ] Developer Options → "Stay Awake" = **OFF** (we want natural behavior)
- [ ] Test starts with app force-stopped (`adb shell am force-stop com.sarayatec.sryfield`)

---

## 5. Test Cases

---

### TC-001 — Login

**Description:** Employee logs in. App registers with signal server, starts FGS, starts location tracking.

**Preconditions:**
- App not running
- Valid employee credentials available

**Test Steps:**
1. Launch app
2. Enter valid credentials
3. Tap Login
4. Observe: FGSN appears in status bar, location permission dialog appears
5. Grant all permissions

**Expected Results:**
- App navigates to home tab
- FGSN visible: "SRY Field / جلسة عمل نشطة"
- Location permission granted
- Battery optimization dialog appears (first run)
- Employee appears online in admin dashboard

**Required Logs:**
```
[Session:none] [Socket] [startSignaling] CALLED
[Session:none] [Socket] [connect] CONNECTED
[Session:none] [Socket] [connect] REGISTERED
[Session:none] [Service] [startSignaling] STARTING_SESSION_SERVICE
[Session:none] [SRYService] [CameraForegroundService] [onStartCommand] FOREGROUND_STARTED
[Session:none] [SRYService] [CameraForegroundService] [onStartCommand] WAKELOCK_ACQUIRED
[Session:none] [Location] [startTracking] STARTED
[Session:none] [Permissions] [requestAllPermissions] RESULT | camera=granted audio=granted
```

**Pass Criteria:**
- `[Socket] [connect] CONNECTED` appears with a valid socketId
- `[CameraForegroundService] [onStartCommand] FOREGROUND_STARTED` appears
- `[CameraForegroundService] [onStartCommand] WAKELOCK_ACQUIRED` appears
- `[Location] [startTracking] STARTED` appears
- Employee shows as online in admin dashboard

**Fail Criteria:**
- `[Socket] [connect]` never appears (socket.io connection failed)
- `FOREGROUND_STARTED` missing (service not started — check Android version + permissions)
- `camera=denied` in permissions log (camera will not stream)
- Employee not visible in admin dashboard

---

### TC-002 — Start Camera Stream

**Description:** Admin sends a WebRTC offer. Employee device accepts, camera opens, stream is live.

**Preconditions:**
- TC-001 passed (employee logged in, socket connected)
- Camera permission granted

**Test Steps:**
1. In admin dashboard, click the employee row
2. Click "Start Stream"
3. Observe admin browser: video should appear within 5 seconds
4. Observe device: FGSN should remain visible
5. Note the Session ID from logs

**Expected Results:**
- Admin browser shows live video within 5 seconds
- PiP is enabled on the device (setAutoEnterPiP = true)
- Session ID generated and logged

**Required Logs:**
```
[Session:none] [WebRTC] [webrtc:offer] RECEIVED | from=... offerType=offer
[Session:xxxxxxxx] [Session] [startSession] SESSION_STARTED | reason=offer_received
[Session:xxxxxxxx] [Camera] [acquireStream] CALLING_GETUSERMEDIA
[Session:xxxxxxxx] [Camera] [getUserMedia] SUCCESS | streamId=... videoTracks=1 audioTracks=1
[Session:xxxxxxxx] [WebRTC] [icecandidate] LOCAL_CANDIDATE | type=...
[Session:xxxxxxxx] [WebRTC] [connectionstatechange] CONNECTED
[Session:xxxxxxxx] [WebRTC] [handleOffer] ANSWER_SENT
```

**Pass Criteria:**
- `SESSION_STARTED` log appears with a valid UUID
- `getUserMedia SUCCESS` appears (camera opened)
- `connectionstatechange CONNECTED` appears
- Admin browser shows live video
- `videoTracks=1 audioTracks=1` in getUserMedia log

**Fail Criteria:**
- `getUserMedia ERROR` appears (camera failed to open)
- `connectionstatechange FAILED` appears (ICE/TURN failure)
- No `ANSWER_SENT` (offer processing crashed)
- Admin sees no video after 10 seconds
- `videoTracks=0` or `audioTracks=0`

---

### TC-003 — Stop Stream (Admin Stops)

**Description:** Admin manually stops the stream. Peer connection closes; camera stays open.

**Preconditions:**
- TC-002 passed (stream is live, Session ID noted)

**Test Steps:**
1. In admin dashboard, click "Stop Stream"
2. Observe: admin browser video disappears
3. Observe: FGSN remains on device
4. Wait 10 seconds
5. Confirm camera is NOT released (stream still alive in logs)

**Expected Results:**
- `stream:stop` event received
- `closePeer` called, peer removed
- `STREAM_KEPT_ALIVE` logged — camera stays open
- Session ID remains until logout (NOT cleared)

**Required Logs:**
```
[Session:xxxxxxxx] [Socket] [stream:stop] RECEIVED
[Session:xxxxxxxx] [WebRTC] [closePeer] CALLED
[Session:xxxxxxxx] [WebRTC] [closePeer] PEER_REMOVED | remaining=0
[Session:xxxxxxxx] [Camera] [closePeer] STREAM_KEPT_ALIVE | hasStream=true streamLive=true
[Session:xxxxxxxx] [Service] [closePeer] SET_STREAMING_FALSE
```

**Pass Criteria:**
- `STREAM_KEPT_ALIVE hasStream=true streamLive=true` — camera open after stop
- `SET_STREAMING_FALSE` — PiP disabled correctly
- No `releaseStream CALLED` after stop (stream must NOT be released)
- No `SESSION_FINISHED` — session continues until logout

**Fail Criteria:**
- `releaseStream CALLED` after stop (stream released — bug)
- `SESSION_FINISHED` logged (session incorrectly ended)
- `STREAM_KEPT_ALIVE hasStream=false` (camera died)

---

### TC-004 — Reconnect Stream

**Description:** After stream stops, admin starts it again. Camera is reused without getUserMedia delay.

**Preconditions:**
- TC-003 passed (stream stopped, camera alive)

**Test Steps:**
1. Wait 5 seconds after TC-003
2. Admin clicks "Start Stream" again
3. Measure time from click to visible video in admin browser
4. Note new Session ID

**Expected Results:**
- New Session ID generated
- `acquireStream REUSED` (no getUserMedia call needed)
- Video appears in admin browser in < 2 seconds (no camera warmup)

**Required Logs:**
```
[Session:oldXXXX] [Session] [endSession] SESSION_FINISHED | reason=new_offer_replacing
[Session:newXXXX] [Session] [startSession] SESSION_STARTED
[Session:newXXXX] [Camera] [acquireStream] REUSED | streamId=... videoState=live
[Session:newXXXX] [WebRTC] [connectionstatechange] CONNECTED
```

**Pass Criteria:**
- `SESSION_FINISHED reason=new_offer_replacing` for old session
- `SESSION_STARTED` for new session with different UUID
- `acquireStream REUSED` (NOT `CALLING_GETUSERMEDIA`)
- `connectionstatechange CONNECTED` within 3 seconds of offer
- Admin sees video in < 2 seconds

**Fail Criteria:**
- `CALLING_GETUSERMEDIA` instead of `REUSED` (stream was released — bug)
- Video takes > 5 seconds (camera not reused)
- `connectionstatechange FAILED`

---

### TC-005 — Press Home Button

**Description:** Employee presses Home while streaming. App should enter PiP, stream must continue.

**Preconditions:**
- Stream active (TC-002 state)
- Session ID noted

**Test Steps:**
1. While admin is watching live stream, press Home on the device
2. Observe: PiP window should appear (small floating video)
3. Observe admin browser: video must continue
4. Wait 30 seconds
5. Verify stream is still flowing in admin browser

**Expected Results:**
- PiP window appears within 1 second
- Admin sees uninterrupted video
- FGSN visible in status bar
- WakeLock still held (CPU running)

**Required Logs:**
```
[Session:xxxxxxxx] [AppState] [onAppStateChange] INACTIVE
[Session:xxxxxxxx] [AppState] [onAppStateChange] SHOW_BACKGROUND_NOTIF
[Session:xxxxxxxx] [AppState] [onAppStateChange] ENTER_PIP_SCHEDULED
[Session:xxxxxxxx] [SRYLifecycle] [MainActivity] [onUserLeaveHint] CALLED
[Session:xxxxxxxx] [SRYLifecycle] [MainActivity] [onUserLeaveHint] PIP_ENTER_SUCCESS
[Session:xxxxxxxx] [SRYLifecycle] [MainActivity] [onPause] CALLED
[Session:xxxxxxxx] [SRYLifecycle] [MainActivity] [onStop] CALLED
[Session:xxxxxxxx] [AppState] [onAppStateChange] BACKGROUND
```

**Pass Criteria:**
- `PIP_ENTER_SUCCESS` logged
- `ENTER_PIP_SCHEDULED` and `ENTER_PIP_FIRING` both appear
- Stream continues in admin browser (no freeze or disconnect)
- `connectionstatechange` stays CONNECTED throughout
- No `SESSION_FINISHED`

**Fail Criteria:**
- `PIP_ENTER_FAILED` (PiP entry failed — check manifest `resizeableActivity`)
- `connectionstatechange FAILED` (stream died)
- `SESSION_FINISHED` logged
- Admin browser shows frozen frame or "employee offline"
- `onTrimMemory level=80` appears within 60 seconds (OS killing process)

---

### TC-006 — Open WhatsApp (Core Streaming Continuity Test)

**Description:** The primary regression test. Employee switches to WhatsApp while streaming. Stream must survive.

**Preconditions:**
- Stream active (TC-002 state), Session ID noted
- WhatsApp installed on device

**Test Steps:**
1. While admin watches live stream, press Home
2. Wait for PiP window to appear
3. Open WhatsApp, read/send a message (30 seconds of activity)
4. Observe admin browser continuously: stream must NOT stop
5. After 30 seconds, return to SRY Field app
6. Observe: stream should still be active in admin browser

**Expected Results:**
- Stream flows continuously in admin browser during the entire 30 seconds
- PiP window remains visible (or disappears but stream continues via FGS)
- No reconnect required when returning

**Required Logs:**
```
[Session:xxxxxxxx] [SRYLifecycle] [MainActivity] [onUserLeaveHint] PIP_ENTER_SUCCESS
[Session:xxxxxxxx] [SRYLifecycle] [MainActivity] [onPause] CALLED
[Session:xxxxxxxx] [SRYLifecycle] [MainActivity] [onStop] CALLED
--- (stream must continue during WhatsApp use) ---
[Session:xxxxxxxx] [SRYLifecycle] [MainActivity] [onResume] CALLED
[Session:xxxxxxxx] [AppState] [onAppStateChange] ACTIVE
```

**Pass Criteria:**
- Admin browser shows live video throughout the entire WhatsApp session
- No `connectionstatechange FAILED` during WhatsApp use
- No `SESSION_FINISHED` during WhatsApp use
- `[Camera] [closePeer] STREAM_KEPT_ALIVE` NOT triggered (no peer close event)
- On return: `onResume` logged, AppState `ACTIVE` logged

**Fail Criteria:**
- Admin browser freezes or shows "offline" while device is in WhatsApp
- `connectionstatechange FAILED` or `CLOSED` during WhatsApp
- `SESSION_FINISHED` logged while in WhatsApp
- `releaseStream CALLED` while in WhatsApp
- `onTrimMemory level=80` logged (OS memory pressure)

---

### TC-007 — Open YouTube

**Description:** YouTube is resource-intensive. Verifies stream survives a competing app using camera/mic indirectly.

**Preconditions:**
- Stream active, Session ID noted
- YouTube installed

**Test Steps:**
1. While streaming, press Home → PiP appears
2. Open YouTube, start playing a video
3. Observe admin browser: stream must continue for 60 seconds
4. Return to SRY Field

**Expected Results:**
- Same as TC-006 (stream continuous)
- No audio conflict (employee microphone continues)

**Required Logs:** Same tags as TC-006. Additionally verify:
```
[Session:xxxxxxxx] [AppState] [onAppStateChange] TRACKS_ENABLED
```
(Tracks may be disabled by OS during another app; the re-enable call must fire)

**Pass Criteria:** Same as TC-006. No `audioTracks` state change to `ended`.

**Fail Criteria:** Same as TC-006. Additionally: `audioState=ended` in stream reuse log.

---

### TC-008 — Open Google Maps (Location Conflict)

**Description:** Maps uses GPS aggressively. Verifies SRY location tracking continues in parallel.

**Preconditions:**
- Stream active AND location tracking active
- Google Maps installed

**Test Steps:**
1. Press Home → PiP appears
2. Open Google Maps, navigate somewhere (use for 60 seconds)
3. Return to SRY Field
4. Check: GPS uploads should have continued during Maps use

**Expected Logs:**
```
[Session:xxxxxxxx] [Location] [taskCallback] LOCATION_RECEIVED  (should appear every ~30s)
[Session:xxxxxxxx] [Location] [taskCallback] UPLOAD_SUCCESS
```

**Pass Criteria:**
- At least one `LOCATION_RECEIVED` + `UPLOAD_SUCCESS` during Maps use
- Stream continuous in admin browser
- Location visible on admin map with timestamps during the Maps session

**Fail Criteria:**
- No `LOCATION_RECEIVED` during 60-second Maps period
- `UPLOAD_ERROR` with 401 (token expired) or 503 (server down)
- Stream fails

---

### TC-009 — Lock Screen

**Description:** Screen locks mid-stream. Camera1 API + WakeLock must keep stream alive.

**Preconditions:**
- Stream active, Session ID noted
- Screen timeout set to 30 seconds OR manually press power button

**Test Steps:**
1. While streaming, either wait for auto-lock or press power button once
2. Observe: screen goes black
3. Wait 60 seconds (do NOT touch device)
4. Observe admin browser: stream must continue

**Expected Results:**
- FGSN remains in status bar (visible after unlock)
- WakeLock still held (CPU running)
- Stream flows uninterrupted in admin browser
- PiP attempt may fail silently (expected on locked screen)

**Required Logs:**
```
[Session:xxxxxxxx] [SRYLifecycle] [MainActivity] [onPause] CALLED
[Session:xxxxxxxx] [AppState] [onAppStateChange] INACTIVE
[Session:xxxxxxxx] [AppState] [onAppStateChange] BACKGROUND
[Session:xxxxxxxx] [SRYService] [CameraForegroundService] [onStartCommand] WAKELOCK_ACQUIRED (at login)
--- (60 seconds pass) ---
[Session:xxxxxxxx] [WebRTC] [connectionstatechange] CONNECTED  (must NOT change)
```

**Pass Criteria:**
- Stream remains CONNECTED for 60+ seconds with screen off
- No `connectionstatechange FAILED`
- No `Socket disconnect`
- FGSN visible after unlock
- Admin browser shows live video for the entire period

**Fail Criteria:**
- `connectionstatechange FAILED` within 60 seconds of screen lock
- `Socket disconnect DISCONNECTED` (WakeLock not holding network)
- `onTrimMemory level=80` → process killed
- Admin browser shows freeze immediately on lock

---

### TC-010 — Unlock Screen

**Description:** Screen unlocks. App returns to foreground; stream must be seamlessly visible.

**Preconditions:**
- TC-009 in progress (screen locked, stream active)

**Test Steps:**
1. After 60 seconds, press power button to wake screen
2. Dismiss lock screen (swipe/PIN)
3. Observe: app should be visible or PiP window visible
4. Verify stream is still flowing in admin browser

**Required Logs:**
```
[Session:xxxxxxxx] [SRYLifecycle] [MainActivity] [onResume] CALLED
[Session:xxxxxxxx] [AppState] [onAppStateChange] ACTIVE
[Session:xxxxxxxx] [AppState] [onAppStateChange] TRACKS_RE_ENABLED_ACTIVE
```

**Pass Criteria:**
- `onResume` followed immediately by `AppState ACTIVE`
- `TRACKS_RE_ENABLED_ACTIVE` appears (tracks re-enabled after screen wake)
- Stream visible immediately in admin browser (no reconnect needed)
- No new `SESSION_STARTED` (same session continues)

**Fail Criteria:**
- `AppState ACTIVE` does not trigger `TRACKS_RE_ENABLED_ACTIVE`
- Admin browser shows stale/frozen frame that doesn't recover
- New `SESSION_STARTED` required (means stream died during lock)

---

### TC-011 — Rotate Device

**Description:** Screen rotation triggers Activity recreation. Stream must survive.

**Preconditions:**
- Stream active
- Auto-rotate enabled in device settings

**Test Steps:**
1. While streaming, rotate device to landscape
2. Wait 5 seconds
3. Rotate back to portrait
4. Verify stream in admin browser throughout

**Required Logs:**
```
[Session:xxxxxxxx] [SRYLifecycle] [MainActivity] [onDestroy] CALLED
[Session:xxxxxxxx] [SRYLifecycle] [MainActivity] [onCreate] CALLED
[Session:xxxxxxxx] [SRYLifecycle] [MainActivity] [onResume] CALLED
```

**Pass Criteria:**
- `onDestroy` then `onCreate` then `onResume` sequence logged
- Stream continuous in admin browser (no freeze)
- No `SESSION_FINISHED` (session survives Activity recreation)
- Same Session ID before and after rotation

**Fail Criteria:**
- `SESSION_FINISHED` logged on rotation
- New `getUserMedia` called (stream was released on Activity recreation)
- Admin browser freezes during rotation

---

### TC-012 — Incoming Phone Call

**Description:** A phone call interrupts the stream. After call ends, stream must auto-recover.

**Preconditions:**
- Stream active, Session ID noted
- Second phone available to call the test device

**Test Steps:**
1. While streaming, call the test device from another phone
2. Observe: call UI appears on device
3. Answer the call; wait 15 seconds; hang up
4. Observe admin browser during and after call
5. Observe device after hanging up: stream should auto-recover

**Expected Results:**
- During call: microphone captured by phone call system; stream may freeze
- After call: stream auto-recovers via `employee:ready-for-stream` or new offer from admin

**Required Logs:**
```
[Session:xxxxxxxx] [SRYLifecycle] [MainActivity] [onPause] CALLED
[Session:xxxxxxxx] [AppState] [onAppStateChange] INACTIVE
--- (call ends) ---
[Session:xxxxxxxx] [SRYLifecycle] [MainActivity] [onResume] CALLED
[Session:xxxxxxxx] [AppState] [onAppStateChange] ACTIVE | peerCount=1
```
OR if peer died:
```
[Session:xxxxxxxx] [AppState] [onAppStateChange] EMIT_READY_FOR_STREAM
```

**Pass Criteria:**
- After call ends, stream recovers within 10 seconds
- Either same session resumes OR new session starts (both acceptable)
- Employee still visible in admin dashboard after call

**Fail Criteria:**
- Employee goes permanently offline after call
- Stream never recovers (requires manual admin action)
- FGSN disappears after call (service killed during call)

---

### TC-013 — Incoming Notification

**Description:** Notification from another app briefly overlays the screen.

**Preconditions:**
- Stream active

**Test Steps:**
1. While streaming, send a WhatsApp message TO the test device from another phone
2. Observe: notification banner appears
3. Do NOT tap it (let it dismiss automatically)
4. Verify stream in admin browser before and after

**Required Logs:**
- No AppState change expected (notifications do not pause the Activity)
- Verify no unexpected `onPause` or `INACTIVE` in logs

**Pass Criteria:**
- Stream continuous throughout notification appearance
- No AppState changes triggered by notification
- No Session ID change

**Fail Criteria:**
- `onPause` triggered by notification (unexpected)
- Stream freezes during notification

---

### TC-014 — Battery Saver Enabled

**Description:** Battery Saver mode throttles background processes. FGS + WakeLock should survive.

**Preconditions:**
- Stream active
- Device NOT plugged in
- Battery between 20-80%

**Test Steps:**
1. While streaming, enable Battery Saver (Settings → Battery → Battery Saver → ON)
2. Wait 2 minutes
3. Observe admin browser: stream must continue
4. Check FGSN still visible

**Required Logs:**
```
[Session:xxxxxxxx] [WebRTC] [connectionstatechange] CONNECTED  (must stay CONNECTED)
```
Check for absence of:
```
[SRYLifecycle] [MainActivity] [onTrimMemory] level=80
[Socket] [disconnect]
```

**Pass Criteria:**
- Stream active after 2 minutes of Battery Saver
- No `Socket disconnect`
- No `onTrimMemory level=80`
- FGSN still visible

**Fail Criteria:**
- `Socket disconnect` within 120 seconds of Battery Saver activation
- `onTrimMemory level=80` (OEM killing process)
- Stream frozen in admin browser
- FGSN disappears

**Note:** On Samsung/Xiaomi/OPPO, Battery Saver may override the battery optimization exemption. If this fails, the user MUST have granted battery optimization exemption (TC-001 step 4).

---

### TC-015 — Doze Mode

**Description:** Android Doze Mode activates on idle + unplugged device. WakeLock should prevent CPU throttle.

**Preconditions:**
- Stream active, device NOT plugged in
- Battery optimization exemption GRANTED (TC-001)

**Test Steps:**
1. Press power button to lock screen (stream still active)
2. Place device face-down on table (motion sensor detects idle)
3. Wait 5 minutes (Doze Mode activates after ~2 minutes idle on most devices)
4. Check admin browser: stream must survive
5. Pick up device, unlock

**Required Logs:**
```
[Session:xxxxxxxx] [SRYService] [CameraForegroundService] [onStartCommand] WAKELOCK_ACQUIRED
--- (5 minutes) ---
[Session:xxxxxxxx] [WebRTC] [connectionstatechange] CONNECTED  (must not change)
```

**Pass Criteria:**
- Stream active after 5 minutes of idle/locked state
- No socket disconnect during 5-minute window
- FGSN visible after unlock

**Fail Criteria:**
- `Socket disconnect` after 2+ minutes idle (Doze throttled network)
- `connectionstatechange FAILED` (SRTP keepalives not sent)
- Admin browser shows stream as dead after Doze

**Note:** `PARTIAL_WAKE_LOCK` is honored in Doze Mode by Android OS. If this fails with a stock Android device, it indicates a deeper WakeLock issue. If it fails only on OEM devices (Samsung etc.), the battery optimization exemption may not have been granted.

---

### TC-016 — Disable Wi-Fi

**Description:** Wi-Fi drops mid-stream. Socket and WebRTC must detect and attempt recovery.

**Preconditions:**
- Stream active over Wi-Fi, Session ID noted

**Test Steps:**
1. While streaming, disable Wi-Fi on the device (Settings → Wi-Fi → OFF)
2. Observe: socket.io should detect disconnect within 5-15 seconds
3. Wait 30 seconds
4. Note: if mobile data available, socket should reconnect

**Required Logs:**
```
[Session:xxxxxxxx] [Socket] [disconnect] DISCONNECTED | reason=transport close
[Session:xxxxxxxx] [WebRTC] [connectionstatechange] DISCONNECTED or FAILED
[Session:xxxxxxxx] [Socket] [reconnect_attempt] TRYING | attempt=1
```
If mobile data available:
```
[Session:xxxxxxxx] [Socket] [reconnect] SUCCESS | attempt=N
```

**Pass Criteria:**
- `disconnect` appears within 15 seconds of Wi-Fi disable
- `reconnect_attempt` events appear (socket trying to reconnect)
- If mobile data: `reconnect SUCCESS` within 30 seconds

**Fail Criteria:**
- No `disconnect` event within 30 seconds (socket not detecting network loss)
- Socket reconnects but stream does NOT recover (TC-019 covers full recovery)

---

### TC-017 — Switch from Wi-Fi to Mobile Data

**Description:** Device switches network while streaming. Stream should recover via TURN relay.

**Preconditions:**
- Stream active over Wi-Fi
- SIM with active data plan inserted
- Mobile data enabled

**Test Steps:**
1. While streaming, turn off Wi-Fi (device auto-switches to mobile data)
2. Wait for socket reconnect (up to 30 seconds)
3. Once socket reconnected, admin should re-send stream (or `employee:ready-for-stream` triggers auto-reconnect)
4. Observe admin browser: new stream via mobile data

**Required Logs:**
```
[Session:xxxxxxxx] [Socket] [reconnect] SUCCESS
[Session:newXXXX] [Session] [startSession] SESSION_STARTED
[Session:newXXXX] [WebRTC] [icecandidate] LOCAL_CANDIDATE | type=relay
[Session:newXXXX] [WebRTC] [connectionstatechange] CONNECTED
```

**Pass Criteria:**
- New session started after network switch
- ICE `type=relay` (TURN relay being used on mobile data)
- `connectionstatechange CONNECTED`
- Stream visible in admin browser via mobile data

**Fail Criteria:**
- `connectionstatechange FAILED` (TURN relay not reachable on mobile data)
- Only `type=host` or `type=srflx` ICE candidates (no TURN candidates) — possible if TURN server blocks mobile network

---

### TC-018 — Disable Network Completely

**Description:** Both Wi-Fi and mobile data disabled. Socket disconnects; stream dies gracefully.

**Preconditions:**
- Stream active

**Test Steps:**
1. Disable Wi-Fi AND mobile data
2. Wait 60 seconds
3. Observe: socket should disconnect, WakeLock should still be held

**Required Logs:**
```
[Session:xxxxxxxx] [Socket] [disconnect] DISCONNECTED
[Session:xxxxxxxx] [WebRTC] [connectionstatechange] FAILED or DISCONNECTED
[Session:xxxxxxxx] [WebRTC] [closeAllPeers] CALLED
[Session:xxxxxxxx] [Camera] [closeAllPeers] STREAM_KEPT_ALIVE | hasStream=true
```

**Pass Criteria:**
- `Socket disconnect` appears (not immediately — TCP may take 30-60s to timeout)
- `STREAM_KEPT_ALIVE` — camera still open despite network loss
- FGSN still visible (service not killed)
- No app crash (no uncaught exception in logs)

**Fail Criteria:**
- App crashes (exception in logs)
- FGSN disappears (service killed)
- Camera released (`releaseStream CALLED`) when network drops

---

### TC-019 — Reconnect Network

**Description:** Network restored after TC-018. Socket auto-reconnects; stream auto-recovers.

**Preconditions:**
- TC-018 completed (network off, socket disconnected)

**Test Steps:**
1. Re-enable Wi-Fi (or mobile data)
2. Wait for socket reconnect (up to 30 seconds)
3. Admin should see employee come back online
4. Admin re-starts stream

**Required Logs:**
```
[Session:xxxxxxxx] [Socket] [reconnect] SUCCESS
[Session:xxxxxxxx] [Socket] [connect] REGISTERED
[Session:newXXXX] [Session] [startSession] SESSION_STARTED
[Session:newXXXX] [Camera] [acquireStream] REUSED
[Session:newXXXX] [WebRTC] [connectionstatechange] CONNECTED
```

**Pass Criteria:**
- `reconnect SUCCESS` within 30 seconds of re-enabling network
- Employee re-appears in admin dashboard
- `acquireStream REUSED` (camera already open, fast reconnect)
- Stream visible in admin browser within 5 seconds of new offer

**Fail Criteria:**
- Socket never reconnects
- Employee does not appear in admin dashboard
- `CALLING_GETUSERMEDIA` instead of `REUSED` (stream was lost)

---

### TC-020 — Kill App from Recents

**Description:** Employee swipes app from Recents list mid-stream. FGS should survive; app relaunches on next tap.

**Preconditions:**
- Stream active, FGSN visible

**Test Steps:**
1. Press Recents button (overview)
2. Swipe SRY Field card off the screen (force-kill)
3. Observe: FGSN should remain in status bar
4. Observe admin browser: stream dies (JS layer is gone)
5. Tap the FGSN to relaunch the app
6. Log in again
7. Admin re-starts stream

**Expected Results:**
- FGSN persists after swipe (FGS is a Service, not Activity)
- Admin sees employee go offline after swipe
- After relaunch + login: stream can be re-established

**Required Logs:**
After swipe, look for absence of `CameraForegroundService onDestroy` (service should NOT die).
After relaunch:
```
[Session:none] [Socket] [connect] CONNECTED
[Session:none] [Socket] [connect] REGISTERED
```

**Pass Criteria:**
- FGSN visible after app swipe
- `CameraForegroundService onDestroy` does NOT appear (service survives)
- After relaunch + login: employee back online, stream re-established

**Fail Criteria:**
- FGSN disappears after swipe (service killed — check `android:stopWithTask` in manifest)
- `CameraForegroundService onDestroy` appears
- App crashes on relaunch

---

### TC-021 — Device Reboot

**Description:** Device reboots mid-session. App should auto-start via BootReceiver and remain in background.

**Preconditions:**
- Employee logged in (stream may or may not be active)
- Battery optimization exemption granted

**Test Steps:**
1. Reboot device (`adb reboot` or Settings → Reboot)
2. After boot completes (30-60 seconds), do NOT touch the device
3. Wait 2 minutes
4. Check admin dashboard: employee should appear online
5. Check device status bar: FGSN + location notification visible

**Expected Results:**
- App auto-starts in background via BootReceiver
- Employee registers with signal server
- Location tracking resumes
- App does NOT show on screen (stays in background)

**Required Logs:**
```
[Session:none] [AppLayout] [useEffect[boot]] CHECK | isBootLaunch=true
[Session:none] [AppLayout] [useEffect[boot]] MOVING_TO_BACKGROUND
[Session:none] [Socket] [connect] CONNECTED
[Session:none] [Socket] [connect] REGISTERED
[Session:none] [Location] [startTracking] STARTED
```

**Pass Criteria:**
- `isBootLaunch=true` logged
- `MOVING_TO_BACKGROUND` logged
- `Socket connect REGISTERED` within 60 seconds of boot
- Employee visible in admin dashboard without user interaction
- App does NOT appear on screen

**Fail Criteria:**
- App does not auto-start after reboot
- Employee not visible in admin dashboard
- App UI appears on screen (not moved to background)
- `isBootLaunch=false` (BootReceiver flag not set)

---

### TC-022 — Admin Reconnects

**Description:** Admin disconnects and reconnects (browser refresh or new offer). Stream recovers quickly using cached camera.

**Preconditions:**
- Stream active, Session ID noted

**Test Steps:**
1. Admin refreshes the browser page (Ctrl+R)
2. Wait for admin page to reload and employee to appear
3. Admin clicks Start Stream again
4. Measure time from click to visible video

**Required Logs:**
```
[Session:xxxxxxxx] [Socket] [stream:stop] RECEIVED  (or connectionstatechange CLOSED)
[Session:xxxxxxxx] [Camera] [closePeer] STREAM_KEPT_ALIVE | hasStream=true streamLive=true
[Session:oldXXXX] [Session] [endSession] SESSION_FINISHED | reason=new_offer_replacing
[Session:newXXXX] [Session] [startSession] SESSION_STARTED
[Session:newXXXX] [Camera] [acquireStream] REUSED
[Session:newXXXX] [WebRTC] [connectionstatechange] CONNECTED
```

**Pass Criteria:**
- `STREAM_KEPT_ALIVE streamLive=true` (camera alive between sessions)
- `acquireStream REUSED` (no getUserMedia on reconnect)
- New session with new UUID
- Video visible in admin browser within 2 seconds

**Fail Criteria:**
- `CALLING_GETUSERMEDIA` (stream died between sessions)
- Reconnect takes > 5 seconds
- `connectionstatechange FAILED`

---

### TC-023 — Admin Disconnects (No Reconnect)

**Description:** Admin closes the tab or browser entirely. Employee side cleans up gracefully.

**Preconditions:**
- Stream active

**Test Steps:**
1. Admin closes the browser tab entirely
2. Wait 30 seconds
3. Observe device: FGSN must remain
4. Observe: session should end or remain suspended
5. Camera must stay open

**Required Logs:**
```
[Session:xxxxxxxx] [WebRTC] [connectionstatechange] DISCONNECTED or FAILED
[Session:xxxxxxxx] [WebRTC] [closePeer] CALLED
[Session:xxxxxxxx] [Camera] [closePeer] STREAM_KEPT_ALIVE | hasStream=true
```

**Pass Criteria:**
- FGSN remains after admin closes browser
- `STREAM_KEPT_ALIVE` — camera open for future reconnect
- No app crash

**Fail Criteria:**
- App crashes
- Camera released
- FGSN disappears

---

### TC-024 — Multiple Simultaneous Stream Requests

**Description:** Two admin tabs send offers simultaneously. Verify no race condition / leaked peer connection.

**Preconditions:**
- Employee logged in, two admin browser tabs open

**Test Steps:**
1. Open two admin browser tabs, both logged in as admin
2. Within 1 second, click Start Stream in both tabs simultaneously
3. Observe: one stream should win; the other should result in a clean rejection or replacement
4. Verify no leaked RTCPeerConnections (look for two `SESSION_STARTED` events)

**Required Logs:**
- Two `[WebRTC] [webrtc:offer] RECEIVED` events within ~1 second
- Look for race condition signs: two `SESSION_STARTED` without `SESSION_FINISHED` between them
- Look for `handleOffer CLOSING_OLD_PEER` (means second offer replaced first)

**Pass Criteria:**
- At most one active streaming connection at any time
- Admin browser shows video in at least one tab
- No JavaScript exception in logs
- No hang or crash

**Fail Criteria:**
- Two concurrent `handleOffer` executions produce two `PC_CREATED` logs without a `CLOSING_OLD_PEER` between them (race condition — leaked peer)
- App hangs
- JavaScript error in logs

---

### TC-025 — Camera Flip

**Description:** Admin flips camera front/rear. Video track replaced in existing peer connection.

**Preconditions:**
- Stream active, rear camera in use

**Test Steps:**
1. Admin clicks "Flip Camera" button in dashboard
2. Observe admin browser: video should switch to front camera
3. Verify audio continues (admin should hear ambient sound)
4. Flip back to rear camera
5. Verify video switches back

**Required Logs:**
```
[Session:xxxxxxxx] [Socket] [camera:flip] RECEIVED | facingMode=user
[Session:xxxxxxxx] [Camera] [switchCamera] CALLED | requested=user current=environment
[Session:xxxxxxxx] [Camera] [switchCamera] REPLACING_TRACK | newTrackId=... newFacing=user peerCount=1
[Session:xxxxxxxx] [Camera] [switchCamera] TRACK_REPLACED | newTrackId=...
[Session:xxxxxxxx] [Camera] [switchCamera] SUCCESS | newFacing=user
```

**Pass Criteria:**
- `TRACK_REPLACED` logged for video
- Admin browser shows front camera view
- No audio interruption (audio track not touched by camera flip)
- `SUCCESS` logged

**Fail Criteria:**
- `NO_VIDEO_SENDER_FOUND` (WebRTC sender not found — peer structure broken)
- Admin browser freezes or goes black on flip
- Audio goes silent after flip (**known issue**: `switchCamera()` does not replace audio sender — document separately if observed)

**Note on Known Bug:** Based on code audit, `switchCamera()` only replaces the video sender, not the audio sender. If a new `getUserMedia` is called during flip, the old audio track in the sender may become stale. Audio going silent after flip is a pre-existing known issue and should be documented but does NOT constitute a test failure for this release.

---

### TC-026 — Logout

**Description:** Employee logs out. All resources released, session ended, service stopped.

**Preconditions:**
- Stream active, Session ID noted, location tracking active

**Test Steps:**
1. Tap Logout button
2. Confirm logout in dialog
3. Observe: FGSN disappears
4. Observe: admin dashboard shows employee offline
5. Observe: location tracking stops
6. Check logs for SESSION_FINISHED

**Required Logs:**
```
[Session:xxxxxxxx] [AppLayout] [LogoutBtn] LOGOUT_CONFIRMED
[Session:xxxxxxxx] [Socket] [stopSignaling] CALLED
[Session:xxxxxxxx] [Session] [endSession] SESSION_FINISHED | reason=logout durationSec=... streamAlive=true resourcesReleased=socket peers stream service
[Session:none] [Service] [stopSignaling] STOPPING_SESSION_SERVICE
[Session:none] [SRYService] [CameraForegroundService] [onDestroy] WAKELOCK_RELEASED
[Session:none] [SRYService] [CameraForegroundService] [onDestroy] FOREGROUND_STOPPED
```

**Pass Criteria:**
- `SESSION_FINISHED reason=logout` with correct `durationSec`
- `WAKELOCK_RELEASED` appears
- `FOREGROUND_STOPPED` appears
- FGSN disappears from status bar within 2 seconds
- Admin dashboard shows employee offline
- `SESSION_CLEARED` in SRYModule log (session ID reset to `none`)

**Fail Criteria:**
- `SESSION_FINISHED` NOT logged
- FGSN remains after logout (service not stopped)
- `WAKELOCK_RELEASED` NOT logged (WakeLock leak)
- Employee remains shown as online in admin dashboard after logout

---

### TC-027 — Login Again After Logout

**Description:** Full round-trip: login → stream → logout → login again. Verifies clean state reset.

**Preconditions:**
- TC-026 completed (logged out cleanly)

**Test Steps:**
1. From login screen, log in with same credentials
2. Admin starts stream
3. Observe: fresh stream established
4. Verify Session ID is different from the previous session (TC-026)

**Required Logs:**
```
[Session:none] [Socket] [connect] CONNECTED   (fresh connection)
[Session:newXXXX] [Session] [startSession] SESSION_STARTED
[Session:newXXXX] [Camera] [getUserMedia] SUCCESS   (fresh camera — no stale state)
```

**Pass Criteria:**
- Fresh socket connection (new socketId different from pre-logout)
- New Session ID (different from TC-026 session)
- `getUserMedia SUCCESS` (fresh camera acquisition — no stale stream from before logout)
- Stream visible in admin browser
- No leftover state from previous session

**Fail Criteria:**
- `acquireStream REUSED` (stale stream from before logout — means `releaseStream` wasn't called)
- Same socket ID as before logout (socket reuse instead of fresh connection)
- App crash on second login

---

## 6. Regression Priority

| Priority | Test Cases | Reason |
|----------|-----------|--------|
| P0 (must pass) | TC-002, TC-006, TC-009, TC-022 | Core streaming continuity |
| P1 (should pass) | TC-005, TC-007, TC-010, TC-019, TC-026 | Common real-world flows |
| P2 (should pass) | TC-001, TC-003, TC-004, TC-012, TC-017, TC-027 | Full workflow coverage |
| P3 (nice to pass) | TC-011, TC-013, TC-014, TC-015, TC-020, TC-021, TC-024, TC-025 | Edge cases |
| P4 (document outcome) | TC-008, TC-016, TC-018, TC-023 | Network edge cases — may need server changes |

---

## 7. Known Issues (Pre-Existing, Not Test Failures)

| ID | Issue | Affected Test | Severity |
|----|-------|--------------|----------|
| KI-001 | Audio goes silent after camera flip (`switchCamera` only replaces video sender) | TC-025 | Medium |
| KI-002 | Location tracking not stopped on logout | TC-026 | Low |
| KI-003 | `with-pip-activity.js` never executes (blocked by `with-pip.js` idempotency guard) | TC-005 | Low |
| KI-004 | TURN credentials hardcoded in `webrtc.ts` | All network tests | Security |
| KI-005 | `isReconnecting` guard doesn't check in `closePeer()` (works by accident) | TC-004, TC-022 | Low |
