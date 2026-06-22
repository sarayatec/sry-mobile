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

    // 2. Enable Picture-in-Picture on the main activity so camera stays alive
    //    when employee switches to another app (same as Google Meet behavior)
    const app = manifest.application[0];
    const activity = app.activity?.[0];
    if (activity) {
      activity.$['android:supportsPictureInPicture'] = 'true';
      activity.$['android:configChanges'] =
        'screenSize|smallestScreenSize|screenLayout|orientation|keyboard|keyboardHidden|navigation';
    }

    // 3. Set foregroundServiceType=camera|microphone on expo-notifications service
    app.service = app.service || [];
    const notifServiceName = 'expo.modules.notifications.service.ExpoNotificationsService';
    const existing_svc = app.service.find(
      (s) => s.$?.['android:name'] === notifServiceName
    );
    if (existing_svc) {
      existing_svc.$['android:foregroundServiceType'] = 'camera|microphone|dataSync';
    } else {
      app.service.push({
        $: {
          'android:name': notifServiceName,
          'android:foregroundServiceType': 'camera|microphone|dataSync',
          'android:exported': 'false',
        },
      });
    }

    return config;
  });
};

module.exports = withWebRTC;
