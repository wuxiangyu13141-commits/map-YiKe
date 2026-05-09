from __future__ import annotations

import json
import math
import re
from collections import Counter, defaultdict
from pathlib import Path

import openpyxl


ROOT = Path(__file__).resolve().parent.parent
WORKBOOK_PATH = ROOT / "谱系树-基本信息表 示例 C-M504 v4.xlsx"
OUTPUT_PATH = ROOT / "data" / "y4569-data.js"
TARGET_BRANCH = "Y4569"
TIMELINE_START_BP = 5_000
TIMELINE_SPLIT_BP = 5_000
TIMELINE_STEP_YEARS = 100

REGION_PRESETS = {
    "中国东北西北部、外兴安岭以南": {
        "name": "中国东北西北部、外兴安岭以南",
        "polygon": [[118.0, 47.2], [122.8, 45.8], [130.8, 46.4], [134.2, 49.8], [133.6, 53.8], [127.0, 56.2], [120.0, 53.4], [117.6, 49.8]],
    },
    "中国东北中部": {
        "name": "中国东北中部",
        "polygon": [[118.8, 40.8], [123.8, 40.2], [128.2, 41.2], [130.4, 44.8], [128.2, 47.2], [122.0, 47.8], [118.2, 44.4]],
    },
    "蒙古国东北部": {
        "name": "蒙古国东北部",
        "polygon": [[105.2, 45.6], [111.4, 44.8], [118.8, 45.2], [123.8, 47.6], [124.0, 51.2], [117.0, 53.2], [108.0, 52.4], [103.8, 49.0]],
    },
    "中国,内蒙古,鄂尔多斯": {
        "name": "中国,内蒙古,鄂尔多斯",
        "polygon": [[106.5, 37.2], [109.0, 36.8], [111.2, 38.0], [111.0, 39.8], [108.0, 40.1], [106.2, 38.8]],
    },
    "哈萨克斯坦东部-新疆西部": {
        "name": "哈萨克斯坦东部-新疆西部",
        "polygon": [[72.0, 40.6], [79.8, 39.6], [87.8, 41.6], [91.2, 45.8], [89.4, 48.4], [81.8, 48.8], [74.0, 46.8], [71.6, 43.0]],
    },
    "河西走廊": {
        "name": "河西走廊",
        "polygon": [[93.0, 36.2], [97.8, 35.8], [104.8, 36.8], [104.6, 39.8], [97.8, 40.6], [92.8, 39.2]],
    },
    "内蒙古东南部": {
        "name": "内蒙古东南部",
        "polygon": [[111.4, 40.5], [116.8, 40.0], [122.8, 41.4], [124.2, 44.8], [122.2, 46.8], [115.6, 46.6], [111.0, 44.2]],
    },
    "新疆西部": {
        "name": "新疆西部",
        "polygon": [[78.6, 40.8], [82.0, 40.0], [85.6, 41.2], [86.2, 45.4], [83.6, 47.2], [79.2, 46.4], [77.8, 43.6]],
    },
    "阿富汗-巴基斯坦": {
        "name": "阿富汗-巴基斯坦",
        "polygon": [[64.6, 29.4], [69.2, 28.8], [74.6, 30.6], [75.4, 34.4], [72.8, 36.8], [67.4, 37.0], [64.2, 33.8]],
    },
}

PALETTE = [
    "#f2c14e",
    "#ef8354",
    "#4f5d75",
    "#2d936c",
    "#c44536",
    "#7d5ba6",
    "#2b59c3",
    "#8f2d56",
]

# 手工指定支系颜色（根据表格）
BRANCH_COLORS = {
    "Y4569": "#92D050",  # 浅绿
    "Y185715": "#70AD47",  # 深绿
    "MF247416": "#4472C4",  # 蓝
    "Y4541": "#44546A",  # 暗蓝
    "Y12782": "#5B9BD5",  # 亮蓝
    "MF317986": "#7030A0",  # 紫
    "FGC16605": "#00B0F0",  # 天蓝
    "FGC29011": "#FF6B35",  # 橙红
    "Y125520": "#C65911",  # 锈红
    "ZQ1049": "#FFC7CE",  # 浅粉
    "MF193836": "#FFC000",  # 金黄
    "Y20798": "#92D050",  # 浅绿
    "BY182928": "#70AD47",  # 深绿
    "Y20087": "#4472C4",  # 蓝
    "ZQ32": "#44546A",  # 暗蓝
}


def canonical_text(value: object) -> str:
    if value is None:
        return ""
    return re.sub(r"\s+", "", str(value))


def parse_coordinate(text: object) -> tuple[float | None, float | None]:
    if text is None:
        return None, None

    cleaned = str(text).replace("，", ",").replace(" ", "")
    matches = re.findall(r"(-?\d+(?:\.\d+)?)°([NSWE])", cleaned, flags=re.IGNORECASE)
    if len(matches) >= 2:
        lat_value = float(matches[0][0])
        lon_value = float(matches[1][0])
        if matches[0][1].upper() == "S":
            lat_value *= -1
        if matches[1][1].upper() == "W":
            lon_value *= -1
        return lat_value, lon_value

    decimal_matches = re.findall(r"-?\d+(?:\.\d+)?", cleaned)
    if len(decimal_matches) >= 2:
        return float(decimal_matches[0]), float(decimal_matches[1])

    return None, None


def normalize_branch_name(haplogroup: str) -> str:
    return haplogroup.strip().replace(" ", "")


def haplogroup_segments(haplogroup: str) -> list[str]:
    parts = [part for part in normalize_branch_name(haplogroup).split("-") if part]
    if TARGET_BRANCH not in parts:
        return []
    index = parts.index(TARGET_BRANCH)
    return parts[index + 1 :]


def choose_region(distributions: list[str]) -> dict | None:
    cleaned = [canonical_text(item) for item in distributions if canonical_text(item)]
    if not cleaned:
        return None

    winner, _ = Counter(cleaned).most_common(1)[0]
    for key, value in REGION_PRESETS.items():
        if canonical_text(key) == winner:
            return {"id": winner, **value}
    return None


def mean_center(points: list[tuple[float, float]]) -> tuple[float, float]:
    if not points:
        return 0.0, 0.0
    lat_sum = sum(point[0] for point in points)
    lon_sum = sum(point[1] for point in points)
    return lat_sum / len(points), lon_sum / len(points)


def max_distance(center: tuple[float, float], points: list[tuple[float, float]]) -> float:
    if not points:
        return 2.0
    center_lat, center_lon = center
    max_span = 0.0
    for lat_value, lon_value in points:
        distance = math.hypot((lat_value - center_lat) * 1.2, lon_value - center_lon)
        max_span = max(max_span, distance)
    return max(2.0, min(max_span, 18.0))


def load_samples() -> list[dict]:
    workbook = openpyxl.load_workbook(WORKBOOK_PATH, data_only=True)
    sheet = workbook["列表1 样本基本信息"]
    samples: list[dict] = []

    for row_index, row in enumerate(sheet.iter_rows(min_row=4, values_only=True), start=4):
        haplogroup = row[4]
        if haplogroup is None or TARGET_BRANCH not in str(haplogroup):
            continue

        sample_id = (row[1] or f"row-{row_index}").strip() if isinstance(row[1], str) else (row[1] or f"row-{row_index}")
        lat_value, lon_value = parse_coordinate(row[10])
        sample_age = int(row[15] or 0)
        branches = haplogroup_segments(str(haplogroup))

        samples.append(
            {
                "id": str(sample_id),
                "sourceRow": row_index,
                "originalId": row[2],
                "macroGroup": row[3],
                "haplogroup": normalize_branch_name(str(haplogroup)),
                "tmrca": int(row[5] or 0),
                "terminalBranch": row[6],
                "surname": row[7],
                "ethnicity": row[8],
                "location": row[9],
                "lat": lat_value,
                "lon": lon_value,
                "family": row[12],
                "tribe": row[13],
                "distribution": row[14],
                "sampleAge": sample_age,
                "isAncient": sample_age > 0,
                "branchSegments": branches,
            }
        )

    return samples


def build_branches(samples: list[dict]) -> list[dict]:
    prefix_to_samples: dict[tuple[str, ...], list[dict]] = defaultdict(list)
    prefix_counts: Counter[tuple[str, ...]] = Counter()
    prefix_first_row: dict[tuple[str, ...], int] = {}

    for sample in samples:
        segments = sample["branchSegments"]
        for depth in range(1, len(segments) + 1):
            prefix = tuple(segments[:depth])
            prefix_to_samples[prefix].append(sample)
            prefix_counts[prefix] += 1
            if prefix not in prefix_first_row:
                prefix_first_row[prefix] = sample["sourceRow"]

    included_prefixes: set[tuple[str, ...]] = set()
    for prefix, count in prefix_counts.items():
        descendant_lengths = {len(item["branchSegments"]) for item in prefix_to_samples[prefix]}
        is_leaf = len(prefix) in descendant_lengths
        if len(prefix) == 1 or count >= 2 or is_leaf:
            included_prefixes.add(prefix)

    branch_items: list[dict] = []
    all_points = [(sample["lat"], sample["lon"]) for sample in samples if sample["lat"] is not None and sample["lon"] is not None]
    root_center = mean_center(all_points)
    root_distribution = choose_region([sample["distribution"] for sample in samples])
    root_age = max(sample["tmrca"] for sample in samples)
    branch_items.append(
        {
            "id": TARGET_BRANCH,
            "label": TARGET_BRANCH,
            "age": root_age,
            "parentId": None,
            "depth": 0,
            "sampleIds": [sample["id"] for sample in samples],
            "center": [round(root_center[0], 4), round(root_center[1], 4)],
            "radius": round(max_distance(root_center, all_points), 3),
            "distribution": root_distribution["name"] if root_distribution else None,
            "regionId": root_distribution["id"] if root_distribution else None,
            "color": BRANCH_COLORS.get(TARGET_BRANCH, PALETTE[0]),
        }
    )

    # 按表格出现顺序排列支系
    ordered_prefixes = sorted(included_prefixes, key=lambda item: (prefix_first_row.get(item, 9999), len(item), item))
    for prefix in ordered_prefixes:
        branch_samples = prefix_to_samples[prefix]
        points = [(sample["lat"], sample["lon"]) for sample in branch_samples if sample["lat"] is not None and sample["lon"] is not None]
        center = mean_center(points) if points else root_center
        region = choose_region([sample["distribution"] for sample in branch_samples])
        parent_id = TARGET_BRANCH
        for depth in range(len(prefix) - 1, 0, -1):
            maybe_parent = prefix[:depth]
            if maybe_parent in included_prefixes:
                parent_id = maybe_parent[-1]
                break

        branch_label = prefix[-1]
        color = BRANCH_COLORS.get(branch_label, PALETTE[len(prefix) % len(PALETTE)])
        branch_items.append(
            {
                "id": branch_label,
                "label": branch_label,
                "age": max(sample["tmrca"] for sample in branch_samples),
                "parentId": parent_id,
                "depth": len(prefix),
                "sampleIds": [sample["id"] for sample in branch_samples],
                "center": [round(center[0], 4), round(center[1], 4)],
                "radius": round(max_distance(center, points), 3),
                "distribution": region["name"] if region else None,
                "regionId": region["id"] if region else None,
                "color": color,
            }
        )

    # 保持表格顺序，不再按年龄二次排序
    return branch_items


def main() -> None:
    samples = load_samples()
    branches = build_branches(samples)
    payload = {
        "meta": {
            "branch": TARGET_BRANCH,
            "timelineStartBP": TIMELINE_START_BP,
            "timelineSplitBP": TIMELINE_SPLIT_BP,
            "timelineStepYears": TIMELINE_STEP_YEARS,
            "focus": {
                "lonMin": 20,
                "lonMax": 150,
                "latMin": 10,
                "latMax": 72,
            },
        },
        "regions": [
            {"id": canonical_text(key), "name": value["name"], "polygon": value["polygon"]}
            for key, value in REGION_PRESETS.items()
        ],
        "samples": samples,
        "branches": branches,
    }

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(
        "window.Y4569_DATA = " + json.dumps(payload, ensure_ascii=False, indent=2) + ";\n",
        encoding="utf-8",
    )
    print(f"Wrote {OUTPUT_PATH}")


if __name__ == "__main__":
    main()