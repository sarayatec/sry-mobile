package com.sarayatec.boot

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class BootModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("BootModule")

    // Returns true if the app was launched by BootReceiver (phone just booted)
    Function("isBootLaunch") {
      val activity = appContext.currentActivity ?: return@Function false
      activity.intent?.getBooleanExtra("FROM_BOOT", false) ?: false
    }

    // Immediately send app to background — used on boot launch so UI never shows
    Function("moveToBackground") {
      val activity = appContext.currentActivity ?: return@Function
      activity.runOnUiThread { activity.moveTaskToBack(true) }
    }
  }
}
