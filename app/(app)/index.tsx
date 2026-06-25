import { useEffect, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert, ActivityIndicator, RefreshControl, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import api from '../../src/services/api';
import { useAuthStore } from '../../src/stores/authStore';
import { requestPermissions, startTracking, stopTracking, isTracking } from '../../src/services/location';
import { FieldAppointment } from '../../src/types';

export default function DashboardScreen() {
  const { user, logout } = useAuthStore();
  const [tracking, setTracking] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [lastPos, setLastPos] = useState<Location.LocationObject | null>(null);
  const [todayTotal, setTodayTotal] = useState(0);
  const [todayPending, setTodayPending] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    const [running, pos] = await Promise.all([
      isTracking(),
      Location.getLastKnownPositionAsync({}).catch(() => null),
    ]);
    setTracking(running);
    setLastPos(pos);
    try {
      const { data } = await api.get<FieldAppointment[]>('/mobile/appointments?today=1');
      setTodayTotal(data.length);
      setTodayPending(data.filter(a => a.status === 'pending').length);
    } catch {}
  }, []);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 15_000);
    return () => clearInterval(t);
  }, [refresh]);

  const handleToggle = async () => {
    if (!tracking) return; // auto-starts on login — no manual start needed
    setToggling(true);
    Alert.alert('إيقاف الجلسة', 'سيتوقف إرسال موقعك. هل أنت متأكد؟', [
      { text: 'إلغاء', style: 'cancel', onPress: () => setToggling(false) },
      { text: 'إيقاف', style: 'destructive', onPress: async () => {
        try { await stopTracking(); } catch {}
        setTracking(false);
        setToggling(false);
      }},
    ]);
  };

  const onRefresh = async () => { setRefreshing(true); await refresh(); setRefreshing(false); };

  return (
    <ScrollView style={s.root} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#1e40af" />}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => Alert.alert('تسجيل الخروج', 'هل تريد الخروج؟', [{ text: 'إلغاء', style: 'cancel' }, { text: 'خروج', style: 'destructive', onPress: logout }])}>
          <Ionicons name="log-out-outline" size={22} color="#93c5fd" />
        </TouchableOpacity>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={s.greet}>مرحباً،</Text>
          <Text style={s.userName}>{user?.name}</Text>
        </View>
      </View>
      <View style={s.statusRow}>
        <View style={[s.dot, { backgroundColor: tracking ? '#4ade80' : '#6b7280' }]} />
        <Text style={s.statusText}>{tracking ? 'جلسة نشطة — موقعك يُرسل كل 30 ث' : 'لا توجد جلسة نشطة'}</Text>
      </View>

      <View style={s.body}>
        <TouchableOpacity onPress={handleToggle} disabled={toggling} activeOpacity={0.88}
          style={[s.toggleCard, tracking && s.toggleCardActive]}>
          <View>
            <Text style={[s.toggleTitle, tracking && { color: '#fff' }]}>{tracking ? 'جلسة نشطة' : 'الجلسة موقوفة'}</Text>
            <Text style={[s.toggleSub, tracking && { color: '#d1fae5' }]}>{tracking ? 'اضغط لإيقاف التتبع' : 'تُبدأ تلقائياً عند إعادة تشغيل التطبيق'}</Text>
          </View>
          {toggling ? <ActivityIndicator color={tracking ? '#fff' : '#1e40af'} /> : <Ionicons name={tracking ? 'radio' : 'radio-outline'} size={36} color={tracking ? '#fff' : '#1e40af'} />}
        </TouchableOpacity>

        <View style={s.statsRow}>
          <View style={s.statCard}>
            <Ionicons name="calendar-outline" size={20} color="#1e40af" />
            <Text style={s.statNum}>{todayTotal}</Text>
            <Text style={s.statLabel}>مواعيد اليوم</Text>
          </View>
          <View style={[s.statCard, { backgroundColor: '#fffbeb' }]}>
            <Ionicons name="time-outline" size={20} color="#d97706" />
            <Text style={[s.statNum, { color: '#92400e' }]}>{todayPending}</Text>
            <Text style={[s.statLabel, { color: '#92400e' }]}>قيد الانتظار</Text>
          </View>
        </View>

        {lastPos && (
          <View style={s.posCard}>
            <View style={s.posRow}>
              <Ionicons name="location" size={15} color="#3b82f6" />
              <Text style={s.posTitle}>آخر موقع مسجَّل</Text>
            </View>
            <Text style={s.posCoords}>{lastPos.coords.latitude.toFixed(6)}, {lastPos.coords.longitude.toFixed(6)}</Text>
            {lastPos.coords.accuracy != null && <Text style={s.posAcc}>الدقة ±{Math.round(lastPos.coords.accuracy)} م</Text>}
          </View>
        )}

        {user?.role === 'admin' && (
          <View style={s.adminBadge}>
            <Ionicons name="shield-checkmark" size={18} color="#b45309" />
            <Text style={s.adminText}>أنت مسؤول النظام — تظهر لك مواقع جميع الموظفين</Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f8fafc' },
  header: { backgroundColor: '#1e3a8a', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 8 },
  greet: { color: '#93c5fd', fontSize: 12 },
  userName: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  statusRow: { backgroundColor: '#1e3a8a', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 28 },
  dot: { width: 10, height: 10, borderRadius: 5, marginRight: 8 },
  statusText: { color: '#bfdbfe', fontSize: 13 },
  body: { padding: 20, marginTop: -16 },
  toggleCard: { backgroundColor: '#fff', borderRadius: 24, padding: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3 },
  toggleCardActive: { backgroundColor: '#22c55e' },
  toggleTitle: { fontSize: 20, fontWeight: '900', color: '#1e293b' },
  toggleSub: { fontSize: 13, color: '#94a3b8', marginTop: 4 },
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  statCard: { flex: 1, backgroundColor: '#eff6ff', borderRadius: 20, padding: 16 },
  statNum: { fontSize: 32, fontWeight: '900', color: '#1e40af', marginTop: 8 },
  statLabel: { fontSize: 12, color: '#1e40af', opacity: 0.7 },
  posCard: { backgroundColor: '#fff', borderRadius: 20, padding: 16, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  posRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  posTitle: { color: '#374151', fontWeight: '600', fontSize: 13, marginLeft: 6 },
  posCoords: { color: '#6b7280', fontSize: 12, fontFamily: 'monospace' },
  posAcc: { color: '#9ca3af', fontSize: 11, marginTop: 2 },
  adminBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fffbeb', borderWidth: 1, borderColor: '#fde68a', borderRadius: 20, padding: 14 },
  adminText: { color: '#92400e', fontWeight: '600', fontSize: 13, marginLeft: 8 },
});
