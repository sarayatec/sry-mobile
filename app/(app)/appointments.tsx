import { useCallback, useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../../src/services/api';
import { FieldAppointment, AppointmentStatus } from '../../src/types';

const STATUS_MAP: Record<AppointmentStatus, { label: string; fg: string; bg: string }> = {
  pending:     { label: 'قيد الانتظار', fg: '#92400e', bg: '#fef3c7' },
  in_progress: { label: 'جارٍ',          fg: '#1e40af', bg: '#dbeafe' },
  done:        { label: 'مكتمل ✓',      fg: '#065f46', bg: '#d1fae5' },
  cancelled:   { label: 'ملغي',          fg: '#991b1b', bg: '#fee2e2' },
};

export default function AppointmentsScreen() {
  const [list, setList]           = useState<FieldAppointment[]>([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get<FieldAppointment[]>('/mobile/appointments?today=1');
      setList(data);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const updateStatus = async (id: number, status: AppointmentStatus) => {
    try {
      await api.patch(`/mobile/appointments/${id}`, { status });
      setList(prev => prev.map(a => (a.id === id ? { ...a, status } : a)));
    } catch {
      Alert.alert('خطأ', 'تعذّر تحديث الحالة، حاول مجدداً');
    }
  };

  const confirmStatus = (item: FieldAppointment, next: AppointmentStatus) => {
    const labels: Record<AppointmentStatus, string> = {
      pending: 'إعادة للانتظار',
      in_progress: 'بدء الموعد',
      done: 'إتمام الموعد',
      cancelled: 'إلغاء الموعد',
    };
    Alert.alert(labels[next], `"${item.title}" — هل تريد تغيير الحالة؟`, [
      { text: 'إلغاء', style: 'cancel' },
      { text: 'تأكيد', onPress: () => updateStatus(item.id, next) },
    ]);
  };

  const renderItem = ({ item }: { item: FieldAppointment }) => {
    const s = STATUS_MAP[item.status];
    const dt = new Date(item.scheduled_at);
    const timeStr = dt.toLocaleTimeString('ar-OM', { hour: '2-digit', minute: '2-digit' });
    const dateStr = dt.toLocaleDateString('ar-OM', { weekday: 'short', day: 'numeric', month: 'short' });

    return (
      <View className="bg-white rounded-3xl mx-4 mb-3 p-5 shadow-sm">
        {/* Top row */}
        <View className="flex-row justify-between items-start mb-3">
          <View className="rounded-full px-3 py-1.5" style={{ backgroundColor: s.bg }}>
            <Text className="text-xs font-bold" style={{ color: s.fg }}>{s.label}</Text>
          </View>
          <View className="items-end flex-1 mr-3">
            <Text className="text-blue-900 font-black text-base text-right leading-tight" numberOfLines={2}>
              {item.title}
            </Text>
            {item.property_code && (
              <Text className="text-gray-400 text-xs mt-0.5">{item.property_code}</Text>
            )}
          </View>
        </View>

        {/* Address */}
        {item.address && (
          <View className="flex-row items-center justify-end mb-2">
            <Text className="text-gray-600 text-sm text-right mr-1" numberOfLines={2}>
              {item.address}
            </Text>
            <Ionicons name="location-outline" size={13} color="#6b7280" />
          </View>
        )}

        {/* Description */}
        {item.description && (
          <Text className="text-gray-500 text-sm text-right mb-3 leading-relaxed">
            {item.description}
          </Text>
        )}

        {/* Footer */}
        <View className="flex-row items-center justify-between pt-3 border-t border-gray-100">
          {/* Action buttons */}
          <View className="flex-row gap-x-2">
            {item.status === 'pending' && (
              <TouchableOpacity
                onPress={() => confirmStatus(item, 'in_progress')}
                className="bg-blue-100 rounded-xl px-3.5 py-2"
              >
                <Text className="text-blue-700 text-xs font-bold">ابدأ</Text>
              </TouchableOpacity>
            )}
            {item.status === 'in_progress' && (
              <TouchableOpacity
                onPress={() => confirmStatus(item, 'done')}
                className="bg-green-100 rounded-xl px-3.5 py-2"
              >
                <Text className="text-green-700 text-xs font-bold">إتمام ✓</Text>
              </TouchableOpacity>
            )}
            {(item.status === 'pending' || item.status === 'in_progress') && (
              <TouchableOpacity
                onPress={() => confirmStatus(item, 'cancelled')}
                className="bg-red-50 rounded-xl px-3.5 py-2"
              >
                <Text className="text-red-500 text-xs font-bold">إلغاء</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Date & time */}
          <View className="items-end">
            <Text className="text-blue-800 font-black text-sm">{timeStr}</Text>
            <Text className="text-gray-400 text-xs">{dateStr}</Text>
          </View>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50">
        <ActivityIndicator size="large" color="#1e40af" />
      </View>
    );
  }

  return (
    <FlatList
      data={list}
      keyExtractor={item => String(item.id)}
      renderItem={renderItem}
      className="flex-1 bg-gray-50"
      contentContainerStyle={{ paddingTop: 14, paddingBottom: 30 }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#1e40af" />
      }
      ListEmptyComponent={
        <View className="items-center justify-center py-24">
          <Ionicons name="calendar-outline" size={56} color="#d1d5db" />
          <Text className="text-gray-400 mt-4 text-base font-medium">
            لا توجد مواعيد اليوم
          </Text>
          <Text className="text-gray-300 text-sm mt-1">
            اسحب للأسفل للتحديث
          </Text>
        </View>
      }
    />
  );
}
