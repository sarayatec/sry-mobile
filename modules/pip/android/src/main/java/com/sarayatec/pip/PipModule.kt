package com.sarayatec.pip

import android.app.PictureInPictureParams
import android.os.Build
import android.util.Rational
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class PipModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("Pip")

    // Enter PiP manually (called from JS when app goes to background)
    Function("enter") {
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return@Function
      val activity = appContext.currentActivity ?: return@Function
      activity.runOnUiThread {
        try {
          val builder = PictureInPictureParams.Builder()
            .setAspectRatio(Rational(16, 9))

          // Android 12+: auto-enter PiP when home is pressed (no JS needed)
          if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            builder.setAutoEnterEnabled(true)
          }

          activity.enterPictureInPictureMode(builder.build())
        } catch (_: Exception) {}
      }
    }

    // Enable/disable auto-enter (Android 12+) — call with true when streaming starts
    Function("setAutoEnter") { enabled: Boolean ->
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return@Function
      val activity = appContext.currentActivity ?: return@Function
      activity.runOnUiThread {
        try {
          val params = PictureInPictureParams.Builder()
            .setAspectRatio(Rational(16, 9))
            .setAutoEnterEnabled(enabled)
            .build()
          activity.setPictureInPictureParams(params)
        } catch (_: Exception) {}
      }
    }

    // Returns true if PiP is supported and permission is granted
    Function("isSupported") {
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return@Function false
      val activity = appContext.currentActivity ?: return@Function false
      return@Function activity.packageManager
        .hasSystemFeature(android.content.pm.PackageManager.FEATURE_PICTURE_IN_PICTURE)
    }
  }
}
