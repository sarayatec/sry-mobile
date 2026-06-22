import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ActivityIndicator,
  Alert, ScrollView,
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
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-blue-900"
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingHorizontal: 28 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Logo */}
        <View className="items-center mb-10">
          <View className="w-24 h-24 bg-white rounded-3xl items-center justify-center mb-5 shadow-2xl">
            <Text className="text-blue-900 text-4xl font-black tracking-tight">SRY</Text>
          </View>
          <Text className="text-white text-2xl font-bold tracking-wide">SRY Field</Text>
          <Text className="text-blue-300 text-sm mt-1">نظام الموظفين الميدانيين</Text>
        </View>

        {/* Card */}
        <View className="bg-white rounded-3xl p-7 shadow-2xl">
          {/* Email */}
          <Text className="text-gray-600 text-right text-sm font-medium mb-1.5">
            البريد الإلكتروني
          </Text>
          <View className="flex-row-reverse items-center border border-gray-200 rounded-2xl px-4 mb-4 bg-gray-50">
            <Ionicons name="mail-outline" size={18} color="#9ca3af" style={{ marginLeft: 8 }} />
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="example@email.com"
              placeholderTextColor="#9ca3af"
              textAlign="right"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              className="flex-1 py-3.5 text-gray-800"
            />
          </View>

          {/* Password */}
          <Text className="text-gray-600 text-right text-sm font-medium mb-1.5">
            كلمة المرور
          </Text>
          <View className="flex-row-reverse items-center border border-gray-200 rounded-2xl px-4 mb-6 bg-gray-50">
            <Ionicons name="lock-closed-outline" size={18} color="#9ca3af" style={{ marginLeft: 8 }} />
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor="#9ca3af"
              secureTextEntry={!showPassword}
              textAlign="right"
              className="flex-1 py-3.5 text-gray-800"
            />
            <TouchableOpacity onPress={() => setShowPassword(p => !p)}>
              <Ionicons
                name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                size={18}
                color="#9ca3af"
                style={{ marginRight: 4 }}
              />
            </TouchableOpacity>
          </View>

          {/* Submit */}
          <TouchableOpacity
            onPress={handleLogin}
            disabled={submitting}
            activeOpacity={0.85}
            className="bg-blue-800 rounded-2xl py-4 items-center shadow"
          >
            {submitting
              ? <ActivityIndicator color="#fff" />
              : <Text className="text-white text-base font-bold">تسجيل الدخول</Text>
            }
          </TouchableOpacity>
        </View>

        <Text className="text-blue-500 text-center text-xs mt-8">
          Sarayatec © 2026 — v1.0
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
