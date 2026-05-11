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
const ancientLayer = document.getElementById("ancientLayer");
const pointLayer = document.getElementById("pointLayer");
const branchLabelLayer = document.getElementById("branchLabelLayer");
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
const PLAYBACK_INTERVAL_MS = 350;

const originBranch = branchMap.get(data.meta.branch);

const timelineSteps = [];
for (let bp = data.meta.timelineStartBP; bp >= 0; bp -= data.meta.timelineStepYears) {
  timelineSteps.push(bp);
}

// 将宗族出现点插入时间轴，确保能精确从该时刻起播（如 1260 年）
if (originBranch && !timelineSteps.includes(originBranch.age)) {
  timelineSteps.push(originBranch.age);
}

const timeline = [...new Set(timelineSteps)].sort((a, b) => b - a);
if (originMarker && originBranch) {
  const originPosition = ((data.meta.timelineStartBP - originBranch.age) / data.meta.timelineStartBP) * 100;
  originMarker.style.setProperty("--pos", `${originPosition}%`);
  originMarker.setAttribute("title", `${data.meta.branch} 从 ${formatTime(originBranch.age)} 开始出现`);
}

if (originMarkerText && originBranch) {
  originMarkerText.textContent = `宗族出现起点（${formatTime(originBranch.age)}）`;
}


let currentIndex = 0;
let animationFrameId = null;
const originStartIndex = getOriginStartIndex();

slider.max = String(timeline.length - 1);

// 追踪已显示过的分支，用于累积动画
const displayedBranches = new Map(); // branchId -> bp (该分支首次激活时的bp值)
let prevBp = null; // 上一帧的 bp，bp 增大表示时间回退
// 每个分支的历史扩散轮廓（用于绘制变透明度涟漪环）
const trailHistory = new Map(); // branchId -> [{pathData, dr, dg, db, progress}]
const MAX_TRAIL_RINGS = 14; // 每个分支最多保留的历史环数

applyFocusViewBox();
renderFocusFrame();

// 延迟初始render调用，确保所有函数和常量都已定义
setTimeout(render, 0);

slider.addEventListener("input", () => {
  currentIndex = Number(slider.value);
  stopPlayback();
  render();
});

playButton.addEventListener("click", () => {
  startPlaybackFromOrigin();
});

timelinePlayButton.addEventListener("click", () => {
  startPlaybackFromOrigin();
});

jumpModernButton.addEventListener("click", () => {
  stopPlayback();
  currentIndex = timeline.length - 1;
  slider.value = String(currentIndex);
  render();
});

function stopPlayback() {
  if (animationFrameId) {
    clearTimeout(animationFrameId);
    animationFrameId = null;
  }
  playButton.textContent = "播放";
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

function startPlaybackFromOrigin() {
  if (animationFrameId) {
    stopPlayback();
    return;
  }

  currentIndex = originStartIndex;
  slider.value = String(currentIndex);
  render();

  playButton.textContent = "暂停";
  const tick = () => {
    if (currentIndex >= timeline.length - 1) {
      stopPlayback();
      return;
    }

    currentIndex += 1;
    slider.value = String(currentIndex);
    render();
    animationFrameId = window.setTimeout(tick, PLAYBACK_INTERVAL_MS);
  };

  animationFrameId = window.setTimeout(tick, PLAYBACK_INTERVAL_MS);
}

function applyFocusViewBox() {
  const { lonMin, lonMax, latMin, latMax } = data.meta.focus;
  const x = lonToX(lonMin);
  const y = latToY(latMax);
  const width = lonToX(lonMax) - x;
  const height = latToY(latMin) - y;
  svg.setAttribute("viewBox", `${x} ${y} ${width} ${height}`);
}

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
function getBranchColorAtTime(branch, bp) {
  const stops = BRANCH_GRADIENTS[branch.id];
  if (!stops) return branch.color;
  const age = Math.max(branch.age, 1);
  // t=0时（分支初现）最深，t=1时（现代）最浅
  const t = clamp(1 - bp / age, 0, 1);
  return interpolateGradient(stops, t);
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
    const stop1 = document.createElementNS(SVG_NS, 'stop');
    stop1.setAttribute('offset', '0%');
    const stop2 = document.createElementNS(SVG_NS, 'stop');
    stop2.setAttribute('offset', '100%');
    grad.appendChild(stop1);
    grad.appendChild(stop2);
    defs.appendChild(grad);
  }

  // 计算原点坐标（SVG坐标系）
  const [lat, lon] = getOriginCenter(branch);
  const cx = lonToX(lon);
  const cy = latToY(lat);

  // 计算渐变半径（覆盖多边形最远点）
  const region = branch.regionId ? regionMap.get(branch.regionId) : null;
  const points = region ? region.polygon : buildFallbackPolygon(branch);
  let maxDist = 30;
  if (points) {
    for (const [plon, plat] of points) {
      const dx = lonToX(plon) - cx;
      const dy = latToY(plat) - cy;
      maxDist = Math.max(maxDist, Math.sqrt(dx * dx + dy * dy));
    }
  }

  grad.setAttribute('cx', cx);
  grad.setAttribute('cy', cy);
  grad.setAttribute('r', maxDist * 1.3);
  grad.setAttribute('fx', cx);
  grad.setAttribute('fy', cy);

  const stops = grad.querySelectorAll('stop');
  stops[0].setAttribute('stop-color', `rgb(${r}, ${g}, ${b})`);
  stops[0].setAttribute('stop-opacity', '0.65');
  stops[1].setAttribute('stop-color', `rgb(${r}, ${g}, ${b})`);
  stops[1].setAttribute('stop-opacity', '0');

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
  const targetPoints = region ? region.polygon : buildFallbackPolygon(branch);

  if (!targetPoints || targetPoints.length < 3) {
    return "";
  }

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
  const parent = branch.parentId ? branchMap.get(branch.parentId) : null;
  return parent ? parent.center : branch.center;
}

function buildFallbackPolygon(branch) {
  const [lat, lon] = branch.center;
  const radius = branch.radius || 2.4;
  return [
    [lon - radius, lat - radius * 0.65],
    [lon + radius * 0.92, lat - radius * 0.45],
    [lon + radius, lat + radius * 0.55],
    [lon - radius * 0.8, lat + radius * 0.7],
  ];
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
    // 时间回退：移除未来分支并清空其历史轨迹
    for (const [branchId] of [...displayedBranches]) {
      const b = branchMap.get(branchId);
      if (b && b.age < currentBp) {
        displayedBranches.delete(branchId);
        trailHistory.delete(branchId);
      }
    }
  }

  // 每帧重建两层（渐变主体层 + 涟漪轨迹层）
  ancientLayer.textContent = "";
  trailLayer.textContent = "";

  // 绘制所有分支，包括已显示过的和新激活的
  // 决定是否显示该分支的逻辑：
  // 1. 如果分支已被显示过（在displayedBranches中），则保留
  // 2. 如果分支年龄 >= 当前bp，则是新激活的分支
  // 绘制所有分支的轮廓到同一层，使用进度变化来累积扩散效果
  // 策略：当分支进度发生显著变化时，将轮廓快照添加到同一层
  // 不再区分 trailLayer 和 ancientLayer，都累积到 ancientLayer
  
  const visibleBranchesForRender = [];
  data.branches.forEach((branch) => {
    const age = Math.max(branch.age, 1);
    
    // 检查该分支是否应该被显示
    const isAlreadyDisplayed = displayedBranches.has(branch.id);
    // 分支在其初现时刻（branch.age）及之后应开始显示，所以条件是 bp <= branch.age
    const isNewlyActive = bp <= branch.age;
    
    // 只显示已显示过或新激活的分支
    if (!isAlreadyDisplayed && !isNewlyActive) {
      return; // 跳过既未显示也未激活的分支
    }
    visibleBranchesForRender.push(branch);
    
    // 计算动画进度
    let progress;
    if (isAlreadyDisplayed) {
      progress = 1; // 已显示的分支保持完全展开
    } else {
      // 新分支，第一次激活时，从起始阶段开始扩散
      progress = clamp((age - bp) / age, 0.08, 1);
      if (progress >= 1) {
        // 记录该分支首次激活时的bp值，用于保持颜色
        displayedBranches.set(branch.id, bp);
      }
    }
    
    const pathData = buildAnimatedPolygon(branch, progress);
    if (!pathData) {
      return;
    }

    // 根据时间轴位置获取渐变色（分支初现时最深，越靠近现代越浅）
    const dynamicColor = getBranchColorAtTime(branch, bp);
    const dynamicColorRgb = [
      parseInt(dynamicColor.slice(1, 3), 16),
      parseInt(dynamicColor.slice(3, 5), 16),
      parseInt(dynamicColor.slice(5, 7), 16),
    ];
    const [dr, dg, db] = dynamicColorRgb;

    // 取出历史记录（历史 = 已过去的状态，不含当前帧）
    const history = trailHistory.get(branch.id) || [];

    // 先绘制历史涟漪环（最旧最淡，最新最亮）
    const n = history.length;
    history.forEach((ring, i) => {
      const ageRatio = (i + 1) / n; // 0..1，最新=1
      const dimOnMapRing = currentMapHighlightBranches !== null && !currentMapHighlightBranches.has(branch.id);
      const baseOpacity = dimOnMapRing ? 0.03 : (0.04 + ageRatio * 0.28);
      const opacity = baseOpacity;
      const sw = (0.4 + ageRatio * 0.6).toFixed(1);
      const ringEl = document.createElementNS(SVG_NS, "path");
      ringEl.setAttribute("d", ring.pathData);
      ringEl.setAttribute("fill", "none");
      ringEl.setAttribute("stroke", `rgba(${ring.dr}, ${ring.dg}, ${ring.db}, ${opacity.toFixed(3)})`);
      ringEl.setAttribute("stroke-width", sw);
      trailLayer.appendChild(ringEl);
    });

    // 当前帧：径向渐变 + 发光效果（ancientLayer 每帧重建）
    const gradId = ensureBranchGradient(branch, dr, dg, db);
    const path = document.createElementNS(SVG_NS, "path");
    path.setAttribute("class", "ancient-shape");
    path.setAttribute("d", pathData);
    path.setAttribute("filter", "url(#branchGlow)");
    path.setAttribute("fill", `url(#${gradId})`);
    path.setAttribute("stroke", `rgba(${dr}, ${dg}, ${db}, 0.7)`);
    path.setAttribute("stroke-width", "1.0");
    // 地图高亮逻辑：如果有选中分支，非相关分支变暗
    const dimOnMap = currentMapHighlightBranches !== null && !currentMapHighlightBranches.has(branch.id);
    if (dimOnMap) {
      path.setAttribute("opacity", "0.12");
    }
    ancientLayer.appendChild(path);

    // 绘制完后，将当前状态存入历史（下一帧起才作为涟漪环显示）
    const lastHistProg = history.length > 0 ? history[history.length - 1].progress : -1;
    if (progress - lastHistProg >= 0.05 || history.length === 0) {
      history.push({ pathData, dr, dg, db, progress });
      if (history.length > MAX_TRAIL_RINGS) history.shift();
      trailHistory.set(branch.id, history);
    }
  });

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
    if (dimOnMap) return;

    const origin = getOriginCenter(branch);
    const region = branch.regionId ? regionMap.get(branch.regionId) : null;
    const targetPoints = region ? region.polygon : buildFallbackPolygon(branch);
    if (!targetPoints || targetPoints.length < 3) return;

    const isAlreadyDisplayed = displayedBranches.has(branch.id);
    const age = Math.max(branch.age, 1);
    const progress = isAlreadyDisplayed ? 1 : clamp((age - bp) / age, 0.08, 1);

    let sumX = 0, sumY = 0;
    targetPoints.forEach(([lon, lat]) => {
      const cLon = origin[1] + (lon - origin[1]) * progress;
      const cLat = origin[0] + (lat - origin[0]) * progress;
      sumX += lonToX(cLon);
      sumY += latToY(cLat);
    });
    const cx = sumX / targetPoints.length;
    const cy = sumY / targetPoints.length;

    const labelText = [...families].join(' · ');
    const [dr, dg, db] = [
      parseInt(branch.color.slice(1,3),16),
      parseInt(branch.color.slice(3,5),16),
      parseInt(branch.color.slice(5,7),16),
    ];
    labelItems.push({ cx, cy, labelText, dr, dg, db });
  });

  // 简单防碰撞：按cy排序，垂直偏移，避免重叠
  const FONT_SIZE = 7;
  const LINE_H = FONT_SIZE + 3;
  const LABEL_OFFSET = 14; // 引线长度
  labelItems.sort((a, b) => a.cy - b.cy);
  const placedRects = [];
  labelItems.forEach(item => {
    const { cx, cy, labelText, dr, dg, db } = item;
    const textW = labelText.length * FONT_SIZE * 0.62;
    // 默认标签放在右侧
    let lx = cx + LABEL_OFFSET;
    let ly = cy;
    // 防碰撞：向下移动
    let attempts = 0;
    while (attempts < 20) {
      const r = { x: lx - 2, y: ly - LINE_H, w: textW + 8, h: LINE_H + 4 };
      const collides = placedRects.some(pr =>
        r.x < pr.x + pr.w && r.x + r.w > pr.x && r.y < pr.y + pr.h && r.y + r.h > pr.y
      );
      if (!collides) break;
      ly += LINE_H;
      attempts++;
    }
    placedRects.push({ x: lx - 2, y: ly - LINE_H, w: textW + 8, h: LINE_H + 4 });

    // 引线
    const line = document.createElementNS(SVG_NS, "line");
    line.setAttribute("x1", cx.toFixed(1));
    line.setAttribute("y1", cy.toFixed(1));
    line.setAttribute("x2", (lx - 2).toFixed(1));
    line.setAttribute("y2", ly.toFixed(1));
    line.setAttribute("stroke", `rgba(${dr},${dg},${db},0.7)`);
    line.setAttribute("stroke-width", "0.8");
    branchLabelLayer.appendChild(line);

    // 文字
    const text = document.createElementNS(SVG_NS, "text");
    text.setAttribute("x", lx.toFixed(1));
    text.setAttribute("y", ly.toFixed(1));
    text.setAttribute("text-anchor", "start");
    text.setAttribute("font-size", FONT_SIZE);
    text.setAttribute("font-family", "sans-serif");
    text.setAttribute("fill", `rgba(${dr},${dg},${db},0.95)`);
    text.setAttribute("filter", "url(#pointGlow)");
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
      symbol = 'roundRect'; symbolSize = [tw, 28]; symbolOffset = [tw/2 - NODE_R, 0];
      itemStyle = { color: TC.primary, borderRadius: 14, shadowColor: TC.glowShadow, shadowBlur: 15 };
      labelStyle = { show:true, position:'inside', color:'#fff', fontSize:13, fontWeight:'600', formatter: displayLabel };
    } else if (isAnc) {
      symbol = 'roundRect'; symbolSize = [tw, 24]; symbolOffset = [tw/2 - NODE_R, 0];
      itemStyle = { color:'#0F172A', borderColor:'#00E1FD', borderWidth:1.5, borderRadius:12, shadowColor:'rgba(0,225,253,0.3)', shadowBlur:8 };
      labelStyle = { show:true, position:'inside', color:'#E2E8F0', fontSize:12, fontWeight:'500', formatter: displayLabel };
    } else if (isActive && !highlightId) {
      symbol = 'circle'; symbolSize = NODE_R * 2;
      const branchColor = node.color || (isSample ? '#00E1FD' : '#4a9eff');
      itemStyle = { color: branchColor + '33', borderColor: branchColor, borderWidth: 2, shadowColor: branchColor + '66', shadowBlur: 4 };
      labelStyle = { show: true, position:'bottom', distance: 3, color: branchColor, fontSize: 10, fontWeight: '400', formatter: displayLabel, backgroundColor:'transparent', borderWidth:0, padding:0 };
    } else if (isSample && isDesc) {
      symbol = 'circle'; symbolSize = NODE_R * 2;
      itemStyle = { color:'#0A0F1C', borderColor:'#00E1FD', borderWidth:2 };
      labelStyle = { show: true, position:'bottom', distance: 3, color:'#94A3B8', fontSize: 10, formatter: displayLabel, backgroundColor:'transparent', borderWidth:0, padding:0 };
    } else {
      symbol = 'circle'; symbolSize = NODE_R * 2;
      const bColor = node.color || '#475A77';
      itemStyle = { color:'#0A0F1C', borderColor: isUnrelated ? TC.nodeBorder : bColor, borderWidth: isUnrelated ? 1.5 : 2 };
      labelStyle = { show: true, position:'bottom', distance: 3, color: isUnrelated ? '#3B4D6B' : (bColor), fontSize: 10, formatter: displayLabel, backgroundColor:'transparent', borderWidth:0, padding:0 };
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
      top: 10, bottom: 10, left: 10, right: 10,
      initialTreeDepth: -1,
      expandAndCollapse: false,
      emphasis: { disabled: true },
      lineStyle: { curveness: 0.55 },
      nodeGap: 2,
      layerPadding: 40,
      animationDuration: 550,
      animationDurationUpdate: 550,
      animationEasingUpdate: 'cubicInOut',
    }],
  };

  echartsTreeInstance.setOption(baseOpt);
  setTimeout(() => autoFitTreeZoom(), 200); // 初始化后自动适配

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
    // 激活高亮时，跳转时间轴到该分支年代（展开全屏时不跳转）
    if (!treeState.expanded && newHl && d._raw.age != null && d._raw.age > 0) {
      const targetBp = d._raw.age;
      const idx = timeline.reduce((best, bp, i) =>
        Math.abs(bp - targetBp) < Math.abs(timeline[best] - targetBp) ? i : best
      , 0);
      currentIndex = idx;
      slider.value = String(idx);
      currentTreeBp = -1; // 强制 renderGenealogyTree 重绘
    }
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
  const containerH = container.clientHeight || 500;
  const treeData = buildTreeOptionData(currentTreeBp, null, treeState.expanded);
  const leafCount = countLeafNodes(treeData);
  // 估算树高度：每叶节点约 18px（含标签和间距）
  const estimatedH = leafCount * 18;
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

