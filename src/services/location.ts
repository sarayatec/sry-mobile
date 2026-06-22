import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import api from './api';

export const LOCATION_TASK = 'SRY_BG_LOCATION';

// Must be called at module level (outside components)
export function defineLocationTask(): void {
  if (TaskManager.isTaskDefined(LOCATION_TASK)) return;

  TaskManager.defineTask(LOCATION_TASK, async ({ data, error }) => {
    if (error) {
      console.warn('[LocationTask]', error.message);
      return;
    }
    const locs = (data as { locations: Location.LocationObject[] }).locations;
    if (!locs?.length) return;

    const { coords } = locs[locs.length - 1];
    try {
      await api.post('/mobile/location', {
        lat: coords.latitude,
        lng: coords.longitude,
        accuracy: coords.accuracy,
        heading: coords.heading,
        speed: coords.speed,
      });
    } catch {
      // Silently ignore — will retry on next interval
    }
  });
}

export async function requestPermissions(): Promise<boolean> {
  const fg = await Location.requestForegroundPermissionsAsync();
  if (fg.status !== 'granted') return false;
  const bg = await Location.requestBackgroundPermissionsAsync();
  return bg.status === 'granted';
}

export async function startTracking(): Promise<void> {
  const running = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK).catch(() => false);
  if (running) return;

  await Location.startLocationUpdatesAsync(LOCATION_TASK, {
    accuracy: Location.Accuracy.Balanced,
    timeInterval: 30_000,    // every 30 seconds
    distanceInterval: 30,    // or every 30 metres — whichever comes first
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: 'SRY Field — جلسة عمل نشطة',
      notificationBody: 'موقعك يُرسل تلقائياً. اضغط للعودة للتطبيق.',
      notificationColor: '#1e3a8a',
    },
  });
}

export async function stopTracking(): Promise<void> {
  const running = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK).catch(() => false);
  if (running) await Location.stopLocationUpdatesAsync(LOCATION_TASK);
}

export async function isTracking(): Promise<boolean> {
  return Location.hasStartedLocationUpdatesAsync(LOCATION_TASK).catch(() => false);
}
