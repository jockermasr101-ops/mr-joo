# MR JOO — Starter\n\nواجهة عربية RTL متجاوبة كبداية للموقع.\n\n## قبل النشر\n- استبدل example.com بالدومين الحقيقي في canonical وrobots وsitemap.\n- الأسعار والمحتوى الحاليان أمثلة وليسا عروضًا نهائية.\n- نموذج التواصل تجريبي ولا يرسل بيانات. لا يوجد تسجيل دخول أو لوحة تحكم أو دفع حقيقي في هذه المرحلة.\n- لا تضع أسرار Firebase Admin أو Cloudinary secret داخل ملفات المتصفح.\n- عند ربط Firebase: أغلق قواعد Firestore وStorage افتراضيًا، واستخدم Authentication وCloud Functions للتحقق من الصلاحيات والعمليات المالية.\n- حماية المحفظة والإيصالات والطلبات يجب أن تتم من الخادم، وليس عبر JavaScript في المتصفح.\n- Security Headers في vercel.json نقطة بداية وليست تدقيقًا أمنيًا. أضف CSP بعد حصر مصادر الموارد واختبارها.\n- robots.txt وnoindex لا يحميان الصفحات؛ الحماية الفعلية بالمصادقة والصلاحيات على الخادم.\n\n## SEO\nاستخدم أعمالًا أصلية وصورًا مضغوطة مع alt، وصفحات منفصلة للخدمات والمنتجات، واربط Google Search Console بعد النشر وأرسل sitemap. لا تستخدم تقييمات أو أعمالًا غير حقيقية.\n
## المرحلة التالية المضافة
- صفحات تجريبية: تسجيل الدخول، إنشاء الحساب، حساب العميل، الطلبات، الملف الشخصي، ولوحة الإدارة.
- صفحات الإدارة والحساب عليها `noindex`، لكن هذا لا يحميها أمنيًا.
- قواعد Firebase في `firebase/` مغلقة افتراضيًا (deny all) إلى أن يتم تصميم الصلاحيات واختبارها.
- كل بيانات اللوحات تجريبية؛ لا يوجد backend أو مصادقة أو حفظ حقيقي حتى الآن.

## Firebase Security Update
راجع `firebase/RULES-AUDIT-AND-DEPLOY.md` قبل النشر. القواعد الجديدة تستخدم رسائل منفصلة في subcollections وتمنع تسجيل المالك من الواجهة. يلزم إنشاء المالك الأول من بيئة موثوقة، كما يجب مواءمة مخطط البيانات مع التطبيق واختباره باستخدام Firebase Emulator Suite.

## Order & Support Backend Phase
- Added Firebase Functions source in `functions/` for server-priced order creation, transfer receipt submission, accountant approval/rejection, immutable ledger creation, and append-only support messages.
- Added `firebase.json`, product catalog rules, and private receipt Storage rules.
- Direct client writes to orders/transfers are denied; payment approval and ledger writes are server-only.
- Read `firebase/ORDER-SUPPORT-BACKEND.md` and `firebase/EMULATOR-TEST-PLAN.md` before configuring or deploying.
- This phase is source code only: Firebase is not configured, deployed, or connected to the website. The existing HTML pages remain demonstration UI until the client SDK integration is completed.
