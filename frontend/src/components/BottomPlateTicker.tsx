import React, { useState } from 'react';
import { PersianPlate, toPersianDigits } from './PersianPlate.tsx';
import { PlateRecord } from './PlateTable.tsx';
import {
  Car,
  Clock,
  MapPin,
  Download,
  FileSpreadsheet,
  FileJson,
  ChevronUp,
  ChevronDown,
  Sparkles,
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
  Activity,
  Layers,
} from 'lucide-react';

interface BottomPlateTickerProps {
  plates: PlateRecord[];
  selectedPlateId?: number;
  onSelectPlate: (plate: PlateRecord) => void;
  theme?: 'dark' | 'light';
}

export const BottomPlateTicker: React.FC<BottomPlateTickerProps> = ({
  plates,
  selectedPlateId,
  onSelectPlate,
  theme = 'dark',
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(true);
  const isDark = theme === 'dark';

  // متد دانلود محلی فایل JSON به صورت امن
  const handleClientExportJSON = () => {
    if (plates.length === 0) return;
    const blob = new Blob([JSON.stringify(plates, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `iranian_plates_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // متد دانلود محلی فایل CSV اکسل با کدگذاری UTF-8 BOM
  const handleClientExportCSV = () => {
    if (plates.length === 0) return;
    let csv = '\uFEFF'; // UTF-8 BOM برای نمایش درست حروف فارسی در نرم‌افزار اکسل
    csv += 'شناسه,پلاک کامل فارسی,پلاک انگلیسی,دو رقم,حرف,سه رقم,کد استان,استان,نوع خودرو,درصد دقت,زمان در ویدیو,تاریخ اولین رویت,تعداد مشاهده,نوع منبع\n';

    plates.forEach((p) => {
      csv += `"${p.id}","${p.plate_full_fa}","${p.plate_full_en}","${p.part_two_digits}","${p.letter}","${p.part_three_digits}","${p.province_code}","${p.province_name}","${p.vehicle_type}","${p.confidence}","${p.timestamp_formatted}","${p.first_seen}","${p.detection_count}","${p.notes || ''}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `iranian_plates_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const latestPlate = plates.length > 0 ? plates[0] : null;

  return (
    <aside
      aria-label="نوار پایش زنده پلاک‌های شناسایی شده"
      className={`fixed bottom-0 left-0 right-0 z-40 transition-all duration-300 ${
        isDark
          ? 'bg-zinc-950/95 border-t border-zinc-800 text-zinc-100 shadow-[0_-8px_30px_rgba(0,0,0,0.7)]'
          : 'bg-white/95 border-t border-slate-200 text-slate-800 shadow-[0_-6px_25px_rgba(0,0,0,0.1)]'
      } backdrop-blur-md select-none`}
    >
      {/* نوار هدر ابزارها و آمار پلاک‌ها */}
      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2 flex items-center justify-between gap-2 text-xs border-b border-zinc-800/40">
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          {/* نشانگر ردیابی زنده */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
            <span>پلاک‌های شناسایی‌شده زنده:</span>
            <span className="font-mono text-sm px-1.5 py-0.2 bg-emerald-500/20 rounded">
              {toPersianDigits(plates.length)}
            </span>
            <span className="text-[10px] text-emerald-500/80 hidden sm:inline">مورد در دیتابیس</span>
          </div>

          {/* آخرین خودروی شکار شده */}
          {latestPlate && (
            <div className="hidden md:flex items-center gap-2 text-[11px] text-zinc-400 bg-zinc-900/80 px-2.5 py-1 rounded-lg border border-zinc-800">
              <span className="text-zinc-500">آخرین پلاک ثبت‌شده:</span>
              <span className="font-bold text-zinc-200 font-mono">{latestPlate.plate_full_fa}</span>
              <span className="text-zinc-600">|</span>
              <span className="text-emerald-400">{latestPlate.vehicle_type}</span>
              <span className="text-zinc-600">|</span>
              <span className="text-amber-400 font-mono text-[10px]">{toPersianDigits(latestPlate.timestamp_formatted)}</span>
            </div>
          )}
        </div>

        {/* دکمه‌های سریع اکسپورت و دانلود */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* دکمه دانلود CSV اکسل */}
          <button
            onClick={handleClientExportCSV}
            title="دانلود فایل خروجی CSV سازگار با مایکروسافت اکسل"
            className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow-sm transition-all active:scale-95"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">خروجی CSV (اکسل)</span>
            <span className="sm:hidden">CSV</span>
          </button>

          {/* دکمه دانلود JSON */}
          <button
            onClick={handleClientExportJSON}
            title="دانلود فایل JSON اطلاعات کامل پلاک‌ها"
            className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold shadow-sm transition-all active:scale-95"
          >
            <FileJson className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">خروجی JSON</span>
            <span className="sm:hidden">JSON</span>
          </button>

          {/* لینک سروری دیتابیس SQLite */}
          <a
            href="/api/download-db"
            download="plates.db"
            title="دانلود مستقیم فایل دیتابیس SQLite (.db)"
            className="hidden lg:flex items-center gap-1 px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg text-xs transition-colors border border-zinc-700"
          >
            <Download className="w-3.5 h-3.5 text-zinc-400" />
            <span>SQLite (.db)</span>
          </a>

          {/* کلید باز و بسته کردن نوار پایین */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            title={isExpanded ? 'کوچک‌سازی نوار' : 'گسترش نوار پلاک‌ها'}
            className="p-1 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/80 rounded-lg transition-colors border border-transparent hover:border-zinc-700"
          >
            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* محتوای کارتی کاروسل افقی پلاک‌ها */}
      {isExpanded && (
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2.5">
          {plates.length === 0 ? (
            <div className="py-3 text-center text-xs text-zinc-500 flex items-center justify-center gap-2">
              <Activity className="w-4 h-4 animate-pulse text-emerald-500" />
              <span>
                در حال پایش و شنود... با شروع پخش ویدیو یا فشردن دکمه «اسکن فریم» یا «فعال‌سازی پایش خودکار»، پلاک‌ها به
                صورت خودکار در این نوار پایین ثبت و نمایش داده می‌شوند.
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-3 overflow-x-auto pb-1.5 pt-0.5 scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent">
              {plates.map((plate) => {
                const isSelected = selectedPlateId === plate.id;
                return (
                  <div
                    key={plate.id}
                    onClick={() => onSelectPlate(plate)}
                    className={`shrink-0 p-2 rounded-xl border transition-all cursor-pointer flex items-center gap-2.5 text-xs group ${
                      isSelected
                        ? 'bg-emerald-500/15 border-emerald-500 ring-2 ring-emerald-500/50 shadow-lg shadow-emerald-950/40'
                        : isDark
                        ? 'bg-zinc-900/90 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-850'
                        : 'bg-slate-50 border-slate-200 hover:border-slate-300 hover:bg-white'
                    }`}
                  >
                    {/* تصویر گرافیکی پلاک ملی ایران */}
                    <div className="transform transition-transform group-hover:scale-105">
                      <PersianPlate
                        partTwoDigits={plate.part_two_digits}
                        letter={plate.letter}
                        partThreeDigits={plate.part_three_digits}
                        provinceCode={plate.province_code}
                        vehicleType={plate.vehicle_type}
                        size="sm"
                      />
                    </div>

                    {/* اطلاعات پلاک و خودرو */}
                    <div className="flex flex-col gap-0.5 min-w-[110px]">
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-bold text-zinc-100 text-[11px] truncate max-w-[120px]">
                          {plate.vehicle_type}
                        </span>
                        <span className="text-[10px] font-mono text-emerald-400 font-bold bg-emerald-500/10 px-1 py-0.2 rounded">
                          {Math.round((plate.confidence || 0.95) * 100)}%
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 text-[10px] text-zinc-400">
                        <span className="flex items-center gap-0.5 truncate text-zinc-400">
                          <MapPin className="w-2.5 h-2.5 text-zinc-500" />
                          {plate.province_name}
                        </span>
                        <span className="text-zinc-600">•</span>
                        <span className="font-mono text-amber-400 bg-amber-500/10 px-1 rounded">
                          {toPersianDigits(plate.timestamp_formatted || '00:00')}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </aside>
  );
};
