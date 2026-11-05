#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
آزمون خودکار جامع سیستم تشخیص پلاک و انتقال به دیتابیس (Automated ANPR Unit & Integration Tests)
بررسی صحت عملکرد:
۱. ساخت پایگاه داده و ایجاد جدول‌ها
۲. تفکیک دقیق اجزای پلاک (۲ رقم، حرف فارسی، ۳ رقم، کد ۲ رقمی استان)
۳. اجرای تشخیص روی ویدیوی ارسالی کاربر و استخراج فریم‌ها و کات پلاک‌ها
۴. استعلام از دیتابیس SQLite و راستی‌آزمایی فیلدها و ستون‌ها
"""

import os
import sys
import sqlite3
from anpr_system import LicensePlateDatabase, VideoPlateDetector, to_persian_digits, to_english_digits, normalize_persian_letter

def run_tests():
    print("=" * 80)
    print("🚦 شروع تست‌های خودکار برنامه تشخیص پلاک و پایگاه داده")
    print("=" * 80)

    test_db_path = "data/test_plates.db"
    if os.path.exists(test_db_path):
        os.remove(test_db_path)

    # ----------------------------------------------------
    # تست ۱: ساخت دیتابیس و اعتبارسنجی ساختار جدول
    # ----------------------------------------------------
    print("\n[تست ۱] بررسی راه‌اندازی دیتابیس SQLite و ایجاد جدول‌ها...")
    db = LicensePlateDatabase(test_db_path)
    with db.get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='detected_plates';")
        table_exists = cursor.fetchone()
        assert table_exists is not None, "❌ جدول detected_plates ایجاد نشد!"

        cursor.execute("PRAGMA table_info(detected_plates);")
        columns = [col[1] for col in cursor.fetchall()]
        required_cols = [
            "id", "plate_full_fa", "plate_full_en",
            "part_two_digits", "letter", "part_three_digits",
            "province_code", "province_name", "vehicle_type", "confidence"
        ]
        for rc in required_cols:
            assert rc in columns, f"❌ ستون {rc} در جدول وجود ندارد!"
    print("  ✓ تست ۱ با موفقیت پاس شد: ساختار جدول و فیلدهای اعداد و حروف به طور کامل ایجاد شد.")

    # ----------------------------------------------------
    # تست ۲: انتقال اعداد و حروف به دیتابیس و بررسی مقادیر
    # ----------------------------------------------------
    print("\n[تست ۲] تست درج نمونه پلاک و تفکیک اجزا در دیتابیس...")
    sample_plate = {
        "part_two_digits": "14",
        "letter": "د",
        "part_three_digits": "259",
        "province_code": "20",
        "vehicle_type": "سواری دنا",
        "confidence": 0.98,
        "video_timestamp_sec": 26.5,
        "notes": "تست درج پلاک دنا با حروف و اعداد فارسی"
    }
    inserted_id = db.insert_or_update_plate(sample_plate)
    assert inserted_id is not None and inserted_id > 0, "❌ شناسه رکورد نامعتبر است!"

    # استعلام از دیتابیس برای اعتبارسنجی
    with db.get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM detected_plates WHERE id = ?", (inserted_id,))
        row = dict(cursor.fetchone())

        assert row["part_two_digits"] == "14", f"❌ خطا در بخش دو رقم: {row['part_two_digits']}"
        assert row["letter"] == "د", f"❌ خطا در حرف فارسی: {row['letter']}"
        assert row["part_three_digits"] == "259", f"❌ خطا در بخش سه رقم: {row['part_three_digits']}"
        assert row["province_code"] == "20", f"❌ خطا در کد استان: {row['province_code']}"
        assert "اصفهان" in row["province_name"], f"❌ خطا در تطبیق نام استان: {row['province_name']}"
        assert "۱۴ د ۲۵۹" in row["plate_full_fa"], f"❌ متن فارسی پلاک اشتباه است: {row['plate_full_fa']}"

    print(f"  ✓ تست ۲ با موفقیت پاس شد: پلاک '{row['plate_full_fa']}' با تفکیک کامل اجزا ذخیره و بازیابی شد.")

    # ----------------------------------------------------
    # تست ۳: تست مدیریت پلاک تکراری (Duplicate Handling)
    # ----------------------------------------------------
    print("\n[تست ۳] بررسی عدم تکرار داده‌های تکراری و به‌روزرسانی شمارنده مشاهده...")
    prev_count = db.count_plates()
    # درج مجدد همان پلاک
    db.insert_or_update_plate(sample_plate)
    new_count = db.count_plates()
    assert prev_count == new_count, "❌ برای پلاک تکراری رکورد جدیدی نباید ساخته شود!"

    with db.get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT detection_count FROM detected_plates WHERE id = ?", (inserted_id,))
        det_count = cursor.fetchone()[0]
        assert det_count == 2, f"❌ شمارنده رویت به‌روز نشد: {det_count}"
    print(f"  ✓ تست ۳ با موفقیت پاس شد: پلاک تکراری شناسایی شد و شمارنده مشاهده به {det_count} افزایش یافت.")

    # ----------------------------------------------------
    # تست ۴: اجرای یکپارچه روی کلیپ ارسالی کاربر
    # ----------------------------------------------------
    video_path = "public/assets/aistudio/VID_20261029_183130_849_4af72e51.mp4"
    print(f"\n[تست ۴] اجرای پردازشگر روی ویدیوی واقعی کاربر ({video_path})...")

    # استفاده از دیتابیس اصلی پروژه برای نگهداری نتایج
    prod_db_path = "data/plates.db"
    prod_db = LicensePlateDatabase(prod_db_path)
    prod_db.clear() # شروع تازه

    detector = VideoPlateDetector(prod_db, output_dir="public")
    detected = detector.process_clip(video_path)

    assert len(detected) >= 5, f"❌ تعداد پلاک‌های استخراج شده کمتر از حد انتظار است: {len(detected)}"

    # بررسی نتایج در دیتابیس
    all_plates = prod_db.get_all_plates()
    assert len(all_plates) == len(detected), "❌ ناهمخوانی بین تعداد پلاک‌های خروجی و رکوردهای دیتابیس!"

    print("\n[✓] نتایج ذخیره شده در پایگاه داده SQLite:")
    for p in all_plates:
        print(f"   • پلاک #{p['id']}: {p['plate_full_fa']} | زمان در ویدیو: {p['timestamp_formatted']} | نوع: {p['vehicle_type']} | استان: {p['province_name']}")
        if p["crop_path"]:
            print(f"     تصویر کراپ پلاک: {p['crop_path']}")

    print("\n" + "=" * 80)
    print("🎉 تمامی تست‌ها با موفقیت ۱۰۰٪ پاس شدند و اطلاعات به دیتابیس SQLite منتقل گردید.")
    print("=" * 80)
    return True

if __name__ == "__main__":
    success = run_tests()
    sys.exit(0 if success else 1)
