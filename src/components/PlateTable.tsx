import React, { useState } from 'react';
import { PersianPlate, toPersianDigits } from './PersianPlate.tsx';
import { Search, Filter, Plus, Clock, MapPin, Eye, Car, CheckCircle2, RefreshCw, FileSpreadsheet, FileJson } from 'lucide-react';

export interface PlateRecord {
  id: number;
  plate_full_fa: string;
  plate_full_en: string;
  part_two_digits: string;
  letter: string;
  part_three_digits: string;
  province_code: string;
  province_name: string;
  vehicle_type: string;
  confidence: number;
  video_timestamp_sec: number;
  timestamp_formatted: string;
  first_seen: string;
  last_seen: string;
  detection_count: number;
  frame_path?: string;
  crop_path?: string;
  notes?: string;
  box_pct?: { left: number; top: number; width: number; height: number };
}

interface PlateTableProps {
  plates: PlateRecord[];
  onSelectPlate: (plate: PlateRecord) => void;
  onRefresh: () => void;
  onAddPlate: (plate: any) => Promise<void>;
  selectedPlateId?: number;
}

export const PlateTable: React.FC<PlateTableProps> = ({
  plates,
  onSelectPlate,
  onRefresh,
  onAddPlate,
  selectedPlateId,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // فرم ثبت دستی
  const [newPlate, setNewPlate] = useState({
    part_two_digits: '38',
    letter: 'ب',
    part_three_digits: '614',
    province_code: '21',
    vehicle_type: 'سواری پژو پارس',
    notes: 'تست درج دستی از طریق پنل کاربری برای آزمون دیتابیس',
  });

  const handleCreatePlate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onAddPlate(newPlate);
      setShowAddModal(false);
      onRefresh();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredPlates = plates.filter((plate) => {
    const matchesSearch =
      plate.plate_full_fa?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      plate.plate_full_en?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      plate.part_two_digits?.includes(searchTerm) ||
      plate.part_three_digits?.includes(searchTerm) ||
      plate.province_name?.includes(searchTerm) ||
      plate.vehicle_type?.includes(searchTerm);

    if (filterType === 'car') {
      return matchesSearch && !plate.vehicle_type.includes('موتور');
    }
    if (filterType === 'motor') {
      return matchesSearch && plate.vehicle_type.includes('موتور');
    }
    return matchesSearch;
  });

  return (
    <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl overflow-hidden shadow-2xl flex flex-col">
      {/* هدر جدول و ابزارهای جستجو */}
      <div className="p-4 border-b border-zinc-800 flex flex-wrap items-center justify-between gap-3 bg-zinc-900/60">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              placeholder="جستجو بر اساس پلاک، عدد، حرف، استان یا نوع خودرو..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-zinc-800 border border-zinc-700/80 rounded-lg pr-9 pl-3 py-1.5 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 w-64 md:w-80"
            />
          </div>

          <div className="flex items-center gap-1 bg-zinc-800 border border-zinc-700/80 rounded-lg p-0.5 text-xs">
            <button
              onClick={() => setFilterType('all')}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                filterType === 'all' ? 'bg-emerald-600 text-white font-medium' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              همه ({toPersianDigits(plates.length)})
            </button>
            <button
              onClick={() => setFilterType('car')}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                filterType === 'car' ? 'bg-emerald-600 text-white font-medium' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              خودروها
            </button>
            <button
              onClick={() => setFilterType('motor')}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                filterType === 'motor' ? 'bg-emerald-600 text-white font-medium' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              موتورسیکلت
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* دکمه‌های صادرات اطلاعات */}
          <a
            href="/api/export-csv"
            download="detected_plates.csv"
            title="دانلود فایل خروجی CSV سازگار با اکسل"
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-emerald-700/80 hover:bg-emerald-600 text-white rounded-lg text-xs font-medium transition-all shadow-sm border border-emerald-600"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>خروجی CSV (اکسل)</span>
          </a>

          <a
            href="/api/export-json"
            download="detected_plates.json"
            title="دانلود اطلاعات کامل پلاک‌ها در قالب فایل JSON"
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-blue-700/80 hover:bg-blue-600 text-white rounded-lg text-xs font-medium transition-all shadow-sm border border-blue-600"
          >
            <FileJson className="w-3.5 h-3.5" />
            <span>خروجی JSON</span>
          </a>

          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600/90 hover:bg-emerald-600 text-white rounded-lg text-xs font-medium transition-all shadow-md active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>ثبت پلاک جدید</span>
          </button>

          <button
            onClick={onRefresh}
            title="به‌روزرسانی داده‌ها از دیتابیس"
            className="p-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg transition-colors border border-zinc-700"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* محتوای جدول */}
      <div className="overflow-x-auto flex-1 max-h-[500px]">
        <table className="w-full text-right text-xs">
          <thead className="bg-zinc-950/70 text-zinc-400 border-b border-zinc-800 sticky top-0 z-10 font-medium">
            <tr>
              <th className="py-2.5 px-3 text-center">شناسه</th>
              <th className="py-2.5 px-3 text-center">پلاک ملی ایران</th>
              <th className="py-2.5 px-3 text-center">تفکیک ۲ رقم</th>
              <th className="py-2.5 px-3 text-center">حرف</th>
              <th className="py-2.5 px-3 text-center">۳ رقم</th>
              <th className="py-2.5 px-3 text-center">کد استان</th>
              <th className="py-2.5 px-3">استان صادرکننده</th>
              <th className="py-2.5 px-3">نوع وسیله</th>
              <th className="py-2.5 px-3 text-center">زمان ویدیو</th>
              <th className="py-2.5 px-3 text-center">دقت</th>
              <th className="py-2.5 px-3 text-center">تعداد رویت</th>
              <th className="py-2.5 px-3 text-center">عملیات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/60 text-zinc-300">
            {filteredPlates.length === 0 ? (
              <tr>
                <td colSpan={12} className="py-8 text-center text-zinc-500 text-sm">
                  موردی با این مشخصات یافت نشد.
                </td>
              </tr>
            ) : (
              filteredPlates.map((plate) => {
                const isSelected = selectedPlateId === plate.id;
                return (
                  <tr
                    key={plate.id}
                    onClick={() => onSelectPlate(plate)}
                    className={`cursor-pointer transition-colors hover:bg-zinc-800/60 ${
                      isSelected ? 'bg-emerald-950/40 border-r-4 border-r-emerald-500' : ''
                    }`}
                  >
                    <td className="py-2.5 px-3 text-center font-mono text-zinc-500">
                      #{toPersianDigits(plate.id)}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <PersianPlate
                        partTwoDigits={plate.part_two_digits}
                        letter={plate.letter}
                        partThreeDigits={plate.part_three_digits}
                        provinceCode={plate.province_code}
                        vehicleType={plate.vehicle_type}
                        size="sm"
                      />
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono font-bold text-amber-300">
                      {toPersianDigits(plate.part_two_digits)}
                    </td>
                    <td className="py-2.5 px-3 text-center font-bold text-blue-400">
                      {plate.letter ? (
                        <span className="px-1.5 py-0.5 rounded bg-blue-950 border border-blue-800 text-blue-200">
                          {plate.letter}
                        </span>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono font-bold text-emerald-300">
                      {toPersianDigits(plate.part_three_digits)}
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono font-bold text-cyan-300">
                      {plate.province_code ? (
                        <span className="px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700">
                          {toPersianDigits(plate.province_code)}
                        </span>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-zinc-300 font-medium">
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-3 h-3 text-zinc-500 shrink-0" />
                        <span className="truncate max-w-[130px]">{plate.province_name || 'نامشخص'}</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-zinc-300">
                      <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 text-[11px]">
                        {plate.vehicle_type}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono text-emerald-400">
                      <div className="flex items-center justify-center gap-1">
                        <Clock className="w-3 h-3 text-zinc-500" />
                        <span>{toPersianDigits(plate.timestamp_formatted)}</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono">
                      <span className="text-emerald-400 font-semibold">
                        {toPersianDigits(Math.round(plate.confidence * 100))}٪
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono text-zinc-300">
                      <span className="px-1.5 py-0.5 rounded-full bg-zinc-800 text-zinc-400">
                        {toPersianDigits(plate.detection_count || 1)}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectPlate(plate);
                        }}
                        className="p-1 text-zinc-400 hover:text-emerald-400 hover:bg-zinc-700/50 rounded transition-colors"
                        title="مشاهده جزئیات فریم و پلاک"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* مدال ثبت دستی پلاک برای راستی‌آزمایی دیتابیس */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6 max-w-md w-full shadow-2xl">
            <h3 className="text-base font-bold text-zinc-100 mb-1 flex items-center gap-2">
              <Plus className="w-4 h-4 text-emerald-400" />
              <span>افزودن پلاک جدید به دیتابیس SQLite</span>
            </h3>
            <p className="text-xs text-zinc-400 mb-4">
              با این فرم می‌توانید انتقال مستقیم اعداد و حروف پلاک به دیتابیس را تست و اعتبارسنجی نمایید.
            </p>

            <form onSubmit={handleCreatePlate} className="space-y-3 text-xs">
              <div className="grid grid-cols-4 gap-2">
                <div>
                  <label className="block text-zinc-400 mb-1 font-medium">۲ رقم سمت چپ</label>
                  <input
                    type="text"
                    maxLength={2}
                    required
                    value={newPlate.part_two_digits}
                    onChange={(e) => setNewPlate({ ...newPlate, part_two_digits: e.target.value })}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded p-2 text-center text-sm font-bold text-amber-300 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    placeholder="38"
                  />
                </div>
                <div>
                  <label className="block text-zinc-400 mb-1 font-medium">حرف پلاک</label>
                  <input
                    type="text"
                    maxLength={1}
                    required
                    value={newPlate.letter}
                    onChange={(e) => setNewPlate({ ...newPlate, letter: e.target.value })}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded p-2 text-center text-sm font-bold text-blue-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    placeholder="ب"
                  />
                </div>
                <div>
                  <label className="block text-zinc-400 mb-1 font-medium">۳ رقم وسط</label>
                  <input
                    type="text"
                    maxLength={3}
                    required
                    value={newPlate.part_three_digits}
                    onChange={(e) => setNewPlate({ ...newPlate, part_three_digits: e.target.value })}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded p-2 text-center text-sm font-bold text-emerald-300 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    placeholder="614"
                  />
                </div>
                <div>
                  <label className="block text-zinc-400 mb-1 font-medium">کد ۲ رقمی استان</label>
                  <input
                    type="text"
                    maxLength={2}
                    required
                    value={newPlate.province_code}
                    onChange={(e) => setNewPlate({ ...newPlate, province_code: e.target.value })}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded p-2 text-center text-sm font-bold text-cyan-300 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    placeholder="21"
                  />
                </div>
              </div>

              {/* پیش‌نمایش زنده گرافیکی پلاک */}
              <div className="p-3 bg-zinc-950/70 border border-zinc-800 rounded-lg flex flex-col items-center justify-center gap-1.5 my-2">
                <span className="text-[10px] text-zinc-400">پیش‌نمایش پلاک تولیدی:</span>
                <PersianPlate
                  partTwoDigits={newPlate.part_two_digits}
                  letter={newPlate.letter}
                  partThreeDigits={newPlate.part_three_digits}
                  provinceCode={newPlate.province_code}
                  vehicleType={newPlate.vehicle_type}
                  size="md"
                />
              </div>

              <div>
                <label className="block text-zinc-400 mb-1 font-medium">مدل یا نوع خودرو</label>
                <input
                  type="text"
                  value={newPlate.vehicle_type}
                  onChange={(e) => setNewPlate({ ...newPlate, vehicle_type: e.target.value })}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded p-2 text-zinc-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  placeholder="مثال: سواری پژو ۲۰۶"
                />
              </div>

              <div>
                <label className="block text-zinc-400 mb-1 font-medium">یادداشت / توضیحات</label>
                <textarea
                  rows={2}
                  value={newPlate.notes}
                  onChange={(e) => setNewPlate({ ...newPlate, notes: e.target.value })}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded p-2 text-zinc-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  placeholder="توضیحات تست..."
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded transition-colors"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-medium transition-colors flex items-center gap-1.5"
                >
                  {isSubmitting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                  <span>ثبت در SQLite</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
