import { useRef, useState, useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as SecureStore from 'expo-secure-store';

const SRY_URL = 'https://sry.sarayatec.com';

export default function SystemScreen() {
  const webRef = useRef<WebView>(null);
  const [loading, setLoading] = useState(true);
  const [injectJs, setInjectJs] = useState('');
  const insets = useSafeAreaInsets();

  useEffect(() => {
    Promise.all([
      SecureStore.getItemAsync('auth_token'),
      SecureStore.getItemAsync('auth_user'),
    ]).then(([token, userRaw]) => {
      if (token) {
        // Inject token into localStorage — no reload needed, React reads it on mount
        const js = `
          (function() {
            if (!localStorage.getItem('token')) {
              localStorage.setItem('token', ${JSON.stringify(token)});
              ${userRaw ? `localStorage.setItem('currentUser', ${JSON.stringify(userRaw)});` : ''}
            }
          })();
          true;
        `;
        setInjectJs(js);
      }
    });
  }, []);

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
        injectedJavaScript={injectJs || undefined}
        javaScriptEnabled
        domStorageEnabled
        allowsBackForwardNavigationGestures
        cacheEnabled
        sharedCookiesEnabled
        startInLoadingState={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  web: { flex: 1 },
  loader: {
    position: 'absolute', inset: 0, zIndex: 10,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#0f172a',
  },
});
