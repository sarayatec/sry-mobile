package com.sarayatec.cameraservice

/**
 * Singleton that holds the current streaming session ID and start timestamp.
 *
 * Written by CameraServiceModule.setSessionId() (called from JS webrtc.ts).
 * Read by CameraForegroundService, and by MainActivity lifecycle methods
 * injected via with-pip.js and with-lifecycle-logs.js config plugins.
 *
 * Thread-safety: only the main thread writes via the Expo module bridge;
 * Log.d reads from any thread — a torn read of the String ref is safe
 * because String is immutable in Kotlin/JVM.
 */
object SRYSession {
  /** Full UUID of the current streaming session, or "none" when idle. */
  @Volatile var sessionId: String = "none"

  /** System.currentTimeMillis() when the session started; 0 when idle. */
  @Volatile var startMs: Long = 0L

  /** True while CameraForegroundService holds its PARTIAL_WAKE_LOCK. */
  @Volatile var wakeLockHeld: Boolean = false

  /** Returns elapsed milliseconds since session start, or 0 if not started. */
  fun elapsedMs(): Long = if (startMs > 0L) System.currentTimeMillis() - startMs else 0L

  /** Short 8-char prefix used in log lines. */
  fun short(): String = if (sessionId == "none") "none" else sessionId.take(8)
}
