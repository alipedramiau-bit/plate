#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
دستور اجرای سرور FastAPI پلاک‌خوان ایرانی:
uvicorn backend.main:app --host 0.0.0.0 --port 8002 --reload
"""

import os
import sys

# افزودن مسیر ریشه و فولدر backend به پایتون
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.join(BASE_DIR, "backend")
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from backend.main import app

# دستور اجرای سرور:
# uvicorn backend.main:app --host 0.0.0.0 --port 8002 --reload

if __name__ == "__main__":
    import uvicorn
    # uvicorn backend.main:app --host 0.0.0.0 --port 8002 --reload
    print("🚀 دستور اجرا: uvicorn backend.main:app --host 0.0.0.0 --port 8002 --reload")
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8002, reload=True)
