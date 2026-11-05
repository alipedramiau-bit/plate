import React from 'react';

interface PersianPlateProps {
  partTwoDigits: string;
  letter: string;
  partThreeDigits: string;
  provinceCode: string;
  vehicleType?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

// تبدیل ارقام لاتین به فارسی
export function toPersianDigits(n: string | number | undefined): string {
  if (n === undefined || n === null) return '';
  const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  return String(n).replace(/[0-9]/g, (w) => persianDigits[+w]);
}

export const PersianPlate: React.FC<PersianPlateProps> = ({
  partTwoDigits,
  letter,
  partThreeDigits,
  provinceCode,
  vehicleType = 'سواری',
  size = 'md',
  className = '',
}) => {
  const isMotor = vehicleType.includes('موتور') || !letter;

  // سایزهای مختلف
  const sizeClasses = {
    sm: {
      plate: 'h-8 text-xs min-w-[130px] rounded border',
      flag: 'w-4 px-0.5 text-[7px]',
      center: 'px-1.5 gap-1 text-xs',
      letter: 'text-xs px-1',
      province: 'w-6 text-[8px] px-0.5',
    },
    md: {
      plate: 'h-11 text-base min-w-[190px] rounded-md border-2',
      flag: 'w-6 px-1 text-[9px]',
      center: 'px-2.5 gap-2 text-base font-bold',
      letter: 'text-base px-1.5 font-bold',
      province: 'w-9 text-[10px] px-1',
    },
    lg: {
      plate: 'h-14 text-xl min-w-[240px] rounded-lg border-2',
      flag: 'w-8 px-1 text-[11px]',
      center: 'px-4 gap-3 text-xl font-extrabold',
      letter: 'text-xl px-2 font-black',
      province: 'w-12 text-xs px-1.5',
    },
  }[size];

  if (isMotor) {
    // پلاک موتورسیکلت (دو سطری)
    return (
      <div
        className={`inline-flex flex-col items-center justify-center bg-white text-zinc-900 border-zinc-700 shadow-sm font-mono select-none overflow-hidden ${
          size === 'sm' ? 'w-20 h-10 p-0.5 text-[10px]' : size === 'lg' ? 'w-32 h-16 p-1.5 text-base' : 'w-26 h-13 p-1 text-xs'
        } rounded border-2 ${className}`}
        dir="rtl"
      >
        <div className="w-full flex items-center justify-between border-b border-zinc-300 pb-0.5 font-bold text-blue-900">
          <span className="text-[9px] text-zinc-500">موتور</span>
          <span className="tracking-widest font-black text-zinc-900">
            {toPersianDigits(partTwoDigits)}
          </span>
        </div>
        <div className="w-full text-center pt-0.5 font-black tracking-widest text-zinc-950">
          {toPersianDigits(partThreeDigits)}
        </div>
      </div>
    );
  }

  // پلاک خودرو ملی ایران
  return (
    <div
      className={`inline-flex items-stretch bg-white text-zinc-900 border-zinc-800 shadow-md font-sans select-none overflow-hidden transition-transform duration-200 hover:scale-[1.02] ${sizeClasses.plate} ${className}`}
      dir="ltr"
    >
      {/* نوار آبی سمت چپ: پرچم ایران و شناسه I.R. IRAN */}
      <div className={`bg-blue-700 text-white flex flex-col items-center justify-between py-0.5 ${sizeClasses.flag} border-r border-blue-800`}>
        {/* پرچم کوچک ایران */}
        <div className="w-full flex flex-col overflow-hidden rounded-[1px] border border-white/30">
          <div className="h-[2px] bg-emerald-600"></div>
          <div className="h-[2px] bg-white flex items-center justify-center">
            <span className="w-0.5 h-0.5 rounded-full bg-red-600"></span>
          </div>
          <div className="h-[2px] bg-red-600"></div>
        </div>
        <span className="font-sans font-bold leading-none tracking-tighter scale-90">I.R.</span>
        <span className="font-sans font-semibold leading-none scale-75">IRAN</span>
      </div>

      {/* بخش مرکزی پلاک: ۲ رقم + حرف فارسی + ۳ رقم */}
      <div className={`flex items-center justify-center flex-1 font-bold ${sizeClasses.center} text-zinc-950`}>
        <span className="tracking-tight text-zinc-900 font-extrabold">{toPersianDigits(partTwoDigits)}</span>
        <span className={`text-blue-950 bg-blue-50/70 rounded border border-blue-200/50 ${sizeClasses.letter}`}>
          {letter}
        </span>
        <span className="tracking-tight text-zinc-900 font-extrabold">{toPersianDigits(partThreeDigits)}</span>
      </div>

      {/* بخش سمت راست: کد استان و کلمه ایران */}
      <div className={`bg-white border-l-2 border-zinc-400 flex flex-col items-center justify-center py-0.5 ${sizeClasses.province} text-zinc-900`}>
        <span className="font-bold text-zinc-600 leading-none scale-90">ایران</span>
        <span className="font-black text-zinc-950 leading-tight">
          {toPersianDigits(provinceCode)}
        </span>
      </div>
    </div>
  );
};
