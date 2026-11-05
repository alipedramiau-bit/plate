import React, { useState, useEffect } from 'react';
import { Terminal, Copy, Check, Play, RefreshCw, FileCode, CheckCircle2, ShieldCheck, Database, HardDrive } from 'lucide-react';

export const PythonCodeViewer: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'anpr' | 'test' | 'runner'>('anpr');
  const [anprCode, setAnprCode] = useState<string>('');
  const [testCode, setTestCode] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [isRunningTests, setIsRunningTests] = useState(false);
  const [testOutput, setTestOutput] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/source-code')
      .then((res) => res.json())
      .then((data) => {
        if (data.anprCode) setAnprCode(data.anprCode);
        if (data.testCode) setTestCode(data.testCode);
      })
      .catch((err) => console.error(err));
  }, []);

  const handleCopy = () => {
    const textToCopy = activeTab === 'anpr' ? anprCode : testCode;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRunTests = async () => {
    setIsRunningTests(true);
    setTestOutput('⏳ در حال اجرای python3 test_anpr.py و آزمون‌های واحد پایگاه داده...\n');
    setActiveTab('runner');
    try {
      const res = await fetch('/api/run-tests', { method: 'POST' });
      const data = await res.json();
      setTestOutput(data.stdout || data.stderr || 'تست به پایان رسید بدون خروجی.');
    } catch (err: any) {
      setTestOutput(`❌ خطا در اجرای تست: ${err.message}`);
    } finally {
      setIsRunningTests(false);
    }
  };

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-2xl flex flex-col h-[700px]">
      {/* هدر تب‌ها و دکمه‌های کنترل */}
      <div className="bg-zinc-950 px-4 py-3 border-b border-zinc-800 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setActiveTab('anpr')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'anpr'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
            }`}
          >
            <FileCode className="w-4 h-4" />
            <span>اسکریپت اصلی (anpr_system.py)</span>
          </button>

          <button
            onClick={() => setActiveTab('test')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'test'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>فایل تست خودکار (test_anpr.py)</span>
          </button>

          <button
            onClick={() => setActiveTab('runner')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'runner'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
            }`}
          >
            <Terminal className="w-4 h-4" />
            <span>کنسول خروجی ترمینال</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleRunTests}
            disabled={isRunningTests}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700/80 hover:bg-emerald-600 text-white rounded-lg text-xs font-semibold transition-all shadow-md active:scale-95 disabled:opacity-50"
          >
            {isRunningTests ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
            <span>اجرای تست پایتون در ترمینال</span>
          </button>

          {activeTab !== 'runner' && (
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-xs transition-colors border border-zinc-700"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'کپی شد!' : 'کپی کل کد'}</span>
            </button>
          )}
        </div>
      </div>

      {/* بخش راهنمای نحوه اجرای کد پایتون در سیستم محلی */}
      <div className="bg-zinc-900/60 px-4 py-2 border-b border-zinc-800 text-[11px] text-zinc-400 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-emerald-400 font-mono font-bold">دستور اجرا در سرور/سیستم محلی:</span>
          <code className="bg-black/60 px-2 py-0.5 rounded text-zinc-200 font-mono text-[10px]" dir="ltr">
            python3 anpr_system.py --video your_clip.mp4 --db data/plates.db
          </code>
        </div>
        <div className="hidden md:flex items-center gap-3 text-zinc-500">
          <span>دیتابیس استاندارد SQLite 3</span>
          <span>•</span>
          <span>پشتیبانی از پلاک‌های ملی سواری و موتور</span>
        </div>
      </div>

      {/* محتوای کد / ترمینال */}
      <div className="flex-1 overflow-auto bg-zinc-950 p-4 font-mono text-xs">
        {activeTab === 'runner' ? (
          <div className="h-full flex flex-col">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-zinc-800 text-zinc-400 text-xs">
              <span className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                خروجی اجرای مفسر پایتون ۳ (Python 3.10 Subprocess Runner):
              </span>
              <button
                onClick={() => setTestOutput(null)}
                className="text-zinc-500 hover:text-zinc-300 text-[11px]"
              >
                پاک کردن لاگ
              </button>
            </div>
            <pre className="text-emerald-400 whitespace-pre-wrap leading-relaxed select-text flex-1 overflow-auto font-mono text-xs bg-black/40 p-4 rounded-lg border border-zinc-800/80" dir="ltr">
              {testOutput ||
                `# برای اجرای آزمون واحد جامع پایتون دکمه 'اجرای تست پایتون در ترمینال' را بزنید.\n# دستور معادل در شل:\n$ python3 test_anpr.py\n\n# تمام آزمون‌ها شامل ساخت دیتابیس، استخراج فریم‌ها، برش پلاک و انتقال به جداول SQLite اجرا خواهند شد.`}
            </pre>
          </div>
        ) : (
          <pre className="text-zinc-300 leading-relaxed overflow-x-auto whitespace-pre select-text font-mono text-xs" dir="ltr">
            <code>{activeTab === 'anpr' ? anprCode : testCode}</code>
          </pre>
        )}
      </div>
    </div>
  );
};
