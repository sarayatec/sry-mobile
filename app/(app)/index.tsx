import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView,
  Alert, ActivityIndicator, RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import api from '../../src/services/api';
import { useAuthStore } from '../../src/stores/authStore';
import {
  requestPermissions, startTracking, stopTracking, isTracking,
} from '../../src/services/location';
import { FieldAppointment } from '../../src/types';

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuthStore();

  const [tracking, setTracking]           = useState(false);
  const [toggling, setToggling]           = useState(false);
  const [lastPos, setLastPos]             = useState<Location.LocationObject | null>(null);
  const [todayTotal, setTodayTotal]       = useState(0);
  const [todayPending, setTodayPending]   = useState(0);
  const [refreshing, setRefreshing]       = useState(false);

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
    setToggling(true);
    try {
      if (tracking) {
        Alert.alert(
          'إيقاف الجلسة',
          'سيتوقف إرسال موقعك. هل أنت متأكد؟',
          [
            { text: 'إلغاء', style: 'cancel', onPress: () => setToggling(false) },
            {
              text: 'إيقاف', style: 'destructive',
              onPress: async () => {
                await stopTracking();
                setTracking(false);
                setToggling(false);
              },
            },
          ]
        );
      } else {
        const ok = await requestPermissions();
        if (!ok) {
          Alert.alert(
            'صلاحية مطلوبة',
            'اسمح لـ SRY Field بالوصول للموقع دائماً من إعدادات الجهاز.',
          );
          setToggling(false);
          return;
        }
        await startTracking();
        setTracking(true);
        setToggling(false);
      }
    } catch (e: any) {
      Alert.alert('خطأ', e.message);
      setToggling(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('تسجيل الخروج', 'هل تريد الخروج؟', [
      { text: 'إلغاء', style: 'cancel' },
      { text: 'خروج', style: 'destructive', onPress: logout },
    ]);
  };

  const onRefresh = async () => { setRefreshing(true); await refresh(); setRefreshing(false); };

  return (
    <ScrollView
      className="flex-1 bg-gray-50"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#1e40af" />}
    >
      {/* Header */}
      <View className="bg-blue-900 px-5 pb-10 pt-2">
        <View className="flex-row justify-between items-center">
          <TouchableOpacity onPress={handleLogout} hitSlop={12}>
            <Ionicons name="log-out-outline" size={22} color="#93c5fd" />
          </TouchableOpacity>
          <View className="items-end">
            <Text className="text-blue-300 text-xs mb-0.5">مرحباً،</Text>
            <Text className="text-white text-lg font-bold">{user?.name}</Text>
          </View>
        </View>

        <View className="flex-row items-center mt-3">
          <View
            className={`w-2.5 h-2.5 rounded-full mr-2 ${tracking ? 'bg-green-400' : 'bg-gray-500'}`}
          />
          <Text className="text-blue-200 text-sm">
            {tracking ? 'جلسة نشطة — موقعك يُرسل كل 30 ث' : 'لا توجد جلسة نشطة'}
          </Text>
        </View>
      </View>

      <View className="px-5 -mt-6 pb-8 gap-y-4">
        {/* Session toggle */}
        <TouchableOpacity
          onPress={handleToggle}
          disabled={toggling}
          activeOpacity={0.88}
          className={`rounded-3xl p-5 shadow-md flex-row items-center justify-between ${
            tracking ? 'bg-green-500' : 'bg-white'
          }`}
        >
          <View>
            <Text className={`text-xl font-black ${tracking ? 'text-white' : 'text-gray-800'}`}>
              {tracking ? 'جلسة نشطة' : 'ابدأ جلسة العمل'}
            </Text>
            <Text className={`text-sm mt-1 ${tracking ? 'text-green-100' : 'text-gray-400'}`}>
              {tracking ? 'اضغط لإيقاف التتبع' : 'سيُرسل موقعك للمشرف تلقائياً'}
            </Text>
          </View>
          {toggling
            ? <ActivityIndicator color={tracking ? '#fff' : '#1e40af'} />
            : <Ionicons
                name={tracking ? 'radio' : 'radio-outline'}
                size={36}
                color={tracking ? '#fff' : '#1e40af'}
              />
          }
        </TouchableOpacity>

        {/* Stats */}
        <View className="flex-row gap-x-3">
          <StatCard
            icon="calendar-outline"
            label="مواعيد اليوم"
            value={todayTotal}
            bg="bg-blue-50"
            textColor="text-blue-800"
            iconColor="#1e40af"
          />
          <StatCard
            icon="time-outline"
            label="قيد الانتظار"
            value={todayPending}
            bg="bg-amber-50"
            textColor="text-amber-800"
            iconColor="#d97706"
          />
        </View>

        {/* Last location */}
        {lastPos && (
          <View className="bg-white rounded-3xl p-4 shadow-sm">
            <View className="flex-row items-center mb-2">
              <Ionicons name="location" size={15} color="#3b82f6" />
              <Text className="text-gray-700 font-semibold text-sm mr-1.5">آخر موقع مسجَّل</Text>
            </View>
            <Text className="text-gray-500 text-xs font-mono" numberOfLines={1}>
              {lastPos.coords.latitude.toFixed(7)}, {lastPos.coords.longitude.toFixed(7)}
            </Text>
            {lastPos.coords.accuracy != null && (
              <Text className="text-gray-400 text-xs mt-0.5">
                الدقة ±{Math.round(lastPos.coords.accuracy)} م
              </Text>
            )}
          </View>
        )}

        {/* Admin badge */}
        {user?.role === 'admin' && (
          <View className="flex-row items-center bg-amber-50 border border-amber-200 rounded-3xl px-4 py-3.5">
            <Ionicons name="shield-checkmark" size={18} color="#b45309" />
            <Text className="text-amber-700 font-semibold text-sm mr-2">
              أنت مسؤول النظام — تظهر لك مواقع جميع الموظفين
            </Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

function StatCard({
  icon, label, value, bg, textColor, iconColor,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  value: number;
  bg: string;
  textColor: string;
  iconColor: string;
}) {
  return (
    <View className={`flex-1 rounded-3xl p-4 shadow-sm ${bg}`}>
      <Ionicons name={icon} size={20} color={iconColor} />
      <Text className={`text-3xl font-black mt-2 ${textColor}`}>{value}</Text>
      <Text className={`text-xs mt-0.5 opacity-70 ${textColor}`}>{label}</Text>
    </View>
  );
}
