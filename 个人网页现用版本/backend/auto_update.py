# -*- coding: utf-8 -*-
"""
auto_update.py — 自动定时从官方网站抓取内蒙古经济数据并更新 CSV/DB
===========================================================================
数据源:
  1. 内蒙古统计局 — 年度统计公报 (tj.nmg.gov.cn)
  2. 内蒙古统计局 — 经济运行数据发布 (tj.nmg.gov.cn)
  3. 内蒙古财政厅 — 财政收支数据 (czt.nmg.gov.cn)

运行方式:
  • 手动:  python auto_update.py
  • 定时:  python auto_update.py --install   (安装 Windows 计划任务，每年4/15自动运行)
  • 卸载:  python auto_update.py --uninstall (删除计划任务)
  • 测试:  python auto_update.py --dry-run   (只抓取，不写入)

依赖: pip install requests beautifulsoup4 lxml
"""

import argparse
import csv
import json
import logging
import os
import re
import subprocess
import sys
import time
from collections import OrderedDict
from datetime import datetime
from pathlib import Path
from typing import Optional
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup

# ── 路径 ──
SCRIPT_DIR = Path(__file__).resolve().parent
BASE_DIR = SCRIPT_DIR.parent
CSV_PATH = BASE_DIR / "内蒙古经济数据总表.csv"
LOG_PATH = SCRIPT_DIR / "auto_update.log"
CACHE_DIR = SCRIPT_DIR / ".update_cache"

# ── 日志 ──
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.FileHandler(str(LOG_PATH), encoding="utf-8"),
        logging.StreamHandler(sys.stdout),
    ],
)
log = logging.getLogger("auto_update")

# ── HTTP 配置 ──
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
}
SESSION = requests.Session()
SESSION.headers.update(HEADERS)
REQUEST_TIMEOUT = 30
RETRY_COUNT = 3
RETRY_DELAY = 5  # 秒


# ══════════════════════════════════════════════════════
#  工具函数
# ══════════════════════════════════════════════════════

def safe_get(url: str) -> Optional[requests.Response]:
    """带重试的 GET 请求"""
    for attempt in range(1, RETRY_COUNT + 1):
        try:
            log.info(f"  GET {url} (attempt {attempt})")
            resp = SESSION.get(url, timeout=REQUEST_TIMEOUT)
            resp.raise_for_status()
            return resp
        except requests.RequestException as e:
            log.warning(f"  请求失败: {e}")
            if attempt < RETRY_COUNT:
                time.sleep(RETRY_DELAY)
    return None


def parse_html(resp: requests.Response) -> Optional[BeautifulSoup]:
    """解析 HTML 响应"""
    if resp is None:
        return None
    resp.encoding = resp.apparent_encoding or "utf-8"
    return BeautifulSoup(resp.text, "lxml")


def extract_number(text: str) -> Optional[float]:
    """从文本中提取数值，支持中文数字描述"""
    if not text:
        return None
    text = str(text).strip().replace(",", "").replace("，", "")
    # 直接数值
    m = re.search(r"-?\d+\.?\d*", text)
    if m:
        return float(m.group())
    return None


def load_existing_csv() -> OrderedDict:
    """读取现有 CSV 为 {指标名: {year: value}}"""
    data = OrderedDict()
    if not CSV_PATH.exists():
        return data
    with open(str(CSV_PATH), "r", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            name = row.get("指标名称", "").strip()
            if not name:
                continue
            vals = {}
            for col, v in row.items():
                if col == "指标名称":
                    continue
                try:
                    yr = int(col)
                except ValueError:
                    continue
                v = v.strip()
                if v:
                    try:
                        vals[yr] = float(v)
                    except ValueError:
                        pass
            data[name] = vals
    return data


def get_year_columns(data: OrderedDict) -> list:
    """获取所有年份列"""
    all_years = set()
    for vals in data.values():
        all_years.update(vals.keys())
    if not all_years:
        return list(range(2011, datetime.now().year + 1))
    return sorted(all_years)


def save_csv(data: OrderedDict, years: list):
    """将数据写回 CSV"""
    # 先备份
    if CSV_PATH.exists():
        backup = CSV_PATH.with_suffix(f".bak_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv")
        import shutil
        shutil.copy2(str(CSV_PATH), str(backup))
        log.info(f"已备份: {backup.name}")

    with open(str(CSV_PATH), "w", encoding="utf-8-sig", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["指标名称"] + [str(y) for y in years])

        for name in sorted(data.keys()):
            vals = data[name]
            row = [name]
            for y in years:
                v = vals.get(y)
                if v is not None:
                    if v == int(v) and abs(v) < 1e15:
                        row.append(int(v))
                    else:
                        row.append(v)
                else:
                    row.append("")
            writer.writerow(row)

    log.info(f"CSV 已更新: {CSV_PATH}")


def reimport_db():
    """重新导入数据库"""
    reimport_script = SCRIPT_DIR / "reimport.py"
    if reimport_script.exists():
        log.info("重新导入数据库 ...")
        subprocess.run([sys.executable, str(reimport_script)], cwd=str(SCRIPT_DIR))
        log.info("数据库导入完成")
    else:
        log.warning("reimport.py 不存在，跳过数据库更新")


# ══════════════════════════════════════════════════════
#  数据源 1: 内蒙古统计局 — 年度统计公报
# ══════════════════════════════════════════════════════

# 统计公报页面列表URL
TJGB_LIST_URL = "https://tj.nmg.gov.cn/tjyw/tjgb/"


def find_latest_annual_bulletin() -> Optional[str]:
    """从统计公报列表页找到最新的'国民经济和社会发展统计公报'链接"""
    resp = safe_get(TJGB_LIST_URL)
    soup = parse_html(resp)
    if soup is None:
        log.error("无法获取统计公报列表页")
        return None

    # 查找包含"国民经济和社会发展统计公报"的链接
    for a in soup.find_all("a", href=True):
        text = a.get_text(strip=True)
        if "国民经济和社会发展统计公报" in text and "内蒙古" in text:
            href = a["href"]
            if not href.startswith("http"):
                href = urljoin(TJGB_LIST_URL, href)
            log.info(f"找到统计公报: {text} -> {href}")
            return href

    log.warning("未找到最新统计公报链接")
    return None


def parse_annual_bulletin(url: str) -> dict:
    """解析年度统计公报，提取关键经济数据
    返回 {指标名: {year: value}}
    """
    results = {}
    resp = safe_get(url)
    soup = parse_html(resp)
    if soup is None:
        log.error(f"无法获取统计公报: {url}")
        return results

    text = soup.get_text()

    # 确定公报是哪一年的数据
    # 尝试多种格式："2024年国民经济..."、"2025年全区主要指标..."、附表中的"20XX年"
    year_match = re.search(r"(\d{4})年.*?(?:国民经济和社会发展统计公报|全区经济|全区主要指标)", text)
    if not year_match:
        # 再尝试从附表找
        year_match = re.search(r"(\d{4})年全区主要指标", text)
    if not year_match:
        # 最后从标题/URL找
        title = soup.title.get_text() if soup.title else ""
        year_match = re.search(r"(\d{4})年", title)
    if not year_match:
        log.warning("无法确定公报年份")
        return results
    year = int(year_match.group(1))
    log.info(f"解析 {year} 年统计公报")

    # ── 提取关键数据 ──

    # GDP
    m = re.search(r"全年地区生产总值.*?(\d[\d.]+)\s*亿元", text)
    if m:
        results.setdefault("地区生产总值—地区生产总值(亿元)", {})[year] = float(m.group(1))

    # GDP 增速
    m = re.search(r"地区生产总值.*?比上年增长\s*(\d+\.?\d*)\s*%", text)
    if m:
        results.setdefault("地区生产总值指数—地区生产总值指数(上年=100)", {})[year] = 100 + float(m.group(1))

    # 第一产业
    m = re.search(r"第一产业增加值\s*(\d[\d.]+)\s*亿元", text)
    if m:
        results.setdefault("地区生产总值—第一产业(亿元)", {})[year] = float(m.group(1))

    # 第二产业
    m = re.search(r"第二产业增加值\s*(\d[\d.]+)\s*亿元", text)
    if m:
        results.setdefault("地区生产总值—第二产业(亿元)", {})[year] = float(m.group(1))

    # 第三产业
    m = re.search(r"第三产业增加值\s*(\d[\d.]+)\s*亿元", text)
    if m:
        results.setdefault("地区生产总值—第三产业(亿元)", {})[year] = float(m.group(1))

    # 人均GDP
    m = re.search(r"人均地区生产总值\s*(\d[\d.]+)\s*元", text)
    if m:
        results.setdefault("地区生产总值—人均地区生产总值(元/人)", {})[year] = float(m.group(1))

    # 人口
    m = re.search(r"年末常住人口.*?(\d{3,4})\s*万人", text)
    if m:
        results.setdefault("人口—常住人口(万人)", {})[year] = float(m.group(1))

    # 出生率
    m = re.search(r"出生率为?\s*(\d+\.?\d*)\s*‰", text)
    if m:
        results.setdefault("人口—出生率(‰)", {})[year] = float(m.group(1))

    # 死亡率
    m = re.search(r"死亡率为?\s*(\d+\.?\d*)\s*‰", text)
    if m:
        results.setdefault("人口—死亡率(‰)", {})[year] = float(m.group(1))

    # 财政收入
    m = re.search(r"一般公共预算收入\s*(\d[\d.]+)\s*亿元", text)
    if m:
        results.setdefault("地方财政收入—一般公共预算收入(亿元)", {})[year] = float(m.group(1))
        results.setdefault("地方财政收入—地方财政一般预算收入(亿元)", {})[year] = float(m.group(1))

    # 税收收入
    m = re.search(r"税收收入\s*(\d[\d.]+)\s*亿元", text)
    if m:
        results.setdefault("地方财政收入—税收收入(亿元)", {})[year] = float(m.group(1))
        results.setdefault("地方财政收入—地方财政税收收入(亿元)", {})[year] = float(m.group(1))

    # 财政支出
    m = re.search(r"一般公共预算支出\s*(\d[\d.]+)\s*亿元", text)
    if m:
        results.setdefault("地方财政支出—一般公共预算支出(亿元)", {})[year] = float(m.group(1))
        results.setdefault("地方财政支出—地方财政一般预算支出(亿元)", {})[year] = float(m.group(1))

    # 进出口 (人民币)
    m = re.search(r"外贸进出口总额\s*(\d[\d.]+)\s*亿元", text)
    if m:
        results.setdefault("按经营单位所在地分货物进出口总额—进出口总额(亿元_人民币)", {})[year] = float(m.group(1))
    m = re.search(r"出口\s*(\d[\d.]+)\s*亿元", text[:text.find("进口")+200] if "进口" in text else text)
    if m:
        results.setdefault("按经营单位所在地分货物进出口总额—出口额(亿元_人民币)", {})[year] = float(m.group(1))
    m = re.search(r"进口\s*(\d[\d.]+)\s*亿元", text)
    if m:
        results.setdefault("按经营单位所在地分货物进出口总额—进口额(亿元_人民币)", {})[year] = float(m.group(1))

    # 居民收入
    m = re.search(r"全体居民人均可支配收入\s*(\d[\d.]+)\s*元", text)
    if m:
        results.setdefault("居民人均可支配收入—全体居民人均可支配收入(元)", {})[year] = float(m.group(1))

    m = re.search(r"城镇居民人均可支配收入\s*(\d[\d.]+)\s*元", text)
    if m:
        results.setdefault("居民人均可支配收入—城镇居民人均可支配收入(元)", {})[year] = float(m.group(1))

    m = re.search(r"农村牧区.*?人均可支配收入\s*(\d[\d.]+)\s*元", text)
    if m:
        results.setdefault("居民人均可支配收入—农村牧区常住居民人均可支配收入(元)", {})[year] = float(m.group(1))
        results.setdefault("居民人均可支配收入—农村居民人均可支配收入(元)", {})[year] = float(m.group(1))

    # 居民消费支出
    m = re.search(r"全体居民人均生活消费支出\s*(\d[\d.]+)\s*元", text)
    if m:
        results.setdefault("居民人均消费支出—全体居民人均消费支出(元)", {})[year] = float(m.group(1))

    m = re.search(r"城镇居民人均生活消费支出\s*(\d[\d.]+)\s*元", text)
    if m:
        results.setdefault("居民人均消费支出—城镇常住居民人均消费支出(元)", {})[year] = float(m.group(1))

    m = re.search(r"农村牧区居民人均生活消费支出\s*(\d[\d.]+)\s*元", text)
    if m:
        results.setdefault("居民人均消费支出—农村牧区常住居民人均消费支出(元)", {})[year] = float(m.group(1))
        results.setdefault("居民人均消费支出—农村居民人均消费支出(元)", {})[year] = float(m.group(1))

    # CPI — 支持"居民消费价格（CPI）比上年下降0.1%"等格式
    m = re.search(r"居民消费价格[^。]*?比上年(上涨|下降)\s*(\d+\.?\d*)\s*%", text)
    if m:
        direction = m.group(1)
        val = float(m.group(2))
        if direction == "下降":
            val = -val
        cpi = 100 + val
        results.setdefault("居民消费价格指数和商品零售价格指数—居民消费价格总指数(上年=100)", {})[year] = cpi
        results.setdefault("居民消费价格指数和商品零售价格指数—居民消费价格指数(上年=100)", {})[year] = cpi

    # PPI — 支持"工业生产者出厂价格（PPI）...下降7.0%"等格式
    m = re.search(r"工业生产者出厂价格[^。]*?比上年(上涨|下降)\s*(\d+\.?\d*)\s*%", text)
    if m:
        direction = m.group(1)
        val = float(m.group(2))
        if direction == "下降":
            val = -val
        results.setdefault("居民消费价格指数和商品零售价格指数—工业生产者出厂价格指数(上年=100)", {})[year] = 100 + val

    # 社会消费品零售总额
    m = re.search(r"社会消费品零售总额\s*(\d[\d.]+)\s*亿元", text)
    if m:
        results.setdefault("地区生产总值—社会消费品零售总额(亿元)", {})[year] = float(m.group(1))

    # 房地产开发投资
    m = re.search(r"房地产开发投资\s*(\d[\d.]+)\s*亿元", text)
    if m:
        results.setdefault("地区生产总值—房地产开发投资(亿元)", {})[year] = float(m.group(1))

    # ── 分行业增加值 (仅统计公报中有) ──
    m = re.search(r"批发和零售业增加值\s*(\d[\d.]+)\s*亿元", text)
    if m:
        results.setdefault("地区生产总值—批发和零售业增加值(亿元)", {})[year] = float(m.group(1))

    m = re.search(r"交通运输、仓储和邮政业增加值\s*(\d[\d.]+)\s*亿元", text)
    if m:
        results.setdefault("地区生产总值—交通运输、仓储和邮政业增加值(亿元)", {})[year] = float(m.group(1))

    m = re.search(r"住宿和餐饮业增加值\s*(\d[\d.]+)\s*亿元", text)
    if m:
        results.setdefault("地区生产总值—住宿和餐饮业增加值(亿元)", {})[year] = float(m.group(1))

    m = re.search(r"金融业增加值\s*(\d[\d.]+)\s*亿元", text)
    if m:
        results.setdefault("地区生产总值—金融业增加值(亿元)", {})[year] = float(m.group(1))

    m = re.search(r"房地产业增加值\s*(\d[\d.]+)\s*亿元", text)
    if m:
        results.setdefault("地区生产总值—房地产业增加值(亿元)", {})[year] = float(m.group(1))

    # 农林牧渔业增加值（第一产业）
    m = re.search(r"第一产业增加值\s*(\d[\d.]+)\s*亿元", text)
    if m:
        results.setdefault("地区生产总值—农林牧渔业增加值(亿元)", {})[year] = float(m.group(1))

    # 自然增长率 = 出生率 - 死亡率
    birth = results.get("人口—出生率(‰)", {}).get(year)
    death = results.get("人口—死亡率(‰)", {}).get(year)
    if birth is not None and death is not None:
        natural = round(birth - death, 2)
        results.setdefault("人口—自然增长率(‰)", {})[year] = natural
        results.setdefault("漏斗效应数据—人口自然增长率(‰)", {})[year] = natural

    # 高技术制造业增加值增速
    # 公报格式1: "高技术制造业增加值增长29.4%"
    # 公报格式2: "战略性新兴产业、高技术制造业...分别增长9.4%、17.5%..."（第2个数字）
    m = re.search(r"高技术制造业[^。]*?增加值[^。]*?(?:增长|下降)\s*(\d+\.?\d*)\s*%", text)
    if m:
        # 检查是否是"分别增长"的模式 — 需要找到正确的数字
        context_start = max(0, m.start() - 100)
        context = text[context_start:m.end() + 50]
        # 如果存在"分别"模式，需要数高技术制造业是列表中第几个
        sep_match = re.search(r"([\u4e00-\u9fff、]+)分别(增长|下降)([\d.%、和]+)", context)
        if sep_match:
            items_str = sep_match.group(1)
            direction = sep_match.group(2)
            vals_str = sep_match.group(3)
            items = [x.strip() for x in items_str.replace("、", ",").split(",") if x.strip()]
            vals = re.findall(r"(\d+\.?\d*)", vals_str)
            # 找高技术制造业的位置
            idx = -1
            for i, item in enumerate(items):
                if "高技术制造业" in item:
                    idx = i
                    break
            if idx >= 0 and idx < len(vals):
                val = float(vals[idx])
                if direction == "下降":
                    val = -val
                results.setdefault("高新产业崛起数据—高技术制造业增加值增速(%)", {})[year] = val
            # else: couldn't parse, skip
        else:
            snippet = text[max(0, m.start()-20):m.end()]
            val = float(m.group(1))
            if "下降" in snippet:
                val = -val
            results.setdefault("高新产业崛起数据—高技术制造业增加值增速(%)", {})[year] = val

    # 漏斗效应数据 — 与其他指标联动
    gdp = results.get("地区生产总值—地区生产总值(亿元)", {}).get(year)
    if gdp:
        results.setdefault("漏斗效应数据—GDP总量(亿元)", {})[year] = gdp
    pop = results.get("人口—常住人口(万人)", {}).get(year)
    if pop:
        results.setdefault("漏斗效应数据—人口(万人)", {})[year] = pop

    # 人口表中的重复指标（用于可视化的人口对比板块）
    coal = results.get("传统产业天花板数据—煤炭产量(亿吨)", {}).get(year)
    # 先不设置，等煤炭数据提取后在末尾统一处理

    # 发电装机
    m = re.search(r"风电装机容量\s*(\d[\d.]+)\s*万千瓦", text)
    if m:
        results.setdefault("高新产业崛起数据—风电装机(万千瓦)", {})[year] = float(m.group(1))

    m = re.search(r"太阳能发电装机容量\s*(\d[\d.]+)\s*万千瓦", text)
    if m:
        results.setdefault("高新产业崛起数据—光伏装机(万千瓦)", {})[year] = float(m.group(1))

    # 原煤产量 — 限制搜索范围，避免跨段匹配到无关数字
    m = re.search(r"原煤产量[^。]*?(\d[\d.]+)\s*万吨", text)
    if m:
        val = float(m.group(1))
        results.setdefault("传统产业天花板数据—煤炭产量(亿吨)", {})[year] = round(val / 10000, 4)

    # 发电量 (总发电量，不同于绿电输送)
    m = re.search(r"发电量\s*(\d[\d.]+)\s*亿千瓦时", text)
    if m:
        results.setdefault("地区生产总值—发电量(亿千瓦时)", {})[year] = float(m.group(1))

    # 牛奶产量
    m = re.search(r"牛奶产量\s*(\d[\d.]+)\s*万吨", text)
    if m:
        results.setdefault("地区生产总值—牛奶产量(万吨)", {})[year] = float(m.group(1))

    # ── 解析附表 ──
    tables = soup.find_all("table")
    for table in tables:
        _parse_bulletin_table(table, year, results)

    # ── 派生指标（在所有提取完成后计算）──
    # 新能源装机 = 风电 + 光伏
    wind = results.get("高新产业崛起数据—风电装机(万千瓦)", {}).get(year)
    solar = results.get("高新产业崛起数据—光伏装机(万千瓦)", {}).get(year)
    if wind is not None and solar is not None:
        total_re = round(wind + solar, 1)
        results.setdefault("高新产业崛起数据—新能源装机(万千瓦)", {})[year] = total_re
        results.setdefault("人口—新能源装机(万千瓦)", {})[year] = total_re

    # 人口对比板块的煤炭产量
    coal_val = results.get("传统产业天花板数据—煤炭产量(亿吨)", {}).get(year)
    if coal_val is not None:
        results.setdefault("人口—煤炭产量(亿吨)", {})[year] = coal_val

    log.info(f"  从公报中提取了 {sum(len(v) for v in results.values())} 个数据点 ({len(results)} 个指标)")
    return results


def _parse_bulletin_table(table, year: int, results: dict):
    """解析统计公报中的附表"""
    rows = table.find_all("tr")
    for row in rows:
        cells = row.find_all(["td", "th"])
        if len(cells) < 2:
            continue
        name = cells[0].get_text(strip=True)
        if not name:
            continue
        # 尝试解析绝对量列
        val_text = cells[1].get_text(strip=True) if len(cells) > 1 else ""
        val = extract_number(val_text)
        if val is None:
            continue

        # 根据指标名映射到我们的指标体系
        mapping = _get_table_indicator_mapping(name)
        if mapping:
            if mapping == "__原煤_万吨__":
                # 原煤产量单位转换: 万吨 → 亿吨
                results.setdefault("传统产业天花板数据—煤炭产量(亿吨)", {})[year] = round(val / 10000, 4)
            else:
                results.setdefault(mapping, {})[year] = val


def _get_table_indicator_mapping(name: str) -> Optional[str]:
    """将公报附表中的指标名映射到 CSV 的指标名"""
    mappings = {
        "地区生产总值（亿元）": "地区生产总值—地区生产总值(亿元)",
        "地区生产总值(亿元)": "地区生产总值—地区生产总值(亿元)",
        "第一产业增加值": "地区生产总值—第一产业(亿元)",
        "第二产业增加值": "地区生产总值—第二产业(亿元)",
        "第三产业增加值": "地区生产总值—第三产业(亿元)",
        "全体居民人均可支配收入（元）": "居民人均可支配收入—全体居民人均可支配收入(元)",
        "全体居民人均可支配收入(元)": "居民人均可支配收入—全体居民人均可支配收入(元)",
        "城镇常住居民人均可支配收入": "居民人均可支配收入—城镇居民人均可支配收入(元)",
        "农村牧区常住居民人均可支配收入": "居民人均可支配收入—农村牧区常住居民人均可支配收入(元)",
        "社会消费品零售总额（亿元）": "地区生产总值—社会消费品零售总额(亿元)",
        "社会消费品零售总额(亿元)": "地区生产总值—社会消费品零售总额(亿元)",
        "房地产开发投资（亿元）": "地区生产总值—房地产开发投资(亿元)",
        "房地产开发投资(亿元)": "地区生产总值—房地产开发投资(亿元)",
        "牛奶产量（万吨）": "地区生产总值—牛奶产量(万吨)",
        "牛奶产量(万吨)": "地区生产总值—牛奶产量(万吨)",
        "发电量（亿千瓦时）": "地区生产总值—发电量(亿千瓦时)",
        "发电量(亿千瓦时)": "地区生产总值—发电量(亿千瓦时)",
    }
    result = mappings.get(name)
    if result:
        return result
    # 特殊处理: 原煤（万吨） → 需要转换单位，返回特殊标记
    if name in ("原煤（万吨）", "原煤(万吨)"):
        return "__原煤_万吨__"
    return None


# ══════════════════════════════════════════════════════
#  数据源 2: 内蒙古统计局 — 经济运行年度发布
# ══════════════════════════════════════════════════════

FBYJD_LIST_URL = "https://tj.nmg.gov.cn/tjdt/fbyjd_11654/"


def find_annual_economic_release() -> Optional[str]:
    """从发布与解读页面找到类似'全年全区经济...'的发布"""
    resp = safe_get(FBYJD_LIST_URL)
    soup = parse_html(resp)
    if soup is None:
        return None

    for a in soup.find_all("a", href=True):
        text = a.get_text(strip=True)
        # 匹配 "20XX年全区经济..."
        if re.search(r"\d{4}年全区经济", text):
            href = a["href"]
            if not href.startswith("http"):
                href = urljoin(FBYJD_LIST_URL, href)
            log.info(f"找到年度经济发布: {text} -> {href}")
            return href

    return None


def parse_annual_economic_release(url: str) -> dict:
    """解析年度经济运行发布，与统计公报格式类似但更简洁"""
    # 实际上格式和统计公报类似，复用同一个解析器
    return parse_annual_bulletin(url)


# ══════════════════════════════════════════════════════
#  数据源 3: 内蒙古财政厅 — 年度财政收支
# ══════════════════════════════════════════════════════

CZT_LIST_URL = "https://czt.nmg.gov.cn/zwgk/zfxxgk/fdzdgknr/czsj/"


def find_fiscal_annual_data() -> Optional[str]:
    """从财政厅网站找到最新的年度财政收支完成情况"""
    resp = safe_get(CZT_LIST_URL)
    soup = parse_html(resp)
    if soup is None:
        return None

    for a in soup.find_all("a", href=True):
        text = a.get_text(strip=True)
        # 匹配 "20XX年1-12月全区一般公共预算..."
        if re.search(r"\d{4}年1-12月", text) or re.search(r"\d{4}年全年", text):
            href = a["href"]
            if not href.startswith("http"):
                href = urljoin(CZT_LIST_URL, href)
            log.info(f"找到财政年报: {text} -> {href}")
            return href

    return None


def parse_fiscal_data(url: str) -> dict:
    """解析财政数据页面"""
    results = {}
    resp = safe_get(url)
    soup = parse_html(resp)
    if soup is None:
        return results

    text = soup.get_text()

    # 确定年份
    year_match = re.search(r"(\d{4})年", soup.title.get_text() if soup.title else text)
    if not year_match:
        return results
    year = int(year_match.group(1))

    # 全年数据 — "全区一般公共预算收入XXXX亿元"
    m = re.search(r"一般公共预算收入\s*(\d[\d.]+)\s*亿元", text)
    if m:
        results.setdefault("地方财政收入—一般公共预算收入(亿元)", {})[year] = float(m.group(1))

    m = re.search(r"一般公共预算支出\s*(\d[\d.]+)\s*亿元", text)
    if m:
        results.setdefault("地方财政支出—一般公共预算支出(亿元)", {})[year] = float(m.group(1))

    m = re.search(r"税收\s*(\d[\d.]+)\s*亿元", text)
    if m:
        results.setdefault("地方财政收入—税收收入(亿元)", {})[year] = float(m.group(1))

    m = re.search(r"非税收入\s*(\d[\d.]+)\s*亿元", text)
    if m:
        results.setdefault("地方财政收入—地方财政非税收入(亿元)", {})[year] = float(m.group(1))

    # 同步到统一字段名
    rev = results.get("地方财政收入—一般公共预算收入(亿元)", {}).get(year)
    if rev:
        results.setdefault("地方财政收入—地方财政一般预算收入(亿元)", {})[year] = rev
    tax = results.get("地方财政收入—税收收入(亿元)", {}).get(year)
    if tax:
        results.setdefault("地方财政收入—地方财政税收收入(亿元)", {})[year] = tax
    exp = results.get("地方财政支出—一般公共预算支出(亿元)", {}).get(year)
    if exp:
        results.setdefault("地方财政支出—地方财政一般预算支出(亿元)", {})[year] = exp

    log.info(f"  从财政数据中提取了 {sum(len(v) for v in results.values())} 个数据点")
    return results


# ══════════════════════════════════════════════════════
#  主更新逻辑
# ══════════════════════════════════════════════════════

def merge_data(existing: OrderedDict, new_data: dict, source_name: str) -> int:
    """将爬取到的新数据合并到现有数据中
    返回: 新增/更新的数据点数
    """
    count = 0
    for indicator, year_vals in new_data.items():
        if indicator not in existing:
            existing[indicator] = {}
        for year, value in year_vals.items():
            old_val = existing[indicator].get(year)
            if old_val is None or old_val != value:
                existing[indicator][year] = value
                count += 1
                if old_val is None:
                    log.info(f"  [新增] {indicator} {year} = {value} ({source_name})")
                else:
                    log.info(f"  [更新] {indicator} {year}: {old_val} -> {value} ({source_name})")
    return count


def do_update(dry_run: bool = False):
    """执行一次完整的数据更新"""
    log.info("=" * 60)
    log.info(f"  开始自动更新 — {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    log.info("=" * 60)

    # 加载现有数据
    existing = load_existing_csv()
    log.info(f"现有 CSV: {len(existing)} 个指标")

    total_new = 0

    # ── 数据源 1: 统计公报 ──
    log.info("\n[1/3] 查找最新统计公报 ...")
    bulletin_url = find_latest_annual_bulletin()
    if bulletin_url:
        bulletin_data = parse_annual_bulletin(bulletin_url)
        n = merge_data(existing, bulletin_data, "统计公报")
        total_new += n
        log.info(f"  统计公报: {n} 个新/更新数据点")
    else:
        log.info("  未找到新的统计公报")

    # ── 数据源 2: 经济运行年度发布 ──
    log.info("\n[2/3] 查找年度经济运行发布 ...")
    econ_url = find_annual_economic_release()
    if econ_url:
        econ_data = parse_annual_economic_release(econ_url)
        n = merge_data(existing, econ_data, "经济运行发布")
        total_new += n
        log.info(f"  经济运行发布: {n} 个新/更新数据点")
    else:
        log.info("  未找到年度经济运行发布")

    # ── 数据源 3: 财政数据 ──
    log.info("\n[3/3] 查找年度财政数据 ...")
    fiscal_url = find_fiscal_annual_data()
    if fiscal_url:
        fiscal_data = parse_fiscal_data(fiscal_url)
        n = merge_data(existing, fiscal_data, "财政厅")
        total_new += n
        log.info(f"  财政数据: {n} 个新/更新数据点")
    else:
        log.info("  未找到年度财政数据")

    # ── 保存 ──
    if total_new > 0:
        log.info(f"\n共发现 {total_new} 个新/更新数据点")
        if not dry_run:
            # 确保年份列覆盖到最新
            years = get_year_columns(existing)
            current_year = datetime.now().year
            if current_year - 1 not in years:
                years.append(current_year - 1)
            years = sorted(set(years))

            save_csv(existing, years)
            reimport_db()
            log.info("✅ 更新完成!")
        else:
            log.info("(dry-run 模式，未写入)")
    else:
        log.info("\n没有发现新数据，无需更新")

    log.info("=" * 60)
    return total_new


# ══════════════════════════════════════════════════════
#  Windows 计划任务管理
# ══════════════════════════════════════════════════════

TASK_NAME = "NMG_Economy_Data_AutoUpdate"


def install_scheduled_task():
    """安装 Windows 计划任务 (每年 4月15日 + 2月1日 执行)
    - 4月15日: 上一年统计公报通常在3-4月发布
    - 2月1日:  上一年经济运行数据通常在1月下旬发布
    """
    python_exe = sys.executable
    script_path = str(Path(__file__).resolve())

    # 创建 XML 任务定义以支持多个触发器
    xml_content = f"""<?xml version="1.0" encoding="UTF-16"?>
<Task version="1.2" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <RegistrationInfo>
    <Description>自动从内蒙古统计局等官网抓取经济数据更新CSV</Description>
  </RegistrationInfo>
  <Triggers>
    <CalendarTrigger>
      <StartBoundary>2026-04-15T09:00:00</StartBoundary>
      <Enabled>true</Enabled>
      <ScheduleByMonth>
        <DaysOfMonth><Day>15</Day></DaysOfMonth>
        <Months><April /></Months>
      </ScheduleByMonth>
    </CalendarTrigger>
    <CalendarTrigger>
      <StartBoundary>2026-02-01T09:00:00</StartBoundary>
      <Enabled>true</Enabled>
      <ScheduleByMonth>
        <DaysOfMonth><Day>1</Day></DaysOfMonth>
        <Months><February /></Months>
      </ScheduleByMonth>
    </CalendarTrigger>
  </Triggers>
  <Principals>
    <Principal id="Author">
      <LogonType>InteractiveToken</LogonType>
      <RunLevel>LeastPrivilege</RunLevel>
    </Principal>
  </Principals>
  <Settings>
    <MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy>
    <DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>
    <StopIfGoingOnBatteries>false</StopIfGoingOnBatteries>
    <AllowHardTerminate>true</AllowHardTerminate>
    <StartWhenAvailable>true</StartWhenAvailable>
    <RunOnlyIfNetworkAvailable>true</RunOnlyIfNetworkAvailable>
    <AllowStartOnDemand>true</AllowStartOnDemand>
    <Enabled>true</Enabled>
    <Hidden>false</Hidden>
    <ExecutionTimeLimit>PT1H</ExecutionTimeLimit>
    <Priority>7</Priority>
  </Settings>
  <Actions>
    <Exec>
      <Command>{python_exe}</Command>
      <Arguments>"{script_path}"</Arguments>
      <WorkingDirectory>{str(SCRIPT_DIR)}</WorkingDirectory>
    </Exec>
  </Actions>
</Task>"""

    xml_path = SCRIPT_DIR / f"{TASK_NAME}.xml"
    with open(str(xml_path), "w", encoding="utf-16") as f:
        f.write(xml_content)

    try:
        result = subprocess.run(
            ["schtasks.exe", "/Create", "/TN", TASK_NAME, "/XML", str(xml_path), "/F"],
            capture_output=True, text=True
        )
        if result.returncode == 0:
            log.info(f"✅ 计划任务已安装: {TASK_NAME}")
            log.info("  触发时间: 每年 2月1日 + 4月15日 上午9:00")
            log.info("  如果错过时间(如电脑关机)，下次开机时会自动补跑")
        else:
            log.error(f"安装计划任务失败: {result.stderr}")
    finally:
        xml_path.unlink(missing_ok=True)


def uninstall_scheduled_task():
    """卸载 Windows 计划任务"""
    result = subprocess.run(
        ["schtasks.exe", "/Delete", "/TN", TASK_NAME, "/F"],
        capture_output=True, text=True
    )
    if result.returncode == 0:
        log.info(f"✅ 计划任务已删除: {TASK_NAME}")
    else:
        log.error(f"删除失败: {result.stderr}")


# ══════════════════════════════════════════════════════
#  入口
# ══════════════════════════════════════════════════════

def main():
    parser = argparse.ArgumentParser(description="自动更新内蒙古经济数据")
    parser.add_argument("--install", action="store_true", help="安装 Windows 计划任务 (每年2/1+4/15自动执行)")
    parser.add_argument("--uninstall", action="store_true", help="卸载计划任务")
    parser.add_argument("--dry-run", action="store_true", help="测试模式，只抓取不写入")
    args = parser.parse_args()

    if args.install:
        install_scheduled_task()
    elif args.uninstall:
        uninstall_scheduled_task()
    else:
        do_update(dry_run=args.dry_run)


if __name__ == "__main__":
    main()
