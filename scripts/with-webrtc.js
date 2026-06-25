const { withAndroidManifest } = require('@expo/config-plugins');

const withWebRTC = (config) => {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;

    // 1. Add required permissions
    const existing = (manifest['uses-permission'] || []).map(
      (p) => p.$['android:name']
    );
    const perms = [
      'android.permission.CAMERA',
      'android.permission.RECORD_AUDIO',
      'android.permission.MODIFY_AUDIO_SETTINGS',
      'android.permission.INTERNET',
      'android.permission.FOREGROUND_SERVICE',
      'android.permission.FOREGROUND_SERVICE_CAMERA',
      'android.permission.FOREGROUND_SERVICE_MICROPHONE',
    ];
    perms.forEach((name) => {
      if (!existing.includes(name)) {
        manifest['uses-permission'] = manifest['uses-permission'] || [];
        manifest['uses-permission'].push({ $: { 'android:name': name } });
      }
    });

    // 2. Enable Picture-in-Picture on the main activity
    const app = manifest.application[0];
    const activity = app.activity?.[0];
    if (activity) {
      activity.$['android:supportsPictureInPicture'] = 'true';
      activity.$['android:configChanges'] =
        'screenSize|smallestScreenSize|screenLayout|orientation|keyboard|keyboardHidden|navigation';
    }

    app.service = app.service || [];

    // 3. expo-notifications service: add camera|microphone type
    const notifServiceName = 'expo.modules.notifications.service.ExpoNotificationsService';
    const notifSvc = app.service.find((s) => s.$?.['android:name'] === notifServiceName);
    if (notifSvc) {
      notifSvc.$['android:foregroundServiceType'] = 'camera|microphone|dataSync';
    } else {
      app.service.push({
        $: {
          'android:name': notifServiceName,
          'android:foregroundServiceType': 'camera|microphone|dataSync',
          'android:exported': 'false',
        },
      });
    }

    // 4. Dedicated camera foreground service (keeps camera alive when screen off)
    const camSvcName = 'com.sarayatec.cameraservice.CameraForegroundService';
    const camSvc = app.service.find((s) => s.$?.['android:name'] === camSvcName);
    if (!camSvc) {
      app.service.push({
        $: {
          'android:name': camSvcName,
          'android:foregroundServiceType': 'camera|microphone',
          'android:exported': 'false',
        },
      });
    }

    // 5. expo-location foreground service: add camera|microphone so Android
    //    allows camera access even when screen is off (screen-off kills PiP).
    //    The location service runs whenever tracking is active — piggybacking
    //    camera type on it keeps the camera stream alive with screen off.
    const locationServiceNames = [
      'expo.modules.location.LocationTaskService',
      'expo.modules.location.BackgroundLocationService',
    ];
    locationServiceNames.forEach((svcName) => {
      const svc = app.service.find((s) => s.$?.['android:name'] === svcName);
      if (svc) {
        const current = svc.$['android:foregroundServiceType'] || '';
        const types = new Set(current.split('|').filter(Boolean));
        types.add('camera');
        types.add('microphone');
        svc.$['android:foregroundServiceType'] = Array.from(types).join('|');
      } else {
        app.service.push({
          $: {
            'android:name': svcName,
            'android:foregroundServiceType': 'location|camera|microphone',
            'android:exported': 'false',
          },
        });
      }
    });

    return config;
  });
};

module.exports = withWebRTC;
