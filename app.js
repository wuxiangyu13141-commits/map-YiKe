const data = window.Y4569_DATA;

if (!data) {
  throw new Error("Y4569 data is not available.");
}

const svg = document.getElementById("mapSvg");
const focusLayer = document.getElementById("focusLayer");
const ancientLayer = document.getElementById("ancientLayer");
const pointLayer = document.getElementById("pointLayer");
const slider = document.getElementById("timelineSlider");
const playButton = document.getElementById("playButton");
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
  pointer-events: none;
  display: none;
  z-index: 1000;
  line-height: 1.5;
`;
document.body.appendChild(tooltip);

const SVG_NS = "http://www.w3.org/2000/svg";
const regionMap = new Map(data.regions.map((region) => [region.id, region]));
const branchMap = new Map(data.branches.map((branch) => [branch.id, branch]));
const sampleMap = new Map(data.samples.map((sample) => [sample.id, sample]));
const compressedCommonPrefix = getCompressedCommonPrefix();

const timeline = [];
for (let bp = data.meta.timelineStartBP; bp >= 0; bp -= data.meta.timelineStepYears) {
  timeline.push(bp);
}

const originBranch = branchMap.get(data.meta.branch);
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

slider.max = String(timeline.length - 1);

applyFocusViewBox();
renderFocusFrame();
render();

slider.addEventListener("input", () => {
  currentIndex = Number(slider.value);
  stopPlayback();
  render();
});

playButton.addEventListener("click", () => {
  if (animationFrameId) {
    stopPlayback();
    return;
  }

  if (currentIndex >= timeline.length - 1) {
    currentIndex = 0;
    slider.value = String(currentIndex);
    render();
  }

  playButton.textContent = "暂停";
  const tick = () => {
    if (currentIndex >= timeline.length - 1) {
      stopPlayback();
      return;
    }

    currentIndex += 1;
    slider.value = String(currentIndex);
    render();
    animationFrameId = window.setTimeout(tick, 260);
  };

  animationFrameId = window.setTimeout(tick, 260);
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

function applyFocusViewBox() {
  const { lonMin, lonMax, latMin, latMax } = data.meta.focus;
  const x = lonToX(lonMin);
  const y = latToY(latMax);
  const width = lonToX(lonMax) - x;
  const height = latToY(latMin) - y;
  svg.setAttribute("viewBox", `${x} ${y} ${width} ${height}`);
}

function renderFocusFrame() {
  const { lonMin, lonMax, latMin, latMax } = data.meta.focus;
  focusLayer.textContent = "";

  const outline = document.createElementNS(SVG_NS, "rect");
  outline.setAttribute("x", lonToX(lonMin));
  outline.setAttribute("y", latToY(latMax));
  outline.setAttribute("width", lonToX(lonMax) - lonToX(lonMin));
  outline.setAttribute("height", latToY(latMin) - latToY(latMax));
  outline.setAttribute("rx", "2");
  outline.setAttribute("fill", "rgba(255,255,255,0.02)");
  outline.setAttribute("stroke", "rgba(255,255,255,0.12)");
  outline.setAttribute("stroke-width", "0.8");
  focusLayer.appendChild(outline);

  const label = document.createElementNS(SVG_NS, "text");
  label.setAttribute("x", lonToX(lonMin) + 6);
  label.setAttribute("y", latToY(latMax) + 10);
  label.setAttribute("fill", "rgba(255,255,255,0.7)");
  label.setAttribute("font-size", "7");
  label.setAttribute("font-family", '"Segoe UI", sans-serif');
  label.textContent = "欧亚主要观察区";
  focusLayer.appendChild(label);
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
  const activeBranches = getActiveBranches(bp);
  const modernSamples = getVisibleModernSamples(bp);

  currentTimeLabel.textContent = formatTime(bp);
  currentModeLabel.textContent = bp === 0 ? "现代样本点状态" : "古代扩散阶段";
  tickLabel.textContent = `第 ${currentIndex + 1} 格 / ${timeline.length} 格`;

  ancientLayer.textContent = "";
  pointLayer.textContent = "";

  activeBranches.forEach((branch) => {
    const age = Math.max(branch.age, 1);
    const progress = clamp((age - bp) / age, 0.08, 1);
    const pathData = buildAnimatedPolygon(branch, progress);
    if (!pathData) {
      return;
    }

    // 计算饱和度：距现代越近，饱和度越高；距离越远（越古代），饱和度越低
    // 饱和度范围：30%-100%（古代最低30%，现代100%）
    const timelineSpan = data.meta.timelineStartBP; // 总时间跨度
    const saturation = 30 + ((timelineSpan - bp) / timelineSpan) * 70; // 30%-100%范围

    const colorFill = adjustSaturation(branch.color, saturation * 0.7); // 填充用更低饱和度
    const colorStroke = adjustSaturation(branch.color, saturation);

    const path = document.createElementNS(SVG_NS, "path");
    path.setAttribute("class", "ancient-shape");
    path.setAttribute("d", pathData);
    path.setAttribute("filter", "url(#glassBlur)");
    path.setAttribute("fill", `rgba(${colorFill.slice(4, -1)}, 0.28)`); // 保持透明度
    path.setAttribute("stroke", `rgba(${colorStroke.slice(4, -1)}, 0.95)`);
    ancientLayer.appendChild(path);
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
    
    // 添加悬停事件
    circle.addEventListener("mouseenter", (event) => {
      const rect = svg.getBoundingClientRect();
      const x = event.pageX;
      const y = event.pageY;
      
      tooltip.innerHTML = `
        <div><strong>${sample.id}</strong></div>
        <div>${sample.ethnicity || "未注明"}</div>
        <div style="margin-top:6px; border-top:1px solid rgba(255,255,255,0.2); padding-top:6px;">
          <div>地点：${sample.location || "未注明"}</div>
          <div>部族：${sample.tribe || "未注明"}</div>
          <div>末端支系：${sample.branchSegments?.at(-1) || "Y4569"}</div>
          <div>分布：${sample.distribution || "未注明"}</div>
        </div>
      `;
      tooltip.style.left = (x + 10) + "px";
      tooltip.style.top = (y + 10) + "px";
      tooltip.style.display = "block";
    });
    
    circle.addEventListener("mouseleave", () => {
      tooltip.style.display = "none";
    });
    
    pointLayer.appendChild(circle);
  });

  renderLegend(activeBranches, bp);
  renderSamples(modernSamples, bp);
}

function renderLegend(activeBranches, bp) {
  if (!activeBranches.length) {
    branchLegend.innerHTML = '<div class="empty-state">当前时间点尚未进入 Y4569 的形成阶段。</div>';
    return;
  }

  // 显示所有分支，不限制为12个
  const visibleBranches = activeBranches;
  const allTokenLists = visibleBranches.map((branch) => getBranchLegendTokens(branch));
  const globalSharedPrefixLength = getSharedPrefixLength(allTokenLists);
  const grouped = new Map();

  visibleBranches.forEach((branch) => {
    const tokens = getBranchLegendTokens(branch);
    const groupKey =
      tokens[globalSharedPrefixLength] ||
      tokens[tokens.length - 1] ||
      branch.id;

    if (!grouped.has(groupKey)) {
      grouped.set(groupKey, []);
    }
    grouped.get(groupKey).push({ branch, tokens });
  });

  branchLegend.innerHTML = Array.from(grouped.entries())
    .map(([groupKey, entries]) => {
      const sharedPrefixLength = getSharedPrefixLength(entries.map((entry) => entry.tokens));
      const cards = entries
        .map(({ branch }) => {
          const label = formatBranchLegendLabel(branch, sharedPrefixLength);
          const titleText = label.full || branch.id;
          const prefixHtml = label.prefix
            ? `<span class="branch-label-prefix">${label.prefix}/</span>`
            : "";

          return `
          <article class="branch-item">
            <header>
              <strong title="${titleText}"><span class="swatch" style="background:${branch.color}"></span>${prefixHtml}<span class="branch-label-unique">${label.unique || branch.id}</span></strong>
              <span>${formatTime(branch.age)}</span>
            </header>
            <div class="meta-row">分布区：${branch.distribution || "按样本坐标估算"}</div>
          </article>
        `;
        })
        .join("");

      return `
      <section class="branch-group">
        <div class="branch-group-title">组：${groupKey}</div>
        ${cards}
      </section>
      `;
    })
    .join("");
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