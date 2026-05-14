"""
main.py — FastAPI 后端服务 v2.0
从国家统计局真实 CSV 文件导入 → SQLite → REST API
数据表格式完全匹配前端 data.js 所需结构
"""
import re
import sqlite3
from contextlib import contextmanager
from pathlib import Path

import pandas as pd
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

# ── 路径配置 ──────────────────────────────────────────
BASE_DIR = Path(__file__).parent.parent
DB_PATH = Path(__file__).parent / "economy_data.db"
CSV_DIR = BASE_DIR / "国家统计局分省年度数据内蒙古自治区经济相关数据2020—2024"
CONSOLIDATED_CSV = BASE_DIR / "内蒙古经济数据总表.csv"

app = FastAPI(title="内蒙古经济数据可视化 API", version="2.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── 数据库连接 ────────────────────────────────────────
@contextmanager
def get_db():
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    try:
        yield conn
    finally:
        conn.close()


# ── CSV 读取工具 ──────────────────────────────────────
def _read_csv(name: str):
    """多编码尝试读取 CSV"""
    p = CSV_DIR / name
    if not p.exists():
        print(f"  [WARN] 未找到: {name}")
        return None
    for enc in ("utf-8-sig", "gbk", "gb2312", "utf-8"):
        try:
            return pd.read_csv(str(p), encoding=enc)
        except (UnicodeDecodeError, UnicodeError):
            continue
    print(f"  [ERR] 无法解码: {name}")
    return None


def _year_from_col(col: str):
    m = re.search(r"(20\d{2})", str(col))
    return int(m.group(1)) if m else None


# ══════════════════════════════════════════════════════
#  数据库建表 + CSV 导入
# ══════════════════════════════════════════════════════
def init_db():
    with get_db() as conn:
        _create_tables(conn)
        cnt = conn.execute("SELECT COUNT(*) c FROM stats_wide").fetchone()["c"]
        if cnt > 0:
            print(f"[init_db] 已有 {cnt} 条数据, 跳过导入")
            return

        # 优先从整合CSV导入（如果存在）
        if CONSOLIDATED_CSV.exists():
            print("[init_db] 发现整合CSV, 从整合CSV导入 ...")
            _import_from_consolidated(conn)
        else:
            print("[init_db] 正在从分散CSV文件导入 ...")
            _import_wide_csvs(conn)
            _import_export_structure(conn)
            _import_import_structure(conn)
            _import_trade_by_country(conn)
            _import_coal_transport(conn)
            _import_green_power(conn)
            _import_population_gdp(conn)

        conn.commit()
        total = conn.execute("SELECT COUNT(*) c FROM stats_wide").fetchone()["c"]
        print(f"[init_db] 导入完成! stats_wide 共 {total} 条记录")


def _create_tables(conn):
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS stats_wide (
            source    TEXT    NOT NULL,
            indicator TEXT    NOT NULL,
            year      INTEGER NOT NULL,
            value     REAL,
            PRIMARY KEY (source, indicator, year)
        );
        CREATE TABLE IF NOT EXISTS export_structure (
            year        INTEGER PRIMARY KEY,
            total       REAL,
            mineral     REAL, mineral_pct REAL,
            equip       REAL, equip_pct   REAL,
            chem        REAL, chem_pct    REAL,
            rare        REAL, rare_pct    REAL,
            agri        REAL, agri_pct    REAL,
            other_val   REAL, other_pct   REAL
        );
        CREATE TABLE IF NOT EXISTS import_structure (
            year        INTEGER PRIMARY KEY,
            total       REAL,
            resource    REAL, resource_pct REAL,
            equip       REAL, equip_pct   REAL,
            hi_mfg      REAL, hi_mfg_pct  REAL,
            chem        REAL, chem_pct    REAL,
            agri        REAL, agri_pct    REAL,
            other_val   REAL, other_pct   REAL
        );
        CREATE TABLE IF NOT EXISTS trade_by_country (
            country      TEXT    NOT NULL,
            export_goods TEXT,
            import_goods TEXT,
            year         INTEGER NOT NULL,
            export_val   REAL,
            import_val   REAL,
            PRIMARY KEY (country, year)
        );
        CREATE TABLE IF NOT EXISTS coal_transport (
            city   TEXT    NOT NULL,
            route  TEXT,
            year   INTEGER NOT NULL,
            amount REAL,
            PRIMARY KEY (city, year)
        );
        CREATE TABLE IF NOT EXISTS green_power_transport (
            city   TEXT    NOT NULL,
            route  TEXT,
            year   INTEGER NOT NULL,
            amount REAL,
            PRIMARY KEY (city, year)
        );
        CREATE TABLE IF NOT EXISTS population_gdp (
            year            INTEGER PRIMARY KEY,
            pop             REAL,
            birth_rate      REAL,
            death_rate      REAL,
            natural_growth  REAL,
            gdp_rank        INTEGER,
            per_capita_gdp  REAL,
            per_capita_rank INTEGER,
            coal_output     REAL,
            renew_cap       REAL,
            cloud_servers   REAL
        );
    """)
    conn.commit()


# ── 从整合CSV导入 ─────────────────────────────────────
def _import_from_consolidated(conn):
    """从 内蒙古经济数据总表.csv 导入全部数据到各表"""
    df = pd.read_csv(str(CONSOLIDATED_CSV), encoding="utf-8-sig")
    year_cols = [c for c in df.columns if re.match(r"^20\d{2}$", str(c))]
    n_stats = 0
    n_exp = 0; n_imp = 0; n_trade = 0; n_coal = 0; n_green = 0; n_pop = 0

    for _, row in df.iterrows():
        full_name = str(row["指标名称"]).strip()
        # 新格式: "分类—指标" (用 — 分隔)
        if "—" in full_name:
            cat, ind = full_name.split("—", 1)
        else:
            cat, ind = "", full_name

        # ── 特殊表: 出口商品结构 ──
        if cat == "出口商品结构":
            _dispatch_export_structure(conn, ind, row, year_cols)
            n_exp += 1
            continue
        # ── 特殊表: 进口商品结构 ──
        if cat == "进口商品结构":
            _dispatch_import_structure(conn, ind, row, year_cols)
            n_imp += 1
            continue
        # ── 特殊表: 对外贸易分国别 ──
        if cat == "对外贸易":
            _dispatch_trade_by_country(conn, ind, row, year_cols)
            n_trade += 1
            continue
        # ── 特殊表: 煤炭输送 ──
        if cat == "煤炭输送":
            _dispatch_coal(conn, ind, row, year_cols)
            n_coal += 1
            continue
        # ── 特殊表: 绿电输送 ──
        if cat == "绿电输送":
            _dispatch_green(conn, ind, row, year_cols)
            n_green += 1
            continue
        # ── 特殊表: 人口 ──
        if cat == "人口":
            _dispatch_population(conn, ind, row, year_cols)
            n_pop += 1
            continue

        # ── 通用: stats_wide ──
        for yc in year_cols:
            v = row[yc]
            if pd.isna(v) or str(v).strip() == "":
                continue
            try:
                fv = float(v)
            except (ValueError, TypeError):
                continue
            conn.execute(
                "INSERT OR REPLACE INTO stats_wide VALUES (?,?,?,?)",
                (cat, ind, int(yc), fv),
            )
            n_stats += 1

    print(f"  [stats_wide] {n_stats} 条")
    print(f"  [出口结构] {n_exp} 项, [进口结构] {n_imp} 项")
    print(f"  [贸易国别] {n_trade} 项, [煤炭输送] {n_coal} 项, [绿电输送] {n_green} 项")
    print(f"  [人口] {n_pop} 项")


# ── 整合CSV → 专用表 调度函数 ─────────────────────────
_EXP_FIELD_MAP = {
    "出口总额(亿元)": "total", "矿产品(亿元)": "mineral", "矿产品占比(%)": "mineral_pct",
    "机电产品(亿元)": "equip", "机电产品占比(%)": "equip_pct",
    "化工产品(亿元)": "chem", "化工产品占比(%)": "chem_pct",
    "稀土产品(亿元)": "rare", "稀土产品占比(%)": "rare_pct",
    "农畜产品(亿元)": "agri", "农畜产品占比(%)": "agri_pct",
    "其他产品(亿元)": "other_val", "其他产品占比(%)": "other_pct",
}
_IMP_FIELD_MAP = {
    "进口总额(亿元)": "total", "资源类(亿元)": "resource", "资源类占比(%)": "resource_pct",
    "机电产品(亿元)": "equip", "机电产品占比(%)": "equip_pct",
    "高新制造(亿元)": "hi_mfg", "高新制造占比(%)": "hi_mfg_pct",
    "化工产品(亿元)": "chem", "化工产品占比(%)": "chem_pct",
    "农畜产品(亿元)": "agri", "农畜产品占比(%)": "agri_pct",
    "其他(亿元)": "other_val", "其他占比(%)": "other_pct",
}
_POP_FIELD_MAP = {
    "常住人口(万人)": "pop", "出生率(‰)": "birth_rate", "死亡率(‰)": "death_rate",
    "自然增长率(‰)": "natural_growth", "GDP全国排名": "gdp_rank",
    "人均GDP(元)": "per_capita_gdp", "人均GDP全国排名": "per_capita_rank",
    "煤炭产量(亿吨)": "coal_output", "新能源装机(万千瓦)": "renew_cap",
    "算力服务器(万台)": "cloud_servers",
}


def _dispatch_export_structure(conn, ind, row, year_cols):
    col = _EXP_FIELD_MAP.get(ind)
    if not col:
        return
    for yc in year_cols:
        v = row[yc]
        if pd.isna(v) or str(v).strip() == "":
            continue
        yr = int(yc)
        conn.execute(f"INSERT OR IGNORE INTO export_structure (year) VALUES (?)", (yr,))
        conn.execute(f"UPDATE export_structure SET {col}=? WHERE year=?", (float(v), yr))


def _dispatch_import_structure(conn, ind, row, year_cols):
    col = _IMP_FIELD_MAP.get(ind)
    if not col:
        return
    for yc in year_cols:
        v = row[yc]
        if pd.isna(v) or str(v).strip() == "":
            continue
        yr = int(yc)
        conn.execute(f"INSERT OR IGNORE INTO import_structure (year) VALUES (?)", (yr,))
        conn.execute(f"UPDATE import_structure SET {col}=? WHERE year=?", (float(v), yr))


def _dispatch_trade_by_country(conn, ind, row, year_cols):
    # ind 格式: "俄罗斯出口额(亿元)" 或 "俄罗斯进口额(亿元)"
    if "出口额" in ind:
        country = ind.split("出口额")[0]
        col = "export_val"
    elif "进口额" in ind:
        country = ind.split("进口额")[0]
        col = "import_val"
    else:
        return
    for yc in year_cols:
        v = row[yc]
        if pd.isna(v) or str(v).strip() == "":
            continue
        yr = int(yc)
        conn.execute(
            "INSERT OR IGNORE INTO trade_by_country (country, year, export_val, import_val) VALUES (?,?,0,0)",
            (country, yr),
        )
        conn.execute(
            f"UPDATE trade_by_country SET {col}=? WHERE country=? AND year=?",
            (float(v), country, yr),
        )


def _dispatch_coal(conn, ind, row, year_cols):
    # ind 格式: "北京输送量(万吨)"
    city = ind.split("输送量")[0]
    for yc in year_cols:
        v = row[yc]
        if pd.isna(v) or str(v).strip() == "":
            continue
        yr = int(yc)
        conn.execute(
            "INSERT OR REPLACE INTO coal_transport (city, route, year, amount) VALUES (?,?,?,?)",
            (city, "", yr, float(v)),
        )


def _dispatch_green(conn, ind, row, year_cols):
    city = ind.split("输送量")[0]
    for yc in year_cols:
        v = row[yc]
        if pd.isna(v) or str(v).strip() == "":
            continue
        yr = int(yc)
        conn.execute(
            "INSERT OR REPLACE INTO green_power_transport (city, route, year, amount) VALUES (?,?,?,?)",
            (city, "", yr, float(v)),
        )


def _dispatch_population(conn, ind, row, year_cols):
    col = _POP_FIELD_MAP.get(ind)
    if not col:
        return
    for yc in year_cols:
        v = row[yc]
        if pd.isna(v) or str(v).strip() == "":
            continue
        yr = int(yc)
        conn.execute(f"INSERT OR IGNORE INTO population_gdp (year) VALUES (?)", (yr,))
        conn.execute(f"UPDATE population_gdp SET {col}=? WHERE year=?", (float(v), yr))


# ── 宽格式 CSV 导入 (指标×年份 → stats_wide) ────────
WIDE_CSVS = [
    "按经营单位所在地分货物进出口总额.csv",
    "地区生产总值.csv",
    "地区生产总值指数.csv",
    "地方财政收入.csv",
    "地方财政支出.csv",
    "居民人均可支配收入.csv",
    "居民人均消费支出.csv",
    "居民消费价格指数和商品零售价格指数.csv",
    "按行业分城镇单位就业人员.csv",
    "按行业分城镇单位就业人员工资总额.csv",
    "按行业分国有经济能源工业固定资产投资.csv",
    "能源供应分行业投资.csv",
    "传统产业天花板数据.csv",
    "高新产业崛起数据.csv",
    "漏斗效应数据.csv",
    "个体就业人员.csv",
]


def _import_wide_csvs(conn):
    for fname in WIDE_CSVS:
        df = _read_csv(fname)
        if df is None:
            continue
        src = fname.replace(".csv", "")
        col0 = df.columns[0]
        n = 0
        for _, row in df.iterrows():
            ind = str(row[col0]).strip()
            if not ind or ind == "nan":
                continue
            for col in df.columns[1:]:
                yr = _year_from_col(col)
                if yr is None:
                    continue
                val = row[col]
                if pd.isna(val) or str(val).strip() == "":
                    continue
                try:
                    fv = float(val)
                except (ValueError, TypeError):
                    continue
                conn.execute(
                    "INSERT OR REPLACE INTO stats_wide VALUES (?,?,?,?)",
                    (src, ind, yr, fv),
                )
                n += 1
        print(f"  [{src}] {n} 条")


def _import_export_structure(conn):
    df = _read_csv("出口商品结构数据.csv")
    if df is None:
        return
    for _, r in df.iterrows():
        v = [float(r.iloc[i]) if pd.notna(r.iloc[i]) else None for i in range(14)]
        v[0] = int(v[0]) if v[0] else None
        conn.execute(
            "INSERT OR REPLACE INTO export_structure VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
            v,
        )
    print(f"  [出口商品结构] {len(df)} 条")


def _import_import_structure(conn):
    df = _read_csv("进口商品结构数据.csv")
    if df is None:
        return
    for _, r in df.iterrows():
        v = [float(r.iloc[i]) if pd.notna(r.iloc[i]) else None for i in range(14)]
        v[0] = int(v[0]) if v[0] else None
        conn.execute(
            "INSERT OR REPLACE INTO import_structure VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
            v,
        )
    print(f"  [进口商品结构] {len(df)} 条")


def _import_trade_by_country(conn):
    df = _read_csv("对外贸易分国别数据.csv")
    if df is None:
        return
    n = 0
    for _, r in df.iterrows():
        ct = str(r.iloc[0]).strip()
        eg = str(r.iloc[1]).strip()
        ig = str(r.iloc[2]).strip()
        for i, yr in enumerate([2021, 2022, 2023, 2024]):
            ev = float(r.iloc[3 + i * 2])
            iv = float(r.iloc[4 + i * 2])
            conn.execute(
                "INSERT OR REPLACE INTO trade_by_country VALUES (?,?,?,?,?,?)",
                (ct, eg, ig, yr, ev, iv),
            )
            n += 1
    print(f"  [对外贸易分国别] {n} 条")


def _import_coal_transport(conn):
    df = _read_csv("煤炭输送分城市数据.csv")
    if df is None:
        return
    n = 0
    for _, r in df.iterrows():
        city = str(r.iloc[0]).strip()
        route = str(r.iloc[1]).strip()
        for i, yr in enumerate([2021, 2022, 2023, 2024]):
            conn.execute(
                "INSERT OR REPLACE INTO coal_transport VALUES (?,?,?,?)",
                (city, route, yr, float(r.iloc[2 + i])),
            )
            n += 1
    print(f"  [煤炭输送] {n} 条")


def _import_green_power(conn):
    df = _read_csv("绿电算力输送分城市数据.csv")
    if df is None:
        return
    n = 0
    for _, r in df.iterrows():
        city = str(r.iloc[0]).strip()
        route = str(r.iloc[1]).strip()
        for i, yr in enumerate([2021, 2022, 2023, 2024]):
            conn.execute(
                "INSERT OR REPLACE INTO green_power_transport VALUES (?,?,?,?)",
                (city, route, yr, float(r.iloc[2 + i])),
            )
            n += 1
    print(f"  [绿电算力输送] {n} 条")


def _import_population_gdp(conn):
    df = _read_csv("人口与GDP对比数据.csv")
    if df is None:
        return
    for _, r in df.iterrows():
        conn.execute(
            "INSERT OR REPLACE INTO population_gdp VALUES (?,?,?,?,?,?,?,?,?,?,?)",
            (
                int(r.iloc[0]), float(r.iloc[1]), float(r.iloc[2]),
                float(r.iloc[3]), float(r.iloc[4]), int(r.iloc[5]),
                float(r.iloc[6]), int(r.iloc[7]), float(r.iloc[8]),
                float(r.iloc[9]), float(r.iloc[10]),
            ),
        )
    print(f"  [人口与GDP对比] {len(df)} 条")


# ── 查询辅助 ──────────────────────────────────────────
def _by_year(conn, source, pattern):
    """从 stats_wide 查 {year: value}; 无 % 则精确匹配"""
    op = "LIKE" if "%" in pattern else "="
    rows = conn.execute(
        f"SELECT year, value FROM stats_wide "
        f"WHERE source=? AND indicator {op} ? ORDER BY year",
        (source, pattern),
    ).fetchall()
    return {r["year"]: r["value"] for r in rows}


def _series(conn, source):
    """取某 source 全部指标 → {indicator: {year: value}}"""
    rows = conn.execute(
        "SELECT indicator, year, value FROM stats_wide "
        "WHERE source=? ORDER BY indicator, year",
        (source,),
    ).fetchall()
    d = {}
    for r in rows:
        d.setdefault(r["indicator"], {})[r["year"]] = r["value"]
    return d


def _make_year_dict(conn, src, mappings):
    """field→pattern 映射 → {year: {field: value}}"""
    data = {f: _by_year(conn, src, p) for f, p in mappings.items()}
    all_years = set()
    for vals in data.values():
        all_years.update(vals.keys())
    return {yr: {f: vals.get(yr) for f, vals in data.items()} for yr in sorted(all_years)}


def _make_year_dict_multi(conn, mappings_list):
    """[(src, field, pattern), ...] → {year: {field: value}}"""
    data = {}
    all_years = set()
    for src, field, pat in mappings_list:
        vals = _by_year(conn, src, pat)
        data[field] = vals
        all_years.update(vals.keys())
    return {yr: {f: vals.get(yr) for f, vals in data.items()} for yr in sorted(all_years)}


# ══════════════════════════════════════════════════════
#  API 端点
# ══════════════════════════════════════════════════════
@app.on_event("startup")
def on_startup():
    init_db()


@app.get("/api/health")
def health():
    with get_db() as c:
        cnt = c.execute("SELECT COUNT(*) c FROM stats_wide").fetchone()["c"]
    return {"status": "ok", "db": str(DB_PATH), "records": cnt}


# ── 核心宏观数据 R (匹配 data.js 中的 R 对象) ────────
@app.get("/api/R")
def get_R():
    S_TR = "按经营单位所在地分货物进出口总额"
    S_GDP = "地区生产总值"
    S_GDPI = "地区生产总值指数"
    S_REV = "地方财政收入"
    S_EXP = "地方财政支出"
    S_INC = "居民人均可支配收入"
    S_EMP = "按行业分城镇单位就业人员"
    S_WAG = "按行业分城镇单位就业人员工资总额"

    with get_db() as c:
        trade = _make_year_dict(c, S_TR, {
            "totalK": "经营单位所在地进出口总额(千美元)",
            "exportK": "经营单位所在地出口总额(千美元)",
            "importK": "经营单位所在地进口总额(千美元)",
        })
        gdp = _make_year_dict_multi(c, [
            (S_GDP, "total", "地区生产总值(亿元)"),
            (S_GDP, "industry", "%工业增加值%"),
            (S_GDP, "perCapita", "%人均地区生产总值%"),
            (S_GDPI, "idx", "地区生产总值指数(上年=100)"),
        ])
        fiscal = _make_year_dict_multi(c, [
            (S_REV, "revenue", "地方财政一般预算收入(亿元)"),
            (S_REV, "tax", "%税收收入%"),
            (S_EXP, "expenditure", "地方财政一般预算支出(亿元)"),
        ])
        income = _make_year_dict(c, S_INC, {
            "all": "%全体%", "urban": "%城镇%", "rural": "%农村%",
        })
        employ = _make_year_dict(c, S_EMP, {
            "total": "城镇单位就业人员(万人)",
            "mining": "采矿业城镇单位就业人员(万人)",
            "mfg": "制造业城镇单位就业人员(万人)",
            "power": "电力、热力、燃气及水生产和供应业城镇单位就业人员(万人)",
        })
        wages = _make_year_dict(c, S_WAG, {
            "total": "城镇单位就业人员工资总额(亿元)",
            "mining": "采矿业城镇单位就业人员工资总额(亿元)",
            "mfg": "制造业城镇单位就业人员工资总额(亿元)",
            "power": "电力、燃气及水的生产和供应业城镇单位就业人员工资总额(亿元)",
        })
        fiscal_detail = _make_year_dict(c, S_EXP, {
            "sciTech": "地方财政科学技术支出(亿元)",
            "transport": "地方财政交通运输支出(亿元)",
            "enviro": "地方财政环境保护支出(亿元)",
        })

    return {
        "trade": trade, "gdp": gdp, "fiscal": fiscal,
        "income": income, "employ": employ, "wages": wages,
        "fiscalDetail": fiscal_detail,
    }


# ── GDP 详细数据 (匹配 gdpData) ──────────────────────
@app.get("/api/gdp-data")
def get_gdp_data():
    S = "地区生产总值"
    with get_db() as c:
        return {
            "total": _by_year(c, S, "地区生产总值(亿元)"),
            "ind1":  _by_year(c, S, "%第一产业%"),
            "ind2":  _by_year(c, S, "%第二产业%"),
            "ind3":  _by_year(c, S, "%第三产业%"),
            "index": _by_year(c, "地区生产总值指数", "%地区生产总值指数%"),
            "perCap": _by_year(c, S, "%人均%"),
        }


# ── 出口 / 进口商品结构 ──────────────────────────────
@app.get("/api/export-structure")
def get_export_structure():
    with get_db() as c:
        rows = c.execute("SELECT * FROM export_structure ORDER BY year").fetchall()
    result = {}
    for r in rows:
        result[r["year"]] = {
            "mineral": r["mineral"], "equip": r["equip"],
            "chem": r["chem"], "rare": r["rare"],
            "agri": r["agri"], "other": r["other_val"],
        }
    return result


@app.get("/api/import-structure")
def get_import_structure():
    with get_db() as c:
        rows = c.execute("SELECT * FROM import_structure ORDER BY year").fetchall()
    result = {}
    for r in rows:
        result[r["year"]] = {
            "resource": r["resource"], "equip": r["equip"],
            "hiMfg": r["hi_mfg"], "chem": r["chem"],
            "agri": r["agri"], "other": r["other_val"],
        }
    return result


# ── 国别贸易目的地 ────────────────────────────────────
@app.get("/api/trade-dests")
def get_trade_dests():
    with get_db() as c:
        rows = c.execute(
            "SELECT country, export_goods, import_goods, year, export_val, import_val "
            "FROM trade_by_country ORDER BY country, year"
        ).fetchall()
    countries = {}
    for r in rows:
        ct = r["country"]
        if ct not in countries:
            countries[ct] = {
                "cn": ct, "goods": r["export_goods"],
                "impG": r["import_goods"], "exp": {}, "imp": {},
            }
        countries[ct]["exp"][r["year"]] = r["export_val"]
        countries[ct]["imp"][r["year"]] = r["import_val"]
    return list(countries.values())


# ── 煤炭输送 ─────────────────────────────────────────
@app.get("/api/coal-dests")
def get_coal_dests():
    with get_db() as c:
        rows = c.execute(
            "SELECT city, route, year, amount FROM coal_transport ORDER BY city, year"
        ).fetchall()
    cities = {}
    for r in rows:
        n = r["city"]
        if n not in cities:
            cities[n] = {"name": n, "route": r["route"], "coal": {}}
        cities[n]["coal"][r["year"]] = r["amount"]
    return list(cities.values())


# ── 绿电输送 ─────────────────────────────────────────
@app.get("/api/green-dests")
def get_green_dests():
    with get_db() as c:
        rows = c.execute(
            "SELECT city, route, year, amount FROM green_power_transport ORDER BY city, year"
        ).fetchall()
    cities = {}
    for r in rows:
        n = r["city"]
        if n not in cities:
            cities[n] = {"name": n, "route": r["route"], "power": {}}
        cities[n]["power"][r["year"]] = r["amount"]
    return list(cities.values())


# ── 人口数据 ──────────────────────────────────────────
@app.get("/api/population")
def get_population():
    with get_db() as c:
        rows = c.execute("SELECT * FROM population_gdp ORDER BY year").fetchall()
    return {
        r["year"]: {
            "pop": r["pop"], "birth": r["birth_rate"],
            "death": r["death_rate"], "natural": r["natural_growth"],
        }
        for r in rows
    }


# ── 居民消费 ──────────────────────────────────────────
@app.get("/api/consumption")
def get_consumption():
    with get_db() as c:
        return _make_year_dict(c, "居民人均消费支出", {
            "urban": "%城镇%", "rural": "%农村%",
        })


# ── CPI ───────────────────────────────────────────────
@app.get("/api/cpi")
def get_cpi():
    with get_db() as c:
        return _by_year(c, "居民消费价格指数和商品零售价格指数", "%居民消费价格指数%")


# ── 资源税 ────────────────────────────────────────────
@app.get("/api/res-tax")
def get_res_tax():
    with get_db() as c:
        return _by_year(c, "地方财政收入", "%资源税%")


# ── 传统产业天花板 (2016-2024 时间序列) ──────────────
@app.get("/api/old-engine")
def get_old_engine():
    with get_db() as c:
        all_data = _series(c, "传统产业天花板数据")
    if not all_data:
        return {}
    years = sorted({yr for vals in all_data.values() for yr in vals})
    result = {"years": years}
    for ind, yv in all_data.items():
        result[ind] = [yv.get(y) for y in years]
    return result


# ── 高新产业崛起 (2016-2024 时间序列) ────────────────
@app.get("/api/new-engine")
def get_new_engine():
    with get_db() as c:
        all_data = _series(c, "高新产业崛起数据")
    if not all_data:
        return {}
    years = sorted({yr for vals in all_data.values() for yr in vals})
    result = {"years": years}
    for ind, yv in all_data.items():
        result[ind] = [yv.get(y) for y in years]
    return result


# ── 漏斗效应 (2016-2024 时间序列) ────────────────────
@app.get("/api/funnel")
def get_funnel():
    with get_db() as c:
        all_data = _series(c, "漏斗效应数据")
    if not all_data:
        return {}
    years = sorted({yr for vals in all_data.values() for yr in vals})
    result = {"years": years}
    for ind, yv in all_data.items():
        result[ind] = [yv.get(y) for y in years]
    return result


# ── 产业统计 indStats ─────────────────────────────────
@app.get("/api/ind-stats")
def get_ind_stats():
    with get_db() as c:
        return {
            "ind2": _by_year(c, "地区生产总值", "%第二产业%"),
            "indVal": _by_year(c, "地区生产总值", "%工业%"),
            "sciTech": _by_year(c, "地方财政支出", "%科学技术%"),
            "infoRes": _by_year(c, "高新产业崛起数据", "%信息%"),
        }


# ── 就业 & 工资明细 (全部行业) ────────────────────────
@app.get("/api/employment-detail")
def get_employment_detail():
    with get_db() as c:
        return _series(c, "按行业分城镇单位就业人员")


@app.get("/api/wages-detail")
def get_wages_detail():
    with get_db() as c:
        return _series(c, "按行业分城镇单位就业人员工资总额")


# ── 能源投资 ──────────────────────────────────────────
@app.get("/api/energy-investment")
def get_energy_investment():
    with get_db() as c:
        return {
            "national_energy": _series(c, "按行业分国有经济能源工业固定资产投资"),
            "supply_by_industry": _series(c, "能源供应分行业投资"),
        }


# ── 个体就业 ──────────────────────────────────────────
@app.get("/api/individual-employment")
def get_individual_employment():
    with get_db() as c:
        return _series(c, "个体就业人员")


# ── 通用原始数据查询 (按 source) ──────────────────────
@app.get("/api/raw/{source}")
def get_raw_source(source: str):
    with get_db() as c:
        return _series(c, source)


# ── 所有数据源列表 ────────────────────────────────────
@app.get("/api/sources")
def get_sources():
    with get_db() as c:
        rows = c.execute(
            "SELECT source, COUNT(*) cnt, MIN(year) yr_min, MAX(year) yr_max "
            "FROM stats_wide GROUP BY source ORDER BY source"
        ).fetchall()
    return [
        {"source": r["source"], "count": r["cnt"],
         "yearRange": [r["yr_min"], r["yr_max"]]}
        for r in rows
    ]


# ── 指标列表 (调试用) ─────────────────────────────────
@app.get("/api/indicators/{source}")
def get_indicators(source: str):
    with get_db() as c:
        rows = c.execute(
            "SELECT DISTINCT indicator FROM stats_wide WHERE source=? ORDER BY indicator",
            (source,),
        ).fetchall()
    return [r["indicator"] for r in rows]


# ── 前端静态文件 (放在所有 API 路由之后) ──────────────
FRONTEND_DIR = BASE_DIR / "frontend"
if FRONTEND_DIR.exists():
    app.mount("/", StaticFiles(directory=str(FRONTEND_DIR), html=True), name="static")
if __name__ == "__main__":
    import uvicorn
    # 0.0.0.0 代表允许外网访问，8000 是端口号
    uvicorn.run(app, host="0.0.0.0", port=8000)