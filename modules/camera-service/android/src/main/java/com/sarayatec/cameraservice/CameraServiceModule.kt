package com.sarayatec.cameraservice

import android.content.Context
import android.content.Intent
import android.os.Build
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

private const val PREFS = "sry_streaming"
private const val KEY   = "camera_active"

class CameraServiceModule : Module() {

  override fun definition() = ModuleDefinition {
    Name("CameraService")

    Function("start") {
      val ctx = appContext.reactContext ?: return@Function
      // Persist flag — read by MainActivity.onUserLeaveHint to enter PiP
      ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        .edit().putBoolean(KEY, true).apply()
      val intent = Intent(ctx, CameraForegroundService::class.java)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        ctx.startForegroundService(intent)
      } else {
        ctx.startService(intent)
      }
    }

    Function("stop") {
      val ctx = appContext.reactContext ?: return@Function
      ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        .edit().putBoolean(KEY, false).apply()
      ctx.stopService(Intent(ctx, CameraForegroundService::class.java))
    }
  }
}
