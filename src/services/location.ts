import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import api from './api';
import { sryLog } from '../utils/log';

export const LOCATION_TASK = 'SRY_BG_LOCATION';

// Must be called at module level (outside components)
export function defineLocationTask(): void {
  if (TaskManager.isTaskDefined(LOCATION_TASK)) {
    sryLog('Location', 'defineLocationTask', 'ALREADY_DEFINED', { task: LOCATION_TASK });
    return;
  }

  sryLog('Location', 'defineLocationTask', 'DEFINING', { task: LOCATION_TASK });

  TaskManager.defineTask(LOCATION_TASK, async ({ data, error }) => {
    if (error) {
      sryLog('Location', 'taskCallback', 'ERROR', { message: error.message });
      console.warn('[LocationTask]', error.message);
      return;
    }
    const locs = (data as { locations: Location.LocationObject[] }).locations;
    if (!locs?.length) {
      sryLog('Location', 'taskCallback', 'EMPTY_LOCATIONS', {});
      return;
    }

    const { coords } = locs[locs.length - 1];
    sryLog('Location', 'taskCallback', 'LOCATION_RECEIVED', {
      lat: coords.latitude.toFixed(6),
      lng: coords.longitude.toFixed(6),
      accuracy: coords.accuracy,
      heading: coords.heading,
      speed: coords.speed,
      locCount: locs.length,
    });

    try {
      await api.post('/mobile/location', {
        lat: coords.latitude,
        lng: coords.longitude,
        accuracy: coords.accuracy,
        heading: coords.heading,
        speed: coords.speed,
      });
      sryLog('Location', 'taskCallback', 'UPLOAD_SUCCESS', {
        lat: coords.latitude.toFixed(6),
        lng: coords.longitude.toFixed(6),
      });
    } catch (err) {
      sryLog('Location', 'taskCallback', 'UPLOAD_ERROR', { err: String(err) });
      // Silently ignore — will retry on next interval
    }
  });

  sryLog('Location', 'defineLocationTask', 'DEFINED', { task: LOCATION_TASK });
}

export async function requestPermissions(): Promise<boolean> {
  sryLog('Location', 'requestPermissions', 'CALLED', {});
  const fg = await Location.requestForegroundPermissionsAsync();
  sryLog('Location', 'requestPermissions', 'FOREGROUND', { status: fg.status });
  if (fg.status !== 'granted') {
    sryLog('Location', 'requestPermissions', 'FOREGROUND_DENIED', {});
    return false;
  }
  const bg = await Location.requestBackgroundPermissionsAsync();
  sryLog('Location', 'requestPermissions', 'BACKGROUND', { status: bg.status });
  const granted = bg.status === 'granted';
  sryLog('Location', 'requestPermissions', granted ? 'ALL_GRANTED' : 'BACKGROUND_DENIED', {});
  return granted;
}

export async function startTracking(): Promise<void> {
  sryLog('Location', 'startTracking', 'CALLED', {});
  const running = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK).catch(() => false);
  if (running) {
    sryLog('Location', 'startTracking', 'ALREADY_RUNNING', {});
    return;
  }

  sryLog('Location', 'startTracking', 'STARTING', {
    timeInterval: 30000,
    distanceInterval: 30,
  });
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
  sryLog('Location', 'startTracking', 'STARTED', {});
}

export async function stopTracking(): Promise<void> {
  sryLog('Location', 'stopTracking', 'CALLED', {});
  const running = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK).catch(() => false);
  if (running) {
    await Location.stopLocationUpdatesAsync(LOCATION_TASK);
    sryLog('Location', 'stopTracking', 'STOPPED', {});
  } else {
    sryLog('Location', 'stopTracking', 'WAS_NOT_RUNNING', {});
  }
}

export async function isTracking(): Promise<boolean> {
  const result = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK).catch(() => false);
  sryLog('Location', 'isTracking', 'CHECK', { result });
  return result;
}
