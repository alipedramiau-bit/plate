import React, { useState, useCallback } from 'react';
import { PersianPlate, toPersianDigits } from './PersianPlate.tsx';
import {
  Search, Filter, Plus, Clock, MapPin, Eye, Car, CheckCircle2, RefreshCw,
  FileSpreadsheet, FileJson, Pencil, Trash2, X, AlertTriangle,
} from 'lucide-react';

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
}

interface PlateTableProps {
  plates: PlateRecord[];
  onSelectPlate: (plate: PlateRecord) => void;
  onRefresh: () => void;
  onAddPlate: (plate: any) => Promise<void>;
  onUpdatePlate: (id: number, plate: any) => Promise<void>;
  onDeletePlate: (id: number) => Promise<void>;
  selectedPlateId?: number;
}

const PERSIAN_LETTERS = ['الف', 'ب', 'پ', 'ت', 'ث', 'ج', 'چ', 'ح', 'خ', 'د',
  'ذ', 'ر', 'ز', 'ژ', 'س', 'ش', 'ص', 'ض', 'ط', 'ظ', 'ع', 'غ', 'ف', 'ق',
  'ک', 'گ', 'ل', 'م', 'ن', 'و', 'ه', 'ی'];

export const PlateTable: React.FC<PlateTableProps> = ({
  plates,
  onSelectPlate,
  onRefresh,
  onAddPlate,
  onUpdatePlate,
  onDeletePlate,
  selectedPlateId,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingPlate, setEditingPlate] = useState<PlateRecord | null>(null);
  const [deletingPlate, setDeletingPlate] = useState<PlateRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // فرم ثبت دستی
  const emptyPlate = {
    part_two_digits: '38',
    letter: 'ب',
    part_three_digits: '614',
    province_code: '21',
    vehicle_type: 'سواری پژو پارس',
    notes: 'تست درج دستی از طریق پنل کاربری برای آزمون دیتابیس',
  };
  const [newPlate, setNewPlate] = useState(emptyPlate);
  const [editForm, setEditForm] = useState(emptyPlate);

  const handleCreatePlate = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    try {
      await onAddPlate(newPlate);
      setShowAddModal(false);
      setNewPlate(emptyPlate);
      onRefresh();
    } catch (err: any) {
      setError(err.message || 'خطا در ثبت پلاک');
    } finally {
      setIsSubmitting(false);
    }
  }, [newPlate, onAddPlate, onRefresh]);

  const handleEditClick = useCallback((plate: PlateRecord) => {
    setEditingPlate(plate);
    setEditForm({
      part_two_digits: plate.part_two_digits || '',
      letter: plate.letter || '',
      part_three_digits: plate.part_three_digits || '',
      province_code: plate.province_code || '',
      vehicle_type: plate.vehicle_type || '',
      notes: plate.notes || '',
    });
    setError(null);
  }, []);

  const handleUpdatePlate = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPlate) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await onUpdatePlate(editingPlate.id, editForm);
      setEditingPlate(null);
      onRefresh();
    } catch (err: any) {
      setError(err.message || 'خطا در ویرایش پلاک');
    } finally {
      setIsSubmitting(false);
    }
  }, [editingPlate, editForm, onUpdatePlate, onRefresh]);

  const handleDeleteConfirm = useCallback(async () => {
    if (!deletingPlate) return;
    setIsDeleting(true);
    setError(null);
    try {
      await onDeletePlate(deletingPlate.id);
      setDeletingPlate(null);
      onRefresh();
    } catch (err: any) {
      setError(err.message || 'خطا در حذف پلاک');
    } finally {
      setIsDeleting(false);
    }
  }, [deletingPlate, onDeletePlate, onRefresh]);

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

      {/* پیام خطا */}
      {error && (
        <div className="m-3 p-3 rounded-lg border border-red-500/30 bg-red-500/10 text-xs text-red-300 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-red-300 hover:text-white">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

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
              <th className="py-2.5 px-3 text-center whitespace-nowrap">عملیات (ثبت/ویرایش/حذف)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/60 text-zinc-300">
            {filteredPlates.length === 0 ? (
              <tr>
                <td colSpan={12} className="py-8 text-center text-zinc-500 text-sm">
                  {plates.length === 0
                    ? 'هنوز پلاکی در دیتابیس ثبت نشده است. با پردازش ویدیو یا ثبت دستی، پلاک جدید اضافه کنید.'
                    : 'موردی با این مشخصات یافت نشد.'}
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
                      <div className="flex items-center justify-center gap-1">
                        {/* مشاهده جزئیات */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectPlate(plate);
                          }}
                          className="p-1.5 text-zinc-400 hover:text-emerald-400 hover:bg-zinc-700/50 rounded transition-colors"
                          title="مشاهده جزئیات"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        {/* ویرایش */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditClick(plate);
                          }}
                          className="p-1.5 text-zinc-400 hover:text-amber-400 hover:bg-amber-500/10 rounded transition-colors border border-transparent hover:border-amber-500/30"
                          title="ویرایش پلاک"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        {/* حذف */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeletingPlate(plate);
                          }}
                          className="p-1.5 text-zinc-400 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors border border-transparent hover:border-red-500/30"
                          title="حذف پلاک"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* مدال ثبت دستی پلاک */}
      {showAddModal && (
        <PlateFormModal
          title="افزودن پلاک جدید به دیتابیس SQLite"
          subtitle="با این فرم می‌توانید انتقال مستقیم اعداد و حروف پلاک به دیتابیس را تست و اعتبارسنجی نمایید."
          form={newPlate}
          onChange={setNewPlate}
          onSubmit={handleCreatePlate}
          onClose={() => setShowAddModal(false)}
          isSubmitting={isSubmitting}
          submitLabel="ثبت در SQLite"
        />
      )}

      {/* مدال ویرایش پلاک */}
      {editingPlate && (
        <PlateFormModal
          title={`ویرایش پلاک #${toPersianDigits(editingPlate.id)}`}
          subtitle="با ویرایش این فرم، فیلدهای پلاک در دیتابیس به‌روزرسانی می‌شوند."
          form={editForm}
          onChange={setEditForm}
          onSubmit={handleUpdatePlate}
          onClose={() => setEditingPlate(null)}
          isSubmitting={isSubmitting}
          submitLabel="ذخیره تغییرات"
        />
      )}

      {/* مدال تأیید حذف */}
      {deletingPlate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-zinc-900 border border-red-700/50 rounded-xl p-6 max-w-md w-full shadow-2xl">
            <div className="flex items-start gap-3 mb-4">
              <div className="p-2.5 rounded-lg bg-red-500/15 border border-red-500/30 shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-bold text-zinc-100 mb-1">حذف پلاک از دیتابیس</h3>
                <p className="text-xs text-zinc-400">
                  آیا مطمئن هستید که می‌خواهید این پلاک را به‌طور کامل از دیتابیس SQLite حذف کنید؟ این عملیات قابل بازگشت نیست.
                </p>
              </div>
            </div>

            <div className="p-3 bg-zinc-950/70 border border-zinc-800 rounded-lg flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <PersianPlate
                  partTwoDigits={deletingPlate.part_two_digits}
                  letter={deletingPlate.letter}
                  partThreeDigits={deletingPlate.part_three_digits}
                  provinceCode={deletingPlate.province_code}
                  vehicleType={deletingPlate.vehicle_type}
                  size="sm"
                />
                <div className="text-xs">
                  <div className="font-bold text-zinc-200">{deletingPlate.vehicle_type}</div>
                  <div className="text-zinc-500">{deletingPlate.province_name}</div>
                </div>
              </div>
              <span className="text-xs font-mono text-zinc-500">
                #{toPersianDigits(deletingPlate.id)}
              </span>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => setDeletingPlate(null)}
                disabled={isDeleting}
                className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded transition-colors text-xs font-medium"
              >
                انصراف
              </button>
              <button
                onClick={handleDeleteConfirm}
                disabled={isDeleting}
                className="px-4 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded font-medium transition-colors flex items-center gap-1.5 text-xs"
              >
                {isDeleting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                <span>حذف قطعی</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ----------------------------------------------------------------------
// فرم مشترک برای مدال ثبت و ویرایش پلاک
// ----------------------------------------------------------------------
interface PlateFormModalProps {
  title: string;
  subtitle: string;
  form: {
    part_two_digits: string;
    letter: string;
    part_three_digits: string;
    province_code: string;
    vehicle_type: string;
    notes: string;
  };
  onChange: (form: any) => void;
  onSubmit: (e: React.FormEvent) => void;
  onClose: () => void;
  isSubmitting: boolean;
  submitLabel: string;
}

const PlateFormModal: React.FC<PlateFormModalProps> = ({
  title, subtitle, form, onChange, onSubmit, onClose, isSubmitting, submitLabel,
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6 max-w-md w-full shadow-2xl">
        <div className="flex items-start justify-between mb-1">
          <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
            <Plus className="w-4 h-4 text-emerald-400" />
            <span>{title}</span>
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-xs text-zinc-400 mb-4">{subtitle}</p>

        <form onSubmit={onSubmit} className="space-y-3 text-xs">
          <div className="grid grid-cols-4 gap-2">
            <div>
              <label className="block text-zinc-400 mb-1 font-medium">۲ رقم سمت چپ</label>
              <input
                type="text"
                maxLength={3}
                required
                value={form.part_two_digits}
                onChange={(e) => onChange({ ...form, part_two_digits: e.target.value })}
                className="w-full bg-zinc-800 border border-zinc-700 rounded p-2 text-center text-sm font-bold text-amber-300 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                placeholder="38"
              />
            </div>
            <div>
              <label className="block text-zinc-400 mb-1 font-medium">حرف پلاک</label>
              <input
                type="text"
                maxLength={2}
                required
                value={form.letter}
                onChange={(e) => onChange({ ...form, letter: e.target.value })}
                className="w-full bg-zinc-800 border border-zinc-700 rounded p-2 text-center text-sm font-bold text-blue-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                placeholder="ب"
                list="persian-letters"
              />
              <datalist id="persian-letters">
                {PERSIAN_LETTERS.map((l) => <option key={l} value={l} />)}
              </datalist>
            </div>
            <div>
              <label className="block text-zinc-400 mb-1 font-medium">۳ رقم وسط</label>
              <input
                type="text"
                maxLength={5}
                required
                value={form.part_three_digits}
                onChange={(e) => onChange({ ...form, part_three_digits: e.target.value })}
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
                value={form.province_code}
                onChange={(e) => onChange({ ...form, province_code: e.target.value })}
                className="w-full bg-zinc-800 border border-zinc-700 rounded p-2 text-center text-sm font-bold text-cyan-300 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                placeholder="21"
              />
            </div>
          </div>

          {/* پیش‌نمایش زنده گرافیکی پلاک */}
          <div className="p-3 bg-zinc-950/70 border border-zinc-800 rounded-lg flex flex-col items-center justify-center gap-1.5 my-2">
            <span className="text-[10px] text-zinc-400">پیش‌نمایش پلاک:</span>
            <PersianPlate
              partTwoDigits={form.part_two_digits}
              letter={form.letter}
              partThreeDigits={form.part_three_digits}
              provinceCode={form.province_code}
              vehicleType={form.vehicle_type}
              size="md"
            />
          </div>

          <div>
            <label className="block text-zinc-400 mb-1 font-medium">مدل یا نوع خودرو</label>
            <input
              type="text"
              value={form.vehicle_type}
              onChange={(e) => onChange({ ...form, vehicle_type: e.target.value })}
              className="w-full bg-zinc-800 border border-zinc-700 rounded p-2 text-zinc-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              placeholder="مثال: سواری پژو ۲۰۶"
            />
          </div>

          <div>
            <label className="block text-zinc-400 mb-1 font-medium">یادداشت / توضیحات</label>
            <textarea
              rows={2}
              value={form.notes}
              onChange={(e) => onChange({ ...form, notes: e.target.value })}
              className="w-full bg-zinc-800 border border-zinc-700 rounded p-2 text-zinc-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              placeholder="توضیحات..."
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded transition-colors text-xs font-medium"
            >
              انصراف
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-medium transition-colors flex items-center gap-1.5 text-xs"
            >
              {isSubmitting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
              <span>{submitLabel}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
