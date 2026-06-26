# SRY Field — Test Execution Checklist

**Tester:** _______________
**Date:** _______________
**Device 1:** _______________  (model / Android version)
**Device 2:** _______________  (model / Android version)
**APK Build:** commit `adfe12c`
**Log file:** _______________

Mark each item: ✅ Pass · ❌ Fail · ⚠️ Partial · ⏭ Skipped

---

## Pre-Test Setup

- [ ] ADB connected — `adb devices` shows device
- [ ] Log collection started — `adb logcat -c && adb logcat -s ReactNativeJS SRYLifecycle SRYService SRYModule > test_YYYYMMDD.log &`
- [ ] APK installed — `adb install -r sry-field.apk`
- [ ] Admin browser open at `https://sry.sarayatec.com`
- [ ] App force-stopped — `adb shell am force-stop com.sarayatec.sryfield`
- [ ] WhatsApp, YouTube, Google Maps installed on device
- [ ] Battery optimization: initially NOT exempted
- [ ] Screen timeout: 30 seconds (for TC-009)
- [ ] Auto-rotate: ON (for TC-011)

---

## P0 — Must Pass

### TC-001 Login
- [ ] App launches and shows login screen
- [ ] Enter credentials and tap Login
- [ ] Battery optimization dialog appears
- [ ] Log: `[Socket] [connect] CONNECTED` with socketId
- [ ] Log: `[CameraForegroundService] [onStartCommand] FOREGROUND_STARTED`
- [ ] Log: `[CameraForegroundService] [onStartCommand] WAKELOCK_ACQUIRED`
- [ ] Log: `[Location] [startTracking] STARTED`
- [ ] Log: `camera=granted audio=granted`
- [ ] FGSN visible in status bar
- [ ] Employee appears in admin dashboard

**Session ID at login:** `[Session:none]` (expected — no stream yet)
**Result:** ___  **Notes:** _______________

---

### TC-002 Start Camera Stream
- [ ] Admin clicks "Start Stream"
- [ ] Log: `[WebRTC] [webrtc:offer] RECEIVED`
- [ ] Log: `[Session] SESSION_STARTED` — **note Session ID:** _______________
- [ ] Log: `[Camera] [getUserMedia] SUCCESS | videoTracks=1 audioTracks=1`
- [ ] Log: `[WebRTC] [connectionstatechange] CONNECTED`
- [ ] Log: `[WebRTC] [handleOffer] ANSWER_SENT`
- [ ] Admin browser shows live video within 5 seconds
- [ ] Audio audible in admin browser

**Session ID:** _______________ (first 8 chars)
**Time to video:** ___ seconds
**Result:** ___  **Notes:** _______________

---

### TC-006 Open WhatsApp (PRIMARY REGRESSION TEST)
- [ ] Stream active (TC-002 state)
- [ ] Press Home → PiP window appears
- [ ] Log: `[onUserLeaveHint] PIP_ENTER_SUCCESS`
- [ ] Open WhatsApp
- [ ] **Admin browser: stream continues for 30 seconds** — keep watching
- [ ] No `connectionstatechange FAILED` in logs during WhatsApp
- [ ] No `SESSION_FINISHED` in logs during WhatsApp
- [ ] Return to SRY Field
- [ ] Log: `[AppState] ACTIVE`
- [ ] Stream still flowing in admin browser after return

**Did stream survive WhatsApp?** YES / NO
**Any disconnection?** YES / NO
**Result:** ___  **Notes:** _______________

---

### TC-009 Lock Screen
- [ ] Stream active
- [ ] Press power button to lock screen
- [ ] Log: `[AppState] INACTIVE` then `BACKGROUND`
- [ ] Wait 60 seconds — do NOT touch device
- [ ] Admin browser: stream flowing for entire 60 seconds
- [ ] No `connectionstatechange FAILED`
- [ ] No `Socket disconnect`
- [ ] FGSN visible after unlock
- [ ] Log: `[AppState] ACTIVE` on unlock

**Stream alive after 60s locked?** YES / NO
**Result:** ___  **Notes:** _______________

---

### TC-022 Admin Reconnects
- [ ] Stream active, Session ID noted: _______________
- [ ] Admin refreshes browser
- [ ] Log: `[Camera] [closePeer] STREAM_KEPT_ALIVE | hasStream=true streamLive=true`
- [ ] Admin re-starts stream
- [ ] Log: `[Session] SESSION_FINISHED reason=new_offer_replacing`
- [ ] Log: `[Session] SESSION_STARTED` — **new Session ID:** _______________
- [ ] Log: `[Camera] [acquireStream] REUSED` (NOT `CALLING_GETUSERMEDIA`)
- [ ] Log: `[WebRTC] [connectionstatechange] CONNECTED`
- [ ] Video in admin browser within 2 seconds

**Time to reconnect:** ___ seconds
**Camera reused (not reopened)?** YES / NO
**Result:** ___  **Notes:** _______________

---

## P1 — Should Pass

### TC-005 Press Home → PiP
- [ ] Stream active
- [ ] Press Home
- [ ] PiP window appears (floating video)
- [ ] Log: `[onUserLeaveHint] PIP_ENTER_SUCCESS`
- [ ] Stream continuous in admin browser for 30 seconds
- [ ] Tap PiP to expand back to full screen
- [ ] Log: `[onPictureInPictureModeChanged] REORDER_TO_FRONT`

**PiP appeared?** YES / NO
**Result:** ___  **Notes:** _______________

---

### TC-007 Open YouTube
- [ ] Stream active
- [ ] Press Home → open YouTube → play video for 60 seconds
- [ ] Stream continuous in admin browser
- [ ] No `Socket disconnect` during YouTube
- [ ] Return to SRY Field, stream still flowing

**Result:** ___  **Notes:** _______________

---

### TC-010 Unlock Screen
- [ ] (Continuation of TC-009)
- [ ] Press power to wake, dismiss lock screen
- [ ] Log: `[MainActivity] [onResume] CALLED`
- [ ] Log: `[AppState] ACTIVE`
- [ ] Log: `TRACKS_RE_ENABLED_ACTIVE`
- [ ] Stream flowing in admin browser

**Result:** ___  **Notes:** _______________

---

### TC-019 Reconnect Network
- [ ] (After TC-018 — network disabled)
- [ ] Re-enable Wi-Fi
- [ ] Log: `[Socket] [reconnect] SUCCESS`
- [ ] Employee reappears in admin dashboard
- [ ] Admin restarts stream
- [ ] Log: `[Camera] [acquireStream] REUSED`
- [ ] Stream visible in admin browser

**Result:** ___  **Notes:** _______________

---

### TC-026 Logout
- [ ] Stream active
- [ ] Tap Logout → confirm
- [ ] Log: `[Session] SESSION_FINISHED reason=logout durationSec=...`
- [ ] Log: `[CameraForegroundService] [onDestroy] WAKELOCK_RELEASED`
- [ ] Log: `[CameraForegroundService] [onDestroy] FOREGROUND_STOPPED`
- [ ] FGSN disappears within 2 seconds
- [ ] Employee shown offline in admin dashboard
- [ ] App returns to login screen

**Session duration logged:** ___ seconds
**Result:** ___  **Notes:** _______________

---

## P2 — Should Pass

### TC-003 Stop Stream
- [ ] Admin stops stream
- [ ] Log: `[Camera] [closePeer] STREAM_KEPT_ALIVE | hasStream=true streamLive=true`
- [ ] No `releaseStream CALLED`
- [ ] No `SESSION_FINISHED`
- [ ] Camera remains open (confirmed by reusing in TC-004)

**Result:** ___  **Notes:** _______________

### TC-004 Reconnect After Stop
- [ ] Admin restarts stream after TC-003
- [ ] Log: `[Camera] [acquireStream] REUSED`
- [ ] Video in admin browser < 2 seconds

**Time to reconnect:** ___ seconds
**Result:** ___  **Notes:** _______________

### TC-012 Incoming Phone Call
- [ ] Call received during stream
- [ ] After call ends, stream recovers
- [ ] Employee still online in admin dashboard

**Result:** ___  **Notes:** _______________

### TC-017 Switch Wi-Fi → Mobile Data
- [ ] Wi-Fi disabled, mobile data takes over
- [ ] Socket reconnects
- [ ] Stream re-established with `type=relay` ICE candidate

**Result:** ___  **Notes:** _______________

### TC-027 Login Again After Logout
- [ ] (After TC-026)
- [ ] Login with same credentials
- [ ] New socket ID (different from TC-026)
- [ ] New Session ID
- [ ] `getUserMedia SUCCESS` (fresh camera, not reused from before logout)
- [ ] Stream established

**Result:** ___  **Notes:** _______________

---

## P3 — Edge Cases

### TC-011 Rotate Device
- [ ] Stream active during rotation
- [ ] Log: `onDestroy` then `onCreate` then `onResume`
- [ ] No `SESSION_FINISHED`
- [ ] Same Session ID before/after rotation
- [ ] Stream continuous in admin browser

**Result:** ___  **Notes:** _______________

### TC-013 Incoming Notification
- [ ] No unexpected `onPause` triggered by notification
- [ ] Stream continuous

**Result:** ___  **Notes:** _______________

### TC-014 Battery Saver
- [ ] Enable Battery Saver while streaming
- [ ] Stream active after 2 minutes
- [ ] No `Socket disconnect`

**Result:** ___  **Notes:** _______________

### TC-015 Doze Mode
- [ ] Lock screen, leave idle 5 minutes
- [ ] Stream alive after 5 minutes
- [ ] No socket disconnect

**Result:** ___  **Notes:** _______________

### TC-020 Kill from Recents
- [ ] FGSN remains after swipe
- [ ] No `CameraForegroundService onDestroy` (service survives)
- [ ] App relaunches successfully

**Result:** ___  **Notes:** _______________

### TC-021 Reboot
- [ ] App auto-starts after reboot
- [ ] `isBootLaunch=true` in logs
- [ ] Employee visible in admin dashboard without touch
- [ ] App not shown on screen

**Result:** ___  **Notes:** _______________

### TC-024 Multiple Stream Requests
- [ ] Two admin tabs send offers simultaneously
- [ ] No crash
- [ ] One clean stream established
- [ ] No duplicate `SESSION_STARTED` without `SESSION_FINISHED` between them

**Result:** ___  **Notes:** _______________

### TC-025 Camera Flip
- [ ] Admin flips camera
- [ ] Log: `[Camera] [switchCamera] TRACK_REPLACED`
- [ ] Admin sees front camera
- [ ] (Document if audio goes silent — known issue KI-001)

**Audio silent after flip?** YES / NO  *(if YES, document as KI-001, not a failure)*
**Result:** ___  **Notes:** _______________

---

## P4 — Document Outcome

### TC-008 Google Maps (Location Conflict)
- [ ] GPS uploads continue during Maps use
- [ ] At least one `LOCATION_RECEIVED` during 60-second Maps session

**Result:** ___  **Notes:** _______________

### TC-016 Disable Wi-Fi
- [ ] `Socket disconnect` appears within 15 seconds
- [ ] `reconnect_attempt` events visible

**Result:** ___  **Notes:** _______________

### TC-018 Disable Network Completely
- [ ] `Socket disconnect` appears
- [ ] `STREAM_KEPT_ALIVE` — camera not released
- [ ] FGSN remains
- [ ] No crash

**Result:** ___  **Notes:** _______________

### TC-023 Admin Closes Browser
- [ ] FGSN remains on device
- [ ] `STREAM_KEPT_ALIVE` logged
- [ ] No crash

**Result:** ___  **Notes:** _______________

---

## Summary

| Category | Pass | Fail | Partial | Skipped |
|----------|------|------|---------|---------|
| P0 (must pass) | | | | |
| P1 (should pass) | | | | |
| P2 (should pass) | | | | |
| P3 (edge cases) | | | | |
| P4 (document) | | | | |
| **TOTAL** | | | | |

**Overall result:** PASS / FAIL / CONDITIONAL PASS

**Conditional pass criteria:** All P0 pass + at least 4/6 P1 pass

**Tester signature:** _______________ **Date:** _______________
