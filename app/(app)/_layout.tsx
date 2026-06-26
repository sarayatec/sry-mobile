import { useEffect, useState } from 'react';
import { TouchableOpacity, Alert, Platform, PermissionsAndroid } from 'react-native';
import { Tabs, Redirect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import { useAuthStore } from '../../src/stores/authStore';
import { startSignaling, stopSignaling } from '../../src/services/webrtc';
import { requestPermissions, startTracking, isTracking } from '../../src/services/location';
import { isBootLaunch, moveToBackground } from '../../modules/boot';
import { isBatteryOptimizationIgnored, requestDisableBatteryOptimization } from '../../modules/camera-service';
import BlackScreenOverlay from '../../src/components/BlackScreenOverlay';
import api from '../../src/services/api';
import { sryLog } from '../../src/utils/log';

async function requestAllPermissions() {
  if (Platform.OS !== 'android') return;
  sryLog('Permissions', 'requestAllPermissions', 'CALLED', {});
  const result = await PermissionsAndroid.requestMultiple([
    PermissionsAndroid.PERMISSIONS.CAMERA,
    PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
  ]).catch((err) => {
    sryLog('Permissions', 'requestAllPermissions', 'ERROR', { err: String(err) });
  });
  if (result) {
    sryLog('Permissions', 'requestAllPermissions', 'RESULT', {
      camera: result[PermissionsAndroid.PERMISSIONS.CAMERA],
      audio: result[PermissionsAndroid.PERMISSIONS.RECORD_AUDIO],
    });
  }
}

type IconName = React.ComponentProps<typeof Ionicons>['name'];

function TabIcon({ name, color, size }: { name: IconName; color: string; size: number }) {
  return <Ionicons name={name} size={size} color={color} />;
}

export default function AppLayout() {
  const { user, loading, logout } = useAuthStore();
  const [blackScreen, setBlackScreen] = useState(false);

  // If launched by BootReceiver, go to background immediately — no UI shown
  useEffect(() => {
    const boot = isBootLaunch();
    sryLog('AppLayout', 'useEffect[boot]', 'CHECK', { isBootLaunch: boot });
    if (boot) {
      sryLog('AppLayout', 'useEffect[boot]', 'MOVING_TO_BACKGROUND', {});
      moveToBackground();
    }
  }, []);

  // Ask the user to exempt the app from battery optimization. Without this,
  // Samsung/Xiaomi/etc. kill the foreground service when the screen turns off
  // and the camera stream dies. Skip if launched silently from boot.
  useEffect(() => {
    if (!user || Platform.OS !== 'android' || isBootLaunch()) return;
    const ignored = isBatteryOptimizationIgnored();
    sryLog('AppLayout', 'useEffect[battery]', 'CHECK', { userId: user.id, ignored });
    if (!ignored) {
      sryLog('AppLayout', 'useEffect[battery]', 'SHOWING_BATTERY_ALERT', {});
      Alert.alert(
        'مطلوب: إبقاء التطبيق نشطاً',
        'لكي يستمر البث وتتبع الموقع عند إطفاء الشاشة، يجب إعفاء التطبيق من توفير البطارية. اضغط «موافق» ثم اختر «السماح» أو «عدم التقييد».',
        [{ text: 'موافق', onPress: () => {
          sryLog('AppLayout', 'useEffect[battery]', 'USER_CONFIRMED_BATTERY', {});
          requestDisableBatteryOptimization();
        }}]
      );
    }
  }, [user?.id]);

  // Register Expo push token and send to server
  useEffect(() => {
    if (!user) return;
    sryLog('AppLayout', 'useEffect[pushToken]', 'CALLED', { userId: user.id });
    (async () => {
      try {
        const { status } = await Notifications.requestPermissionsAsync();
        sryLog('AppLayout', 'useEffect[pushToken]', 'PERMISSION', { status });
        if (status !== 'granted') return;
        const tokenData = await Notifications.getExpoPushTokenAsync({
          projectId: 'e6c00311-d725-47ba-9951-8efabf5a0457',
        });
        sryLog('AppLayout', 'useEffect[pushToken]', 'TOKEN_OBTAINED', { token: tokenData.data.substring(0, 20) + '...' });
        await api.put('/mobile/push-token', { token: tokenData.data });
        sryLog('AppLayout', 'useEffect[pushToken]', 'TOKEN_SENT', {});
      } catch (err) {
        sryLog('AppLayout', 'useEffect[pushToken]', 'ERROR', { err: String(err) });
      }
    })();
  }, [user?.id]);

  // Permissions FIRST, then signaling — prevents getUserMedia black stream race
  useEffect(() => {
    if (!user) {
      sryLog('AppLayout', 'useEffect[signaling]', 'NO_USER_SKIP', {});
      return;
    }
    sryLog('AppLayout', 'useEffect[signaling]', 'STARTING', { userId: user.id, name: user.name });
    let cancelled = false;
    (async () => {
      // Wait for camera/mic permission before starting WebRTC signaling
      await requestAllPermissions();
      if (cancelled) {
        sryLog('AppLayout', 'useEffect[signaling]', 'CANCELLED_AFTER_PERMISSIONS', {});
        return;
      }
      sryLog('AppLayout', 'useEffect[signaling]', 'CALLING_START_SIGNALING', { userId: user.id });
      startSignaling(String(user.id), user.name);

      // Auto-start location tracking
      const already = await isTracking();
      sryLog('AppLayout', 'useEffect[signaling]', 'TRACKING_CHECK', { alreadyRunning: already });
      if (cancelled || already) return;
      const ok = await requestPermissions();
      sryLog('AppLayout', 'useEffect[signaling]', 'LOCATION_PERMISSION', { granted: ok });
      if (!cancelled && ok) {
        sryLog('AppLayout', 'useEffect[signaling]', 'CALLING_START_TRACKING', {});
        await startTracking();
      }
    })();
    return () => {
      sryLog('AppLayout', 'useEffect[signaling]', 'CLEANUP_STOP_SIGNALING', { userId: user.id });
      cancelled = true;
      stopSignaling();
    };
  }, [user?.id]);

  if (!loading && !user) return <Redirect href="/(auth)/login" />;

  const LogoutBtn = () => (
    <TouchableOpacity
      onPress={() => Alert.alert('تسجيل الخروج', 'هل تريد الخروج؟', [
        { text: 'إلغاء', style: 'cancel' },
        { text: 'خروج', style: 'destructive', onPress: () => {
          sryLog('AppLayout', 'LogoutBtn', 'LOGOUT_CONFIRMED', {});
          logout();
        }},
      ])}
      style={{ paddingHorizontal: 14, paddingVertical: 6 }}
    >
      <Ionicons name="log-out-outline" size={24} color="#fff" />
    </TouchableOpacity>
  );

  // Hide button: activates black screen so the activity stays in RESUMED state
  // and camera+audio keep streaming even if the employee uses another app.
  const HideBtn = () => (
    <TouchableOpacity
      onPress={() => {
        sryLog('AppLayout', 'HideBtn', 'PRESSED', {});
        setBlackScreen(true);
      }}
      style={{ paddingHorizontal: 14, paddingVertical: 6 }}
    >
      <Ionicons name="eye-off-outline" size={24} color="#fff" />
    </TouchableOpacity>
  );

  return (
    <>
      <BlackScreenOverlay visible={blackScreen} onDismiss={() => {
        sryLog('AppLayout', 'BlackScreenOverlay', 'DISMISSED', {});
        setBlackScreen(false);
      }} />
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#1e40af',
        tabBarInactiveTintColor: '#9ca3af',
        tabBarStyle: {
          backgroundColor: '#fff',
          borderTopColor: '#f3f4f6',
          paddingBottom: 6,
          height: 60,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        headerStyle: { backgroundColor: '#1e3a8a' },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: 'bold', fontSize: 17 },
        headerTitleAlign: 'center',
        headerLeft: () => <LogoutBtn />,
        headerRight: () => <HideBtn />,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'الرئيسية',
          tabBarLabel: 'الرئيسية',
          tabBarIcon: ({ color, size }) => <TabIcon name="home" color={color} size={size} />,
          headerTitle: 'SRY Field',
        }}
      />
      <Tabs.Screen
        name="map"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="appointments"
        options={{
          title: 'المواعيد',
          tabBarLabel: 'المواعيد',
          tabBarIcon: ({ color, size }) => <TabIcon name="calendar" color={color} size={size} />,
          headerTitle: 'مواعيد اليوم',
        }}
      />
      <Tabs.Screen
        name="system"
        options={{
          title: 'النظام',
          tabBarLabel: 'النظام',
          tabBarIcon: ({ color, size }) => <TabIcon name="grid" color={color} size={size} />,
          headerShown: false,
        }}
      />
    </Tabs>
    </>
  );
}
