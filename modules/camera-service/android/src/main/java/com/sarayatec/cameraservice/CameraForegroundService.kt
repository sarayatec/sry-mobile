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
import com.facebook.react.ReactApplication
import com.facebook.react.bridge.Arguments
import com.facebook.react.modules.core.DeviceEventManagerModule

class CameraForegroundService : Service() {

  companion object {
    const val CHANNEL_ID = "sry_camera_stream"
    const val NOTIF_ID   = 9901
    private const val TAG = "SRYService"

    private fun srvLog(method: String, state: String, extra: String = "") {
      val ts  = java.text.SimpleDateFormat("HH:mm:ss.SSS", java.util.Locale.US).format(java.util.Date())
      val t   = Thread.currentThread().name
      val sid = SRYSession.short()
      Log.d(TAG, "[$ts] [$t] [Session:$sid] [CameraForegroundService] [$method] $state $extra")
    }
  }

  // Mirror to in-app Debug Panel via RCTDeviceEventEmitter.
  // Wrapped in try/catch — ReactContext may be null if bridge is tearing down.
  private fun emitNativeEvent(method: String, state: String, extra: String = "") {
    try {
      val ts = java.text.SimpleDateFormat("HH:mm:ss.SSS", java.util.Locale.US).format(java.util.Date())
      val ctx = (application as? ReactApplication)
        ?.reactNativeHost?.reactInstanceManager?.currentReactContext ?: return
      val params = Arguments.createMap().apply {
        putString("ts", ts)
        putString("src", "CameraFGS")
        putString("method", method)
        putString("extra", "$state $extra".trim())
      }
      ctx.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
        ?.emit("SRYNativeEvent", params)
    } catch (_: Exception) {}
  }

  private var wakeLock: PowerManager.WakeLock? = null

  override fun onCreate() {
    super.onCreate()
    srvLog("onCreate", "CALLED")
    emitNativeEvent("onCreate", "CALLED")
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
        srvLog("onStartCommand", "FOREGROUND_FALLBACK", "err=${e.message}")
        // Diagnostic: record first failure BEFORE attempting fallback call
        try {
          val ts = java.text.SimpleDateFormat("HH:mm:ss.SSS", java.util.Locale.US).format(java.util.Date())
          java.io.File(filesDir, "crash.log").appendText(
            "[$ts] FGS startForeground FAILED type=CAMERA|MIC|DATA_SYNC sdk=${Build.VERSION.SDK_INT} err=${e.message}\n${e.stackTraceToString()}\n---\n"
          )
        } catch (_: Exception) {}
        // Fallback — also throws on Android 14 with targetSdkVersion=34 (DATA_SYNC banned)
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
      SRYSession.wakeLockHeld = true
      srvLog("onStartCommand", "WAKELOCK_ACQUIRED",
        "tag=SRYField::CameraStreamLock capMs=${4*60*60*1000L} sessionId=${SRYSession.sessionId}")
    } else {
      srvLog("onStartCommand", "WAKELOCK_ALREADY_HELD", "isHeld=${wakeLock?.isHeld}")
    }

    srvLog("onStartCommand", "RETURNING_START_STICKY", "")
    emitNativeEvent("onStartCommand", "STARTED", "startId=$startId wakeLockHeld=${wakeLock?.isHeld}")
    return START_STICKY
  }

  override fun onDestroy() {
    srvLog("onDestroy", "CALLED",
      "wakeLockHeld=${wakeLock?.isHeld} sessionId=${SRYSession.sessionId} elapsedMs=${SRYSession.elapsedMs()}")
    wakeLock?.let {
      if (it.isHeld) {
        it.release()
        SRYSession.wakeLockHeld = false
        srvLog("onDestroy", "WAKELOCK_RELEASED", "")
      } else {
        srvLog("onDestroy", "WAKELOCK_NOT_HELD", "")
      }
    }
    wakeLock = null
    stopForeground(true)
    srvLog("onDestroy", "FOREGROUND_STOPPED", "")
    emitNativeEvent("onDestroy", "STOPPED", "sessionId=${SRYSession.sessionId.take(8)}")
    super.onDestroy()
  }

  override fun onTaskRemoved(rootIntent: Intent?) {
    val extra = "rootIntent=${rootIntent?.action} wakeLockHeld=${wakeLock?.isHeld} sessionId=${SRYSession.sessionId}"
    srvLog("onTaskRemoved", "CALLED", extra)
    emitNativeEvent("onTaskRemoved", "CALLED", extra)
    super.onTaskRemoved(rootIntent)
  }

  override fun onLowMemory() {
    val extra = "wakeLockHeld=${wakeLock?.isHeld} sessionId=${SRYSession.sessionId}"
    srvLog("onLowMemory", "CALLED", extra)
    emitNativeEvent("onLowMemory", "CALLED", extra)
    super.onLowMemory()
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
