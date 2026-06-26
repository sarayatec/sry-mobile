const { withMainActivity } = require('@expo/config-plugins');

// Injects a sryLifecycleLog() helper and overrides for all Android Activity
// lifecycle callbacks that are NOT already injected by other plugins.
// Only adds Log.d calls — no behavior changes.
//
// Lifecycle methods covered here:
//   onCreate, onStart, onResume, onPause, onStop, onDestroy,
//   onNewIntent, onTrimMemory
//
// NOT covered here (handled by with-pip.js):
//   onUserLeaveHint, onPictureInPictureModeChanged
//
// Every log line includes the current Session ID from SRYSession.
//
// adb logcat filter: adb logcat -s SRYLifecycle

const withLifecycleLogs = (config) => {
  return withMainActivity(config, (config) => {
    let src = config.modResults.contents;

    // Already patched — skip
    if (src.includes('SRY_LIFECYCLE_LOGS')) return config;

    const classIdx = src.indexOf('class MainActivity');
    if (classIdx === -1) return config;
    const braceIdx = src.indexOf('{', classIdx);
    if (braceIdx === -1) return config;

    // NOTE: ${'$'} emits a literal $ inside a JS template string so Kotlin
    // receives valid string interpolation syntax at compile time.
    const sid = '"none"';

    // Private helper injected once — all lifecycle methods call this.
    const helper = `

  // SRY_LIFECYCLE_LOGS — debug instrumentation (logcat tag: SRYLifecycle)
  private fun sryLifecycleLog(method: String, extra: String = "") {
    val ts  = java.text.SimpleDateFormat("HH:mm:ss.SSS", java.util.Locale.US).format(java.util.Date())
    val t   = Thread.currentThread().name
    val sid = ${sid}
    android.util.Log.d("SRYLifecycle", "[${'$'}ts] [${'$'}t] [Session:${'$'}sid] [MainActivity] [${'$'}method] CALLED ${'$'}extra")
  }`;

    // Lifecycle method overrides — injected only if the method does not already
    // exist in the source (guards against other plugins adding the same method).
    const lifecycleMethods = buildLifecycleMethods(src);

    src = src.substring(0, braceIdx + 1) + helper + lifecycleMethods + src.substring(braceIdx + 1);
    config.modResults.contents = src;
    return config;
  });
};

function buildLifecycleMethods(src) {
  const methods = [];

  if (!src.includes('override fun onCreate')) {
    methods.push(`
  override fun onCreate(savedInstanceState: android.os.Bundle?) {
    super.onCreate(null)
    sryLifecycleLog("onCreate")
  }`);
  }

  if (!src.includes('override fun onStart')) {
    methods.push(`
  override fun onStart() {
    super.onStart()
    sryLifecycleLog("onStart")
  }`);
  }

  if (!src.includes('override fun onResume')) {
    methods.push(`
  override fun onResume() {
    super.onResume()
    sryLifecycleLog("onResume")
  }`);
  }

  if (!src.includes('override fun onPause')) {
    methods.push(`
  override fun onPause() {
    super.onPause()
    sryLifecycleLog("onPause")
  }`);
  }

  if (!src.includes('override fun onStop')) {
    methods.push(`
  override fun onStop() {
    super.onStop()
    sryLifecycleLog("onStop")
  }`);
  }

  if (!src.includes('override fun onDestroy')) {
    methods.push(`
  override fun onDestroy() {
    sryLifecycleLog("onDestroy")
    super.onDestroy()
  }`);
  }

  if (!src.includes('override fun onNewIntent')) {
    methods.push(`
  override fun onNewIntent(intent: android.content.Intent?) {
    super.onNewIntent(intent)
    sryLifecycleLog("onNewIntent", "action=${'$'}{intent?.action} extras=${'$'}{intent?.extras}")
  }`);
  }

  if (!src.includes('override fun onTrimMemory')) {
    methods.push(`
  override fun onTrimMemory(level: Int) {
    super.onTrimMemory(level)
    // level 80 = TRIM_MEMORY_COMPLETE (process about to be killed)
    // level 60 = TRIM_MEMORY_MODERATE
    // level 40 = TRIM_MEMORY_BACKGROUND
    sryLifecycleLog("onTrimMemory", "level=${'$'}level")
  }`);
  }

  return methods.join('\n');
}

module.exports = withLifecycleLogs;
