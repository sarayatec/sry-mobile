# SRY Field — Bug Report

---

## Header

| Field | Value |
|-------|-------|
| **Bug ID** | BUG-___ |
| **Date** | |
| **Reporter** | |
| **Severity** | Critical / High / Medium / Low |
| **Priority** | P0 / P1 / P2 / P3 |
| **Status** | New / In Progress / Fixed / Closed / Won't Fix |
| **Related Test Case** | TC-___ |
| **APK Build** | commit `adfe12c` |

---

## Device Information

| Field | Value |
|-------|-------|
| Device model | |
| Android version | |
| OEM skin (e.g. OneUI 6.1) | |
| Battery optimization exempted? | Yes / No |
| Network type at time of bug | Wi-Fi / Mobile Data / None |
| Battery level | % |
| Charging? | Yes / No |

---

## Title

> One sentence describing the failure.
> Example: *"Stream stops after 10 seconds when opening WhatsApp on Samsung Galaxy A54 (Android 14)"*

---

## Description

> Describe what happened. Be specific about the observable failure:
> - What was the admin seeing on the browser before/during/after?
> - What was the device state?
> - Was the FGSN visible?
> - Did the stream freeze or go black?
> - Did it recover or stay dead?

---

## Steps to Reproduce

1. Login as employee
2. ...
3. ...

**Reproducibility:** Always / Sometimes (___%) / Rarely / Could not reproduce again

---

## Expected Result

> What SHOULD have happened according to the test plan.

---

## Actual Result

> What actually happened.

---

## Session ID

```
Session ID from logs: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
```

Used to extract the full session log:
```bash
grep "Session:xxxxxxxx" test_YYYYMMDD.log > bug_NNN_session.log
```

---

## Log Excerpt

Paste the relevant portion of the log here. Include at minimum:
- 5 lines before the failure
- The failure event itself
- 10 lines after the failure

```
[HH:MM:SS.mmm] [js-main] [Session:xxxxxxxx] [Component] [Method] STATE | key=val
...
[HH:MM:SS.mmm] [js-main] [Session:xxxxxxxx] [Component] [Method] FAILURE_STATE | err=...
...
```

**Log file:** `test_YYYYMMDD.log` (attach full file if possible)

---

## Key Log Signals Observed

Check all that apply:

**Failure indicators:**
- [ ] `[WebRTC] [connectionstatechange] FAILED`
- [ ] `[WebRTC] [connectionstatechange] CLOSED`
- [ ] `[Socket] [disconnect] DISCONNECTED`
- [ ] `[Camera] [getUserMedia] ERROR`
- [ ] `[Camera] [releaseStream] CALLED` (unexpected)
- [ ] `[Session] SESSION_FINISHED` (unexpected timing)
- [ ] `[SRYLifecycle] [onTrimMemory] level=80`
- [ ] `[onUserLeaveHint] PIP_ENTER_FAILED`
- [ ] `[CameraForegroundService] [onDestroy] CALLED` (unexpected)
- [ ] JavaScript exception / red screen crash

**Recovery indicators (if partial failure):**
- [ ] `[Socket] [reconnect] SUCCESS`
- [ ] `[Camera] [acquireStream] REUSED`
- [ ] `[Camera] [acquireStream] CALLING_GETUSERMEDIA` (slow recovery)
- [ ] `[WebRTC] [connectionstatechange] CONNECTED` (recovery)
- [ ] `[Session] SESSION_STARTED` (new session after failure)

---

## Timeline

| Time | Event |
|------|-------|
| HH:MM:SS | Stream started |
| HH:MM:SS | Trigger action (e.g. opened WhatsApp) |
| HH:MM:SS | Failure observed |
| HH:MM:SS | Recovery (if any) |

---

## Component Analysis

Fill in based on log evidence:

| Component | State at failure | Evidence |
|-----------|-----------------|----------|
| Camera | alive / dead / unknown | log line: |
| Microphone | alive / dead / unknown | log line: |
| GPS | tracking / stopped / unknown | log line: |
| Socket.IO | connected / disconnected / reconnecting | log line: |
| WebRTC | connected / failed / closed | log line: |
| Foreground Service | running / killed | FGSN visible: Y/N |
| WakeLock | held / released | log line: |
| PiP | entered / failed / not attempted | log line: |
| Activity | resumed / paused / stopped / destroyed | log line: |
| Battery Optimization | exempted / not exempted | |

---

## Root Cause Hypothesis

> Based on the log evidence, what do you think caused the failure?
> Reference specific log lines and compare to the expected sequences in `TEST_PLAN.md`.

---

## Workaround

> Is there a manual workaround the employee can use right now?
> Example: "Press the eye-off button to activate black screen mode before switching apps"

---

## Attachments

- [ ] Full log file (`test_YYYYMMDD.log`)
- [ ] Session-filtered log (`bug_NNN_session.log`)
- [ ] Screenshot of admin browser at time of failure
- [ ] Screen recording of device
- [ ] `adb bugreport` zip (for critical bugs)

---

## Fix Verification

| Field | Value |
|-------|-------|
| Fixed in commit | |
| Fix description | |
| Verified by | |
| Verification date | |
| Test case re-run result | Pass / Fail |
