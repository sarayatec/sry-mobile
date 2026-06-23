import { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl, Alert, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import api from '../../src/services/api';
import { FieldAppointment, AppointmentStatus } from '../../src/types';

const STATUS_MAP: Record<AppointmentStatus, { label: string; fg: string; bg: string }> = {
  pending:     { label: 'قيد الانتظار', fg: '#92400e', bg: '#fef3c7' },
  in_progress: { label: 'جارٍ',          fg: '#1e40af', bg: '#dbeafe' },
  done:        { label: 'مكتمل ✓',      fg: '#065f46', bg: '#d1fae5' },
  cancelled:   { label: 'ملغي',          fg: '#991b1b', bg: '#fee2e2' },
};

type Tab = 'today' | 'upcoming' | 'all';

const TABS: { key: Tab; label: string }[] = [
  { key: 'today',    label: 'اليوم' },
  { key: 'upcoming', label: 'القادمة' },
  { key: 'all',      label: 'الكل' },
];

export default function AppointmentsScreen() {
  const router = useRouter();
  const [allList, setAllList] = useState<FieldAppointment[]>([]);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<Tab>('today');

  const load = useCallback(async () => {
    try {
      // جلب جميع المواعيد — الـ API يُرجع فقط مواعيد الموظف المسجّل دخوله
      const { data } = await api.get<FieldAppointment[]>('/mobile/appointments');
      setAllList(Array.isArray(data) ? data : []);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  // فلترة حسب التبويب
  const todayStr = new Date().toISOString().slice(0, 10);
  const list = allList.filter(a => {
    const dateStr = new Date(a.scheduled_at).toISOString().slice(0, 10);
    if (tab === 'today')    return dateStr === todayStr;
    if (tab === 'upcoming') return dateStr > todayStr && a.status !== 'cancelled';
    return true; // all
  });

  const updateStatus = async (id: number, status: AppointmentStatus) => {
    try {
      await api.patch(`/mobile/appointments/${id}`, { status });
      setAllList(prev => prev.map(a => a.id === id ? { ...a, status } : a));
    } catch { Alert.alert('خطأ', 'تعذّر تحديث الحالة، حاول مجدداً'); }
  };

  const confirm = (item: FieldAppointment, next: AppointmentStatus, label: string) =>
    Alert.alert(label, `"${item.title}" — هل تريد تغيير الحالة؟`, [
      { text: 'إلغاء', style: 'cancel' },
      { text: 'تأكيد', onPress: () => updateStatus(item.id, next) },
    ]);

  const renderItem = ({ item }: { item: FieldAppointment }) => {
    const st = STATUS_MAP[item.status];
    const dt = new Date(item.scheduled_at);
    const timeStr = dt.toLocaleTimeString('ar-OM', { hour: '2-digit', minute: '2-digit' });
    const dateStr = dt.toLocaleDateString('ar-OM', { weekday: 'short', day: 'numeric', month: 'short' });

    const openDetail = () =>
      router.push({ pathname: '/(app)/appointment/[id]', params: { id: String(item.id), data: JSON.stringify(item) } });

    return (
      <TouchableOpacity style={s.card} onPress={openDetail} activeOpacity={0.85}>
        <View style={s.cardTop}>
          <View style={[s.badge, { backgroundColor: st.bg }]}>
            <Text style={[s.badgeText, { color: st.fg }]}>{st.label}</Text>
          </View>
          <View style={{ flex: 1, alignItems: 'flex-end', marginLeft: 12 }}>
            <Text style={s.title} numberOfLines={2}>{item.title}</Text>
            {item.property_code && <Text style={s.code}>{item.property_code}</Text>}
          </View>
        </View>

        {item.customer_name && (
          <View style={s.infoRow}>
            <Text style={s.infoText}>{item.customer_name}</Text>
            <Ionicons name="person-outline" size={13} color="#6b7280" />
          </View>
        )}
        {item.address && (
          <View style={s.infoRow}>
            <Text style={s.infoText} numberOfLines={1}>{item.address}</Text>
            <Ionicons name="location-outline" size={13} color="#6b7280" />
          </View>
        )}
        {item.description && <Text style={s.desc} numberOfLines={2}>{item.description}</Text>}

        <View style={s.footer}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {item.status === 'pending' && (
              <TouchableOpacity onPress={() => confirm(item, 'in_progress', 'بدء الموعد')} style={s.btnBlue}>
                <Text style={s.btnBlueText}>ابدأ</Text>
              </TouchableOpacity>
            )}
            {item.status === 'in_progress' && (
              <TouchableOpacity onPress={() => confirm(item, 'done', 'إتمام الموعد')} style={s.btnGreen}>
                <Text style={s.btnGreenText}>إتمام ✓</Text>
              </TouchableOpacity>
            )}
            {(item.status === 'pending' || item.status === 'in_progress') && (
              <TouchableOpacity onPress={() => confirm(item, 'cancelled', 'إلغاء الموعد')} style={s.btnRed}>
                <Text style={s.btnRedText}>إلغاء</Text>
              </TouchableOpacity>
            )}
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={s.time}>{timeStr}</Text>
            <Text style={s.date}>{dateStr}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) return <View style={s.center}><ActivityIndicator size="large" color="#1e40af" /></View>;

  return (
    <View style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      {/* تبويبات */}
      <View style={s.tabs}>
        {TABS.map(t => (
          <TouchableOpacity key={t.key} onPress={() => setTab(t.key)}
            style={[s.tabBtn, tab === t.key && s.tabBtnActive]}>
            <Text style={[s.tabText, tab === t.key && s.tabTextActive]}>{t.label}</Text>
            {t.key === 'today' && allList.filter(a => new Date(a.scheduled_at).toISOString().slice(0,10) === todayStr && a.status === 'pending').length > 0 && (
              <View style={s.tabDot} />
            )}
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={list}
        keyExtractor={item => String(item.id)}
        renderItem={renderItem}
        contentContainerStyle={{ paddingTop: 14, paddingBottom: 30 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#1e40af" />}
        ListEmptyComponent={
          <View style={s.center}>
            <Ionicons name="calendar-outline" size={56} color="#d1d5db" />
            <Text style={s.emptyTitle}>
              {tab === 'today' ? 'لا توجد مواعيد اليوم' : tab === 'upcoming' ? 'لا توجد مواعيد قادمة' : 'لا توجد مواعيد'}
            </Text>
            <Text style={s.emptySub}>اسحب للأسفل للتحديث</Text>
          </View>
        }
      />
    </View>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  tabs: { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f3f4f6', paddingHorizontal: 16 },
  tabBtn: { flex: 1, alignItems: 'center', paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: 'transparent', position: 'relative' },
  tabBtnActive: { borderBottomColor: '#1e40af' },
  tabText: { fontSize: 13, fontWeight: '600', color: '#9ca3af' },
  tabTextActive: { color: '#1e40af', fontWeight: '700' },
  tabDot: { position: 'absolute', top: 8, right: 16, width: 7, height: 7, borderRadius: 4, backgroundColor: '#f97316' },
  card: { backgroundColor: '#fff', borderRadius: 20, marginHorizontal: 16, marginBottom: 12, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  badge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontSize: 12, fontWeight: '700' },
  title: { color: '#1e3a8a', fontWeight: '900', fontSize: 15, textAlign: 'right', lineHeight: 22 },
  code: { color: '#9ca3af', fontSize: 11, marginTop: 2 },
  infoRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginBottom: 4, gap: 4 },
  infoText: { color: '#6b7280', fontSize: 13, textAlign: 'right', flex: 1 },
  desc: { color: '#9ca3af', fontSize: 13, textAlign: 'right', marginBottom: 10, lineHeight: 20 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 10, borderTopWidth: 1, borderTopColor: '#f3f4f6', marginTop: 4 },
  btnBlue:  { backgroundColor: '#dbeafe', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  btnBlueText:  { color: '#1d4ed8', fontSize: 13, fontWeight: '700' },
  btnGreen: { backgroundColor: '#d1fae5', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  btnGreenText: { color: '#065f46', fontSize: 13, fontWeight: '700' },
  btnRed:   { backgroundColor: '#fee2e2', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  btnRedText:   { color: '#991b1b', fontSize: 13, fontWeight: '700' },
  time: { color: '#1e40af', fontWeight: '900', fontSize: 14 },
  date: { color: '#9ca3af', fontSize: 11 },
  emptyTitle: { color: '#9ca3af', marginTop: 16, fontSize: 15, fontWeight: '600' },
  emptySub:   { color: '#d1d5db', fontSize: 13, marginTop: 4 },
});
