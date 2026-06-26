package com.sarayatec.cameraservice

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Intent
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import android.util.Log
import androidx.core.app.NotificationCompat

class CameraForegroundService : Service() {

  companion object {
    const val CHANNEL_ID = "sry_camera_stream"
    const val NOTIF_ID   = 9901
    private const val TAG = "SRYService"

    private fun srvLog(method: String, state: String, extra: String = "") {
      val ts = java.text.SimpleDateFormat("HH:mm:ss.SSS", java.util.Locale.US).format(java.util.Date())
      val t  = Thread.currentThread().name
      Log.d(TAG, "[$ts] [$t] [CameraForegroundService] [$method] $state $extra")
    }
  }

  private var wakeLock: PowerManager.WakeLock? = null

  override fun onCreate() {
    super.onCreate()
    srvLog("onCreate", "CALLED")
    createChannel()
    srvLog("onCreate", "CHANNEL_CREATED")
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    srvLog("onStartCommand", "CALLED", "startId=$startId flags=$flags")

    val notif = NotificationCompat.Builder(this, CHANNEL_ID)
      .setContentTitle("SRY Field")
      .setContentText("جلسة عمل نشطة")
      .setSmallIcon(android.R.drawable.ic_menu_camera)
      .setOngoing(true)
      .build()

    // Include DATA_SYNC so Android 14 allows the service to run for the whole
    // session (camera/mic types alone can be restricted when not actively used).
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      var type = android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_CAMERA or
        android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE
      if (Build.VERSION.SDK_INT >= 30) {
        type = type or android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC
      }
      srvLog("onStartCommand", "START_FOREGROUND_TYPED", "sdk=${Build.VERSION.SDK_INT} type=$type")
      try {
        startForeground(NOTIF_ID, notif, type)
        srvLog("onStartCommand", "FOREGROUND_STARTED", "type=CAMERA|MIC|DATA_SYNC")
      } catch (e: Exception) {
        // Camera permission may be missing before streaming — fall back to dataSync only
        srvLog("onStartCommand", "FOREGROUND_FALLBACK", "err=${e.message}")
        startForeground(NOTIF_ID, notif,
          android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC)
        srvLog("onStartCommand", "FOREGROUND_STARTED", "type=DATA_SYNC_ONLY")
      }
    } else {
      srvLog("onStartCommand", "START_FOREGROUND_LEGACY", "sdk=${Build.VERSION.SDK_INT}")
      startForeground(NOTIF_ID, notif)
      srvLog("onStartCommand", "FOREGROUND_STARTED", "type=LEGACY")
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
      srvLog("onStartCommand", "WAKELOCK_ACQUIRED", "tag=SRYField::CameraStreamLock capMs=${4*60*60*1000L}")
    } else {
      srvLog("onStartCommand", "WAKELOCK_ALREADY_HELD", "isHeld=${wakeLock?.isHeld}")
    }

    srvLog("onStartCommand", "RETURNING_START_STICKY", "")
    return START_STICKY
  }

  override fun onDestroy() {
    srvLog("onDestroy", "CALLED", "wakeLockHeld=${wakeLock?.isHeld}")
    wakeLock?.let {
      if (it.isHeld) {
        it.release()
        srvLog("onDestroy", "WAKELOCK_RELEASED", "")
      } else {
        srvLog("onDestroy", "WAKELOCK_NOT_HELD", "")
      }
    }
    wakeLock = null
    stopForeground(true)
    srvLog("onDestroy", "FOREGROUND_STOPPED", "")
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
