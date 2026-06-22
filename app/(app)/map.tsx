import { useEffect, useRef, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import api from '../../src/services/api';
import { useAuthStore } from '../../src/stores/authStore';
import { LiveEmployee } from '../../src/types';

const MUSCAT = { latitude: 23.5880, longitude: 58.3829 };

export default function MapScreen() {
  const { user } = useAuthStore();
  const mapRef = useRef<MapView>(null);
  const [employees, setEmployees] = useState<LiveEmployee[]>([]);
  const [myPos, setMyPos] = useState<Location.LocationObject | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const fetchData = useCallback(async () => {
    const pos = await Location.getLastKnownPositionAsync({}).catch(() => null);
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
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    setMyPos(pos);
    mapRef.current?.animateToRegion({ latitude: pos.coords.latitude, longitude: pos.coords.longitude, latitudeDelta: 0.012, longitudeDelta: 0.012 }, 500);
  };

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color="#1e40af" />
        <Text style={s.loadText}>جاري تحميل الخريطة…</Text>
      </View>
    );
  }

  const initialRegion = myPos
    ? { latitude: myPos.coords.latitude, longitude: myPos.coords.longitude, latitudeDelta: 0.04, longitudeDelta: 0.04 }
    : { ...MUSCAT, latitudeDelta: 0.12, longitudeDelta: 0.12 };

  return (
    <View style={{ flex: 1 }}>
      <MapView ref={mapRef} provider={PROVIDER_GOOGLE} style={{ flex: 1 }} initialRegion={initialRegion} showsUserLocation showsMyLocationButton={false} showsCompass showsScale>
        {employees.map(emp => (
          <Marker key={emp.id} coordinate={{ latitude: Number(emp.lat), longitude: Number(emp.lng) }}
            title={emp.name}
            description={emp.status === 'active' ? `نشط — ${new Date(emp.updated_at).toLocaleTimeString('ar-OM', { hour: '2-digit', minute: '2-digit' })}` : 'غير متصل'}>
            <View style={[s.markerBubble, emp.status !== 'active' && s.markerOff]}>
              <Text style={s.markerText}>{emp.name.split(' ')[0]}</Text>
            </View>
          </Marker>
        ))}
      </MapView>

      {user?.role === 'admin' && (
        <View style={s.badge}>
          <View style={s.activeDot} />
          <Text style={s.badgeText}>{employees.filter(e => e.status === 'active').length} / {employees.length} موظف</Text>
        </View>
      )}

      {lastRefresh && (
        <View style={s.refreshBadge}>
          <Text style={s.refreshText}>تحديث {lastRefresh.toLocaleTimeString('ar-OM', { hour: '2-digit', minute: '2-digit' })}</Text>
        </View>
      )}

      <TouchableOpacity onPress={centerOnMe} style={s.fab}>
        <Ionicons name="locate" size={24} color="#1e40af" />
      </TouchableOpacity>
      <TouchableOpacity onPress={fetchData} style={s.fab2}>
        <Ionicons name="refresh" size={20} color="#6b7280" />
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc' },
  loadText: { color: '#6b7280', marginTop: 12 },
  markerBubble: { backgroundColor: '#1d4ed8', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 2, borderColor: '#fff' },
  markerOff: { backgroundColor: '#9ca3af' },
  markerText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  badge: { position: 'absolute', top: 16, left: 16, backgroundColor: '#fff', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  activeDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#22c55e', marginRight: 6 },
  badgeText: { color: '#374151', fontSize: 13, fontWeight: '600' },
  refreshBadge: { position: 'absolute', top: 16, right: 16, backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  refreshText: { color: '#6b7280', fontSize: 12 },
  fab: { position: 'absolute', bottom: 32, right: 16, backgroundColor: '#fff', borderRadius: 28, width: 52, height: 52, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 6, elevation: 4 },
  fab2: { position: 'absolute', bottom: 96, right: 16, backgroundColor: '#fff', borderRadius: 22, width: 44, height: 44, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
});
