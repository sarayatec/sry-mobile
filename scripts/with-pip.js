const { withMainActivity } = require('@expo/config-plugins');

// Injects two lifecycle overrides into MainActivity:
//
// 1. onUserLeaveHint()  — fires when Home is pressed; enters PiP so camera
//    stays alive (Android 8+).
//
// 2. onPictureInPictureModeChanged() — fires when PiP window is dismissed
//    (user expands back); brings the activity to foreground so the JS layer
//    receives 'active' AppState and hides the sticky notification.
//
// Both use fully-qualified class names to avoid touching import blocks.

const withPiP = (config) => {
  return withMainActivity(config, (config) => {
    let src = config.modResults.contents;

    // Already patched — skip
    if (src.includes('onUserLeaveHint')) return config;

    const classIdx = src.indexOf('class MainActivity');
    if (classIdx === -1) return config;
    const braceIdx = src.indexOf('{', classIdx);
    if (braceIdx === -1) return config;

    const methods = `

  // Enter PiP when the user presses Home while streaming (Android 8+)
  override fun onUserLeaveHint() {
    super.onUserLeaveHint()
    val _ts = java.text.SimpleDateFormat("HH:mm:ss.SSS", java.util.Locale.US).format(java.util.Date())
    android.util.Log.d("SRYLifecycle", "[$_ts] [${Thread.currentThread().name}] [MainActivity] [onUserLeaveHint] CALLED")
    if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
      try {
        enterPictureInPictureMode(
          android.app.PictureInPictureParams.Builder()
            .setAspectRatio(android.util.Rational(16, 9))
            .build()
        )
        android.util.Log.d("SRYLifecycle", "[$_ts] [${Thread.currentThread().name}] [MainActivity] [onUserLeaveHint] PIP_ENTER_SUCCESS")
      } catch (e: Exception) {
        android.util.Log.d("SRYLifecycle", "[$_ts] [${Thread.currentThread().name}] [MainActivity] [onUserLeaveHint] PIP_ENTER_FAILED err=\${e.message}")
      }
    } else {
      android.util.Log.d("SRYLifecycle", "[$_ts] [${Thread.currentThread().name}] [MainActivity] [onUserLeaveHint] PIP_SKIPPED_OLD_API sdk=\${android.os.Build.VERSION.SDK_INT}")
    }
  }

  // When PiP is dismissed (user taps expand), bring app back to foreground
  override fun onPictureInPictureModeChanged(
    isInPictureInPictureMode: Boolean,
    newConfig: android.content.res.Configuration
  ) {
    super.onPictureInPictureModeChanged(isInPictureInPictureMode, newConfig)
    val _ts2 = java.text.SimpleDateFormat("HH:mm:ss.SSS", java.util.Locale.US).format(java.util.Date())
    android.util.Log.d("SRYLifecycle", "[$_ts2] [${Thread.currentThread().name}] [MainActivity] [onPictureInPictureModeChanged] CALLED isInPiP=\$isInPictureInPictureMode")
    if (!isInPictureInPictureMode) {
      // Bring activity to front so React Native receives AppState 'active'
      val intent = android.content.Intent(this, this::class.java).apply {
        flags = android.content.Intent.FLAG_ACTIVITY_REORDER_TO_FRONT
      }
      startActivity(intent)
      android.util.Log.d("SRYLifecycle", "[$_ts2] [${Thread.currentThread().name}] [MainActivity] [onPictureInPictureModeChanged] REORDER_TO_FRONT")
    }
  }`;

    src = src.substring(0, braceIdx + 1) + methods + src.substring(braceIdx + 1);
    config.modResults.contents = src;
    return config;
  });
};

module.exports = withPiP;
