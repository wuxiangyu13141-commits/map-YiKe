# -*- coding: utf-8 -*-
"""
generate_consolidated_csv.py  v3.0
==================================
从原始 CSV 文件直接读取 → 合并到一张宽表 CSV。
⚠️ 重大变更：不再使用插值/外推/AI 估算。
   未覆盖的年份留空（空字符串）。
   仅包含：
     ✅ 国家统计局原始数据（22个CSV文件）
     ✅ Wikipedia 引用的官方年鉴 GDP 数据（2011-2020）
     ✅ Wikipedia / 统计公报引用的人口数据点
"""

import csv
import re
from collections import OrderedDict
from pathlib import Path

# ── 路径 ──
BASE = Path(__file__).resolve().parent.parent
DATA_DIR = BASE / "国家统计局分省年度数据内蒙古自治区经济相关数据2020—2024"
OUT_PATH = BASE / "内蒙古经济数据总表.csv"

YEARS = list(range(2011, 2026))  # 2011 – 2025

# 总容器: { "分类—指标名": { year: value, ... }, ... }
all_data = OrderedDict()


def _add(key, year, value):
    """安全地将一条数据加入 all_data"""
    if key not in all_data:
        all_data[key] = {}
    if value is None or str(value).strip() == "":
        return
    try:
        all_data[key][year] = float(str(value).strip().replace(",", ""))
    except (ValueError, TypeError):
        pass


def _read_csv(filename):
    """读取一个 CSV 文件，返回行列表（list of dict）"""
    fp = DATA_DIR / filename
    if not fp.exists():
        print(f"  ⚠ 文件不存在: {filename}")
        return []
    for enc in ("utf-8-sig", "gb18030", "utf-8"):
        try:
            with open(str(fp), "r", encoding=enc) as f:
                reader = csv.DictReader(f)
                return list(reader)
        except (UnicodeDecodeError, UnicodeError):
            continue
    print(f"  ⚠ 无法解码: {filename}")
    return []


def _parse_year(col_name):
    """从列名中提取年份数字。如 '2024年' → 2024, '2024' → 2024"""
    m = re.search(r"(20\d{2})", str(col_name))
    return int(m.group(1)) if m else None


# ══════════════════════════════════════════════════════
#  A. 转置格式文件读取（行=指标，列=年份）
# ══════════════════════════════════════════════════════

def read_transposed(filename, category, indicator_col="指标"):
    """读取 行=指标、列=年份 的 CSV。列头可带"年"后缀或不带。"""
    rows = _read_csv(filename)
    if not rows:
        return
    for row in rows:
        ind = row.get(indicator_col, "").strip()
        if not ind:
            continue
        key = f"{category}—{ind}"
        for col_name, val in row.items():
            yr = _parse_year(col_name)
            if yr and yr in range(2011, 2026):
                _add(key, yr, val)


# ══════════════════════════════════════════════════════
#  B. 逐文件读取所有 22 个原始 CSV
# ══════════════════════════════════════════════════════
print("═" * 60)
print("  开始从原始 CSV 文件读取数据（v3.0 — 仅官方数据，不插值）")
print("═" * 60)

# ── 1. 转置格式 CSV（指标为行，年份为列）──
transposed_files = [
    ("地区生产总值.csv",                 "地区生产总值"),
    ("地区生产总值指数.csv",             "地区生产总值指数"),
    ("地方财政收入.csv",                 "地方财政收入"),
    ("地方财政支出.csv",                 "地方财政支出"),
    ("居民人均可支配收入.csv",           "居民人均可支配收入"),
    ("居民人均消费支出.csv",             "居民人均消费支出"),
    ("居民消费价格指数和商品零售价格指数.csv", "居民消费价格指数和商品零售价格指数"),
    ("按行业分城镇单位就业人员.csv",     "按行业分城镇单位就业人员"),
    ("按行业分城镇单位就业人员工资总额.csv", "按行业分城镇单位就业人员工资总额"),
    ("按经营单位所在地分货物进出口总额.csv", "按经营单位所在地分货物进出口总额"),
    ("个体就业人员.csv",                 "个体就业人员"),
    ("能源供应分行业投资.csv",           "能源供应分行业投资"),
    ("按行业分国有经济能源工业固定资产投资.csv", "按行业分国有经济能源工业固定资产投资"),
    ("传统产业天花板数据.csv",           "传统产业天花板数据"),
    ("高新产业崛起数据.csv",             "高新产业崛起数据"),
    ("漏斗效应数据.csv",                 "漏斗效应数据"),
]

for fname, cat in transposed_files:
    print(f"  读取[转置]: {fname}")
    read_transposed(fname, cat)

# ── 2. 出口商品结构（行=年份，列=指标）──
print("  读取[常规]: 出口商品结构数据.csv")
exp_rows = _read_csv("出口商品结构数据.csv")
exp_col_map = {
    "出口总额(万美元)":     "出口总额(亿元)",
    "矿产品出口(万美元)":   "矿产品(亿元)",
    "矿产品占比(%)":        "矿产品占比(%)",
    "机电设备出口(万美元)":  "机电产品(亿元)",
    "机电设备占比(%)":       "机电产品占比(%)",
    "化工品出口(万美元)":    "化工产品(亿元)",
    "化工品占比(%)":         "化工产品占比(%)",
    "稀土及制品出口(万美元)":"稀土产品(亿元)",
    "稀土占比(%)":           "稀土产品占比(%)",
    "农畜产品出口(万美元)":  "农畜产品(亿元)",
    "农畜产品占比(%)":       "农畜产品占比(%)",
    "其他出口(万美元)":      "其他产品(亿元)",
    "其他占比(%)":           "其他产品占比(%)",
}
for row in exp_rows:
    yr = _parse_year(row.get("年份", ""))
    if not yr:
        continue
    for csv_col, out_label in exp_col_map.items():
        val = row.get(csv_col, "")
        _add(f"出口商品结构—{out_label}", yr, val)

# ── 3. 进口商品结构（行=年份，列=指标）──
print("  读取[常规]: 进口商品结构数据.csv")
imp_rows = _read_csv("进口商品结构数据.csv")
imp_col_map = {
    "进口总额(万美元)":      "进口总额(亿元)",
    "资源矿产进口(万美元)":  "资源类(亿元)",
    "资源矿产占比(%)":       "资源类占比(%)",
    "机电设备进口(万美元)":   "机电产品(亿元)",
    "机电设备占比(%)":        "机电产品占比(%)",
    "高端制造进口(万美元)":   "高新制造(亿元)",
    "高端制造占比(%)":        "高新制造占比(%)",
    "化工品进口(万美元)":     "化工产品(亿元)",
    "化工品占比(%)":          "化工产品占比(%)",
    "农产品进口(万美元)":     "农畜产品(亿元)",
    "农产品占比(%)":          "农畜产品占比(%)",
    "其他进口(万美元)":       "其他(亿元)",
    "其他占比(%)":            "其他占比(%)",
}
for row in imp_rows:
    yr = _parse_year(row.get("年份", ""))
    if not yr:
        continue
    for csv_col, out_label in imp_col_map.items():
        val = row.get(csv_col, "")
        _add(f"进口商品结构—{out_label}", yr, val)

# ── 4. 对外贸易分国别（行=国家，列=年份×进出口）──
print("  读取[常规]: 对外贸易分国别数据.csv")
trade_rows = _read_csv("对外贸易分国别数据.csv")
for row in trade_rows:
    country = row.get("目的国", "").strip()
    if not country:
        continue
    for col_name, val in row.items():
        if "出口" in col_name and "商品" not in col_name:
            yr = _parse_year(col_name)
            if yr:
                _add(f"对外贸易—{country}出口额(亿元)", yr, val)
        elif "进口" in col_name and "商品" not in col_name:
            yr = _parse_year(col_name)
            if yr:
                _add(f"对外贸易—{country}进口额(亿元)", yr, val)

# ── 5. 煤炭输送分城市（行=城市，列=年份）──
print("  读取[常规]: 煤炭输送分城市数据.csv")
coal_rows = _read_csv("煤炭输送分城市数据.csv")
for row in coal_rows:
    city = row.get("目的城市", "").strip()
    if not city:
        continue
    for col_name, val in row.items():
        yr = _parse_year(col_name)
        if yr:
            _add(f"煤炭输送—{city}输送量(万吨)", yr, val)

# ── 6. 绿电算力输送分城市（行=城市，列=年份）──
print("  读取[常规]: 绿电算力输送分城市数据.csv")
green_rows = _read_csv("绿电算力输送分城市数据.csv")
for row in green_rows:
    city = row.get("目的城市", "").strip()
    if not city:
        continue
    for col_name, val in row.items():
        yr = _parse_year(col_name)
        if yr:
            _add(f"绿电输送—{city}输送量(亿千瓦时)", yr, val)

# ── 7. 人口与GDP对比数据（行=年份，列=指标）──
print("  读取[常规]: 人口与GDP对比数据.csv")
pop_rows = _read_csv("人口与GDP对比数据.csv")
pop_col_map = {
    "常住人口(万人)":         "常住人口(万人)",
    "出生率(‰)":              "出生率(‰)",
    "死亡率(‰)":              "死亡率(‰)",
    "自然增长率(‰)":          "自然增长率(‰)",
    "全国GDP排名":            "GDP全国排名",
    "人均GDP(元)":            "人均GDP(元)",
    "人均GDP全国排名":        "人均GDP全国排名",
    "煤炭产量(亿吨)":        "煤炭产量(亿吨)",
    "新能源装机容量(万千瓦)": "新能源装机(万千瓦)",
    "云计算服务器(万台)":     "算力服务器(万台)",
}
for row in pop_rows:
    yr = _parse_year(row.get("年份", ""))
    if not yr:
        continue
    for csv_col, out_label in pop_col_map.items():
        val = row.get(csv_col, "")
        _add(f"人口—{out_label}", yr, val)


# ══════════════════════════════════════════════════════
#  C. 经过验证的外部官方数据补充
# ══════════════════════════════════════════════════════
print("\n  补充 Wikipedia 引用的官方年鉴数据 …")

# ── GDP 历史数据 (2011-2020) ──
# 来源: https://zh.wikipedia.org/wiki/内蒙古自治区地区生产总值
# 原始来源: 国家统计数据库, 《中国统计年鉴》各期, 《内蒙古统计年鉴》各期
# 注意: 仅补充原始 CSV 中不存在的年份
# 2021-2024 已有国家统计局直接数据，以 NBS CSV 为准

wiki_gdp = {
    2011: (9458.12,  38276),
    2012: (10470.14, 42441),
    2013: (11392.42, 46320),
    2014: (12158.22, 49585),
    2015: (12948.99, 52972),
    2016: (13789.26, 56560),
    2017: (14898.05, 61196),
    2018: (16140.76, 66491),
    2019: (17212.53, 71170),
    2020: (17258.04, 71640),
}

for yr, (gdp, per_cap) in wiki_gdp.items():
    gdp_key = "地区生产总值—地区生产总值(亿元)"
    if gdp_key not in all_data or yr not in all_data.get(gdp_key, {}):
        _add(gdp_key, yr, gdp)
    pcap_key = "地区生产总值—人均地区生产总值(元/人)"
    if pcap_key not in all_data or yr not in all_data.get(pcap_key, {}):
        _add(pcap_key, yr, per_cap)

# ── 人口历史数据点 ──
# 来源: https://zh.wikipedia.org/wiki/内蒙古自治区
#   引用 内蒙古统计年鉴2018 (#87), 第七次人口普查 (#84), 统计公报 (#85)
# 以及百度百科引用统计公报
wiki_pop = {
    2017: 2528.6,   # 内蒙古统计年鉴2018
    2019: 2539.6,   # 百度百科引用统计公报
}

for yr, pop in wiki_pop.items():
    pop_key = "人口—常住人口(万人)"
    if pop_key not in all_data or yr not in all_data.get(pop_key, {}):
        _add(pop_key, yr, pop)


# ══════════════════════════════════════════════════════
#  D. 输出 CSV — 无数据的单元格留空
# ══════════════════════════════════════════════════════
print("\n  写入 CSV …")

with open(str(OUT_PATH), "w", encoding="utf-8-sig", newline="") as f:
    writer = csv.writer(f)
    header = ["指标名称"] + [str(y) for y in YEARS]
    writer.writerow(header)

    for key in sorted(all_data.keys()):
        year_vals = all_data[key]
        row = [key]
        for y in YEARS:
            v = year_vals.get(y)
            if v is not None:
                if v == int(v) and abs(v) < 1e15:
                    row.append(int(v))
                else:
                    row.append(v)
            else:
                row.append("")  # ← 无数据留空！
        writer.writerow(row)

# ── 统计 ──
total_indicators = len(all_data)
total_cells = total_indicators * len(YEARS)
filled_cells = sum(1 for vals in all_data.values() for y in YEARS if y in vals)
empty_cells = total_cells - filled_cells

print(f"\n{'═' * 60}")
print(f"  ✅ CSV 生成完毕: {OUT_PATH}")
print(f"  指标总数: {total_indicators}")
print(f"  年份: {YEARS[0]}-{YEARS[-1]} ({len(YEARS)}列)")
print(f"  总单元格: {total_cells}")
print(f"  有数据单元格: {filled_cells} ({filled_cells/total_cells*100:.1f}%)")
print(f"  空单元格: {empty_cells} ({empty_cells/total_cells*100:.1f}%)")
print(f"  文件大小: {OUT_PATH.stat().st_size / 1024:.1f} KB")
print(f"{'═' * 60}")

print("""
📋 数据来源说明:
  ✅ 国家统计局在线查询 (data.stats.gov.cn) — 22个原始CSV文件
  ✅ Wikipedia引用的《中国统计年鉴》《内蒙古统计年鉴》 — GDP 2011-2020
  ✅ Wikipedia/百度百科引用的统计公报 — 部分人口数据点
  ❌ 未使用任何插值、外推或AI估算
  📭 无官方来源的单元格保持为空
""")
