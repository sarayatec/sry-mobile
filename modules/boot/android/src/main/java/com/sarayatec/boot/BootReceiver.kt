package com.sarayatec.boot

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class BootReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action != Intent.ACTION_BOOT_COMPLETED) return
    val launch = context.packageManager
      .getLaunchIntentForPackage(context.packageName) ?: return
    launch.addFlags(
      Intent.FLAG_ACTIVITY_NEW_TASK or
      Intent.FLAG_ACTIVITY_NO_ANIMATION
    )
    launch.putExtra("FROM_BOOT", true)
    context.startActivity(launch)
  }
}
