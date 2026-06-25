const { withAndroidManifest } = require('@expo/config-plugins');

// Registers BootReceiver in AndroidManifest so the app auto-starts on device boot.
const withBoot = (config) => {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;

    // RECEIVE_BOOT_COMPLETED permission
    const existing = (manifest['uses-permission'] || []).map(
      (p) => p.$['android:name']
    );
    if (!existing.includes('android.permission.RECEIVE_BOOT_COMPLETED')) {
      manifest['uses-permission'] = manifest['uses-permission'] || [];
      manifest['uses-permission'].push({
        $: { 'android:name': 'android.permission.RECEIVE_BOOT_COMPLETED' },
      });
    }

    // BootReceiver
    const app = manifest.application[0];
    app.receiver = app.receiver || [];
    const receiverName = 'com.sarayatec.boot.BootReceiver';
    if (!app.receiver.find((r) => r.$?.['android:name'] === receiverName)) {
      app.receiver.push({
        $: {
          'android:name': receiverName,
          'android:enabled': 'true',
          'android:exported': 'true',
          'android:directBootAware': 'true',
        },
        'intent-filter': [
          {
            action: [{ $: { 'android:name': 'android.intent.action.BOOT_COMPLETED' } }],
            category: [{ $: { 'android:name': 'android.intent.category.DEFAULT' } }],
          },
        ],
      });
    }

    return config;
  });
};

module.exports = withBoot;
