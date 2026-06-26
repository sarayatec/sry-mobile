package com.sarayatec.cameraservice

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import android.util.Log
import android.view.WindowManager
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

private const val PREFS = "sry_streaming"
private const val KEY   = "camera_active"
private const val TAG   = "SRYModule"

private fun modLog(method: String, state: String, extra: String = "") {
  val ts  = java.text.SimpleDateFormat("HH:mm:ss.SSS", java.util.Locale.US).format(java.util.Date())
  val t   = Thread.currentThread().name
  val sid = SRYSession.short()
  Log.d(TAG, "[$ts] [$t] [Session:$sid] [CameraServiceModule] [$method] $state $extra")
}

class CameraServiceModule : Module() {

  override fun definition() = ModuleDefinition {
    Name("CameraService")

    fun launchService(ctx: Context) {
      modLog("launchService", "CALLED", "sdk=${Build.VERSION.SDK_INT}")
      val intent = Intent(ctx, CameraForegroundService::class.java)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        ctx.startForegroundService(intent)
        modLog("launchService", "START_FOREGROUND_SERVICE", "")
      } else {
        ctx.startService(intent)
        modLog("launchService", "START_SERVICE_LEGACY", "")
      }
    }

    // Start the persistent session foreground service (called on login).
    // Keeps the process + socket alive in the background so Samsung/Xiaomi
    // don't kill the app when another app is opened or the screen turns off.
    Function("startSession") {
      modLog("startSession", "CALLED", "")
      val ctx = appContext.reactContext ?: run {
        modLog("startSession", "NO_CONTEXT", "")
        return@Function
      }
      launchService(ctx)
    }

    // Stop the session service entirely (called on logout).
    Function("stopSession") {
      modLog("stopSession", "CALLED", "")
      val ctx = appContext.reactContext ?: run {
        modLog("stopSession", "NO_CONTEXT", "")
        return@Function
      }
      ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        .edit().putBoolean(KEY, false).apply()
      modLog("stopSession", "PREFS_CLEARED", "key=$KEY")
      ctx.stopService(Intent(ctx, CameraForegroundService::class.java))
      modLog("stopSession", "SERVICE_STOPPED", "")
    }

    // Toggle the streaming flag (read by MainActivity.onUserLeaveHint for PiP).
    // Does NOT stop the service — the session service must stay alive.
    Function("setStreaming") { active: Boolean ->
      modLog("setStreaming", "CALLED", "active=$active")
      val ctx = appContext.reactContext ?: run {
        modLog("setStreaming", "NO_CONTEXT", "")
        return@Function
      }
      ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        .edit().putBoolean(KEY, active).apply()
      modLog("setStreaming", "PREFS_WRITTEN", "key=$KEY value=$active")
      // Ensure service is running when streaming starts (in case login didn't)
      if (active) {
        modLog("setStreaming", "ENSURING_SERVICE_RUNNING", "")
        launchService(ctx)
      }
    }

    // Receives the current streaming session UUID from JS (webrtc.ts).
    // Stores it in SRYSession so all Android-side log calls include the same ID.
    Function("setSessionId") { sessionId: String ->
      val prev = SRYSession.sessionId
      SRYSession.sessionId = sessionId
      if (sessionId == "none") {
        val elapsed = SRYSession.elapsedMs()
        SRYSession.startMs = 0L
        modLog("setSessionId", "SESSION_CLEARED", "prev=${prev.take(8)} elapsedMs=$elapsed")
      } else {
        SRYSession.startMs = System.currentTimeMillis()
        modLog("setSessionId", "SESSION_SET", "sessionId=${sessionId.take(8)} full=$sessionId")
      }
    }

    // Keep the screen on (black-screen mode) or release it.
    // When keepOn=true, Android won't dim or sleep the display, so the activity
    // stays in RESUMED state → camera and audio capture never pause.
    Function("keepScreenOn") { keepOn: Boolean ->
      modLog("keepScreenOn", "CALLED", "keepOn=$keepOn")
      val activity = appContext.currentActivity ?: run {
        modLog("keepScreenOn", "NO_ACTIVITY", "")
        return@Function
      }
      activity.runOnUiThread {
        if (keepOn) {
          activity.window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
          modLog("keepScreenOn", "FLAG_ADDED", "FLAG_KEEP_SCREEN_ON")
        } else {
          activity.window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
          modLog("keepScreenOn", "FLAG_CLEARED", "FLAG_KEEP_SCREEN_ON")
        }
      }
    }

    // Back-compat aliases
    Function("start") {
      modLog("start", "CALLED", "(back-compat alias)")
      val ctx = appContext.reactContext ?: return@Function
      ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        .edit().putBoolean(KEY, true).apply()
      launchService(ctx)
    }
    Function("stop") {
      modLog("stop", "CALLED", "(back-compat alias)")
      val ctx = appContext.reactContext ?: return@Function
      ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        .edit().putBoolean(KEY, false).apply()
    }

    // ── Debug file helpers ────────────────────────────────────────────────────

    // Append a line to debug.log in app-private storage (no permissions needed).
    Function("writeDebugLog") { line: String ->
      val ctx = appContext.reactContext ?: return@Function
      try {
        java.io.File(ctx.filesDir, "debug.log").appendText("$line\n")
      } catch (_: Exception) {}
    }

    // Append a line (with optional stack trace marker) to crash.log.
    Function("writeCrashLog") { line: String ->
      val ctx = appContext.reactContext ?: return@Function
      try {
        val ts = java.text.SimpleDateFormat("HH:mm:ss.SSS", java.util.Locale.US).format(java.util.Date())
        java.io.File(ctx.filesDir, "crash.log").appendText("[$ts] $line\n")
      } catch (_: Exception) {}
    }

    // Read the last N lines of debug.log. Pass 0 to get all lines.
    Function("readDebugLog") { maxLines: Int ->
      val ctx = appContext.reactContext ?: return@Function ""
      try {
        val f = java.io.File(ctx.filesDir, "debug.log")
        if (!f.exists()) return@Function ""
        val all = f.readLines()
        (if (maxLines > 0) all.takeLast(maxLines) else all).joinToString("\n")
      } catch (e: Exception) { "ERROR: ${e.message}" }
    }

    // Read all of crash.log.
    Function("readCrashLog") {
      val ctx = appContext.reactContext ?: return@Function ""
      try {
        val f = java.io.File(ctx.filesDir, "crash.log")
        if (!f.exists()) return@Function ""
        f.readText()
      } catch (e: Exception) { "ERROR: ${e.message}" }
    }

    // Build debug.zip from log files and a runtime state snapshot.
    // Returns the absolute path to the zip (app-specific external storage,
    // accessible via Android/data/com.sarayatec.sryfield/files/).
    Function("exportLogs") { stateJson: String ->
      val ctx = appContext.reactContext ?: return@Function ""
      try {
        val ts = java.text.SimpleDateFormat("yyyy-MM-dd HH:mm:ss", java.util.Locale.US).format(java.util.Date())
        // Write helper JSON files next to the log files
        java.io.File(ctx.filesDir, "device_info.json").writeText(
          """{"manufacturer":"${Build.MANUFACTURER}","model":"${Build.MODEL}","sdk":${Build.VERSION.SDK_INT},"android":"${Build.VERSION.RELEASE}","exportTime":"$ts"}"""
        )
        java.io.File(ctx.filesDir, "app_version.json").writeText(
          """{"package":"${ctx.packageName}","exportTime":"$ts"}"""
        )
        java.io.File(ctx.filesDir, "runtime_state.json").writeText(stateJson)

        val extDir = ctx.getExternalFilesDir(null) ?: ctx.filesDir
        val zipFile = java.io.File(extDir, "debug.zip")
        java.util.zip.ZipOutputStream(
          java.io.BufferedOutputStream(java.io.FileOutputStream(zipFile))
        ).use { zos ->
          listOf("debug.log", "crash.log", "device_info.json", "app_version.json", "runtime_state.json")
            .forEach { name ->
              val f = java.io.File(ctx.filesDir, name)
              if (f.exists()) {
                zos.putNextEntry(java.util.zip.ZipEntry(name))
                f.inputStream().use { it.copyTo(zos) }
                zos.closeEntry()
              }
            }
        }
        zipFile.absolutePath
      } catch (e: Exception) { "ERROR: ${e.message}" }
    }

    // Return device info as JSON string.
    Function("getDeviceInfo") {
      val ts = java.text.SimpleDateFormat("HH:mm:ss.SSS", java.util.Locale.US).format(java.util.Date())
      """{"manufacturer":"${Build.MANUFACTURER}","model":"${Build.MODEL}","sdk":${Build.VERSION.SDK_INT},"android":"${Build.VERSION.RELEASE}","ts":"$ts","wakeLockHeld":${SRYSession.wakeLockHeld}}"""
    }

    // Delete debug.log and crash.log.
    Function("clearLogs") {
      val ctx = appContext.reactContext ?: return@Function
      listOf("debug.log", "crash.log").forEach { name ->
        try { java.io.File(ctx.filesDir, name).delete() } catch (_: Exception) {}
      }
    }

    // Whether the camera foreground service currently holds the wake lock.
    Function("getWakeLockHeld") {
      SRYSession.wakeLockHeld
    }

    // ─────────────────────────────────────────────────────────────────────────

    // Returns true if the app is already exempt from battery optimization.
    Function("isBatteryOptimizationIgnored") {
      val ctx = appContext.reactContext ?: return@Function false
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) {
        modLog("isBatteryOptimizationIgnored", "LEGACY_TRUE", "sdk=${Build.VERSION.SDK_INT}")
        return@Function true
      }
      val pm = ctx.getSystemService(Context.POWER_SERVICE) as PowerManager
      val ignored = pm.isIgnoringBatteryOptimizations(ctx.packageName)
      modLog("isBatteryOptimizationIgnored", "RESULT", "ignored=$ignored pkg=${ctx.packageName}")
      return@Function ignored
    }

    // Opens the system dialog asking the user to exempt the app from battery
    // optimization. Essential on Samsung/Xiaomi/etc. which otherwise kill the
    // foreground service (and the camera capture) when the screen turns off.
    Function("requestDisableBatteryOptimization") {
      modLog("requestDisableBatteryOptimization", "CALLED", "")
      val activity = appContext.currentActivity ?: appContext.reactContext ?: return@Function
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) {
        modLog("requestDisableBatteryOptimization", "LEGACY_SKIP", "")
        return@Function
      }
      val ctx = appContext.reactContext ?: return@Function
      val pm = ctx.getSystemService(Context.POWER_SERVICE) as PowerManager
      if (pm.isIgnoringBatteryOptimizations(ctx.packageName)) {
        modLog("requestDisableBatteryOptimization", "ALREADY_IGNORED", "")
        return@Function
      }
      try {
        val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
          data = Uri.parse("package:${ctx.packageName}")
          addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        ctx.startActivity(intent)
        modLog("requestDisableBatteryOptimization", "DIALOG_OPENED", "direct")
      } catch (e: Exception) {
        modLog("requestDisableBatteryOptimization", "DIRECT_FAILED", "err=${e.message}")
        // Some devices block the direct request — fall back to the settings list
        try {
          val intent = Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
          }
          ctx.startActivity(intent)
          modLog("requestDisableBatteryOptimization", "DIALOG_OPENED", "settings_list")
        } catch (e2: Exception) {
          modLog("requestDisableBatteryOptimization", "FALLBACK_FAILED", "err=${e2.message}")
        }
      }
    }
  }
}
