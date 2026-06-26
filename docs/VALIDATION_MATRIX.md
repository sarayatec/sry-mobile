# SRY Field — Validation Matrix

**Build:** commit `adfe12c`
**Legend:** ✅ Must verify pass · ⚠️ Verify partial / may degrade · ➖ Not applicable · 📋 Document outcome only

---

## Matrix: Test Scenario × Component

| TC | Scenario | Camera | Microphone | GPS | Socket.IO | WebRTC | FGService | WakeLock | FGSN | Battery Opt. | PiP | Activity Lifecycle |
|----|----------|--------|------------|-----|-----------|--------|-----------|----------|------|-------------|-----|--------------------|
| TC-001 | Login | ➖ | ➖ | ✅ | ✅ | ➖ | ✅ | ✅ | ✅ | ✅ | ➖ | ✅ |
| TC-002 | Start stream | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ➖ | ⚠️ | ✅ |
| TC-003 | Stop stream | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ➖ | ➖ | ➖ |
| TC-004 | Reconnect stream | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ➖ | ⚠️ | ➖ |
| TC-005 | Press Home | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ➖ | ✅ | ✅ |
| TC-006 | Open WhatsApp | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️ | ✅ | ✅ |
| TC-007 | Open YouTube | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️ | ✅ | ✅ |
| TC-008 | Open Google Maps | ⚠️ | ⚠️ | ✅ | ✅ | ⚠️ | ✅ | ✅ | ✅ | ➖ | 📋 | ✅ |
| TC-009 | Lock screen | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️ | ⚠️ | ✅ |
| TC-010 | Unlock screen | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ➖ | ➖ | ✅ |
| TC-011 | Rotate device | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ➖ | ➖ | ✅ |
| TC-012 | Incoming call | ⚠️ | ⚠️ | ✅ | ✅ | ⚠️ | ✅ | ✅ | ✅ | ➖ | ⚠️ | ✅ |
| TC-013 | Incoming notification | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ➖ | ➖ | ✅ |
| TC-014 | Battery Saver | ✅ | ✅ | ⚠️ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ➖ | ➖ |
| TC-015 | Doze Mode | ✅ | ✅ | ⚠️ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ➖ | ➖ |
| TC-016 | Disable Wi-Fi | 📋 | 📋 | ✅ | 📋 | 📋 | ✅ | ✅ | ✅ | ➖ | ➖ | ➖ |
| TC-017 | Wi-Fi → mobile data | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ➖ | ➖ | ➖ |
| TC-018 | Disable network | 📋 | 📋 | ⚠️ | 📋 | 📋 | ✅ | ✅ | ✅ | ➖ | ➖ | ➖ |
| TC-019 | Reconnect network | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ➖ | ➖ | ➖ |
| TC-020 | Kill from Recents | 📋 | 📋 | ⚠️ | 📋 | 📋 | ✅ | ✅ | ✅ | ➖ | ➖ | ➖ |
| TC-021 | Reboot | ➖ | ➖ | ✅ | ✅ | ➖ | ✅ | ✅ | ✅ | ✅ | ➖ | ✅ |
| TC-022 | Admin reconnects | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ➖ | ⚠️ | ➖ |
| TC-023 | Admin disconnects | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ➖ | ➖ | ➖ |
| TC-024 | Multiple stream requests | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ➖ | ➖ | ➖ |
| TC-025 | Camera flip | ✅ | ⚠️ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ➖ | ➖ | ➖ |
| TC-026 | Logout | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ➖ | ➖ | ✅ |
| TC-027 | Login again | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ➖ | ✅ |

---

## Matrix: Test Scenario × Log Tags + Session Filter

| TC | Scenario | Log Tags | Session Filter | Success Signal | Failure Signal |
|----|----------|----------|----------------|----------------|----------------|
| TC-001 | Login | `SRYService SRYModule ReactNativeJS` | `[Session:none]` | `FOREGROUND_STARTED` `WAKELOCK_ACQUIRED` `startTracking STARTED` | `connect` missing, `camera=denied` |
| TC-002 | Start stream | `ReactNativeJS SRYModule` | `[Session:xxxxxxxx]` | `getUserMedia SUCCESS` `connectionstatechange CONNECTED` | `getUserMedia ERROR` `connectionstatechange FAILED` |
| TC-003 | Stop stream | `ReactNativeJS` | `[Session:xxxxxxxx]` | `STREAM_KEPT_ALIVE hasStream=true streamLive=true` | `releaseStream CALLED` (unexpected) |
| TC-004 | Reconnect stream | `ReactNativeJS` | new session ID | `acquireStream REUSED` | `CALLING_GETUSERMEDIA` |
| TC-005 | Press Home | `SRYLifecycle ReactNativeJS` | `[Session:xxxxxxxx]` | `PIP_ENTER_SUCCESS` `onStop CALLED` + stream stays CONNECTED | `PIP_ENTER_FAILED` `connectionstatechange FAILED` |
| TC-006 | Open WhatsApp | `ReactNativeJS SRYLifecycle SRYService` | `[Session:xxxxxxxx]` | No `FAILED` / `SESSION_FINISHED` during WhatsApp | `connectionstatechange FAILED` `SESSION_FINISHED` `disconnect` |
| TC-007 | Open YouTube | `ReactNativeJS SRYLifecycle` | `[Session:xxxxxxxx]` | Same as TC-006 | Same as TC-006 |
| TC-008 | Google Maps | `ReactNativeJS` | `[Session:xxxxxxxx]` | `LOCATION_RECEIVED` `UPLOAD_SUCCESS` during Maps | No location uploads during 60s Maps session |
| TC-009 | Lock screen | `ReactNativeJS SRYLifecycle SRYService` | `[Session:xxxxxxxx]` | No `disconnect` / `FAILED` during 60s locked | `Socket disconnect` `connectionstatechange FAILED` |
| TC-010 | Unlock | `ReactNativeJS SRYLifecycle` | `[Session:xxxxxxxx]` | `onResume` `ACTIVE` `TRACKS_RE_ENABLED_ACTIVE` | None of these appear on unlock |
| TC-011 | Rotate | `SRYLifecycle ReactNativeJS` | `[Session:xxxxxxxx]` | `onDestroy` → `onCreate` → same Session ID | New `SESSION_STARTED` after rotation |
| TC-012 | Call | `ReactNativeJS SRYLifecycle` | `[Session:xxxxxxxx]` | `ACTIVE` after call + stream or `EMIT_READY_FOR_STREAM` | Employee permanently offline after call |
| TC-013 | Notification | `SRYLifecycle` | `[Session:xxxxxxxx]` | No `onPause` triggered by notification | `onPause CALLED` (unexpected) |
| TC-014 | Battery Saver | `ReactNativeJS SRYService` | `[Session:xxxxxxxx]` | No `disconnect` in 2 min | `disconnect` or `onTrimMemory level=80` |
| TC-015 | Doze Mode | `ReactNativeJS SRYService` | `[Session:xxxxxxxx]` | No `disconnect` in 5 min, `WAKELOCK_ACQUIRED` at start | `disconnect` after 2+ min idle |
| TC-016 | Disable Wi-Fi | `ReactNativeJS` | `[Session:xxxxxxxx]` | `disconnect` within 15s, `reconnect_attempt` events | No `disconnect` within 30s (socket not detecting loss) |
| TC-017 | Wi-Fi → mobile | `ReactNativeJS` | new session ID | `reconnect SUCCESS` `icecandidate type=relay` | `connectionstatechange FAILED` (TURN blocked on mobile) |
| TC-018 | No network | `ReactNativeJS SRYService` | `[Session:xxxxxxxx]` | `disconnect` appears, `STREAM_KEPT_ALIVE` | `releaseStream` called, FGSN disappears |
| TC-019 | Reconnect net | `ReactNativeJS` | new session ID | `reconnect SUCCESS` `acquireStream REUSED` | Socket never reconnects |
| TC-020 | Kill Recents | `SRYService` | any | `onDestroy` NOT present for `CameraForegroundService` | `CameraForegroundService onDestroy CALLED` (service killed) |
| TC-021 | Reboot | `ReactNativeJS SRYService` | `[Session:none]` | `isBootLaunch=true` `MOVING_TO_BACKGROUND` `connect REGISTERED` | `isBootLaunch=false`, app not auto-starting |
| TC-022 | Admin reconnects | `ReactNativeJS` | old + new session | `SESSION_FINISHED reason=new_offer_replacing` → `SESSION_STARTED` → `REUSED` | `CALLING_GETUSERMEDIA` (slow reconnect), `FAILED` |
| TC-023 | Admin disconnects | `ReactNativeJS SRYService` | `[Session:xxxxxxxx]` | `STREAM_KEPT_ALIVE` FGSN present | `releaseStream CALLED`, FGSN gone |
| TC-024 | Multiple offers | `ReactNativeJS` | two session IDs | At most one `SESSION_STARTED` without `SESSION_FINISHED` between | Two concurrent `PC_CREATED` without `CLOSING_OLD_PEER` |
| TC-025 | Camera flip | `ReactNativeJS` | `[Session:xxxxxxxx]` | `TRACK_REPLACED` `SUCCESS` | `NO_VIDEO_SENDER_FOUND` `ERROR` |
| TC-026 | Logout | `ReactNativeJS SRYService SRYModule` | `[Session:xxxxxxxx]` | `SESSION_FINISHED reason=logout` `WAKELOCK_RELEASED` `FOREGROUND_STOPPED` | Any of these missing |
| TC-027 | Login again | `ReactNativeJS` | new session ID | `getUserMedia SUCCESS` new socketId | `acquireStream REUSED` (stale state), same socketId |

---

## Matrix: Component × What Can Kill It

This table helps triage failures — given a failing component, what scenarios are most likely to expose it.

| Component | Killed by | Detectable via | Most important TCs |
|-----------|-----------|----------------|-------------------|
| **Camera** | `releaseStream()` called unexpectedly; `getUserMedia` fails; Camera2 API (not patched) | `[Camera] [releaseStream]` unexpected; `getUserMedia ERROR` | TC-002, TC-003, TC-006, TC-009 |
| **Microphone** | Same as camera (same MediaStream); audio track `ended` state | `audioState=ended` in `acquireStream REUSED` | TC-002, TC-012, TC-025 |
| **GPS** | `stopTracking()` called; expo-location service killed by OS | No `LOCATION_RECEIVED` for > 60s | TC-008, TC-014, TC-015, TC-026 |
| **Socket.IO** | Network loss; OEM process killer; Doze Mode; WakeLock not held | `[Socket] disconnect DISCONNECTED` | TC-006, TC-009, TC-014, TC-015, TC-016 |
| **WebRTC** | ICE failure; SRTP keepalive missed (CPU asleep); network change | `connectionstatechange FAILED` | TC-006, TC-009, TC-017, TC-022 |
| **FG Service** | OS kills it (battery opt. not exempted); `stopWithTask=true` | `CameraForegroundService onDestroy CALLED` unexpectedly | TC-009, TC-014, TC-020, TC-021 |
| **WakeLock** | Not acquired; 4-hour cap expires; FGS killed | `WAKELOCK_ACQUIRED` missing at startup; 4h cap for long sessions | TC-001, TC-009, TC-015 |
| **FGSN** | FGS killed; `stopForeground(true)` called at wrong time | FGSN disappears from status bar | TC-009, TC-014, TC-020 |
| **Battery Opt.** | User dismisses dialog; OEM overrides exemption | `isBatteryOptimizationIgnored RESULT ignored=false` | TC-001, TC-009, TC-014 |
| **PiP** | `resizeableActivity=false`; OS API < 26; no `onUserLeaveHint` | `PIP_ENTER_FAILED` | TC-005, TC-006, TC-007 |
| **Activity Lifecycle** | Activity rotation recreation; OS pausing activity; system dialogs | `onDestroy` without expected `onCreate` recovery | TC-011, TC-012 |

---

## Matrix: Scenario × ICE Candidate Type Expected

For network-related tests, this helps verify the correct ICE path is selected.

| TC | Scenario | Expected ICE type | Reason |
|----|----------|-------------------|--------|
| TC-002 | Local network | `srflx` or `host` | Direct or STUN |
| TC-005 | Same network (PiP) | Same as TC-002 | Network unchanged |
| TC-006 | Same network (WhatsApp) | Same as TC-002 | Network unchanged |
| TC-009 | Same network (locked) | Same as TC-002 | Network unchanged |
| TC-017 | Wi-Fi → mobile data | `relay` | Different NAT, TURN needed |
| TC-019 | Network restored | `relay` or `srflx` | Depends on topology |
| TC-022 | Admin browser refresh | `relay` or `srflx` | Renegotiation, may change |

**Command to check ICE types in log:**
```bash
grep "LOCAL_CANDIDATE" test_YYYYMMDD.log | grep "Session:xxxxxxxx"
```

---

## Matrix: OEM Behavior Differences

Based on known OEM behaviors, some tests require extra attention on specific devices.

| TC | Scenario | Pixel / Nokia (Stock) | Samsung OneUI | Xiaomi MIUI | OPPO ColorOS |
|----|----------|-----------------------|---------------|-------------|-------------|
| TC-006 | WhatsApp | Low risk | **HIGH RISK** | **HIGH RISK** | **HIGH RISK** |
| TC-009 | Lock screen | Low risk | HIGH RISK | HIGH RISK | HIGH RISK |
| TC-014 | Battery Saver | Low risk | HIGH RISK | HIGH RISK | HIGH RISK |
| TC-015 | Doze Mode | Low risk | MEDIUM risk | HIGH RISK | HIGH RISK |
| TC-020 | Kill Recents | FGSN survives | FGSN may die | FGSN may die | FGSN may die |
| TC-021 | Reboot | BootReceiver works | May need whitelist | May need whitelist | May need whitelist |

**On Samsung/Xiaomi/OPPO:** The battery optimization exemption (TC-001 step 4) is the single most important prerequisite for TC-006, TC-009, TC-014, TC-015 to pass. Without it, the OEM background killer will terminate the foreground service within 5-10 minutes.

---

## Session ID Quick Reference Commands

```bash
# List all sessions observed in a log file
grep "SESSION_STARTED" test_YYYYMMDD.log

# Extract one complete session
grep "Session:6f8d7f40" test_YYYYMMDD.log > session_6f8d7f40.log

# Find all SESSION_FINISHED events with duration
grep "SESSION_FINISHED" test_YYYYMMDD.log

# Find failures within a session
grep "Session:6f8d7f40" test_YYYYMMDD.log | grep -E "FAILED|ERROR|DISCONNECTED|level=80"

# Check if camera was reused between sessions (fast) vs reopened (slow)
grep "acquireStream" test_YYYYMMDD.log | grep -E "REUSED|CALLING_GETUSERMEDIA"

# Check PiP enter results across all sessions
grep "onUserLeaveHint" test_YYYYMMDD.log

# Check WakeLock lifecycle
grep "WAKELOCK" test_YYYYMMDD.log

# Check for OEM memory pressure events
grep "onTrimMemory" test_YYYYMMDD.log
```
