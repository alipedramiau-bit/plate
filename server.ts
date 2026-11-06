import express from 'express';
import path from 'path';
import fs from 'fs';
import { exec, execSync } from 'child_process';
import { fileURLToPath } from 'url';
import multer from 'multer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;
// تضمین اینکه subprocessهای پایتون پورت واقعی سرور را بدانند
process.env.PORT = String(PORT);

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
  res.setHeader('Access-Control-Allow-Headers', '*');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(path.resolve(__dirname, 'public')));

// اطمینان از وجود دایرکتوری‌های مورد نیاز
const UPLOADS_DIR = path.resolve(__dirname, 'public/uploads');
const CROPS_DIR = path.resolve(__dirname, 'public/crops');
const STREAMS_DIR = path.resolve(__dirname, 'public/streams');
const FRAMES_DIR = path.resolve(__dirname, 'public/frames');
const DATA_DIR = path.resolve(__dirname, 'data');

[UPLOADS_DIR, CROPS_DIR, STREAMS_DIR, FRAMES_DIR, DATA_DIR].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// تنظیمات Multer برای آپلود فایل‌های ویدیویی
const storage = multer.diskStorage({
  destination: (req: any, file: any, cb: any) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req: any, file: any, cb: any) => {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e4);
    cb(null, uniqueSuffix + '-' + safeName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 250 * 1024 * 1024 }, // سقف ۲۵۰ مگابایت
  fileFilter: (req: any, file: any, cb: any) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (['.mp4', '.mov', '.avi', '.mkv', '.webm', '.ts', '.flv'].includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('تنها فایل‌های ویدیویی (MP4, MKV, AVI, MOV, WEBM) مجاز هستند.'));
    }
  },
});

// مسیر فایل پایگاه داده SQLite
const DB_PATH = path.resolve(__dirname, 'data/plates.db');

// --- تشخیص دستور پایتون (سازگار با ویندوز/لینوکس/مک) ---
// در ویندوز Python 3.11 معمولاً با `python` قابل اجراست (نه `python3`).
// این تابع به‌ترتیب `python`, `python3`, `py` را امتحان می‌کند.
let _pythonCmd: string | null = null;
function getPythonCommand(): string {
  if (_pythonCmd) return _pythonCmd;
  const checkCmd = process.platform === 'win32' ? 'where' : 'which';
  for (const c of ['python', 'python3', 'py']) {
    try {
      execSync(`${checkCmd} ${c}`, { stdio: 'ignore' });
      _pythonCmd = c;
      console.log(`[Python] command found: ${c}`);
      return c;
    } catch {
      // امتحان بعدی
    }
  }
  _pythonCmd = 'python';
  console.warn(`[Python] no python command found in PATH; falling back to ${_pythonCmd}`);
  return _pythonCmd;
}

// --- محیط اجرای پایتون (اجبار UTF-8 برای خروجی) ---
// در ویندوز پیش‌فرض stdout از cp1256/cp1252 استفاده می‌کند که نمی‌تواند حروف فارسی
// را بنویسد. PYTHONIOENCODING=utf-8 این مشکل را حل می‌کند.
function getPythonEnv(): NodeJS.ProcessEnv {
  return { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' };
}

// مسیر ماژول‌های پردازش تصویر پایتون در فولدر backend
const ANPR_SCRIPT = fs.existsSync(path.join(__dirname, 'backend/anpr_system.py'))
  ? 'backend/anpr_system.py'
  : 'anpr_system.py';
const TEST_SCRIPT = fs.existsSync(path.join(__dirname, 'backend/test_anpr.py'))
  ? 'backend/test_anpr.py'
  : 'test_anpr.py';

// ----------------------------------------------------------------------
// کوئری دیتابیس با node:sqlite بومی (سریع، بدون spawn پایتون)
// از Node 22.5 به بعد موجود است. در صورت عدم وجود، fallback به Python می‌رود.
// ----------------------------------------------------------------------
let _nodeSqlite: any = null;
async function getNodeSqlite(): Promise<any> {
  if (_nodeSqlite) return _nodeSqlite;
  try {
    const mod = await import('node:sqlite');
    _nodeSqlite = mod;
    return mod;
  } catch (err: any) {
    console.warn('[SQLite] node:sqlite در دسترس نیست، fallback به Python:', err.message);
    return null;
  }
}

let _dbInstance: any = null;
let _dbInitialized = false;
async function getDb() {
  if (_dbInstance) return _dbInstance;
  const sqlite = await getNodeSqlite();
  if (!sqlite) return null;
  try {
    const { DatabaseSync } = sqlite;
    const dataDir = path.dirname(DB_PATH);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    _dbInstance = new DatabaseSync(DB_PATH);
    _dbInstance.exec('PRAGMA journal_mode = WAL;');

    if (!_dbInitialized) {
      // ساخت جداول در صورت عدم وجود (هماهنگ با anpr_system.py)
      _dbInstance.exec(`
        CREATE TABLE IF NOT EXISTS detected_plates (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          plate_full_fa TEXT NOT NULL,
          plate_full_en TEXT NOT NULL,
          part_two_digits TEXT NOT NULL,
          letter TEXT NOT NULL,
          part_three_digits TEXT NOT NULL,
          province_code TEXT NOT NULL,
          province_name TEXT,
          vehicle_type TEXT DEFAULT 'سواری',
          confidence REAL DEFAULT 0.95,
          video_timestamp_sec REAL,
          timestamp_formatted TEXT,
          first_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          detection_count INTEGER DEFAULT 1,
          frame_path TEXT,
          crop_path TEXT,
          source_type TEXT DEFAULT 'video',
          notes TEXT
        );
        CREATE TABLE IF NOT EXISTS detection_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          plate_id INTEGER,
          detected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          video_timestamp_sec REAL,
          confidence REAL,
          frame_path TEXT,
          source_type TEXT DEFAULT 'video',
          FOREIGN KEY (plate_id) REFERENCES detected_plates (id)
        );
        CREATE INDEX IF NOT EXISTS idx_plate_en ON detected_plates (plate_full_en);
      `);
      _dbInitialized = true;
      console.log('[SQLite] Database initialized at', DB_PATH);
    }
    return _dbInstance;
  } catch (err: any) {
    console.error('[SQLite] خطا در باز کردن دیتابیس:', err.message);
    _dbInstance = null;
    return null;
  }
}

// مقداردهی اولیه دیتابیس هنگام استارتاپ (آسنکرون، بدون بلاک کردن)
getDb().catch((e) => console.warn('[SQLite] init failed:', e.message));

// Helper to query SQLite — اولویت با node:sqlite بومی (سریع‌تر)، fallback به Python
async function queryDb(sql: string, params: any[] = []): Promise<any> {
  const db = await getDb();
  if (db) {
    try {
      const stmt = db.prepare(sql);
      const rows = stmt.all(...params);
      // تبدیل نمونه‌های prototype-less به plain object برای JSON
      return rows.map((r: any) => ({ ...r }));
    } catch (err: any) {
      console.warn('[SQLite] خطا در کوئری بومی، fallback به Python:', err.message);
    }
  }

  // Fallback به Python subprocess
  return new Promise((resolve, reject) => {
    const pythonScript = `
import sqlite3, json, sys
sys.stdout.reconfigure(encoding='utf-8', errors='replace') if hasattr(sys.stdout, 'reconfigure') else None
conn = sqlite3.connect('${DB_PATH.replace(/'/g, "\\'")}')
conn.row_factory = sqlite3.Row
cur = conn.cursor()
try:
    cur.execute('''${sql.replace(/'/g, "\\'")}''', ${JSON.stringify(params)})
    rows = [dict(r) for r in cur.fetchall()]
    print(json.dumps(rows, ensure_ascii=False))
except Exception as e:
    print(json.dumps({"error": str(e)}))
`;
    exec(
      `"${getPythonCommand()}" -c "${pythonScript.replace(/"/g, '\\"')}"`,
      { env: getPythonEnv() },
      (err, stdout) => {
        if (err) return reject(err);
        try {
          const result = JSON.parse(stdout.trim());
          if (result && result.error) return reject(new Error(result.error));
          resolve(result || []);
        } catch (e) {
          reject(e);
        }
      }
    );
  });
}

// اجرای دستور پایتون روی anpr_system.py با متغیرهای محیطی UTF-8
function runPythonAnpr(args: string, callback: (err: any, stdout: string, stderr: string) => void) {
  const command = `"${getPythonCommand()}" ${ANPR_SCRIPT} ${args}`;
  exec(command, { cwd: __dirname, env: getPythonEnv(), maxBuffer: 10 * 1024 * 1024 }, callback);
}

// 1. دریافت فهرست تمام پلاک‌ها از پایگاه داده
app.get('/api/plates', async (req, res) => {
  try {
    const plates = await queryDb('SELECT * FROM detected_plates ORDER BY id DESC');
    res.json({ success: true, data: plates });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message, data: [] });
  }
});

// 2. لاگ‌های رویت
app.get('/api/logs', async (req, res) => {
  try {
    const logs = await queryDb(`
      SELECT l.*, p.plate_full_fa, p.vehicle_type
      FROM detection_logs l
      LEFT JOIN detected_plates p ON l.plate_id = p.id
      ORDER BY l.id DESC
    `);
    res.json({ success: true, data: logs });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message, data: [] });
  }
});

// 3. آپلود فایل ویدیویی از فرانت‌اند و پردازش خودکار با پایتون
app.post('/api/upload-video', upload.single('video'), (req: any, res: any) => {
  if (!req.file) {
    return res.status(400).json({ success: false, error: 'هیچ فایل ویدیویی ارسال نشد.' });
  }

  const filename = req.file.filename;
  const relativePath = `public/uploads/${filename}`;
  const webPath = `/uploads/${filename}`;

  console.log(`[Upload] ویدیوی جدید دریافت شد: ${filename} (${req.file.size} bytes)`);

  runPythonAnpr(`--video "${relativePath}" --db data/plates.db`, async (err, stdout, stderr) => {
    if (err) {
      console.error('خطا در پردازش ویدیوی آپلود شده:', stderr);
      return res.status(500).json({
        success: false,
        error: stderr || err.message,
        videoUrl: webPath,
        filename,
      });
    }

    try {
      const plates = await queryDb('SELECT * FROM detected_plates ORDER BY id DESC');
      res.json({
        success: true,
        message: 'ویدیو با موفقیت آپلود شد و پلاک‌های آن توسط پایتون در پایگاه داده ثبت گردید.',
        videoUrl: webPath,
        filename: req.file?.originalname,
        stdout,
        data: plates,
      });
    } catch (e: any) {
      res.json({ success: true, videoUrl: webPath, stdout, error: e.message });
    }
  });
});

// 4. دریافت فهرست ویدیوهای آپلود شده موجود
app.get('/api/uploaded-videos', (req, res) => {
  try {
    if (!fs.existsSync(UPLOADS_DIR)) {
      return res.json({ videos: [] });
    }
    const files = fs.readdirSync(UPLOADS_DIR);
    const videos = files.map((file) => {
      const stats = fs.statSync(path.join(UPLOADS_DIR, file));
      return {
        filename: file,
        url: `/uploads/${file}`,
        size: stats.size,
        createdAt: stats.ctime,
      };
    });
    res.json({ success: true, videos });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 5. تحلیل و پردازش دوربین‌های پخش زنده اینترنتی (IP Camera / Live Stream URL)
app.post('/api/analyze-live-stream', (req: any, res: any) => {
  const { streamUrl, streamName, currentTime, sec } = req.body;
  if (!streamUrl) {
    return res.status(400).json({ success: false, error: 'آدرس استریم زنده الزامی است.' });
  }
  const safeName = streamName || 'دوربین پخش زنده';
  const currentSec = parseFloat(currentTime || sec || '0') || 0;

  const args = `--stream "${streamUrl.replace(/"/g, '\\"')}" --stream-name "${safeName.replace(/"/g, '\\"')}" --sec ${currentSec.toFixed(1)} --db data/plates.db`;
  runPythonAnpr(args, async (err, stdout, stderr) => {
    let detectedRecord: any = null;
    let activeRecords: any[] = [];

    if (!err && stdout) {
      try {
        const jsonMatch = stdout.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          detectedRecord = JSON.parse(jsonMatch[0]);
          activeRecords = detectedRecord?.detected_records || (detectedRecord ? [detectedRecord] : []);
        }
      } catch (parseErr) {
        console.warn('عدم توانایی در پارس خروجی JSON استریم:', stdout);
      }
    } else if (err) {
      console.error('خطا در تحلیل استریم زنده:', stderr);
    }

    try {
      const allPlates = await queryDb('SELECT * FROM detected_plates ORDER BY id DESC');
      res.json({
        success: !(err && !detectedRecord),
        detectedRecord: detectedRecord?.detected_record || detectedRecord,
        detectedRecords: activeRecords,
        stdout: stdout || '',
        stderr: stderr || '',
        data: allPlates,
      });
    } catch (e: any) {
      res.json({
        success: !(err && !detectedRecord),
        detectedRecord,
        detectedRecords: activeRecords,
        data: [],
        error: e.message,
      });
    }
  });
});

// اسکن سریع و استخراج تمام خودروهای ویدیوی جاری برای نمایش لحظه‌ای
app.post('/api/scan-all-live', (req: any, res: any) => {
  const videoPath = req.body.videoPath || 'public/assets/aistudio/VID_20261029_183130_849_4af72e51.mp4';
  runPythonAnpr(`--video "${videoPath}" --db data/plates.db`, async (err, stdout, stderr) => {
    try {
      const plates = await queryDb('SELECT * FROM detected_plates ORDER BY id DESC');
      res.json({ success: true, data: plates, stderr: stderr || '' });
    } catch (e: any) {
      res.json({ success: false, data: [], error: e.message });
    }
  });
});

// 6. تحلیل اسنپ‌شات یا فریم ارسال شده از بوم زنده وب‌کم/فرانت‌اند
app.post('/api/analyze-frame', (req, res) => {
  const { imageBase64, sourceLabel } = req.body;
  if (!imageBase64) {
    return res.status(400).json({ success: false, error: 'تصویر ارسالی خالی است.' });
  }

  const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
  const ts = Date.now();
  const filename = `snap_${ts}.jpg`;
  const absPath = path.join(CROPS_DIR, filename);

  fs.writeFile(absPath, base64Data, 'base64', (writeErr) => {
    if (writeErr) {
      return res.status(500).json({ success: false, error: writeErr.message });
    }

    runPythonAnpr(`--frame "${absPath}" --db data/plates.db`, async (err, stdout, stderr) => {
      if (err) {
        return res.status(500).json({ success: false, error: stderr || err.message });
      }

      try {
        let detectedRecord: any = null;
        const jsonMatch = stdout.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          detectedRecord = JSON.parse(jsonMatch[0]);
        }
        const plates = await queryDb('SELECT * FROM detected_plates ORDER BY id DESC');
        res.json({
          success: true,
          detectedRecord,
          data: plates,
        });
      } catch (e: any) {
        res.status(500).json({ success: false, error: e.message });
      }
    });
  });
});

// 7. اجرای پردازش روی ویدیوی مشخص یا ویدیوی پیش‌فرض
app.post('/api/run-detection', (req, res) => {
  const videoPath = req.body.videoPath || 'public/assets/aistudio/VID_20261029_183130_849_4af72e51.mp4';
  runPythonAnpr(`--video "${videoPath}" --db data/plates.db`, async (err, stdout, stderr) => {
    if (err) {
      return res.status(500).json({
        success: false,
        error: stderr || err.message,
        stdout,
      });
    }

    try {
      const plates = await queryDb('SELECT * FROM detected_plates ORDER BY id DESC');
      res.json({
        success: true,
        stdout,
        data: plates,
      });
    } catch (e: any) {
      res.json({ success: true, stdout, error: e.message });
    }
  });
});

// 8. اجرای تست‌های خودکار پایتون
app.post('/api/run-tests', (req, res) => {
  exec(
    `"${getPythonCommand()}" ${TEST_SCRIPT}`,
    { cwd: __dirname, env: getPythonEnv(), maxBuffer: 10 * 1024 * 1024 },
    (err, stdout, stderr) => {
      res.json({
        success: !err,
        stdout: stdout || '',
        stderr: stderr || '',
        exitCode: err ? err.code : 0,
      });
    }
  );
});

// 9. درج دستی پلاک در دیتابیس (POST /api/plates)
app.post('/api/plates', async (req, res) => {
  const { part_two_digits, letter, part_three_digits, province_code, vehicle_type, notes } = req.body;
  try {
    const pid = await insertPlate({
      part_two_digits,
      letter,
      part_three_digits,
      province_code,
      vehicle_type: vehicle_type || 'سواری',
      confidence: 1.0,
      video_timestamp_sec: 0,
      source_type: 'manual',
      notes: notes || 'ثبت دستی از طریق پنل کاربری',
    });
    res.json({ success: true, id: pid });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// 9b. ویرایش پلاک موجود (PUT /api/plates/:id)
app.put('/api/plates/:id', async (req, res) => {
  const plateId = parseInt(req.params.id, 10);
  if (isNaN(plateId)) {
    return res.status(400).json({ success: false, error: 'شناسه پلاک نامعتبر است.' });
  }
  const { part_two_digits, letter, part_three_digits, province_code, vehicle_type, notes } = req.body;
  try {
    const updated = await updatePlate(plateId, {
      part_two_digits,
      letter,
      part_three_digits,
      province_code,
      vehicle_type,
      notes,
    });
    if (!updated) {
      return res.status(404).json({ success: false, error: 'پلاک با این شناسه یافت نشد.' });
    }
    res.json({ success: true, id: plateId });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// 9c. حذف پلاک (DELETE /api/plates/:id)
app.delete('/api/plates/:id', async (req, res) => {
  const plateId = parseInt(req.params.id, 10);
  if (isNaN(plateId)) {
    return res.status(400).json({ success: false, error: 'شناسه پلاک نامعتبر است.' });
  }
  try {
    const deleted = await deletePlate(plateId);
    if (!deleted) {
      return res.status(404).json({ success: false, error: 'پلاک با این شناسه یافت نشد.' });
    }
    res.json({ success: true, id: plateId });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ---------- توابع کمکی درج/ویرایش/حذف با node:sqlite یا fallback به Python ----------

// نگاشت کدهای استان (هماهنگ با anpr_system.py)
const PROVINCE_CODES: Record<string, string> = {
  '11': 'تهران (مرکز)', '22': 'تهران (غرب)', '33': 'تهران (شرق)', '44': 'تهران (شمال)',
  '55': 'گیلان (رشت)', '66': 'مازندران (ساری)', '77': 'تهران (جنوب)', '88': 'تهران (جنوب غرب)',
  '99': 'البرز (کرج)', '10': 'تهران (پایتخت)', '20': 'اصفهان (مرکز و شهرستان‌ها)',
  '30': 'قم', '40': 'تهران (ذخیره)', '50': 'سیستان و بلوچستان', '60': 'مازندران (شهرهای ساحلی)',
  '70': 'قزوین', '80': 'تهران (ذخیره)', '90': 'سمنان',
  '12': 'خراسان رضوی (مشهد)', '32': 'خراسان رضوی', '42': 'خراسان رضوی',
  '64': 'فارس (شیراز)', '73': 'فارس (شیراز)', '83': 'فارس', '93': 'فارس',
  '13': 'اصفهان (کاشان/نجف آباد)', '23': 'اصفهان', '43': 'اصفهان', '53': 'اصفهان', '67': 'اصفهان',
  '14': 'خوزستان (اهواز)', '24': 'خوزستان', '34': 'خوزستان',
  '15': 'آذربایجان شرقی (تبریز)', '25': 'آذربایجان شرقی', '35': 'آذربایجان شرقی',
  '17': 'آذربایجان غربی (ارومیه)', '27': 'آذربایجان غربی', '37': 'آذربایجان غربی',
  '18': 'همدان', '28': 'همدان', '19': 'کرمانشاه', '29': 'کرمانشاه',
  '45': 'کرمان', '65': 'کرمان', '46': 'گیلان', '56': 'گیلان', '76': 'گیلان',
  '47': 'مرکزی (اراک)', '57': 'مرکزی', '48': 'بوشهر', '58': 'بوشهر',
  '49': 'کهگیلویه و بویراحمد', '51': 'کردستان (سنندج)', '61': 'کردستان',
  '52': 'یزد', '62': 'یزد', '71': 'چهارمحال و بختیاری (شهرکرد)', '81': 'چهارمحال و بختیاری',
  '72': 'مازندران', '82': 'مازندران (آمل/بابل)', '92': 'مازندران',
  '74': 'یزد', '84': 'هرمزگان (بندرعباس)', '94': 'هرمزگان',
  '85': 'سمنان', '87': 'زنجان', '97': 'زنجان',
  '21': 'تهران (حومه / شهرستان‌ها)', '38': 'همدان (ملایر)',
};

const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const TO_PERSIAN = (s: string) => String(s || '').replace(/[0-9]/g, (d) => PERSIAN_DIGITS[+d]);

function buildPlateStrings(part1: string, letter: string, part2: string, provCode: string, vehicleType: string) {
  const p1 = String(part1 || '').trim();
  const lt = String(letter || '').trim();
  const p2 = String(part2 || '').trim();
  const pc = String(provCode || '').trim();
  const isMotor = (vehicleType || '').includes('موتور');
  if (isMotor) {
    return {
      plate_full_fa: `${TO_PERSIAN(p1)} / ${TO_PERSIAN(p2)}`,
      plate_full_en: `${p1}-${p2}`,
      province_name: 'پلاک ملی موتور',
    };
  }
  return {
    plate_full_fa: `${TO_PERSIAN(p1)} ${lt} ${TO_PERSIAN(p2)} - ایران ${TO_PERSIAN(pc)}`,
    plate_full_en: `${p1} ${lt} ${p2} Iran ${pc}`,
    province_name: PROVINCE_CODES[pc] || 'نامشخص / عمومی',
  };
}

async function insertPlate(data: any): Promise<number> {
  const db = await getDb();
  const part1 = String(data.part_two_digits || '').trim();
  const letter = String(data.letter || '').trim();
  const part2 = String(data.part_three_digits || '').trim();
  const prov = String(data.province_code || '').trim();
  const vehicleType = data.vehicle_type || 'سواری';
  const confidence = data.confidence ?? 1.0;
  const tsSec = data.video_timestamp_sec ?? 0;
  const sourceType = data.source_type || 'manual';
  const notes = data.notes || '';
  const { plate_full_fa, plate_full_en, province_name } = buildPlateStrings(part1, letter, part2, prov, vehicleType);
  const tsFormatted = `${Math.floor(tsSec / 60).toString().padStart(2, '0')}:${Math.floor(tsSec % 60).toString().padStart(2, '0')}`;

  if (db) {
    // بررسی وجود پلاک تکراری
    const existing = db.prepare('SELECT id, detection_count FROM detected_plates WHERE plate_full_en = ?').get(`${plate_full_en}`);
    if (existing) {
      const newCount = (existing.detection_count || 1) + 1;
      db.prepare(`
        UPDATE detected_plates
        SET last_seen = CURRENT_TIMESTAMP, detection_count = ?, notes = CASE WHEN ? != '' THEN ? ELSE notes END
        WHERE id = ?
      `).run(newCount, notes, notes, existing.id);
      return existing.id;
    }
    const result = db.prepare(`
      INSERT INTO detected_plates (
        plate_full_fa, plate_full_en, part_two_digits, letter, part_three_digits,
        province_code, province_name, vehicle_type, confidence, video_timestamp_sec,
        timestamp_formatted, first_seen, last_seen, detection_count, frame_path, crop_path, source_type, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 1, ?, ?, ?, ?)
    `).run(
      plate_full_fa, plate_full_en, part1, letter, part2,
      prov, province_name, vehicleType, confidence, tsSec,
      tsFormatted, data.frame_path || '', data.crop_path || '', sourceType, notes
    );
    return result.lastInsertRowid as number;
  }

  // Fallback به Python
  return new Promise((resolve, reject) => {
    const plateJson = JSON.stringify({
      part_two_digits: part1, letter, part_three_digits: part2, province_code: prov,
      vehicle_type: vehicleType, confidence, video_timestamp_sec: tsSec,
      source_type: sourceType, notes,
    });
    const pythonScript = `
import json, sys
sys.stdout.reconfigure(encoding='utf-8', errors='replace') if hasattr(sys.stdout, 'reconfigure') else None
from anpr_system import LicensePlateDatabase
db = LicensePlateDatabase('data/plates.db')
data = json.loads('${plateJson.replace(/'/g, "\\'")}')
pid = db.insert_or_update_plate(data)
print(json.dumps({"id": pid}))
`;
    exec(
      `"${getPythonCommand()}" -c "${pythonScript.replace(/"/g, '\\"')}"`,
      { cwd: __dirname, env: getPythonEnv() },
      (err, stdout) => {
        if (err) return reject(err);
        try {
          const r = JSON.parse(stdout.trim());
          resolve(r.id);
        } catch (e) {
          reject(e);
        }
      }
    );
  });
}

async function updatePlate(id: number, data: any): Promise<boolean> {
  const db = await getDb();
  if (!db) {
    // fallback Python
    return new Promise((resolve) => {
      const payload = JSON.stringify({ id, ...data });
      const pythonScript = `
import json, sys
sys.stdout.reconfigure(encoding='utf-8', errors='replace') if hasattr(sys.stdout, 'reconfigure') else None
from anpr_system import LicensePlateDatabase
db = LicensePlateDatabase('data/plates.db')
data = json.loads('${payload.replace(/'/g, "\\'")}')
ok = db.update_plate(data.get('id'), data)
print(json.dumps({"updated": ok}))
`;
      exec(
        `"${getPythonCommand()}" -c "${pythonScript.replace(/"/g, '\\"')}"`,
        { cwd: __dirname, env: getPythonEnv() },
        (err, stdout) => {
          if (err) return resolve(false);
          try {
            const r = JSON.parse(stdout.trim());
            resolve(!!r.updated);
          } catch {
            resolve(false);
          }
        }
      );
    });
  }
  // بررسی وجود رکورد
  const existing = db.prepare('SELECT id FROM detected_plates WHERE id = ?').get(id);
  if (!existing) return false;

  const part1 = String(data.part_two_digits || '').trim();
  const letter = String(data.letter || '').trim();
  const part2 = String(data.part_three_digits || '').trim();
  const prov = String(data.province_code || '').trim();
  const vehicleType = data.vehicle_type || 'سواری';
  const notes = data.notes ?? null;
  const { plate_full_fa, plate_full_en, province_name } = buildPlateStrings(part1, letter, part2, prov, vehicleType);

  db.prepare(`
    UPDATE detected_plates
    SET part_two_digits = ?, letter = ?, part_three_digits = ?, province_code = ?,
        province_name = ?, vehicle_type = ?, plate_full_fa = ?, plate_full_en = ?,
        notes = CASE WHEN ? IS NULL THEN notes ELSE ? END,
        last_seen = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    part1, letter, part2, prov, province_name, vehicleType,
    plate_full_fa, plate_full_en, notes, notes, id
  );
  return true;
}

async function deletePlate(id: number): Promise<boolean> {
  const db = await getDb();
  if (!db) {
    return new Promise((resolve) => {
      const pythonScript = `
import json, sys
sys.stdout.reconfigure(encoding='utf-8', errors='replace') if hasattr(sys.stdout, 'reconfigure') else None
from anpr_system import LicensePlateDatabase
db = LicensePlateDatabase('data/plates.db')
ok = db.delete_plate(${id})
print(json.dumps({"deleted": ok}))
`;
      exec(
        `"${getPythonCommand()}" -c "${pythonScript.replace(/"/g, '\\"')}"`,
        { cwd: __dirname, env: getPythonEnv() },
        (err, stdout) => {
          if (err) return resolve(false);
          try {
            const r = JSON.parse(stdout.trim());
            resolve(!!r.deleted);
          } catch {
            resolve(false);
          }
        }
      );
    });
  }
  const existing = db.prepare('SELECT id FROM detected_plates WHERE id = ?').get(id);
  if (!existing) return false;
  // حذف لاگ‌های مرتبط سپس خود پلاک
  db.prepare('DELETE FROM detection_logs WHERE plate_id = ?').run(id);
  db.prepare('DELETE FROM detected_plates WHERE id = ?').run(id);
  return true;
}

// 10. دانلود فایل دیتابیس SQLite
app.get('/api/download-db', (req, res) => {
  if (fs.existsSync(DB_PATH)) {
    res.download(DB_PATH, 'plates.db');
  } else {
    res.status(404).send('Database not found');
  }
});

// 11. خروجی JSON
app.get('/api/export-json', async (req, res) => {
  try {
    const plates = await queryDb('SELECT * FROM detected_plates ORDER BY id DESC');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="detected_plates.json"');
    res.send(JSON.stringify(plates, null, 2));
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// 12. خروجی CSV استاندارد اکسل با پیشوند UTF-8 BOM
app.get('/api/export-csv', async (req, res) => {
  try {
    const plates = await queryDb('SELECT * FROM detected_plates ORDER BY id DESC');
    let csv = '\uFEFF';
    csv += 'شناسه,پلاک کامل فارسی,پلاک انگلیسی,دو رقم,حرف,سه رقم,کد استان,استان,نوع خودرو,دقت,زمان در ویدیو,منبع,تاریخ اولین رویت,تعداد رویت\n';
    for (const p of plates) {
      const cleanFa = (p.plate_full_fa || '').replace(/"/g, '""');
      const cleanEn = (p.plate_full_en || '').replace(/"/g, '""');
      const cleanProv = (p.province_name || '').replace(/"/g, '""');
      const cleanVeh = (p.vehicle_type || '').replace(/"/g, '""');
      csv += `"${p.id}","${cleanFa}","${cleanEn}","${p.part_two_digits || ''}","${p.letter || ''}","${p.part_three_digits || ''}","${p.province_code || ''}","${cleanProv}","${cleanVeh}","${p.confidence || 0.95}","${p.timestamp_formatted || '00:00'}","${p.source_type || 'video'}","${p.first_seen || ''}","${p.detection_count || 1}"\n`;
    }
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="detected_plates.csv"');
    res.send(csv);
  } catch (e: any) {
    res.status(500).send(e.message);
  }
});

// 13. خواندن کدهای پایتون برای نمایش در تب سورس
app.get('/api/source-code', (req, res) => {
  try {
    const anprCode = fs.readFileSync(path.join(__dirname, ANPR_SCRIPT), 'utf-8');
    const testCode = fs.readFileSync(path.join(__dirname, TEST_SCRIPT), 'utf-8');
    res.json({ anprCode, testCode });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// 14. Health check — اطلاعاتی درباره وضعیت سرور و پایتون
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    timestamp: new Date().toISOString(),
    server: {
      port: PORT,
      platform: process.platform,
      nodeVersion: process.version,
      cwd: process.cwd(),
    },
    python: {
      command: getPythonCommand(),
    },
    database: {
      path: DB_PATH,
      exists: fs.existsSync(DB_PATH),
      size: fs.existsSync(DB_PATH) ? fs.statSync(DB_PATH).size : 0,
    },
    anprScript: ANPR_SCRIPT,
  });
});

// Catch-all برای مسیرهای /api که وجود ندارند (برای جلوگیری از serving index.html)
app.all('/api/*', (req, res) => {
  res.status(404).json({
    success: false,
    error: `مسیر API یافت نشد: ${req.method} ${req.path}`,
  });
});

// Global Error Handler — همه خطاها را به‌صورت JSON برمی‌گرداند
app.use((err: any, req: any, res: any, next: any) => {
  console.error('[Express Error]', err.message);
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal Server Error',
    path: req.path,
    method: req.method,
  });
});

// سرو فایل‌های استاتیک در حالت تولید یا ادغام با Vite در حالت توسعه
async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      if (req.path.startsWith('/api/')) {
        return res.status(404).json({ success: false, error: 'Not found' });
      }
      res.sendFile(path.resolve(__dirname, 'dist/index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
    console.log(`[Python] using: ${getPythonCommand()}`);
    console.log(`[Health] http://localhost:${PORT}/api/health`);
  });
}

startServer();
