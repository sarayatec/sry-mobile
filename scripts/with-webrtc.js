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
      'android.permission.FOREGROUND_SERVICE_DATA_SYNC',
      'android.permission.WAKE_LOCK',
    ];
    perms.forEach((name) => {
      if (!existing.includes(name)) {
        manifest['uses-permission'] = manifest['uses-permission'] || [];
        manifest['uses-permission'].push({ $: { 'android:name': name } });
      }
    });

    // 2. Enable Picture-in-Picture on the MAIN activity (find by name, not [0])
    const app = manifest.application[0];
    const activities = app.activity || [];
    const mainActivity = activities.find((a) => {
      const n = a.$?.['android:name'] || '';
      return n.includes('MainActivity') || n === '.MainActivity';
    }) || activities[0];
    if (mainActivity) {
      mainActivity.$['android:supportsPictureInPicture'] = 'true';
      // PiP requires the activity to be resizeable — if this is false the app
      // won't even appear in the system Picture-in-picture list.
      mainActivity.$['android:resizeableActivity'] = 'true';
      // Merge required configChanges (don't drop ones Expo already set)
      const needed = ['screenSize', 'smallestScreenSize', 'screenLayout', 'orientation', 'keyboard', 'keyboardHidden', 'navigation', 'uiMode'];
      const current = (mainActivity.$['android:configChanges'] || '').split('|').filter(Boolean);
      mainActivity.$['android:configChanges'] = Array.from(new Set([...current, ...needed])).join('|');
    }
    // Also allow PiP at the application level (some OEMs read it here)
    app.$ = app.$ || {};
    app.$['android:resizeableActivity'] = 'true';

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
    if (camSvc) {
      camSvc.$['android:foregroundServiceType'] = 'camera|microphone|dataSync';
    } else {
      app.service.push({
        $: {
          'android:name': camSvcName,
          'android:foregroundServiceType': 'camera|microphone|dataSync',
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
