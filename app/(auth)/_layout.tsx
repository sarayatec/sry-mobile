import { Stack, Redirect } from 'expo-router';
import { useAuthStore } from '../../src/stores/authStore';

export default function AuthLayout() {
  const { user, loading } = useAuthStore();
  if (!loading && user) return <Redirect href="/(app)/" />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
