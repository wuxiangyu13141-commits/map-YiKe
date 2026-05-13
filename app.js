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
const slider = document.getElementById("timelineSlider");
const playButton = document.getElementById("playButton");
const timelinePlayButton = document.getElementById("timelinePlayButton");
const jumpModernButton = document.getElementById("jumpModernButton");
const currentTimeLabel = document.getElementById("currentTimeLabel");
const currentModeLabel = document.getElementById("currentModeLabel");
const tickLabel = document.getElementById("tickLabel");
const branchLegend = document.getElementById("branchLegend");
const sampleList = document.getElementById("sampleList");
const originMarker = document.getElementById("originMarker");
const originMarkerText = document.getElementById("originMarkerText");

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

const SVG_NS = "http://www.w3.org/2000/svg";
const regionMap = new Map(data.regions.map((region) => [region.id, region]));
const branchMap = new Map(data.branches.map((branch) => [branch.id, branch]));
const sampleMap = new Map(data.samples.map((sample) => [sample.id, sample]));
const compressedCommonPrefix = getCompressedCommonPrefix();
const PLAYBACK_INTERVAL_MS = 550; // 约20秒播放完全程（~37步 × 550ms）

const originBranch = branchMap.get(data.meta.branch);

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
if (!timelineSteps.includes(0)) timelineSteps.push(0);

const timeline = [...new Set(timelineSteps)].sort((a, b) => b - a);
if (originMarker && originBranch) {
  // 非线性时间轴下，根据origin在steps中的位置计算标记位置
  const originIndex = timeline.indexOf(originAge);
  const originPosition = originIndex >= 0 
    ? (originIndex / (timeline.length - 1)) * 100 
    : ((data.meta.timelineStartBP - originBranch.age) / data.meta.timelineStartBP) * 100;
  originMarker.style.setProperty("--pos", `${originPosition}%`);
  originMarker.setAttribute("title", `${data.meta.branch} 从 ${formatTime(originBranch.age)} 开始出现`);
}

if (originMarkerText && originBranch) {
  originMarkerText.textContent = `宗族出现起点（${formatTime(originBranch.age)}）`;
}

// 简化时间轴标签：只显示起点、宗族出现点、终点
(function updateAxisLabels() {
  const axisContainer = document.querySelector('.axis-labels');
  if (!axisContainer) return;
  const N = timeline.length;
  const originIdx = timeline.indexOf(originAge);
  const labels = [
    { bp: data.meta.timelineStartBP, text: `距今 ${data.meta.timelineStartBP} 年`, idx: 0, cls: 'axis-label axis-label-start' },
    { bp: originAge, text: `宗族出现\n${originAge}年前`, idx: originIdx, cls: 'axis-label axis-label-origin' },
    { bp: 0, text: '现代', idx: N - 1, cls: 'axis-label axis-label-end' },
  ];
  axisContainer.innerHTML = '';
  labels.forEach(({ text, idx, cls }) => {
    const pos = (idx / (N - 1)) * 100;
    const span = document.createElement('span');
    span.className = cls;
    span.style.setProperty('--pos', `${pos.toFixed(1)}%`);
    span.textContent = text.replace('\\n', '\n');
    axisContainer.appendChild(span);
  });
})();


let currentIndex = 0;
let animationFrameId = null;
const originStartIndex = getOriginStartIndex();

slider.max = String(timeline.length - 1);

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
  currentIndex = Number(slider.value);
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
  currentIndex = timeline.length - 1;
  slider.value = String(currentIndex);
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
  if (animationFrameId) {
    clearTimeout(animationFrameId);
    animationFrameId = null;
  }
  updatePlayIcons(false);
}

// 动态获取当前帧的播放间隔：宗族出现前快速，出现后慢速（比基础速度多 15 秒总时长）
function getTickInterval() {
  if (currentIndex < originStartIndex) {
    return 220; // 宗族出现前：快速跳过稀疏段
  }
  // 宗族出现后：在基础 550ms 上额外分配 15 秒
  const denseSteps = Math.max(timeline.length - originStartIndex, 1);
  return PLAYBACK_INTERVAL_MS + Math.round(15000 / denseSteps);
}

function togglePlayback() {
  if (animationFrameId) {
    // 正在播放 → 暂停在当前位置
    stopPlayback();
    return;
  }
  // 未播放 → 从头开始播放；已到末尾则重置到0
  if (currentIndex >= timeline.length - 1) currentIndex = 0;
  updatePlayIcons(true);
  const tick = () => {
    if (currentIndex >= timeline.length - 1) {
      stopPlayback();
      return;
    }
    currentIndex += 1;
    slider.value = String(currentIndex);
    render();
    animationFrameId = window.setTimeout(tick, getTickInterval());
  };
  animationFrameId = window.setTimeout(tick, getTickInterval());
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
  const { lonMin, lonMax, latMin, latMax } = data.meta.focus;
  const x = lonToX(lonMin);
  const y = latToY(latMax);
  const width = lonToX(lonMax) - x;
  const height = latToY(latMin) - y;
  svg.setAttribute("viewBox", `${x} ${y} ${width} ${height}`);
  // 记录初始 viewBox 供缩放还原使用
  svg._initVB = { x, y, width, height };
}

// ── 地图缩放控件 ─────────────────────────────────────────────────────────
function getViewBox() {
  const vb = svg.getAttribute("viewBox").split(" ").map(Number);
  return { x: vb[0], y: vb[1], width: vb[2], height: vb[3] };
}

function setViewBox(x, y, width, height) {
  svg.setAttribute("viewBox", `${x} ${y} ${width} ${height}`);
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

function renderFocusFrame() {
  // 不渲染边框和标签
  focusLayer.textContent = "";
}

function lonToX(lon) {
  return ((lon + 180) / 360) * 1000;
}

function latToY(lat) {
  return ((90 - lat) / 180) * 500;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
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
  const age = Math.max(branch.age, 1);
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

  const [lat, lon] = getOriginCenter(branch);
  const cx = lonToX(lon);
  const cy = latToY(lat);

  const region = branch.regionId ? regionMap.get(branch.regionId) : null;
  const points = region ? region.polygon : buildFallbackPolygon(branch);
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
  return bp === 0 ? "现代" : `距今 ${bp} 年`;
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
  const origin = getOriginCenter(branch);
  const region = branch.regionId ? regionMap.get(branch.regionId) : null;
  const rawPoints = region ? region.polygon : buildFallbackPolygon(branch);

  if (!rawPoints || rawPoints.length < 3) {
    return "";
  }

  // 将多边形坐标转换为平滑椭圆点集，使形状为椭圆
  const targetPoints = polygonToEllipsePoints(rawPoints);

  return targetPoints
    .map(([lon, lat], index) => {
      const currentLon = origin[1] + (lon - origin[1]) * progress;
      const currentLat = origin[0] + (lat - origin[0]) * progress;
      const command = index === 0 ? "M" : "L";
      return `${command} ${lonToX(currentLon).toFixed(2)} ${latToY(currentLat).toFixed(2)}`;
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
  // 使用Y4569根节点的区域多边形质心作为起始点（比样本平均坐标更准确）
  const root = branchMap.get(data.meta.branch);
  const rootRegion = root && root.regionId ? regionMap.get(root.regionId) : null;
  if (rootRegion && rootRegion.polygon && rootRegion.polygon.length > 0) {
    const pts = rootRegion.polygon;
    const lon = pts.reduce((s, p) => s + p[0], 0) / pts.length;
    const lat = pts.reduce((s, p) => s + p[1], 0) / pts.length;
    return [lat, lon]; // 格式 [lat, lon]
  }
  return root ? root.center : branch.center;
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

  const originPt = getOriginCenter(branchMap.get(data.meta.branch) || visibleBranches[0]);
  if (!originPt) return;
  const ox = lonToX(originPt[1]);
  const oy = latToY(originPt[0]);
  const defs = svg.querySelector('defs');

  visibleBranches.forEach(branch => {
    const age = Math.max(branch.age, 1);
    const progress = clamp((age - bp) / age, 0.08, 1);
    const tProgress = clamp((age - bp) / age, 0, 1);
    const fadeIn = clamp(tProgress / 0.20, 0, 1);

    // 计算目的地中心
    const region = branch.regionId ? regionMap.get(branch.regionId) : null;
    const rawPts = region ? region.polygon : buildFallbackPolygon(branch);
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
  const bp = timeline[currentIndex];
  const modernSamples = getVisibleModernSamples(bp);

  currentTimeLabel.textContent = formatTime(bp);
  currentModeLabel.textContent = bp === 0 ? "现代样本点状态" : "古代扩散阶段";
  tickLabel.textContent = `第 ${currentIndex + 1} 格 / ${timeline.length} 格`;

  pointLayer.textContent = "";

  // 检测时间回退：bp 增大表示向过去移动
  const currentBp = bp;
  const isTimeRewinding = prevBp !== null && currentBp > prevBp;
  prevBp = currentBp;

  if (isTimeRewinding) {
    // 时间回退：清除尚未出现的分支的历史轨迹
    data.branches.forEach(branch => {
      if (branch.age < currentBp) {
        trailHistory.delete(branch.id);
      }
    });
  }

  // 每帧重建两层（渐变主体层 + 涟漪轨迹层）
  ancientLayer.textContent = "";
  trailLayer.textContent = "";

  // 绘制所有分支：bp <= branch.age 时显示，进度随时间动态扩散
  
  const visibleBranchesForRender = [];
  data.branches.forEach((branch) => {
    const age = Math.max(branch.age, 1);
    
    // 只显示时间轴已到达该分支出现时间的分支（bp <= branch.age）
    if (bp > branch.age) return;
    
    visibleBranchesForRender.push(branch);
    
    // 根据当前时间动态计算进度：0.08=刚出现，1=现代（区域随时间扩散，不冻结）
    const progress = clamp((age - bp) / age, 0.08, 1);
    
    const pathData = buildAnimatedPolygon(branch, progress);
    if (!pathData) {
      return;
    }

    // 颜色与透明度随时间变化：深红高透明→白色低透明→支系色
    const dynamicColor = getBranchColorAtTime(branch, bp);
    const dynamicColorRgb = [
      parseInt(dynamicColor.slice(1, 3), 16),
      parseInt(dynamicColor.slice(3, 5), 16),
      parseInt(dynamicColor.slice(5, 7), 16),
    ];
    const [dr, dg, db] = dynamicColorRgb;
    // 时间进度：0=刚出现，1=现代
    const tProgress = clamp((age - bp) / age, 0, 1);

    // 淡入系数：前15%时间从透明渐变为不透明（这是"分别出现"的核心）
    const fadeIn = clamp(tProgress / 0.15, 0, 1);

    // 目标不透明度：深红0.85 → 白0.40 → 支系色0.85（确保区域始终清晰可见）
    let baseOp;
    if (tProgress <= 0.67) {
      baseOp = 0.85 - (tProgress / 0.67) * 0.45; // 0.85 → 0.40
    } else {
      const t4 = (tProgress - 0.67) / 0.33;
      baseOp = 0.40 + t4 * 0.45; // 0.40 → 0.85
    }
    const timeOpacity = fadeIn * baseOp;

    // ── 流水拖尾效果 ──────────────────────────────────────────────────
    // 历史帧以极低透明度填充，多帧叠加后靠近起源的区域不断积累
    // → 近起源区域颜色深（多帧叠加），扩散前沿颜色浅（少帧），形成连续流水感
    const history = trailHistory.get(branch.id) || [];
    const TRAIL_FILL_OP = 0.030; // 提高每帧透明度：叠加后近原点区域清晰可见，前沿轻淡
    history.forEach((ring) => {
      const trailEl = document.createElementNS(SVG_NS, "path");
      trailEl.setAttribute("d", ring.pathData);
      trailEl.setAttribute("fill", `rgba(${ring.dr}, ${ring.dg}, ${ring.db}, ${TRAIL_FILL_OP})`);
      trailEl.setAttribute("stroke", "none");
      trailEl.setAttribute("filter", "url(#branchFuzzyEdge)");
      trailLayer.appendChild(trailEl);  // 放到 trailLayer（主形状之下），避免过亮
    });

    // 当前帧：径向渐变主体（扩散前锋）+ 椭圆模糊边界
    const gradId = ensureBranchGradient(branch, dr, dg, db);
    const path = document.createElementNS(SVG_NS, "path");
    path.setAttribute("class", "ancient-shape");
    path.setAttribute("d", pathData);
    path.setAttribute("fill", `url(#${gradId})`);
    path.setAttribute("opacity", timeOpacity.toFixed(3));
    // 添加半透明轮廓描边，使区域边界更清晰（不再是纯雾气效果）
    path.setAttribute("stroke", `rgba(${dr},${dg},${db},0.65)`);
    path.setAttribute("stroke-width", "0.7");
    path.setAttribute("filter", "url(#branchFuzzyEdge)");
    ancientLayer.appendChild(path);

    // ── 迁移路径拖尾：由 updateFlowLines 持久红色流水层接管 ──────────

    // 记录当前帧到历史（更频繁记录，使拖尾更平滑）
    const lastHistProg = history.length > 0 ? history[history.length - 1].progress : -1;
    if (progress - lastHistProg >= 0.025 || history.length === 0) {
      history.push({ pathData, dr, dg, db, progress });
      if (history.length > MAX_TRAIL_RINGS) history.shift();
      trailHistory.set(branch.id, history);
    }
  });

  // 更新持久红色流水线（从起源到各分支目的地）
  updateFlowLines(visibleBranchesForRender, bp);

  // 绘制分支家族文字标注（跟随扩散位置，箭头引线）
  branchLabelLayer.textContent = "";
  // 为每个分支找出其family标注
  const branchFamilyMap = new Map();
  data.samples.forEach(s => {
    if (!s.family) return;
    const tid = s.branchSegments?.at(-1) || 'Y4569';
    if (!branchFamilyMap.has(tid)) branchFamilyMap.set(tid, new Set());
    branchFamilyMap.get(tid).add(s.family);
  });

  // 收集所有标签信息，再统一防碰撞排布
  const labelItems = [];
  visibleBranchesForRender.forEach(branch => {
    const families = branchFamilyMap.get(branch.id);
    if (!families || families.size === 0) return;
    const dimOnMap = currentMapHighlightBranches !== null && !currentMapHighlightBranches.has(branch.id);

    const origin = getOriginCenter(branch);
    const region = branch.regionId ? regionMap.get(branch.regionId) : null;
    const targetPoints = region ? region.polygon : buildFallbackPolygon(branch);
    if (!targetPoints || targetPoints.length < 3) return;

    const age = Math.max(branch.age, 1);
    const progress = clamp((age - bp) / age, 0.08, 1);

    let sumX = 0, sumY = 0;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    // 同时计算最终展开位置（progress=1），用于稳定标注方向
    let fSumX = 0, fSumY = 0;
    let fminX = Infinity, fmaxX = -Infinity, fminY = Infinity, fmaxY = -Infinity;
    targetPoints.forEach(([lon, lat]) => {
      const cLon = origin[1] + (lon - origin[1]) * progress;
      const cLat = origin[0] + (lat - origin[0]) * progress;
      const px = lonToX(cLon);
      const py = latToY(cLat);
      sumX += px; sumY += py;
      if (px < minX) minX = px; if (px > maxX) maxX = px;
      if (py < minY) minY = py; if (py > maxY) maxY = py;
      // 最终位置（progress=1，不插值）
      const fpx = lonToX(lon);
      const fpy = latToY(lat);
      fSumX += fpx; fSumY += fpy;
      if (fpx < fminX) fminX = fpx; if (fpx > fmaxX) fmaxX = fpx;
      if (fpy < fminY) fminY = fpy; if (fpy > fmaxY) fmaxY = fpy;
    });
    const cx = sumX / targetPoints.length;
    const cy = sumY / targetPoints.length;
    const fcx = fSumX / targetPoints.length; // 最终质心，用于标注位置判断

    const labelText = [...families].join('/');
    const [dr, dg, db] = [
      parseInt(branch.color.slice(1,3),16),
      parseInt(branch.color.slice(3,5),16),
      parseInt(branch.color.slice(5,7),16),
    ];
    const branchLabel = branch.label || branch.id;
    labelItems.push({ cx, cy, minX, maxX, minY, maxY, fcx, fminX, fmaxX, fminY, fmaxY, labelText, branchLabel, dr, dg, db, dim: dimOnMap, branchAge: branch.age });
  });

  // 防碰撞排布，标注包含支系ID和部族名
  const FONT_SIZE = 7.5;
  const YEAR_FONT_SIZE = 6;
  const LINE_H = FONT_SIZE + 4;
  labelItems.sort((a, b) => a.cy - b.cy);
  // 预先将所有区域边界框加入占用区域，标注不会覆盖任何扩散图形
  const placedRects = labelItems.map(item => ({
    x: item.minX - 6, y: item.minY - 6,
    w: item.maxX - item.minX + 12, h: item.maxY - item.minY + 12
  }));
  labelItems.forEach(item => {
    const { cx, cy, fminX, fmaxX, fminY, fmaxY, fcx, labelText, branchLabel, dr, dg, db, dim, branchAge } = item;
    // 标注淡入：同步区域展开动画从透明到可见
    const labelTProgress = clamp((Math.max(branchAge,1) - bp) / Math.max(branchAge,1), 0, 1);
    const labelFadeIn = clamp(labelTProgress / 0.25, 0, 1); // 标注在前25%时间内淡入
    const alpha = dim ? 0.18 * labelFadeIn : 0.92 * labelFadeIn;
    const lineAlpha = dim ? 0.10 * labelFadeIn : 0.60 * labelFadeIn;
    // 使分支颜色更亮（避免深色在地图上看不清）
    const br = Math.min(255, dr + 60), bg = Math.min(255, dg + 60), bb = Math.min(255, db + 60);
    const mainTextW = Math.max(labelText.length * FONT_SIZE * 0.65, branchLabel.length * YEAR_FONT_SIZE * 0.65);
    const boxH = LINE_H * 2 + 4;
    const PAD = 14; // 标注与区域边缘的间距

    // 根据区域最终位置决定标注方向（稳定，不随动画变化）
    // 右半区域(fcx > 620) → 斜向左上；其他 → 斜向右上
    let lx, ly, arrowAnchorX, arrowAnchorY;
    if (fcx > 620) {
      // 斜向左上方放置
      lx = fminX - mainTextW - PAD;
      ly = fminY - PAD - boxH * 0.6;
      arrowAnchorX = cx; // 箭头指向当前动画质心
      arrowAnchorY = cy;
    } else {
      // 斜向右上方放置
      lx = fmaxX + PAD * 0.5;
      ly = fminY - PAD - boxH * 0.4;
      arrowAnchorX = cx;
      arrowAnchorY = cy;
    }

    // 边界限制，防止超出地图
    lx = Math.max(4, Math.min(lx, 994 - mainTextW));
    ly = Math.max(LINE_H + 2, Math.min(ly, 490 - boxH));

    // 防碰撞：向下移动
    let attempts = 0;
    while (attempts < 25) {
      const r = { x: lx - 4, y: ly - 2, w: mainTextW + 12, h: boxH };
      const collides = placedRects.some(pr =>
        r.x < pr.x + pr.w && r.x + r.w > pr.x && r.y < pr.y + pr.h && r.y + r.h > pr.y
      );
      if (!collides) break;
      ly += LINE_H;
      attempts++;
    }
    placedRects.push({ x: lx - 4, y: ly - 2, w: mainTextW + 12, h: boxH });

    // 虚线引线从多边形边缘出发到标注框
    const labelMidX = lx + mainTextW * 0.5;
    const labelMidY = ly + LINE_H;
    const dxA = arrowAnchorX - labelMidX;
    const dyA = arrowAnchorY - labelMidY;
    const distA = Math.sqrt(dxA * dxA + dyA * dyA);
    if (distA > 4) {
      const nx = dxA / distA, ny = dyA / distA;

      // 虚线主引线
      const line = document.createElementNS(SVG_NS, "line");
      line.setAttribute("x1", labelMidX.toFixed(1));
      line.setAttribute("y1", labelMidY.toFixed(1));
      line.setAttribute("x2", (arrowAnchorX - nx * 3).toFixed(1));
      line.setAttribute("y2", (arrowAnchorY - ny * 3).toFixed(1));
      line.setAttribute("stroke", `rgba(${br},${bg},${bb},${lineAlpha})`);
      line.setAttribute("stroke-width", "0.8");
      line.setAttribute("stroke-dasharray", "3.5,2");
      branchLabelLayer.appendChild(line);

      // 小三角箭头（指向区域边缘）
      const tipX = arrowAnchorX, tipY = arrowAnchorY;
      const baseX = arrowAnchorX - nx * 4.5, baseY = arrowAnchorY - ny * 4.5;
      const px = -ny * 2, py = nx * 2;
      const arrow = document.createElementNS(SVG_NS, "polygon");
      arrow.setAttribute("points", [
        `${tipX.toFixed(1)},${tipY.toFixed(1)}`,
        `${(baseX + px).toFixed(1)},${(baseY + py).toFixed(1)}`,
        `${(baseX - px).toFixed(1)},${(baseY - py).toFixed(1)}`
      ].join(' '));
      arrow.setAttribute("fill", `rgba(${br},${bg},${bb},${lineAlpha * 0.9})`);
      branchLabelLayer.appendChild(arrow);
    }

    // 文字颜色：向浅色偏移以与暗色地图形成对比
    const LIGHT = 238;
    const fillR = Math.round(dr * 0.28 + LIGHT * 0.72);
    const fillG = Math.round(dg * 0.28 + LIGHT * 0.72);
    const fillB = Math.round(db * 0.28 + LIGHT * 0.72);
    // 描边颜色：比填充色深（偏向原始支系色）
    const sR = Math.max(0, dr - 10), sG = Math.max(0, dg - 10), sB = Math.max(0, db - 10);

    // 第一行：支系ID（小字）
    const idText = document.createElementNS(SVG_NS, "text");
    idText.setAttribute("x", lx.toFixed(1));
    idText.setAttribute("y", ly.toFixed(1));
    idText.setAttribute("text-anchor", "start");
    idText.setAttribute("font-size", YEAR_FONT_SIZE);
    idText.setAttribute("font-family", "monospace, sans-serif");
    idText.setAttribute("fill", `rgba(${fillR},${fillG},${fillB},${alpha * 0.75})`);
    idText.setAttribute("stroke", `rgba(${sR},${sG},${sB},${alpha * 0.5})`);
    idText.setAttribute("stroke-width", "0.5");
    idText.setAttribute("paint-order", "stroke fill");
    idText.textContent = branchLabel;
    branchLabelLayer.appendChild(idText);

    // 第二行：部族名（主字）
    const text = document.createElementNS(SVG_NS, "text");
    text.setAttribute("x", lx.toFixed(1));
    text.setAttribute("y", (ly + LINE_H).toFixed(1));
    text.setAttribute("text-anchor", "start");
    text.setAttribute("font-size", FONT_SIZE);
    text.setAttribute("font-weight", "700");
    text.setAttribute("font-family", "sans-serif");
    text.setAttribute("fill", `rgba(${fillR},${fillG},${fillB},${alpha})`);
    text.setAttribute("stroke", `rgba(${sR},${sG},${sB},${alpha * 0.7})`);
    text.setAttribute("stroke-width", "1.2");
    text.setAttribute("paint-order", "stroke fill");
    text.textContent = labelText;
    branchLabelLayer.appendChild(text);
  });


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
  data.branches.forEach(b => {
    if (b.parentId) {
      if (!childrenOf.has(b.parentId)) childrenOf.set(b.parentId, []);
      childrenOf.get(b.parentId).push(b.id);
    }
  });

  data.branches.forEach(b => {
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

  data.branches.forEach(b => {
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

function initGenealogyTree() {
  const container = document.getElementById("treeSvg");
  if (!container || treeState.initialized) return;
  treeState.initialized = true;

  if (typeof echarts === 'undefined') {
    console.warn("ECharts not loaded — genealogy tree disabled");
    return;
  }

  initTreeMaps();
  currentTreeBp = timeline[currentIndex];

  echartsTreeInstance = echarts.init(container, null, { renderer: 'canvas' });

  const baseOpt = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      triggerOn: 'none',
      backgroundColor: 'rgba(15, 23, 42, 0.95)',
      borderColor: '#334155',
      borderWidth: 1,
      padding: [10, 14],
      borderRadius: 8,
      textStyle: { color: '#F8FAFC', fontSize: 13, fontWeight: '600' },
      formatter(params) {
        if (params.dataType === 'edge') return '';
        const raw = params.data._raw;
        if (!raw) return '';
        if (raw.type === 'sample') {
          const s = raw.sampleData;
          return `${s.id}<br/>族群：${s.ethnicity||'—'}<br/>${s.family?'家族：'+s.family+'<br/>':''}<br/>地点：${s.location||'—'}`;
        }
        return `${raw.id}（${raw.age ? `距今${raw.age}年` : '现代'}）`;
      },
    },
    series: [{
      id: 'familyTree',
      type: 'tree',
      data: buildTreeOptionData(currentTreeBp, null, treeState.expanded),
      roam: true,
      zoom: 1,
      scaleLimit: { min: 0.1, max: 4 },
      top: 10, bottom: 10, left: 100, right: 10,
      initialTreeDepth: -1,
      expandAndCollapse: false,
      emphasis: { disabled: true },
      lineStyle: { curveness: 0.55 },
      nodeGap: 12,
      layerPadding: 120,
      animationDuration: 550,
      animationDurationUpdate: 550,
      animationEasingUpdate: 'cubicInOut',
    }],
  };

  echartsTreeInstance.setOption(baseOpt);
  // 初始化后 ECharts 会自动在 canvas 范围内适配树布局（zoom=1）
  // 不额外调用 autoFitTreeZoom 以避免双重压缩导致节点重叠

  // 谱系树手动 tooltip
  const treeTooltip = document.createElement('div');
  treeTooltip.style.cssText = `
    position: fixed;
    background: rgba(15, 23, 42, 0.95);
    color: #F8FAFC;
    padding: 10px 14px;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 600;
    border: 1px solid #334155;
    backdrop-filter: blur(10px);
    pointer-events: none;
    display: none;
    z-index: 9999;
    line-height: 1.6;
    max-width: 220px;
  `;
  document.body.appendChild(treeTooltip);
  function showTreeTooltip(x, y, html) {
    treeTooltip.innerHTML = html;
    treeTooltip.style.display = 'block';
    const tw = treeTooltip.offsetWidth;
    const th = treeTooltip.offsetHeight;
    const lx = (x + 14 + tw > window.innerWidth) ? x - tw - 10 : x + 14;
    const ly = (y + th > window.innerHeight) ? y - th - 4 : y + 4;
    treeTooltip.style.left = lx + 'px';
    treeTooltip.style.top = ly + 'px';
    treeTooltip._visible = true;
  }
  function hideTreeTooltip() { treeTooltip.style.display = 'none'; treeTooltip._visible = false; }

  // 点击节点
  echartsTreeInstance.on('click', (params) => {
    const d = params.data;
    if (!d || !d._raw) return;
    if (d._raw.type === 'sample') {
      highlightSampleOnMap(d._raw.sampleData);
      const s = d._raw.sampleData;
      showTreeTooltip(params.event.event.clientX, params.event.event.clientY,
        `${s.id}<br/>族群：${s.ethnicity||'—'}${s.family?'<br/>家族：'+s.family:''}<br/>地点：${s.location||'—'}`);
      // 同步激活流线高亮（样本节点也参与祖先路径高亮）
      const newHl = (currentTreeHighlight === d.id) ? null : d.id;
      currentTreeHighlight = newHl;
      currentMapHighlightBranches = newHl ? calcMapHighlightBranches(d.id) : null;
      echartsTreeInstance.setOption({ series: [{ id:'familyTree', data: buildTreeOptionData(currentTreeBp, currentTreeHighlight, treeState.expanded) }] }, false);
      setTimeout(() => render(), 0);
      return;
    }
    const newHl = (currentTreeHighlight === d.id) ? null : d.id;
    if (newHl) {
      showTreeTooltip(params.event.event.clientX, params.event.event.clientY,
        `${d._raw.id}（${d._raw.age ? `距今${d._raw.age}年` : '现代'}）`);
    } else {
      hideTreeTooltip();
    }
    currentTreeHighlight = newHl;
    currentMapHighlightBranches = newHl ? calcMapHighlightBranches(newHl) : null;
    // 不跳转时间轴，高亮仅为视觉叠加，保持当前时间节点可见性
    echartsTreeInstance.setOption({ series: [{ id:'familyTree', data: buildTreeOptionData(currentTreeBp, currentTreeHighlight, treeState.expanded) }] }, false);
    // 延迟一帧再 render，让 tooltip 有时间先展示
    setTimeout(() => render(), 0); // 重绘地图以应用高亮/变暗效果（含流线高亮 + 时间跳转）
  });

  // 点击空白取消高亮
  echartsTreeInstance.getZr().on('click', (evt) => {
    if (!evt.target && (currentTreeHighlight || treeTooltip._visible)) {
      hideTreeTooltip();
      currentTreeHighlight = null;
      currentMapHighlightBranches = null;
      echartsTreeInstance.setOption({ series: [{ id:'familyTree', data: buildTreeOptionData(currentTreeBp, null, treeState.expanded) }] }, false);
      render(); // 恢复地图全亮
    }
  });

  // 按钮
  let zoom = 1;
  const setZoom = (z) => {
    zoom = Math.max(0.1, Math.min(z, 4));
    echartsTreeInstance.setOption({ series: [{ id:'familyTree', zoom }] }, false);
  };
  document.getElementById("treeZoomIn")?.addEventListener("click", () => setZoom(zoom + 0.18));
  document.getElementById("treeZoomOut")?.addEventListener("click", () => setZoom(zoom - 0.18));
  document.getElementById("treeResetView")?.addEventListener("click", () => {
    zoom = 1;
    echartsTreeInstance.setOption({
      series: [{ id: 'familyTree', zoom: 1, center: ['50%', '50%'] }],
    }, false);
  });
  document.getElementById("treeExpandBtn")?.addEventListener("click", toggleTreeExpand);

  echartsTreeInstance.on('roam', (p) => {
    if (p.zoom) { zoom = Math.max(0.25, Math.min(zoom * p.zoom, 4)); }
  });
}

function renderGenealogyTree(bp) {
  if (!treeState.initialized || !echartsTreeInstance) return;
  if (treeState.expanded) return; // 展开全屏模式：树固定显示 bp=0，不随地图时间轴变化
  if (bp === currentTreeBp) return; // bp未变化时跳过
  currentTreeBp = bp;
  echartsTreeInstance.setOption({
    series: [{ id: 'familyTree', data: buildTreeOptionData(bp, currentTreeHighlight, treeState.expanded) }],
  }, false);
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

function autoFitTreeZoom() {
  if (!echartsTreeInstance) return;
  const container = document.getElementById("treeSvg");
  if (!container) return;
  const containerH = container.clientHeight || 700;
  const treeData = buildTreeOptionData(currentTreeBp, null, treeState.expanded);
  const leafCount = countLeafNodes(treeData);
  // 估算树高度：每叶节点约 34px（直径16 + nodeGap18）
  const estimatedH = leafCount * 34;
  const fitZoom = Math.min(1, (containerH - 20) / estimatedH);
  zoom = Math.max(0.1, fitZoom);
  echartsTreeInstance.setOption({ series: [{ id: 'familyTree', zoom }] }, false);
}

function toggleTreeExpand() {
  treeState.expanded = !treeState.expanded;
  const card = document.querySelector(".tree-card");
  const btn = document.getElementById("treeExpandBtn");
  if (treeState.expanded) {
    card.classList.remove("tree-card--collapsing");
    card.classList.add("tree-card--expanded");
    if (btn) btn.textContent = "⤡";
    // 展开时显示完整谱系树（bp=0）
    currentTreeBp = -1;
    setTimeout(() => {
      if (echartsTreeInstance) {
        echartsTreeInstance.resize();
        echartsTreeInstance.setOption({ series: [{ id: 'familyTree', data: buildTreeOptionData(0, currentTreeHighlight, true) }] }, false);
        currentTreeBp = 0;
      }
    }, 60);
  } else {
    card.classList.add("tree-card--collapsing");
    // 动画结束后才真正移除 expanded
    const onEnd = () => {
      card.classList.remove("tree-card--expanded", "tree-card--collapsing");
      card.removeEventListener("animationend", onEnd);
      setTimeout(() => {
        if (echartsTreeInstance) {
          echartsTreeInstance.resize();
          // 归位：重置 zoom 和 pan，并恢复当前时间对应的谱系树
          const restoreBp = timeline[currentIndex];
          currentTreeBp = -1;
          echartsTreeInstance.setOption({ series: [{ id: 'familyTree', zoom: 1, center: ['50%', '50%'], data: buildTreeOptionData(restoreBp, currentTreeHighlight, false) }] }, false);
          currentTreeBp = restoreBp;
        }
      }, 30);
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

