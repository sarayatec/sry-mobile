const { withMainActivity } = require('@expo/config-plugins');

// Patches MainActivity to enter PiP in onUserLeaveHint (fires BEFORE onPause,
// the only window where enterPictureInPictureMode() is still allowed).
const withPipActivity = (config) => {
  return withMainActivity(config, (mod) => {
    let src = mod.modResults.contents;

    if (src.includes('onUserLeaveHint')) return mod; // already patched

    // Imports — use fully-qualified names in the method body to avoid
    // any import conflicts with generated code, except these two which
    // are safe to add:
    ['import android.app.PictureInPictureParams', 'import android.util.Rational']
      .forEach((imp) => {
        if (!src.includes(imp)) {
          src = src.replace(/^(package .+)$/m, `$1\n${imp}`);
        }
      });

    // onUserLeaveHint: reads SharedPreferences to check if camera is streaming.
    // No cross-module class reference needed — just android.* APIs.
    const method = [
      '',
      '  override fun onUserLeaveHint() {',
      '    super.onUserLeaveHint()',
      '    if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {',
      '      val prefs = getSharedPreferences("sry_streaming", android.content.Context.MODE_PRIVATE)',
      '      if (prefs.getBoolean("camera_active", false)) {',
      '        try {',
      '          val params = PictureInPictureParams.Builder()',
      '            .setAspectRatio(Rational(16, 9))',
      '            .build()',
      '          enterPictureInPictureMode(params)',
      '        } catch (e: Exception) {}',
      '      }',
      '    }',
      '  }',
      '',
    ].join('\n');

    const lastBrace = src.lastIndexOf('}');
    src = src.slice(0, lastBrace) + method + src.slice(lastBrace);

    mod.modResults.contents = src;
    return mod;
  });
};

module.exports = withPipActivity;
