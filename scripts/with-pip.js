const { withMainActivity } = require('@expo/config-plugins');

// Injects onUserLeaveHint() into MainActivity so the app enters PiP
// BEFORE Android suspends camera access. Uses fully-qualified class names
// to avoid touching imports (simpler, less likely to break the build).
const withPiP = (config) => {
  return withMainActivity(config, (config) => {
    let src = config.modResults.contents;

    // Already patched — skip
    if (src.includes('onUserLeaveHint')) return config;

    // Find "class MainActivity" and its opening brace
    const classIdx = src.indexOf('class MainActivity');
    if (classIdx === -1) return config;

    const braceIdx = src.indexOf('{', classIdx);
    if (braceIdx === -1) return config;

    // Insert method right after the class opening brace.
    // Fully-qualified names → no import changes needed.
    const method = `

  override fun onUserLeaveHint() {
    super.onUserLeaveHint()
    if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
      try {
        enterPictureInPictureMode(
          android.app.PictureInPictureParams.Builder()
            .setAspectRatio(android.util.Rational(16, 9))
            .build()
        )
      } catch (e: Exception) {}
    }
  }`;

    src = src.substring(0, braceIdx + 1) + method + src.substring(braceIdx + 1);
    config.modResults.contents = src;
    return config;
  });
};

module.exports = withPiP;
