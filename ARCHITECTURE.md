# اليوسفي سوفت — المعمارية وطريقة بناء APK

## الملخص التقني

اليوسفي سوفت تطبيق SPA عربي RTL يعمل بالكامل على الجهاز:

- **الواجهة:** React 19 مع TypeScript وVite 7 وTailwind CSS 4.
- **تطبيق الويب:** ملفّات static مبنية مسبقاً، ولا يحتاج تشغيل التطبيق إلى Node.js أو Express أو أي API.
- **طبقة البيانات:** `LocalDataService` موحّدة. تستخدم Capacitor SQLite على Android، وتستخدم IndexedDB مع LocalStorage كـ fallback في Web Preview.
- **النسخ الاحتياطي:** تصدير واستيراد JSON محلياً من صفحة الإعدادات، مع نسخة تلقائية عند انتقال التطبيق للخلفية. على Android تحفظ النسخة في مجلد بيانات التطبيق الخاص عبر Capacitor Filesystem، وعلى الويب في LocalStorage.
- **جهات الاتصال:** تكامل Native عبر `@capacitor-community/contacts` مع طلب إذن التشغيل، واستخدام Web Contact Picker كـ fallback في المتصفحات الداعمة.
- **تطبيق Android:** Capacitor 8 مع غلاف Android أصلي، ومعرّف ثابت:
  `com.alyousifisoft.app`
- **رقم الإصدار:** `1.0.15`، ورقم البناء Android هو `16`.

## مسارات البناء

يبني Vite التطبيق داخل:

```text
artifacts/alyousifi-soft/dist/
```

ثم ينسخ الأمر `npx cap sync android` هذه الأصول إلى:

```text
android/app/src/main/assets/public/
```

ويفتح Capacitor الصفحة المحلية:

```text
file:///android_asset/public/index.html
```

يجب أن يبقى `webDir` في `capacitor.config.json` مساوياً لـ `dist`، كما يجب أن تبقى
قيمة Vite هي `base: './'`. يحتوي `index.html` المصدر والمبني على:

```html
<base href="./">
```

هذه المسارات النسبية تمنع فشل تحميل JavaScript أو CSS عند تشغيل APK من `file://`.

## متطلبات البناء

- Node.js 24
- pnpm 10
- Java 21
- Android SDK Platform 36
- Android Build Tools متوافق مع SDK 36
- Gradle Wrapper 8.14.3

الاتصال مطلوب فقط لتنزيل الاعتمادات أثناء البناء. بعد تضمين الأصول في APK لا يحتاج
التطبيق إلى خادم أو شبكة لكي يعمل أو يحفظ المبيعات والعملاء والمخزون.

## طبقة البيانات المحلية

كل عملية تخص:

- كروت ومخزون
- العملاء والديون والتحصيلات
- المبيعات
- التوريدات والمرتجعات
- دفعات المورد
- السحوبات والإيداعات
- الإعدادات

تُحدّث حالة React ثم تحفظ عبر `LocalDataService`.

على Android تُحفظ الحالة في جدول SQLite واحد اسمه `app_state` داخل قاعدة
`alyousifi_soft`. ينشئ التطبيق الجدول باستخدام `CREATE TABLE IF NOT EXISTS` ويستخدم
عملية upsert للصف الحالي. لا توجد أي عملية `DROP TABLE` أو `deleteDatabase` أثناء
الإقلاع أو التحديث.

في Web Preview تستخدم الطبقة IndexedDB مع LocalStorage. يُقرأ SQLite أولاً على
Android، ثم IndexedDB، ثم LocalStorage عند الحاجة. تعطل أحد المصادر لا يمسح
المصادر الأخرى ولا يمنع الشاشة من العمل في الذاكرة.

### سياسة الهجرة

- `SCHEMA_VERSION` الحالي هو `4`.
- كل تحديث للبيانات تحويلي وغير مدمّر.
- الحقول الجديدة تحصل على قيم افتراضية مع إبقاء المصفوفات والسجلات القديمة.
- يبقى `applicationId` ثابتاً حتى يحتفظ Android ببيانات التطبيق عند تثبيت تحديث.
- زر إعادة الضبط إجراء يدوي صريح داخل التطبيق فقط، وليس جزءاً من تثبيت APK.

## البناء المحلي

من جذر المستودع:

```bash
pnpm install --frozen-lockfile
pnpm run build:android
```

يقوم `build:android` بالخطوات التالية:

1. يفحص TypeScript ويبني React/Vite.
2. يضع الناتج في `dist/` بجذر المستودع ليطابق `capacitor.config.json`.
3. ينفذ `npx cap sync android`.
4. ينسخ plugins، وملف `capacitor.config.json`، وأصول الويب إلى Android.

لبناء APK يدوياً:

```bash
cd android
./gradlew --no-daemon assembleRelease
```

الناتج:

```text
android/app/build/outputs/apk/release/app-release.apk
```

الإصدار الحالي مهيأ بتوقيع debug للتوزيع اليدوي الداخلي. يجب استخدام keystore ثابت
قبل توزيع تحديثات مستمرة أو النشر في متجر، مع إبقاء `applicationId` كما هو.

## GitHub Actions

الملف `.github/workflows/android.yml`:

1. يثبت Node.js وpnpm.
2. يبني أصول الويب الثابتة.
3. يجهز `dist/` في جذر المستودع.
4. يثبت Java 21 وAndroid SDK.
5. ينفذ `npx cap sync android`.
6. يبني `app-release.apk` عبر Gradle Wrapper.
7. يرفع APK كـ workflow artifact.

لا يشغل workflow أي خادم API ولا يضيف Express إلى APK.

## حماية الإقلاع والتشخيص

يثبت `src/main.tsx` معالجات:

- `window.onerror`
- `unhandledrejection`
- أخطاء تحميل script وlink وimage
- أخطاء المسارات المطلقة للأصول المحلية
- أخطاء React غير الملتقطة
- أخطاء تهيئة LocalDataService

تظهر عند الخطأ شاشة حمراء داكنة كاملة بدلاً من شاشة بيضاء، وتعرض الرسالة الفنية
والمصدر ورقم السطر والعمود عند توفرها، مع زر إعادة المحاولة. لا يعتمد الإقلاع على
طلب شبكة أو نتيجة خادم خارجي.

## قائمة تحقق قبل التسليم

- [ ] `capacitor.config.json` يحتوي `webDir: "dist"` و`bundledWebRuntime: false`.
- [ ] Vite يستخدم `base: './'`.
- [ ] يوجد `<base href="./">` مرة واحدة في `dist/index.html`.
- [ ] `dist/assets/` غير فارغ.
- [ ] توجد الأصول المجمعة في `android/app/src/main/assets/public/`.
- [ ] `android/app/src/main/assets/public/index.html` يستخدم مسارات نسبية.
- [ ] يوجد plugin لـ `@capacitor-community/sqlite`.
- [ ] توجد plugins لـ Contacts وApp وFilesystem وتظهر في `npx cap sync android`.
- [ ] يطلب التطبيق `READ_CONTACTS` و`WRITE_CONTACTS` عند استخدام جهات الاتصال، ولا يطلب تخزيناً عاماً للنسخ التلقائية الخاصة.
- [ ] `applicationId` ثابت: `com.alyousifisoft.app`.
- [ ] `versionName` هو `1.0.15` و`versionCode` هو `16`.
- [ ] لا توجد مراجع `fetch('/api/...')` في واجهة التطبيق.
- [ ] تم تشغيل typecheck وبناء Vite وGradle قبل إنشاء حزمة GitHub.