package com.sarayatec.cameraservice

import android.content.Intent
import android.os.Build
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class CameraServiceModule : Module() {

  companion object {
    // Read by MainActivity.onUserLeaveHint to decide whether to enter PiP
    @JvmStatic var isStreaming: Boolean = false
  }

  override fun definition() = ModuleDefinition {
    Name("CameraService")

    Function("start") {
      isStreaming = true
      val ctx = appContext.reactContext ?: return@Function
      val intent = Intent(ctx, CameraForegroundService::class.java)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        ctx.startForegroundService(intent)
      } else {
        ctx.startService(intent)
      }
    }

    Function("stop") {
      isStreaming = false
      val ctx = appContext.reactContext ?: return@Function
      ctx.stopService(Intent(ctx, CameraForegroundService::class.java))
    }
  }
}
