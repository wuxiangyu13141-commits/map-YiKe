const data = window.Y4569_DATA;

if (!data) {
  throw new Error("Y4569 data is not available.");
}

// 谱系树状态
const treeState = {
  expanded: false,
  initialized: false,
};
let echartsTreeInstance = null;

const svg = document.getElementById("mapSvg");
const focusLayer = document.getElementById("focusLayer");
const trailLayer = document.getElementById("trailLayer");
const flowLayer = document.getElementById("flowLayer");
const ancientLayer = document.getElementById("ancientLayer");
const pointLayer = document.getElementById("pointLayer");
const branchLabelLayer = document.getElementById("branchLabelLayer");
const regionOverlayLayer = document.getElementById("regionOverlayLayer");
const mapBaseImage = document.getElementById("mapBaseImage");
const slider = document.getElementById("timelineSlider");
const playButton = document.getElementById("playButton");
const timelinePlayButton = document.getElementById("timelinePlayButton");
const jumpModernButton = document.getElementById("jumpModernButton");
const currentTimeLabel = document.getElementById("currentTimeLabel");
const currentModeLabel = document.getElementById("currentModeLabel");
const tickLabel = document.getElementById("tickLabel");
const branchDrawerTrigger = document.getElementById("branchDrawerTrigger");
const branchDrawer = document.getElementById("branchDrawer");
const branchDrawerList = document.getElementById("branchDrawerList");
const branchLegend = document.getElementById("branchLegend");
const sampleList = document.getElementById("sampleList");
const currentTimelineMarker = document.getElementById("currentTimelineMarker");
const currentTimelineMarkerText = document.getElementById("currentTimelineMarkerText");
const originMarker = document.getElementById("originMarker");
const originMarkerText = document.getElementById("originMarkerText");
const MAP_COORD_BOUNDS = Object.freeze({
  lonMin: -15,
  lonMax: 146,
  latMin: 0,
  latMax: 75,
  width: 1000,
  height: 500,
});
const MAP_SOURCE_BOUNDS = Object.freeze({
  lonMin: -180,
  lonMax: 180,
  latMin: -90,
  latMax: 90,
  width: 1000,
  height: 500,
});
const MAP_MIN_VIEWBOX_RATIO = 0.32;

// 创建样本点悬停弹窗
const tooltip = document.createElement("div");
tooltip.id = "tooltip-popup";
tooltip.style.cssText = `
  position: fixed;
  background: rgba(32, 41, 51, 0.95);
  color: #f7f5ed;
  padding: 12px 14px;
  border-radius: 8px;
  font-size: 12px;
  max-width: 200px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  backdrop-filter: blur(10px);
  pointer-events: auto;
  display: none;
  z-index: 1000;
  line-height: 1.5;
`;
document.body.appendChild(tooltip);

// 点击空白处关闭弹窗
document.addEventListener("click", (e) => {
  if (!e.target.closest('[data-sample-id]') && !e.target.closest('#tooltip-popup')) {
    tooltip.style.display = "none";
  }
});

const BRANCH_REGISTRY_URL = "data/branch-registry.json";

function normalizeBranchRegistryPayload(payload) {
  const branches = Array.isArray(payload) ? payload : payload?.branches;
  if (!Array.isArray(branches)) {
    return [];
  }
  return branches
    .filter((entry) => entry && entry.displayName)
    .sort((left, right) => (left.sortOrder ?? Number.MAX_SAFE_INTEGER) - (right.sortOrder ?? Number.MAX_SAFE_INTEGER));
}

function resolveBranchPagePath(pagePath) {
  if (!pagePath) {
    return "";
  }
  return `${pagePath}`.replace(/^\.\//, "").replace(/^\//, "");
}

function isCurrentBranchEntry(entry) {
  if (!entry) {
    return false;
  }
  if (entry.rootBranchId && entry.rootBranchId === data.meta.branch) {
    return true;
  }
  const currentPath = decodeURIComponent(window.location.pathname || "").replace(/\\/g, "/").toLowerCase();
  const expectedPath = resolveBranchPagePath(entry.pagePath).toLowerCase();
  return !!(expectedPath && currentPath.endsWith(expectedPath));
}

function renderBranchDrawerItems(entries) {
  if (!branchDrawerList) {
    return;
  }

  if (!entries.length) {
    branchDrawerList.innerHTML = `
      <div class="branch-drawer-item is-placeholder is-disabled" aria-disabled="true">
        <span class="branch-drawer-name">暂无支系</span>
        <span class="branch-drawer-meta">branch-registry.json 为空</span>
      </div>
    `;
    return;
  }

  branchDrawerList.innerHTML = entries.map((entry) => {
    const isCurrent = isCurrentBranchEntry(entry);
    const isDisabled = entry.status && entry.status !== "published";
    const tagName = isDisabled ? "div" : "a";
    const hrefAttr = !isDisabled && entry.pagePath ? ` href="${entry.pagePath}"` : "";
    const className = [
      "branch-drawer-item",
      isCurrent ? "is-current" : "",
      isDisabled ? "is-disabled" : "",
    ].filter(Boolean).join(" ");
    const meta = isCurrent
      ? "当前示例支系"
      : entry.summary || (isDisabled ? "待发布" : entry.rootBranchId || "已发布支系");
    return `
      <${tagName} class="${className}"${hrefAttr}${isDisabled ? ' aria-disabled="true"' : ""}>
        <span class="branch-drawer-name">${entry.displayName}</span>
        <span class="branch-drawer-meta">${meta}</span>
      </${tagName}>
    `;
  }).join("");
}

async function hydrateBranchDrawerItems() {
  const fallbackEntries = normalizeBranchRegistryPayload(window.BRANCH_REGISTRY_FALLBACK);
  if (fallbackEntries.length) {
    renderBranchDrawerItems(fallbackEntries);
  }

  try {
    const response = await fetch(BRANCH_REGISTRY_URL, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Registry request failed: ${response.status}`);
    }
    const payload = await response.json();
    const remoteEntries = normalizeBranchRegistryPayload(payload);
    if (remoteEntries.length) {
      renderBranchDrawerItems(remoteEntries);
    }
  } catch (_error) {
    if (!fallbackEntries.length) {
      renderBranchDrawerItems([]);
    }
  }
}

function setBranchDrawerOpen(isOpen) {
  if (!branchDrawerTrigger || !branchDrawer) {
    return;
  }
  branchDrawerTrigger.setAttribute("aria-expanded", String(isOpen));
  if (isOpen) {
    branchDrawer.hidden = false;
    void branchDrawer.offsetWidth;
    branchDrawer.classList.add("is-open");
    return;
  }
  branchDrawer.classList.remove("is-open");
  window.setTimeout(() => {
    if (!branchDrawer.classList.contains("is-open")) {
      branchDrawer.hidden = true;
    }
  }, 220);
}

branchDrawerTrigger?.addEventListener("click", (event) => {
  event.stopPropagation();
  const isOpen = branchDrawerTrigger.getAttribute("aria-expanded") === "true";
  setBranchDrawerOpen(!isOpen);
});

document.addEventListener("click", (event) => {
  if (!branchDrawerTrigger || !branchDrawer) {
    return;
  }
  if (branchDrawer.hidden) {
    return;
  }
  if (branchDrawer.contains(event.target) || branchDrawerTrigger.contains(event.target)) {
    return;
  }
  setBranchDrawerOpen(false);
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    setBranchDrawerOpen(false);
  }
});

hydrateBranchDrawerItems();

const SVG_NS = "http://www.w3.org/2000/svg";
const regionMap = new Map(data.regions.map((region) => [region.id, region]));
const branchMap = new Map(data.branches.map((branch) => [branch.id, branch]));
const sampleMap = new Map(data.samples.map((sample) => [sample.id, sample]));
const compressedCommonPrefix = getCompressedCommonPrefix();
const PLAYBACK_TOTAL_MS = 20000;
const TREE_PRE_ORIGIN_SHARE = 0.18;
const TREE_ANNOTATION_BRANCH_IDS = ["MF247416", "BY182928", "Y20085", "Y20087", "ZQ32"];
const TREE_SUPPRESSED_BRANCH_LABELS = new Set();
const TREE_ALWAYS_LABEL_BRANCH_IDS = new Set(["Y4541", "Y12782", "MF317986", "MV154461", "Y20798"]);
const TREE_FORCED_LABEL_LAYOUT = new Map([
  ["Y4541", { x: -12, y: -14 }],
  ["Y12782", { x: -16, y: 18 }],
  ["MF317986", { x: -14, y: 66 }],
  ["MV154461", { x: -14, y: 82 }],
  ["Y20798", { x: -14, y: 44 }],
]);
const treeBranchAnnotations = new Map(
  TREE_ANNOTATION_BRANCH_IDS
    .map((branchId) => [branchId, getTreeBranchAnnotation(branchId)])
    .filter(([, label]) => !!label)
);

const originBranch = branchMap.get(data.meta.branch);
const MAP_BRANCH_OVERRIDES = new Map([
  ["Y4569", {
    mapAge: 1260,
    tribeLabel: "蒙兀",
    tribeCoord: [53.27, 123.00],
    idCoord: [51.77, 123.00],
    ellipse: { lon: 123.00, lat: 52.55, rx: 8.8, ry: 5.4, rotation: 6 },
    mapFill: "#ff6d3f",
    mapOpacity: 0.82,
    directLabel: true,
  }],
  ["Y4541", {
    mapAge: 1100,
    tribeLabel: "尼伦蒙古",
    tribeCoord: [49.42, 120.93],
    idCoord: [47.92, 120.93],
    ellipse: { lon: 120.40, lat: 48.60, rx: 15.5, ry: 8.5, rotation: -8 },
    mapFill: "#ff9d95",
    mapOpacity: 0.62,
    directLabel: true,
  }],
  ["Y12782", {
    mapAge: 800,
    tribeLabel: "蒙古各部",
    tribeCoord: [47.69, 102.75],
    idCoord: [46.19, 102.75],
    ellipse: { lon: 110.80, lat: 45.10, rx: 26.8, ry: 11.8, rotation: -6 },
    mapFill: "#f8efba",
    mapOpacity: 0.52,
    directLabel: true,
  }],
  ["ZQ32", {
    mapAge: 600,
    tribeLabel: "克烈",
    tribeCoord: [51.44, 75.06],
    idCoord: [49.94, 75.06],
    ellipse: { lon: 75.06, lat: 50.70, rx: 10.8, ry: 4.4, rotation: -2 },
    mapFill: "#b8ea63",
    mapOpacity: 0.86,
    mapStroke: "rgba(43, 57, 115, 0.95)",
    directLabel: true,
  }],
  ["Y20085", {
    mapAge: 600,
    tribeLabel: "Sary-uysyn",
    tribeCoord: [42.70, 75.02],
    idCoord: [44.20, 75.02],
    ellipse: { lon: 76.30, lat: 42.15, rx: 10.0, ry: 4.9, rotation: -10 },
    mapFill: "#72c1ee",
    mapOpacity: 0.86,
    mapStroke: "rgba(43, 57, 115, 0.95)",
    directLabel: true,
  }],
  ["Y20087", {
    mapAge: 700,
    tribeLabel: "杜拉特",
    tribeCoord: [41.59, 75.80],
    idCoord: [40.09, 75.80],
    ellipse: { lon: 76.30, lat: 42.15, rx: 10.0, ry: 4.9, rotation: -10 },
    mapFill: "#72c1ee",
    mapOpacity: 0.86,
    mapStroke: "rgba(43, 57, 115, 0.95)",
    directLabel: true,
  }],
  ["BY182928", {
    mapAge: 500,
    tribeLabel: "忙忽惕",
    tribeCoord: [42.41, 59.13],
    idCoord: [40.91, 59.13],
    ellipse: { lon: 59.13, lat: 41.60, rx: 4.8, ry: 3.0, rotation: -6 },
    mapFill: "#e9d85d",
    mapOpacity: 0.86,
    mapStroke: "rgba(43, 57, 115, 0.95)",
    directLabel: true,
  }],
  ["SK1076", {
    mapAge: 600,
    tribeLabel: "哈扎拉",
    tribeCoord: [34.80, 67.95],
    idCoord: [33.30, 67.95],
    ellipse: { lon: 67.95, lat: 34.05, rx: 5.2, ry: 3.1, rotation: 8 },
    mapFill: "#d66f7b",
    mapOpacity: 0.88,
    mapStroke: "rgba(43, 57, 115, 0.95)",
    directLabel: true,
  }],
  ["MF317986", { hideOnMap: true }],
  ["MV154461", { hideOnMap: true }],
  ["Y20798", { hideOnMap: true }],
]);
const MAP_EXTRA_BRANCHES = [
  {
    id: "F18202",
    label: "F18202",
    parentId: "Y4569",
    age: 900,
    mapAge: 900,
    center: [47.86, 111.10],
    color: "#f3b3de",
    tribeLabel: "蒙古",
    tribeCoord: [49.36, 111.10],
    idCoord: [47.86, 111.10],
    ellipse: { lon: 111.10, lat: 48.60, rx: 12.8, ry: 6.4, rotation: -4 },
    mapFill: "#f3b3de",
    mapOpacity: 0.58,
    directLabel: true,
  },
  {
    id: "FT230267",
    label: "FT230267",
    parentId: "Y12782",
    age: 500,
    mapAge: 500,
    center: [43.50, 85.52],
    color: "#6dd146",
    tribeLabel: "克烈-阿巴克",
    tribeCoord: [45.00, 85.52],
    idCoord: [43.50, 85.52],
    ellipse: { lon: 85.52, lat: 44.20, rx: 4.6, ry: 2.7, rotation: 8 },
    mapFill: "#6dd146",
    mapOpacity: 0.84,
    mapStroke: "rgba(43, 57, 115, 0.95)",
    directLabel: true,
  },
];
const MAP_BACKGROUND_ZONES = [
  {
    id: "steppe-belt",
    mapAge: 1260,
    mapFill: "rgba(224, 189, 160, 0.40)",
    polygon: [[40, 55], [56, 55], [71, 56], [86, 56], [101, 56], [116, 55], [130, 54], [140, 52], [141, 46], [140, 40], [136, 35], [126, 33], [113, 33], [99, 34], [86, 35], [72, 36], [58, 37], [47, 35], [41, 31]],
  },
  {
    id: "y12782-belt",
    mapAge: 800,
    mapFill: "rgba(248, 239, 186, 0.42)",
    polygon: [[88, 53], [96, 56], [107, 57], [119, 56], [130, 52], [136, 48], [137, 42], [133, 38], [123, 35], [111, 34], [99, 35], [91, 38], [88, 44]],
  },
  {
    id: "f18202-belt",
    mapAge: 900,
    mapFill: "rgba(247, 193, 231, 0.34)",
    polygon: [[104, 51], [111, 53], [119, 53], [126, 51], [128, 47], [126, 43], [119, 41], [111, 41], [105, 43], [103, 47]],
  },
];
const MAP_EXTRA_BRANCH_MAP = new Map(MAP_EXTRA_BRANCHES.map((branch) => [branch.id, branch]));
const TREE_EXTRA_BRANCHES = Object.freeze([]);
const TREE_BRANCHES = Object.freeze([...data.branches, ...TREE_EXTRA_BRANCHES]);
function getMapStageAgeById(branchId) {
  const overrideConfig = MAP_BRANCH_OVERRIDES.get(branchId);
  if (Number.isFinite(overrideConfig?.mapAge)) {
    return overrideConfig.mapAge;
  }
  const extraBranch = MAP_EXTRA_BRANCH_MAP.get(branchId);
  if (Number.isFinite(extraBranch?.mapAge)) {
    return extraBranch.mapAge;
  }
  const branch = branchMap.get(branchId);
  return Number.isFinite(branch?.age) ? branch.age : null;
}

function getSpreadImageActivationAge(entry) {
  if (Number.isFinite(entry.activationAge)) {
    return entry.activationAge;
  }
  return entry.branchId ? getMapStageAgeById(entry.branchId) : null;
}

const MAP_SPREAD_IMAGE_CONFIG = Object.freeze([
  { src: "图/1蒙兀Y4541.png", branchId: "Y4569", stackOrder: 10 },
  { src: "图/2尼伦蒙古Y4541.png", branchId: "Y4541", stackOrder: 9 },
  { src: "图/3萌古F18202.png", branchId: "F18202", activationAge: 1000, stackOrder: 8 },
  { src: "图/4蒙古F18202.png", branchId: "F18202", stackOrder: 7 },
  { src: "图/5蒙古各部Y12782.png", branchId: "Y12782", stackOrder: 6 },
  { src: "图/9哈扎拉SK1076.png", branchId: "SK1076", stackOrder: 5 },
  { src: "图/7克烈 ZQ32.png", branchId: "ZQ32", stackOrder: 4 },
  { src: "图/10Sary-uysyn Y20085杜拉特Y20087.png", branchId: "Y20085", stackOrder: 3 },
  { src: "图/8克列-阿巴克FT230267.png", branchId: "FT230267", stackOrder: 2 },
  { src: "图/11忙忽惕BY182928.png", branchId: "BY182928", stackOrder: 1 },
  { src: "图/再一步.png", branchId: "MF317986", activationAge: 700, stackOrder: 0 },
]);
const MAP_STAGE_AGES = [...new Set([
  ...[...MAP_BRANCH_OVERRIDES.values()].map((config) => config.mapAge).filter((age) => Number.isFinite(age)),
  ...MAP_EXTRA_BRANCHES.map((branch) => branch.mapAge).filter((age) => Number.isFinite(age)),
  ...MAP_SPREAD_IMAGE_CONFIG.map((entry) => getSpreadImageActivationAge(entry)).filter((age) => Number.isFinite(age)),
])];
const MAP_VISIBLE_BRANCH_IDS = new Set([
  "Y4569",
  "Y4541",
  "Y12782",
  "F18202",
  "ZQ32",
  "FT230267",
  "Y20085",
  "Y20087",
  "BY182928",
  "SK1076",
]);

// 非线性时间轴：宗族出现前稀疏（压缩空白期），出现后密集（展开关键期）
const timelineSteps = [];
const originAge = originBranch ? originBranch.age : 0;
const SPARSE_STEP = 400; // 宗族出现前步长（压缩前半段空白区）
const DENSE_STEP = 50;   // 宗族出现后步长（展开关键期）

// 稀疏部分：5000 → originAge（不含）
for (let bp = data.meta.timelineStartBP; bp > originAge; bp -= SPARSE_STEP) {
  timelineSteps.push(bp);
}
// 插入宗族出现点
if (originBranch && !timelineSteps.includes(originAge)) {
  timelineSteps.push(originAge);
}
// 密集部分：originAge-DENSE_STEP → 0
for (let bp = originAge - DENSE_STEP; bp >= 0; bp -= DENSE_STEP) {
  timelineSteps.push(bp);
}
MAP_STAGE_AGES.forEach((age) => timelineSteps.push(age));
if (!timelineSteps.includes(0)) timelineSteps.push(0);

const timeline = [...new Set(timelineSteps)].sort((a, b) => b - a);

function getTimelinePositionPercent(index) {
  if (timeline.length <= 1) {
    return 0;
  }
  const clampedIndex = Math.max(0, Math.min(timeline.length - 1, index));
  return (clampedIndex / (timeline.length - 1)) * 100;
}

function getBpAtTimelinePosition(position) {
  const clampedPosition = Math.max(0, Math.min(timeline.length - 1, position));
  const leftIndex = Math.floor(clampedPosition);
  const rightIndex = Math.min(timeline.length - 1, Math.ceil(clampedPosition));
  if (leftIndex === rightIndex) {
    return timeline[leftIndex];
  }
  const blend = clampedPosition - leftIndex;
  return timeline[leftIndex] + (timeline[rightIndex] - timeline[leftIndex]) * blend;
}

function getTimelinePositionForBp(bp) {
  const maxBp = timeline[0] || 0;
  const clampedBp = Math.max(0, Math.min(maxBp, bp));
  if (clampedBp >= maxBp) {
    return 0;
  }
  if (clampedBp <= 0) {
    return timeline.length - 1;
  }

  for (let index = 0; index < timeline.length - 1; index += 1) {
    const leftAge = timeline[index];
    const rightAge = timeline[index + 1];
    if (clampedBp > leftAge || clampedBp < rightAge) {
      continue;
    }
    if (leftAge === rightAge) {
      return index;
    }
    const blend = (leftAge - clampedBp) / Math.max(leftAge - rightAge, Number.EPSILON);
    return index + blend;
  }

  return timeline.length - 1;
}

function getPlaybackAxisProgress(bp) {
  return ageToTimelineFrac(bp);
}

function getBpForPlaybackAxisProgress(progress) {
  const clampedProgress = Math.max(0, Math.min(1, progress));
  const maxBp = timeline[0] || 0;

  if (!originBranch) {
    return maxBp * (1 - clampedProgress);
  }

  if (clampedProgress <= TREE_PRE_ORIGIN_SHARE) {
    const preOriginShare = Math.max(TREE_PRE_ORIGIN_SHARE, Number.EPSILON);
    const segmentProgress = clampedProgress / preOriginShare;
    return maxBp - (maxBp - originAge) * segmentProgress;
  }

  const postOriginShare = Math.max(1 - TREE_PRE_ORIGIN_SHARE, Number.EPSILON);
  const segmentProgress = (clampedProgress - TREE_PRE_ORIGIN_SHARE) / postOriginShare;
  return Math.max(0, originAge * (1 - segmentProgress));
}

function updateAxisLabels() {
  const axisContainer = document.querySelector('.axis-labels');
  if (!axisContainer) return;

  const labelAges = originBranch
    ? [timeline[0], originAge, 0]
    : [timeline[0], getBpForPlaybackAxisProgress(0.5), 0];
  const ages = [...new Set(labelAges.map((age) => Math.max(0, Math.round(age))))];

  axisContainer.innerHTML = '';
  ages.forEach((age, order) => {
    const span = document.createElement('span');
    span.className = 'axis-label';
    if (order === 0) span.classList.add('axis-label-start');
    if (order === ages.length - 1) span.classList.add('axis-label-end');
    span.style.setProperty('--pos', `${(getPlaybackAxisProgress(age) * 100).toFixed(1)}%`);
    span.textContent = age === 0 ? '现代' : formatTime(age);
    axisContainer.appendChild(span);
  });
}

function updateOriginTimelineMarker() {
  if (!originBranch || !originMarker) return;

  const originPosition = getPlaybackAxisProgress(originBranch.age) * 100;

  originMarker.style.setProperty('--pos', `${originPosition.toFixed(1)}%`);
  if (originMarkerText) {
    originMarkerText.textContent = `${data.meta.branch} 出现 · ${formatTime(originBranch.age)}`;
  }
}

function updateCurrentTimelineMarker(bp) {
  if (!currentTimelineMarker) return;

  const pos = getPlaybackAxisProgress(bp) * 100;
  currentTimelineMarker.style.setProperty('--pos', `${pos.toFixed(1)}%`);
  currentTimelineMarker.dataset.edge = pos < 12 ? 'start' : pos > 88 ? 'end' : 'center';
  if (currentTimelineMarkerText) {
    const modeText = bp === 0 ? '现代样本点状态' : '古代扩散阶段';
    currentTimelineMarkerText.textContent = `播放到 ${modeText} · ${formatTime(bp)}`;
  }
}

updateAxisLabels();
updateOriginTimelineMarker();


let currentIndex = 0;
let currentTimelinePosition = 0;
let animationFrameId = null;
let playbackLastTimestamp = null;
const originStartIndex = getOriginStartIndex();

slider.min = '0';
slider.max = '1';
slider.step = 'any';

function syncTimelinePosition(position) {
  currentTimelinePosition = Math.max(0, Math.min(timeline.length - 1, position));
  currentIndex = Math.max(0, Math.min(timeline.length - 1, Math.round(currentTimelinePosition)));
}

function syncTimelinePositionFromBp(bp) {
  syncTimelinePosition(getTimelinePositionForBp(bp));
  slider.value = String(getPlaybackAxisProgress(bp));
}

// 追踪已显示过的分支，用于累积动画
const displayedBranches = new Map(); // branchId -> bp (该分支首次激活时的bp值)
let prevBp = null; // 上一帧的 bp，bp 增大表示时间回退
// 每个分支的历史扩散轮廓（用于绘制变透明度涟漪环）
const trailHistory = new Map(); // branchId -> [{pathData, dr, dg, db, progress}]
const MAX_TRAIL_RINGS = 40; // 流水拖尾帧数（越多越完整，显示从原点到目的地的路径）
// 每个分支的持久流水线元素（红色流动虚线，不随帧重建）
const flowElements = new Map(); // branchId -> { group, glowLine, midLine, brightLine, grad }

applyFocusViewBox();
renderFocusFrame();

// 删除：breathLoop 和 branchFirstFrame 已移除（不需要呼吸/入场闪光）

// 延迟初始render调用，确保所有函数和常量都已定义
setTimeout(render, 0);

slider.addEventListener("input", () => {
  const nextBp = getBpForPlaybackAxisProgress(Number(slider.value));
  syncTimelinePositionFromBp(nextBp);
  stopPlayback();
  render();
});

playButton.addEventListener("click", () => {
  togglePlayback();
});

timelinePlayButton.addEventListener("click", () => {
  togglePlayback();
});

jumpModernButton.addEventListener("click", () => {
  stopPlayback();
  syncTimelinePositionFromBp(0);
  render();
});

function updatePlayIcons(isPlaying) {
  const pausePath = 'M6 19h4V5H6v14zm8-14v14h4V5h-4z';
  const playPath = 'M8 5v14l11-7z';
  const d = isPlaying ? pausePath : playPath;
  // 顶部文字按钮
  playButton.textContent = isPlaying ? '暂停播放' : '开始播放';
  // 时间轴图标按钮
  const svgEl = timelinePlayButton.querySelector('svg path');
  if (svgEl) svgEl.setAttribute('d', d);
}

function stopPlayback() {
  if (animationFrameId != null) {
    window.cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
  playbackLastTimestamp = null;
  updatePlayIcons(false);
}

function togglePlayback() {
  if (animationFrameId != null) {
    // 正在播放 → 暂停在当前位置
    stopPlayback();
    return;
  }
  // 未播放 → 从头开始播放；已到末尾则重置到0
  if (currentTimelinePosition >= timeline.length - 1) {
    syncTimelinePositionFromBp(timeline[0] || 0);
    render();
  }
  updatePlayIcons(true);
  playbackLastTimestamp = null;
  let playbackAxisProgress = Number(slider.value) || 0;
  const playFrame = (timestamp) => {
    if (animationFrameId == null) {
      return;
    }
    if (playbackLastTimestamp == null) {
      playbackLastTimestamp = timestamp;
    }
    const elapsed = timestamp - playbackLastTimestamp;
    playbackLastTimestamp = timestamp;
    playbackAxisProgress = Math.min(1, playbackAxisProgress + (elapsed / Math.max(PLAYBACK_TOTAL_MS, 1)));
    const nextBp = getBpForPlaybackAxisProgress(playbackAxisProgress);
    syncTimelinePositionFromBp(nextBp);
    render();
    if (playbackAxisProgress >= 1 || currentTimelinePosition >= timeline.length - 1) {
      stopPlayback();
      return;
    }
    animationFrameId = window.requestAnimationFrame(playFrame);
  };
  animationFrameId = window.requestAnimationFrame(playFrame);
}

function getOriginStartIndex() {
  if (!originBranch) {
    return 0;
  }
  const exactIndex = timeline.indexOf(originBranch.age);
  if (exactIndex !== -1) {
    return exactIndex;
  }
  const fallbackIndex = timeline.findIndex((bp) => bp <= originBranch.age);
  return fallbackIndex === -1 ? 0 : fallbackIndex;
}

function applyFocusViewBox() {
  const { width, height } = MAP_COORD_BOUNDS;
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  syncMapBackgroundToBounds();
  // 记录初始 viewBox 供缩放还原使用
  svg._initVB = { x: 0, y: 0, width, height };
}

function syncMapBackgroundToBounds() {
  if (!mapBaseImage) {
    return;
  }

  const sourceLonSpan = MAP_SOURCE_BOUNDS.lonMax - MAP_SOURCE_BOUNDS.lonMin;
  const sourceLatSpan = MAP_SOURCE_BOUNDS.latMax - MAP_SOURCE_BOUNDS.latMin;
  const focusX0 = ((MAP_COORD_BOUNDS.lonMin - MAP_SOURCE_BOUNDS.lonMin) / sourceLonSpan) * MAP_SOURCE_BOUNDS.width;
  const focusX1 = ((MAP_COORD_BOUNDS.lonMax - MAP_SOURCE_BOUNDS.lonMin) / sourceLonSpan) * MAP_SOURCE_BOUNDS.width;
  const focusY0 = ((MAP_SOURCE_BOUNDS.latMax - MAP_COORD_BOUNDS.latMax) / sourceLatSpan) * MAP_SOURCE_BOUNDS.height;
  const focusY1 = ((MAP_SOURCE_BOUNDS.latMax - MAP_COORD_BOUNDS.latMin) / sourceLatSpan) * MAP_SOURCE_BOUNDS.height;
  const focusWidth = focusX1 - focusX0;
  const focusHeight = focusY1 - focusY0;
  const scaleX = MAP_COORD_BOUNDS.width / focusWidth;
  const scaleY = MAP_COORD_BOUNDS.height / focusHeight;

  mapBaseImage.setAttribute("x", (-focusX0 * scaleX).toFixed(2));
  mapBaseImage.setAttribute("y", (-focusY0 * scaleY).toFixed(2));
  mapBaseImage.setAttribute("width", (MAP_SOURCE_BOUNDS.width * scaleX).toFixed(2));
  mapBaseImage.setAttribute("height", (MAP_SOURCE_BOUNDS.height * scaleY).toFixed(2));
}

// ── 地图缩放控件 ─────────────────────────────────────────────────────────
function getViewBox() {
  const vb = svg.getAttribute("viewBox").split(" ").map(Number);
  return { x: vb[0], y: vb[1], width: vb[2], height: vb[3] };
}

function setViewBox(x, y, width, height) {
  const bounds = svg._initVB || { x: 0, y: 0, width: MAP_COORD_BOUNDS.width, height: MAP_COORD_BOUNDS.height };
  const clampedWidth = Math.max(bounds.width * MAP_MIN_VIEWBOX_RATIO, Math.min(width, bounds.width));
  const clampedHeight = Math.max(bounds.height * MAP_MIN_VIEWBOX_RATIO, Math.min(height, bounds.height));
  const maxX = bounds.x + bounds.width - clampedWidth;
  const maxY = bounds.y + bounds.height - clampedHeight;
  const clampedX = clampedWidth >= bounds.width
    ? bounds.x
    : Math.max(bounds.x, Math.min(x, maxX));
  const clampedY = clampedHeight >= bounds.height
    ? bounds.y
    : Math.max(bounds.y, Math.min(y, maxY));

  svg.setAttribute("viewBox", `${clampedX} ${clampedY} ${clampedWidth} ${clampedHeight}`);
}

function panViewBox(deltaX, deltaY = 0) {
  const vb = getViewBox();
  setViewBox(vb.x + deltaX, vb.y + deltaY, vb.width, vb.height);
}

document.getElementById("mapZoomIn").addEventListener("click", () => {
  const vb = getViewBox();
  const factor = 0.80; // 缩小视窗 = 放大画面
  const cx = vb.x + vb.width / 2;
  const cy = vb.y + vb.height / 2;
  const nw = vb.width * factor;
  const nh = vb.height * factor;
  setViewBox(cx - nw / 2, cy - nh / 2, nw, nh);
});

document.getElementById("mapZoomOut").addEventListener("click", () => {
  const vb = getViewBox();
  const factor = 1.25; // 扩大视窗 = 缩小画面
  const cx = vb.x + vb.width / 2;
  const cy = vb.y + vb.height / 2;
  const nw = vb.width * factor;
  const nh = vb.height * factor;
  setViewBox(cx - nw / 2, cy - nh / 2, nw, nh);
});

document.getElementById("mapZoomReset").addEventListener("click", () => {
  if (svg._initVB) {
    const { x, y, width, height } = svg._initVB;
    setViewBox(x, y, width, height);
  } else {
    applyFocusViewBox();
  }
});

document.getElementById("mapPanLeft").addEventListener("click", () => {
  const vb = getViewBox();
  panViewBox(-vb.width * 0.16, 0);
});

document.getElementById("mapPanRight").addEventListener("click", () => {
  const vb = getViewBox();
  panViewBox(vb.width * 0.16, 0);
});

function renderFocusFrame() {
  // 不渲染边框和标签
  focusLayer.textContent = "";
}

function lonToX(lon) {
  const { lonMin, lonMax, width } = MAP_COORD_BOUNDS;
  return ((lon - lonMin) / (lonMax - lonMin)) * width;
}

function latToY(lat) {
  const { latMin, latMax, height } = MAP_COORD_BOUNDS;
  return ((latMax - lat) / (latMax - latMin)) * height;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function createEllipsePolygon(lon, lat, rx, ry, rotation = 0, numPoints = 40) {
  const theta = (rotation * Math.PI) / 180;
  const cosTheta = Math.cos(theta);
  const sinTheta = Math.sin(theta);
  return Array.from({ length: numPoints }, (_, index) => {
    const angle = (2 * Math.PI * index) / numPoints;
    const ex = Math.cos(angle) * rx;
    const ey = Math.sin(angle) * ry;
    const px = lon + ex * cosTheta - ey * sinTheta;
    const py = lat + ex * sinTheta + ey * cosTheta;
    return [px, py];
  });
}

function getMapBranchEntity(id) {
  const base = MAP_EXTRA_BRANCH_MAP.get(id) || branchMap.get(id);
  if (!base) {
    return null;
  }
  const override = MAP_BRANCH_OVERRIDES.get(id);
  return override ? { ...base, ...override } : base;
}

function getMapActivationAge(branch) {
  return branch.mapAge ?? branch.age;
}

function getBranchMapCenter(branch) {
  if (branch.idCoord) {
    return [branch.idCoord[0], branch.idCoord[1]];
  }
  if (branch.ellipse) {
    return [branch.ellipse.lat, branch.ellipse.lon];
  }
  return branch.center;
}

function getBranchMapPolygon(branch) {
  if (branch.polygon) {
    return branch.polygon;
  }
  if (branch.ellipse) {
    return createEllipsePolygon(
      branch.ellipse.lon,
      branch.ellipse.lat,
      branch.ellipse.rx,
      branch.ellipse.ry,
      branch.ellipse.rotation || 0
    );
  }
  const region = branch.regionId ? regionMap.get(branch.regionId) : null;
  return region ? region.polygon : buildFallbackPolygon(branch);
}

function getVisibleMapBranches(bp) {
  return [...MAP_VISIBLE_BRANCH_IDS]
    .map((id) => getMapBranchEntity(id))
    .filter((branch) => branch && !branch.hideOnMap && bp <= getMapActivationAge(branch))
    .sort((a, b) => getMapActivationAge(b) - getMapActivationAge(a));
}

function renderMapBackgroundZones(bp) {
  regionOverlayLayer.textContent = "";
  MAP_BACKGROUND_ZONES.forEach((zone) => {
    if (bp > zone.mapAge) {
      return;
    }
    const pathData = zone.polygon
      .map(([lon, lat], index) => {
        const command = index === 0 ? "M" : "L";
        return `${command} ${lonToX(lon).toFixed(2)} ${latToY(lat).toFixed(2)}`;
      })
      .join(" ") + " Z";
    const path = document.createElementNS(SVG_NS, "path");
    path.setAttribute("d", pathData);
    path.setAttribute("fill", zone.mapFill);
    path.setAttribute("opacity", "1");
    path.setAttribute("stroke", "none");
    regionOverlayLayer.appendChild(path);
  });
}

function renderSpreadImages(bp) {
  ancientLayer.textContent = "";
  MAP_SPREAD_IMAGE_CONFIG
    .map((entry, index) => ({
      ...entry,
      index,
      activationAge: getSpreadImageActivationAge(entry),
      stackOrder: entry.stackOrder ?? index,
    }))
    .filter((entry) => Number.isFinite(entry.activationAge) && bp <= entry.activationAge)
    .sort((a, b) => a.stackOrder - b.stackOrder || a.activationAge - b.activationAge || a.index - b.index)
    .forEach((entry) => {
    const image = document.createElementNS(SVG_NS, "image");
    image.setAttribute("href", entry.src);
    image.setAttribute("x", "0");
    image.setAttribute("y", "0");
    image.setAttribute("width", String(MAP_COORD_BOUNDS.width));
    image.setAttribute("height", String(MAP_COORD_BOUNDS.height));
    image.setAttribute("preserveAspectRatio", "none");
    image.setAttribute("pointer-events", "none");
    ancientLayer.appendChild(image);
  });
}

// ── 时间轴颜色渐变配置 ──────────────────────────────────────────────────────
// 每个分支对应一组色阶，从最深（分支初现时）到最浅（现代）
const BRANCH_GRADIENTS = {
  // 组1：Y4569 / Y185715 / MF247416
  Y4569:    ["#410d19", "#7c2221", "#cc4839"],
  Y185715:  ["#410d19", "#7c2221", "#cc4839"],
  MF247416: ["#410d19", "#7c2221", "#cc4839"],
  // 组2：Y104500
  Y104500:  ["#4aa485"],
  // 组3：BY182928
  BY182928: ["#5e3f00", "#8f6831"],
  // 组4：Y12782 / MF317986 / MV154461 / Y20798 / Y20085 / Y20087
  Y12782:   ["#314720", "#175f3a", "#5b8267", "#6b8150", "#a8be40", "#dfb94e", "#ccdb8f", "#e6f8b8"],
  MF317986: ["#314720", "#175f3a", "#5b8267", "#6b8150", "#a8be40", "#dfb94e", "#ccdb8f", "#e6f8b8"],
  MV154461: ["#314720", "#175f3a", "#5b8267", "#6b8150", "#a8be40", "#dfb94e", "#ccdb8f", "#e6f8b8"],
  Y20798:   ["#314720", "#175f3a", "#5b8267", "#6b8150", "#a8be40", "#dfb94e", "#ccdb8f", "#e6f8b8"],
  Y20085:   ["#314720", "#175f3a", "#5b8267", "#6b8150", "#a8be40", "#dfb94e", "#ccdb8f", "#e6f8b8"],
  Y20087:   ["#314720", "#175f3a", "#5b8267", "#6b8150", "#a8be40", "#dfb94e", "#ccdb8f", "#e6f8b8"],
  // 组5：Y4541
  Y4541:    ["#e09b02", "#dfb94e", "#ece48f"],
  // 组6：MF193836
  MF193836: ["#c1ab82", "#e9d6b1"],
  // 组7：ZQ32
  ZQ32:     ["#9e4004", "#bf5b05", "#e0804d"],
  // 组8：FGC16605 / FGC16593
  FGC16605: ["#a8be40", "#bcdb8f", "#f8d7ce"],
  FGC16593: ["#a8be40", "#bcdb8f", "#f8d7ce"],
  // 组9：FGC29011 / FGC29003 / MF274950
  FGC29011: ["#07435b", "#225688", "#387ea2", "#678ca9", "#5aa3c6"],
  FGC29003: ["#07435b", "#225688", "#387ea2", "#678ca9", "#5aa3c6"],
  MF274950: ["#07435b", "#225688", "#387ea2", "#678ca9", "#5aa3c6"],
  // 组10：Y125520 / ZQ1049 / SK1076
  Y125520:  ["#2b186b", "#564e77", "#9a92bb", "#d8cbdc"],
  ZQ1049:   ["#2b186b", "#564e77", "#9a92bb", "#d8cbdc"],
  SK1076:   ["#2b186b", "#564e77", "#9a92bb", "#d8cbdc"],
};

// 将两个hex颜色在t(0~1)处插值，返回hex字符串
function interpolateHexColors(hexA, hexB, t) {
  const ra = parseInt(hexA.slice(1, 3), 16);
  const ga = parseInt(hexA.slice(3, 5), 16);
  const ba = parseInt(hexA.slice(5, 7), 16);
  const rb = parseInt(hexB.slice(1, 3), 16);
  const gb = parseInt(hexB.slice(3, 5), 16);
  const bb = parseInt(hexB.slice(5, 7), 16);
  const r = Math.round(ra + (rb - ra) * t);
  const g = Math.round(ga + (gb - ga) * t);
  const b = Math.round(ba + (bb - ba) * t);
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

// 根据时间进度t(0=最古=最深色, 1=现代=最浅色)从色阶中插值
function interpolateGradient(stops, t) {
  if (!stops || stops.length === 0) return "#888888";
  if (stops.length === 1) return stops[0];
  t = Math.max(0, Math.min(1, t));
  const scaled = t * (stops.length - 1);
  const idx = Math.min(Math.floor(scaled), stops.length - 2);
  const f = scaled - idx;
  return interpolateHexColors(stops[idx], stops[idx + 1], f);
}

// 获取分支在指定时间bp时的渐变色（hex格式）
// 动画效果：深红→中红→浅红→白（前2/3时间），白→支系色（后1/3时间）
function getBranchColorAtTime(branch, bp) {
  const age = Math.max(getMapActivationAge(branch), 1);
  // t=0：分支初现（bp=age），t=1：现代（bp=0）
  const t = clamp(1 - bp / age, 0, 1);
  
  // 前2/3：深红 → 浅红 → 白
  if (t <= 0.67) {
    const t2 = t / 0.67; // 归一化到0-1
    if (t2 <= 0.5) {
      // 深红(#7B0000) → 中红(#CC2020)
      return interpolateHexColors('#7B0000', '#CC2020', t2 * 2);
    } else {
      // 中红(#CC2020) → 浅红(#FF9090) → 淡白(#EBEBEB，不用纯白避免高亮)
      const t3 = (t2 - 0.5) * 2; // 0→1
      if (t3 <= 0.5) {
        return interpolateHexColors('#CC2020', '#FF9090', t3 * 2);
      } else {
        return interpolateHexColors('#FF9090', '#EBEBEB', (t3 - 0.5) * 2);
      }
    }
  }
  
  // 后1/3：淡白 → 支系色
  const t4 = (t - 0.67) / 0.33; // 归一化到0-1
  return interpolateHexColors('#EBEBEB', branch.color || '#888888', clamp(t4, 0, 1));
}

// 计算轮廓在特定进度下的渐变颜色（从深到浅）
// branch: 分支对象，progress: 当前进度（0-1），currentBp: 当前时间点
function getOutlineGradientColor(branch, progress, currentBp) {
  // 获取分支的基础颜色
  const baseColor = getBranchColorAtTime(branch, currentBp);
  const matches = baseColor.match(/^#([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
  if (!matches) return { r: 100, g: 100, b: 100 };
  
  let [, rStr, gStr, bStr] = matches;
  let r = Number.parseInt(rStr, 16);
  let g = Number.parseInt(gStr, 16);
  let b = Number.parseInt(bStr, 16);
  
  // 根据进度计算颜色深度：进度小的轮廓更深，大的轮廓更浅
  // progress 越小（过去），颜色越深；progress 越大（现在），颜色越浅
  const depthFactor = progress; // 0 = 最深，1 = 最浅
  
  // 将颜色向白色方向渐变（亮化）
  r = Math.round(r + (255 - r) * depthFactor * 0.5);
  g = Math.round(g + (255 - g) * depthFactor * 0.5);
  b = Math.round(b + (255 - b) * depthFactor * 0.5);
  
  return { r, g, b };
}

// 为分支创建/更新 SVG 辐射渐变（深色中心→透明边缘）
function ensureBranchGradient(branch, r, g, b) {
  const safeId = branch.id.replace(/[^a-zA-Z0-9]/g, '_');
  const gradId = `bGrad_${safeId}`;
  const defs = svg.querySelector('defs');
  let grad = document.getElementById(gradId);

  if (!grad) {
    grad = document.createElementNS(SVG_NS, 'radialGradient');
    grad.setAttribute('id', gradId);
    grad.setAttribute('gradientUnits', 'userSpaceOnUse');
    // 3个色标：中心高亮、中间半透明、边缘极淡
    for (let i = 0; i < 4; i++) {
      const s = document.createElementNS(SVG_NS, 'stop');
      grad.appendChild(s);
    }
    defs.appendChild(grad);
  }

  const [lat, lon] = getBranchMapCenter(branch);
  const cx = lonToX(lon);
  const cy = latToY(lat);

  const points = getBranchMapPolygon(branch);
  let maxDist = 40;
  if (points) {
    for (const [plon, plat] of points) {
      const dx = lonToX(plon) - cx;
      const dy = latToY(plat) - cy;
      maxDist = Math.max(maxDist, Math.sqrt(dx * dx + dy * dy));
    }
  }

  grad.setAttribute('cx', cx);
  grad.setAttribute('cy', cy);
  grad.setAttribute('r', maxDist * 1.15);
  grad.setAttribute('fx', cx);
  grad.setAttribute('fy', cy);

  const stops = grad.querySelectorAll('stop');
  stops[0].setAttribute('offset', '0%');
  stops[0].setAttribute('stop-color', `rgb(${Math.min(255,r+40)}, ${Math.min(255,g+40)}, ${Math.min(255,b+40)})`);
  stops[0].setAttribute('stop-opacity', '0.95');
  stops[1].setAttribute('offset', '35%');
  stops[1].setAttribute('stop-color', `rgb(${r}, ${g}, ${b})`);
  stops[1].setAttribute('stop-opacity', '0.75');
  stops[2].setAttribute('offset', '70%');
  stops[2].setAttribute('stop-color', `rgb(${r}, ${g}, ${b})`);
  stops[2].setAttribute('stop-opacity', '0.35');
  stops[3].setAttribute('offset', '100%');
  stops[3].setAttribute('stop-color', `rgb(${r}, ${g}, ${b})`);
  stops[3].setAttribute('stop-opacity', '0.0');

  return gradId;
}

function formatTime(bp) {
  const roundedBp = Math.max(0, Math.round(bp));
  return roundedBp === 0 ? "现代" : `距今 ${roundedBp} 年`;
}

function getTreeBranchAnnotation(branchId) {
  const directSamples = data.samples.filter((sample) => sample.branchSegments?.at(-1) === branchId);
  const familyLabels = [];
  const tribeLabels = [];

  directSamples.forEach((sample) => {
    if (sample.family && !familyLabels.includes(sample.family)) {
      familyLabels.push(sample.family);
    }
    if (sample.tribe && !tribeLabels.includes(sample.tribe)) {
      tribeLabels.push(sample.tribe);
    }
  });

  const annotation = familyLabels.length ? familyLabels.join('/') : tribeLabels.join('/');
  if (annotation === '克烈部/克烈部阿巴克部') {
    return '克烈-阿巴克部';
  }
  return annotation;
}

function hexToHSL(hex) {
  const r = Number.parseInt(hex.slice(1, 3), 16) / 255;
  const g = Number.parseInt(hex.slice(3, 5), 16) / 255;
  const b = Number.parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }
  return { h: h * 360, s: s * 100, l: l * 100 };
}

function hslToRgb(h, s, l) {
  h = h / 360;
  s = s / 100;
  l = l / 100;
  let r, g, b;
  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }
  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255),
  };
}

function adjustSaturation(hex, saturation) {
  const hsl = hexToHSL(hex);
  hsl.s = saturation;
  const rgb = hslToRgb(hsl.h, hsl.s, hsl.l);
  return `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
}

function splitHaplogroupPath(haplogroup) {
  return String(haplogroup || "")
    .split("-")
    .map((segment) => segment.trim())
    .filter(Boolean);
}

function getCompressedCommonPrefix() {
  const rootBranch = data.meta.branch;
  const upstreamPaths = data.samples
    .map((sample) => splitHaplogroupPath(sample.haplogroup))
    .map((segments) => {
      const rootIndex = segments.indexOf(rootBranch);
      return rootIndex > 0 ? segments.slice(0, rootIndex) : null;
    })
    .filter(Boolean);

  if (!upstreamPaths.length) {
    return [];
  }

  const shared = [];
  const shortestLength = Math.min(...upstreamPaths.map((segments) => segments.length));
  for (let index = 0; index < shortestLength; index += 1) {
    const token = upstreamPaths[0][index];
    if (upstreamPaths.every((segments) => segments[index] === token)) {
      shared.push(token);
      continue;
    }
    break;
  }

  return shared.map((token) => `${token.charAt(0)}…`);
}

function getBranchLineageSegments(branch) {
  const lineage = [];
  let current = branch;

  while (current) {
    lineage.unshift(current.id);
    current = current.parentId ? branchMap.get(current.parentId) : null;
  }

  return lineage;
}

function formatBranchLegendLabel(branch, sharedPrefixLength = 0) {
  // 获取完整token列表：简化前缀(只取第一个) + 分支系谱链
  const simplifiedPrefix = compressedCommonPrefix.length > 0 ? [compressedCommonPrefix[0]] : [];
  const lineageTokens = getBranchLineageSegments(branch);
  const tokens = [...simplifiedPrefix, ...lineageTokens];
  
  // 使用sharedPrefixLength来确定哪些前缀可以隐藏
  const prefixTokens = tokens.slice(0, sharedPrefixLength);
  let uniqueTokens = tokens.slice(sharedPrefixLength);
  
  if (!uniqueTokens.length && tokens.length) {
    uniqueTokens = [tokens[tokens.length - 1]];
  }
  
  return {
    prefix: prefixTokens.join("/"),
    unique: uniqueTokens.join("/"),
    full: tokens.join("/"),
  };
}

function buildAnimatedPolygon(branch, progress) {
  const rawPoints = getBranchMapPolygon(branch);

  if (!rawPoints || rawPoints.length < 3) {
    return "";
  }

  // 将多边形坐标转换为平滑椭圆点集，使形状为椭圆
  const targetPoints = polygonToEllipsePoints(rawPoints);

  return targetPoints
    .map(([lon, lat], index) => {
      const command = index === 0 ? "M" : "L";
      return `${command} ${lonToX(lon).toFixed(2)} ${latToY(lat).toFixed(2)}`;
    })
    .join(" ") + " Z";
}

function getBranchLegendTokens(branch) {
  return [...compressedCommonPrefix, ...getBranchLineageSegments(branch)];
}

function getSharedPrefixLength(tokenLists) {
  if (!tokenLists.length) {
    return 0;
  }

  const minLength = Math.min(...tokenLists.map((tokens) => tokens.length));
  let sharedLength = 0;
  for (let i = 0; i < minLength; i += 1) {
    const token = tokenLists[0][i];
    if (tokenLists.every((tokens) => tokens[i] === token)) {
      sharedLength += 1;
      continue;
    }
    break;
  }

  return sharedLength;
}

function getOriginCenter(branch) {
  const originId = branch.mapOriginId || branch.parentId;
  if (originId) {
    const originBranchEntity = getMapBranchEntity(originId);
    if (originBranchEntity) {
      return getBranchMapCenter(originBranchEntity);
    }
  }
  const root = getMapBranchEntity(data.meta.branch);
  return root ? getBranchMapCenter(root) : getBranchMapCenter(branch);
}

// ── 持久红色流水线管理 ────────────────────────────────────────────────────
// 每个分支从起源中心到目的地有一条持久的红色流水线（CSS动画虚线，不随帧清除）
function updateFlowLines(visibleBranches, bp) {
  // 清理时间回退时不再可见的分支
  const visibleIds = new Set(visibleBranches.map(b => b.id));
  for (const [id, els] of flowElements.entries()) {
    if (!visibleIds.has(id)) {
      els.group.remove();
      flowElements.delete(id);
    }
  }

  const defs = svg.querySelector('defs');

  visibleBranches.forEach(branch => {
    const age = Math.max(getMapActivationAge(branch), 1);
    const progress = clamp((age - bp) / age, 0.08, 1);
    const tProgress = clamp((age - bp) / age, 0, 1);
    const fadeIn = clamp(tProgress / 0.20, 0, 1);

    const originPt = getOriginCenter(branch);
    if (!originPt) return;
    const ox = lonToX(originPt[1]);
    const oy = latToY(originPt[0]);

    // 计算目的地中心
    const rawPts = getBranchMapPolygon(branch);
    const destLon = rawPts.reduce((s, p) => s + p[0], 0) / rawPts.length;
    const destLat = rawPts.reduce((s, p) => s + p[1], 0) / rawPts.length;
    const finalX = lonToX(destLon);
    const finalY = latToY(destLat);
    const dx = finalX - ox;
    const dy = finalY - oy;
    const lineDist = Math.sqrt(dx * dx + dy * dy);
    if (lineDist < 8) return;

    // 当前流水前锋坐标（随 progress 从起源延伸到目的地）
    const tx = ox + dx * progress;
    const ty = oy + dy * progress;

    const safeId = branch.id.replace(/[^a-zA-Z0-9]/g, '_');
    const gradId = `flowGrad_${safeId}`;

    if (!flowElements.has(branch.id)) {
      // 首次：创建渐变 + 三层线元素
      let grad = document.getElementById(gradId);
      if (!grad) {
        grad = document.createElementNS(SVG_NS, 'linearGradient');
        grad.setAttribute('id', gradId);
        grad.setAttribute('gradientUnits', 'userSpaceOnUse');
        for (let i = 0; i < 3; i++) grad.appendChild(document.createElementNS(SVG_NS, 'stop'));
        defs.appendChild(grad);
      }

      const group = document.createElementNS(SVG_NS, 'g');

      // 第1层：宽发光底层（模糊，无虚线）
      const glowLine = document.createElementNS(SVG_NS, 'line');
      glowLine.setAttribute('stroke-linecap', 'round');
      glowLine.setAttribute('stroke-width', '5');
      glowLine.setAttribute('filter', 'url(#branchFuzzyEdge)');
      group.appendChild(glowLine);

      // 第2层：主流水虚线（CSS动画，10px dash / 6px gap）
      const midLine = document.createElementNS(SVG_NS, 'line');
      midLine.setAttribute('stroke-linecap', 'round');
      midLine.setAttribute('stroke-width', '2.2');
      midLine.setAttribute('stroke-dasharray', '10 6');
      midLine.setAttribute('class', 'flow-water-anim');
      group.appendChild(midLine);

      // 第3层：亮中心线（更快动画，6px dash / 8px gap）
      const brightLine = document.createElementNS(SVG_NS, 'line');
      brightLine.setAttribute('stroke-linecap', 'round');
      brightLine.setAttribute('stroke-width', '1.0');
      brightLine.setAttribute('stroke-dasharray', '6 8');
      brightLine.setAttribute('class', 'flow-water-anim-fast');
      group.appendChild(brightLine);

      flowLayer.appendChild(group);
      flowElements.set(branch.id, { group, glowLine, midLine, brightLine, grad });
    }

    const els = flowElements.get(branch.id);
    const { glowLine, midLine, brightLine, grad } = els;

    // 更新渐变（起点透明→末端鲜红）
    grad.setAttribute('x1', ox); grad.setAttribute('y1', oy);
    grad.setAttribute('x2', tx); grad.setAttribute('y2', ty);
    const stops = grad.querySelectorAll('stop');
    stops[0].setAttribute('offset', '0%');
    stops[0].setAttribute('stop-color', 'rgb(180,10,10)');
    stops[0].setAttribute('stop-opacity', '0.0');
    stops[1].setAttribute('offset', '45%');
    stops[1].setAttribute('stop-color', 'rgb(220,30,30)');
    stops[1].setAttribute('stop-opacity', `${(fadeIn * 0.55).toFixed(3)}`);
    stops[2].setAttribute('offset', '100%');
    stops[2].setAttribute('stop-color', 'rgb(255,80,80)');
    stops[2].setAttribute('stop-opacity', `${(fadeIn * 0.90).toFixed(3)}`);

    // 更新三层线段端点
    [glowLine, midLine, brightLine].forEach(line => {
      line.setAttribute('x1', ox); line.setAttribute('y1', oy);
      line.setAttribute('x2', tx); line.setAttribute('y2', ty);
    });

    glowLine.setAttribute('stroke', `url(#${gradId})`);
    midLine.setAttribute('stroke', `url(#${gradId})`);
    brightLine.setAttribute('stroke', `rgba(255,160,160,${(fadeIn * 0.65).toFixed(3)})`);
  });
}

function buildFallbackPolygon(branch) {  const [lat, lon] = branch.center;
  const radius = branch.radius || 2.4;
  // 生成32点椭圆（宽:高 ≈ 1.8:1，符合地理区域的横向展开特征）
  const rx = radius;
  const ry = radius * 0.55;
  return Array.from({ length: 32 }, (_, i) => {
    const angle = (2 * Math.PI * i) / 32;
    return [lon + rx * Math.cos(angle), lat + ry * Math.sin(angle)];
  });
}

/**
 * 将任意多边形点集转换为平滑椭圆点集。
 * 计算多边形的质心和各轴最大半径，生成 numPoints 个均匀分布的椭圆点。
 */
function polygonToEllipsePoints(points, numPoints = 32) {
  const cx = points.reduce((s, p) => s + p[0], 0) / points.length;
  const cy = points.reduce((s, p) => s + p[1], 0) / points.length;
  const rx = Math.max(...points.map(p => Math.abs(p[0] - cx))) * 1.05;
  const ry = Math.max(...points.map(p => Math.abs(p[1] - cy))) * 1.05;
  return Array.from({ length: numPoints }, (_, i) => {
    const angle = (2 * Math.PI * i) / numPoints;
    return [cx + rx * Math.cos(angle), cy + ry * Math.sin(angle)];
  });
}

function getActiveBranches(bp) {
  return data.branches.filter((branch) => branch.age >= bp);
}

function getVisibleModernSamples(bp) {
  if (bp > 0) {
    return [];
  }
  return data.samples.filter((sample) => !sample.isAncient && sample.lat !== null && sample.lon !== null);
}

function render() {
  const bp = getBpAtTimelinePosition(currentTimelinePosition);
  const modernSamples = getVisibleModernSamples(bp);
  const visibleBranchesForRender = getVisibleMapBranches(bp);

  currentTimeLabel.textContent = formatTime(bp);
  currentModeLabel.textContent = bp === 0 ? "现代样本点状态" : "古代扩散阶段";
  tickLabel.textContent = `第 ${Math.max(1, Math.min(timeline.length, Math.round(currentTimelinePosition) + 1))} 格 / ${timeline.length} 格`;
  updateCurrentTimelineMarker(bp);

  pointLayer.textContent = "";
  flowLayer.textContent = "";
  trailLayer.textContent = "";
  branchLabelLayer.textContent = "";
  regionOverlayLayer.textContent = "";
  flowElements.clear();
  trailHistory.clear();
  renderSpreadImages(bp);


  modernSamples.forEach((sample) => {
    const circle = document.createElementNS(SVG_NS, "circle");
    circle.setAttribute("class", "modern-point");
    circle.setAttribute("cx", lonToX(sample.lon));
    circle.setAttribute("cy", latToY(sample.lat));
    circle.setAttribute("r", 2.2);
    
    // 获取样本所属支系的颜色
    const terminalBranchId = sample.branchSegments?.at(-1) || "Y4569";
    const branchData = branchMap.get(terminalBranchId);
    const pointColor = branchData ? branchData.color : "#1f2937"; // 如果找不到支系，使用默认深灰色
    
    // 改为支系色半透填充，去掉描边，加呼吸动画
    const hexMatch = pointColor.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
    if (hexMatch) {
      const r = parseInt(hexMatch[1], 16);
      const g = parseInt(hexMatch[2], 16);
      const b = parseInt(hexMatch[3], 16);
      // 降低饱和度和透明度，使颜色更柔和
      const desaturation = 0.7; // 保留70%饱和度，降低30%
      const r_adjusted = Math.round(r * desaturation + 128 * (1 - desaturation));
      const g_adjusted = Math.round(g * desaturation + 128 * (1 - desaturation));
      const b_adjusted = Math.round(b * desaturation + 128 * (1 - desaturation));
      const semiTransparent = `rgba(${r_adjusted}, ${g_adjusted}, ${b_adjusted}, 0.55)`;
      circle.setAttribute("fill", semiTransparent);
    } else {
      circle.setAttribute("fill", pointColor);
    }
    circle.setAttribute("stroke", "none");
    circle.style.animation = "pointBreathe 2.5s ease-in-out infinite";
    circle.setAttribute("filter", "url(#pointGlow)");
    // 添加数据属性以供交互使用
    circle.setAttribute("data-sample-id", sample.id);
    circle.setAttribute("data-sample-ethnicity", sample.ethnicity || "未注明");
    circle.setAttribute("data-sample-location", sample.location || "未注明");
    circle.setAttribute("data-sample-tribe", sample.tribe || "未注明");
    circle.setAttribute("data-sample-branch", sample.branchSegments?.at(-1) || "Y4569");
    circle.setAttribute("data-sample-distribution", sample.distribution || "未注明");
    
    // 点击显示弹窗（支持触控屏）
    circle.addEventListener("click", (event) => {
      event.stopPropagation();
      const x = event.clientX;
      const y = event.clientY;
      
      tooltip.innerHTML = `
        <div><strong>${sample.id}</strong></div>
        <div>${sample.ethnicity || "未注明"}</div>
        <div style="margin-top:6px; border-top:1px solid rgba(255,255,255,0.2); padding-top:6px;">
          <div>地点：${sample.location || "未注明"}</div>
          ${sample.family ? `<div>家族：${sample.family}</div>` : ''}
          <div>部族：${sample.tribe || "未注明"}</div>
          <div>末端支系：${sample.branchSegments?.at(-1) || "Y4569"}</div>
          <div>分布：${sample.distribution || "未注明"}</div>
        </div>
      `;
      // 计算安全位置，防止超出屏幕
      tooltip.style.display = "block";
      const tw = tooltip.offsetWidth;
      const th = tooltip.offsetHeight;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      let lx = x + 14;
      let ly = y + 14;
      if (lx + tw > vw - 8) lx = x - tw - 14;
      if (ly + th > vh - 8) ly = y - th - 14;
      tooltip.style.left = lx + "px";
      tooltip.style.top = ly + "px";
    });
    
    pointLayer.appendChild(circle);
  });

  renderLegend(visibleBranchesForRender, bp);
  renderSamples(modernSamples, bp);

  // 初始化并渲染谱系树
  if (!treeState.initialized) {
    initGenealogyTree();
  }
  if (treeState.initialized) {
    renderGenealogyTree(bp);
  }
}

function renderLegend(activeBranches, bp) {
  if (!activeBranches.length) {
    branchLegend.innerHTML = '<div class="empty-state">当前时间点尚未进入 Y4569 的形成阶段。</div>';
    return;
  }

  const visibleBranches = activeBranches;
  
  // 获取全局共享前缀（如C…）
  const sharedPrefixDisplay = compressedCommonPrefix.length > 0 ? compressedCommonPrefix[0] : '';
  
  // 构建树形结构
  const visibleIds = new Set(visibleBranches.map(b => b.id));
  const childrenByParent = new Map();
  const rootBranches = [];
  
  visibleBranches.forEach((branch) => {
    const parentId = branch.parentId;
    
    // 如果parent不在visible中，当作根节点
    if (!parentId || !visibleIds.has(parentId)) {
      rootBranches.push(branch);
    } else {
      if (!childrenByParent.has(parentId)) {
        childrenByParent.set(parentId, []);
      }
      childrenByParent.get(parentId).push(branch);
    }
  });
  
  // 获取分支的完整路径
  function getBranchFullPath(branch) {
    const lineage = [];
    let current = branch;
    while (current) {
      lineage.unshift(current.id);
      current = current.parentId ? visibleBranches.find(b => b.id === current.parentId) : null;
    }
    return lineage;
  }
  
  // 递归生成树形HTML
  function buildTreeHTML(branch) {
    const children = childrenByParent.get(branch.id) || [];
    
    // 获取从根到当前分支的路径
    const pathTokens = getBranchFullPath(branch);
    const displayPath = sharedPrefixDisplay ? [sharedPrefixDisplay, ...pathTokens].join('/') : pathTokens.join('/');
    
    const branchHtml = `
      <article class="branch-item">
        <header>
          <strong title="${displayPath}"><span class="swatch" style="background:${branch.color}"></span>${displayPath}</strong>
          <span>${formatTime(branch.age)}</span>
        </header>
        <div class="meta-row">分布区：${branch.distribution || "按样本坐标估算"}</div>
      </article>
    `;
    
    const childrenHtml = children
      .map((child) => buildTreeHTML(child))
      .join('');
    
    return branchHtml + childrenHtml;
  };
  
  const treeHtml = rootBranches
    .map((branch) => buildTreeHTML(branch))
    .join('');
  
  branchLegend.innerHTML = `
    <section class="branch-group">
      ${treeHtml}
    </section>
  `;
}

function renderSamples(modernSamples, bp) {
  // 仅在现代时刻显示样本列表
  if (bp !== 0) {
    // 非现代时刻：不显示内容
    sampleList.innerHTML = '';
    return;
  }

  // 现代时刻：显示样本列表
  sampleList.innerHTML = modernSamples
      .sort((left, right) => left.tmrca - right.tmrca)
      .map((sample) => {
        const branch = resolveClosestBranch(sample);
        return `
          <article class="sample-item">
            <header>
              <strong>${branch}</strong>
              <span>${sample.ethnicity || "未注明"}</span>
            </header>
            <div class="meta-row">地点：${sample.location || "未注明"}</div>
            <div class="meta-row">部族：${sample.tribe || "未注明"}</div>
            <div class="meta-row">末端支系：${branch}</div>
            <div class="meta-row">末端单倍群分布：${sample.distribution || "未注明"}</div>
          </article>
        `;
      })
      .join("");
}

function resolveClosestBranch(sample) {
  const segments = sample.branchSegments || [];
  return segments.length ? segments[segments.length - 1] : data.meta.branch;
}

// ══════════════════════════════════════════════════════════════════════════════
// 谱系树 (Genealogy Tree) — ECharts 渲染（参照全息深空星图版效果）
// ══════════════════════════════════════════════════════════════════════════════

// 颜色常量（与样例一致）
const TC = {
  primary: '#2979FF',
  rootBg: '#0F172A',
  nodeBorder: '#334155',
  textMuted: '#94A3B8',
  dimmedLine: '#233043',
  glowShadow: 'rgba(0, 225, 253, 0.6)',
  glowStart: '#00E1FD',
  glowEnd: '#2979FF',
};

function treeInterpolateColor(c1, c2, f) {
  if (f < 0) f = 0; if (f > 1) f = 1;
  const r1 = parseInt(c1.slice(1,3),16), g1 = parseInt(c1.slice(3,5),16), b1 = parseInt(c1.slice(5,7),16);
  const r2 = parseInt(c2.slice(1,3),16), g2 = parseInt(c2.slice(3,5),16), b2 = parseInt(c2.slice(5,7),16);
  return `rgb(${Math.round(r1+(r2-r1)*f)},${Math.round(g1+(g2-g1)*f)},${Math.round(b1+(b2-b1)*f)})`;
}

// 树节点颜色亮度保障：确保暗色在深色背景上可见
function brightenTreeColor(hex) {
  const m = hex.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
  if (!m) return hex;
  const r = parseInt(m[1], 16), g = parseInt(m[2], 16), b = parseInt(m[3], 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  if (lum >= 0.38) return hex;
  const factor = 0.38 / Math.max(lum, 0.01);
  const nr = Math.min(255, Math.round(r * factor));
  const ng = Math.min(255, Math.round(g * factor));
  const nb = Math.min(255, Math.round(b * factor));
  return `#${nr.toString(16).padStart(2,'0')}${ng.toString(16).padStart(2,'0')}${nb.toString(16).padStart(2,'0')}`;
}

function treeSegmentGradient(s, e) {
  return { type:'linear', x:0, y:0, x2:1, y2:0, colorStops:[
    { offset:0, color: treeInterpolateColor(TC.glowStart, TC.glowEnd, s) },
    { offset:1, color: treeInterpolateColor(TC.glowStart, TC.glowEnd, e) },
  ]};
}

const TREE_DEFAULT_LINE = { type:'linear', x:0, y:0, x2:1, y2:0, colorStops:[
  { offset:0, color:'#3B4D6B' }, { offset:1, color:'#475A77' },
]};

// 构建扁平的分支-样本树结构，供谱系树使用
let _treeNodeMap = null; // { id -> node }
let _treeParentMap = null; // { id -> parentId }

function initTreeMaps() {
  if (_treeNodeMap) return;
  _treeNodeMap = {};
  _treeParentMap = {};

  const childrenOf = new Map();
  TREE_BRANCHES.forEach(b => {
    if (b.parentId) {
      if (!childrenOf.has(b.parentId)) childrenOf.set(b.parentId, []);
      childrenOf.get(b.parentId).push(b.id);
    }
  });

  TREE_BRANCHES.forEach(b => {
    _treeNodeMap[b.id] = { id: b.id, name: b.id, type: 'branch', age: b.age, color: b.color, children: [] };
    _treeParentMap[b.id] = b.parentId || null;
  });

  // 将现代样本挂到终端分支
  data.samples.filter(s => !s.isAncient && s.lat != null).forEach(s => {
    const tid = s.branchSegments?.at(-1) || data.meta.branch;
    const sampleId = `sample_${s.id}`;
    _treeNodeMap[sampleId] = { id: sampleId, name: s.id, type: 'sample', sampleData: s, age: 0, color: _treeNodeMap[tid]?.color || '#4a9eff' };
    _treeParentMap[sampleId] = tid;
    if (_treeNodeMap[tid]) _treeNodeMap[tid].children.push(sampleId);
  });

  TREE_BRANCHES.forEach(b => {
    const children = childrenOf.get(b.id) || [];
    _treeNodeMap[b.id].children.unshift(...children);
  });
}

function calcTreeTextWidth(text) {
  let w = 0;
  for (let i = 0; i < text.length; i++) w += text.charCodeAt(i) > 255 ? 13 : 7.5;
  return Math.max(w + 24, 40);
}

// 根据 bp 和 highlighted id 构建 ECharts tree data
// showSamples: 是否显示末端样本节点（默认始终显示）
function buildTreeOptionData(bp, highlightId, showSamples) {
  initTreeMaps();

  const ancestors = new Set();
  const descendants = new Set();
  const activePath = [];

  if (highlightId) {
    let curr = highlightId;
    while (curr) { ancestors.add(curr); activePath.unshift(curr); curr = _treeParentMap[curr]; }
    const addDesc = (id) => {
      descendants.add(id);
      (_treeNodeMap[id]?.children || []).forEach(addDesc);
    };
    addDesc(highlightId);
  }

  const N = Math.max(1, activePath.length - 1);

  function buildNode(id, depth) {
    const node = _treeNodeMap[id];
    if (!node) return null;

    const isBranch = node.type === 'branch';
    const isSample = node.type === 'sample';
    const isActive = node.age >= bp || (isSample && bp === 0);

    if (!isActive) return null; // 时间线之前不存在的节点不显示

    const isTarget = (id === highlightId);
    const isAnc = ancestors.has(id) && !isTarget;
    const isDesc = descendants.has(id) && !isTarget;
    const isUnrelated = !!(highlightId && !ancestors.has(id) && !descendants.has(id));
    const activeIndex = activePath.indexOf(id);

    let lineColor = TREE_DEFAULT_LINE;
    let lineWidth = 1.5;
    let lineShadow = 0;

    if (activeIndex > 0) {
      lineColor = treeSegmentGradient((activeIndex-1)/N, activeIndex/N);
      lineWidth = 2.5;
      lineShadow = 12;
    } else if (isUnrelated) {
      lineColor = TC.dimmedLine;
      lineWidth = 1.2;
    }

    const nodeLabel = isBranch ? id : node.name;
    const familyLabel = '';
    const displayLabel = nodeLabel + familyLabel;
    const tw = calcTreeTextWidth(nodeLabel);
    const NODE_R = 6;

    let symbol, symbolSize, symbolOffset = [0, 0], itemStyle, labelStyle;

    if (isTarget) {
      // 保持圆形避免布局变化，仅加强发光和颜色
      symbol = 'circle'; symbolSize = NODE_R * 2.5; symbolOffset = [0, 0];
      itemStyle = { color: TC.primary, shadowColor: TC.glowShadow, shadowBlur: 20, borderColor: '#fff', borderWidth: 2 };
      labelStyle = { show:true, position:'left', distance:4, color: TC.primary, fontSize:11, fontWeight:'700', formatter: displayLabel, backgroundColor:'transparent', borderWidth:0, padding:0 };
    } else if (isAnc) {
      // 祖先节点：圆形，青色边框发光
      symbol = 'circle'; symbolSize = NODE_R * 2; symbolOffset = [0, 0];
      itemStyle = { color:'#0F172A', borderColor:'#00E1FD', borderWidth:2, shadowColor:'rgba(0,225,253,0.5)', shadowBlur:12 };
      labelStyle = { show:true, position:'left', distance:4, color:'#E2E8F0', fontSize:10, fontWeight:'500', formatter: displayLabel, backgroundColor:'transparent', borderWidth:0, padding:0 };
    } else if (isActive && !highlightId) {
      const branchColor = node.color || (isSample ? '#00E1FD' : '#4a9eff');
      const visibleColor = isBranch ? brightenTreeColor(branchColor) : branchColor;
      if (isBranch && depth <= 1) {
        // 根节点和第一层子节点：圆角矩形，深色实心背景，文字内置
        // 实心背景会遮住穿过矩形的连线，视觉上线从边框发出
        symbol = 'roundRect'; symbolSize = [tw + 8, 32]; symbolOffset = [0, 0];
        itemStyle = { color: '#0a1628', borderColor: visibleColor, borderWidth: 2.5, borderRadius: 14, shadowColor: visibleColor + 'aa', shadowBlur: 18 };
        labelStyle = { show: true, position: 'inside', color: visibleColor, fontSize: 12, fontWeight: '700', formatter: displayLabel, backgroundColor: 'transparent', borderWidth: 0 };
      } else if (isSample) {
        // 样本节点：标签放下方，去除 HHT 前缀显示简短编号
        const shortLabel = nodeLabel.startsWith('HHT') ? nodeLabel.slice(3) : nodeLabel;
        symbol = 'circle'; symbolSize = NODE_R * 2;
        itemStyle = { color: visibleColor + 'cc', borderColor: visibleColor, borderWidth: 2, shadowColor: visibleColor + '66', shadowBlur: 4 };
        labelStyle = { show: true, position: 'bottom', distance: 2, color: visibleColor, fontSize: 7, formatter: shortLabel, backgroundColor:'transparent', borderWidth:0, padding:0 };
      } else {
        // depth>=2 分支节点：标签放顶部，避免向父节点方向延伸产生遮挡
        symbol = 'circle'; symbolSize = NODE_R * 2;
        itemStyle = { color: visibleColor + 'cc', borderColor: visibleColor, borderWidth: 2, shadowColor: visibleColor + '66', shadowBlur: 4 };
        const labelPos = depth === 2 ? 'top' : 'left';
        const labelDist = depth === 2 ? 2 : 4;
        labelStyle = { show: true, position: labelPos, distance: labelDist, color: visibleColor, fontSize: 9, formatter: displayLabel, backgroundColor:'transparent', borderWidth:0, padding:0 };
      }
    } else if (isSample && isDesc) {
      symbol = 'circle'; symbolSize = NODE_R * 2;
      itemStyle = { color:'#0A0F1C', borderColor:'#00E1FD', borderWidth:2 };
      const shortLabelDesc = nodeLabel.startsWith('HHT') ? nodeLabel.slice(3) : nodeLabel;
      labelStyle = { show: true, position:'bottom', distance: 2, color:'#94A3B8', fontSize: 7, formatter: shortLabelDesc, backgroundColor:'transparent', borderWidth:0, padding:0 };
    } else {
      symbol = 'circle'; symbolSize = NODE_R * 2;
      const bColor = isUnrelated ? (node.color || '#475A77') : brightenTreeColor(node.color || '#475A77');
      itemStyle = { color:'#0A0F1C', borderColor: isUnrelated ? TC.nodeBorder : bColor, borderWidth: isUnrelated ? 1.5 : 2 };
      const labelPos = isSample ? 'bottom' : 'left';
      const labelFont = isSample ? 7 : 9;
      const labelFmt = (isSample && nodeLabel.startsWith('HHT')) ? nodeLabel.slice(3) : nodeLabel;
      labelStyle = { show: true, position: labelPos, distance: isSample ? 2 : 4, color: isUnrelated ? '#3B4D6B' : bColor, fontSize: labelFont, formatter: labelFmt, backgroundColor:'transparent', borderWidth:0, padding:0 };
    }

    const children = (node.children || []).map(cid => buildNode(cid, depth + 1)).filter(Boolean);

    return {
      id,
      name: nodeLabel,
      _raw: node,
      symbol, symbolSize, symbolOffset,
      itemStyle,
      label: labelStyle,
      lineStyle: { color: lineColor, width: lineWidth, shadowColor: lineShadow ? TC.glowShadow : 'transparent', shadowBlur: lineShadow },
      children,
    };
  }

  const roots = data.branches.filter(b => !b.parentId);
  return roots.map(r => buildNode(r.id, 0)).filter(Boolean);
}

let currentTreeHighlight = null;
let currentTreeBp = 0;
let currentTreeStageKey = '';
let currentMapHighlightBranches = null; // Set of branchIds to highlight on map (null = all)

// 根据点击的树节点计算地图上应高亮的分支集合（该节点所在分支+所有祖先分支+子孙分支）
function calcMapHighlightBranches(treeNodeId) {
  if (!treeNodeId || !_treeNodeMap || !_treeParentMap) return null;
  const result = new Set();
  // 找到对应的 branchId（如果是 sample_xxx，取其父分支）
  let rootId = treeNodeId;
  if (treeNodeId.startsWith('sample_')) rootId = _treeParentMap[treeNodeId] || null;
  if (!rootId) return null;

  // 添加祖先路径
  let curr = rootId;
  while (curr) { result.add(curr); curr = _treeParentMap[curr]; }
  // 添加子孙分支
  const addDesc = (id) => {
    if (_treeNodeMap[id]?.type === 'branch') result.add(id);
    (_treeNodeMap[id]?.children || []).forEach(addDesc);
  };
  addDesc(rootId);
  return result;
}

// ════════════════════════════════════════════════════════════════════════════
// SVG 时间轴谱系树 — 桑基图风格，节点按时间横轴对齐
// ════════════════════════════════════════════════════════════════════════════
const SVG_RULER_H = 58;
const SVG_TREE_PAD_T = 22;
const SVG_TREE_PAD_B = 22;
const SVG_TREE_PAD_L = 56;
const SVG_TREE_PAD_R = 48;
const SK_W_BRANCH = 9;
const SK_W_SAMPLE = 4;

let _svgInited = false;
let _svgEl = null;
let _svgRuler = null;
let _svgG = null;
let _svgDefs = null;
let _svgCurrentBpLine = null;
let _svgPanX = 0, _svgPanY = 0, _svgScale = 1;
let _svgGradSeq = 0;
let _svgViewportW = 0, _svgViewportH = 0;
let _svgContentW = 0, _svgContentH = 0;

function getTreeRenderStage(bp) {
  const visibleBranchIds = [];
  TREE_BRANCHES.forEach((branch) => {
    if (branch.age >= bp) {
      visibleBranchIds.push(branch.id);
    }
  });
  const preOriginGhostRootVisible = !!(originBranch?.id && bp > originAge);
  return {
    preOriginGhostRootVisible,
    visibleBranchIds,
    key: `${preOriginGhostRootVisible ? 1 : 0}|${visibleBranchIds.join('|')}`,
  };
}

function updateTreeCurrentBpMarker(bp) {
  currentTreeBp = bp;
  if (!_svgCurrentBpLine) {
    return;
  }
  const currentX = SVG_TREE_PAD_L + ageToTimelineFrac(bp) * _svgContentW;
  _svgCurrentBpLine.setAttribute('x1', String(currentX));
  _svgCurrentBpLine.setAttribute('y1', '0');
  _svgCurrentBpLine.setAttribute('x2', String(currentX));
  _svgCurrentBpLine.setAttribute('y2', String(_svgViewportH + 100));
}

function ageToTimelineFrac(age) {
  if (age >= timeline[0]) return 0;
  if (age <= 0) return 1;
  if (!originBranch) {
    return 1 - (age / Math.max(timeline[0], 1));
  }

  if (age >= originAge) {
    const preOriginSpan = Math.max(timeline[0] - originAge, 1);
    return ((timeline[0] - age) / preOriginSpan) * TREE_PRE_ORIGIN_SHARE;
  }

  return TREE_PRE_ORIGIN_SHARE + ((originAge - age) / Math.max(originAge, 1)) * (1 - TREE_PRE_ORIGIN_SHARE);
}

function computeSvgYLayout(vis, height, useVisibleBranchesOnly = false) {
  const children = new Map();
  const hasParent = new Set();
  const branchIds = useVisibleBranchesOnly
    ? Array.from(vis).filter((id) => _treeNodeMap[id]?.type === 'branch')
    : data.branches.map(branch => branch.id);
  branchIds.forEach(id => {
    const pid = _treeParentMap[id];
    if (pid && branchIds.includes(pid)) {
      hasParent.add(id);
      if (!children.has(pid)) children.set(pid, []);
      children.get(pid).push(id);
    }
  });
  const roots = branchIds.filter(id => !hasParent.has(id));
  children.forEach(kids => {
    kids.sort((a, b) => (_treeNodeMap[b]?.age || 0) - (_treeNodeMap[a]?.age || 0));
  });
  const leafOf = new Map();
  function countLeaves(id) {
    const kids = children.get(id) || [];
    if (!kids.length) { leafOf.set(id, 1); return 1; }
    const s = kids.reduce((acc, k) => acc + countLeaves(k), 0);
    leafOf.set(id, s); return s;
  }
  roots.forEach(countLeaves);
  const totalLeaves = roots.reduce((s, r) => s + (leafOf.get(r) || 1), 0);
  const slot = (height - 16) / Math.max(totalLeaves, 1);
  const yMap = new Map();
  let cursor = 0;
  function assignY(id) {
    const kids = children.get(id);
    if (!kids || !kids.length) { yMap.set(id, 8 + (cursor + 0.5) * slot); cursor++; return; }
    kids.forEach(assignY);
    const ys = kids.map(k => yMap.get(k) || 0);
    yMap.set(id, (ys[0] + ys[ys.length - 1]) / 2);
  }
  roots.forEach(assignY);

  const samplesByParent = new Map();
  vis.forEach(id => {
    if (_treeNodeMap[id]?.type !== 'sample') return;
    const pid = _treeParentMap[id];
    if (!samplesByParent.has(pid)) samplesByParent.set(pid, []);
    samplesByParent.get(pid).push(id);
  });
  samplesByParent.forEach((samples, pid) => {
    const py = yMap.get(pid) ?? height / 2;
    const spread = Math.min(Math.max(slot * 0.72, 12), 36);
    samples.forEach((sid, idx) => {
      const offset = samples.length > 1 ? (idx / (samples.length - 1) - 0.5) * spread : 0;
      yMap.set(sid, py + offset);
    });
  });
  return yMap;
}

function sankeyPathHorizontal(px, py, cx, cy, wStart, wEnd) {
  const hh1 = wStart / 2;
  const hh2 = wEnd / 2;
  const dx = cx - px;
  const curveFactor = Math.abs(cy - py) > Math.abs(dx) * 0.75 ? 0.3 : 0.45;
  const c1x = px + dx * curveFactor;
  const c2x = cx - dx * curveFactor;
  return `M${px.toFixed(1)},${(py - hh1).toFixed(1)} ` +
    `C${c1x.toFixed(1)},${(py - hh1).toFixed(1)} ${c2x.toFixed(1)},${(cy - hh2).toFixed(1)} ${cx.toFixed(1)},${(cy - hh2).toFixed(1)} ` +
    `L${cx.toFixed(1)},${(cy + hh2).toFixed(1)} ` +
    `C${c2x.toFixed(1)},${(cy + hh2).toFixed(1)} ${c1x.toFixed(1)},${(py + hh1).toFixed(1)} ${px.toFixed(1)},${(py + hh1).toFixed(1)} Z`;
}

function sankeyCenterlineHorizontal(px, py, cx, cy) {
  const dx = cx - px;
  const curveFactor = Math.abs(cy - py) > Math.abs(dx) * 0.75 ? 0.3 : 0.45;
  const c1x = px + dx * curveFactor;
  const c2x = cx - dx * curveFactor;
  return `M${px.toFixed(1)},${py.toFixed(1)} ` +
    `C${c1x.toFixed(1)},${py.toFixed(1)} ${c2x.toFixed(1)},${cy.toFixed(1)} ${cx.toFixed(1)},${cy.toFixed(1)}`;
}

function ensureGradient(defs, id, c1, c2, x1, x2) {
  let el = defs.querySelector('#' + id);
  if (!el) {
    el = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
    el.setAttribute('id', id);
    el.setAttribute('gradientUnits', 'userSpaceOnUse');
    defs.appendChild(el);
  }
  el.setAttribute('x1', String(x1));
  el.setAttribute('x2', String(x2));
  el.setAttribute('y1', '0');
  el.setAttribute('y2', '0');
  el.innerHTML = `<stop offset="0%" stop-color="${c1}" stop-opacity="0.88"/>` +
                 `<stop offset="100%" stop-color="${c2}" stop-opacity="0.88"/>`;
  return `url(#${id})`;
}

function getTreeAxisTicks() {
  const ticks = [timeline[0]];
  if (originBranch) {
    ticks.push(originBranch.age);
  }

  const postOriginSpan = Math.max(timeline.length - 1 - originStartIndex, 0);
  [0.35, 0.7, 1].forEach((ratio) => {
    const idx = originStartIndex + Math.round(postOriginSpan * ratio);
    const age = timeline[Math.min(timeline.length - 1, idx)];
    if (age != null) {
      ticks.push(age);
    }
  });

  return [...new Set(ticks)];
}

function getTreeAxisX(age) {
  return SVG_TREE_PAD_L + ageToTimelineFrac(age) * _svgContentW;
}

function getTreeNodeDepth(id) {
  let depth = 0;
  let currentId = id;
  while (_treeParentMap[currentId]) {
    depth += 1;
    currentId = _treeParentMap[currentId];
  }
  return depth;
}

function getTreeFlowWidth(id) {
  const node = _treeNodeMap[id];
  if (!node) {
    return SK_W_SAMPLE;
  }
  if (node.type === 'sample') {
    return 3.6;
  }
  const depth = getTreeNodeDepth(id);
  if (depth === 0) {
    return 24;
  }
  if (depth === 1) {
    return 20;
  }
  return Math.max(6.8, 18 - depth * 1.45);
}

function applyTreeTransform() {
  if (_svgG) {
    _svgG.setAttribute('transform', `translate(${_svgPanX},${_svgPanY}) scale(${_svgScale})`);
  }
  if (_svgRuler) {
    drawTreeRuler(_svgViewportW || _svgRuler.clientWidth || _svgRuler.getBoundingClientRect().width || 0, currentTreeBp);
  }
}

// possibleAnc 是否是 nodeId 的祖先（含自身）
function isAncestorOf(possibleAnc, nodeId) {
  if (!_treeParentMap) return false;
  let curr = nodeId;
  while (curr) {
    if (curr === possibleAnc) return true;
    curr = _treeParentMap[curr];
  }
  return false;
}

function initSvgTree() {
  if (_svgInited) return;
  _svgInited = true;
  treeState.initialized = true;
  initTreeMaps();
  const container = document.getElementById('treeSvg');
  if (!container) return;
  container.style.cssText = 'display:flex;flex-direction:column;width:100%;height:100%;overflow:hidden;position:relative;';

  _svgRuler = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  _svgRuler.setAttribute('id', 'treeRulerSvg');
  _svgRuler.style.cssText = `flex:0 0 ${SVG_RULER_H}px;width:100%;height:${SVG_RULER_H}px;display:block;overflow:visible;`;
  container.appendChild(_svgRuler);

  _svgEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  _svgEl.setAttribute('id', 'treeMainSvg');
  _svgEl.style.cssText = 'flex:1;min-height:0;width:100%;display:block;overflow:hidden;cursor:grab;';
  _svgDefs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
  _svgEl.appendChild(_svgDefs);
  _svgG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  _svgEl.appendChild(_svgG);
  container.appendChild(_svgEl);

  // 平移/缩放
  let dragging = false, dsx = 0, dsy = 0, dpx = 0, dpy = 0;
  _svgEl.addEventListener('mousedown', e => {
    if (e.button) return;
    dragging = true; dsx = e.clientX; dsy = e.clientY; dpx = _svgPanX; dpy = _svgPanY;
    _svgEl.style.cursor = 'grabbing'; e.preventDefault();
  });
  window.addEventListener('mousemove', e => {
    if (!dragging) return;
    _svgPanX = dpx + (e.clientX - dsx); _svgPanY = dpy + (e.clientY - dsy);
    applyTreeTransform();
  });
  window.addEventListener('mouseup', () => { if (dragging) { dragging = false; _svgEl.style.cursor = 'grab'; } });
  _svgEl.addEventListener('wheel', e => {
    e.preventDefault();
    const f = e.deltaY < 0 ? 1.15 : (1 / 1.15);
    const r = _svgEl.getBoundingClientRect();
    const cx = e.clientX - r.left, cy = e.clientY - r.top;
    _svgPanX = cx - f * (cx - _svgPanX); _svgPanY = cy - f * (cy - _svgPanY);
    _svgScale = Math.max(0.1, Math.min(_svgScale * f, 8));
    applyTreeTransform();
  }, { passive: false });

  document.getElementById('treeZoomIn')?.addEventListener('click', () => {
    _svgScale = Math.min(_svgScale * 1.25, 8);
    applyTreeTransform();
  });
  document.getElementById('treeZoomOut')?.addEventListener('click', () => {
    _svgScale = Math.max(_svgScale / 1.25, 0.1);
    applyTreeTransform();
  });
  document.getElementById('treeResetView')?.addEventListener('click', () => {
    _svgPanX = 0; _svgPanY = 0; _svgScale = 1;
    applyTreeTransform();
  });
  document.getElementById('treeExpandBtn')?.addEventListener('click', toggleTreeExpand);

  if (window.ResizeObserver) {
    new ResizeObserver(() => { if (_svgInited) drawSvgTree(currentTreeBp); }).observe(container);
  }
  currentTreeBp = getBpAtTimelinePosition(currentTimelinePosition);
  drawSvgTree(currentTreeBp);
}

function drawSvgTree(bp) {
  if (!_svgInited || !_svgEl || !_svgRuler) return;
  const nextStage = getTreeRenderStage(bp);
  currentTreeBp = bp;
  initTreeMaps();
  const W = _svgEl.clientWidth || _svgEl.getBoundingClientRect().width || 280;
  const H = _svgEl.clientHeight || _svgEl.getBoundingClientRect().height || 600;
  const compactTree = !treeState.expanded && H <= 360;
  const contentW = Math.max(W - SVG_TREE_PAD_L - SVG_TREE_PAD_R, 180);
  const contentH = Math.max(H - SVG_TREE_PAD_T - SVG_TREE_PAD_B, 120);

  _svgViewportW = W;
  _svgViewportH = H;
  _svgContentW = contentW;
  _svgContentH = contentH;

  const vis = new Set(nextStage.visibleBranchIds);
  const { preOriginGhostRootVisible } = nextStage;
  if (preOriginGhostRootVisible) {
    vis.add(originBranch.id);
  }
  if (!preOriginGhostRootVisible) {
    data.samples.filter(s => !s.isAncient && s.lat != null).forEach(s => {
      const sId = `sample_${s.id}`;
      const parentId = _treeParentMap[sId];
      if (parentId && vis.has(parentId)) vis.add(sId);
    });
  }
  if (!vis.size) {
    _svgG.innerHTML = '';
    _svgDefs.innerHTML = '';
    _svgCurrentBpLine = null;
    currentTreeStageKey = nextStage.key;
    applyTreeTransform();
    return;
  }

  const yMap = computeSvgYLayout(vis, contentH, compactTree);
  const axisTicks = getTreeAxisTicks();
  const xMap = new Map();
  function flowWidth(id) {
    const baseWidth = getTreeFlowWidth(id);
    if (!compactTree) {
      return baseWidth;
    }
    const node = _treeNodeMap[id];
    if (!node || node.type === 'sample') {
      return baseWidth;
    }
    const depth = getTreeNodeDepth(id);
    if (depth <= 1) {
      return baseWidth;
    }
    return Math.max(baseWidth, Math.min(18.6, baseWidth * 1.35));
  }
  function baseTreeX(id) {
    const age = _treeNodeMap[id]?.age ?? 0;
    return SVG_TREE_PAD_L + ageToTimelineFrac(age) * contentW;
  }
  function nx(id) {
    if (xMap.has(id)) {
      return xMap.get(id);
    }
    const baseX = baseTreeX(id);
    const parentId = _treeParentMap[id];
    if (!parentId || !vis.has(parentId)) {
      xMap.set(id, baseX);
      return baseX;
    }
    const node = _treeNodeMap[id];
    const parentNode = _treeNodeMap[parentId];
    const parentX = nx(parentId);
    const parentFlowWidth = flowWidth(parentId);
    const nodeFlowWidth = flowWidth(id);
    const parentRawY = yMap.get(parentId) ?? (contentH / 2);
    const nodeRawY = yMap.get(id) ?? (contentH / 2);
    const verticalDelta = Math.abs(nodeRawY - parentRawY);
    const ageDelta = Math.max(0, (parentNode?.age ?? 0) - (node?.age ?? 0));
    const ageTightness = Math.max(0, 80 - ageDelta) / 80;
    const ageCompactionGap = node?.type === 'sample' ? 0 : ageTightness * (compactTree ? 36 : 24);
    const baseGap = (parentFlowWidth + nodeFlowWidth) * (compactTree ? 1.05 : 0.8);
    const verticalGap = verticalDelta * (compactTree ? 0.28 : 0.12);
    const minGap = node?.type === 'sample'
      ? (compactTree ? 12 : 10)
      : Math.max(
          compactTree ? 22 : 18,
          Math.min(
            compactTree ? 108 : 54,
            Math.round(baseGap + verticalGap + ageCompactionGap)
          )
        );
    const resolvedX = Math.max(baseX, parentX + minGap);
    xMap.set(id, resolvedX);
    return resolvedX;
  }
  function ny(id) {
    const rawY = yMap.get(id) ?? (contentH / 2);
    return SVG_TREE_PAD_T + Math.max(0, Math.min(rawY, contentH));
  }

  _svgG.innerHTML = '';
  _svgDefs.innerHTML = '';
  _svgCurrentBpLine = null;
  _svgGradSeq = 0;
  const occupiedBranchLabels = [];

  vis.forEach((id) => {
    const node = _treeNodeMap[id];
    if (!node || node.type !== 'branch') return;
    const annotationText = treeBranchAnnotations.get(id);
    if (!annotationText) return;
    const parentId = _treeParentMap[id];
    const nodeX = nx(id);
    const nodeY = ny(id);
    const parentY = parentId && vis.has(parentId) ? ny(parentId) : nodeY;
    const labelY = nodeY <= parentY ? nodeY - 12 : nodeY + 16;
    occupiedBranchLabels.push({ x: nodeX - 8, y: labelY });
    occupiedBranchLabels.push({ x: nodeX - 8, y: nodeY + 22 });
  });

  function canPlaceBranchLabel(x, y, padX = 88, padY = 16) {
    for (const slot of occupiedBranchLabels) {
      if (Math.abs(slot.x - x) < padX && Math.abs(slot.y - y) < padY) {
        return false;
      }
    }
    return true;
  }

  function reserveBranchLabel(x, y) {
    occupiedBranchLabels.push({ x, y });
  }

  function placeBranchLabel(x, candidateYs, padX = 88, padY = 16, force = false) {
    for (const y of candidateYs) {
      if (canPlaceBranchLabel(x, y, padX, padY)) {
        reserveBranchLabel(x, y);
        return y;
      }
    }
    if (force && candidateYs.length) {
      reserveBranchLabel(x, candidateYs[0]);
      return candidateYs[0];
    }
    return null;
  }

  const bgRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  bgRect.setAttribute('x', '-9999'); bgRect.setAttribute('y', '-9999');
  bgRect.setAttribute('width', '19998'); bgRect.setAttribute('height', '19998');
  bgRect.setAttribute('fill', 'transparent');
  bgRect.addEventListener('click', () => {
    if (currentTreeHighlight) {
      currentTreeHighlight = null; currentMapHighlightBranches = null;
      drawSvgTree(currentTreeBp); render();
    }
  });
  _svgG.appendChild(bgRect);

  const gridG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  axisTicks.forEach(age => {
    const x = SVG_TREE_PAD_L + ageToTimelineFrac(age) * contentW;
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', String(x)); line.setAttribute('y1', '0');
    line.setAttribute('x2', String(x)); line.setAttribute('y2', String(H + 100));
    line.setAttribute('stroke', age === 0 ? 'rgba(74,158,255,0.16)' : 'rgba(74,158,255,0.08)');
    line.setAttribute('stroke-width', '1'); line.setAttribute('pointer-events', 'none');
    gridG.appendChild(line);
  });
  _svgCurrentBpLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  _svgCurrentBpLine.setAttribute('stroke', 'rgba(0,225,253,0.5)');
  _svgCurrentBpLine.setAttribute('stroke-width', '1.5');
  _svgCurrentBpLine.setAttribute('stroke-dasharray', '5,4');
  _svgCurrentBpLine.setAttribute('pointer-events', 'none');
  gridG.appendChild(_svgCurrentBpLine);
  _svgG.appendChild(gridG);

  // 桑基流 (Edges)
  const edgeG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  const visibleRootBranchIds = Array.from(vis).filter((id) => {
    const node = _treeNodeMap[id];
    if (!node || node.type !== 'branch') {
      return false;
    }
    const parentId = _treeParentMap[id];
    return !parentId || !vis.has(parentId);
  });
  visibleRootBranchIds.forEach((id) => {
    const node = _treeNodeMap[id];
    const nodeAge = node?.age ?? 0;
    if (!node || nodeAge >= timeline[0]) {
      return;
    }
    const rootX = nx(id);
    const rootY = ny(id);
    const trunkStartX = getTreeAxisX(timeline[0]) - Math.max(72, contentW * 0.24);
    const trunkEndX = Math.max(trunkStartX + 32, rootX);
    const trunkWidth = Math.max(flowWidth(id) * (compactTree ? 1.18 : 1.08), compactTree ? 18 : 14);
    const rootColor = brightenTreeColor(node.color || '#4a9eff');
    const ancestorColor = treeInterpolateColor('#22335d', rootColor, 0.36);
    const trunkGradientId = `sg${_svgGradSeq++}`;
    const trunkFill = ensureGradient(_svgDefs, trunkGradientId, ancestorColor, rootColor, trunkStartX, trunkEndX);

    const trunk = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    trunk.setAttribute('d', sankeyPathHorizontal(trunkStartX, rootY, trunkEndX, rootY, trunkWidth, trunkWidth));
    trunk.setAttribute('fill', trunkFill);
    trunk.setAttribute('opacity', compactTree ? '0.72' : '0.64');
    trunk.setAttribute('pointer-events', 'none');
    edgeG.appendChild(trunk);

    const trunkSpine = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    trunkSpine.setAttribute('d', sankeyCenterlineHorizontal(trunkStartX, rootY, trunkEndX, rootY));
    trunkSpine.setAttribute('fill', 'none');
    trunkSpine.setAttribute('stroke', treeInterpolateColor(ancestorColor, rootColor, 0.68));
    trunkSpine.setAttribute('stroke-width', String(Math.max(1.4, Math.min(trunkWidth * 0.18, 2.6))));
    trunkSpine.setAttribute('stroke-linecap', 'round');
    trunkSpine.setAttribute('opacity', compactTree ? '0.5' : '0.42');
    trunkSpine.setAttribute('pointer-events', 'none');
    edgeG.appendChild(trunkSpine);
  });
  const visOrder = new Map(Array.from(vis).map((id, index) => [id, index]));
  const edgeIds = Array.from(vis).filter((id) => {
    const pid = _treeParentMap[id];
    return !!(pid && vis.has(pid));
  });
  edgeIds.sort((a, b) => {
    const aParentId = _treeParentMap[a];
    const bParentId = _treeParentMap[b];
    if (aParentId !== bParentId) {
      return (visOrder.get(aParentId) ?? 0) - (visOrder.get(bParentId) ?? 0);
    }
    const aNode = _treeNodeMap[a];
    const bNode = _treeNodeMap[b];
    const aIsSample = aNode?.type === 'sample';
    const bIsSample = bNode?.type === 'sample';
    if (aIsSample !== bIsSample) {
      return aIsSample ? -1 : 1;
    }
    return ny(b) - ny(a);
  });
  edgeIds.forEach(id => {
    const pid = _treeParentMap[id];
    const pNode = _treeNodeMap[pid], cNode = _treeNodeMap[id];
    if (!pNode || !cNode) return;
    const px = nx(pid), py = ny(pid);
    const cx = nx(id), cY = ny(id);
    const idIsAnc = currentTreeHighlight && isAncestorOf(id, currentTreeHighlight);
    const idIsDesc = currentTreeHighlight && isAncestorOf(currentTreeHighlight, id);
    const isFuture = !!(currentTreeHighlight && id !== currentTreeHighlight && idIsDesc);
    const isUnrelated = !!(currentTreeHighlight && !idIsAnc && !idIsDesc);
    const pc = brightenTreeColor(pNode.color || '#4a9eff');
    const cc = brightenTreeColor(cNode.color || '#4a9eff');
    const isSample = cNode.type === 'sample';
    const wTop = flowWidth(pid);
    const wBot = flowWidth(id);
    const gid = `sg${_svgGradSeq++}`;
    const fill = ensureGradient(_svgDefs, gid, pc, cc, px, cx);
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', sankeyPathHorizontal(px, py, cx, cY, wTop, wBot));
    path.setAttribute('fill', fill);
    path.setAttribute('opacity', isUnrelated ? '0.08' : isFuture ? '0.2' : isSample ? '0.55' : compactTree ? '0.88' : '0.78');
    path.setAttribute('pointer-events', 'none');
    edgeG.appendChild(path);

    if (!isSample) {
      const edgeIsAnc = !!(idIsAnc || id === currentTreeHighlight);
      const showSpine = edgeIsAnc || !compactTree;
      if (!showSpine) {
        return;
      }
      const spineColor = edgeIsAnc ? 'rgba(180, 240, 255, 0.88)' : treeInterpolateColor(pc, cc, compactTree ? 0.62 : 0.52);
      const spineOpacity = isUnrelated ? '0.14' : isFuture ? '0.18' : compactTree ? '0.52' : '0.44';
      const spine = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      spine.setAttribute('d', sankeyCenterlineHorizontal(px, py, cx, cY));
      spine.setAttribute('fill', 'none');
      spine.setAttribute('stroke', spineColor);
      spine.setAttribute('stroke-width', String(Math.max(1.1, Math.min(wBot * 0.2, 2.2))));
      spine.setAttribute('stroke-linecap', 'round');
      spine.setAttribute('pointer-events', 'none');
      spine.setAttribute('opacity', spineOpacity);
      edgeG.appendChild(spine);
    }
  });
  _svgG.appendChild(edgeG);

  // 节点
  const nodeG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  vis.forEach(id => {
    const node = _treeNodeMap[id];
    if (!node) return;
    const nX = nx(id);
    const nY = ny(id);
    const color = brightenTreeColor(node.color || '#4a9eff');
    const isSample = node.type === 'sample';
    const isRoot = !_treeParentMap[id] || !vis.has(_treeParentMap[id]);
    const isTarget = id === currentTreeHighlight;
    const isAnc = !!(currentTreeHighlight && !isTarget && isAncestorOf(id, currentTreeHighlight));
    const isDesc = !!(currentTreeHighlight && !isTarget && isAncestorOf(currentTreeHighlight, id));
    const isFuture = !!(currentTreeHighlight && isDesc);
    const isUnrelated = !!(currentTreeHighlight && !isTarget && !isAnc && !isDesc);
    const isPreOriginGhost = node.type === 'branch' && id === originBranch?.id && bp > (node.age ?? 0);

    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('transform', `translate(${nX.toFixed(1)},${nY.toFixed(1)})`);
    g.style.cursor = 'pointer';
    g.style.opacity = isPreOriginGhost ? '0.64' : isUnrelated ? '0.16' : isFuture ? '0.34' : '1';
    g.setAttribute('data-node-id', id);

    if (isSample) {
      const sampleRadius = isTarget ? '6' : '3.8';
      const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      c.setAttribute('r', sampleRadius);
      c.setAttribute('fill', color);
      c.setAttribute('fill-opacity', isTarget ? '1' : '0.78');
      c.setAttribute('stroke', color); c.setAttribute('stroke-width', isTarget ? '2' : '1.5');
      if (isTarget) c.setAttribute('filter', `drop-shadow(0 0 5px ${color})`);
      g.appendChild(c);
      const lbl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      lbl.setAttribute('x', '-8'); lbl.setAttribute('y', '1');
      lbl.setAttribute('text-anchor', 'end');
      lbl.setAttribute('dominant-baseline', 'middle');
      lbl.setAttribute('fill', color); lbl.setAttribute('font-size', '7');
      lbl.setAttribute('pointer-events', 'none');
      lbl.setAttribute('paint-order', 'stroke');
      lbl.setAttribute('stroke', 'rgba(5, 10, 28, 0.98)');
      lbl.setAttribute('stroke-width', '2.4');
      lbl.setAttribute('stroke-linejoin', 'round');
      lbl.textContent = node.name.startsWith('HHT') ? node.name.slice(3) : node.name;
      g.appendChild(lbl);
    } else if (isRoot) {
      const tw = calcTreeTextWidth(node.name); const rh = 22;
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('x', String(-tw / 2)); rect.setAttribute('y', String(-rh / 2));
      rect.setAttribute('width', String(tw)); rect.setAttribute('height', String(rh));
      rect.setAttribute('rx', '9'); rect.setAttribute('ry', '9');
      rect.setAttribute('fill', isPreOriginGhost ? 'rgba(10, 22, 40, 0.82)' : '#0a1628');
      rect.setAttribute('stroke', isTarget ? '#00E1FD' : isPreOriginGhost ? treeInterpolateColor('#7f9cca', color, 0.62) : color);
      rect.setAttribute('stroke-width', isTarget ? '2.5' : isPreOriginGhost ? '1.7' : '2');
      if (isTarget) rect.setAttribute('filter', `drop-shadow(0 0 8px ${color})`);
      g.appendChild(rect);
      const lbl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      lbl.setAttribute('text-anchor', 'middle'); lbl.setAttribute('dominant-baseline', 'central');
      lbl.setAttribute('fill', isTarget ? '#00E1FD' : isPreOriginGhost ? treeInterpolateColor('#a9bfdf', color, 0.5) : color);
      lbl.setAttribute('font-size', '11'); lbl.setAttribute('font-weight', '700');
      lbl.setAttribute('pointer-events', 'none'); lbl.textContent = node.name;
      g.appendChild(lbl);
    } else {
      const annotationText = treeBranchAnnotations.get(id);
      const depth = getTreeNodeDepth(id);
      const parentId = _treeParentMap[id];
      const parentX = parentId && vis.has(parentId) ? nx(parentId) : nX;
      const parentY = parentId && vis.has(parentId) ? ny(parentId) : nY;
      const shortSegment = parentId && Math.abs(nX - parentX) < 52;
      const defaultLabelY = annotationText ? -12 : shortSegment ? 16 : nY <= parentY ? -12 : 16;
      const fallbackLabelY = defaultLabelY < 0 ? 16 : -12;
      const allowOrdinaryLabel = (!shortSegment || compactTree) && !TREE_SUPPRESSED_BRANCH_LABELS.has(id);
      const forceLabel = TREE_ALWAYS_LABEL_BRANCH_IDS.has(id);
      const forcedLabelLayout = TREE_FORCED_LABEL_LAYOUT.get(id);
      const branchChildren = (node.children || []).filter(childId => vis.has(childId) && _treeNodeMap[childId]?.type === 'branch').length;
      const compactPriorityLabel = compactTree && allowOrdinaryLabel;
      const centeredCompactLabel = compactTree && !annotationText;
      const baseRadius = isTarget ? 9 : isAnc ? 7 : 5.5;
      const bandRadius = Math.max(flowWidth(id), flowWidth(parentId || id)) * 0.58;
      const r = Math.max(baseRadius, bandRadius);
      const labelX = centeredCompactLabel ? 0 : (forcedLabelLayout?.x ?? (annotationText ? -8 : -10));
      const labelAnchor = centeredCompactLabel ? 'middle' : 'end';
      const labelGlobalX = nX + labelX;
      let renderLabelY = centeredCompactLabel ? -14 : (forcedLabelLayout?.y ?? defaultLabelY);
      let renderLabelGlobalY = nY + renderLabelY;
      if ((forceLabel || centeredCompactLabel) && renderLabelGlobalY < SVG_TREE_PAD_T + 6) {
        renderLabelY += SVG_TREE_PAD_T + 6 - renderLabelGlobalY;
        renderLabelGlobalY = nY + renderLabelY;
      }
      const labelPadX = centeredCompactLabel ? 30 : forceLabel ? (compactTree ? 34 : 52) : annotationText ? (compactTree ? 46 : 68) : (compactTree ? 40 : 68);
      const labelPadY = compactTree ? 9 : 12;
      const labelCandidates = [renderLabelGlobalY];
      const fallbackGlobalY = centeredCompactLabel ? (nY + 18) : (nY + fallbackLabelY);
      if (Math.abs(fallbackGlobalY - renderLabelGlobalY) > 0.5) {
        labelCandidates.push(fallbackGlobalY);
      }
      if (forceLabel || compactPriorityLabel) {
        (centeredCompactLabel ? [-26, 30, -38, 42] : [24, -24, 36, -36, 48]).forEach(offset => {
          labelCandidates.push(nY + offset);
        });
      }
      let showLabel = !!(annotationText || isTarget || isAnc || forceLabel || compactPriorityLabel);
      if (!showLabel && allowOrdinaryLabel) {
        const placedLabelY = placeBranchLabel(labelGlobalX, labelCandidates, labelPadX, labelPadY, compactPriorityLabel);
        if (placedLabelY != null) {
          renderLabelGlobalY = placedLabelY;
          renderLabelY = placedLabelY - nY;
          showLabel = true;
        }
      } else if (showLabel) {
        const placedLabelY = placeBranchLabel(labelGlobalX, labelCandidates, labelPadX, labelPadY, true);
        if (placedLabelY != null) {
          renderLabelGlobalY = placedLabelY;
          renderLabelY = placedLabelY - nY;
        }
      }
      const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      c.setAttribute('r', String(r));
      c.setAttribute('fill', isAnc ? '#00E1FD' : color);
      c.setAttribute('fill-opacity', isTarget ? '0.42' : isAnc ? '0.32' : '0.22');
      c.setAttribute('stroke', isAnc ? '#00E1FD' : color);
      c.setAttribute('stroke-width', isAnc ? '2.5' : '2');
      if (isTarget) c.setAttribute('filter', `drop-shadow(0 0 7px ${color})`);
      g.appendChild(c);
      if (showLabel) {
        const lbl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        lbl.setAttribute('x', String(labelX)); lbl.setAttribute('y', String(renderLabelY));
        lbl.setAttribute('text-anchor', labelAnchor); lbl.setAttribute('fill', isAnc ? '#00E1FD' : color);
        lbl.setAttribute('font-size', forceLabel ? (compactTree ? '8.2' : '7.9') : annotationText ? (compactTree ? '8' : '8.4') : (compactTree ? '6.6' : '7.4'));
        lbl.setAttribute('pointer-events', 'none');
        lbl.setAttribute('paint-order', 'stroke');
        lbl.setAttribute('stroke', 'rgba(5, 10, 28, 0.96)');
        lbl.setAttribute('stroke-width', compactTree ? '2' : '2.4');
        lbl.setAttribute('stroke-linejoin', 'round');
        lbl.textContent = node.name;
        g.appendChild(lbl);
      }

      if (annotationText) {
        const note = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        note.setAttribute('x', '-8'); note.setAttribute('y', '22');
        note.setAttribute('text-anchor', 'end');
        note.setAttribute('fill', 'rgba(205, 225, 255, 0.78)');
        note.setAttribute('font-size', '6.6');
        note.setAttribute('pointer-events', 'none');
        note.setAttribute('paint-order', 'stroke');
        note.setAttribute('stroke', 'rgba(5, 10, 28, 0.96)');
        note.setAttribute('stroke-width', '2.2');
        note.setAttribute('stroke-linejoin', 'round');
        note.textContent = annotationText;
        g.appendChild(note);
        occupiedBranchLabels.push({ x: nX, y: nY + 22 });
      }
    }

    g.addEventListener('click', e => {
      e.stopPropagation();
      const newHl = currentTreeHighlight === id ? null : id;
      currentTreeHighlight = newHl;
      currentMapHighlightBranches = newHl ? calcMapHighlightBranches(id) : null;
      if (isSample && node.sampleData) highlightSampleOnMap(node.sampleData);
      drawSvgTree(currentTreeBp); render();
    });
    nodeG.appendChild(g);
  });
  _svgG.appendChild(nodeG);

  currentTreeStageKey = nextStage.key;
  updateTreeCurrentBpMarker(bp);
  applyTreeTransform();
}

function drawTreeRuler(viewportWidth, bp) {
  if (!_svgRuler) return;
  _svgRuler.innerHTML = '';
  const W = viewportWidth || _svgRuler.clientWidth || _svgRuler.getBoundingClientRect().width || 280;
  const H = SVG_RULER_H;
  const axisY = H - 18;
  _svgRuler.setAttribute('width', String(W));
  _svgRuler.setAttribute('height', String(H));

  const axisLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  axisLine.setAttribute('x1', '0'); axisLine.setAttribute('y1', String(axisY));
  axisLine.setAttribute('x2', String(W)); axisLine.setAttribute('y2', String(axisY));
  axisLine.setAttribute('stroke', 'rgba(74,158,255,0.3)');
  axisLine.setAttribute('stroke-width', '1.2');
  _svgRuler.appendChild(axisLine);

  const ticks = getTreeAxisTicks();
  ticks.forEach((age, index) => {
    const x = _svgPanX + _svgScale * getTreeAxisX(age);
    const isEdge = index === 0 || index === ticks.length - 1;
    const tick = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    tick.setAttribute('x1', String(x)); tick.setAttribute('y1', String(axisY));
    tick.setAttribute('x2', String(x)); tick.setAttribute('y2', String(axisY + (isEdge ? 10 : 7)));
    tick.setAttribute('stroke', isEdge ? 'rgba(180,215,255,0.95)' : 'rgba(120,170,240,0.7)');
    tick.setAttribute('stroke-width', isEdge ? '2' : '1.2');
    _svgRuler.appendChild(tick);

    const lbl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    lbl.setAttribute('x', String(x)); lbl.setAttribute('y', String(axisY - 10));
    lbl.setAttribute('text-anchor', 'middle');
    lbl.setAttribute('fill', 'rgba(185,215,255,0.9)');
    lbl.setAttribute('font-size', isEdge ? '10.5' : '9.5');
    lbl.textContent = age === 0 ? '现代' : `距今 ${age} 年`;
    _svgRuler.appendChild(lbl);
  });

  if (bp >= 0) {
    const currentX = _svgPanX + _svgScale * getTreeAxisX(bp);
    const markerLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    markerLine.setAttribute('x1', String(currentX)); markerLine.setAttribute('y1', String(axisY - 6));
    markerLine.setAttribute('x2', String(currentX)); markerLine.setAttribute('y2', String(axisY + 12));
    markerLine.setAttribute('stroke', 'rgba(0,225,253,0.95)');
    markerLine.setAttribute('stroke-width', '1.6');
    markerLine.setAttribute('stroke-dasharray', '3,3');
    _svgRuler.appendChild(markerLine);

    const markerDot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    markerDot.setAttribute('cx', String(currentX)); markerDot.setAttribute('cy', String(axisY));
    markerDot.setAttribute('r', '4.2');
    markerDot.setAttribute('fill', '#00E1FD');
    markerDot.setAttribute('filter', 'drop-shadow(0 0 5px rgba(0,225,253,0.85))');
    _svgRuler.appendChild(markerDot);
  }
}

// 以下为原 ECharts 树入口函数，现委托给 SVG 版本
function initGenealogyTree() {
  const container = document.getElementById("treeSvg");
  if (!container || treeState.initialized) return;
  initSvgTree();
  // 以下旧代码保留注释占位，防止其余引用报错
  if (typeof echarts === 'undefined') { return; }
  echartsTreeInstance = null; /* SVG 模式下不使用 ECharts */
}

function renderGenealogyTree(bp) {
  if (!treeState.initialized) return;
  const nextStage = getTreeRenderStage(bp);
  if (nextStage.key === currentTreeStageKey) {
    updateTreeCurrentBpMarker(bp);
    if (_svgRuler) {
      drawTreeRuler(_svgViewportW || _svgRuler.clientWidth || _svgRuler.getBoundingClientRect().width || 0, bp);
    }
    return;
  }
  drawSvgTree(bp);
}

function countLeafNodes(nodes) {
  if (!nodes || nodes.length === 0) return 1;
  let count = 0;
  for (const n of nodes) {
    if (!n.children || n.children.length === 0) count += 1;
    else count += countLeafNodes(n.children);
  }
  return count;
}

function autoFitTreeZoom() { /* SVG 模式下通过 ResizeObserver 自动适配，无需此函数 */ }

function toggleTreeExpand() {
  treeState.expanded = !treeState.expanded;
  const card = document.querySelector(".tree-card");
  const btn = document.getElementById("treeExpandBtn");
  if (treeState.expanded) {
    card.classList.remove("tree-card--collapsing");
    card.classList.add("tree-card--expanded");
    if (btn) btn.textContent = "⤡";
    setTimeout(() => { drawSvgTree(0); }, 60);
  } else {
    card.classList.add("tree-card--collapsing");
    const onEnd = () => {
      card.classList.remove("tree-card--expanded", "tree-card--collapsing");
      card.removeEventListener("animationend", onEnd);
      setTimeout(() => { drawSvgTree(getBpAtTimelinePosition(currentTimelinePosition)); }, 30);
    };
    card.addEventListener("animationend", onEnd);
    if (btn) btn.innerHTML = "&#x2922;";
  }
}

function highlightSampleOnMap(sample) {
  const pt = pointLayer.querySelector(`[data-sample-id="${sample.id}"]`);
  if (pt) {
    const origR = pt.getAttribute("r");
    pt.setAttribute("r", "5.5");
    pt.style.filter = "drop-shadow(0 0 8px rgba(255, 230, 80, 0.95))";
    setTimeout(() => {
      pt.setAttribute("r", origR || "2.2");
      pt.style.filter = "";
    }, 3000);
  }
}

// 全屏按钮
(function initFullscreenBtn() {
  const btn = document.getElementById("fullscreenBtn");
  if (!btn) return;
  const expandIcon = `<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>`;
  const collapseIcon = `<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/></svg>`;
  btn.innerHTML = expandIcon;
  btn.addEventListener("click", () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  });
  document.addEventListener("fullscreenchange", () => {
    btn.innerHTML = document.fullscreenElement ? collapseIcon : expandIcon;
    btn.title = document.fullscreenElement ? "退出全屏" : "全屏 (F11)";
  });
})();

(function initIntroExperience() {
  const intro = document.getElementById("introExperience");
  const canvas = document.getElementById("introGlobeCanvas");
  const tribeList = document.getElementById("introTribeList");
  const launchBtn = document.getElementById("introLaunchBtn");
  const filmCaption = document.getElementById("introFilmCaption");
  const leadText = document.getElementById("introLeadText");
  const introCopy = intro.querySelector(".intro-copy");
  const introCopyMask = intro.querySelector(".intro-copy-mask");
  const manifesto = intro.querySelector(".intro-manifesto");
  const flowTitle = intro.querySelector(".intro-flow-title");
  const flowTag = intro.querySelector(".intro-flow-tag");
  const flowCaption = intro.querySelector(".intro-flow-caption");
  const flowFigure = document.getElementById("introFlowFigure");
  if (!intro || !canvas || !tribeList || !launchBtn) return;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const INTRO_BRANCH_IDS = ["MF247416", "BY182928", "Y20085", "Y20087", "ZQ32"];
  const INTRO_REFERENCE_YEAR = new Date().getFullYear();
  const INTRO_CALLOUT_LAYOUT_PLAN = new Map([
    ["BY182928", { side: "left", slot: 0, lane: 0 }],
    ["Y20085", { side: "left", slot: 1, lane: 1 }],
    ["Y20087", { side: "left", slot: 2, lane: 2 }],
    ["MF247416", { side: "right", slot: 0, lane: 0 }],
    ["ZQ32", { side: "right", slot: 1, lane: 1 }],
  ]);
  const INTRO_SANKEY_BRANCH_LAYOUT = new Map([
    ["MF247416", { top: 104, offsetX: -46 }],
    ["Y20085", { top: 18, offsetX: -132 }],
    ["ZQ32", { top: 136, offsetX: -86 }],
    ["BY182928", { top: 84, offsetX: -14 }],
    ["Y20087", { top: 220, offsetX: -14 }],
  ]);
  const INTRO_CALLOUT_SLOT_OFFSETS = {
    left: [-0.38, 0.02, 0.34],
    right: [-0.1, 0.32],
  };
  const originLon = 123.45;
  const originLat = 50.58;
  const modernSamples = data.samples.filter((sample) => !sample.isAncient && sample.lat != null && sample.lon != null);
  const globePoints = modernSamples
    .map((sample) => ({
      lat: sample.lat,
      lon: sample.lon,
      color: brightenTreeColor(branchMap.get(sample.branchSegments?.at(-1) || data.meta.branch)?.color || "#8ec5ff"),
      chinaFocus: sample.lon >= 73 && sample.lon <= 135 && sample.lat >= 18 && sample.lat <= 54,
    }))
    .slice(0, 160);

  const worldWireframes = [
    [[-168, 72], [-150, 60], [-135, 55], [-125, 50], [-118, 38], [-110, 32], [-102, 25], [-97, 19], [-91, 18], [-83, 24], [-80, 30], [-73, 45], [-60, 52], [-52, 60]],
    [[-81, 12], [-70, 8], [-65, -5], [-60, -20], [-58, -35], [-65, -50], [-75, -54], [-78, -20], [-81, 0], [-81, 12]],
    [[-17, 37], [0, 36], [15, 32], [25, 24], [33, 17], [38, 4], [42, -15], [32, -34], [18, -34], [8, -20], [-5, 5], [-10, 24], [-17, 37]],
    [[-10, 36], [5, 43], [22, 45], [40, 55], [60, 58], [80, 57], [100, 60], [120, 55], [135, 50], [145, 45], [150, 35], [140, 20], [122, 8], [112, 0], [100, 6], [80, 12], [65, 25], [45, 30], [30, 36], [18, 36], [5, 41], [-10, 36]],
  ];
  const chinaWireframe = [
    [74, 40],
    [79, 47],
    [88, 49],
    [96, 47],
    [104, 44],
    [112, 45],
    [121, 49],
    [131, 47],
    [132, 41],
    [126, 37],
    [123, 30],
    [118, 24],
    [111, 21],
    [104, 22],
    [98, 26],
    [92, 28],
    [86, 31],
    [81, 34],
    [76, 37],
    [74, 40],
  ];
  const taiwanWireframe = [
    [121.78, 24.39],
    [121.18, 22.79],
    [120.75, 21.97],
    [120.22, 22.81],
    [120.11, 23.56],
    [120.69, 24.54],
    [121.5, 25.3],
    [121.95, 25],
    [121.78, 24.39],
  ];
  const fallbackChinaFocusPaths = [chinaWireframe, taiwanWireframe];
  const worldBorderPaths = [];
  const chinaBorderPaths = [];
  const starField = Array.from({ length: 92 }, () => ({
    x: Math.random(),
    y: Math.random(),
    size: 0.4 + Math.random() * 1.4,
    alpha: 0.18 + Math.random() * 0.48,
    floatAmplitude: 4 + Math.random() * 18,
    swayAmplitude: 2 + Math.random() * 12,
    floatSpeed: 0.00022 + Math.random() * 0.00028,
    pulseSpeed: 0.001 + Math.random() * 0.0011,
    phase: Math.random() * Math.PI * 2,
  }));

  function normalizeIntroMatcher(value) {
    return `${value || ""}`
      .toLowerCase()
      .replace(/[\s·•,，/()（）-]+/g, "")
      .trim();
  }

  function formatIntroAppearance(bp) {
    if (!Number.isFinite(bp) || bp <= 0) return "时间待补";
    return `约公元${INTRO_REFERENCE_YEAR - Math.round(bp)}年`;
  }

  function formatIntroLocation(location, distribution) {
    return `${location || distribution || "终局位置待补"}`
      .replace(/[，,]/g, " · ")
      .replace(/\s*\/\s*/g, " / ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function scoreIntroRepresentativeSample(sample, annotationText) {
    let score = 0;
    const normalizedAnnotation = normalizeIntroMatcher(annotationText);
    const normalizedFamily = normalizeIntroMatcher(sample.family);
    const normalizedTribe = normalizeIntroMatcher(sample.tribe);
    const hasCoordinates = sample.lat != null && sample.lon != null;

    if (normalizedFamily && normalizedAnnotation) {
      if (normalizedFamily === normalizedAnnotation) score += 180;
      else if (normalizedAnnotation.includes(normalizedFamily)) score += 120;
      else if (normalizedFamily.includes(normalizedAnnotation)) score += 84;
    }

    if (normalizedTribe && normalizedAnnotation) {
      if (normalizedTribe === normalizedAnnotation) score += 96;
      else if (normalizedAnnotation.includes(normalizedTribe)) score += 42;
    }

    if (sample.family) score += 30;
    if (sample.tribe) score += 12;
    if (sample.location) score += 14;
    if (hasCoordinates) score += 24;

    return score;
  }

  function getIntroRepresentativeSample(samples, annotationText) {
    return samples
      .map((sample) => ({
        sample,
        score: scoreIntroRepresentativeSample(sample, annotationText),
      }))
      .sort((left, right) => right.score - left.score || (left.sample.sourceRow || 0) - (right.sample.sourceRow || 0))[0]?.sample || null;
  }

  const tribeCards = INTRO_BRANCH_IDS.map((branchId) => {
    const branch = branchMap.get(branchId);
    const samples = modernSamples.filter((sample) => sample.branchSegments?.at(-1) === branchId);
    const annotation = treeBranchAnnotations.get(branchId) || getTreeBranchAnnotation(branchId) || branchId;
    const primarySample = getIntroRepresentativeSample(samples, annotation) || samples[0] || null;
    const fallbackCenter = branch?.center || [];
    const age = branch?.age ?? Math.max(...samples.map((sample) => sample.tmrca || 0), 0);
    const primaryLat = primarySample?.lat ?? fallbackCenter[0] ?? null;
    const primaryLon = primarySample?.lon ?? fallbackCenter[1] ?? null;
    const primaryLocation = formatIntroLocation(primarySample?.location, branch?.distribution);
    return {
      branchId,
      code: branch?.label || branchId,
      label: annotation,
      location: primaryLocation,
      age,
      appearance: formatIntroAppearance(age),
      appearanceYearValue: age === 0 ? INTRO_REFERENCE_YEAR : INTRO_REFERENCE_YEAR - age,
      coord: primaryLat != null && primaryLon != null
        ? `${Math.abs(primaryLat).toFixed(1)}°${primaryLat >= 0 ? "N" : "S"} · ${Math.abs(primaryLon).toFixed(1)}°${primaryLon >= 0 ? "E" : "W"}`
        : "坐标待补",
      lat: primaryLat,
      lon: primaryLon,
      color: brightenTreeColor(branch?.color || "#8ec5ff"),
      sourceRow: primarySample?.sourceRow ?? null,
    };
  });

  tribeList.innerHTML = tribeCards.map((card, index) => `
    <article class="intro-tribe-callout intro-tribe-callout--${index}" data-branch-id="${card.branchId}" data-source-row="${card.sourceRow || ""}">
      <div class="intro-tribe-name">${card.label}</div>
    </article>
  `).join("");

  const flowSvg = document.getElementById("introFlowSvg");
  if (flowSvg) {
    if (flowTag) flowTag.textContent = "Temporal Comparison";
    if (flowTitle) flowTitle.textContent = "五部族时空对比";
    if (flowCaption) flowCaption.textContent = "以 Y4569 共祖为起点，沿出现时间轴向五个部族分流。";

    const rankedCards = [...tribeCards].sort((left, right) => left.appearanceYearValue - right.appearanceYearValue);
    const originAppearanceYearValue = originBranch?.age === 0
      ? INTRO_REFERENCE_YEAR
      : INTRO_REFERENCE_YEAR - (originBranch?.age ?? 0);
    const originAppearanceLabel = originBranch ? formatIntroAppearance(originBranch.age) : "起点";
    const minAppearanceYear = Math.min(originAppearanceYearValue, ...rankedCards.map((card) => card.appearanceYearValue));
    const maxAppearanceYear = Math.max(...rankedCards.map((card) => card.appearanceYearValue));
    const appearanceRange = Math.max(maxAppearanceYear - minAppearanceYear, 1);
    const sankeyViewWidth = 600;
    const sankeyViewHeight = 318;
    const sourceNode = { x: 24, y: 130, width: 104, height: 56 };
    const branchNode = { width: 116, height: 76 };
    const timelineStartX = 190;
    const timelineEndX = sankeyViewWidth - 60;
    const timelineAxisY = 160;
    const sourceCenterX = sourceNode.x + sourceNode.width / 2;
    const sourceCenterY = sourceNode.y + sourceNode.height / 2;

    const sankeyCards = rankedCards.map((card) => {
      const layout = INTRO_SANKEY_BRANCH_LAYOUT.get(card.branchId) || { top: 112, offsetX: 0 };
      const normalized = (card.appearanceYearValue - minAppearanceYear) / appearanceRange;
      const centerX = timelineStartX + normalized * (timelineEndX - timelineStartX) + (layout.offsetX || 0);
      const centerY = layout.top + branchNode.height / 2;
      const targetX = centerX - branchNode.width / 2 + 4;
      const controlOffset = Math.max(72, (targetX - (sourceNode.x + sourceNode.width)) * 0.4);
      const path = [
        `M ${sourceNode.x + sourceNode.width} ${sourceCenterY}`,
        `C ${sourceNode.x + sourceNode.width + controlOffset} ${sourceCenterY}`,
        `${targetX - controlOffset * 0.6} ${centerY}`,
        `${targetX} ${centerY}`,
      ].join(" ");
      const xPercent = (centerX / sankeyViewWidth * 100).toFixed(2);
      return {
        ...card,
        top: layout.top,
        centerY,
        xPercent,
        xPixel: centerX,
        path,
      };
    });

    const sankeyGradients = sankeyCards.map((card) => `
      <linearGradient id="introSankeyGrad-${card.branchId}" x1="${sourceNode.x + sourceNode.width}" y1="${timelineAxisY}" x2="${card.xPixel.toFixed(1)}" y2="${card.centerY.toFixed(1)}">
        <stop offset="0%" stop-color="rgba(120, 176, 255, 0.14)"></stop>
        <stop offset="100%" stop-color="${card.color}"></stop>
      </linearGradient>
    `).join("");

    const sankeyPaths = sankeyCards.map((card) => `
      <path class="intro-flow-sankey-ribbon" d="${card.path}" stroke="url(#introSankeyGrad-${card.branchId})"></path>
    `).join("");

    const sankeyNodes = sankeyCards.map((card) => `
      <article class="intro-flow-sankey-node intro-flow-sankey-node--branch" style="--accent:${card.color}; --x:${card.xPercent}%; --y:${card.top}px;" title="${card.coord}">
        <div class="intro-flow-sankey-code">${card.code}</div>
        <div class="intro-flow-sankey-name">${card.label}</div>
        <div class="intro-flow-sankey-time">${card.appearance}</div>
        <div class="intro-flow-sankey-location">${card.location}</div>
      </article>
    `).join("");

    const flowBoard = document.createElement("div");
    flowBoard.className = "intro-flow-board";
    flowBoard.innerHTML = `
      <div class="intro-flow-scale">
        <span class="intro-flow-scale-bound">${originAppearanceLabel}</span>
        <span class="intro-flow-scale-title">Sankey Timeline</span>
        <span class="intro-flow-scale-bound">${rankedCards.at(-1)?.appearance || ""}</span>
      </div>
      <div class="intro-flow-sankey">
        <svg class="intro-flow-sankey-svg" viewBox="0 0 ${sankeyViewWidth} ${sankeyViewHeight}" preserveAspectRatio="none" aria-hidden="true">
          <defs>${sankeyGradients}</defs>
          <line class="intro-flow-sankey-axis" x1="${sourceCenterX}" y1="${timelineAxisY}" x2="${timelineEndX}" y2="${timelineAxisY}"></line>
          ${sankeyPaths}
        </svg>
        <article class="intro-flow-sankey-node intro-flow-sankey-node--origin" style="--x:${(sourceCenterX / sankeyViewWidth * 100).toFixed(2)}%; --y:${sourceNode.y}px;">
          <div class="intro-flow-sankey-origin-label">Y4569 共祖</div>
          <div class="intro-flow-sankey-origin-time">${originAppearanceLabel}</div>
          <div class="intro-flow-sankey-origin-meta">共同祖源</div>
        </article>
        ${sankeyNodes}
      </div>
    `;
    flowSvg.replaceWith(flowBoard);
  }

  if (leadText) {
    leadText.textContent = `镜头自远空推进，聚焦 ${tribeCards.length} 个关键部族在表格样本中的现代终局与导线关系。`;
  }

  if (manifesto) {
    manifesto.innerHTML = "<p>开场页的地点、经纬度与出现时间均直接汇总自表格样本数据，最早出现时间取支系在表中的 TMRCA。</p>";
  }

  let width = 0;
  let height = 0;
  let rafId = 0;
  let introFallbackTimer = 0;
  let lastIntroFrameAt = 0;
  let startTime = 0;
  const startRotation = -1.85;
  const finalRotation = -0.42;
  const tilt = 0.22;
  let introReady = false;
  let calloutsReady = false;
  const calloutEls = Array.from(tribeList.querySelectorAll(".intro-tribe-callout"));

  function geometryToPaths(geometry) {
    if (!geometry) return [];
    if (geometry.type === "Polygon") {
      return geometry.coordinates.map((ring) => ring.map(([lon, lat]) => [lon, lat]));
    }
    if (geometry.type === "MultiPolygon") {
      return geometry.coordinates.flatMap((polygon) => polygon.map((ring) => ring.map(([lon, lat]) => [lon, lat])));
    }
    return [];
  }

  fetch("https://cdn.jsdelivr.net/gh/holtzy/D3-graph-gallery@master/DATA/world.geojson")
    .then((response) => response.ok ? response.json() : null)
    .then((geojson) => {
      if (!geojson?.features) return;
      geojson.features.forEach((feature) => {
        const paths = geometryToPaths(feature.geometry);
        worldBorderPaths.push(...paths);
        const featureName = `${feature.properties?.name || ""}`.toLowerCase();
        if (featureName.includes("china") || featureName.includes("taiwan")) {
          chinaBorderPaths.push(...paths);
        }
      });
    })
    .catch(() => {});

  function resizeIntroCanvas() {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
  }

  function easeOutCubic(value) {
    return 1 - Math.pow(1 - value, 3);
  }

  function easeInOutCubic(value) {
    return value < 0.5 ? 4 * value * value * value : 1 - Math.pow(-2 * value + 2, 3) / 2;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(value, max));
  }

  function withAlpha(color, alpha) {
    if (color.startsWith("#")) {
      const raw = color.replace("#", "");
      const hex = raw.length === 3 ? raw.split("").map((item) => item + item).join("") : raw;
      const red = Number.parseInt(hex.slice(0, 2), 16);
      const green = Number.parseInt(hex.slice(2, 4), 16);
      const blue = Number.parseInt(hex.slice(4, 6), 16);
      return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
    }
    return color;
  }

  function projectOnGlobe(lonDeg, latDeg, centerX, centerY, radius, globeRotation) {
    const lon = lonDeg * Math.PI / 180 + globeRotation;
    const lat = latDeg * Math.PI / 180;

    const x = -Math.cos(lat) * Math.cos(lon);
    const y = Math.sin(lat);
    const z = Math.cos(lat) * Math.sin(lon);

    const tiltY = y * Math.cos(tilt) - z * Math.sin(tilt);
    const tiltZ = y * Math.sin(tilt) + z * Math.cos(tilt);

    return {
      x: centerX + x * radius,
      y: centerY - tiltY * radius,
      depth: tiltZ,
      visible: tiltZ > 0,
    };
  }

  function drawSphereGrid(centerX, centerY, radius, globeRotation) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.clip();

    for (let lon = -180; lon < 180; lon += 20) {
      ctx.beginPath();
      let started = false;
      for (let lat = -80; lat <= 80; lat += 4) {
        const point = projectOnGlobe(lon, lat, centerX, centerY, radius, globeRotation);
        if (!point.visible) {
          started = false;
          continue;
        }
        if (!started) {
          ctx.moveTo(point.x, point.y);
          started = true;
        } else {
          ctx.lineTo(point.x, point.y);
        }
      }
      ctx.strokeStyle = "rgba(74, 150, 110, 0.12)";
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    for (let lat = -60; lat <= 60; lat += 20) {
      ctx.beginPath();
      let started = false;
      for (let lon = -180; lon <= 180; lon += 4) {
        const point = projectOnGlobe(lon, lat, centerX, centerY, radius, globeRotation);
        if (!point.visible) {
          started = false;
          continue;
        }
        if (!started) {
          ctx.moveTo(point.x, point.y);
          started = true;
        } else {
          ctx.lineTo(point.x, point.y);
        }
      }
      ctx.strokeStyle = "rgba(74, 150, 110, 0.12)";
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    ctx.restore();
  }

  function drawGeoWireframe(pathPoints, centerX, centerY, radius, globeRotation, strokeStyle, lineWidth) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.clip();
    ctx.beginPath();
    let started = false;
    pathPoints.forEach(([lon, lat]) => {
      const point = projectOnGlobe(lon, lat, centerX, centerY, radius, globeRotation);
      if (!point.visible) {
        started = false;
        return;
      }
      if (!started) {
        ctx.moveTo(point.x, point.y);
        started = true;
      } else {
        ctx.lineTo(point.x, point.y);
      }
    });
    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = lineWidth;
    ctx.lineJoin = "round";
    ctx.stroke();
    ctx.restore();
  }

  function drawGeoWireframeSet(paths, centerX, centerY, radius, globeRotation, strokeStyle, lineWidth) {
    paths.forEach((path) => {
      drawGeoWireframe(path, centerX, centerY, radius, globeRotation, strokeStyle, lineWidth);
    });
  }

  function drawChinaFocus(centerX, centerY, radius, globeRotation) {
    drawGeoWireframeSet(fallbackChinaFocusPaths, centerX, centerY, radius, globeRotation, "rgba(156, 255, 196, 0.92)", 1.6);
    fallbackChinaFocusPaths.forEach((pathPoints) => {
      const projected = pathPoints.map(([lon, lat]) => projectOnGlobe(lon, lat, centerX, centerY, radius, globeRotation));
      const visible = projected.filter((point) => point.visible);
      if (visible.length < 3) return;
      ctx.save();
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.clip();
      ctx.beginPath();
      visible.forEach((point, index) => {
        if (index === 0) ctx.moveTo(point.x, point.y);
        else ctx.lineTo(point.x, point.y);
      });
      ctx.closePath();
      ctx.fillStyle = "rgba(46, 180, 110, 0.12)";
      ctx.fill();
      ctx.restore();
    });
  }

  function quadraticBezierPoint(startX, startY, controlX, controlY, endX, endY, t) {
    const inverseT = 1 - t;
    return {
      x: inverseT * inverseT * startX + 2 * inverseT * t * controlX + t * t * endX,
      y: inverseT * inverseT * startY + 2 * inverseT * t * controlY + t * t * endY,
    };
  }

  function drawGlobePoints(centerX, centerY, radius, globeRotation) {
    const sortedPoints = globePoints
      .map((point) => ({ point, projection: projectOnGlobe(point.lon, point.lat, centerX, centerY, radius, globeRotation) }))
      .filter(({ projection }) => projection.visible)
      .sort((left, right) => left.projection.depth - right.projection.depth);

    sortedPoints.forEach(({ point, projection }) => {
      ctx.beginPath();
      ctx.fillStyle = point.chinaFocus ? "rgba(220, 242, 255, 0.94)" : "rgba(126, 146, 175, 0.26)";
      ctx.globalAlpha = point.chinaFocus ? (0.62 + projection.depth * 0.32) : (0.12 + projection.depth * 0.16);
      ctx.arc(projection.x, projection.y, point.chinaFocus ? (1.6 + projection.depth * 2.4) : (1 + projection.depth * 1.2), 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
  }

  function drawTribeRays(centerX, centerY, radius, globeRotation, reveal, elapsed) {
    const originProjection = projectOnGlobe(originLon, originLat, centerX, centerY, radius, globeRotation);
    if (!originProjection.visible) return;

    ctx.beginPath();
    ctx.fillStyle = `rgba(220, 244, 255, ${0.24 + reveal * 0.68})`;
    ctx.arc(originProjection.x, originProjection.y, 3 + reveal * 1.8, 0, Math.PI * 2);
    ctx.fill();

    tribeCards.forEach((card, index) => {
      if (card.lat == null || card.lon == null) return;
      const targetProjection = projectOnGlobe(card.lon, card.lat, centerX, centerY, radius, globeRotation);
      if (!targetProjection.visible) return;
      const slotAngle = card.slotAngle ?? Math.atan2(targetProjection.y - centerY, targetProjection.x - centerX);
      const ctrlX = (originProjection.x + targetProjection.x) / 2 + Math.cos(slotAngle) * radius * 0.14;
      const ctrlY = (originProjection.y + targetProjection.y) / 2 + Math.sin(slotAngle) * radius * 0.14 - radius * 0.18 - index * 3;
      ctx.beginPath();
      ctx.moveTo(originProjection.x, originProjection.y);
      ctx.quadraticCurveTo(ctrlX, ctrlY, targetProjection.x, targetProjection.y);
      ctx.save();
      ctx.strokeStyle = withAlpha(card.color, 0.52 + reveal * 0.34);
      ctx.lineWidth = 1.8;
      ctx.shadowColor = withAlpha(card.color, 0.42);
      ctx.shadowBlur = 12;
      ctx.stroke();
      ctx.restore();

      ctx.beginPath();
      ctx.fillStyle = withAlpha(card.color, 0.38 + reveal * 0.54);
      ctx.arc(targetProjection.x, targetProjection.y, 2 + reveal * 1.2, 0, Math.PI * 2);
      ctx.fill();

      const pulseT = ((elapsed * 0.00006) + index * 0.19) % 1;
      const pulse = quadraticBezierPoint(originProjection.x, originProjection.y, ctrlX, ctrlY, targetProjection.x, targetProjection.y, pulseT);
      ctx.beginPath();
      ctx.fillStyle = withAlpha(card.color, 0.88);
      ctx.arc(pulse.x, pulse.y, 2.2, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  function getGlobeBoundaryX(y, centerX, centerY, radius, side) {
    const offsetY = y - centerY;
    if (Math.abs(offsetY) >= radius) return null;
    const offsetX = Math.sqrt(Math.max(radius * radius - offsetY * offsetY, 0));
    return side === "right" ? centerX + offsetX : centerX - offsetX;
  }

  function layoutIntroCallouts(centerX, centerY, radius, globeRotation) {
    if (!calloutEls.length) return [];

    const viewportPaddingX = 18;
    const viewportPaddingY = 20;
    const sideGap = clamp(radius * 0.05, 12, 18);
    const laneSpread = clamp(radius * 0.045, 12, 20);
    const radialSpread = clamp(radius * 0.1, 28, 44);
    const stackGap = 12;
    const flowFigureRect = flowFigure?.getBoundingClientRect() || null;
    const copyContentRight = [
      intro.querySelector(".intro-title"),
      leadText,
      launchBtn,
      manifesto,
    ]
      .map((element) => element?.getBoundingClientRect())
      .filter(Boolean)
      .reduce((maxRight, rect) => Math.max(maxRight, rect.right), viewportPaddingX);
    const sideGroups = { left: [], right: [] };
    const layouts = [];

    tribeCards.forEach((card, index) => {
      if (card.lat == null || card.lon == null) return;

      const el = calloutEls[index];
      if (!el) return;

      const point = projectOnGlobe(card.lon, card.lat, centerX, centerY, radius, globeRotation);
      if (!point.visible) {
        el.style.opacity = "0";
        return;
      }

      el.style.opacity = "";

      const cardWidth = el.offsetWidth || 220;
      const cardHeight = el.offsetHeight || 24;
      const layoutPlan = INTRO_CALLOUT_LAYOUT_PLAN.get(card.branchId) || null;
      const side = layoutPlan?.side || (point.x >= centerX ? "right" : "left");
      const slotOffsets = INTRO_CALLOUT_SLOT_OFFSETS[side] || [0];
      const slotIndex = Math.min(layoutPlan?.slot ?? sideGroups[side].length, slotOffsets.length - 1);
      const lane = layoutPlan?.lane ?? slotIndex;
      const slotCenterY = centerY + radius * (slotOffsets[slotIndex] || 0);
      const laneOffset = lane * laneSpread;
      const slotMagnitude = Math.abs(slotOffsets[slotIndex] || 0);
      const radialOffset = radialSpread * (0.6 + slotMagnitude);
      const idealLeft = side === "right"
        ? centerX + radius + sideGap + radialOffset + laneOffset * 0.38
        : centerX - radius - cardWidth - sideGap - radialOffset - laneOffset * 0.22;

      sideGroups[side].push({
        index,
        el,
        point,
        side,
        width: cardWidth,
        height: cardHeight,
        idealLeft,
        idealTop: slotCenterY - cardHeight * 0.5,
      });
    });

    ["left", "right"].forEach((side) => {
      const items = sideGroups[side].sort((left, right) => left.idealTop - right.idealTop);
      if (!items.length) return;

      items.forEach((item, index) => {
        const minTop = viewportPaddingY;
        const maxTop = height - viewportPaddingY - item.height;
        const stackedTop = index === 0
          ? item.idealTop
          : Math.max(item.idealTop, items[index - 1].top + items[index - 1].height + stackGap);
        item.top = clamp(stackedTop, minTop, maxTop);
      });

      for (let index = items.length - 2; index >= 0; index -= 1) {
        const current = items[index];
        const next = items[index + 1];
        const maxTop = next.top - current.height - stackGap;
        current.top = Math.min(current.top, maxTop);
      }

      items.forEach((item) => {
        const minTop = viewportPaddingY;
        const maxTop = height - viewportPaddingY - item.height;
        item.top = clamp(item.top, minTop, maxTop);
        const flowBlockEdge = flowFigureRect && item.top + item.height > flowFigureRect.top - 12
          ? flowFigureRect.right + 18
          : viewportPaddingX;
        const leftReservedEdge = Math.max(
          viewportPaddingX,
          copyContentRight + 24,
          flowBlockEdge,
        );
        const minLeft = item.side === "left" ? leftReservedEdge : viewportPaddingX;
        const maxLeft = width - viewportPaddingX - item.width;

        item.left = clamp(item.idealLeft, minLeft, maxLeft);
        item.anchorX = item.side === "right" ? item.left : item.left + item.width;
        item.anchorY = item.top + item.height * 0.5;
        layouts[item.index] = item;
      });

      items.forEach((item) => {
        item.el.dataset.side = item.side;
        item.el.style.left = `${item.left.toFixed(1)}px`;
        item.el.style.top = `${item.top.toFixed(1)}px`;
        item.el.style.right = "auto";
      });
    });

    return layouts;
  }

  function drawCalloutLines(centerX, centerY, radius, globeRotation, reveal) {
    const layouts = layoutIntroCallouts(centerX, centerY, radius, globeRotation);
    if (!layouts.length) return;

    layouts.forEach((item, index) => {
      if (!item) return;

      const card = tribeCards[index];

      ctx.beginPath();
      ctx.moveTo(item.point.x, item.point.y);
      ctx.lineTo(item.anchorX, item.anchorY);
      ctx.save();
      ctx.strokeStyle = withAlpha(card.color, 0.58 + reveal * 0.28);
      ctx.lineWidth = 1.7;
  ctx.lineCap = "round";
      ctx.shadowColor = withAlpha(card.color, 0.38);
      ctx.shadowBlur = 10;
      ctx.stroke();
      ctx.restore();
    });
  }

  function primeIntroReveal() {
    introCopy.style.setProperty("opacity", "0", "important");
    introCopy.style.setProperty("transform", "translateY(28px)", "important");
    introCopy.style.setProperty("transition", "opacity 0.9s ease, transform 0.9s ease", "important");
    introCopy.style.setProperty("pointer-events", "none", "important");
    if (introCopyMask) {
      introCopyMask.style.setProperty("opacity", "1", "important");
    }
    if (filmCaption) {
      filmCaption.style.setProperty("opacity", "0", "important");
      filmCaption.style.setProperty("transform", "translateY(28px)", "important");
      filmCaption.style.setProperty("transition", "opacity 0.9s ease, transform 0.9s ease", "important");
    }
  }

  function revealIntroContent() {
    if (introReady) return;
    introReady = true;
    intro.classList.remove("is-cinematic");
    intro.classList.add("is-ready");
    window.setTimeout(() => {
      if (introCopyMask) {
        introCopyMask.style.setProperty("opacity", "0", "important");
      }
      introCopy.style.setProperty("opacity", "1", "important");
      introCopy.style.setProperty("transform", "translateY(0)", "important");
      introCopy.style.setProperty("pointer-events", "auto", "important");
      if (filmCaption) {
        filmCaption.style.setProperty("opacity", "1", "important");
        filmCaption.style.setProperty("transform", "translateY(0)", "important");
      }
    }, 24);
  }

  function drawIntroFrame(timestamp, scheduleNext = true) {
    if (!startTime) startTime = timestamp;
    lastIntroFrameAt = timestamp;
    const elapsed = timestamp - startTime;
    const travelProgress = clamp(elapsed / 5400, 0, 1);
    const cinematicProgress = easeOutCubic(travelProgress);
    const revealProgress = clamp((elapsed - 3200) / 1300, 0, 1);
    const homeReveal = easeInOutCubic(revealProgress);
    const tribeReveal = easeInOutCubic(clamp((elapsed - 4100) / 1200, 0, 1));

    ctx.clearRect(0, 0, width, height);

    starField.forEach((star) => {
      const floatWave = Math.sin(elapsed * star.floatSpeed + star.phase);
      const swayWave = Math.cos(elapsed * star.floatSpeed * 0.72 + star.phase);
      const pulse = 0.58 + 0.42 * ((Math.sin(elapsed * star.pulseSpeed + star.phase) + 1) * 0.5);
      const x = star.x * width + swayWave * star.swayAmplitude;
      const y = star.y * height + floatWave * star.floatAmplitude;
      if (x < -12 || x > width + 12 || y < -12 || y > height + 12) return;
      ctx.beginPath();
      ctx.fillStyle = `rgba(225, 238, 255, ${(star.alpha * pulse).toFixed(3)})`;
      ctx.shadowColor = `rgba(178, 220, 255, ${(star.alpha * pulse * 0.54).toFixed(3)})`;
      ctx.shadowBlur = star.size * 3.2 * pulse;
      ctx.arc(x, y, star.size * (0.86 + pulse * 0.32), 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.shadowBlur = 0;
    ctx.shadowColor = "transparent";

    const centerX = width * (0.72 - cinematicProgress * 0.04);
    const centerY = height * (0.62 - cinematicProgress * 0.08);
    const radius = Math.min(width, height) * (0.12 + cinematicProgress * 0.23);
    const orbitProgress = clamp(travelProgress / 0.8, 0, 1);
    const globeRotation = startRotation + (finalRotation - startRotation) * easeOutCubic(orbitProgress);

    const atmosphere = ctx.createRadialGradient(centerX, centerY, radius * 0.35, centerX, centerY, radius * 1.4);
    atmosphere.addColorStop(0, "rgba(108, 180, 255, 0.32)");
    atmosphere.addColorStop(0.55, "rgba(48, 106, 220, 0.12)");
    atmosphere.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = atmosphere;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius * 1.5, 0, Math.PI * 2);
    ctx.fill();

    const globeFill = ctx.createRadialGradient(centerX - radius * 0.32, centerY - radius * 0.45, radius * 0.08, centerX, centerY, radius * 1.1);
    globeFill.addColorStop(0, "rgba(124, 194, 255, 0.72)");
    globeFill.addColorStop(0.28, "rgba(26, 82, 194, 0.88)");
    globeFill.addColorStop(0.72, "rgba(4, 18, 58, 0.98)");
    globeFill.addColorStop(1, "rgba(1, 6, 18, 1)");
    ctx.beginPath();
    ctx.fillStyle = globeFill;
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.fill();

    drawSphereGrid(centerX, centerY, radius, globeRotation);
    if (worldBorderPaths.length) {
      drawGeoWireframeSet(worldBorderPaths, centerX, centerY, radius, globeRotation, "rgba(74, 198, 126, 0.22)", 0.9);
    } else {
      worldWireframes.forEach((path) => {
        drawGeoWireframe(path, centerX, centerY, radius, globeRotation, "rgba(74, 198, 126, 0.18)", 1);
      });
    }

    if (chinaBorderPaths.length) {
      drawGeoWireframeSet(chinaBorderPaths, centerX, centerY, radius, globeRotation, "rgba(156, 255, 196, 0.95)", 1.8);
    } else {
      drawChinaFocus(centerX, centerY, radius, globeRotation);
    }
    drawGlobePoints(centerX, centerY, radius, globeRotation);
    if (tribeReveal > 0.02) {
      drawTribeRays(centerX, centerY, radius, globeRotation, tribeReveal, elapsed);
      drawCalloutLines(centerX, centerY, radius, globeRotation, tribeReveal);
    }

    ctx.beginPath();
    ctx.strokeStyle = "rgba(176, 224, 255, 0.55)";
    ctx.lineWidth = 1.2;
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.strokeStyle = "rgba(124, 194, 255, 0.26)";
    ctx.lineWidth = 1;
    ctx.arc(centerX, centerY, radius * 1.08, 0, Math.PI * 2);
    ctx.stroke();

    if (filmCaption) {
      if (travelProgress < 0.34) {
        filmCaption.textContent = "FROM THE FAR HORIZON OF THE STEPPE";
      } else if (travelProgress < 0.68) {
        filmCaption.textContent = "ORBITING THE FINAL MIGRATION GLOBE";
      } else {
        filmCaption.textContent = "LANDING ON THE FIVE FINAL TRIBAL DESTINATIONS";
      }
    }

    if (!introReady && travelProgress >= 0.72) {
      revealIntroContent();
    }

    if (!calloutsReady && tribeReveal >= 0.08) {
      calloutsReady = true;
      intro.classList.add("callouts-ready");
    }

    if (scheduleNext) {
      rafId = window.requestAnimationFrame((nextTimestamp) => drawIntroFrame(nextTimestamp, true));
    }
  }

  function launchExperience() {
    if (introFallbackTimer) {
      window.clearInterval(introFallbackTimer);
      introFallbackTimer = 0;
    }
    stopPlayback();
    syncTimelinePositionFromBp(timeline[0] || 0);
    render();
    document.body.classList.remove("intro-active");
  }

  resizeIntroCanvas();
  window.addEventListener("resize", resizeIntroCanvas);
  launchBtn.addEventListener("click", launchExperience);
  primeIntroReveal();
  introFallbackTimer = window.setInterval(() => {
    if (!document.body.classList.contains("intro-active")) {
      window.clearInterval(introFallbackTimer);
      introFallbackTimer = 0;
      return;
    }
    const now = performance.now();
    if (now - lastIntroFrameAt > 12) {
      drawIntroFrame(now, false);
    }
  }, 16);
  rafId = window.requestAnimationFrame((timestamp) => drawIntroFrame(timestamp, true));

  window.addEventListener("pagehide", () => {
    if (rafId) {
      window.cancelAnimationFrame(rafId);
    }
    if (introFallbackTimer) {
      window.clearInterval(introFallbackTimer);
    }
  }, { once: true });
})();

