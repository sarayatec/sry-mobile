# SRY Field — Test Result Record

**Test Session ID:** TR-___
**Date:** _______________
**Tester:** _______________
**APK Build:** commit `adfe12c`
**Log file:** `test_YYYYMMDD_HHMMSS.log`

---

## Device Under Test

| Field | Device 1 | Device 2 |
|-------|----------|----------|
| Model | | |
| Android version | | |
| OEM / Skin | | |
| RAM | | |
| Battery optimiz. exempted | | |
| Network | | |

---

## Environment

| Item | Value |
|------|-------|
| Signal server | `https://sry.sarayatec.com` |
| TURN server | `152.42.210.72:3478` / `:5349` |
| Admin browser | Chrome ___ |
| Wi-Fi network | |
| Mobile data carrier | |

---

## Test Results

### P0 — Critical (Must All Pass)

| TC | Title | Session ID | Duration (sec) | Result | Bug ID |
|----|-------|-----------|----------------|--------|--------|
| TC-001 | Login | — | — | | |
| TC-002 | Start stream | | — | | |
| TC-006 | Open WhatsApp | | 30 | | |
| TC-009 | Lock screen | | 60 | | |
| TC-022 | Admin reconnects | | — | | |

**P0 Outcome:** ☐ ALL PASS  ☐ ONE OR MORE FAIL

---

### P1 — High Priority

| TC | Title | Session ID | Duration (sec) | Result | Bug ID |
|----|-------|-----------|----------------|--------|--------|
| TC-005 | Press Home / PiP | | 30 | | |
| TC-007 | Open YouTube | | 60 | | |
| TC-010 | Unlock screen | | — | | |
| TC-019 | Reconnect network | | — | | |
| TC-026 | Logout | | — | | |

**P1 Outcome:** ___ / 5 passed

---

### P2 — Standard

| TC | Title | Session ID | Result | Bug ID |
|----|-------|-----------|--------|--------|
| TC-003 | Stop stream | | | |
| TC-004 | Reconnect after stop | | | |
| TC-012 | Incoming phone call | | | |
| TC-017 | Wi-Fi → mobile data | | | |
| TC-027 | Login again | | | |

**P2 Outcome:** ___ / 5 passed

---

### P3 — Edge Cases

| TC | Title | Session ID | Result | Bug ID |
|----|-------|-----------|--------|--------|
| TC-011 | Rotate device | | | |
| TC-013 | Incoming notification | | | |
| TC-014 | Battery Saver | | | |
| TC-015 | Doze Mode | | | |
| TC-020 | Kill from Recents | | | |
| TC-021 | Reboot | | | |
| TC-024 | Multiple stream requests | | | |
| TC-025 | Camera flip | | | |

**P3 Outcome:** ___ / 8 passed

---

### P4 — Document Outcome

| TC | Title | Result | Observations |
|----|-------|--------|-------------|
| TC-008 | Google Maps | | |
| TC-016 | Disable Wi-Fi | | |
| TC-018 | Disable network | | |
| TC-023 | Admin closes browser | | |

---

## Session ID Map

Record the Session IDs observed during this test run for cross-referencing with logs.

| TC | Session ID (full UUID) | Notes |
|----|----------------------|-------|
| TC-002 | | First stream |
| TC-004 | | After stop + restart |
| TC-006 | | During WhatsApp test |
| TC-009 | | During lock screen test |
| TC-022 | old: | Before admin refresh |
| TC-022 | new: | After admin refresh |
| TC-026 | | Session at logout |
| TC-027 | | Session after re-login |

---

## Key Metric Summary

| Metric | Observed Value | Target |
|--------|---------------|--------|
| Time from offer to video (TC-002) | ___ sec | < 5 sec |
| Time for camera reuse (TC-004, TC-022) | ___ sec | < 2 sec |
| Socket reconnect time (TC-019) | ___ sec | < 30 sec |
| Stream survival during WhatsApp (TC-006) | ___ sec continuous | ≥ 30 sec |
| Stream survival during screen lock (TC-009) | ___ sec continuous | ≥ 60 sec |

---

## PiP Behavior Observed

| Situation | PiP appeared? | Admin stream froze? | Notes |
|-----------|-------------|---------------------|-------|
| Home button (TC-005) | Y / N | Y / N | |
| Switching to WhatsApp (TC-006) | Y / N | Y / N | |
| Switching to YouTube (TC-007) | Y / N | Y / N | |
| Lock screen (TC-009) | Y / N | Y / N | |
| Incoming call (TC-012) | Y / N | Y / N | |

---

## Known Issues Observed

| Known Issue | Observed? | Notes |
|-------------|----------|-------|
| KI-001: Audio silent after camera flip | Y / N | |
| KI-002: Location not stopped on logout | Y / N | |
| KI-003: `with-pip-activity.js` never executes | Y / N | |

---

## New Bugs Found

| Bug ID | TC | Severity | Title | Log file |
|--------|-----|----------|-------|---------|
| BUG-001 | | | | |
| BUG-002 | | | | |

---

## Log Analysis Notes

### Unexpected log patterns observed:

```
(paste any unexpected log lines here)
```

### Session with shortest duration (possible failure):

```
grep "SESSION_FINISHED" test_YYYYMMDD.log
```
Result:
```
(paste)
```

### Any `onTrimMemory level=80` observed:

```
grep "onTrimMemory.*level=80" test_YYYYMMDD.log
```
Result: YES / NO — if YES, paste:
```
(paste)
```

---

## Overall Verdict

| Criterion | Met? |
|-----------|------|
| All P0 tests pass | Y / N |
| ≥ 4/6 P1 tests pass | Y / N |
| No new P0/P1 bugs found | Y / N |
| Stream survives WhatsApp for 30s (TC-006) | Y / N |
| Stream survives 60s screen lock (TC-009) | Y / N |

**FINAL RESULT:**

☐ **PASS** — Build is ready for production deployment

☐ **CONDITIONAL PASS** — Minor issues found, document and ship with known issues

☐ **FAIL** — One or more P0 tests failed. Do not ship. File bug reports and rebuild.

**Tester comments:**

_______________________________________________
_______________________________________________
_______________________________________________

**Approved by:** _______________ **Date:** _______________
