const fs = require('fs');
const path = require('path');

// Force react-native-webrtc to use the Camera1 API instead of Camera2.
//
// WHY: Camera2 capture sessions are tied to the display lifecycle on many
// Android devices — when the screen turns off / device locks, the OS stops
// delivering frames and the admin sees a frozen stream. The legacy Camera1
// API keeps capturing with the screen off as long as a camera-type foreground
// service + WakeLock are held (both already configured in this app).
//
// This is a well-known WebRTC workaround for background/screen-off capture.

const filePath = path.join(
  __dirname, '..', 'node_modules', 'react-native-webrtc',
  'android', 'src', 'main', 'java', 'com', 'oney', 'WebRTCModule',
  'GetUserMediaImpl.java'
);

if (!fs.existsSync(filePath)) {
  console.log('react-native-webrtc GetUserMediaImpl.java not found, skipping Camera1 patch');
  process.exit(0);
}

let content = fs.readFileSync(filePath, 'utf8');

const before = `        if (cameraEnumerator == null) {
            if (Camera2Enumerator.isSupported(reactContext)) {
                Log.d(TAG, "Creating camera enumerator using the Camera2 API");
                cameraEnumerator = new Camera2Enumerator(reactContext);
            } else {
                Log.d(TAG, "Creating camera enumerator using the Camera1 API");
                cameraEnumerator = new Camera1Enumerator(false);
            }
        }`;

const after = `        if (cameraEnumerator == null) {
            // PATCHED: force Camera1 API so capture continues with screen off
            Log.d(TAG, "Creating camera enumerator using the Camera1 API (forced for screen-off capture)");
            cameraEnumerator = new Camera1Enumerator(false);
        }`;

if (content.includes(after)) {
  console.log('react-native-webrtc already patched to force Camera1');
} else if (content.includes(before)) {
  content = content.replace(before, after);
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('Patched react-native-webrtc to force Camera1 API (screen-off capture)');
} else {
  console.log('Camera enumerator pattern not found in GetUserMediaImpl.java, skipping');
}
