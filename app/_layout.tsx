import '../global.css';
import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { defineLocationTask } from '../src/services/location';
import { useAuthStore } from '../src/stores/authStore';

// Register background task at module level — required by expo-task-manager
defineLocationTask();

export default function RootLayout() {
  const init = useAuthStore((s) => s.init);

  useEffect(() => {
    init();
  }, []);

  return (
    <>
      <StatusBar style="light" backgroundColor="#1e3a8a" />
      <Stack screenOptions={{ headerShown: false }} />
    </>
  );
}
