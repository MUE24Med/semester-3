const UserTracker = {
    activities: [], // لتخزين الأنشطة حتى لحظة الخروج
    deviceFingerprint: null, // البصمة الفريدة للجهاز

    // ✅ 1. توليد بصمة فريدة للجهاز (Device Fingerprint)
    async generateFingerprint() {
        // إذا كانت البصمة موجودة في localStorage، استخدمها
        const storedFingerprint = localStorage.getItem('device_fingerprint');
        if (storedFingerprint) {
            this.deviceFingerprint = storedFingerprint;
            return storedFingerprint;
        }

        // إنشاء بصمة جديدة من معلومات الجهاز
        const components = {
            // 1. معلومات الشاشة
            screen: `${screen.width}x${screen.height}x${screen.colorDepth}`,
            availScreen: `${screen.availWidth}x${screen.availHeight}`,
            pixelRatio: window.devicePixelRatio || 1,

            // 2. معلومات المتصفح
            userAgent: navigator.userAgent,
            language: navigator.language,
            languages: navigator.languages ? navigator.languages.join(',') : '',
            platform: navigator.platform,
            hardwareConcurrency: navigator.hardwareConcurrency || 0,
            deviceMemory: navigator.deviceMemory || 0,

            // 3. إعدادات النظام
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            timezoneOffset: new Date().getTimezoneOffset(),

            // 4. Canvas Fingerprint (أقوى طريقة للتعرف)
            canvas: await this.getCanvasFingerprint(),

            // 5. WebGL Fingerprint
            webgl: this.getWebGLFingerprint(),

            // 6. الخطوط المثبتة
            fonts: await this.getFontsFingerprint(),

            // 7. Audio Context Fingerprint
            audio: await this.getAudioFingerprint(),

            // 8. معلومات الاتصال
            connection: this.getConnectionInfo(),

            // 9. معلومات البطارية (إن وجدت)
            battery: await this.getBatteryInfo(),

            // 10. Touch Support
            touchSupport: this.getTouchSupport(),

            // 11. معلومات الـ Plugins
            plugins: this.getPluginsInfo()
        };

        // تحويل البيانات إلى hash فريد
        const fingerprintString = JSON.stringify(components);
        const fingerprint = await this.hashString(fingerprintString);

        // حفظ البصمة في localStorage
        localStorage.setItem('device_fingerprint', fingerprint);
        this.deviceFingerprint = fingerprint;

        return fingerprint;
    },

    // ✅ 2. Canvas Fingerprint (دقة عالية جداً)
    async getCanvasFingerprint() {
        try {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = 200;
            canvas.height = 50;

            // رسم نص ملون
            ctx.textBaseline = 'top';
            ctx.font = '14px Arial';
            ctx.fillStyle = '#f60';
            ctx.fillRect(0, 0, 200, 50);
            ctx.fillStyle = '#069';
            ctx.fillText('Device Fingerprint 🔒', 2, 15);

            // إضافة تدرجات لونية
            const gradient = ctx.createLinearGradient(0, 0, 200, 0);
            gradient.addColorStop(0, 'magenta');
            gradient.addColorStop(0.5, 'blue');
            gradient.addColorStop(1.0, 'red');
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, 200, 50);

            // استخراج البيانات
            return canvas.toDataURL();
        } catch (e) {
            return 'canvas_error';
        }
    },

    // ✅ 3. WebGL Fingerprint
    getWebGLFingerprint() {
        try {
            const canvas = document.createElement('canvas');
            const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
            
            if (!gl) return 'no_webgl';

            const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
            return {
                vendor: gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL),
                renderer: gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL),
                version: gl.getParameter(gl.VERSION),
                shadingLanguageVersion: gl.getParameter(gl.SHADING_LANGUAGE_VERSION)
            };
        } catch (e) {
            return 'webgl_error';
        }
    },

    // ✅ 4. Fonts Fingerprint
    async getFontsFingerprint() {
        const baseFonts = ['monospace', 'sans-serif', 'serif'];
        const testFonts = [
            'Arial', 'Courier New', 'Georgia', 'Times New Roman', 'Verdana',
            'Tahoma', 'Trebuchet MS', 'Impact', 'Comic Sans MS', 'Arial Black'
        ];

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const detected = [];

        for (const font of testFonts) {
            let detected_font = false;
            for (const baseFont of baseFonts) {
                ctx.font = `72px ${baseFont}`;
                const baseWidth = ctx.measureText('mmmmmmmmmmlli').width;
                
                ctx.font = `72px ${font}, ${baseFont}`;
                const testWidth = ctx.measureText('mmmmmmmmmmlli').width;

                if (baseWidth !== testWidth) {
                    detected_font = true;
                    break;
                }
            }
            if (detected_font) detected.push(font);
        }

        return detected.join(',');
    },

    // ✅ 5. Audio Context Fingerprint
    async getAudioFingerprint() {
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (!AudioContext) return 'no_audio';

            const context = new AudioContext();
            const oscillator = context.createOscillator();
            const analyser = context.createAnalyser();
            const gainNode = context.createGain();
            const scriptProcessor = context.createScriptProcessor(4096, 1, 1);

            gainNode.gain.value = 0; // صامت
            oscillator.connect(analyser);
            analyser.connect(scriptProcessor);
            scriptProcessor.connect(gainNode);
            gainNode.connect(context.destination);

            oscillator.start(0);

            return new Promise((resolve) => {
                scriptProcessor.onaudioprocess = function(event) {
                    const output = event.outputBuffer.getChannelData(0);
                    const sum = output.reduce((a, b) => a + Math.abs(b), 0);
                    oscillator.stop();
                    context.close();
                    resolve(sum.toString());
                };
            });
        } catch (e) {
            return 'audio_error';
        }
    },

    // ✅ 6. معلومات البطارية
    async getBatteryInfo() {
        try {
            if ('getBattery' in navigator) {
                const battery = await navigator.getBattery();
                return {
                    level: Math.round(battery.level * 100),
                    charging: battery.charging
                };
            }
            return 'no_battery_api';
        } catch (e) {
            return 'battery_error';
        }
    },

    // ✅ 7. Touch Support
    getTouchSupport() {
        return {
            maxTouchPoints: navigator.maxTouchPoints || 0,
            touchEvent: 'ontouchstart' in window,
            touchStart: 'TouchEvent' in window
        };
    },

    // ✅ 8. Plugins Info
    getPluginsInfo() {
        const plugins = [];
        for (let i = 0; i < navigator.plugins.length; i++) {
            plugins.push(navigator.plugins[i].name);
        }
        return plugins.join(',');
    },

    // ✅ 9. تحويل النص إلى Hash
    async hashString(str) {
        const encoder = new TextEncoder();
        const data = encoder.encode(str);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        return hashHex.substring(0, 16); // أول 16 حرف فقط
    },

    // ✅ 10. الحصول على اسم المستخدم
    getDisplayName() {
        const realName = localStorage.getItem('user_real_name');
        if (realName === 'زائر مجهول' || realName === 'زائر') {
            localStorage.removeItem('user_real_name');
        }
        if (!localStorage.getItem('visitor_id')) {
            const newId = 'ID-' + Math.floor(1000 + Math.random() * 9000);
            localStorage.setItem('visitor_id', newId);
        }
        const cleanRealName = localStorage.getItem('user_real_name');
        return (cleanRealName && cleanRealName.trim()) ? cleanRealName.trim() : localStorage.getItem('visitor_id');
    },

    getBrowserName() {
        const ua = navigator.userAgent;
        if (ua.includes("Samsung")) return "Samsung Internet";
        if (ua.includes("Edg")) return "Edge";
        if (ua.includes("Chrome")) return "Chrome";
        if (ua.includes("Safari") && !ua.includes("Chrome")) return "Safari";
        if (ua.includes("Firefox")) return "Firefox";
        if (ua.includes("Opera") || ua.includes("OPR")) return "Opera";
        return "Unknown Browser";
    },

    getOS() {
        const ua = navigator.userAgent;
        if (ua.includes("Android")) return "Android";
        if (ua.includes("iPhone") || ua.includes("iPad")) return "iOS";
        if (ua.includes("Win")) return "Windows";
        if (ua.includes("Mac")) return "macOS";
        if (ua.includes("Linux")) return "Linux";
        return "Unknown OS";
    },

    getConnectionInfo() {
        const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
        return conn ? `${conn.effectiveType || 'Unknown'} (${conn.downlink || '?'}Mbps)` : "Unknown";
    },

    // ✅ 11. تسجيل النشاط
    logActivity(type, details = {}) {
        this.activities.push({
            time: new Date().toLocaleTimeString('ar-EG'),
            type: type,
            details: details
        });
    },

    // ✅ 12. إرسال البيانات مع البصمة الفريدة
    async send(action, isFinal = false) {
        // التأكد من توليد البصمة
        if (!this.deviceFingerprint) {
            await this.generateFingerprint();
        }

        const data = new FormData();
        
        // ✅ البيانات الرئيسية (مع Device Fingerprint)
        data.append("01-Device_ID", this.deviceFingerprint); // 🔒 البصمة الفريدة
        data.append("02-User_Name", this.getDisplayName());
        data.append("03-Visitor_ID", localStorage.getItem('visitor_id') || 'Unknown');
        data.append("04-Group", localStorage.getItem('selectedGroup') || 'لم يختر بعد');
        data.append("05-Action", action);

        // ✅ ملخص الأنشطة (إن وجد)
        if (isFinal && this.activities.length > 0) {
            data.append("06-Activities", JSON.stringify(this.activities, null, 2));
        }

        // ✅ معلومات الجهاز
        data.append("07-Browser", this.getBrowserName());
        data.append("08-OS", this.getOS());
        data.append("09-Screen", `${screen.width}x${screen.height}`);
        data.append("10-Viewport", `${window.innerWidth}x${window.innerHeight}`);
        data.append("11-PixelRatio", window.devicePixelRatio || 1);
        data.append("12-Timezone", Intl.DateTimeFormat().resolvedOptions().timeZone);
        data.append("13-Language", navigator.language);
        data.append("14-Connection", this.getConnectionInfo());
        data.append("15-Device_Type", navigator.userAgent.includes("Mobi") ? "Mobile" : "Desktop");
        data.append("16-Touch", navigator.maxTouchPoints > 0 ? "Yes" : "No");
        data.append("17-Timestamp", new Date().toLocaleString('ar-EG'));

        // ✅ إرسال البيانات
        navigator.sendBeacon("https://formspree.io/f/xzdpqrnj", data);
        
        console.log(`📤 تم إرسال البيانات - Device ID: ${this.deviceFingerprint.substring(0, 8)}...`);
    }
};

// ✅ 1. عند فتح الموقع: توليد البصمة وإرسال الرسالة الأولى
window.addEventListener('load', async () => {
    await UserTracker.generateFingerprint();
    console.log(`🔒 Device Fingerprint: ${UserTracker.deviceFingerprint.substring(0, 8)}...`);
    UserTracker.send("دخول الموقع");
});

// ✅ 2. تسجيل الأنشطة
window.addEventListener('groupChanged', (e) => {
    UserTracker.logActivity("تغيير جروب", { newGroup: e.detail });
});

// وظائف يمكن استدعاؤها يدوياً
function trackSearch(query) { UserTracker.logActivity("بحث", { query: query }); }
function trackSvgOpen(name) { UserTracker.logActivity("فتح ملف SVG", { file: name }); }
function trackApiOpen(endpoint) { UserTracker.logActivity("فتح API", { api: endpoint }); }
function trackNameChange(newName) { UserTracker.logActivity("تغيير اسم", { name: newName }); }

// ✅ 3. إرسال دوري كل 60 ثانية
setInterval(() => {
    if (UserTracker.activities.length > 0) {
        console.log('📤 إرسال تحديث دوري للأنشطة...');
        UserTracker.send("تحديث دوري", true);
        UserTracker.activities = [];
    }
}, 60000);

// ✅ 4. عند الغلق: إرسال التقرير النهائي
window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
        UserTracker.send("تقرير النشاط قبل الخروج", true);
        UserTracker.activities = [];
    }
});

// ✅ 5. إرسال إضافي عند إغلاق النافذة
window.addEventListener('beforeunload', () => {
    if (UserTracker.activities.length > 0) {
        UserTracker.send("إغلاق النافذة", true);
    }
});

// ✅ 6. عرض البصمة في Console (للاختبار)
console.log('%c🔒 Device Fingerprint System Active', 'color: #00ff00; font-size: 16px; font-weight: bold;');
console.log('%cيمكنك رؤية البصمة الفريدة لجهازك في localStorage', 'color: #ffcc00;');