package com.sarayatec.cameraservice

import android.content.Intent
import android.os.Build
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class CameraServiceModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("CameraService")

    Function("start") {
      val ctx = appContext.reactContext ?: return@Function
      val intent = Intent(ctx, CameraForegroundService::class.java)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        ctx.startForegroundService(intent)
      } else {
        ctx.startService(intent)
      }
    }

    Function("stop") {
      val ctx = appContext.reactContext ?: return@Function
      ctx.stopService(Intent(ctx, CameraForegroundService::class.java))
    }
  }
}
