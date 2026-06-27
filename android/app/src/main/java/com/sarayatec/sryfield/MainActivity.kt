package com.sarayatec.sryfield
import android.util.Rational
import android.app.PictureInPictureParams

import android.os.Build
import android.os.Bundle

import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

import expo.modules.ReactActivityDelegateWrapper

class MainActivity : ReactActivity() {

  // ── Native → Debug Panel bridge ──────────────────────────────────────────
  // Emits the event over RCTDeviceEventEmitter so the JS Debug Panel can
  // display it without needing ADB.  Falls back to logcat-only on any error.
  private fun emitNativeEvent(method: String, extra: String, ts: String) {
    try {
      val ctx = (application as? com.facebook.react.ReactApplication)
        ?.reactNativeHost?.reactInstanceManager?.currentReactContext ?: return
      val params = com.facebook.react.bridge.Arguments.createMap().apply {
        putString("ts", ts)
        putString("src", "MainActivity")
        putString("method", method)
        putString("extra", extra)
      }
      ctx.getJSModule(
        com.facebook.react.modules.core.DeviceEventManagerModule.RCTDeviceEventEmitter::class.java
      )?.emit("SRYNativeEvent", params)
    } catch (_: Exception) {}
  }

  // SRY_LIFECYCLE_LOGS — logcat (tag: SRYLifecycle) + in-app Debug Panel
  private fun sryLifecycleLog(method: String, extra: String = "") {
    val ts  = java.text.SimpleDateFormat("HH:mm:ss.SSS", java.util.Locale.US).format(java.util.Date())
    val t   = Thread.currentThread().name
    val sid = try { com.sarayatec.cameraservice.SRYSession.short() } catch (e: Exception) { "none" }
    android.util.Log.d("SRYLifecycle", "[$ts] [$t] [Session:$sid] [MainActivity] [$method] CALLED $extra")
    emitNativeEvent(method, extra, ts)
  }
  override fun onStart() {
    super.onStart()
    sryLifecycleLog("onStart")
  }

  override fun onResume() {
    super.onResume()
    sryLifecycleLog("onResume")
  }

  override fun onDestroy() {
    sryLifecycleLog("onDestroy")
    super.onDestroy()
  }

  override fun onNewIntent(intent: android.content.Intent?) {
    super.onNewIntent(intent)
    sryLifecycleLog("onNewIntent", "action=${intent?.action} extras=${intent?.extras}")
  }

  override fun onTrimMemory(level: Int) {
    super.onTrimMemory(level)
    // level 80 = TRIM_MEMORY_COMPLETE (process about to be killed)
    // level 60 = TRIM_MEMORY_MODERATE
    // level 40 = TRIM_MEMORY_BACKGROUND
    sryLifecycleLog("onTrimMemory", "level=$level")
  }
  override fun onCreate(savedInstanceState: Bundle?) {
    // Set the theme to AppTheme BEFORE onCreate to support
    // coloring the background, status bar, and navigation bar.
    // This is required for expo-splash-screen.
    setTheme(R.style.AppTheme);
    super.onCreate(null)
  }

  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  override fun getMainComponentName(): String = "main"

  /**
   * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
   * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate {
    return ReactActivityDelegateWrapper(
          this,
          BuildConfig.IS_NEW_ARCHITECTURE_ENABLED,
          object : DefaultReactActivityDelegate(
              this,
              mainComponentName,
              fabricEnabled
          ){})
  }

  /**
    * Align the back button behavior with Android S
    * where moving root activities to background instead of finishing activities.
    * @see <a href="https://developer.android.com/reference/android/app/Activity#onBackPressed()">onBackPressed</a>
    */
  override fun invokeDefaultOnBackPressed() {
      if (Build.VERSION.SDK_INT <= Build.VERSION_CODES.R) {
          if (!moveTaskToBack(false)) {
              // For non-root activities, use the default implementation to finish them.
              super.invokeDefaultOnBackPressed()
          }
          return
      }

      // Use the default back button implementation on Android S
      // because it's doing more than [Activity.moveTaskToBack] in fact.
      super.invokeDefaultOnBackPressed()
  }

  override fun onUserLeaveHint() {
    super.onUserLeaveHint()
    if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
      val prefs = getSharedPreferences("sry_streaming", android.content.Context.MODE_PRIVATE)
      val cameraActive = prefs.getBoolean("camera_active", false)
      sryLifecycleLog("onUserLeaveHint", "camera_active=$cameraActive sdk=${android.os.Build.VERSION.SDK_INT}")
      if (cameraActive) {
        try {
          val params = PictureInPictureParams.Builder()
            .setAspectRatio(Rational(16, 9))
            .build()
          enterPictureInPictureMode(params)
          sryLifecycleLog("onUserLeaveHint", "PIP_ENTER_CALLED camera_active=$cameraActive")
        } catch (e: Exception) {
          sryLifecycleLog("onUserLeaveHint", "PIP_ENTER_FAILED err=${e.message}")
        }
      } else {
        sryLifecycleLog("onUserLeaveHint", "PIP_SKIPPED camera_active=false")
      }
    } else {
      sryLifecycleLog("onUserLeaveHint", "PIP_SKIPPED sdk<O sdk=${android.os.Build.VERSION.SDK_INT}")
    }
  }

  override fun onPictureInPictureModeChanged(
    isInPictureInPictureMode: Boolean,
    newConfig: android.content.res.Configuration
  ) {
    super.onPictureInPictureModeChanged(isInPictureInPictureMode, newConfig)
    val prefs = getSharedPreferences("sry_streaming", android.content.Context.MODE_PRIVATE)
    val cameraActive = prefs.getBoolean("camera_active", false)
    sryLifecycleLog("onPictureInPictureModeChanged",
      "inPiP=$isInPictureInPictureMode camera_active=$cameraActive")
  }

  override fun onPause() {
    super.onPause()
    val prefs = getSharedPreferences("sry_streaming", android.content.Context.MODE_PRIVATE)
    val cameraActive = prefs.getBoolean("camera_active", false)
    val inPiP = if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.N) {
      isInPictureInPictureMode
    } else false
    sryLifecycleLog("onPause", "camera_active=$cameraActive inPiP=$inPiP")
  }

  override fun onStop() {
    super.onStop()
    val prefs = getSharedPreferences("sry_streaming", android.content.Context.MODE_PRIVATE)
    val cameraActive = prefs.getBoolean("camera_active", false)
    sryLifecycleLog("onStop", "camera_active=$cameraActive — STREAM_MAY_FREEZE_HERE")
  }
}
