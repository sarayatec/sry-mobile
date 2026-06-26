import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { defineLocationTask } from '../src/services/location';
import { useAuthStore } from '../src/stores/authStore';
import { useDebugStore } from '../src/stores/debugStore';
import { writeCrashLog } from '../modules/camera-service';

defineLocationTask();

export default function RootLayout() {
  const init = useAuthStore((s) => s.init);

  useEffect(() => {
    // Capture all uncaught JS exceptions and write them to crash.log and debugStore
    const orig = ErrorUtils.getGlobalHandler();
    ErrorUtils.setGlobalHandler((err, isFatal) => {
      try {
        const msg = (err as Error)?.message ?? String(err);
        const stack = (err as Error)?.stack ?? '';
        useDebugStore.getState().setException(msg);
        writeCrashLog(`[UNCAUGHT${isFatal ? '_FATAL' : ''}] ${msg}\n${stack}`);
      } catch (_) {}
      orig(err, isFatal);
    });
    return () => { ErrorUtils.setGlobalHandler(orig); };
  }, []);

  useEffect(() => { init(); }, []);
  return (
    <>
      <StatusBar style="light" backgroundColor="#1e3a8a" />
      <Stack screenOptions={{ headerShown: false }} />
    </>
  );
}
