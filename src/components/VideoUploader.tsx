import React, { useState, useRef, useEffect } from 'react';
import { Upload, FileVideo, CheckCircle2, AlertCircle, RefreshCw, Film, Play, HardDrive, Trash2 } from 'lucide-react';
import { toPersianDigits } from './PersianPlate.tsx';

interface VideoUploaderProps {
  onVideoUploaded: (videoUrl: string, filename: string) => void;
  onRefreshPlates: () => void;
  currentVideoUrl: string;
}

interface UploadedVideoItem {
  filename: string;
  url: string;
  size: number;
  createdAt: string;
}

export const VideoUploader: React.FC<VideoUploaderProps> = ({
  onVideoUploaded,
  onRefreshPlates,
  currentVideoUrl,
}) => {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [uploadedVideos, setUploadedVideos] = useState<UploadedVideoItem[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchUploadedVideos = async () => {
    try {
      const res = await fetch('/api/uploaded-videos');
      const data = await res.json();
      if (data.success && Array.isArray(data.videos)) {
        setUploadedVideos(data.videos);
      }
    } catch (e) {
      console.error('خطا در دریافت لیست ویدیوها:', e);
    }
  };

  useEffect(() => {
    fetchUploadedVideos();
  }, []);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelected(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelected(e.target.files[0]);
    }
  };

  const handleFileSelected = (file: File) => {
    const validExts = ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.ts'];
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!validExts.includes(ext)) {
      setStatusMessage({
        type: 'error',
        text: 'فرمت فایل انتخابی پشتیبانی نمی‌شود. لطفاً فایل MP4، MKV، AVI یا WebM انتخاب کنید.',
      });
      setSelectedFile(null);
      return;
    }
    setSelectedFile(file);
    setStatusMessage(null);
  };

  const handleUploadAndProcess = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    setUploadProgress(15);
    setStatusMessage(null);

    const formData = new FormData();
    formData.append('video', selectedFile);

    try {
      // شبیه‌سازی مراحل پیشرفت
      const progressTimer = setInterval(() => {
        setUploadProgress((prev) => {
          if (prev >= 90) {
            clearInterval(progressTimer);
            return 90;
          }
          return prev + 15;
        });
      }, 400);

      const res = await fetch('/api/upload-video', {
        method: 'POST',
        body: formData,
      });

      clearInterval(progressTimer);
      setUploadProgress(100);

      const data = await res.json();
      if (data.success) {
        setStatusMessage({
          type: 'success',
          text: `ویدیو «${selectedFile.name}» با موفقیت آپلود و پلاک‌های آن در دیتابیس ثبت گردید.`,
        });
        onVideoUploaded(data.videoUrl, data.filename);
        onRefreshPlates();
        setSelectedFile(null);
        fetchUploadedVideos();
      } else {
        setStatusMessage({
          type: 'error',
          text: data.error || 'خطا در آپلود و پردازش ویدیو.',
        });
      }
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: `خطای ارتباط با سرور: ${err.message}`,
      });
    } finally {
      setIsUploading(false);
      setTimeout(() => setUploadProgress(0), 1500);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} کیلوبایت`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} مگابایت`;
  };

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-xl flex flex-col gap-4">
      <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg">
            <Upload className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-zinc-100">
              آپلود فایل ویدیویی و پردازش خودکار با پایتون
            </h3>
            <p className="text-xs text-zinc-400">
              فایل‌های ویدیویی نظارتی یا ترافیکی خود را آپلود کنید تا الگوریتم پایتون پلاک‌های آن را استخراج نماید.
            </p>
          </div>
        </div>
      </div>

      {/* منطقه درگ اند دراپ فایل */}
      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-3 ${
          dragActive
            ? 'border-emerald-500 bg-emerald-500/10 scale-[1.01]'
            : 'border-zinc-700/80 bg-zinc-950/60 hover:border-zinc-600 hover:bg-zinc-800/40'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="video/mp4,video/mkv,video/avi,video/quicktime,video/webm"
          onChange={handleFileChange}
          className="hidden"
        />

        <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400 group-hover:text-emerald-400">
          <Film className="w-6 h-6 text-emerald-400" />
        </div>

        <div>
          <p className="text-xs md:text-sm font-medium text-zinc-200">
            فایل ویدیویی را اینجا رها کنید یا <span className="text-emerald-400 underline font-bold">انتخاب فایل</span> را بزنید
          </p>
          <p className="text-[11px] text-zinc-500 mt-1">
            پشتیبانی از فرمت‌های MP4، MKV، AVI، MOV و WebM (حداکثر تا ۲۵۰ مگابایت)
          </p>
        </div>
      </div>

      {/* مشخصات فایل انتخاب شده */}
      {selectedFile && (
        <div className="bg-zinc-800/80 border border-zinc-700/80 rounded-xl p-3 flex items-center justify-between gap-3 animate-fadeIn">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <FileVideo className="w-5 h-5 text-emerald-400 shrink-0" />
            <div className="truncate">
              <p className="text-xs font-bold text-zinc-100 truncate">{selectedFile.name}</p>
              <p className="text-[10px] text-zinc-400">{formatFileSize(selectedFile.size)}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setSelectedFile(null)}
              disabled={isUploading}
              className="p-1.5 text-zinc-400 hover:text-red-400 hover:bg-zinc-700/50 rounded-lg transition-colors"
              title="حذف انتخاب"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              onClick={handleUploadAndProcess}
              disabled={isUploading}
              className="flex items-center gap-2 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow-md transition-all active:scale-95 disabled:opacity-50"
            >
              {isUploading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
              <span>{isUploading ? 'در حال ارسال و تحلیل...' : 'آپلود و پردازش در دیتابیس'}</span>
            </button>
          </div>
        </div>
      )}

      {/* نوار پیشرفت آپلود */}
      {isUploading && (
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-zinc-400">
            <span>در حال پردازش فریم‌ها و انتقال پلاک‌ها به SQLite...</span>
            <span className="font-mono">{toPersianDigits(uploadProgress)}٪</span>
          </div>
          <div className="w-full bg-zinc-800 h-2 rounded-full overflow-hidden">
            <div
              className="bg-gradient-to-r from-emerald-500 to-cyan-500 h-full transition-all duration-300"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* پیام وضعیت */}
      {statusMessage && (
        <div
          className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
            statusMessage.type === 'success'
              ? 'bg-emerald-950/60 border border-emerald-800/80 text-emerald-300'
              : 'bg-red-950/60 border border-red-800/80 text-red-300'
          }`}
        >
          {statusMessage.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0" />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* لیست ویدیوهای آپلود شده موجود */}
      {uploadedVideos.length > 0 && (
        <div className="mt-2 pt-3 border-t border-zinc-800/80">
          <h4 className="text-xs font-bold text-zinc-300 mb-2 flex items-center gap-1.5">
            <HardDrive className="w-3.5 h-3.5 text-zinc-500" />
            <span>ویدیوهای آپلود شده قبلی در سرور:</span>
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-36 overflow-y-auto pr-1">
            {uploadedVideos.map((vid, idx) => {
              const isCurrent = currentVideoUrl === vid.url;
              return (
                <div
                  key={idx}
                  onClick={() => onVideoUploaded(vid.url, vid.filename)}
                  className={`p-2 rounded-lg border text-xs cursor-pointer flex items-center justify-between gap-2 transition-all ${
                    isCurrent
                      ? 'bg-emerald-950/40 border-emerald-500 text-emerald-200'
                      : 'bg-zinc-950/60 border-zinc-800 hover:bg-zinc-800/60 text-zinc-300'
                  }`}
                >
                  <div className="flex items-center gap-2 overflow-hidden">
                    <FileVideo className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                    <span className="truncate max-w-[170px]">{vid.filename}</span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="text-[10px] text-zinc-500">{formatFileSize(vid.size)}</span>
                    <Play className="w-3 h-3 text-emerald-400" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
