import { useEffect, useRef, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE, Circle } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import api from '../../src/services/api';
import { useAuthStore } from '../../src/stores/authStore';
import { LiveEmployee } from '../../src/types';

// Muscat default centre
const MUSCAT = { latitude: 23.5880, longitude: 58.3829 };

export default function MapScreen() {
  const { user } = useAuthStore();
  const mapRef = useRef<MapView>(null);

  const [employees, setEmployees]   = useState<LiveEmployee[]>([]);
  const [myPos, setMyPos]           = useState<Location.LocationObject | null>(null);
  const [loading, setLoading]       = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const fetchData = useCallback(async () => {
    const [pos] = await Promise.all([
      Location.getLastKnownPositionAsync({}).catch(() => null),
    ]);
    setMyPos(pos);

    if (user?.role === 'admin') {
      try {
        const { data } = await api.get<LiveEmployee[]>('/mobile/admin/live-employees');
        setEmployees(data);
      } catch {}
    }

    setLastRefresh(new Date());
    setLoading(false);
  }, [user?.role]);

  useEffect(() => {
    fetchData();
    const t = setInterval(fetchData, 30_000);
    return () => clearInterval(t);
  }, [fetchData]);

  const centerOnMe = async () => {
    try {
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setMyPos(pos);
      mapRef.current?.animateToRegion({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        latitudeDelta: 0.012,
        longitudeDelta: 0.012,
      }, 500);
    } catch {}
  };

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50">
        <ActivityIndicator size="large" color="#1e40af" />
        <Text className="text-gray-500 mt-3 text-sm">جاري تحميل الخريطة…</Text>
      </View>
    );
  }

  const initialRegion = myPos
    ? {
        latitude: myPos.coords.latitude,
        longitude: myPos.coords.longitude,
        latitudeDelta: 0.04,
        longitudeDelta: 0.04,
      }
    : { ...MUSCAT, latitudeDelta: 0.12, longitudeDelta: 0.12 };

  const activeCount = employees.filter(e => e.status === 'active').length;

  return (
    <View className="flex-1">
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={{ flex: 1 }}
        initialRegion={initialRegion}
        showsUserLocation
        showsMyLocationButton={false}
        showsCompass
        showsScale
      >
        {employees.map((emp) => {
          const isActive = emp.status === 'active';
          return (
            <Marker
              key={emp.id}
              coordinate={{ latitude: Number(emp.lat), longitude: Number(emp.lng) }}
              title={emp.name}
              description={
                isActive
                  ? `نشط — آخر تحديث ${new Date(emp.updated_at).toLocaleTimeString('ar-OM', { hour: '2-digit', minute: '2-digit' })}`
                  : 'غير متصل'
              }
            >
              <View
                className={`rounded-full px-2.5 py-1 border-2 border-white shadow-md ${
                  isActive ? 'bg-blue-700' : 'bg-gray-400'
                }`}
              >
                <Text className="text-white text-xs font-bold">
                  {emp.name.split(' ')[0]}
                </Text>
              </View>
            </Marker>
          );
        })}
      </MapView>

      {/* Overlay: employee count (admin) */}
      {user?.role === 'admin' && (
        <View className="absolute top-4 left-4 bg-white rounded-full px-3.5 py-2 shadow flex-row items-center">
          <View className="w-2 h-2 rounded-full bg-green-500 mr-1.5" />
          <Text className="text-gray-700 text-sm font-semibold">
            {activeCount} / {employees.length} موظف
          </Text>
        </View>
      )}

      {/* Last refresh */}
      {lastRefresh && (
        <View className="absolute top-4 right-4 bg-white/90 rounded-full px-3 py-1.5 shadow">
          <Text className="text-gray-500 text-xs">
            تحديث {lastRefresh.toLocaleTimeString('ar-OM', { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
      )}

      {/* Centre-on-me FAB */}
      <TouchableOpacity
        onPress={centerOnMe}
        className="absolute bottom-8 right-4 bg-white rounded-full w-13 h-13 shadow-lg items-center justify-center"
        style={{ width: 52, height: 52 }}
      >
        <Ionicons name="locate" size={24} color="#1e40af" />
      </TouchableOpacity>

      {/* Refresh FAB */}
      <TouchableOpacity
        onPress={fetchData}
        className="absolute bottom-24 right-4 bg-white rounded-full shadow items-center justify-center"
        style={{ width: 44, height: 44 }}
      >
        <Ionicons name="refresh" size={20} color="#6b7280" />
      </TouchableOpacity>
    </View>
  );
}
