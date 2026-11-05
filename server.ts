import express from 'express';
import path from 'path';
import fs from 'fs';
import { exec } from 'child_process';
import { fileURLToPath } from 'url';
import multer from 'multer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

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

// مسیر فایل پایگاه داده
const DB_PATH = path.resolve(__dirname, 'data/plates.db');

// Helper to query SQLite via python script or sqlite3 CLI
function queryDb(sql: string, params: any[] = []): Promise<any> {
  return new Promise((resolve, reject) => {
    const pythonScript = `
import sqlite3, json, sys
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
    exec(`python3 -c "${pythonScript.replace(/"/g, '\\"')}"`, (err, stdout, stderr) => {
      if (err) {
        return reject(err);
      }
      try {
        const result = JSON.parse(stdout.trim());
        if (result && result.error) {
          return reject(new Error(result.error));
        }
        resolve(result);
      } catch (e) {
        reject(e);
      }
    });
  });
}

// 1. دریافت فهرست تمام پلاک‌ها از پایگاه داده
app.get('/api/plates', async (req, res) => {
  try {
    const plates = await queryDb('SELECT * FROM detected_plates ORDER BY id DESC');
    res.json({ success: true, data: plates });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
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
    res.status(500).json({ success: false, error: error.message });
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

  // اجرای اسکریپت پایتون روی فایل آپلود شده
  const command = `python3 anpr_system.py --video "${relativePath}" --db data/plates.db`;
  exec(command, { cwd: __dirname }, async (err, stdout, stderr) => {
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
  const command = `python3 anpr_system.py --stream "${streamUrl.replace(/"/g, '\\"')}" --stream-name "${safeName.replace(/"/g, '\\"')}" --sec ${currentSec.toFixed(1)} --db data/plates.db`;

  exec(command, { cwd: __dirname }, async (err, stdout, stderr) => {
    if (err) {
      console.error('خطا در دریافت استریم زنده:', stderr);
      return res.status(500).json({
        success: false,
        error: stderr || err.message,
      });
    }

    try {
      let detectedRecord: any = null;
      try {
        const jsonMatch = stdout.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          detectedRecord = JSON.parse(jsonMatch[0]);
        }
      } catch (parseErr) {
        console.warn('عدم توانایی در پارس خروجی JSON استریم:', stdout);
      }

      const allPlates = await queryDb('SELECT * FROM detected_plates ORDER BY id DESC');
      const activeRecords = detectedRecord?.detected_records || (detectedRecord ? [detectedRecord] : []);
      res.json({
        success: true,
        detectedRecord: detectedRecord?.detected_record || detectedRecord,
        detectedRecords: activeRecords,
        stdout,
        data: allPlates,
      });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message });
    }
  });
});

// اسکن سریع و استخراج تمام خودروهای ویدیوی جاری برای نمایش لحظه‌ای
app.post('/api/scan-all-live', (req: any, res: any) => {
  const videoPath = req.body.videoPath || 'public/assets/aistudio/VID_20261029_183130_849_4af72e51.mp4';
  const command = `python3 anpr_system.py --video "${videoPath}" --db data/plates.db`;

  exec(command, { cwd: __dirname }, async (err, stdout, stderr) => {
    if (err) {
      return res.status(500).json({ success: false, error: stderr || err.message });
    }
    try {
      const plates = await queryDb('SELECT * FROM detected_plates ORDER BY id DESC');
      res.json({ success: true, data: plates });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message });
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

    const command = `python3 anpr_system.py --frame "${absPath}" --db data/plates.db`;
    exec(command, { cwd: __dirname }, async (err, stdout, stderr) => {
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
  const command = `python3 anpr_system.py --video "${videoPath}" --db data/plates.db`;

  exec(command, { cwd: __dirname }, async (err, stdout, stderr) => {
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
  exec('python3 test_anpr.py', { cwd: __dirname }, (err, stdout, stderr) => {
    res.json({
      success: !err,
      stdout: stdout || '',
      stderr: stderr || '',
      exitCode: err ? err.code : 0,
    });
  });
});

// 9. درج دستی پلاک در دیتابیس برای تست
app.post('/api/plates', (req, res) => {
  const { part_two_digits, letter, part_three_digits, province_code, vehicle_type, notes } = req.body;
  const plateJson = JSON.stringify({
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

  const pythonScript = `
import json
from anpr_system import LicensePlateDatabase
db = LicensePlateDatabase('data/plates.db')
data = json.loads('${plateJson.replace(/'/g, "\\'")}')
pid = db.insert_or_update_plate(data)
print(json.dumps({"id": pid}))
`;

  exec(`python3 -c "${pythonScript.replace(/"/g, '\\"')}"`, { cwd: __dirname }, (err, stdout, stderr) => {
    if (err) {
      return res.status(500).json({ success: false, error: stderr || err.message });
    }
    res.json({ success: true, result: JSON.parse(stdout.trim()) });
  });
});

// 10. دانلود فایل دیتابیس SQLite
app.get('/api/download-db', (req, res) => {
  if (fs.existsSync(DB_PATH)) {
    res.download(DB_PATH, 'plates.db');
  } else {
    res.status(404).send('Database not found');
  }
});

// 11. خروجی JSON با انکودینگ کامل UTF-8 و ساختار استاندارد
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

// 12. خروجی CSV استاندارد اکسل با پیشوند UTF-8 BOM جهت نمایش بدون مشکل کاراکترهای فارسی
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
    const anprCode = fs.readFileSync(path.join(__dirname, 'anpr_system.py'), 'utf-8');
    const testCode = fs.readFileSync(path.join(__dirname, 'test_anpr.py'), 'utf-8');
    res.json({ anprCode, testCode });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// سرو فایل‌های استاتیک در حالت تولید یا ادغام با Vite در حالت توسعه
async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
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
  });
}

startServer();
