package com.sarayatec.cameraservice

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Intent
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import androidx.core.app.NotificationCompat

class CameraForegroundService : Service() {

  companion object {
    const val CHANNEL_ID = "sry_camera_stream"
    const val NOTIF_ID   = 9901
  }

  private var wakeLock: PowerManager.WakeLock? = null

  override fun onCreate() {
    super.onCreate()
    createChannel()
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    val notif = NotificationCompat.Builder(this, CHANNEL_ID)
      .setContentTitle("SRY Field")
      .setContentText("جلسة البث نشطة")
      .setSmallIcon(android.R.drawable.ic_menu_camera)
      .setOngoing(true)
      .build()

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      startForeground(NOTIF_ID, notif,
        android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_CAMERA or
        android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE)
    } else {
      startForeground(NOTIF_ID, notif)
    }

    // PARTIAL_WAKE_LOCK keeps the CPU running when screen is off so the
    // camera capture pipeline (react-native-webrtc) keeps producing frames.
    if (wakeLock == null) {
      val pm = getSystemService(POWER_SERVICE) as PowerManager
      wakeLock = pm.newWakeLock(
        PowerManager.PARTIAL_WAKE_LOCK,
        "SRYField::CameraStreamLock"
      ).apply {
        // 4-hour safety cap — service is stopped explicitly when streaming ends
        acquire(4 * 60 * 60 * 1000L)
      }
    }

    return START_STICKY
  }

  override fun onDestroy() {
    wakeLock?.let { if (it.isHeld) it.release() }
    wakeLock = null
    stopForeground(true)
    super.onDestroy()
  }

  override fun onBind(intent: Intent?): IBinder? = null

  private fun createChannel() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val ch = NotificationChannel(
        CHANNEL_ID, "بث الكاميرا",
        NotificationManager.IMPORTANCE_LOW
      ).apply { description = "إشعار بث الكاميرا للمشرف" }
      getSystemService(NotificationManager::class.java)?.createNotificationChannel(ch)
    }
  }
}
