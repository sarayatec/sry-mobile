const { withMainActivity } = require('@expo/config-plugins');

// Patches MainActivity to enter PiP mode in onUserLeaveHint (fires when user
// presses Home or switches apps — BEFORE onPause, so PiP entry still works).
// enterPictureInPictureMode() cannot be called after onPause; AppState.onChange
// is already too late. This is the correct Android hook for PiP on app switch.
const withPipActivity = (config) => {
  return withMainActivity(config, (mod) => {
    let src = mod.modResults.contents;

    // Add required imports if not already present
    const importsToAdd = [
      'import android.app.PictureInPictureParams',
      'import android.util.Rational',
    ];
    importsToAdd.forEach((imp) => {
      if (!src.includes(imp)) {
        // Insert after the last existing import line
        src = src.replace(/(^import .+$)/m, `$1\n${imp}`);
      }
    });

    // Add onUserLeaveHint override only once
    if (!src.includes('onUserLeaveHint')) {
      const method = `
  override fun onUserLeaveHint() {
    super.onUserLeaveHint()
    // Enter PiP when user leaves app (Home / Recent) while camera is streaming.
    // Must be called here — after onPause() it is too late.
    if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O &&
        com.sarayatec.cameraservice.CameraServiceModule.isStreaming) {
      try {
        val params = PictureInPictureParams.Builder()
          .setAspectRatio(Rational(16, 9))
          .build()
        enterPictureInPictureMode(params)
      } catch (e: Exception) {}
    }
  }
`;
      // Insert before the closing brace of the class
      const lastBrace = src.lastIndexOf('}');
      src = src.slice(0, lastBrace) + method + src.slice(lastBrace);
    }

    mod.modResults.contents = src;
    return mod;
  });
};

module.exports = withPipActivity;
