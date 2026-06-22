# SRY Field — دليل الإعداد والتشغيل

## المتطلبات
- Node.js 18+
- Expo CLI: `npm install -g expo-cli eas-cli`
- هاتف Android أو محاكي

## تشغيل للتطوير (على هاتفك مباشرة)

```bash
cd mobile
npm install
npx expo start
```

ثم امسح QR بتطبيق **Expo Go** من Play Store.

## ملاحظة: Google Maps API Key

في `app.json` استبدل `REPLACE_WITH_GOOGLE_MAPS_API_KEY` بمفتاحك:
1. افتح https://console.cloud.google.com
2. فعّل **Maps SDK for Android**
3. انسخ المفتاح في `app.json > android > config > googleMaps > apiKey`

## بناء APK للتوزيع

```bash
# تسجيل دخول Expo
eas login

# بناء APK (يُرفع للتثبيت المباشر)
eas build --platform android --profile preview
```

## هيكل المشروع

```
mobile/
├── app/
│   ├── _layout.tsx          ← Root: تسجيل background task
│   ├── index.tsx            ← Redirect حسب حالة الدخول
│   ├── (auth)/
│   │   └── login.tsx        ← شاشة تسجيل الدخول
│   └── (app)/
│       ├── _layout.tsx      ← شريط التنقل السفلي
│       ├── index.tsx        ← الرئيسية + تحكم جلسة GPS
│       ├── map.tsx          ← خريطة الموظفين (real-time)
│       └── appointments.tsx ← مواعيد اليوم
└── src/
    ├── services/
    │   ├── api.ts           ← Axios client (يتصل بـ sry.sarayatec.com)
    │   ├── auth.ts          ← JWT + SecureStore
    │   └── location.ts      ← Background GPS task
    ├── stores/
    │   └── authStore.ts     ← Zustand auth state
    └── types/index.ts       ← TypeScript interfaces
```

## API Endpoints المضافة للخادم

| Method | Path | Auth | الوصف |
|--------|------|------|-------|
| POST | /api/mobile/location | Employee | إرسال الموقع |
| GET | /api/mobile/admin/live-employees | Admin | مواقع الموظفين المباشرة |
| GET | /api/mobile/appointments | Any | مواعيد اليوم |
| POST | /api/mobile/appointments | Admin | إنشاء موعد |
| PATCH | /api/mobile/appointments/:id | Any | تحديث حالة الموعد |
| GET | /api/mobile/employees | Admin | قائمة الموظفين للتعيين |

## المراحل التالية

- **المرحلة 2**: لوحة تحكم الويب للمدير (إنشاء مواعيد + عرض الخريطة)
- **المرحلة 3**: بث صوت/كاميرا (WebRTC) بإشعار ظاهر
- **المرحلة 4**: الإشعارات الفورية (FCM) عند تعيين موعد جديد
