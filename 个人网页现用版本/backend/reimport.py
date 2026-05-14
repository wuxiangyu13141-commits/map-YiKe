"""
reimport.py — 一键重新导入 CSV 数据
用法：python reimport.py

执行流程：
1. 删除旧数据库
2. 重新从 CSV 目录导入全部数据
3. 打印导入统计
"""
from pathlib import Path

DB_PATH = Path(__file__).parent / "economy_data.db"

if DB_PATH.exists():
    DB_PATH.unlink()
    print(f"[reimport] 已删除旧数据库: {DB_PATH.name}")

from main import init_db
init_db()
print("\n[reimport] ✅ 数据重导完成！重启 uvicorn 即可生效（--reload 模式会自动重载）")
