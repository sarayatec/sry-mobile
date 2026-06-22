import { Tabs, Redirect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../src/stores/authStore';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

function TabIcon({ name, color, size }: { name: IconName; color: string; size: number }) {
  return <Ionicons name={name} size={size} color={color} />;
}

export default function AppLayout() {
  const { user, loading } = useAuthStore();
  if (!loading && !user) return <Redirect href="/(auth)/login" />;

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
        options={{
          title: 'الخريطة',
          tabBarLabel: 'الخريطة',
          tabBarIcon: ({ color, size }) => <TabIcon name="map" color={color} size={size} />,
          headerTitle: 'خريطة الموظفين',
        }}
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
    </Tabs>
  );
}
