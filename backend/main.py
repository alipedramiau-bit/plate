#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
بک‌اند تخصصی FastAPI برای سیستم هوشمند تشخیص پلاک خودروهای ایرانی (Iranian ANPR FastAPI Backend)
دستور اجرا در ترمینال:
uvicorn backend.main:app --host 0.0.0.0 --port 8002 --reload

این ماژول کلیه APIها را بر بستر فریم‌ورک مدرن و پرسرعت FastAPI پیاده‌سازی می‌کند:
- آپلود و پردازش ویدیو
- تحلیل زنده استریم‌های اینترنتی (HLS / RTSP / HTTP)
- تحلیل فریم‌ها و وب‌کم
- مدیریت و استعلام پایگاه داده SQLite
- مستندات خودکار اسواگر در مسیر /docs
"""

import os
import sys
import json
import base64
import shutil
import sqlite3
import subprocess
from typing import Optional, List
from datetime import datetime

from fastapi import FastAPI, UploadFile, File, Form, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse, FileResponse, Response
from pydantic import BaseModel

# ایمپورت ماژول اصلی تشخیص پلاک
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from anpr_system import LicensePlateDatabase, VideoPlateDetector, PROVINCE_CODES

app = FastAPI(
    title="Iranian ANPR System API (سامانه هوشمند پلاک‌خوان ایرانی)",
    description="سرویس وب تشخیص هوشمند پلاک خودروهای ایرانی با تفکیک اعداد و حروف در پایگاه داده SQLite",
    version="2.0.0"
)

# فعال‌سازی CORS برای اتصال فرانت‌اند React Vite
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.path.join(BASE_DIR, "data", "plates.db")
PUBLIC_DIR = os.path.join(BASE_DIR, "public")
UPLOADS_DIR = os.path.join(PUBLIC_DIR, "uploads")
CROPS_DIR = os.path.join(PUBLIC_DIR, "crops")
STREAMS_DIR = os.path.join(PUBLIC_DIR, "streams")
FRAMES_DIR = os.path.join(PUBLIC_DIR, "frames")

for d in [UPLOADS_DIR, CROPS_DIR, STREAMS_DIR, FRAMES_DIR, os.path.dirname(DB_PATH)]:
    os.makedirs(d, exist_ok=True)

db = LicensePlateDatabase(DB_PATH)
detector = VideoPlateDetector(db, output_dir=PUBLIC_DIR)


class StreamAnalysisRequest(BaseModel):
    streamUrl: str
    streamName: Optional[str] = "دوربین پخش زنده"
    currentTime: Optional[float] = 0.0
    sec: Optional[float] = 0.0

class FrameAnalysisRequest(BaseModel):
    imageBase64: str
    sourceLabel: Optional[str] = "اسنپ‌شات زنده"

class ManualPlateRequest(BaseModel):
    part_two_digits: str
    letter: str
    part_three_digits: str
    province_code: str
    vehicle_type: Optional[str] = "سواری"
    notes: Optional[str] = "ثبت دستی از طریق API"

class UpdatePlateRequest(BaseModel):
    part_two_digits: Optional[str] = None
    letter: Optional[str] = None
    part_three_digits: Optional[str] = None
    province_code: Optional[str] = None
    vehicle_type: Optional[str] = None
    notes: Optional[str] = None

class RunDetectionRequest(BaseModel):
    videoPath: Optional[str] = None


@app.get("/")
def read_root():
    return {
        "status": "online",
        "service": "Iranian ANPR FastAPI Backend",
        "version": "2.0.0",
        "database": "SQLite (data/plates.db)",
        "docs_url": "/docs"
    }

# 1. دریافت فهرست تمام پلاک‌ها از SQLite
@app.get("/api/plates")
def get_plates():
    try:
        plates = db.get_all_plates()
        return {"success": True, "data": plates}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# 2. لاگ‌های رویت
@app.get("/api/logs")
def get_detection_logs():
    try:
        with db.get_connection() as conn:
            cur = conn.cursor()
            cur.execute("""
                SELECT l.*, p.plate_full_fa, p.vehicle_type
                FROM detection_logs l
                LEFT JOIN detected_plates p ON l.plate_id = p.id
                ORDER BY l.id DESC
            """)
            logs = [dict(r) for r in cur.fetchall()]
        return {"success": True, "data": logs}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# 3. آپلود ویدیو و پردازش با پایتون
@app.post("/api/upload-video")
async def upload_video(video: UploadFile = File(...)):
    try:
        ext = os.path.splitext(video.filename)[1].lower()
        if ext not in [".mp4", ".mov", ".avi", ".mkv", ".webm", ".ts"]:
            raise HTTPException(status_code=400, detail="فرمت فایل ویدیویی نامعتبر است.")

        unique_name = f"{int(datetime.now().timestamp())}_{video.filename.replace(' ', '_')}"
        saved_abs_path = os.path.join(UPLOADS_DIR, unique_name)

        with open(saved_abs_path, "wb") as f:
            shutil.copyfileobj(video.file, f)

        # اجرای پردازش پلاک روی ویدیو
        detected_plates = detector.process_clip(saved_abs_path)
        all_plates = db.get_all_plates()

        return {
            "success": True,
            "message": "ویدیو با موفقیت دریافت و پلاک‌های آن در دیتابیس ثبت گردید.",
            "filename": video.filename,
            "videoUrl": f"/uploads/{unique_name}",
            "detectedCount": len(detected_plates),
            "data": all_plates
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# 4. فهرست ویدیوهای آپلود شده
@app.get("/api/uploaded-videos")
def get_uploaded_videos():
    try:
        videos = []
        if os.path.exists(UPLOADS_DIR):
            for fname in os.listdir(UPLOADS_DIR):
                fpath = os.path.join(UPLOADS_DIR, fname)
                if os.path.isfile(fpath):
                    st = os.stat(fpath)
                    videos.append({
                        "filename": fname,
                        "url": f"/uploads/{fname}",
                        "size": st.st_size,
                        "createdAt": datetime.fromtimestamp(st.st_ctime).isoformat()
                    })
        return {"success": True, "videos": videos}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# 5. تحلیل استریم دوربین پخش زنده اینترنتی
@app.post("/api/analyze-live-stream")
def analyze_live_stream(payload: StreamAnalysisRequest):
    try:
        sec_val = float(payload.currentTime or payload.sec or 0.0)
        record = detector.process_live_stream_url(payload.streamUrl, payload.streamName, sec_val)
        all_plates = db.get_all_plates()
        return {
            "success": True,
            "detectedRecord": record,
            "data": all_plates
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# 6. تحلیل اسنپ‌شات یا فریم ارسال شده
@app.post("/api/analyze-frame")
def analyze_frame(payload: FrameAnalysisRequest):
    try:
        base64_data = payload.imageBase64
        if "base64," in base64_data:
            base64_data = base64_data.split("base64,")[1]

        ts = int(datetime.now().timestamp())
        snap_path = os.path.join(CROPS_DIR, f"snap_{ts}.jpg")
        with open(snap_path, "wb") as f:
            f.write(base64.b64decode(base64_data))

        record = detector.process_canvas_frame(snap_path, payload.sourceLabel or "اسنپ‌شات")
        all_plates = db.get_all_plates()
        return {
            "success": True,
            "detectedRecord": record,
            "data": all_plates
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# 7. اجرای پردازش روی ویدیوی کلیپ
@app.post("/api/run-detection")
def run_detection(payload: RunDetectionRequest):
    try:
        vid_path = payload.videoPath or os.path.join(PUBLIC_DIR, "assets/aistudio/VID_20261029_183130_849_4af72e51.mp4")
        if not os.path.exists(vid_path) and os.path.exists(os.path.join(BASE_DIR, vid_path)):
            vid_path = os.path.join(BASE_DIR, vid_path)

        records = detector.process_clip(vid_path)
        all_plates = db.get_all_plates()
        return {"success": True, "detectedCount": len(records), "data": all_plates}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# 8. ثبت دستی پلاک در دیتابیس
@app.post("/api/plates")
def add_manual_plate(payload: ManualPlateRequest):
    try:
        pid = db.insert_or_update_plate({
            "part_two_digits": payload.part_two_digits,
            "letter": payload.letter,
            "part_three_digits": payload.part_three_digits,
            "province_code": payload.province_code,
            "vehicle_type": payload.vehicle_type or "سواری",
            "confidence": 1.0,
            "source_type": "manual",
            "notes": payload.notes or "ثبت دستی از طریق پنل"
        })
        return {"success": True, "id": pid}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# 8b. ویرایش پلاک موجود
@app.put("/api/plates/{plate_id}")
def update_plate(plate_id: int, payload: UpdatePlateRequest):
    try:
        # ساختن dict فقط از فیلدهای ارسال‌شده (non-null)
        update_data = {k: v for k, v in payload.dict().items() if v is not None}
        if not update_data:
            raise HTTPException(status_code=400, detail="هیچ فیلدی برای به‌روزرسانی ارسال نشده است.")
        ok = db.update_plate(plate_id, update_data)
        if not ok:
            raise HTTPException(status_code=404, detail="پلاک با این شناسه یافت نشد.")
        return {"success": True, "id": plate_id}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# 8c. حذف پلاک
@app.delete("/api/plates/{plate_id}")
def delete_plate(plate_id: int):
    try:
        ok = db.delete_plate(plate_id)
        if not ok:
            raise HTTPException(status_code=404, detail="پلاک با این شناسه یافت نشد.")
        return {"success": True, "id": plate_id}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# 8d. اجرای تست‌ها — استفاده از `python` به‌جای `python3` برای سازگاری با ویندوز
@app.post("/api/run-tests")
def run_tests():
    try:
        # در ویندوز دستور `python` استاندارد است (نه `python3`)
        # ابتدا python را امتحان می‌کنیم، در صورت شکست python3
        cmd = None
        for c in ("python", "python3", "py"):
            try:
                subprocess.run([c, "--version"], capture_output=True, check=True)
                cmd = c
                break
            except (FileNotFoundError, subprocess.CalledProcessError):
                continue
        if not cmd:
            raise RuntimeError("هیچ دستور پایتونی در PATH یافت نشد.")
        proc = subprocess.run([cmd, os.path.join(BASE_DIR, "test_anpr.py")],
                              capture_output=True, text=True)
        return {
            "success": proc.returncode == 0,
            "stdout": proc.stdout,
            "stderr": proc.stderr,
            "exitCode": proc.returncode
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# 10. دانلود فایل دیتابیس
@app.get("/api/download-db")
def download_db():
    if os.path.exists(DB_PATH):
        return FileResponse(DB_PATH, filename="plates.db", media_type="application/x-sqlite3")
    raise HTTPException(status_code=404, detail="Database file not found")

# 11. خروجی JSON
@app.get("/api/export-json")
def export_json():
    plates = db.get_all_plates()
    return JSONResponse(content=plates, headers={"Content-Disposition": "attachment; filename=detected_plates.json"})

# 12. خروجی CSV
@app.get("/api/export-csv")
def export_csv():
    plates = db.get_all_plates()
    csv_str = 'ID,Full_Plate_FA,Plate_EN,Two_Digits,Letter,Three_Digits,Province_Code,Province_Name,Vehicle_Type,Confidence,Timestamp,Source_Type,First_Seen,Detection_Count\n'
    for p in plates:
        csv_str += f'"{p["id"]}","{p["plate_full_fa"]}","{p["plate_full_en"]}","{p["part_two_digits"]}","{p["letter"]}","{p["part_three_digits"]}","{p["province_code"]}","{p["province_name"]}","{p["vehicle_type"]}","{p["confidence"]}","{p["timestamp_formatted"]}","{p.get("source_type","video")}","{p["first_seen"]}","{p["detection_count"]}"\n'

    content = '\uFEFF' + csv_str
    return Response(content=content, media_type="text/csv; charset=utf-8",
                    headers={"Content-Disposition": "attachment; filename=detected_plates.csv"})

# 13. خواندن سورس کدهای پایتون
@app.get("/api/source-code")
def get_source_code():
    try:
        current_dir = os.path.dirname(os.path.abspath(__file__))
        anpr_p = os.path.join(current_dir, "anpr_system.py")
        if not os.path.exists(anpr_p):
            anpr_p = os.path.join(BASE_DIR, "anpr_system.py")
        test_p = os.path.join(current_dir, "test_anpr.py")
        if not os.path.exists(test_p):
            test_p = os.path.join(BASE_DIR, "test_anpr.py")
        with open(anpr_p, "r", encoding="utf-8") as f:
            anpr_code = f.read()
        with open(test_p, "r", encoding="utf-8") as f:
            test_code = f.read()
        return {"anprCode": anpr_code, "testCode": test_code}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# مونت کردن فایل‌های استاتیک
app.mount("/crops", StaticFiles(directory=CROPS_DIR), name="crops")
app.mount("/frames", StaticFiles(directory=FRAMES_DIR), name="frames")
app.mount("/uploads", StaticFiles(directory=UPLOADS_DIR), name="uploads")
app.mount("/streams", StaticFiles(directory=STREAMS_DIR), name="streams")
if os.path.exists(os.path.join(PUBLIC_DIR, "assets")):
    app.mount("/assets", StaticFiles(directory=os.path.join(PUBLIC_DIR, "assets")), name="assets")

# دستور اجرای سرور:
# uvicorn backend.main:app --host 0.0.0.0 --port 8002 --reload

if __name__ == "__main__":
    import uvicorn
    # uvicorn backend.main:app --host 0.0.0.0 --port 8002 --reload
    print("🚀 دستور اجرا: uvicorn backend.main:app --host 0.0.0.0 --port 8002 --reload")
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    if base_dir not in sys.path:
        sys.path.insert(0, base_dir)
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8002, reload=True)


