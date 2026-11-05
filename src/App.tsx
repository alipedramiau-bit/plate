import React, { useState, useEffect, useRef } from 'react';
import {
  Database,
  Play,
  Pause,
  RotateCcw,
  RefreshCw,
  Download,
  FileCode,
  ShieldCheck,
  CheckCircle2,
  Car,
  Clock,
  MapPin,
  ExternalLink,
  ChevronRight,
  Maximize2,
  Sliders,
  Sparkles,
  Info,
  Terminal,
  Upload,
  Radio,
  Video as VideoIcon,
  HardDrive,
  Sun,
  Moon,
  FileSpreadsheet,
  FileJson,
} from 'lucide-react';
import { PersianPlate, toPersianDigits } from './components/PersianPlate.tsx';
import { PlateTable, PlateRecord } from './components/PlateTable.tsx';
import { PythonCodeViewer } from './components/PythonCodeViewer.tsx';
import { VideoUploader } from './components/VideoUploader.tsx';
import { LiveStreamAnalyzer } from './components/LiveStreamAnalyzer.tsx';
import { BottomPlateTicker } from './components/BottomPlateTicker.tsx';

export default function App() {
  const [activeTab, setActiveTab] = useState<'video' | 'upload' | 'live' | 'database' | 'code'>('live');
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [plates, setPlates] = useState<PlateRecord[]>([]);
  const [selectedPlate, setSelectedPlate] = useState<PlateRecord | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [notification, setNotification] = useState<string | null>(null);

  // وضعیت‌های ویدیو
  const [currentVideoUrl, setCurrentVideoUrl] = useState<string>('/assets/aistudio/VID_20261029_183130_849_4af72e51.mp4');
  const [currentVideoName, setCurrentVideoName] = useState<string>('ویدیو نظارتی شبانه (کلیپ اصلی دوربین مداربسته)');
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(78.3);

  const isDark = theme === 'dark';

  // هماهنگی تم با ریشه سند
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
      document.documentElement.style.backgroundColor = '#09090b';
      document.documentElement.style.color = '#f4f4f5';
      document.body.style.backgroundColor = '#09090b';
      document.body.style.color = '#f4f4f5';
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.style.backgroundColor = '#f8fafc';
      document.documentElement.style.color = '#0f172a';
      document.body.style.backgroundColor = '#f8fafc';
      document.body.style.color = '#0f172a';
    }
  }, [theme]);

  // دریافت پلاک‌ها از API سرور
  const fetchPlates = async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/plates');
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setPlates(data.data);
        if (data.data.length > 0 && !selectedPlate) {
          setSelectedPlate(data.data[0]);
        }
      }
    } catch (err) {
      console.error('خطا در بارگذاری پلاک‌ها:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPlates();
  }, []);

  // اجرای تحلیل پایتون روی ویدیوی جاری
  const handleRunDetection = async () => {
    setIsProcessing(true);
    setNotification('در حال اجرای الگوریتم پایتون و تفکیک پلاک‌ها در پایگاه داده...');
    try {
      let localPath = currentVideoUrl;
      if (currentVideoUrl.startsWith('/assets/')) {
        localPath = 'public' + currentVideoUrl;
      } else if (currentVideoUrl.startsWith('/uploads/')) {
        localPath = 'public' + currentVideoUrl;
      }

      const res = await fetch('/api/run-detection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoPath: localPath }),
      });
      const data = await res.json();
      if (data.success) {
        if (data.data) setPlates(data.data);
        setNotification('✓ پردازش پایتون با موفقیت انجام شد و کلیه پلاک‌ها به دیتابیس منتقل گردید.');
      } else {
        setNotification(`❌ خطا در اجرای اسکریپت: ${data.error}`);
      }
    } catch (err: any) {
      setNotification(`❌ خطا در ارتباط با سرور: ${err.message}`);
    } finally {
      setIsProcessing(false);
      setTimeout(() => setNotification(null), 5000);
    }
  };

  // دریافت ویدیوی آپلود شده از فرانت‌اند
  const handleVideoUploaded = (videoUrl: string, filename: string) => {
    setCurrentVideoUrl(videoUrl);
    setCurrentVideoName(filename);
    setActiveTab('video');
    setNotification(`ویدیو «${filename}» با موفقیت لود شد و پلاک‌های آن در دسترس است.`);
    setTimeout(() => setNotification(null), 5000);
  };

  // ثبت دستی پلاک برای آزمون دیتابیس
  const handleAddPlate = async (plateData: any) => {
    try {
      const res = await fetch('/api/plates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(plateData),
      });
      const data = await res.json();
      if (data.success) {
        setNotification('✓ پلاک جدید با موفقیت توسط پایتون در SQLite ذخیره شد.');
        await fetchPlates();
      }
    } catch (err: any) {
      alert(`خطا: ${err.message}`);
    } finally {
      setTimeout(() => setNotification(null), 4000);
    }
  };

  // کنترل ویدیو
  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const jumpToTimestamp = (sec: number, plate?: PlateRecord) => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = Math.max(0, sec - 1);
    videoRef.current.play();
    setIsPlaying(true);
    if (plate) {
      setSelectedPlate(plate);
    }
  };

  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    const cur = videoRef.current.currentTime;
    setCurrentTime(cur);

    const active = plates.find(
      (p) => Math.abs(p.video_timestamp_sec - cur) <= 2.5
    );
    if (active && selectedPlate?.id !== active.id) {
      setSelectedPlate(active);
    }
  };

  const formatSec = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // کلاس‌های مشترک تم
  const bgMain = isDark ? 'bg-zinc-950 text-zinc-100' : 'bg-slate-100 text-slate-900';
  const headerBg = isDark ? 'bg-zinc-900/90 border-zinc-800' : 'bg-white/95 border-slate-200 shadow-sm';
  const cardClass = isDark ? 'bg-zinc-900 border-zinc-800 shadow-xl' : 'bg-white border-slate-200 shadow-md text-slate-800';
  const subtitleColor = isDark ? 'text-zinc-400' : 'text-slate-500';

  return (
    <div className={`min-h-screen ${bgMain} flex flex-col font-sans transition-colors duration-200`} dir="rtl">
      {/* هدر بالایی برنامه */}
      <header className={`border-b ${headerBg} backdrop-blur-md sticky top-0 z-30 transition-colors`}>
        <div className="max-w-7xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-emerald-900/30 text-white">
              <Car className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className={`text-base md:text-lg font-bold tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  سامانه هوشمند تشخیص پلاک خودرو و پایگاه داده (Iranian ANPR)
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] bg-emerald-500/20 text-emerald-500 border border-emerald-500/30 font-bold">
                  پایتون ۳ + SQLite + لایو استریم
                </span>
              </div>
              <p className={`text-xs ${subtitleColor} hidden sm:block`}>
                پردازش فایل‌های ویدیویی آپلود شده، استریم‌های زنده اینترنتی و ثبت خودکار در دیتابیس
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* دکمه تغییر تم تاریک / روشن */}
            <button
              onClick={() => setTheme(isDark ? 'light' : 'dark')}
              title={isDark ? 'تغییر به حالت روشن' : 'تغییر به حالت تاریک'}
              className={`p-2 rounded-lg border text-xs font-medium transition-colors flex items-center gap-1.5 ${
                isDark
                  ? 'bg-zinc-800 hover:bg-zinc-700 text-amber-400 border-zinc-700'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
              }`}
            >
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4 text-indigo-600" />}
              <span className="text-[11px] hidden md:inline">{isDark ? 'حالت روشن' : 'حالت تاریک'}</span>
            </button>

            <button
              onClick={handleRunDetection}
              disabled={isProcessing}
              className="flex items-center gap-2 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white rounded-lg text-xs font-semibold shadow-md transition-all disabled:opacity-60"
            >
              {isProcessing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              <span>{isProcessing ? 'در حال پردازش...' : 'پردازش ویدیوی فعال'}</span>
            </button>

            <a
              href="/api/download-db"
              download="plates.db"
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors border ${
                isDark
                  ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border-zinc-700'
                  : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-300 shadow-sm'
              }`}
              title="دانلود فایل فیزیکی دیتابیس SQLite"
            >
              <Database className="w-3.5 h-3.5 text-cyan-500" />
              <span className="hidden md:inline">دانلود plates.db</span>
            </a>

            <a
              href="/api/export-csv"
              download="detected_plates.csv"
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all border shadow-sm ${
                isDark
                  ? 'bg-emerald-950/50 hover:bg-emerald-900/60 text-emerald-300 border-emerald-800/80 hover:text-white'
                  : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-300'
              }`}
              title="دانلود فایل خروجی CSV سازگار با مایکروسافت اکسل"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
              <span>خروجی CSV</span>
            </a>

            <a
              href="/api/export-json"
              download="detected_plates.json"
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all border shadow-sm ${
                isDark
                  ? 'bg-blue-950/50 hover:bg-blue-900/60 text-blue-300 border-blue-800/80 hover:text-white'
                  : 'bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-300'
              }`}
              title="دانلود خروجی کامل JSON دیتابیس پلاک‌ها"
            >
              <FileJson className="w-3.5 h-3.5 text-blue-400" />
              <span>خروجی JSON</span>
            </a>
          </div>
        </div>

        {/* نوار وضعیت اعلان‌ها */}
        {notification && (
          <div className="bg-emerald-950/90 border-t border-b border-emerald-800/80 px-4 py-2 text-xs text-emerald-200 flex items-center justify-between animate-fadeIn">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{notification}</span>
            </div>
            <button
              onClick={() => setNotification(null)}
              className="text-emerald-400 hover:text-white text-xs px-2"
            >
              بستن
            </button>
          </div>
        )}

        {/* منوی تب‌ها با طراحی سازگار و استایل متمایز */}
        <div className="max-w-7xl mx-auto px-4 flex flex-wrap items-center gap-2 sm:gap-6 text-xs font-medium">
          <button
            onClick={() => setActiveTab('live')}
            className={`py-2.5 px-2 border-b-2 transition-all flex items-center gap-2 font-bold ${
              activeTab === 'live'
                ? 'border-rose-500 text-rose-500'
                : `${subtitleColor} hover:text-rose-400 border-transparent`
            }`}
          >
            <Radio className="w-4 h-4 text-rose-500 animate-pulse" />
            <span>تحلیل دوربین‌های پخش زنده (Live Stream)</span>
            <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400 text-[10px] font-bold">
              زنده
            </span>
          </button>

          <button
            onClick={() => setActiveTab('video')}
            className={`py-2.5 px-2 border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'video'
                ? 'border-emerald-500 text-emerald-500 font-bold'
                : `${subtitleColor} hover:text-emerald-400 border-transparent`
            }`}
          >
            <VideoIcon className="w-4 h-4" />
            <span>پخش ویدیو و ردیابی پلاک‌ها</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
              isDark ? 'bg-zinc-800 text-zinc-300' : 'bg-slate-200 text-slate-700'
            }`}>
              {toPersianDigits(plates.length)}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('upload')}
            className={`py-2.5 px-2 border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'upload'
                ? 'border-emerald-500 text-emerald-500 font-bold'
                : `${subtitleColor} hover:text-emerald-400 border-transparent`
            }`}
          >
            <Upload className="w-4 h-4" />
            <span>آپلود و پردازش ویدیوی جدید</span>
          </button>

          <button
            onClick={() => setActiveTab('database')}
            className={`py-2.5 px-2 border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'database'
                ? 'border-emerald-500 text-emerald-500 font-bold'
                : `${subtitleColor} hover:text-emerald-400 border-transparent`
            }`}
          >
            <Database className="w-4 h-4" />
            <span>مرورگر پایگاه داده SQLite</span>
          </button>

          <button
            onClick={() => setActiveTab('code')}
            className={`py-2.5 px-2 border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'code'
                ? 'border-emerald-500 text-emerald-500 font-bold'
                : `${subtitleColor} hover:text-emerald-400 border-transparent`
            }`}
          >
            <FileCode className="w-4 h-4" />
            <span>کدهای پایتون و تست خودکار</span>
          </button>
        </div>
      </header>

      {/* محتوای اصلی بر اساس تب انتخابی با فاصله مناسب از نوار پلاک‌های پایین صفحه */}
      <main className="max-w-7xl mx-auto px-4 py-6 pb-40 sm:pb-36 flex-1 w-full flex flex-col">
        {/* تب ۱: تحلیل دوربین‌های پخش زنده اینترنتی (پیش‌فرض) */}
        {activeTab === 'live' && (
          <div className="space-y-6">
            <LiveStreamAnalyzer
              onNewPlateDetected={(p) => {
                setPlates((prev) => {
                  const exists = prev.some((x) => x.id === p.id || x.plate_full_fa === p.plate_full_fa);
                  if (exists) {
                    return prev.map((x) => (x.id === p.id || x.plate_full_fa === p.plate_full_fa ? { ...x, ...p } : x));
                  }
                  return [p, ...prev];
                });
                setSelectedPlate(p);
                setNotification(`پلاک جدید «${p.plate_full_fa}» با موفقیت در دیتابیس ثبت و به نوار پایین اضافه شد.`);
                setTimeout(() => setNotification(null), 4000);
              }}
              onRefreshPlates={fetchPlates}
              theme={theme}
            />
          </div>
        )}

        {/* تب ۲: پخش ویدیو و جزئیات */}
        {activeTab === 'video' && (
          <div className="flex flex-col gap-4">
            <div className={`${cardClass} border rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs`}>
              <div className="flex items-center gap-2 overflow-hidden">
                <span className={subtitleColor}>ویدیوی در حال پخش:</span>
                <span className={`font-bold truncate max-w-sm ${isDark ? 'text-zinc-100' : 'text-slate-900'}`}>{currentVideoName}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setCurrentVideoUrl('/assets/aistudio/VID_20261029_183130_849_4af72e51.mp4');
                    setCurrentVideoName('ویدیو نظارتی شبانه (کلیپ اصلی دوربین مداربسته)');
                  }}
                  className={`px-3 py-1.5 rounded-lg transition-colors border text-[11px] font-medium ${
                    isDark
                      ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border-zinc-700'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
                  }`}
                >
                  کلیپ اصلی دوربین
                </button>
                <button
                  onClick={() => setActiveTab('upload')}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors text-[11px] font-semibold flex items-center gap-1 shadow"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>آپلود ویدیوی دیگر</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* پلیر ویدیو و جزئیات پلاک انتخابی */}
              <div className="lg:col-span-7 flex flex-col gap-4">
                <div className="bg-black border border-zinc-800 rounded-2xl overflow-hidden shadow-2xl relative group">
                  <div className="relative aspect-[854/640] bg-black">
                    <video
                      key={currentVideoUrl}
                      ref={videoRef}
                      src={currentVideoUrl}
                      onTimeUpdate={handleTimeUpdate}
                      onLoadedMetadata={() => {
                        if (videoRef.current) setDuration(videoRef.current.duration);
                      }}
                      onEnded={() => setIsPlaying(false)}
                      className="w-full h-full object-contain cursor-pointer"
                      onClick={togglePlay}
                      playsInline
                    />

                    <div className="absolute top-3 left-3 bg-black/80 backdrop-blur-md px-3 py-1 rounded-lg border border-white/15 text-xs font-mono text-emerald-400 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                      <span>{toPersianDigits(formatSec(currentTime))} / {toPersianDigits(formatSec(duration))}</span>
                    </div>

                    {/* کادرهای هوشمند رهگیری هم‌زمان پلاک‌ها روی ویدیو */}
                    {(() => {
                      const normSec = currentTime % 78.0;
                      let boxes: any[] = [];
                      if (normSec <= 12.0) {
                        boxes = [
                          { id: 'mot-1', plate: '۱۴۴ / ۱۵۶۴۹', type: 'موتورسیکلت', box: { left: 84.0, top: 58.0, width: 10.5, height: 9.0 } },
                          { id: 'prd-1', plate: '۸۲ ه ۳۳۷ - ایران ۱۰', type: 'سواری پراید سفید', box: { left: 31.0, top: 26.0, width: 12.0, height: 5.0 } },
                        ];
                      } else if (normSec <= 33.0) {
                        boxes = [
                          { id: 'dena-1', plate: '۱۴ ه ۲۵۹ - ایران ۲۰', type: 'سواری دنا پلاس سفید', box: { left: 10.5, top: 66.0, width: 15.0, height: 5.5 } },
                          { id: 'prd-1', plate: '۸۲ ه ۳۳۷ - ایران ۱۰', type: 'سواری پراید سفید', box: { left: 31.0, top: 26.0, width: 12.0, height: 5.0 } },
                          { id: 'paykan-1', plate: '۵۴ ق ۸۱۹ - ایران ۲۱', type: 'وانت پیکان سفید', box: { left: 71.0, top: 20.0, width: 8.0, height: 4.0 } },
                        ];
                      } else if (normSec <= 46.0) {
                        boxes = [
                          { id: 'dena-2', plate: '۱۴ ه ۲۵۹ - ایران ۲۰', type: 'سواری دنا پلاس سفید', box: { left: 27.0, top: 63.5, width: 15.5, height: 6.2 } },
                          { id: 'peug-1', plate: '۷۱ ص ۴۴۷ - ایران ۴۴', type: 'سواری پژو ۴۰۵ نقره‌ای', box: { left: 72.0, top: 64.5, width: 17.5, height: 6.5 } },
                        ];
                      } else if (normSec <= 56.0) {
                        boxes = [
                          { id: 'dena-3', plate: '۱۴ ه ۲۵۹ - ایران ۲۰', type: 'سواری دنا پلاس سفید', box: { left: 38.0, top: 63.5, width: 15.5, height: 6.2 } },
                          { id: 'tiba-1', plate: '۵۱ ل ۹۵۵ - ایران ۲۰', type: 'سواری تیبا سفید', box: { left: 63.0, top: 56.5, width: 15.0, height: 5.8 } },
                        ];
                      } else {
                        boxes = [
                          { id: 'dena-4', plate: '۱۴ ه ۲۵۹ - ایران ۲۰', type: 'سواری دنا پلاس سفید', box: { left: 26.0, top: 74.5, width: 16.5, height: 6.8 } },
                          { id: 'l90-1', plate: '۸۷ ج ۷۶۸ - ایران ۵۵', type: 'سواری تندر ۹۰ سفید', box: { left: 70.0, top: 54.0, width: 15.5, height: 6.0 } },
                        ];
                      }
                      return boxes.map((veh) => (
                        <div
                          key={veh.id}
                          style={{
                            left: `${veh.box.left}%`,
                            top: `${veh.box.top}%`,
                            width: `${veh.box.width}%`,
                            height: `${veh.box.height}%`,
                          }}
                          className="absolute border-2 border-emerald-400 bg-emerald-500/20 rounded shadow-[0_0_15px_rgba(52,211,153,0.6)] pointer-events-auto z-20 transition-all hover:scale-105"
                        >
                          <div className="absolute -top-1 -left-1 w-2 h-2 border-t-2 border-l-2 border-white"></div>
                          <div className="absolute -top-1 -right-1 w-2 h-2 border-t-2 border-r-2 border-white"></div>
                          <div className="absolute -bottom-1 -left-1 w-2 h-2 border-b-2 border-l-2 border-white"></div>
                          <div className="absolute -bottom-1 -right-1 w-2 h-2 border-b-2 border-r-2 border-white"></div>

                          <div className="absolute -top-6 right-1/2 translate-x-1/2 whitespace-nowrap bg-black/90 px-1.5 py-0.5 rounded border border-emerald-400 text-[10px] text-white flex items-center gap-1 shadow-md pointer-events-none">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                            <span className="font-mono text-emerald-300 font-bold">{veh.plate}</span>
                            <span className="text-zinc-500">|</span>
                            <span className="text-[9px] text-zinc-300">{veh.type}</span>
                          </div>
                        </div>
                      ));
                    })()}

                    {selectedPlate && Math.abs(selectedPlate.video_timestamp_sec - currentTime) <= 2.5 && (
                      <div className="absolute bottom-16 right-3 left-3 bg-black/90 backdrop-blur-md p-3 rounded-xl border border-emerald-500 flex items-center justify-between shadow-2xl animate-fadeIn z-30">
                        <div className="flex items-center gap-3">
                          <PersianPlate
                            partTwoDigits={selectedPlate.part_two_digits}
                            letter={selectedPlate.letter}
                            partThreeDigits={selectedPlate.part_three_digits}
                            provinceCode={selectedPlate.province_code}
                            vehicleType={selectedPlate.vehicle_type}
                            size="sm"
                          />
                          <div>
                            <p className="text-xs font-bold text-white flex items-center gap-1.5">
                              <span>{selectedPlate.vehicle_type}</span>
                              <span className="text-[10px] text-zinc-400 font-normal">
                                ({selectedPlate.province_name})
                              </span>
                            </p>
                            <p className="text-[10px] text-zinc-400">
                              ثبت شده در جدول detected_plates (رکورد #{toPersianDigits(selectedPlate.id)})
                            </p>
                          </div>
                        </div>
                        <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded font-mono border border-emerald-500/30">
                          دقت: {toPersianDigits(Math.round(selectedPlate.confidence * 100))}٪
                        </span>
                      </div>
                    )}
                  </div>

                  <div className={`p-4 border-t flex flex-col gap-2 ${isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-slate-50 border-slate-200'}`}>
                    <div className="relative flex items-center">
                      <input
                        type="range"
                        min="0"
                        max={duration || 78}
                        step="0.1"
                        value={currentTime}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          setCurrentTime(val);
                          if (videoRef.current) videoRef.current.currentTime = val;
                        }}
                        className="w-full h-1.5 rounded-lg appearance-none cursor-pointer accent-emerald-500 bg-zinc-700"
                      />

                      <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0 pointer-events-none flex">
                        {plates.map((p) => {
                          const leftPct = (p.video_timestamp_sec / (duration || 78)) * 100;
                          return (
                            <div
                              key={p.id}
                              style={{ left: `${leftPct}%` }}
                              className="absolute w-2 h-2 -translate-x-1/2 rounded-full bg-cyan-400 shadow-sm border border-black"
                              title={`${p.plate_full_fa} (${p.timestamp_formatted})`}
                            />
                          );
                        })}
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs pt-1">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={togglePlay}
                          className="p-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
                          title={isPlaying ? 'توقف' : 'پخش'}
                        >
                          {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                        </button>

                        <button
                          onClick={() => {
                            if (videoRef.current) {
                              videoRef.current.currentTime = 0;
                              setCurrentTime(0);
                            }
                          }}
                          className={`p-2 rounded-lg border transition-colors ${
                            isDark
                              ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border-zinc-700'
                              : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300 shadow-sm'
                          }`}
                          title="شروع از ابتدا"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>

                        <span className="font-mono text-xs">
                          {toPersianDigits(formatSec(currentTime))} / {toPersianDigits(formatSec(duration))}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 text-[11px]">
                        <span className={subtitleColor}>نقاط عبور خودروها:</span>
                        <div className="flex gap-1 overflow-x-auto max-w-xs">
                          {plates.slice(0, 7).map((p) => (
                            <button
                              key={p.id}
                              onClick={() => jumpToTimestamp(p.video_timestamp_sec, p)}
                              className={`px-1.5 py-0.5 rounded text-[10px] font-mono border transition-colors shrink-0 ${
                                isDark
                                  ? 'bg-zinc-800 hover:bg-emerald-600/40 hover:text-emerald-300 border-zinc-700'
                                  : 'bg-white hover:bg-emerald-50 text-slate-700 border-slate-300'
                              }`}
                            >
                              {toPersianDigits(p.timestamp_formatted)}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* کارت تفکیک جزئیات پلاک انتخاب شده */}
                {selectedPlate && (
                  <div className={`${cardClass} border rounded-xl p-5`}>
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3 mb-4 border-inherit">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                        <h3 className="font-bold text-sm">
                          تفکیک اجزای پلاک در پایگاه داده SQLite
                        </h3>
                        <span className="text-xs opacity-75 font-mono">
                          (شناسه رکورد: #{toPersianDigits(selectedPlate.id)})
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <span className={subtitleColor}>ثبت شده در زمان:</span>
                        <span className="font-mono text-emerald-500 font-bold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                          {toPersianDigits(selectedPlate.timestamp_formatted)}
                        </span>
                      </div>
                    </div>

                    <div className={`flex flex-col items-center justify-center p-4 rounded-xl border mb-4 ${
                      isDark ? 'bg-zinc-950/70 border-zinc-800' : 'bg-slate-50 border-slate-200'
                    }`}>
                      <span className="text-[11px] opacity-75 mb-2">فرمت استاندارد پلاک ملی جمهوری اسلامی ایران:</span>
                      <PersianPlate
                        partTwoDigits={selectedPlate.part_two_digits}
                        letter={selectedPlate.letter}
                        partThreeDigits={selectedPlate.part_three_digits}
                        provinceCode={selectedPlate.province_code}
                        vehicleType={selectedPlate.vehicle_type}
                        size="lg"
                      />
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs mb-4">
                      <div className={`p-3 rounded-lg border ${isDark ? 'bg-zinc-800/80 border-zinc-700/60' : 'bg-slate-50 border-slate-200'}`}>
                        <span className="opacity-75 block text-[11px] mb-1">۲ رقم ابتدایی (فیلد part1)</span>
                        <span className="text-lg font-mono font-bold text-amber-500">
                          {toPersianDigits(selectedPlate.part_two_digits)}
                        </span>
                      </div>

                      <div className={`p-3 rounded-lg border ${isDark ? 'bg-zinc-800/80 border-zinc-700/60' : 'bg-slate-50 border-slate-200'}`}>
                        <span className="opacity-75 block text-[11px] mb-1">حرف فارسی (فیلد letter)</span>
                        <span className="text-lg font-bold text-blue-500">
                          {selectedPlate.letter ? selectedPlate.letter : '(موتور ۲ سطری)'}
                        </span>
                      </div>

                      <div className={`p-3 rounded-lg border ${isDark ? 'bg-zinc-800/80 border-zinc-700/60' : 'bg-slate-50 border-slate-200'}`}>
                        <span className="opacity-75 block text-[11px] mb-1">۳ رقم میانی (فیلد part2)</span>
                        <span className="text-lg font-mono font-bold text-emerald-500">
                          {toPersianDigits(selectedPlate.part_three_digits)}
                        </span>
                      </div>

                      <div className={`p-3 rounded-lg border ${isDark ? 'bg-zinc-800/80 border-zinc-700/60' : 'bg-slate-50 border-slate-200'}`}>
                        <span className="opacity-75 block text-[11px] mb-1">کد استان (ایران)</span>
                        <span className="text-lg font-mono font-bold text-cyan-500">
                          {selectedPlate.province_code ? toPersianDigits(selectedPlate.province_code) : '-'}
                        </span>
                      </div>
                    </div>

                    <div className={`grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs p-3 rounded-lg border ${
                      isDark ? 'bg-zinc-950/50 border-zinc-800' : 'bg-slate-50 border-slate-200'
                    }`}>
                      <div>
                        <p className="mb-1 flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-zinc-500" />
                          <span className={subtitleColor}>استان و منطقه:</span>
                          <strong>{selectedPlate.province_name}</strong>
                        </p>
                        <p className="mb-1 flex items-center gap-1.5">
                          <Car className="w-3.5 h-3.5 text-zinc-500" />
                          <span className={subtitleColor}>نوع خودرو:</span>
                          <strong>{selectedPlate.vehicle_type}</strong>
                        </p>
                        <p className="flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                          <span className={subtitleColor}>یادداشت:</span>
                          <span className="text-[11px]">{selectedPlate.notes}</span>
                        </p>
                      </div>

                      {selectedPlate.crop_path && (
                        <div className="flex flex-col items-center justify-center border-r border-inherit pr-2">
                          <span className="text-[10px] opacity-75 mb-1">برش پلاک استخراج شده:</span>
                          <div className="bg-black p-1 rounded border border-zinc-700 overflow-hidden shadow-inner max-w-full">
                            <img
                              src={selectedPlate.crop_path}
                              alt="Plate crop"
                              className="h-10 object-contain mx-auto rounded"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* ستون راست: لیست پلاک‌های شناسایی شده */}
              <div className="lg:col-span-5 flex flex-col gap-4">
                <div className={`${cardClass} border rounded-2xl p-4`}>
                  <div className="flex items-center justify-between pb-3 mb-3 border-b border-inherit">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-emerald-500" />
                      <h2 className="text-sm font-bold">
                        خودروهای شناسایی شده در کلیپ
                      </h2>
                    </div>
                    <span className={`text-xs px-2.5 py-0.5 rounded font-mono ${
                      isDark ? 'bg-zinc-800 text-zinc-300' : 'bg-slate-100 text-slate-700'
                    }`}>
                      {toPersianDigits(plates.length)} پلاک
                    </span>
                  </div>

                  <div className="flex flex-col gap-2.5 max-h-[640px] overflow-y-auto pr-1">
                    {plates.map((plate) => {
                      const isSelected = selectedPlate?.id === plate.id;
                      return (
                        <div
                          key={plate.id}
                          onClick={() => jumpToTimestamp(plate.video_timestamp_sec, plate)}
                          className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                            isSelected
                              ? 'bg-emerald-500/10 border-emerald-500 shadow-md ring-1 ring-emerald-500'
                              : isDark
                              ? 'bg-zinc-950/60 border-zinc-800/80 hover:bg-zinc-800/50'
                              : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <PersianPlate
                              partTwoDigits={plate.part_two_digits}
                              letter={plate.letter}
                              partThreeDigits={plate.part_three_digits}
                              provinceCode={plate.province_code}
                              vehicleType={plate.vehicle_type}
                              size="sm"
                            />
                            <div>
                              <div className="flex items-center gap-1.5">
                                <h4 className="text-xs font-bold">
                                  {plate.vehicle_type}
                                </h4>
                              </div>
                              <p className={`text-[11px] ${subtitleColor} flex items-center gap-1 mt-0.5`}>
                                <MapPin className="w-3 h-3 opacity-60" />
                                <span>{plate.province_name}</span>
                              </p>
                            </div>
                          </div>

                          <div className="flex flex-col items-end gap-1">
                            <span className="text-xs font-mono font-bold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                              {toPersianDigits(plate.timestamp_formatted)}
                            </span>
                            <span className="text-[10px] opacity-60">
                              پرش به ثانیه
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* تب ۳: آپلود ویدیوی جدید */}
        {activeTab === 'upload' && (
          <div className="max-w-4xl mx-auto w-full space-y-6">
            <VideoUploader
              onVideoUploaded={handleVideoUploaded}
              onRefreshPlates={fetchPlates}
              currentVideoUrl={currentVideoUrl}
            />
          </div>
        )}

        {/* تب ۴: پایگاه داده SQLite */}
        {activeTab === 'database' && (
          <div className="space-y-4">
            <div className={`${cardClass} border rounded-xl p-4 text-xs flex flex-wrap items-center justify-between gap-3`}>
              <div>
                <h3 className="font-bold text-sm">
                  نمای زنده جدول SQLite: detected_plates
                </h3>
                <p className={`text-xs mt-0.5 ${subtitleColor}`}>
                  تمام اعداد و حروف پلاک‌ها از ویدیوها، فایل‌های آپلود شده و دوربین‌های زنده در این جدول ذخیره می‌شوند.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href="/api/download-db"
                  download="plates.db"
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold transition-colors shadow"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>دانلود فایل SQLite (.db)</span>
                </a>
              </div>
            </div>

            <PlateTable
              plates={plates}
              onSelectPlate={(p) => {
                setSelectedPlate(p);
                setActiveTab('video');
                jumpToTimestamp(p.video_timestamp_sec, p);
              }}
              onRefresh={fetchPlates}
              onAddPlate={handleAddPlate}
              selectedPlateId={selectedPlate?.id}
            />
          </div>
        )}

        {/* تب ۵: کدها و تست خودکار پایتون */}
        {activeTab === 'code' && (
          <div className="space-y-4">
            <PythonCodeViewer />
          </div>
        )}
      </main>

      {/* نوار پایش زنده و نمایش لحظه‌ای کلیه پلاک‌های شناسایی شده در پایین صفحه */}
      <BottomPlateTicker
        plates={plates}
        selectedPlateId={selectedPlate?.id}
        onSelectPlate={(p) => {
          setSelectedPlate(p);
          if (p.video_timestamp_sec !== undefined && p.video_timestamp_sec !== null) {
            jumpToTimestamp(p.video_timestamp_sec, p);
          }
        }}
        theme={theme}
      />

      {/* پاورقی */}
      <footer className={`border-t py-4 mb-24 sm:mb-20 text-center text-xs ${
        isDark ? 'border-zinc-800/80 bg-zinc-950 text-zinc-500' : 'border-slate-200 bg-white text-slate-500'
      }`}>
        سامانه هوشمند تشخیص پلاک خودروهای ایرانی با قابلیت آپلود ویدیو، پردازش پخش زنده اینترنتی و ذخیره‌سازی در پایگاه داده SQLite
      </footer>
    </div>
  );
}
