import { Redirect } from 'expo-router';
import { useAuthStore } from '../src/stores/authStore';
import { View, ActivityIndicator } from 'react-native';

export default function Index() {
  const { user, loading } = useAuthStore();

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-blue-900">
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );
  }

  return <Redirect href={user ? '/(app)/' : '/(auth)/login'} />;
}
