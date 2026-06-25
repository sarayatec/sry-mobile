const { withMainActivity } = require('@expo/config-plugins');

// Patches MainActivity to enter PiP mode in onUserLeaveHint (fires when user
// presses Home or switches apps — BEFORE onPause, so PiP entry still works).
const withPipActivity = (config) => {
  return withMainActivity(config, (mod) => {
    let src = mod.modResults.contents;

    // Skip if already patched
    if (src.includes('onUserLeaveHint')) return mod;

    // --- Imports ---
    const importsNeeded = [
      'import android.app.PictureInPictureParams',
      'import android.util.Rational',
    ];
    importsNeeded.forEach((imp) => {
      if (!src.includes(imp)) {
        // Append after the package declaration line
        src = src.replace(
          /^(package .+)$/m,
          `$1\n${imp}`
        );
      }
    });

    // --- onUserLeaveHint method ---
    const method = [
      '',
      '  override fun onUserLeaveHint() {',
      '    super.onUserLeaveHint()',
      '    if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O &&',
      '        com.sarayatec.cameraservice.CameraServiceModule.isStreaming) {',
      '      try {',
      '        val params = PictureInPictureParams.Builder()',
      '          .setAspectRatio(Rational(16, 9))',
      '          .build()',
      '        enterPictureInPictureMode(params)',
      '      } catch (e: Exception) {}',
      '    }',
      '  }',
      '',
    ].join('\n');

    // Insert before the last closing brace of the file
    const lastBrace = src.lastIndexOf('}');
    src = src.slice(0, lastBrace) + method + src.slice(lastBrace);

    mod.modResults.contents = src;
    return mod;
  });
};

module.exports = withPipActivity;
