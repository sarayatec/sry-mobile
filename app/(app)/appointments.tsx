import { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl, Alert, StyleSheet, Modal, ScrollView, Image, Dimensions, TextInput, KeyboardAvoidingView, Linking, Platform } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useNoteStore } from '../../src/stores/noteStore';
import * as Location from 'expo-location';
import { InAppNavModal } from '../../src/components/InAppNavModal';

const SCREEN_W = Dimensions.get('window').width;
import { Ionicons } from '@expo/vector-icons';
import api from '../../src/services/api';
import { FieldAppointment, AppointmentStatus } from '../../src/types';

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

interface PropertyDetail {
  id: number;
  title: string;
  property_code: string;
  location: string;
  image: string | null;
  images: string[];
  price: string | null;
  period: string | null;
  area: number | null;
  beds: number | null;
  baths: number | null;
  description: string | null;
  key_available: boolean;
  key_note: string | null;
  key_image: string | null;
  guard_number: string | null;
  owner_name: string | null;
  owner_number: string | null;
}

const STATUS_MAP: Record<AppointmentStatus, { label: string; fg: string; bg: string }> = {
  pending:     { label: 'قيد الانتظار', fg: '#92400e', bg: '#f3f4f6' },
  in_progress: { label: 'جارٍ',          fg: '#1e40af', bg: '#f3f4f6' },
  done:        { label: 'مكتمل ✓',      fg: '#065f46', bg: '#f3f4f6' },
  cancelled:   { label: 'ملغي',          fg: '#991b1b', bg: '#f3f4f6' },
};

type Tab = 'today' | 'upcoming' | 'all';

const TABS: { key: Tab; label: string }[] = [
  { key: 'today',    label: 'اليوم' },
  { key: 'upcoming', label: 'القادمة' },
  { key: 'all',      label: 'الكل' },
];


function Lightbox({ images, startIndex, onClose }: { images: string[]; startIndex: number; onClose: () => void }) {
  const [idx, setIdx] = useState(startIndex);
  const flatRef = useRef<FlatList>(null);

  useEffect(() => {
    setTimeout(() => {
      flatRef.current?.scrollToIndex({ index: startIndex, animated: false });
    }, 50);
  }, []);

  return (
    <Modal visible animationType="fade" transparent onRequestClose={onClose}>
      <View style={ps.lbOverlay}>
        {/* Header */}
        <View style={ps.lbHeader}>
          <Text style={ps.lbCount}>{idx + 1} / {images.length}</Text>
        </View>

        <FlatList
          ref={flatRef}
          data={images}
          keyExtractor={(_, i) => String(i)}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={startIndex}
          getItemLayout={(_, i) => ({ length: SCREEN_W, offset: SCREEN_W * i, index: i })}
          onMomentumScrollEnd={e => setIdx(Math.round(e.nativeEvent.contentOffset.x / SCREEN_W))}
          renderItem={({ item }) => (
            <View style={{ width: SCREEN_W, justifyContent: 'center', alignItems: 'center' }}>
              <Image
                source={{ uri: `https://sry.sarayatec.com${item}` }}
                style={{ width: SCREEN_W, height: SCREEN_W }}
                resizeMode="contain"
              />
            </View>
          )}
        />
        {images.length > 1 && (
          <View style={ps.dotsRow}>
            {images.map((_, i) => (
              <View key={i} style={[ps.dot, i === idx && ps.dotActive]} />
            ))}
          </View>
        )}

        {/* Close button bottom center */}
        <TouchableOpacity onPress={onClose} style={ps.lbCloseBtn} activeOpacity={0.8}>
          <Ionicons name="close" size={22} color="#fff" />
          <Text style={ps.lbCloseTxt}>إغلاق</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

function ImageCarousel({ images }: { images: string[] }) {
  const [idx, setIdx] = useState(0);
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const flatRef = useRef<FlatList>(null);

  if (images.length === 0) {
    return (
      <View style={ps.noImageBox}>
        <Ionicons name="image-outline" size={48} color="#d1d5db" />
        <Text style={{ color: '#9ca3af', marginTop: 6 }}>لا توجد صورة</Text>
      </View>
    );
  }

  return (
    <View>
      {lightboxIdx !== null && (
        <Lightbox images={images} startIndex={lightboxIdx} onClose={() => setLightboxIdx(null)} />
      )}
      <FlatList
        ref={flatRef}
        data={images}
        keyExtractor={(_, i) => String(i)}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        style={{ width: SCREEN_W }}
        onMomentumScrollEnd={e => setIdx(Math.round(e.nativeEvent.contentOffset.x / SCREEN_W))}
        renderItem={({ item, index }) => (
          <TouchableOpacity activeOpacity={0.95} onPress={() => setLightboxIdx(index)} style={{ width: SCREEN_W }}>
            <Image
              source={{ uri: `https://sry.sarayatec.com${item}` }}
              style={ps.image}
              resizeMode="cover"
            />
          </TouchableOpacity>
        )}
      />
      {images.length > 1 && (
        <View style={ps.dotsRow}>
          {images.map((_, i) => (
            <View key={i} style={[ps.dot, i === idx && ps.dotActive]} />
          ))}
        </View>
      )}
    </View>
  );
}

function PropertySheet({ code, onClose }: { code: string; onClose: () => void }) {
  const [prop, setProp] = useState<PropertyDetail | null>(null);
  const [loadingProp, setLoadingProp] = useState(true);

  useEffect(() => {
    api.get<PropertyDetail>(`/mobile/property/${code}`)
      .then(r => setProp(r.data))
      .catch(() => {})
      .finally(() => setLoadingProp(false));
  }, [code]);

  const allImages = prop
    ? (prop.images.length > 0 ? prop.images : (prop.image ? [prop.image] : []))
    : [];

  return (
    <Modal visible animationType="fade" transparent statusBarTranslucent onRequestClose={onClose}>
      <View style={ps.overlay}>
        <View style={ps.sheet}>
          <TouchableOpacity onPress={onClose} activeOpacity={0.7} style={ps.handleArea}>
            <View style={ps.sheetHandle} />
          </TouchableOpacity>
          <TouchableOpacity style={ps.closeBtn} onPress={onClose}>
            <Ionicons name="close" size={22} color="#6b7280" />
          </TouchableOpacity>

          {loadingProp ? (
            <View style={ps.center}><ActivityIndicator size="large" color="#1e40af" /></View>
          ) : !prop ? (
            <View style={ps.center}><Text style={ps.noData}>لم يتم العثور على بيانات العقار</Text></View>
          ) : (
            <>
              <ImageCarousel images={allImages} />
            <ScrollView showsVerticalScrollIndicator={false}>

              <View style={ps.body}>
                {/* Code badge + title */}
                <View style={ps.row}>
                  <Text style={ps.code}>{prop.property_code}</Text>
                </View>
                <Text style={ps.title}>{prop.title}</Text>

                {prop.location ? (
                  <View style={ps.infoRow}>
                    <Text style={ps.infoVal}>{prop.location}</Text>
                    <Ionicons name="location-outline" size={14} color="#6b7280" />
                  </View>
                ) : null}

                {/* Price */}
                {prop.price ? (
                  <View style={ps.infoRow}>
                    <Text style={ps.infoVal}>{prop.price}{prop.period ? ` / ${prop.period}` : ''}</Text>
                    <Ionicons name="cash-outline" size={14} color="#6b7280" />
                  </View>
                ) : null}

                {/* Stats row */}
                {(prop.area || prop.beds || prop.baths) ? (
                  <View style={ps.statsRow}>
                    {prop.area ? <View style={ps.statBox}><Text style={ps.statVal}>{prop.area}</Text><Text style={ps.statLabel}>م²</Text></View> : null}
                    {prop.beds ? <View style={ps.statBox}><Text style={ps.statVal}>{prop.beds}</Text><Text style={ps.statLabel}>غرفة</Text></View> : null}
                    {prop.baths ? <View style={ps.statBox}><Text style={ps.statVal}>{prop.baths}</Text><Text style={ps.statLabel}>حمام</Text></View> : null}
                  </View>
                ) : null}

                {/* Key */}
                <View style={[ps.keyBox, { backgroundColor: prop.key_available ? '#dcfce7' : '#fee2e2' }]}>
                  <Ionicons name="key-outline" size={18} color={prop.key_available ? '#16a34a' : '#991b1b'} />
                  <Text style={[ps.keyText, { color: prop.key_available ? '#16a34a' : '#991b1b' }]}>
                    {prop.key_available ? 'المفتاح متوفر' : 'المفتاح غير متوفر'}
                  </Text>
                  {prop.key_note ? <Text style={ps.keyNote}>{prop.key_note}</Text> : null}
                </View>

                {prop.guard_number ? (
                  <TouchableOpacity
                    style={ps.guardBtn}
                    onPress={() => Linking.openURL(`tel:${prop.guard_number}`).catch(() => Alert.alert('تنبيه', 'تعذر فتح الاتصال'))}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="shield-outline" size={16} color="#7c3aed" />
                    <Text style={ps.guardText}>حارس: {prop.guard_number}</Text>
                    <Ionicons name="call" size={14} color="#7c3aed" />
                  </TouchableOpacity>
                ) : null}

                {prop.key_image ? (
                  <Image
                    source={{ uri: `https://sry.sarayatec.com${prop.key_image}` }}
                    style={ps.keyImage}
                    resizeMode="contain"
                  />
                ) : null}

                {/* Description */}
                {prop.description ? (
                  <View style={ps.descBox}>
                    <Text style={ps.descLabel}>الوصف</Text>
                    <Text style={ps.descText}>{prop.description}</Text>
                  </View>
                ) : null}
              </View>
            </ScrollView>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

export default function AppointmentsScreen() {
  const router = useRouter();
  const setPendingCustomer = useNoteStore(s => s.setPendingCustomer);
  const [allList, setAllList] = useState<FieldAppointment[]>([]);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<Tab>('today');
  const [selectedPropertyCode, setSelectedPropertyCode] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<FieldAppointment | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [callSheet, setCallSheet] = useState<{ name: string; phone: string }[] | null>(null);
  const [commentTarget, setCommentTarget] = useState<FieldAppointment | null>(null);
  const [commentText, setCommentText] = useState('');
  const [commentSending, setCommentSending] = useState(false);
  const [userPos, setUserPos] = useState<{ lat: number; lng: number } | null>(null);
  const [coordsMap, setCoordsMap] = useState<Record<string, { lat: number | null; lng: number | null; owner_name: string | null; price: string | null; landmark_name: string | null; landmark_lat: number | null; landmark_lng: number | null; image: string | null }>>({});
  const [navSession, setNavSession] = useState<{
    appointment: FieldAppointment;
    properties: Array<{ code: string; dist: number | null; coords: { lat: number; lng: number } | null; landmark: { name: string; lat: number; lng: number } | null }>;
    index: number;
    phase: 'navigating' | 'arrived';
    notes: Array<{ code: string; note: string }>;
  } | null>(null);
  const [navComment, setNavComment] = useState('');
  const [inAppNav, setInAppNav] = useState<{ lat: number; lng: number; title: string } | null>(null);
  const [keyModal, setKeyModal] = useState<{ code: string; prop: PropertyDetail | null; loading: boolean; uploading: boolean } | null>(null);

  const openKeyModal = async (code: string) => {
    setKeyModal({ code, prop: null, loading: true, uploading: false });
    try {
      const { data } = await api.get<PropertyDetail>(`/mobile/property/${code}`);
      setKeyModal(m => m ? { ...m, prop: data, loading: false } : null);
    } catch {
      setKeyModal(m => m ? { ...m, loading: false } : null);
    }
  };

  const takeKeyPhoto = async () => {
    if (!keyModal) return;
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') { Alert.alert('تنبيه', 'يجب السماح بالكاميرا'); return; }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 });
    if (result.canceled || !result.assets?.[0]) return;
    const uri = result.assets[0].uri;
    setKeyModal(m => m ? { ...m, uploading: true } : null);
    try {
      const form = new FormData();
      form.append('key_image', { uri, name: 'key.jpg', type: 'image/jpeg' } as any);
      const { data } = await api.post(`/mobile/property/${keyModal.code}/key-image`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setKeyModal(m => m ? { ...m, uploading: false, prop: m.prop ? { ...m.prop, key_image: data.key_image } : null } : null);
      Alert.alert('تم', 'تم رفع صورة المفتاح بنجاح');
    } catch {
      setKeyModal(m => m ? { ...m, uploading: false } : null);
      Alert.alert('خطأ', 'تعذر رفع الصورة');
    }
  };

  const load = useCallback(async () => {
    try {
      const { data } = await api.get<FieldAppointment[]>('/mobile/appointments');
      const list = Array.isArray(data) ? data : [];
      setAllList(list);

      // Collect all unique property codes and fetch their coords
      const allCodes = [...new Set(list.flatMap(a => a.property_codes?.length ? a.property_codes : (a.property_code ? [a.property_code] : [])))];
      if (allCodes.length) {
        const { data: coords } = await api.post<Record<string, { lat: number; lng: number }>>('/mobile/property-coords', { codes: allCodes });
        setCoordsMap(coords);
      }
    } catch {}
    setLoading(false);
  }, []);

  // Get user location once
  useEffect(() => {
    let sub: Location.LocationSubscription | null = null;
    Location.requestForegroundPermissionsAsync().then(async ({ status }) => {
      if (status !== 'granted') return;
      const setPos = (pos: Location.LocationObject) =>
        setUserPos({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      try {
        const last = await Location.getLastKnownPositionAsync();
        if (last) setPos(last);
      } catch {}
      sub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, timeInterval: 3000, distanceInterval: 0 },
        setPos,
      );
    });
    return () => { sub?.remove(); };
  }, []);

  useEffect(() => { load(); }, [load]);
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  // Auto-reload when internet comes back
  const wasOfflineAppt = useRef(false);
  useEffect(() => {
    const unsub = NetInfo.addEventListener(state => {
      const connected = !!(state.isConnected && state.isInternetReachable !== false);
      if (connected && wasOfflineAppt.current) {
        wasOfflineAppt.current = false;
        load();
      } else if (!connected) {
        wasOfflineAppt.current = true;
      }
    });
    return () => unsub();
  }, [load]);

  const todayStr = new Date().toISOString().slice(0, 10);
  const list = allList.filter(a => {
    if (a.status === 'cancelled') return false;
    const dateStr = new Date(a.scheduled_at).toISOString().slice(0, 10);
    if (tab === 'today')    return dateStr === todayStr;
    if (tab === 'upcoming') return dateStr > todayStr;
    return true;
  });

  const updateStatus = async (id: number, status: AppointmentStatus, reason?: string) => {
    try {
      await api.patch(`/mobile/appointments/${id}`, { status, cancel_reason: reason || null });
      if (status === 'cancelled') {
        setAllList(prev => prev.filter(a => String(a.id) !== String(id)));
      } else {
        setAllList(prev => prev.map(a => String(a.id) === String(id) ? { ...a, status } : a));
      }
    } catch { Alert.alert('خطأ', 'تعذّر تحديث الحالة، حاول مجدداً'); }
  };

  const confirm = (item: FieldAppointment, next: AppointmentStatus, label: string) => {
    if (next === 'cancelled') {
      setCancelReason('');
      setCancelTarget(item);
      return;
    }
    Alert.alert(label, `"${item.title}" — هل تريد تغيير الحالة؟`, [
      { text: 'إلغاء', style: 'cancel' },
      { text: 'تأكيد', onPress: () => updateStatus(item.id, next) },
    ]);
  };

  const submitCancel = async () => {
    if (!cancelReason.trim()) { Alert.alert('تنبيه', 'يرجى كتابة سبب الإلغاء'); return; }
    if (!cancelTarget) return;
    await updateStatus(cancelTarget.id as number, 'cancelled', cancelReason.trim());
    setCancelTarget(null);
    setCancelReason('');
  };

  const submitComment = async () => {
    if (!commentText.trim()) { Alert.alert('تنبيه', 'يرجى كتابة تعليق'); return; }
    if (!commentTarget) return;
    setCommentSending(true);
    try {
      const codes = commentTarget.property_codes || [];
      const commentVal = codes.length > 0
        ? JSON.stringify(Object.fromEntries(codes.map((c: string) => [c, commentText.trim()])))
        : commentText.trim();
      await api.patch(`/appointments/${commentTarget.id}/comment`, { visit_comment: commentVal });
      setAllList(prev => prev.map(a => String(a.id) === String(commentTarget.id) ? { ...a, visit_comment: commentVal } as any : a));
      setCommentTarget(null);
      setCommentText('');
    } catch { Alert.alert('خطأ', 'تعذّر إرسال التعليق، حاول مجدداً'); }
    setCommentSending(false);
  };

  const startNavSession = (item: FieldAppointment) => {
    const codes = item.property_codes?.length
      ? item.property_codes
      : (item.property_code ? [item.property_code] : []);
    if (!codes.length) return;
    const properties = codes.map(code => {
      const entry = coordsMap[code] || null;
      const c = (entry && entry.lat != null && entry.lng != null) ? { lat: entry.lat, lng: entry.lng } : null;
      const dist = (userPos && c) ? haversineKm(userPos.lat, userPos.lng, c.lat, c.lng) : null;
      const landmark = (entry?.landmark_name && entry?.landmark_lat && entry?.landmark_lng)
        ? { name: entry.landmark_name, lat: entry.landmark_lat, lng: entry.landmark_lng } : null;
      return { code, dist, coords: c, landmark };
    }).sort((a, b) => {
      if (a.dist === null) return 1;
      if (b.dist === null) return -1;
      return a.dist - b.dist;
    });
    setNavSession({ appointment: item, properties, index: 0, phase: 'navigating', notes: [] });
    setNavComment('');
    if (item.status === 'pending') updateStatus(item.id as number, 'in_progress');
  };

  const completeProperty = async () => {
    if (!navSession) return;
    const { appointment, properties, index, notes } = navSession;
    const newNotes = [...notes, { code: properties[index].code, note: navComment.trim() }];
    if (index + 1 >= properties.length) {
      await updateStatus(appointment.id as number, 'done');
      setNavSession(null);
      setNavComment('');
    } else {
      setNavSession({ ...navSession, index: index + 1, phase: 'navigating', notes: newNotes });
      setNavComment('');
    }
  };

  const renderItem = ({ item }: { item: FieldAppointment }) => {
    const st = STATUS_MAP[item.status];
    const dt = new Date(item.scheduled_at);
    const timeStr = dt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    const dateStr = dt.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' });

    const customers = item.customers && item.customers.length > 0
      ? item.customers
      : (item.customer_name || item.customer_phone)
        ? [{ name: item.customer_name || '', phone: item.customer_phone || '' }]
        : [];
    const multiCustomer = customers.length > 1;

    const CATEGORY_MAP: Record<string, { label: string; icon: string; bg: string; fg: string }> = {
      owner: { label: 'مالك',  icon: '👤', bg: '#f3f4f6', fg: '#6b7280' },
      key:   { label: 'مفتاح', icon: '🔑', bg: '#f3f4f6', fg: '#6b7280' },
      board: { label: 'لوحة',  icon: '🪧', bg: '#f3f4f6', fg: '#6b7280' },
      photo: { label: 'تصوير', icon: '📷', bg: '#f3f4f6', fg: '#6b7280' },
    };
    const cat = item.appt_category ? CATEGORY_MAP[item.appt_category] : null;

    return (
      <View style={s.card}>
        <View style={s.cardTop}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={[s.badge, { backgroundColor: st.bg }]}>
              <Text style={[s.badgeText, { color: st.fg }]}>{st.label}</Text>
            </View>
            {customers.length > 0 && (
              <TouchableOpacity
                onPress={() => {
                  if (multiCustomer) {
                    setCallSheet(customers);
                  } else {
                    const phone = customers[0].phone;
                    phone
                      ? Linking.openURL(`tel:${phone}`).catch(() => Alert.alert('تنبيه', 'تعذر فتح الاتصال'))
                      : Alert.alert('تنبيه', 'لا يوجد رقم هاتف');
                  }
                }}
                style={[s.callBtn, multiCustomer && { backgroundColor: '#f3f4f6' }]}
                activeOpacity={0.7}
              >
                <Ionicons name="call" size={16} color={multiCustomer ? '#374151' : '#111827'} />
                {multiCustomer && (
                  <Text style={{ fontSize: 10, fontWeight: '700', color: '#374151', marginLeft: 2 }}>
                    {customers.length}
                  </Text>
                )}
              </TouchableOpacity>
            )}
            {customers.length > 0 && customers[0].phone ? (
              <TouchableOpacity
                onPress={() => {
                  const raw = customers[0].phone.replace(/\D/g, '');
                  const phone = raw.startsWith('968') ? raw : `968${raw}`;
                  Linking.openURL(`https://wa.me/${phone}`).catch(() =>
                    Alert.alert('تنبيه', 'تعذر فتح واتساب')
                  );
                }}
                style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center' }}
                activeOpacity={0.7}
              >
                <Ionicons name="logo-whatsapp" size={17} color="#6b7280" />
              </TouchableOpacity>
            ) : null}
          </View>
          <View style={{ flex: 1, alignItems: 'flex-end', marginLeft: 8 }}>
            <Text style={s.title} numberOfLines={1}>{item.title}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
              <Text style={s.time}>{timeStr}</Text>
              <Text style={s.date}>{dateStr}</Text>
            </View>
            {item.created_by && (
              <Text style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>📋 أعطاه: {item.created_by}</Text>
            )}
            {cat && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 3, backgroundColor: cat.bg, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8, alignSelf: 'flex-end' }}>
                <Text style={{ fontSize: 10 }}>{cat.icon}</Text>
                <Text style={{ fontSize: 10, fontWeight: '700', color: cat.fg }}>موعد {cat.label}</Text>
              </View>
            )}
          </View>
        </View>
        {item.address && (
          <View style={s.infoRow}>
            <Text style={s.infoText} numberOfLines={1}>{item.address}</Text>
            <Ionicons name="location-outline" size={13} color="#6b7280" />
          </View>
        )}
        {item.description && <Text style={s.desc} numberOfLines={2}>{item.description}</Text>}

        {/* Property thumbnails — sorted by distance, tap to open detail sheet */}
        {(() => {
          const codes = item.property_codes?.length ? item.property_codes : (item.property_code ? [item.property_code] : []);
          if (!codes.length) return null;

          const withDist = codes.map(code => {
            const entry = coordsMap[code];
            const c = (entry && entry.lat != null && entry.lng != null) ? entry : null;
            const dist = (userPos && c) ? haversineKm(userPos.lat, userPos.lng, c.lat, c.lng) : null;
            return { code, dist, image: entry?.image || null };
          }).sort((a, b) => {
            if (a.dist === null) return 1;
            if (b.dist === null) return -1;
            return a.dist - b.dist;
          });

          return (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
              {withDist.map(({ code, dist, image }) => {
                const distStr = dist === null ? null : dist < 1 ? `${Math.round(dist * 1000)} م` : `${dist.toFixed(1)} كم`;
                return (
                  <TouchableOpacity
                    key={code}
                    onPress={() => setSelectedPropertyCode(code)}
                    activeOpacity={0.8}
                    style={{ alignItems: 'center', gap: 4 }}
                  >
                    <View style={{ width: 64, height: 64, borderRadius: 12, overflow: 'hidden', borderWidth: 1.5, borderColor: '#e5e7eb', backgroundColor: '#f3f4f6' }}>
                      {image
                        ? <Image source={{ uri: image }} style={{ width: 64, height: 64 }} resizeMode="cover" />
                        : <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                            <Ionicons name="home-outline" size={26} color="#d1d5db" />
                          </View>
                      }
                      <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.48)', paddingVertical: 2 }}>
                        <Text style={{ color: '#fff', fontSize: 8, fontWeight: '700', textAlign: 'center' }} numberOfLines={1}>{coordsMap[code]?.owner_name || code}</Text>
                      </View>
                    </View>
                    {distStr && <Text style={{ fontSize: 10, fontWeight: '600', color: '#6b7280' }}>{distStr}</Text>}
                  </TouchableOpacity>
                );
              })}
            </View>
          );
        })()}

        {/* Navigation button */}
        {(item.status === 'pending' || item.status === 'in_progress') &&
          (item.property_codes?.length || item.property_code) && (
          <TouchableOpacity style={s.navBtn} onPress={() => startNavSession(item)} activeOpacity={0.85}>
            <Ionicons name="navigate" size={16} color="#fff" />
            <Text style={s.navBtnText}>ابدأ الملاحة</Text>
          </TouchableOpacity>
        )}

        {/* Existing comment */}
        {(item as any).visit_comment ? (
          <View style={{ backgroundColor: '#f3f4f6', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, padding: 8, marginBottom: 8, flexDirection: 'row', alignItems: 'flex-start', gap: 6 }}>
            <Ionicons name="chatbubble-outline" size={14} color="#6b7280" style={{ marginTop: 1 }} />
            <Text style={{ fontSize: 12, color: '#374151', flex: 1, textAlign: 'right' }}>{(item as any).visit_comment}</Text>
          </View>
        ) : null}

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
            <TouchableOpacity
              onPress={() => { setCommentTarget(item); setCommentText((item as any).visit_comment || ''); }}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#f3f4f6', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: '#e5e7eb' }}
              activeOpacity={0.8}
            >
              <Ionicons name="chatbubble-outline" size={16} color="#6b7280" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                const c = customers[0] || { name: '', phone: '' };
                setPendingCustomer({ name: c.name, phone: c.phone });
                router.navigate('/(app)/notes');
              }}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#f3f4f6', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: '#e5e7eb' }}
              activeOpacity={0.8}
            >
              <Ionicons name="document-text-outline" size={16} color="#6b7280" />
            </TouchableOpacity>
            {(() => {
              const codes = item.property_codes?.length ? item.property_codes : (item.property_code ? [item.property_code] : []);
              if (!codes.length) return null;
              return (
                <TouchableOpacity
                  onPress={() => openKeyModal(codes[0])}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#f3f4f6', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: '#e5e7eb' }}
                  activeOpacity={0.8}
                >
                  <Text style={{ fontSize: 16 }}>🔑</Text>
                </TouchableOpacity>
              );
            })()}
          </View>
        </View>
      </View>
    );
  };

  if (loading) return <View style={s.center}><ActivityIndicator size="large" color="#1e40af" /></View>;

  return (
    <View style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      {selectedPropertyCode && (
        <PropertySheet code={selectedPropertyCode} onClose={() => setSelectedPropertyCode(null)} />
      )}

      {/* Call Sheet Modal */}
      <Modal visible={!!callSheet} transparent animationType="slide" statusBarTranslucent onRequestClose={() => setCallSheet(null)}>
        <View style={cs.overlay}>
          <View style={cs.sheet}>
            <View style={cs.handle} />
            <Text style={cs.title}>اتصال بالزبائن</Text>
            {(callSheet || []).map((c, i) => (
              <View key={i} style={cs.row}>
                <View style={cs.customerInfo}>
                  <Text style={cs.customerName}>{c.name || `زبون ${i + 1}`}</Text>
                  {c.phone ? <Text style={cs.customerPhone}>{c.phone}</Text> : null}
                </View>
                <TouchableOpacity
                  style={[cs.callBtn, !c.phone && cs.callBtnDisabled]}
                  onPress={() => c.phone
                    ? Linking.openURL(`tel:${c.phone}`).catch(() => Alert.alert('تنبيه', 'تعذر فتح الاتصال'))
                    : Alert.alert('تنبيه', 'لا يوجد رقم هاتف')}
                  activeOpacity={0.8}
                >
                  <Ionicons name="call" size={18} color={c.phone ? '#fff' : '#9ca3af'} />
                </TouchableOpacity>
              </View>
            ))}
            <TouchableOpacity style={cs.closeBtn} onPress={() => setCallSheet(null)}>
              <Text style={cs.closeTxt}>إغلاق</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Cancel reason modal */}
      <Modal visible={!!cancelTarget} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setCancelTarget(null)}>
        <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
          <View style={s.cancelOverlay}>
            <View style={s.cancelBox}>
              <Text style={s.cancelTitle}>سبب الإلغاء</Text>
              <Text style={s.cancelSub}>يرجى كتابة سبب إلغاء الموعد</Text>
              <TextInput
                style={s.cancelInput}
                value={cancelReason}
                onChangeText={setCancelReason}
                placeholder="اكتب السبب هنا..."
                placeholderTextColor="#9ca3af"
                multiline
                numberOfLines={3}
                textAlign="right"
                autoFocus
              />
              <View style={s.cancelActions}>
                <TouchableOpacity style={s.cancelBtnNo} onPress={() => setCancelTarget(null)}>
                  <Text style={s.cancelBtnNoTxt}>رجوع</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.cancelBtnYes} onPress={submitCancel}>
                  <Text style={s.cancelBtnYesTxt}>تأكيد الإلغاء</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
      {/* Comment modal */}
      <Modal visible={!!commentTarget} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setCommentTarget(null)}>
        <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
          <View style={s.cancelOverlay}>
            <View style={s.cancelBox}>
              <Text style={s.cancelTitle}>تعليق على الموعد</Text>
              <Text style={s.cancelSub}>{commentTarget?.title}</Text>
              <TextInput
                style={s.cancelInput}
                value={commentText}
                onChangeText={setCommentText}
                placeholder="اكتب تعليقك هنا..."
                placeholderTextColor="#9ca3af"
                multiline
                numberOfLines={3}
                textAlign="right"
                autoFocus
              />
              <View style={s.cancelActions}>
                <TouchableOpacity style={s.cancelBtnNo} onPress={() => setCommentTarget(null)}>
                  <Text style={s.cancelBtnNoTxt}>إلغاء</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.cancelBtnYes, { backgroundColor: '#b45309' }]} onPress={submitComment} disabled={commentSending}>
                  <Text style={s.cancelBtnYesTxt}>{commentSending ? 'جاري الإرسال...' : 'إرسال 💬'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

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

      {/* Navigation Session Modal */}
      <Modal visible={!!navSession} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setNavSession(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <View style={ns.overlay}>
            <View style={ns.sheet}>
              <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1 }}>
              {navSession && (() => {
                const { properties, index, phase, appointment } = navSession;
                const total = properties.length;
                const current = properties[index];
                const isLast = index + 1 >= total;
                return (
                  <>
                    {/* Header */}
                    <View style={ns.header}>
                      <Text style={ns.headerTitle}>
                        {phase === 'navigating' ? 'التنقل للعقار' : 'تسجيل الزيارة'}
                      </Text>
                      <Text style={ns.headerSub}>{appointment.title}</Text>
                    </View>

                    {/* Progress */}
                    <View style={ns.progressWrap}>
                      <View style={ns.progressBar}>
                        <View style={[ns.progressFill, { width: `${((index) / total) * 100}%` }]} />
                      </View>
                      <Text style={ns.progressText}>عقار {index + 1} من {total}</Text>
                    </View>

                    {/* Property Code & Distance */}
                    <View style={ns.propRow}>
                      <View style={ns.propCode}>
                        <Ionicons name="business" size={16} color="#2563eb" />
                        <Text style={ns.propCodeText}>{current.code}</Text>
                      </View>
                      {current.dist !== null && (
                        <View style={ns.distBadge}>
                          <Ionicons name="location" size={13} color="#16a34a" />
                          <Text style={ns.distText}>
                            {current.dist < 1 ? `${Math.round(current.dist * 1000)} م` : `${current.dist.toFixed(1)} كم`}
                          </Text>
                        </View>
                      )}
                    </View>

                    {phase === 'navigating' ? (
                      <>
                        {/* In-app navigation */}
                        {current.coords ? (
                          <TouchableOpacity
                            style={ns.mapsBtn}
                            activeOpacity={0.85}
                            onPress={() => {
                              const { lat, lng } = current.coords!;
                              const label = encodeURIComponent(current.code || 'العقار');
                              Linking.openURL(`google.navigation:q=${lat},${lng}&mode=d`)
                                .catch(() => Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`).catch(() => {}));
                            }}
                          >
                            <Ionicons name="navigate" size={18} color="#fff" />
                            <Text style={ns.mapsBtnText}>ابدأ الملاحة</Text>
                          </TouchableOpacity>
                        ) : (
                          <View style={ns.noCoordBox}>
                            <Ionicons name="location-outline" size={20} color="#f97316" />
                            <Text style={ns.noCoordText}>لا توجد إحداثيات لهذا العقار{'\n'}يرجى إضافة الموقع من لوحة الإدارة</Text>
                          </View>
                        )}
                        {/* Share fake location with customer */}
                        {current.landmark && (
                          <TouchableOpacity
                            style={ns.shareBtn}
                            activeOpacity={0.85}
                            onPress={() => {
                              const { lat, lng, name } = current.landmark!;
                              const mapsLink = `https://www.google.com/maps?q=${lat},${lng}`;
                              const msg = `مرحباً، موقع العقار قريب من: ${name}\n${mapsLink}`;
                              const phone = appointment.customer_phone?.replace(/\D/g,'');
                              const wa = phone ? `https://wa.me/${phone.startsWith('968') ? phone : '968'+phone}?text=${encodeURIComponent(msg)}` : `https://wa.me/?text=${encodeURIComponent(msg)}`;
                              Linking.openURL(wa).catch(() => Alert.alert('تنبيه', 'تعذر فتح واتساب'));
                            }}
                          >
                            <Ionicons name="share-social" size={16} color="#fff" />
                            <Text style={ns.shareBtnText}>شارك الموقع مع الزبون</Text>
                          </TouchableOpacity>
                        )}
                        {/* Arrived */}
                        <TouchableOpacity
                          style={ns.arrivedBtn}
                          activeOpacity={0.85}
                          onPress={() => setNavSession(prev => prev ? { ...prev, phase: 'arrived' } : prev)}
                        >
                          <Ionicons name="checkmark-circle" size={18} color="#fff" />
                          <Text style={ns.arrivedBtnText}>تم الوصول</Text>
                        </TouchableOpacity>
                      </>
                    ) : (
                      <>
                        {/* Comment */}
                        <Text style={ns.commentLabel}>تعليق على الزيارة (اختياري)</Text>
                        <TextInput
                          style={ns.commentInput}
                          value={navComment}
                          onChangeText={setNavComment}
                          placeholder="أضف ملاحظة..."
                          placeholderTextColor="#9ca3af"
                          multiline
                          numberOfLines={3}
                          textAlign="right"
                          textAlignVertical="top"
                        />
                        {/* Complete */}
                        <TouchableOpacity style={ns.doneBtn} activeOpacity={0.85} onPress={completeProperty}>
                          <Ionicons name="checkmark-done-circle" size={18} color="#fff" />
                          <Text style={ns.doneBtnText}>
                            {isLast ? 'تم اكتمال الموعد ✓' : `تم اكتمال — التالي: ${properties[index + 1].code}`}
                          </Text>
                        </TouchableOpacity>
                      </>
                    )}

                    {/* Close */}
                    <TouchableOpacity style={ns.closeBtn} onPress={() => setNavSession(null)}>
                      <Text style={ns.closeBtnText}>إغلاق الجولة</Text>
                    </TouchableOpacity>
                  </>
                );
              })()}
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Key Modal */}
      <Modal visible={!!keyModal} transparent animationType="slide" statusBarTranslucent onRequestClose={() => setKeyModal(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 36, maxHeight: '80%' }}>
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: '#d1d5db', alignSelf: 'center', marginBottom: 16 }} />
            <Text style={{ fontSize: 17, fontWeight: '900', color: '#1e3a8a', textAlign: 'right', marginBottom: 16 }}>🔑 معلومات المفتاح</Text>
            {keyModal?.loading ? (
              <View style={{ alignItems: 'center', paddingVertical: 40 }}><ActivityIndicator size="large" color="#1e40af" /></View>
            ) : keyModal?.prop ? (
              <ScrollView showsVerticalScrollIndicator={false}>
                {/* Key status */}
                <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, padding: 14, marginBottom: 14 }, { backgroundColor: keyModal.prop.key_available ? '#dcfce7' : '#fee2e2' }]}>
                  <Ionicons name="key-outline" size={20} color={keyModal.prop.key_available ? '#16a34a' : '#991b1b'} />
                  <View style={{ flex: 1, alignItems: 'flex-end' }}>
                    <Text style={{ fontWeight: '800', fontSize: 15, color: keyModal.prop.key_available ? '#16a34a' : '#991b1b' }}>
                      {keyModal.prop.key_available ? 'المفتاح متوفر' : 'المفتاح غير متوفر'}
                    </Text>
                    {keyModal.prop.key_note ? <Text style={{ color: '#6b7280', fontSize: 13, marginTop: 2, textAlign: 'right' }}>{keyModal.prop.key_note}</Text> : null}
                  </View>
                </View>

                {/* Key image */}
                {keyModal.prop.key_image ? (
                  <View style={{ marginBottom: 14 }}>
                    <Text style={{ color: '#6b7280', fontSize: 12, fontWeight: '700', textAlign: 'right', marginBottom: 6 }}>صورة المفتاح الحالية</Text>
                    <Image source={{ uri: `https://sry.sarayatec.com${keyModal.prop.key_image}` }} style={{ width: '100%', height: 200, borderRadius: 12 }} resizeMode="contain" />
                  </View>
                ) : (
                  <View style={{ backgroundColor: '#f9fafb', borderRadius: 12, padding: 16, alignItems: 'center', marginBottom: 14, borderWidth: 1, borderColor: '#e5e7eb' }}>
                    <Ionicons name="image-outline" size={36} color="#d1d5db" />
                    <Text style={{ color: '#9ca3af', fontSize: 13, marginTop: 6 }}>لا توجد صورة للمفتاح</Text>
                  </View>
                )}

                {/* Photo button */}
                <TouchableOpacity
                  onPress={takeKeyPhoto}
                  disabled={keyModal.uploading}
                  style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: keyModal.prop.key_image ? '#f59e0b' : '#2563eb', borderRadius: 14, paddingVertical: 14, marginBottom: 10 }}
                  activeOpacity={0.85}
                >
                  {keyModal.uploading
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <Ionicons name="camera" size={18} color="#fff" />}
                  <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>
                    {keyModal.uploading ? 'جاري الرفع...' : keyModal.prop.key_image ? 'تحديث صورة المفتاح' : 'التقاط صورة المفتاح'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity onPress={() => setKeyModal(null)} style={{ alignItems: 'center', paddingVertical: 10 }}>
                  <Text style={{ color: '#9ca3af', fontSize: 14, fontWeight: '600' }}>إغلاق</Text>
                </TouchableOpacity>
              </ScrollView>
            ) : (
              <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                <Text style={{ color: '#9ca3af' }}>لم يتم العثور على بيانات</Text>
                <TouchableOpacity onPress={() => setKeyModal(null)} style={{ marginTop: 16 }}>
                  <Text style={{ color: '#6b7280', fontWeight: '600' }}>إغلاق</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>

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

      {/* In-app navigation modal */}
      {inAppNav && (
        <InAppNavModal
          visible={!!inAppNav}
          destLat={inAppNav.lat}
          destLng={inAppNav.lng}
          destTitle={inAppNav.title}
          onClose={() => setInAppNav(null)}
          onArrived={() => {
            setInAppNav(null);
            setNavSession(prev => prev ? { ...prev, phase: 'arrived' } : prev);
          }}
        />
      )}
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
  propBtnsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  propBtn: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 5,
    backgroundColor: '#eff6ff', borderRadius: 10, paddingVertical: 7, paddingHorizontal: 12,
    borderWidth: 1, borderColor: '#bfdbfe',
  },
  propBtnNearest: { backgroundColor: '#f0fdf4', borderColor: '#86efac' },
  propBtnText: { color: '#2563eb', fontWeight: '700', fontSize: 13 },
  propBtnOwner: { color: '#6b7280', fontSize: 11, fontWeight: '500', marginTop: 1 },
  propBtnDist: { color: '#6b7280', fontSize: 11, fontWeight: '600' },
  navBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#2563eb', borderRadius: 12, paddingVertical: 10, marginBottom: 10,
  },
  navBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 10, borderTopWidth: 1, borderTopColor: '#f3f4f6', marginTop: 4 },
  btnBlue:  { backgroundColor: '#f3f4f6', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  btnBlueText:  { color: '#374151', fontSize: 13, fontWeight: '700' },
  btnGreen: { backgroundColor: '#f3f4f6', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  btnGreenText: { color: '#374151', fontSize: 13, fontWeight: '700' },
  btnRed:   { backgroundColor: '#f3f4f6', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  btnRedText:   { color: '#374151', fontSize: 13, fontWeight: '700' },
  time: { color: '#1e40af', fontWeight: '900', fontSize: 14 },
  date: { color: '#9ca3af', fontSize: 11 },
  emptyTitle: { color: '#9ca3af', marginTop: 16, fontSize: 15, fontWeight: '600' },
  emptySub:   { color: '#d1d5db', fontSize: 13, marginTop: 4 },
  cancelOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  cancelBox: { backgroundColor: '#fff', borderRadius: 20, padding: 20, width: '100%' },
  cancelTitle: { fontSize: 17, fontWeight: '900', color: '#111827', textAlign: 'right', marginBottom: 4 },
  cancelSub: { fontSize: 13, color: '#6b7280', textAlign: 'right', marginBottom: 14 },
  cancelInput: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, padding: 12, fontSize: 14, color: '#111827', minHeight: 90, textAlignVertical: 'top', backgroundColor: '#f9fafb', marginBottom: 16 },
  cancelActions: { flexDirection: 'row', gap: 10 },
  cancelBtnNo: { flex: 1, backgroundColor: '#f3f4f6', borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  cancelBtnNoTxt: { color: '#4b5563', fontWeight: '700', fontSize: 14 },
  cancelBtnYes: { flex: 1, backgroundColor: '#fee2e2', borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  cancelBtnYesTxt: { color: '#991b1b', fontWeight: '700', fontSize: 14 },
  callBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center', marginLeft: 6 },
});

const ns = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 36, maxHeight: '85%' },
  header: { alignItems: 'flex-end', marginBottom: 16 },
  headerTitle: { fontSize: 18, fontWeight: '900', color: '#1e3a8a' },
  headerSub: { fontSize: 13, color: '#6b7280', marginTop: 2, textAlign: 'right' },
  progressWrap: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 20 },
  progressBar: { flex: 1, height: 6, backgroundColor: '#e5e7eb', borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#2563eb', borderRadius: 4 },
  progressText: { fontSize: 13, fontWeight: '700', color: '#6b7280', minWidth: 60, textAlign: 'right' },
  propRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  propCode: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#eff6ff', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10, borderWidth: 1, borderColor: '#bfdbfe' },
  propCodeText: { color: '#1e3a8a', fontWeight: '900', fontSize: 16 },
  distBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#f0fdf4', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: '#86efac' },
  distText: { color: '#16a34a', fontWeight: '700', fontSize: 14 },
  mapsBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#0ea5e9', borderRadius: 14, paddingVertical: 14, marginBottom: 10 },
  mapsBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  noCoordBox: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff7ed', borderRadius: 14, paddingVertical: 14, paddingHorizontal: 16, marginBottom: 10, borderWidth: 1, borderColor: '#fed7aa' },
  noCoordText: { color: '#c2410c', fontWeight: '600', fontSize: 13, flex: 1, textAlign: 'right', lineHeight: 20 },
  shareBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#7c3aed', borderRadius: 14, paddingVertical: 13, marginBottom: 10 },
  shareBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  arrivedBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#16a34a', borderRadius: 14, paddingVertical: 14, marginBottom: 10 },
  arrivedBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  commentLabel: { fontSize: 13, fontWeight: '700', color: '#374151', textAlign: 'right', marginBottom: 8 },
  commentInput: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, padding: 12, fontSize: 14, color: '#111827', minHeight: 90, textAlignVertical: 'top', backgroundColor: '#f9fafb', marginBottom: 14 },
  doneBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#1e40af', borderRadius: 14, paddingVertical: 14, marginBottom: 10 },
  doneBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  closeBtn: { alignItems: 'center', paddingVertical: 10 },
  closeBtnText: { color: '#9ca3af', fontSize: 14, fontWeight: '600' },
});

const ps = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '90%', minHeight: 300 },
  handleArea: { width: '100%', alignItems: 'center', paddingVertical: 12 },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#d1d5db' },
  closeBtn: { position: 'absolute', top: 12, left: 16, zIndex: 10, width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  noData: { color: '#9ca3af', fontSize: 14 },
  image: { width: SCREEN_W, height: 240 },
  noImageBox: { height: 160, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f9fafb' },
  dotsRow: { position: 'absolute', bottom: 10, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.5)' },
  dotActive: { backgroundColor: '#fff', width: 18 },
  body: { padding: 18 },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  code: { backgroundColor: '#eff6ff', color: '#2563eb', fontWeight: '800', fontSize: 13, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8, borderWidth: 1, borderColor: '#bfdbfe' },
  title: { color: '#1e3a8a', fontWeight: '900', fontSize: 17, textAlign: 'right', marginBottom: 10, lineHeight: 26 },
  infoRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 6, marginBottom: 6 },
  infoVal: { color: '#4b5563', fontSize: 13, textAlign: 'right', flex: 1 },
  statsRow: { flexDirection: 'row', gap: 10, marginVertical: 10, justifyContent: 'flex-end' },
  statBox: { backgroundColor: '#f3f4f6', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8, alignItems: 'center' },
  statVal: { color: '#1e3a8a', fontWeight: '900', fontSize: 16 },
  statLabel: { color: '#9ca3af', fontSize: 11, marginTop: 2 },
  keyBox: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, padding: 12, marginVertical: 10 },
  keyText: { fontWeight: '700', fontSize: 14, flex: 1, textAlign: 'right' },
  keyNote: { color: '#6b7280', fontSize: 12 },
  keyImage: { width: '100%', height: 180, borderRadius: 12, marginBottom: 10 },
  guardBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#f5f3ff', borderRadius: 12, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: '#ddd6fe' },
  guardText: { flex: 1, color: '#7c3aed', fontWeight: '700', fontSize: 14, textAlign: 'right' },
  descBox: { marginTop: 6 },
  descLabel: { color: '#9ca3af', fontSize: 12, fontWeight: '700', textAlign: 'right', marginBottom: 4 },
  descText: { color: '#4b5563', fontSize: 13, textAlign: 'right', lineHeight: 22 },
  lbOverlay: { flex: 1, backgroundColor: '#000', justifyContent: 'center' },
  lbHeader: { paddingHorizontal: 16, paddingTop: 48, paddingBottom: 8 },
  lbCount: { color: '#fff', fontSize: 15, fontWeight: '700' },
  lbCloseBtn: { alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 24, paddingHorizontal: 24, paddingVertical: 12, marginTop: 16, marginBottom: 24 },
  lbCloseTxt: { color: '#fff', fontSize: 15, fontWeight: '700' },
});

const cs = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 36 },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#d1d5db', alignSelf: 'center', marginBottom: 16 },
  title: { fontSize: 17, fontWeight: '900', color: '#1e3a8a', textAlign: 'right', marginBottom: 16 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#f8fafc', borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#e5e7eb' },
  customerInfo: { flex: 1, alignItems: 'flex-end' },
  customerName: { fontSize: 14, fontWeight: '700', color: '#111827', textAlign: 'right' },
  customerPhone: { fontSize: 12, color: '#6b7280', marginTop: 2, textAlign: 'right' },
  callBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#2563eb', alignItems: 'center', justifyContent: 'center', marginLeft: 12 },
  callBtnDisabled: { backgroundColor: '#f3f4f6' },
  closeBtn: { alignItems: 'center', paddingVertical: 12, marginTop: 4 },
  closeTxt: { color: '#9ca3af', fontSize: 14, fontWeight: '600' },
});
