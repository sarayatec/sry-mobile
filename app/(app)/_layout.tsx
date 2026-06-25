import { useEffect } from 'react';
import { TouchableOpacity, Alert } from 'react-native';
import { Tabs, Redirect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../src/stores/authStore';
import { startSignaling, stopSignaling } from '../../src/services/webrtc';
import { requestPermissions, startTracking, isTracking } from '../../src/services/location';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

function TabIcon({ name, color, size }: { name: IconName; color: string; size: number }) {
  return <Ionicons name={name} size={size} color={color} />;
}

export default function AppLayout() {
  const { user, loading, logout } = useAuthStore();

  // Auto-start location tracking when user logs in
  useEffect(() => {
    if (!user) return;
    (async () => {
      const already = await isTracking();
      if (already) return;
      const ok = await requestPermissions();
      if (ok) await startTracking();
    })();
  }, [user?.id]);

  useEffect(() => {
    if (user) {
      startSignaling(String(user.id), user.name);
      return () => stopSignaling();
    }
  }, [user?.id]);

  if (!loading && !user) return <Redirect href="/(auth)/login" />;

  const LogoutBtn = () => (
    <TouchableOpacity
      onPress={() => Alert.alert('تسجيل الخروج', 'هل تريد الخروج؟', [
        { text: 'إلغاء', style: 'cancel' },
        { text: 'خروج', style: 'destructive', onPress: logout },
      ])}
      style={{ paddingHorizontal: 14, paddingVertical: 6 }}
    >
      <Ionicons name="log-out-outline" size={24} color="#fff" />
    </TouchableOpacity>
  );

  return (
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
  );
}
