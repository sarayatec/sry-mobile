import { useRef, useState, useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet, Platform, PermissionsAndroid } from 'react-native';
import { WebView } from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as SecureStore from 'expo-secure-store';

const SRY_URL = 'https://sry.sarayatec.com';

// Build the JS that seeds localStorage BEFORE React reads it on the web side.
// Runs via injectedJavaScriptBeforeContentLoaded so it executes before any
// page script — the web AuthContext useState initializer will find the token.
function buildPreloadScript(token: string, userRaw: string | null): string {
  return `
    (function() {
      try {
        localStorage.setItem('token', ${JSON.stringify(token)});
        ${userRaw ? `localStorage.setItem('currentUser', ${JSON.stringify(userRaw)});` : ''}
        localStorage.setItem('isFieldApp', '1');
      } catch(e) {}
    })();
    true;
  `;
}

export default function SystemScreen() {
  const webRef = useRef<WebView>(null);
  const [loading, setLoading] = useState(true);
  // null = still reading token, string = ready (may be empty if no token)
  const [preloadScript, setPreloadScript] = useState<string | null>(null);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    // Request camera + microphone permissions so WebView can access them
    if (Platform.OS === 'android') {
      PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.CAMERA,
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
      ]).catch(() => {});
    }

    Promise.all([
      SecureStore.getItemAsync('auth_token'),
      SecureStore.getItemAsync('auth_user'),
    ]).then(([token, userRaw]) => {
      if (token) {
        setPreloadScript(buildPreloadScript(token, userRaw));
      } else {
        setPreloadScript('');
      }
    });
  }, []);

  // Don't render WebView until we have the token — prevents a race where the
  // page loads before the script is ready
  if (preloadScript === null) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }, styles.center]}>
        <ActivityIndicator size="large" color="#1e40af" />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {loading && (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color="#1e40af" />
        </View>
      )}
      <WebView
        ref={webRef}
        source={{ uri: SRY_URL }}
        style={styles.web}
        onLoadStart={() => setLoading(true)}
        onLoadEnd={() => setLoading(false)}
        injectedJavaScriptBeforeContentLoaded={preloadScript || undefined}
        javaScriptEnabled
        domStorageEnabled
        allowsBackForwardNavigationGestures
        cacheEnabled
        sharedCookiesEnabled
        startInLoadingState={false}
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        allowsProtectedMedia
        setSupportMultipleWindows={false}
        // Grant camera/mic permissions when the web page requests them
        onPermissionRequest={(request) => { request.grant(request.resources); }}
        // Allow file access for image upload
        allowFileAccess
        allowFileAccessFromFileURLs
        allowUniversalAccessFromFileURLs
        mixedContentMode="always"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  center: { alignItems: 'center', justifyContent: 'center' },
  web: { flex: 1 },
  loader: {
    position: 'absolute', inset: 0, zIndex: 10,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#0f172a',
  },
});
