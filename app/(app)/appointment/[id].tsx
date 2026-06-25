import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Linking, Alert,
  ActivityIndicator, StyleSheet, Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import api from '../../../src/services/api';
import { FieldAppointment, AppointmentStatus } from '../../../src/types';

const STATUS_MAP: Record<AppointmentStatus, { label: string; fg: string; bg: string }> = {
  pending:     { label: 'قيد الانتظار', fg: '#92400e', bg: '#fef3c7' },
  in_progress: { label: 'جارٍ',          fg: '#1e40af', bg: '#dbeafe' },
  done:        { label: 'مكتمل ✓',      fg: '#065f46', bg: '#d1fae5' },
  cancelled:   { label: 'ملغي',          fg: '#991b1b', bg: '#fee2e2' },
};

export default function AppointmentDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [appt, setAppt] = useState<FieldAppointment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get<FieldAppointment>(`/mobile/appointments/${id}`);
      setAppt(data);
    } catch (e: any) {
      setError('تعذّر تحميل بيانات الموعد');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const updateStatus = useCallback(async (next: AppointmentStatus) => {
    if (!appt) return;
    try {
      await api.patch(`/mobile/appointments/${appt.id}`, { status: next });
      setAppt(prev => prev ? { ...prev, status: next } : prev);
    } catch {
      Alert.alert('خطأ', 'تعذّر تحديث الحالة');
    }
  }, [appt]);

  const confirmStatus = (next: AppointmentStatus, label: string) => {
    Alert.alert(label, 'هل تريد تغيير حالة الموعد؟', [
      { text: 'إلغاء', style: 'cancel' },
      { text: 'تأكيد', onPress: () => updateStatus(next) },
    ]);
  };

  const openNavigation = () => {
    const lat = appt?.lat;
    const lng = appt?.lng;
    if (!lat || !lng) {
      Alert.alert('تنبيه', 'لا يوجد إحداثيات لهذا العقار');
      return;
    }
    const label = encodeURIComponent(appt?.title ?? 'الموعد');
    if (Platform.OS === 'android') {
      Linking.openURL(`google.navigation:q=${lat},${lng}&label=${label}`).catch(() =>
        Linking.openURL(`https://maps.google.com/maps?daddr=${lat},${lng}`)
      );
    } else {
      Linking.openURL(`maps://?daddr=${lat},${lng}`);
    }
  };

  if (loading) return (
    <View style={s.center}>
      <ActivityIndicator size="large" color="#1e40af" />
      <Text style={{ color: '#9ca3af', marginTop: 12, fontSize: 14 }}>جاري تحميل الموعد...</Text>
    </View>
  );

  if (error || !appt) return (
    <View style={s.center}>
      <Ionicons name="alert-circle-outline" size={48} color="#ef4444" />
      <Text style={{ color: '#ef4444', marginTop: 12, fontSize: 15, fontWeight: '700' }}>{error || 'الموعد غير موجود'}</Text>
      <TouchableOpacity style={s.retryBtn} onPress={load}>
        <Text style={{ color: '#fff', fontWeight: '700' }}>إعادة المحاولة</Text>
      </TouchableOpacity>
    </View>
  );

  const st = STATUS_MAP[appt.status];
  const dt = new Date(appt.scheduled_at);
  const timeStr = dt.toLocaleTimeString('ar-OM', { hour: '2-digit', minute: '2-digit' });
  const dateStr = dt.toLocaleDateString('ar-OM', { weekday: 'long', day: 'numeric', month: 'long' });
  const hasCoords = !!(appt.lat && appt.lng);

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#1e3a8a" />
        </TouchableOpacity>
        <Text style={s.headerTitle} numberOfLines={1}>{appt.title}</Text>
        <View style={[s.badge, { backgroundColor: st.bg }]}>
          <Text style={[s.badgeText, { color: st.fg }]}>{st.label}</Text>
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }}>

        {/* Date/Time */}
        <View style={s.section}>
          <View style={s.row}>
            <Ionicons name="calendar-outline" size={18} color="#6b7280" />
            <Text style={s.rowText}>{dateStr}</Text>
          </View>
          <View style={s.row}>
            <Ionicons name="time-outline" size={18} color="#6b7280" />
            <Text style={s.rowText}>{timeStr}</Text>
          </View>
        </View>

        {/* Navigation button — big & prominent */}
        {hasCoords && (
          <TouchableOpacity style={s.navBtn} onPress={openNavigation} activeOpacity={0.85}>
            <Ionicons name="navigate" size={24} color="#fff" />
            <Text style={s.navBtnText}>ابدأ الملاحة إلى الموقع</Text>
          </TouchableOpacity>
        )}

        {/* Customer Info */}
        {(appt.customer_name || appt.customer_phone) && (
          <View style={s.card}>
            <Text style={s.cardTitle}>بيانات الزبون</Text>
            {appt.customer_name && (
              <View style={s.row}>
                <Ionicons name="person-outline" size={16} color="#6b7280" />
                <Text style={s.rowText}>{appt.customer_name}</Text>
              </View>
            )}
            {appt.customer_phone && (
              <TouchableOpacity style={s.callBtn} onPress={() => Linking.openURL(`tel:${appt.customer_phone}`)}>
                <Ionicons name="call" size={18} color="#fff" />
                <Text style={s.callBtnText}>{appt.customer_phone}</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Property Info */}
        {(appt.property_code || appt.address) && (
          <View style={s.card}>
            <Text style={s.cardTitle}>بيانات العقار</Text>
            {appt.property_code && (
              <View style={s.row}>
                <Ionicons name="home-outline" size={16} color="#6b7280" />
                <Text style={s.rowText}>كود: {appt.property_code}</Text>
              </View>
            )}
            {appt.address && (
              <View style={s.row}>
                <Ionicons name="location-outline" size={16} color="#6b7280" />
                <Text style={s.rowText}>{appt.address}</Text>
              </View>
            )}
          </View>
        )}

        {/* Notes */}
        {(appt.description || appt.appt_notes) && (
          <View style={s.card}>
            <Text style={s.cardTitle}>ملاحظات</Text>
            <Text style={s.noteText}>{appt.description || appt.appt_notes}</Text>
          </View>
        )}

        {/* No coords notice */}
        {!hasCoords && (
          <View style={[s.card, { alignItems: 'center', paddingVertical: 20 }]}>
            <Ionicons name="map-outline" size={32} color="#d1d5db" />
            <Text style={{ color: '#9ca3af', marginTop: 8, fontSize: 13 }}>لا يوجد موقع لهذا العقار</Text>
          </View>
        )}

        {/* Status Actions */}
        {(appt.status === 'pending' || appt.status === 'in_progress') && (
          <View style={s.actionsRow}>
            {appt.status === 'pending' && (
              <TouchableOpacity style={s.btnStart} onPress={() => confirmStatus('in_progress', 'بدء الموعد')}>
                <Ionicons name="play" size={16} color="#fff" />
                <Text style={s.btnStartText}>ابدأ الموعد</Text>
              </TouchableOpacity>
            )}
            {appt.status === 'in_progress' && (
              <TouchableOpacity style={s.btnDone} onPress={() => confirmStatus('done', 'إتمام الموعد')}>
                <Ionicons name="checkmark-circle" size={16} color="#fff" />
                <Text style={s.btnDoneText}>إتمام ✓</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={s.btnCancel} onPress={() => confirmStatus('cancelled', 'إلغاء الموعد')}>
              <Ionicons name="close-circle" size={16} color="#991b1b" />
              <Text style={s.btnCancelText}>إلغاء</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f8fafc' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#f3f4f6',
  },
  backBtn: { padding: 4 },
  headerTitle: { flex: 1, fontSize: 15, fontWeight: '700', color: '#1e3a8a', textAlign: 'right' },
  badge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  section: {
    backgroundColor: '#fff', marginHorizontal: 16, marginTop: 16,
    borderRadius: 16, padding: 16, gap: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
  },
  card: {
    backgroundColor: '#fff', marginHorizontal: 16, marginTop: 12,
    borderRadius: 16, padding: 16, gap: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
  },
  cardTitle: { fontSize: 13, fontWeight: '700', color: '#374151', textAlign: 'right', marginBottom: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'flex-end' },
  rowText: { fontSize: 14, color: '#374151', textAlign: 'right', flex: 1 },
  noteText: { fontSize: 14, color: '#6b7280', textAlign: 'right', lineHeight: 22 },
  callBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'center',
    backgroundColor: '#16a34a', borderRadius: 12, padding: 12, marginTop: 4,
  },
  callBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  navBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: '#2563eb', borderRadius: 16, padding: 16,
    marginHorizontal: 16, marginTop: 14,
    shadowColor: '#2563eb', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 5,
  },
  navBtnText: { color: '#fff', fontWeight: '900', fontSize: 17 },
  retryBtn: {
    marginTop: 16, backgroundColor: '#1e40af', borderRadius: 12,
    paddingHorizontal: 24, paddingVertical: 12,
  },
  actionsRow: { flexDirection: 'row', gap: 10, marginHorizontal: 16, marginTop: 16 },
  btnStart: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, backgroundColor: '#2563eb', borderRadius: 12, padding: 14,
  },
  btnStartText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  btnDone: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, backgroundColor: '#16a34a', borderRadius: 12, padding: 14,
  },
  btnDoneText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  btnCancel: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, backgroundColor: '#fee2e2', borderRadius: 12, padding: 14, paddingHorizontal: 18,
  },
  btnCancelText: { color: '#991b1b', fontWeight: '700', fontSize: 14 },
});
