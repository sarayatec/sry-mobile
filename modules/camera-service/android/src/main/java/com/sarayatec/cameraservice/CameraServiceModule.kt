package com.sarayatec.cameraservice

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

private const val PREFS = "sry_streaming"
private const val KEY   = "camera_active"

class CameraServiceModule : Module() {

  override fun definition() = ModuleDefinition {
    Name("CameraService")

    fun launchService(ctx: Context) {
      val intent = Intent(ctx, CameraForegroundService::class.java)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        ctx.startForegroundService(intent)
      } else {
        ctx.startService(intent)
      }
    }

    // Start the persistent session foreground service (called on login).
    // Keeps the process + socket alive in the background so Samsung/Xiaomi
    // don't kill the app when another app is opened or the screen turns off.
    Function("startSession") {
      val ctx = appContext.reactContext ?: return@Function
      launchService(ctx)
    }

    // Stop the session service entirely (called on logout).
    Function("stopSession") {
      val ctx = appContext.reactContext ?: return@Function
      ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        .edit().putBoolean(KEY, false).apply()
      ctx.stopService(Intent(ctx, CameraForegroundService::class.java))
    }

    // Toggle the streaming flag (read by MainActivity.onUserLeaveHint for PiP).
    // Does NOT stop the service — the session service must stay alive.
    Function("setStreaming") { active: Boolean ->
      val ctx = appContext.reactContext ?: return@Function
      ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        .edit().putBoolean(KEY, active).apply()
      // Ensure service is running when streaming starts (in case login didn't)
      if (active) launchService(ctx)
    }

    // Back-compat aliases
    Function("start") {
      val ctx = appContext.reactContext ?: return@Function
      ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        .edit().putBoolean(KEY, true).apply()
      launchService(ctx)
    }
    Function("stop") {
      val ctx = appContext.reactContext ?: return@Function
      ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        .edit().putBoolean(KEY, false).apply()
    }

    // Returns true if the app is already exempt from battery optimization.
    Function("isBatteryOptimizationIgnored") {
      val ctx = appContext.reactContext ?: return@Function false
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return@Function true
      val pm = ctx.getSystemService(Context.POWER_SERVICE) as PowerManager
      return@Function pm.isIgnoringBatteryOptimizations(ctx.packageName)
    }

    // Opens the system dialog asking the user to exempt the app from battery
    // optimization. Essential on Samsung/Xiaomi/etc. which otherwise kill the
    // foreground service (and the camera capture) when the screen turns off.
    Function("requestDisableBatteryOptimization") {
      val activity = appContext.currentActivity ?: appContext.reactContext ?: return@Function
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return@Function
      val ctx = appContext.reactContext ?: return@Function
      val pm = ctx.getSystemService(Context.POWER_SERVICE) as PowerManager
      if (pm.isIgnoringBatteryOptimizations(ctx.packageName)) return@Function
      try {
        val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
          data = Uri.parse("package:${ctx.packageName}")
          addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        ctx.startActivity(intent)
      } catch (e: Exception) {
        // Some devices block the direct request — fall back to the settings list
        try {
          val intent = Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
          }
          ctx.startActivity(intent)
        } catch (e2: Exception) {}
      }
    }
  }
}
