import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ActivityIndicator,
  Alert, ScrollView, StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../src/stores/authStore';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { login } = useAuthStore();

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      Alert.alert('تنبيه', 'يرجى إدخال البريد الإلكتروني وكلمة المرور');
      return;
    }
    setSubmitting(true);
    try {
      await login(email.trim().toLowerCase(), password);
    } catch (err: any) {
      const msg = err?.response?.data?.error || 'تعذّر تسجيل الدخول، تحقق من البيانات';
      Alert.alert('خطأ', msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={s.root}>
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        <View style={s.logoWrap}>
          <View style={s.logoBox}>
            <Text style={s.logoText}>SRY</Text>
          </View>
          <Text style={s.appName}>SRY Field</Text>
          <Text style={s.appSub}>نظام الموظفين الميدانيين</Text>
        </View>

        <View style={s.card}>
          <Text style={s.label}>البريد الإلكتروني</Text>
          <View style={s.inputRow}>
            <Ionicons name="mail-outline" size={18} color="#9ca3af" style={s.inputIcon} />
            <TextInput
              value={email} onChangeText={setEmail}
              placeholder="example@email.com" placeholderTextColor="#9ca3af"
              textAlign="right" keyboardType="email-address"
              autoCapitalize="none" autoCorrect={false}
              style={s.input}
            />
          </View>

          <Text style={[s.label, { marginTop: 14 }]}>كلمة المرور</Text>
          <View style={s.inputRow}>
            <TouchableOpacity onPress={() => setShowPassword(p => !p)}>
              <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={18} color="#9ca3af" />
            </TouchableOpacity>
            <TextInput
              value={password} onChangeText={setPassword}
              placeholder="••••••••" placeholderTextColor="#9ca3af"
              secureTextEntry={!showPassword} textAlign="right"
              style={[s.input, { flex: 1 }]}
            />
          </View>

          <TouchableOpacity onPress={handleLogin} disabled={submitting} style={s.btn} activeOpacity={0.85}>
            {submitting
              ? <ActivityIndicator color="#fff" />
              : <Text style={s.btnText}>تسجيل الدخول</Text>
            }
          </TouchableOpacity>
        </View>

        <Text style={s.footer}>Sarayatec © 2026 — v1.0</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#1e3a8a' },
  scroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 28 },
  logoWrap: { alignItems: 'center', marginBottom: 36 },
  logoBox: { width: 96, height: 96, backgroundColor: '#fff', borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  logoText: { fontSize: 36, fontWeight: '900', color: '#1e3a8a' },
  appName: { color: '#fff', fontSize: 24, fontWeight: 'bold' },
  appSub: { color: '#93c5fd', fontSize: 13, marginTop: 4 },
  card: { backgroundColor: '#fff', borderRadius: 24, padding: 24 },
  label: { color: '#374151', fontSize: 13, fontWeight: '600', textAlign: 'right', marginBottom: 6 },
  inputRow: { flexDirection: 'row-reverse', alignItems: 'center', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 16, paddingHorizontal: 14, marginBottom: 4, backgroundColor: '#f9fafb' },
  inputIcon: { marginLeft: 8 },
  input: { flex: 1, paddingVertical: 14, color: '#111827', fontSize: 15 },
  btn: { backgroundColor: '#1e40af', borderRadius: 16, paddingVertical: 16, alignItems: 'center', marginTop: 20 },
  btnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  footer: { color: '#60a5fa', textAlign: 'center', fontSize: 12, marginTop: 32 },
});
