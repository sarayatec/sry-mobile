const { withAndroidManifest } = require('@expo/config-plugins');

// Registers CameraForegroundService in AndroidManifest so it can be started
// by the JS layer to keep camera alive when the screen is off (Android 11+).
const withCameraService = (config) => {
  return withAndroidManifest(config, (config) => {
    const app = config.modResults.manifest.application[0];
    app.service = app.service || [];

    const svcName = 'com.sarayatec.cameraservice.CameraForegroundService';
    if (!app.service.find((s) => s.$?.['android:name'] === svcName)) {
      app.service.push({
        $: {
          'android:name': svcName,
          'android:foregroundServiceType': 'camera|microphone',
          'android:exported': 'false',
        },
      });
    }
    return config;
  });
};

module.exports = withCameraService;
