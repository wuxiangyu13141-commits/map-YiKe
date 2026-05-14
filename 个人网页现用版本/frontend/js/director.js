/* ══════════════════════════════════════════
   director.js — 电影导演模式（七幕剧）
   替代原 guided.js
   ══════════════════════════════════════════ */
'use strict';

/* ── 纹理预加载已移除 — 使用暗色主题材质 ── */

/* ═══════════════════════════════════════════
   §0  Landing — 数据粒子球
   3D旋转球体，粒子按纬度带编码四维经济增长率
   颜色 = GDP·人均收入·对外贸易·高新产业
   增长率越高 → 粒子越多 + 转速越快
   ═══════════════════════════════════════════ */
var sphereCanvas = document.getElementById('landingSphere');
var sphereCtx = sphereCanvas ? sphereCanvas.getContext('2d') : null;
var sphereAnimId = null;
var sphereTime = 0;

/* ── 四维增长率数据(国家统计局 2023→2024) ── */
var DS = [
    { label:'GDP',     sub:'地区生产总值', unit:'亿元',   h:195, s:22, l:40, prev:25020.5,  curr:26337    },
    { label:'人均收入', sub:'居民人均可支配', unit:'元',   h:175, s:20, l:38, prev:38130,    curr:40077    },
    { label:'对外贸易', sub:'进出口总额',   unit:'亿美元', h:168, s:24, l:36, prev:278.4,    curr:291.7    },
    { label:'高新产业', sub:'科技财政支出',  unit:'亿元',  h:185, s:18, l:42, prev:74.97,    curr:86.27    }
];
/* 预算增长率(用于粒子密度和转速) */
for (var _di = 0; _di < DS.length; _di++) {
    DS[_di].growth = (DS[_di].curr - DS[_di].prev) / DS[_di].prev;  /* 0~1 之间 */
}
/* 基础粒子总量 & 按增长率分配 */
var SP_BASE_PARTICLES = 1200;   /* 每个带的最低粒子数 */
var SP_GROWTH_BONUS   = 2400;   /* 增长率最大额外粒子 */

/* 球体参数 */
var SP_CX = 0.58, SP_CY = 0.48;   /* 球心(归一化) */
var SP_R_RATIO = 0.28;              /* 半径占min(W,H)比 */
var SP_ROT_SPEED = 0.12;            /* Y轴自转(弧度/s) */
var SP_TILT = 0.35;                 /* X轴倾斜(弧度) */
var particles3D = [];
var SP_STREAMS = 60;                 /* 流动数据流粒子 */
var streamParticles = [];

/* 纬度带分布：-1(南极)到+1(北极)分4个带 */
var BAND_EDGES = [-1, -0.5, 0, 0.5, 1];

function _initSphere3D() {
    particles3D = [];
    streamParticles = [];
    var PI2 = Math.PI * 2;

    /* 找出最大增长率，用于归一化 */
    var maxGrowth = 0;
    for (var gi = 0; gi < DS.length; gi++) {
        if (DS[gi].growth > maxGrowth) maxGrowth = DS[gi].growth;
    }

    /* 为每个带按增长率分配粒子数 */
    for (var bi = 0; bi < 4; bi++) {
        var d = DS[bi];
        var gNorm = d.growth / maxGrowth;  /* 0~1 */
        var bandCount = Math.round(SP_BASE_PARTICLES / 4 + (SP_GROWTH_BONUS / 4) * gNorm);
        /* 增长率越大，纬向漂移速度越快 */
        var bandSpeedBase = 0.003 + gNorm * 0.015;

        for (var i = 0; i < bandCount; i++) {
            /* 仅在该带的纬度范围内生成 */
            var cosLo = BAND_EDGES[bi], cosHi = BAND_EDGES[bi + 1];
            var cosTheta = cosLo + Math.random() * (cosHi - cosLo);
            var theta = Math.acos(cosTheta);
            var phi = PI2 * Math.random();

            /* 粒子大小 ∝ 增长率归一化 */
            var baseSize = 0.4 + gNorm * 0.8;

            particles3D.push({
                theta: theta,
                phi: phi,
                phiSpeed: (bandSpeedBase + Math.random() * 0.005) * (bi % 2 === 0 ? 1 : -1),
                size: baseSize + Math.random() * 0.4,
                hue: d.h + (Math.random() - 0.5) * 12,
                sat: d.s + (Math.random() - 0.5) * 6,
                lum: d.l + gNorm * 6 + (Math.random() - 0.5) * 5,
                alpha: 0.06 + gNorm * 0.06 + Math.random() * 0.10,
                phase: Math.random() * PI2,
                twinkle: 1 + Math.random() * 2,
                band: bi
            });
        }
    }

    /* 流动数据流 — 沿经线流动的亮粒子 */
    for (var s = 0; s < SP_STREAMS; s++) {
        var sPhi = PI2 * Math.random();
        var sTheta = Math.PI * Math.random();
        streamParticles.push({
            theta: sTheta,
            phi: sPhi,
            thetaSpeed: 0.008 + Math.random() * 0.012,
            size: 0.8 + Math.random() * 0.6,
            hue: DS[s % 4].h,
            alpha: 0.10 + Math.random() * 0.12,
            trail: []
        });
    }
}

function sizeSphereCanvas() {
    if (!sphereCanvas) return;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    sphereCanvas.width = window.innerWidth * dpr;
    sphereCanvas.height = window.innerHeight * dpr;
    sphereCanvas.style.width = window.innerWidth + 'px';
    sphereCanvas.style.height = window.innerHeight + 'px';
    sphereCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

/* 3D→2D投影 */
function _proj(theta, phi, rotY, tiltX, cx, cy, radius) {
    var sinT = Math.sin(theta), cosT = Math.cos(theta);
    var sinP = Math.sin(phi + rotY), cosP = Math.cos(phi + rotY);

    /* 球面 → 笛卡尔 */
    var x3 = sinT * cosP;
    var y3 = cosT;
    var z3 = sinT * sinP;

    /* X轴倾斜 */
    var y3r = y3 * Math.cos(tiltX) - z3 * Math.sin(tiltX);
    var z3r = y3 * Math.sin(tiltX) + z3 * Math.cos(tiltX);

    /* 透视 */
    var perspective = 1.8 / (1.8 + z3r * 0.5);
    return {
        x: cx + x3 * radius * perspective,
        y: cy - y3r * radius * perspective,
        z: z3r,
        scale: perspective
    };
}

function drawSphere() {
    if (!sphereCtx) return;
    var W = window.innerWidth, H = window.innerHeight;
    var ctx = sphereCtx;
    sphereTime += 0.016;
    var S = Math.min(W, H);
    var cx = SP_CX * W, cy = SP_CY * H;
    var R = SP_R_RATIO * S;
    var rotY = sphereTime * SP_ROT_SPEED;

    /* 清屏 — 微残影 */
    ctx.fillStyle = 'rgba(5,5,5,0.18)';
    ctx.fillRect(0, 0, W, H);

    /* ── 1) 球体淡辉光 ── */
    var glowR = R * 1.4;
    var cg = ctx.createRadialGradient(cx, cy, R * 0.3, cx, cy, glowR);
    cg.addColorStop(0, 'rgba(30,80,140,0.03)');
    cg.addColorStop(0.5, 'rgba(20,60,100,0.015)');
    cg.addColorStop(1, 'transparent');
    ctx.fillStyle = cg;
    ctx.beginPath();
    ctx.arc(cx, cy, glowR, 0, Math.PI * 2);
    ctx.fill();

    /* ── 2) 纬线(数据带分界线) ── */
    for (var bk = 1; bk < 4; bk++) {
        var latY = BAND_EDGES[bk];
        var latTheta = Math.acos(latY);
        var latR = Math.sin(latTheta) * R;
        var lp = _proj(latTheta, 0, rotY, SP_TILT, cx, cy, R);

        /* 用椭圆近似纬线 */
        ctx.beginPath();
        ctx.ellipse(cx, lp.y, latR * (0.8 + lp.z * 0.2), latR * 0.08 + 1, 0, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(80,140,200,0.06)';
        ctx.lineWidth = 0.5;
        ctx.stroke();
    }

    /* ── 3) 经线(稀疏) ── */
    for (var ml = 0; ml < 8; ml++) {
        var mPhi = (Math.PI * 2 / 8) * ml;
        ctx.beginPath();
        for (var seg = 0; seg <= 30; seg++) {
            var mTheta = (Math.PI / 30) * seg;
            var mp = _proj(mTheta, mPhi, rotY, SP_TILT, cx, cy, R);
            if (mp.z < -0.1) continue;
            if (seg === 0 || mp.z < -0.05) ctx.moveTo(mp.x, mp.y);
            else ctx.lineTo(mp.x, mp.y);
        }
        ctx.strokeStyle = 'rgba(60,100,160,0.04)';
        ctx.lineWidth = 0.5;
        ctx.stroke();
    }

    /* ── 4) 数据流粒子(沿经线流动的亮粒子带拖尾) ── */
    for (var si = 0; si < streamParticles.length; si++) {
        var sp = streamParticles[si];
        sp.theta += sp.thetaSpeed;
        if (sp.theta > Math.PI) sp.theta -= Math.PI;

        var sProj = _proj(sp.theta, sp.phi, rotY, SP_TILT, cx, cy, R);

        /* 保存拖尾 */
        sp.trail.push({ x: sProj.x, y: sProj.y, z: sProj.z });
        if (sp.trail.length > 6) sp.trail.shift();

        if (sProj.z > -0.2) {
            var sAlpha = sp.alpha * (0.5 + sProj.z * 0.5) * (0.6 + 0.4 * Math.sin(sphereTime * 1.5 + si));
            /* 拖尾 */
            for (var ti = 0; ti < sp.trail.length - 1; ti++) {
                var tp = sp.trail[ti];
                if (tp.z < -0.2) continue;
                var tAlpha = sAlpha * (ti / sp.trail.length) * 0.4;
                ctx.beginPath();
                ctx.arc(tp.x, tp.y, sp.size * 0.5, 0, Math.PI * 2);
                ctx.fillStyle = 'hsla(' + sp.hue + ',30%,50%,' + tAlpha.toFixed(4) + ')';
                ctx.fill();
            }
            /* 头部 */
            ctx.beginPath();
            ctx.arc(sProj.x, sProj.y, sp.size * sProj.scale, 0, Math.PI * 2);
            ctx.fillStyle = 'hsla(' + sp.hue + ',35%,55%,' + sAlpha.toFixed(4) + ')';
            ctx.fill();
        }
    }

    /* ── 5) 主粒子(球面分布,按带编码数据) ── */
    for (var i = 0; i < particles3D.length; i++) {
        var pt = particles3D[i];

        /* 流动：沿纬线方向漂移 */
        pt.phi += pt.phiSpeed;

        var proj = _proj(pt.theta, pt.phi, rotY, SP_TILT, cx, cy, R);

        /* 只绘制面向镜头的(z>阈值) */
        if (proj.z < -0.15) continue;

        var depthFade = 0.3 + proj.z * 0.7;  /* 近亮远暗 */
        var twinkle = 0.6 + 0.4 * Math.sin(sphereTime * pt.twinkle + pt.phase);
        var fa = pt.alpha * depthFade * twinkle;

        var sz = pt.size * proj.scale;

        /* 较大粒子微辉光 */
        if (sz > 1.2 && fa > 0.04) {
            ctx.shadowColor = 'hsla(' + pt.hue + ',' + pt.sat + '%,' + Math.min(55, pt.lum + 5) + '%,0.15)';
            ctx.shadowBlur = sz * 1.5;
        }

        ctx.beginPath();
        ctx.arc(proj.x, proj.y, sz, 0, Math.PI * 2);
        ctx.fillStyle = 'hsla(' + Math.round(pt.hue) + ',' + Math.round(pt.sat) + '%,' + Math.round(pt.lum) + '%,' + fa.toFixed(4) + ')';
        ctx.fill();

        if (ctx.shadowBlur > 0) ctx.shadowBlur = 0;
    }

    /* ── 6) 四个数据带标签(极淡,不抢视觉) ── */
    var labelAlpha = Math.min(0.18, sphereTime * 0.03);
    for (var li = 0; li < 4; li++) {
        var bandMid = (BAND_EDGES[li] + BAND_EDGES[li + 1]) / 2;
        var labelTheta = Math.acos(bandMid);
        var labelPhi = -rotY + 0.1;
        var lProj = _proj(labelTheta, labelPhi, rotY, SP_TILT, cx, cy, R * 1.12);

        if (lProj.z > 0.25) {
            var ld = DS[li];
            var lfa = labelAlpha * (0.3 + lProj.z * 0.7);
            var growPct = (ld.growth * 100).toFixed(1);

            /* 指标名 — 极淡 */
            ctx.font = '8px system-ui, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillStyle = 'rgba(160,200,220,' + (lfa * 0.6).toFixed(4) + ')';
            ctx.fillText(ld.label, lProj.x, lProj.y - 8);

            /* 增长率 — 同系色淡显 */
            ctx.font = '9px "Courier New", monospace';
            ctx.fillStyle = 'rgba(0,229,255,' + (lfa * 0.8).toFixed(4) + ')';
            ctx.fillText((ld.growth > 0 ? '+' : '') + growPct + '%', lProj.x, lProj.y + 4);
        }
    }

    /* ── 7) 脉冲环(球面赤道脉冲) ── */
    for (var pw = 0; pw < 2; pw++) {
        var pProg = ((sphereTime * 0.1 + pw * 0.5) % 1);
        var pAlpha = (1 - pProg) * 0.02;
        var pRadius = R * (0.5 + pProg * 0.8);
        if (pAlpha > 0.002) {
            ctx.beginPath();
            ctx.arc(cx, cy, pRadius, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(80,160,220,' + pAlpha.toFixed(4) + ')';
            ctx.lineWidth = 0.5;
            ctx.stroke();
        }
    }

    sphereAnimId = requestAnimationFrame(drawSphere);
}

function startSphereAnim() {
    if (sphereAnimId) return;
    _initSphere3D();
    sizeSphereCanvas();
    if (sphereCtx) {
        sphereCtx.fillStyle = '#050505';
        sphereCtx.fillRect(0, 0, window.innerWidth, window.innerHeight);
    }
    sphereAnimId = requestAnimationFrame(drawSphere);
}

function stopSphereAnim() {
    if (sphereAnimId) { cancelAnimationFrame(sphereAnimId); sphereAnimId = null; }
}

/* 页面加载 — 粒子球自动启动 */
if (sphereCanvas) {
    startSphereAnim();
    window.addEventListener('resize', function() {
        if (sphereAnimId) sizeSphereCanvas();
    });
}


/* ═══════════════════════════════════════════
   §1  七幕剧数据与配置
   ═══════════════════════════════════════════ */
var cmActive = false;
var _introPlaying = false;   /* 开场过场动画中禁止鼠标点击 */
var cmCurrentAct = 0;
var cmChart = null;        /* ECharts实例 */
var cmCanvasCtx = null;
var cmCanvasAnimId = null;

var ACTS = [
    { label: 'PUSH · I',   title: '资源诅咒的价值漏斗',
      insight: '亿吨煤炭换不回几台精密设备——卖资源是在产业链底端打工的死局' },
    { label: 'PUSH · II',  title: '双碳倒逼的增长极限',
      insight: '碳达峰碳中和硬指标之下，传统重工业的天花板已被彻底锁死' },
    { label: 'PULL · I', title: '风光无限的先天底牌',
      insight: '广袤戈壁不再荒芜——它是风能和太阳能的超级宝库' },
    { label: 'PULL · II',  title: '算力跨维变现',
      insight: '从"卖原煤"到"卖算力"——东数西算让绿电直接变成数据产品' },
    { label: 'PULL · III',   title: '冷凉区位的天然优势',
      insight: '天然冷却省下巨额电费，紧邻京津冀保证极低延迟' },
    { label: 'PULL · IV',  title: '重塑人才引力场',
      insight: '高端产业落地，才能留住青年——这是内蒙古的未来' },
    { label: 'FINAL',   title: '答案',
      insight: '从资源依赖到创新驱动——内蒙古正在重写自己的经济叙事' }
];

var FINAL_TEXT = '资源天花板触手可及、双碳大限死线已到——\n这是「背水一战」的生存逼迫。\n\n' +
    '风光禀赋冠绝全国、算力变现大勀归来、冷凉区位天生绿色——\n这是「降维打击」的先天底牌。\n\n' +
    '当绿电装机9年翻3.75倍，\n当算力从20P飙升至1400P，\n' +
    '当储能工程师薪资增速领跑全行业⋯⋯\n\n' +
    '数据已经给出答案：\n' +
    '这场『绿电狂飙』，\n' +
    '既是背水一战——不转则死，\n' +
    '更是降维打击——资源小省变能源大省。\n\n' +
    '内蒙古正在重写自己的经济叙事。';

/* ═══════════════════════════════════════════
   §2  导演模式入口/退出
   ═══════════════════════════════════════════ */
function enterCinematicMode() {
    if (appStarted) return;
    appStarted = true;
    cmActive = true;
    cmCurrentAct = 0;

    /* 立即隐藏landing */
    stopSphereAnim();
    var _sphCvs = document.getElementById('landingSphere');
    if (_sphCvs) _sphCvs.style.display = 'none';
    var lp = document.getElementById('landingPage');
    if (lp) { lp.style.display = 'none'; }

    var gv = document.getElementById('globeViz');
    gv.style.display = '';
    gv.style.opacity = '0';
    gv.classList.add('cm-focus');
    gv.style.transition = 'opacity 2s ease';
    requestAnimationFrame(function() { gv.style.opacity = '1'; });

    /* 隐藏非电影模式的UI元素 */
    var _p3r = document.getElementById('page3Right');
    if (_p3r) _p3r.style.display = 'none';
    var _rp = document.querySelector('.right-panel');
    if (_rp) _rp.style.display = 'none';
    var _hud = document.querySelector('.hud');
    if (_hud) _hud.style.display = 'none';
    var _tl = document.querySelector('.timeline');
    if (_tl) _tl.style.display = 'none';
    /* 不加 cm-focus / cm-blur — 保持地球原始透明线框亮度 */

    /* ═══════════════════════════════════════════════════════════
       V9 — 直接使用最终数据地球做运镜，不切换样式
       ─────────────────────────────────────────────────────────
       用户要求：运镜阶段的地球要和最终探索模式完全一模一样
       （透明线框+大气层+弧线+标签），不要"黑色线框"。

       修复方案：
         ① 不加 cm-focus（那个 CSS filter 把亮度压到 62%）
         ② 不清空数据图层 — 立即调 refreshArcs() 加载弧线标签
         ③ 大气层一开始就显示
         ④ 运镜用 translateY 创造掠地地平线视角
       ═══════════════════════════════════════════════════════════ */

    /* 1. 锁定 */
    _introPlaying = true;
    var _ctrl = world.controls();
    _ctrl.enabled = false;
    _ctrl.autoRotate = false;

    var _origMinDist = _ctrl.minDistance;
    var _origMaxDist = _ctrl.maxDistance;
    _ctrl.minDistance = 1;
    _ctrl.maxDistance = 99999;

    /* 2. ★ 立即加载数据 — 地球从运镜一开始就是最终样子 ★ */
    refreshArcs();
    world.globeImageUrl(''); _applyDarkGlobeMaterial();

    /* 3. 大气层立即可见 */
    world.showAtmosphere(true);
    world.atmosphereColor('rgba(96,138,162,0.11)');
    world.atmosphereAltitude(0.32);

    /* 4. 起点 */
    world.pointOfView({ lat: -40, lng: 0, altitude: 4.0 }, 0);

    /* 6. 星空 */
    var sCvs = document.createElement('canvas');
    sCvs.style.cssText = 'position:fixed;inset:0;z-index:5;pointer-events:none;opacity:1;';
    sCvs.width = window.innerWidth;
    sCvs.height = window.innerHeight;
    document.body.appendChild(sCvs);
    var sCtx = sCvs.getContext('2d');
    var _stars = [];
    for (var si = 0; si < 350; si++) {
        _stars.push({
            x: Math.random() * sCvs.width,
            y: Math.random() * sCvs.height,
            r: 0.2 + Math.random() * 1.5,
            a: 0.15 + Math.random() * 0.85,
            sp: 0.3 + Math.random() * 2.8,
            ph: Math.random() * 6.283
        });
    }
    var _sAnim = null, _sT0 = Date.now();
    function _drawStars() {
        var t = (Date.now() - _sT0) / 1000;
        sCtx.clearRect(0, 0, sCvs.width, sCvs.height);
        for (var j = 0; j < _stars.length; j++) {
            var s = _stars[j];
            var fl = 0.4 + 0.6 * Math.sin(t * s.sp + s.ph);
            sCtx.beginPath();
            sCtx.arc(s.x, s.y, s.r, 0, 6.283);
            sCtx.fillStyle = 'rgba(190,210,255,' + (s.a * fl).toFixed(3) + ')';
            sCtx.fill();
        }
        _sAnim = requestAnimationFrame(_drawStars);
    }
    _drawStars();

    /* 7. 速度线 */
    var spCvs = document.createElement('canvas');
    spCvs.style.cssText = 'position:fixed;inset:0;z-index:7;pointer-events:none;opacity:0;mix-blend-mode:screen;';
    spCvs.width = window.innerWidth;
    spCvs.height = window.innerHeight;
    document.body.appendChild(spCvs);
    var spCtx = spCvs.getContext('2d');
    var _spdL = [];
    for (var sl = 0; sl < 55; sl++) {
        _spdL.push({
            y: Math.random() * spCvs.height,
            len: 60 + Math.random() * 400,
            speed: 5 + Math.random() * 22,
            x: Math.random() * spCvs.width,
            a: 0.03 + Math.random() * 0.12,
            w: 0.4 + Math.random() * 2.0
        });
    }
    function _drawSpeed(intensity) {
        spCtx.clearRect(0, 0, spCvs.width, spCvs.height);
        if (intensity < 0.01) return;
        for (var k = 0; k < _spdL.length; k++) {
            var ln = _spdL[k];
            ln.x -= ln.speed * intensity;
            if (ln.x + ln.len < 0) {
                ln.x = spCvs.width + Math.random() * 200;
                ln.y = Math.random() * spCvs.height;
            }
            spCtx.beginPath();
            spCtx.moveTo(ln.x + ln.len, ln.y);
            spCtx.lineTo(ln.x, ln.y);
            var grd = spCtx.createLinearGradient(ln.x, ln.y, ln.x + ln.len, ln.y);
            grd.addColorStop(0, 'rgba(80,200,255,0)');
            grd.addColorStop(0.4, 'rgba(80,200,255,' + (ln.a * intensity).toFixed(3) + ')');
            grd.addColorStop(1, 'rgba(80,200,255,0)');
            spCtx.strokeStyle = grd;
            spCtx.lineWidth = ln.w;
            spCtx.stroke();
        }
    }

    /* 8. 大气闪光 */
    var flashEl = document.createElement('div');
    flashEl.style.cssText = 'position:fixed;inset:0;z-index:8;pointer-events:none;opacity:0;' +
        'background:radial-gradient(ellipse at 50% 30%,rgba(120,200,255,0.35) 0%,rgba(60,140,220,0.12) 25%,transparent 50%);';
    document.body.appendChild(flashEl);



    /* CSS预备 */
    gv.style.transition = 'none';
    gv.style.transformOrigin = '50% 50%';

    var DUR = 10.0;
    var cam = { p: 0 };

    /* ── 星空淡出 ── */
    gsap.to(sCvs, {
        opacity: 0, duration: 2.0, delay: DUR * 0.10, ease: 'power1.inOut',
        onComplete: function() {
            if (_sAnim) cancelAnimationFrame(_sAnim);
            if (sCvs.parentNode) sCvs.parentNode.removeChild(sCvs);
        }
    });

    /* ── 大气闪光 ── */
    gsap.to(flashEl, { opacity: 1, duration: 0.8, delay: DUR * 0.16, ease: 'power2.in' });
    gsap.to(flashEl, {
        opacity: 0, duration: 1.2, delay: DUR * 0.26, ease: 'power1.out',
        onComplete: function() { if (flashEl.parentNode) flashEl.parentNode.removeChild(flashEl); }
    });

    /* ── 速度线 ── */
    gsap.to(spCvs, { opacity: 1, duration: 0.6, delay: DUR * 0.22, ease: 'power1.in' });
    gsap.to(spCvs, {
        opacity: 0, duration: 1.5, delay: DUR * 0.64, ease: 'power1.out',
        onComplete: function() { if (spCvs.parentNode) spCvs.parentNode.removeChild(spCvs); }
    });

    /* ═══════════════════════════════════════════════════════════
       V11 — 完全绕开 Globe.gl 相机 · 环球影业风格运镜
       ─────────────────────────────────────────────────────────
       renderer.render 拦截：直接设置 camera.position + lookAt
       不调 pointOfView() → 零冲突、零卡顿
       ═══════════════════════════════════════════════════════════ */

    var _renderer = world.renderer();
    var _camera   = world.camera();
    var _origRender = _renderer.render.bind(_renderer);
    var _camOverride = null;   /* {px,py,pz, lx,ly,lz} */

    _renderer.render = function(__sc, __cm) {
        if (_camOverride) {
            __cm.position.set(_camOverride.px, _camOverride.py, _camOverride.pz);
            __cm.lookAt(_camOverride.lx, _camOverride.ly, _camOverride.lz);
            __cm.updateProjectionMatrix();
            __cm.updateMatrixWorld(true);
        }
        _origRender(__sc, __cm);
    };

    /* 经纬度+海拔 → Three.js 笛卡尔坐标 (Globe.gl 球半径 = 100) */
    var _R3 = 100, _DEG = Math.PI / 180;
    function _g2c(lat, lng, alt) {
        var r   = _R3 * (1 + alt);
        var phi = (90 - lat) * _DEG;
        var th  = lng * _DEG;
        return {
            x: r * Math.sin(phi) * Math.sin(th),
            y: r * Math.cos(phi),
            z: r * Math.sin(phi) * Math.cos(th)
        };
    }

    /* Catmull-Rom 插值 — 比分段 smoothstep 更丝滑 */
    function _cr(p0, p1, p2, p3, t) {
        var t2 = t * t, t3 = t2 * t;
        return 0.5 * (
            (2 * p1) +
            (-p0 + p2) * t +
            (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
            (-p0 + 3 * p1 - 3 * p2 + p3) * t3
        );
    }

    /* 路径关键帧 [lat, lng, altitude] — 环球影业风格 */
    var KF = [
        [-50,  -20,  5.0 ],   /* 虚拟P-1: 深空 */
        [-40,    0,  4.0 ],   /* P0: 深空起点 — 南半球 */
        [-15,   30,  2.2 ],   /* P1: 俯冲接近 — 非洲上空 */
        [ 10,   55,  1.0 ],   /* P2: 进入掠地 — 中东 */
        [ 25,   75,  0.55],   /* P3: 低空掠过 — 印度 */
        [ 35,   95,  0.40],   /* P4: 最低点 — 中亚 */
        [ 38,  105,  0.50],   /* P5: 微抬 — 中国西部 */
        [40.81,111.67,1.0 ],  /* P6: 终点 — 内蒙古 */
        [42,   115,  1.2 ]    /* 虚拟P7: 延伸 */
    ];
    /* 实际动画只用 P0–P6 (index 1–7), P-1和P7是 Catmull-Rom 的虚拟控制点 */
    var _nSeg = KF.length - 3;  /* 6段 */

    function _pathAt(p) {
        if (p <= 0) return { lat: KF[1][0], lng: KF[1][1], alt: KF[1][2] };
        if (p >= 1) return { lat: KF[KF.length - 2][0], lng: KF[KF.length - 2][1], alt: KF[KF.length - 2][2] };
        var seg = p * _nSeg;
        var i = Math.min(Math.floor(seg), _nSeg - 1);
        var t = seg - i;
        return {
            lat: _cr(KF[i][0], KF[i+1][0], KF[i+2][0], KF[i+3][0], t),
            lng: _cr(KF[i][1], KF[i+1][1], KF[i+2][1], KF[i+3][1], t),
            alt: _cr(KF[i][2], KF[i+1][2], KF[i+2][2], KF[i+3][2], t)
        };
    }

    /* ═══════════════════════
       主运镜
       ═══════════════════════ */
    gsap.to(cam, {
        p: 1,
        duration: DUR,
        ease: 'power2.inOut',
        onUpdate: function() {
            var p = cam.p;

            /* ── 当前位置 ── */
            var cur = _pathAt(p);
            var camPos = _g2c(cur.lat, cur.lng, cur.alt);

            /* ── 注视点: 路径前方 + 略低于相机 = "向前飞掠" ── */
            /* 前方偏移量随高度调整：高空看远，低空看近 */
            var lookAhead = 0.06 + cur.alt * 0.03;
            var fwd = _pathAt(Math.min(1.0, p + lookAhead));

            /* 注视点高度 = 相机高度的 30% → 视线向下约 20° — 环球影业经典角度 */
            var lookAlt = cur.alt * 0.25;
            var lookPos = _g2c(fwd.lat, fwd.lng, lookAlt);

            /* 尾部 p>0.82: 平滑过渡到看地心 (0,0,0)
               这样和 actOne 的 Globe.gl 默认 lookAt(0,0,0) 无缝衔接 */
            var earthBlend = 0;
            if (p > 0.82) {
                var tb = (p - 0.82) / 0.18;
                earthBlend = tb * tb * (3 - 2 * tb);
            }

            var finalLook = {
                x: lookPos.x * (1 - earthBlend),
                y: lookPos.y * (1 - earthBlend),
                z: lookPos.z * (1 - earthBlend)
            };

            _camOverride = {
                px: camPos.x, py: camPos.y, pz: camPos.z,
                lx: finalLook.x, ly: finalLook.y, lz: finalLook.z
            };

            /* 同步 Globe.gl 内部状态（不触发相机更新，只更新数据层的参考视角） */
            try { world.pointOfView({ lat: cur.lat, lng: cur.lng, altitude: cur.alt }, 0); } catch(e){}

            /* 速度线 */
            var sf = 0;
            if (p >= 0.15 && p < 0.22) sf = (p - 0.15) / 0.07;
            else if (p >= 0.22 && p <= 0.60) sf = 1.0;
            else if (p > 0.60 && p < 0.70) sf = 1 - (p - 0.60) / 0.10;
            _drawSpeed(sf);
        },
        onComplete: function() {
            /* 还原 */
            _camOverride = null;
            _renderer.render = _origRender;
            gv.style.transform = '';
            gv.style.transformOrigin = '';

            _ctrl.minDistance = _origMinDist;
            _ctrl.maxDistance = _origMaxDist;

            world.pointOfView({ lat: 40.81, lng: 111.67, altitude: 1.0 }, 0);

            if (spCvs.parentNode) spCvs.parentNode.removeChild(spCvs);

            _ctrl.enabled = true;
            _introPlaying = false;

            /* 进入影院模式 — 此时才加 cm-focus 做影院暗调滤镜 */
            var cm = document.getElementById('cinematicMode');
            cm.style.display = 'block';
            gv.style.transition = '';
            gv.classList.add('cm-focus');
            document.getElementById('homeBtn').style.display = '';

            requestAnimationFrame(function() {
                document.querySelector('.letterbox-top').classList.add('active');
                document.querySelector('.letterbox-bottom').classList.add('active');
                document.getElementById('cmProgress').classList.add('show');
                var chartDom = document.getElementById('cmChart');
                if (chartDom && typeof echarts !== 'undefined') {
                    cmChart = echarts.init(chartDom, 'dark');
                }
                setTimeout(function() { playAct(0); }, 600);
            });
        }
    });
}
function exitCinematicMode() {
    cmActive = false;
    if (cmCanvasAnimId) { cancelAnimationFrame(cmCanvasAnimId); cmCanvasAnimId = null; }

    /* 清理ACT I动画/定时器 */
    _actOneCleanup();

    /* 恢复Globe夜间纹理 + 大气层默认值 + 重新启用交互控制 */
    if (typeof world !== 'undefined') {
        world.globeImageUrl(''); _applyDarkGlobeMaterial();
        world.showAtmosphere(true);
        world.atmosphereColor('rgba(96,138,162,0.11)');
        world.atmosphereAltitude(0.22);
        world.controls().enabled = true;
        world.controls().enableRotate = true;
        world.htmlTransitionDuration(800);
    }

    /* 隐藏电影UI */
    document.querySelector('.letterbox-top').classList.remove('active');
    document.querySelector('.letterbox-bottom').classList.remove('active');
    document.getElementById('cmNarration').classList.remove('show');
    document.getElementById('cmGlassPanel').classList.remove('show');
    document.getElementById('cmProgress').classList.remove('show');
    document.getElementById('cmCanvas').style.display = 'none';

    if (cmChart) { cmChart.dispose(); cmChart = null; }

    var gv = document.getElementById('globeViz');
    gv.classList.remove('cm-blur', 'shift-left');
    gv.classList.add('cm-focus');

    setTimeout(function() {
        document.getElementById('cinematicMode').style.display = 'none';
        gv.classList.remove('cm-focus');

        /* 恢复Globe正常数据 */
        if (typeof refreshArcs === 'function') refreshArcs();

        /* 切换到自由探索 — 重置到Page1状态 */
        document.querySelector('.hud').style.display = '';
        document.querySelector('.right-panel').style.display = '';
        document.querySelector('.timeline').style.display = '';
        document.getElementById('viewSwitch').style.display = '';
        document.getElementById('homeBtn').style.display = '';
        /* 确保Page HUD回到Page1 */
        document.getElementById('page1Hud').style.display = '';
        document.getElementById('page2Hud').style.display = 'none';
        document.getElementById('page3Hud').style.display = 'none';
        document.getElementById('page4Hud').style.display = 'none';
        document.getElementById('page3Right').style.display = 'none';
        /* 重置导航按钮高亮 */
        document.querySelectorAll('.nav-btn').forEach(function(b) { b.classList.remove('active'); });
        var firstNav = document.querySelector('.nav-btn[data-page="1"]');
        if (firstNav) firstNav.classList.add('active');
        if (typeof currentPage !== 'undefined') currentPage = 1;
    }, 600);
}

/* ═══════════════════════════════════════════
   §3  幕切换控制 + 幕间过渡
   ═══════════════════════════════════════════ */
function _transitionBlackout(cb) {
    var bo = document.getElementById('cmBlackout');
    if (!bo) { cb(); return; }
    /* ── 防止上一次过渡的残留内联样式堵塞显示 ── */
    bo.style.opacity = ''; bo.style.clipPath = ''; bo.style.transition = ''; bo.style.background = '';
    bo.classList.remove('active');
    void bo.offsetHeight; /* force reflow */
    var type = cmCurrentAct % 3;

    if (type === 1) {
        /* ── 圆形揭幕 ── */
        bo.style.opacity = '1';
        bo.style.clipPath = 'circle(0% at 50% 50%)';
        bo.style.transition = 'clip-path .7s cubic-bezier(.4,0,.2,1)';
        requestAnimationFrame(function() {
            bo.style.clipPath = 'circle(100% at 50% 50%)';
        });
        setTimeout(function() {
            cb();
            setTimeout(function() {
                bo.style.transition = 'clip-path .5s cubic-bezier(.4,0,.2,1)';
                bo.style.clipPath = 'circle(0% at 50% 50%)';
                setTimeout(function() {
                    bo.style.opacity = ''; bo.style.clipPath = ''; bo.style.transition = '';
                    bo.classList.remove('active');
                }, 550);
            }, 300);
        }, 700);
    } else if (type === 2) {
        /* ── 辐射闪白过渡 ── */
        bo.style.background = 'radial-gradient(ellipse at 50% 50%, rgba(120,180,255,.12), #000 65%)';
        bo.classList.add('active');
        setTimeout(function() {
            bo.style.background = '';
            cb();
            setTimeout(function() { bo.classList.remove('active'); }, 300);
        }, 600);
    } else {
        /* ── 默认淡入淡出 ── */
        bo.classList.add('active');
        setTimeout(function() {
            cb();
            setTimeout(function() { bo.classList.remove('active'); }, 300);
        }, 600);
    }
}

function playAct(idx) {
    if (idx < 0 || idx >= ACTS.length) return;

    /* 立即停止上一幕的时间线（视觉重置在黑幕内完成） */
    if (_actOneTL) { _actOneTL.kill(); _actOneTL = null; }
    _actOneTimers.forEach(function(t) { clearTimeout(t); });
    _actOneTimers = [];

    var isFirst = (cmCurrentAct === 0 && idx === 0);
    cmCurrentAct = idx;
    var act = ACTS[idx];

    /* 更新进度点 */
    var dots = document.querySelectorAll('.cm-prog-dot');
    dots.forEach(function(d, i) {
        d.classList.remove('active', 'done');
        if (i < idx) d.classList.add('done');
        if (i === idx) d.classList.add('active');
    });

    /* 更新按钮文字 */
    var nextBtn = document.getElementById('cmNext');
    nextBtn.textContent = idx < ACTS.length - 1 ? '下一幕 ›' : '完成 ✓';

    function _activate() {
        /* 隐藏所有旧UI */
        document.getElementById('cmNarration').classList.remove('show');
        document.getElementById('cmGlassPanel').classList.remove('show');
        document.getElementById('cmCanvas').style.display = 'none';
        _hideOverlay();

        /* 确保黑幕不会残留 — 安全防线 */
        var _bo = document.getElementById('cmBlackout');
        if (_bo) {
            setTimeout(function() {
                _bo.style.opacity = ''; _bo.style.clipPath = ''; _bo.style.transition = ''; _bo.style.background = '';
                _bo.classList.remove('active');
            }, 2000);
        }

        /* Globe相机动画 (如果GSAP和world可用) */
        var hasGsap = typeof gsap !== 'undefined';
        var hasWorld = typeof world !== 'undefined';

        /* 所有幕统一用通用叠层 — 各幕函数自己填充内容 */
        if (idx === 0) actOne(hasGsap, hasWorld);
        else if (idx === 1) actTwo(hasGsap, hasWorld);
        else if (idx === 2) actThree(hasGsap, hasWorld);
        else if (idx === 3) actFour(hasGsap, hasWorld);
        else if (idx === 4) actFive(hasGsap, hasWorld);
        else if (idx === 5) actSix(hasGsap, hasWorld);
        else if (idx === 6) actFinal(hasGsap, hasWorld);
    }

    /* 首次进入无需过渡 */
    if (isFirst) {
        setTimeout(_activate, 300);
    } else {
        /* 平滑过渡：淡出旧UI → 相机飞行 → 加载新幕 */
        var _tOv = document.getElementById('cmActOv');
        var _tCw = document.getElementById('aoChartWrap');
        if (_tOv) { _tOv.style.transition = 'opacity 0.6s ease'; _tOv.style.opacity = '0'; }
        if (_tCw) { _tCw.style.transition = 'opacity 0.6s ease'; _tCw.style.opacity = '0'; }
        setTimeout(function() {
            if (_tOv) { _tOv.style.transition = ''; _tOv.style.opacity = ''; }
            if (_tCw) { _tCw.style.transition = ''; _tCw.style.opacity = ''; }
            _activate();
        }, 650);
    }
}

/* ═══════════════════════════════════════════
   §4  打字机效果
   ═══════════════════════════════════════════ */
function typeWriter(text, el, i) {
    if (!cmActive || i > text.length) {
        /* 打字完成 → 显示结束按钮 */
        if (i > text.length) {
            var endBtns = document.getElementById('aoEndBtns');
            if (endBtns) {
                endBtns.style.display = '';
                setTimeout(function() { endBtns.classList.add('show'); }, 100);
            }
        }
        return;
    }
    var displayed = text.substring(0, i).replace(/\n/g, '<br>');
    el.innerHTML = displayed + '<span class="cm-cursor"></span>';
    
    /* 检测是否刚打完一个换行符，如果是则等待更长时间 */
    var delay = 80; // 基础打字速度从50ms降到80ms
    if (i > 0 && text[i - 1] === '\n') {
        delay = 800; // 每行结束后等待800ms再继续下一行
    }
    setTimeout(function() { typeWriter(text, el, i + 1); }, delay);
}

/** 滚动打字机 — 文字在中间出现，旧文字向上滚出 */
function _scrollTypeWriter(text, innerEl, wrapEl, i) {
    if (!cmActive || i > text.length) {
        if (i > text.length) {
            var endBtns = document.getElementById('aoEndBtns');
            if (endBtns) {
                endBtns.style.display = '';
                setTimeout(function() { endBtns.classList.add('show'); }, 100);
            }
        }
        return;
    }
    var displayed = text.substring(0, i).replace(/\n/g, '<br>');
    innerEl.innerHTML = displayed + '<span class="cm-cursor"></span>';
    /* 保持最新输入行在容器视觉中心 — inner底部padding=45vh把内容顶上去 */
    /* 计算inner实际内容高度，向上偏移使光标处于wrap中心 */
    var wH = wrapEl.clientHeight;
    var iH = innerEl.scrollHeight;
    var targetScroll = iH - wH * 0.5;
    if (targetScroll > 0) {
        wrapEl.scrollTop = targetScroll;
    }
    
    /* 检测是否刚打完一个换行符，如果是则等待更长时间 */
    var delay = 80; // 基础打字速度从50ms降到80ms
    if (i > 0 && text[i - 1] === '\n') {
        delay = 800; // 每行结束后等待800ms再继续下一行
    }
    setTimeout(function() { _scrollTypeWriter(text, innerEl, wrapEl, i + 1); }, delay);
}

/* ═══════════════════════════════════════════
   §5  ACT I — 繁荣的表象
   电影叙事：Globe即故事，弧线逐条射出 + 浮动KPI
   ═══════════════════════════════════════════ */
var _actOneTL = null;       // GSAP timeline引用（切幕时可kill）
var _actOneTimers = [];     // stagger定时器
var _actOneRotate = false;  // 自转标记
var _camTween = null;       // 独立相机运镜GSAP时间线
var _aoChart = null;        // 叠层内ECharts实例
var _trainGroup = null;     // 火车Three.js精灵组
var _trainAnimId = null;    // 火车动画requestAnimationFrame ID
var _turbineEls = [];       // 风机HTML覆盖元素

/* 经纬度→Three.js笛卡尔 (Globe.gl球半径=100) — 全局版 */
var _GR = 100, _GDEG = Math.PI / 180;
function _geo2xyz(lat, lng, alt) {
    var r   = _GR * (1 + (alt || 0));
    var phi = (90 - lat) * _GDEG;
    var th  = lng * _GDEG;
    return {
        x: r * Math.sin(phi) * Math.sin(th),
        y: r * Math.cos(phi),
        z: r * Math.sin(phi) * Math.cos(th)
    };
}
/* 大圆插值(线性)+弧线高度抛物线 */
function _lerpGeoArc(lat1, lng1, lat2, lng2, t, peakAlt) {
    return {
        lat: lat1 + (lat2 - lat1) * t,
        lng: lng1 + (lng2 - lng1) * t,
        alt: 0.008 + (peakAlt || 0.06) * Math.sin(Math.PI * t)
    };
}
/* 清理火车精灵 */
function _cleanTrains() {
    if (_trainAnimId) { cancelAnimationFrame(_trainAnimId); _trainAnimId = null; }
    if (_trainGroup && _trainGroup.parent) {
        _trainGroup.children.forEach(function(s) {
            if (s.material) { if (s.material.map) s.material.map.dispose(); s.material.dispose(); }
        });
        _trainGroup.parent.remove(_trainGroup);
    }
    _trainGroup = null;
}
/* 清理风机覆盖层 */
function _cleanTurbines() {
    _turbineEls.forEach(function(el) { if (el.parentNode) el.parentNode.removeChild(el); });
    _turbineEls = [];
}

/* 每幕主题色方案 */
var _actThemes = {
    gold:   { c1: '#FFD060', c2: '#FFA030', c3: 'rgba(255,208,96,.35)', glow: 'rgba(255,208,96,.12)' },
    red:    { c1: '#FF6E5A', c2: '#FF3838', c3: 'rgba(255,110,90,.35)', glow: 'rgba(255,110,90,.12)' },
    green:  { c1: '#00FFB0', c2: '#00D488', c3: 'rgba(0,255,176,.35)', glow: 'rgba(0,255,176,.12)' },
    cyan:   { c1: '#00E5FF', c2: '#00B4D8', c3: 'rgba(0,229,255,.35)', glow: 'rgba(0,229,255,.12)' },
    ice:    { c1: '#80D4FF', c2: '#60B0FF', c3: 'rgba(128,212,255,.35)', glow: 'rgba(128,212,255,.12)' },
    purple: { c1: '#B48CF0', c2: '#8860D0', c3: 'rgba(180,140,240,.35)', glow: 'rgba(180,140,240,.12)' }
};
/** 获取当前幕ECharts通用tooltip样式 */
function _chartTooltip(theme) {
    var t = _actThemes[theme] || _actThemes.cyan;
    return {
        backgroundColor: 'rgba(8,12,18,.94)',
        borderColor: t.c3,
        textStyle: { color: '#e0f0ff', fontSize: 11, fontFamily: 'Noto Sans SC' },
        extraCssText: 'box-shadow:0 0 20px ' + t.glow + ';backdrop-filter:blur(12px)'
    };
}

/* ── 通用叠层工具函数 ── */
function _showOverlay(label, heading, opts) {
    opts = opts || {};
    var ov = document.getElementById('cmActOv');
    ov.style.display = 'block';
    /* 主题色 */
    if (opts.theme) ov.setAttribute('data-act-theme', opts.theme);
    else ov.removeAttribute('data-act-theme');
    var lbl = document.getElementById('aoLabel');
    lbl.textContent = label;
    lbl.setAttribute('data-text', label);
    document.getElementById('aoHeading').textContent = heading;
    /* 重置所有子元素 */
    var t = document.getElementById('aoTitle');
    t.style.opacity = 0; t.style.transform = 'translate(-50%,-50%)';
    var c = document.getElementById('aoCounter');
    c.textContent = ''; c.style.opacity = 0;
    document.getElementById('aoKpiRow').innerHTML = '';
    document.getElementById('aoKpiRow').style.opacity = 0;
    var ins = document.getElementById('aoInsight');
    ins.textContent = ''; ins.style.opacity = 0;
    var tw = document.getElementById('aoTypewriter');
    tw.style.display = 'none'; tw.innerHTML = ''; tw.style.opacity = 0;
    /* 清除Final遮罩 */
    var _fmask = document.querySelector('.ao-final-mask');
    if (_fmask) _fmask.parentNode.removeChild(_fmask);
    /* 重置结束按钮 */
    var endBtns = document.getElementById('aoEndBtns');
    if (endBtns) { endBtns.style.display = 'none'; endBtns.classList.remove('show'); }
    /* 坐标注释 - 已禁用显示 */
    var cLT = document.getElementById('aoCoordLT');
    var cRB = document.getElementById('aoCoordRB');
    if (cLT) { cLT.textContent = ''; cLT.classList.remove('show'); }
    if (cRB) { cRB.textContent = ''; cRB.classList.remove('show'); }
    // 不再设置coordLT和coordRB内容
    // if (opts.coordLT) { cLT.innerHTML = opts.coordLT; cLT.classList.add('show'); }
    // if (opts.coordRB) { cRB.innerHTML = opts.coordRB; cRB.classList.add('show'); }
    /* 状态行 - 已禁用显示 */
    var sLT = document.getElementById('aoStatusTL');
    var sBR = document.getElementById('aoStatusBR');
    if (sLT) { sLT.innerHTML = ''; sLT.classList.remove('show'); }
    if (sBR) { sBR.innerHTML = ''; sBR.classList.remove('show'); }
    // 不再设置statusTL和statusBR内容
    // if (opts.statusTL) { sLT.innerHTML = opts.statusTL; sLT.classList.add('show'); }
    // if (opts.statusBR) { sBR.innerHTML = opts.statusBR; sBR.classList.add('show'); }
    /* 重置内嵌图表 */
    var cw = document.getElementById('aoChartWrap');
    cw.style.display = 'none'; cw.style.opacity = ''; cw.style.left = ''; cw.style.right = ''; cw.style.top = ''; cw.style.bottom = ''; cw.style.transform = ''; cw.style.position = '';
    cw.classList.remove('show', 'large', 'glow', 'side', 'left', 'bottom', 'overlay');
    /* 清除旧装饰元素 */
    var oldLabel = cw.querySelector('.ao-chart-label');
    if (oldLabel) oldLabel.remove();
    var oldScan = cw.querySelector('.ao-scanline');
    if (oldScan) oldScan.remove();
    if (_aoChart) { _aoChart.dispose(); _aoChart = null; }
    return ov;
}
/** 给图表面板注入终端标签和扫描线 */
function _decorateChart(labelText) {
    var cw = document.getElementById('aoChartWrap');
    if (!cw) return;
    /* 清除上一轮残留的装饰 */
    var old = cw.querySelectorAll('.ao-chart-label,.ao-scanline');
    for (var k = 0; k < old.length; k++) old[k].parentNode.removeChild(old[k]);
    /* 标签 */
    var lbl = document.createElement('div');
    lbl.className = 'ao-chart-label';
    lbl.textContent = labelText || '>_ VISUALIZE';
    cw.appendChild(lbl);
    /* 扫描线 */
    var scan = document.createElement('div');
    scan.className = 'ao-scanline';
    cw.appendChild(scan);
}
function _hideOverlay() {
    var ov = document.getElementById('cmActOv');
    if (ov) ov.style.display = 'none';
}
/** 快速构建KPI HTML — items = [{val:'0', lbl:'说明', unit:'单位', cls:'ao-kpi-gold', bar:0.7},...] */
function _buildKpiRow(items) {
    var h = '';
    items.forEach(function(it, i) {
        if (i > 0) h += '<div class="ao-kpi-sep"></div>';
        h += '<div class="ao-kpi ' + (it.cls || '') + '">' +
             '<div class="ao-kpi-val"><span id="' + (it.id || '') + '">' + (it.val || '0') + '</span>' +
             (it.unit ? '<span class="ao-kpi-unit">' + it.unit + '</span>' : '') + '</div>' +
             '<div class="ao-kpi-lbl">' + it.lbl + '</div>';
        if (typeof it.bar === 'number') {
            h += '<div class="ao-kpi-bar"><div class="ao-kpi-bar-fill" data-fill="' + Math.min(it.bar, 1) * 100 + '"></div></div>';
        }
        h += '</div>';
    });
    document.getElementById('aoKpiRow').innerHTML = h;
}
/** 触发KPI指示条动画 */
function _animKpiBars() {
    var fills = document.querySelectorAll('.ao-kpi-bar-fill[data-fill]');
    for (var i = 0; i < fills.length; i++) {
        (function(el) {
            setTimeout(function() { el.style.width = el.getAttribute('data-fill') + '%'; }, 200 + i * 150);
        })(fills[i]);
    }
}

function _actOneCleanup() {
    if (_actOneTL) { _actOneTL.kill(); _actOneTL = null; }
    if (_camTween) { _camTween.kill(); _camTween = null; }
    _actOneTimers.forEach(function(t) { clearTimeout(t); });
    _actOneTimers = [];
    _cleanTrains();
    _cleanTurbines();
    /* 相机运镜期间禁用HTML标签CSS过渡，防止每帧触发数百个transition导致卡顿 */
    if (typeof world !== 'undefined') world.htmlTransitionDuration(0);
    if (_actOneRotate && typeof world !== 'undefined') {
        world.controls().autoRotate = false;
        _actOneRotate = false;
    }
    /* Canvas动画 */
    if (cmCanvasAnimId) { cancelAnimationFrame(cmCanvasAnimId); cmCanvasAnimId = null; }
    _stopDataLink();
    var cnv = document.getElementById('cmCanvas');
    if (cnv) cnv.style.display = 'none';
    /* ECharts */
    if (cmChart) cmChart.clear();
    document.getElementById('cmGlassPanel').classList.remove('show');
    /* 叠层内图表 — 清除GSAP遗留的内联opacity */
    var cw = document.getElementById('aoChartWrap');
    if (cw) { cw.style.display = 'none'; cw.style.opacity = ''; cw.style.left = ''; cw.style.right = ''; cw.style.top = ''; cw.style.bottom = ''; cw.style.transform = ''; cw.style.position = ''; cw.classList.remove('show', 'large', 'glow', 'side', 'left', 'bottom', 'overlay'); }
    if (_aoChart) { _aoChart.dispose(); _aoChart = null; }
    /* HUD归位 */
    document.getElementById('aoHud').classList.remove('hud-left', 'hud-right', 'hud-center');
    /* 坐标注释/状态行清除 */
    ['aoCoordLT','aoCoordRB'].forEach(function(id) {
        var el = document.getElementById(id); if (el) { el.textContent = ''; el.classList.remove('show'); }
    });
    ['aoStatusTL','aoStatusBR'].forEach(function(id) {
        var el = document.getElementById(id); if (el) { el.innerHTML = ''; el.classList.remove('show'); }
    });
    /* 主题色清除 */
    var _ov = document.getElementById('cmActOv');
    if (_ov) _ov.removeAttribute('data-act-theme');
    /* Globe位置归位 */
    var _gv = document.getElementById('globeViz');
    if (_gv) _gv.classList.remove('shift-left', 'shift-right', 'shift-up');
    /* 右侧遮罩归位 */
    var _sb = document.getElementById('cmSideBg');
    if (_sb) _sb.classList.remove('active');
    /* 左侧遮罩归位 */
    var _sl = document.getElementById('cmSideBgLeft');
    if (_sl) _sl.classList.remove('active');
    /* 隐藏通用叠层并重置子元素 */
    _hideOverlay();
}

/* ═══════════════════════════════════════════
   §4b  数据链路系统 — 地球与图表的视觉桥梁
   能量束从地球屏幕位置射出 → 流向图表区 → 持续粒子流
   ═══════════════════════════════════════════ */
var _dlinkAnimId = null;   /* 数据链路动画帧 */

/** 获取地球球体的屏幕中心坐标（基于DOM位置） */
function _getGlobeScreenPos() {
    var gv = document.getElementById('globeViz');
    if (gv) {
        var r = gv.getBoundingClientRect();
        return { x: r.left + r.width * 0.5, y: r.top + r.height * 0.48 };
    }
    var W = window.innerWidth, H = window.innerHeight;
    return { x: W * 0.5, y: H * 0.5 };
}

/** 获取图表容器的屏幕中心坐标 */
function _getChartScreenPos() {
    var cw = document.getElementById('aoChartWrap');
    if (cw && cw.offsetWidth) {
        var r = cw.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }
    var W = window.innerWidth, H = window.innerHeight;
    return { x: W * 0.65, y: H * 0.5 };
}

/**
 * 启动轻量数据链路 — 从地球到图表的弧线光束 + 流动粒子
 * @param {string} beamColor — 光束主色调 e.g. '80,200,255'
 * @param {number} particleCount — 流动粒子数（上限28）
 */
function _startDataLink(beamColor, particleCount) {
    _stopDataLink();
    return; /* 禁用数据链路光束 */
    var canvas = document.getElementById('cmCanvas');
    if (!canvas) return;
    canvas.style.display = 'block';
    canvas.style.opacity = '1';
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    canvas.style.width = window.innerWidth + 'px';
    canvas.style.height = window.innerHeight + 'px';
    var ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var W = window.innerWidth, H = window.innerHeight;
    beamColor = beamColor || '80,200,255';
    particleCount = Math.min(particleCount || 18, 28);

    /* 流动粒子 */
    var dots = [];
    for (var i = 0; i < particleCount; i++) {
        dots.push({
            t: Math.random(),
            speed: 0.0015 + Math.random() * 0.004,
            sz: 2 + Math.random() * 3,
            lane: (Math.random() - 0.5) * 12  /* 粒子横向偏移，形成"能量流"宽度 */
        });
    }

    var t0 = performance.now();
    var fadeIn = 0;

    function frame() {
        var elapsed = (performance.now() - t0) * 0.001;
        fadeIn = Math.min(fadeIn + 0.02, 1);

        ctx.clearRect(0, 0, W, H);

        var gp = _getGlobeScreenPos();
        var cp = _getChartScreenPos();

        /* 控制点 — 上方弧线 */
        var ctrlX = (gp.x + cp.x) * 0.5;
        var ctrlY = Math.min(gp.y, cp.y) - Math.abs(cp.x - gp.x) * 0.14;

        /* ── 1) 最外层漫射光 ── */
        ctx.lineWidth = 18;
        ctx.strokeStyle = 'rgba(' + beamColor + ',' + (0.04 * fadeIn) + ')';
        ctx.beginPath();
        ctx.moveTo(gp.x, gp.y);
        ctx.quadraticCurveTo(ctrlX, ctrlY, cp.x, cp.y);
        ctx.stroke();

        /* ── 2) 外层柔光 ── */
        ctx.lineWidth = 10;
        ctx.strokeStyle = 'rgba(' + beamColor + ',' + (0.12 * fadeIn) + ')';
        ctx.beginPath();
        ctx.moveTo(gp.x, gp.y);
        ctx.quadraticCurveTo(ctrlX, ctrlY, cp.x, cp.y);
        ctx.stroke();

        /* ── 3) 核心弧线 ── */
        ctx.lineWidth = 3;
        ctx.strokeStyle = 'rgba(' + beamColor + ',' + (0.55 * fadeIn) + ')';
        ctx.beginPath();
        ctx.moveTo(gp.x, gp.y);
        ctx.quadraticCurveTo(ctrlX, ctrlY, cp.x, cp.y);
        ctx.stroke();

        /* ── 4) 地球端辉光 ── */
        var pulse = 0.65 + 0.35 * Math.sin(elapsed * 2.2);
        var gRad = 35 + 18 * pulse;
        var grd = ctx.createRadialGradient(gp.x, gp.y, 0, gp.x, gp.y, gRad);
        grd.addColorStop(0, 'rgba(' + beamColor + ',' + (0.35 * fadeIn * pulse) + ')');
        grd.addColorStop(0.5, 'rgba(' + beamColor + ',' + (0.12 * fadeIn * pulse) + ')');
        grd.addColorStop(1, 'transparent');
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.arc(gp.x, gp.y, gRad, 0, Math.PI * 2);
        ctx.fill();

        /* ── 5) 图表端辉光 ── */
        var cPulse = 0.7 + 0.3 * Math.sin(elapsed * 2.8 + 1);
        var cRad = 28 + 10 * cPulse;
        var cgrd = ctx.createRadialGradient(cp.x, cp.y, 0, cp.x, cp.y, cRad);
        cgrd.addColorStop(0, 'rgba(' + beamColor + ',' + (0.25 * fadeIn * cPulse) + ')');
        cgrd.addColorStop(0.6, 'rgba(' + beamColor + ',' + (0.08 * fadeIn) + ')');
        cgrd.addColorStop(1, 'transparent');
        ctx.fillStyle = cgrd;
        ctx.beginPath();
        ctx.arc(cp.x, cp.y, cRad, 0, Math.PI * 2);
        ctx.fill();

        /* ── 6) 流动粒子 — 多车道能量流 ── */
        for (var i = 0; i < dots.length; i++) {
            var d = dots[i];
            d.t += d.speed;
            if (d.t > 1) d.t -= 1;
            var t = d.t, omt = 1 - t;
            var px = omt * omt * gp.x + 2 * omt * t * ctrlX + t * t * cp.x;
            var py = omt * omt * gp.y + 2 * omt * t * ctrlY + t * t * cp.y;
            /* 法线偏移 — 让粒子不全挤在一条线上 */
            var dx = 2 * (t - 0.5) * (cp.x - gp.x) + 2 * (0.5 - t) * (ctrlX - gp.x);
            var dy = 2 * (t - 0.5) * (cp.y - gp.y) + 2 * (0.5 - t) * (ctrlY - gp.y);
            var len = Math.sqrt(dx * dx + dy * dy) || 1;
            px += (-dy / len) * d.lane;
            py += (dx / len) * d.lane;
            /* 头尾渐隐 */
            var head = t < 0.1 ? t / 0.1 : (t > 0.9 ? (1 - t) / 0.1 : 1);
            var a = head * fadeIn * 0.85;
            ctx.beginPath();
            ctx.arc(px, py, d.sz, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(' + beamColor + ',' + a.toFixed(3) + ')';
            ctx.fill();
        }

        _dlinkAnimId = requestAnimationFrame(frame);
    }
    _dlinkAnimId = requestAnimationFrame(frame);
}

function _stopDataLink() {
    if (_dlinkAnimId) {
        cancelAnimationFrame(_dlinkAnimId);
        _dlinkAnimId = null;
    }
    /* 不立即隐藏canvas，让外部控制淡出 */
}

/** 地球大气脉冲 — 图表数据刷新时闪烁 */
function _globePulse() { /* disabled */ }

function actOne(hasGsap, hasWorld) {
    _actOneCleanup();

    document.getElementById('cmNarration').classList.remove('show');
    document.getElementById('cmGlassPanel').classList.remove('show');

    var gv = document.getElementById('globeViz');
    gv.classList.remove('cm-blur', 'shift-left', 'shift-right', 'shift-up');
    gv.classList.add('cm-focus');
    gv.style.opacity = '1';

    /* ── 角度一：资源诅咒的价值漏斗 ──
       Globe叙事：贸易弧线射向全球 → 弧线颜色区分出口(金色)与进口(蓝色)
       图表叙事：出口商品结构(矿产为主) vs 进口商品结构(机电为主) 剪刀差 */

    _showOverlay('PUSH · I', '资源诅咒的价值漏斗', {
        theme: 'gold',
        coordLT: '40.81°N &nbsp; 111.67°E',
        statusTL: '>_ <span class="hl">SCAN</span> TRADE_FLOW\n   SRC: NBS.2024\n   MODE: ARC_EXPORT',
        statusBR: 'HASH: <span class="hl">7F3A</span>\nTIMESTAMP: 2024.Q4'
    });

    /* 2024 出口/进口数据（万美元→亿美元） */
    var exp24 = exportStructure[2024];
    var imp24 = importStructure[2024];
    var expTotal = +(R.trade[2024].exportK / 100000).toFixed(1);
    var impTotal = +(R.trade[2024].importK / 100000).toFixed(1);
    var deficit  = +(impTotal - expTotal).toFixed(1);

    _buildKpiRow([
        { id: 'aoV1', val: '0', lbl: '出口', unit: '亿美元', cls: 'ao-kpi-gold', bar: 0.35 },
        { id: 'aoV2', val: '0', lbl: '进口', unit: '亿美元', cls: 'ao-kpi-blue', bar: 0.65 },
        { id: 'aoV3', val: '0', lbl: '逆差', unit: '亿美元', cls: 'ao-kpi-red', bar: 0.8 }
    ]);

    var aoTitle   = document.getElementById('aoTitle');
    var aoCounter = document.getElementById('aoCounter');
    var aoKpiRow  = document.getElementById('aoKpiRow');
    var elV1 = document.getElementById('aoV1');
    var elV2 = document.getElementById('aoV2');
    var elV3 = document.getElementById('aoV3');
    var aoInsight = document.getElementById('aoInsight');

    if (hasWorld) {
        world.controls().minDistance = 1;
        world.globeImageUrl(''); _applyDarkGlobeMaterial();
        world.atmosphereColor('rgba(96,138,162,0.11)');
        world.atmosphereAltitude(0.32);
        world.arcsData([]).pointsData([]).htmlElementsData([]).ringsData([]);
        if (typeof loadedPaths !== 'undefined' && loadedPaths) world.pathsData(loadedPaths);

        var originPts = [{ lat: IM[1], lng: IM[0], size: 0.6, color: '#00d4aa', alt: 0.02, name: '内蒙古', cat: 'origin' }];
        var originLbls = [];
        var originRings = [
            { lat: IM[1], lng: IM[0], maxR: 5, propagationSpeed: 1.2, repeatPeriod: 700 },
            { lat: IM[1], lng: IM[0], maxR: 3, propagationSpeed: 0.8, repeatPeriod: 1200 }
        ];
        world.pointsData(originPts).htmlElementsData(originLbls).ringsData(originRings);

        /* 读取当前相机位置 — GSAP统一运镜，不用Globe.gl内置动画 */
        var _curP = world.pointOfView();
        var pov = { lat: _curP.lat, lng: _curP.lng, altitude: _curP.altitude };
        world.controls().autoRotate = false;
        world.controls().enabled = false;
    }

    if (!hasGsap) return;

    var tl = gsap.timeline();
    _actOneTL = tl;

    /* Phase 0: 相机从当前位置飞到第一幕起点 */
    if (hasWorld) {
        tl.to(pov, {
            lat: 40.81, lng: 111.67, altitude: 1.0, duration: 2.5, ease: 'power1.inOut',
            onUpdate: function() { world.pointOfView(pov, 0); }
        }, 0);
    }

    /* Phase 1: 标题 */
    tl.to(aoTitle, { opacity: 1, duration: 1.2, ease: 'power2.out' }, 0);
    tl.to(aoTitle, { opacity: 0, y: -50, duration: 0.8, ease: 'power2.in' }, 2.5);

    /* Phase 2: Globe贸易弧线逐条射出 — 拉远到太平洋视角看全球贸易网 */
    if (hasWorld) {
        tl.to(pov, {
            lat: 20, lng: 160, altitude: 2.8, duration: 22, ease: 'sine.inOut',
            onUpdate: function() { world.pointOfView(pov, 0); }
        }, 1.5);

        var allTradeArcs = mkTradeArcs(2024);
        var curArcs = [];
        var curPts = originPts.slice();
        var curLbls = originLbls.slice();
        var curRings = originRings.slice();
        var total = tradeDests.length;

        allTradeArcs.forEach(function(arc, idx) {
            tl.call(function() {
                if (!cmActive || cmCurrentAct !== 0) return;
                curArcs.push(arc);
                var d = tradeDests[idx];
                if (d) {
                    curPts.push({ lat: d.lat, lng: d.lng, size: 0.35 + d.w * 0.06, color: comStyle[d.com].pt, alt: 0.008, name: d.cn, cat: 'trade' });
                    curLbls.push({ lat: d.lat, lng: d.lng, name: d.cn, color: comStyle[d.com].lb, big: false, alt: 0.02, cat: 'trade' });
                    curRings.push({ lat: d.lat, lng: d.lng, maxR: 2, propagationSpeed: 1.5, repeatPeriod: 2000 });
                }
                world.arcsData(curArcs.slice()).pointsData(curPts.slice()).htmlElementsData(curLbls.slice()).ringsData(curRings.slice());
                aoCounter.textContent = '贸易伙伴 ' + (idx + 1) + ' / ' + total + ' · ' + (d ? d.cn : '');
            }, null, 3 + idx * 0.3);
        });

        tl.to(aoCounter, { opacity: 1, duration: 0.6, ease: 'power2.out' }, 3);
        var arcsEndT = 3 + total * 0.3 + 0.5;
        tl.to(aoCounter, { opacity: 0, duration: 0.6, ease: 'power2.in' }, arcsEndT);
    }

    /* Phase 3: KPI — 出口/进口/逆差 */
    var kpiStartT = hasWorld ? (3 + tradeDests.length * 0.3 + 1.2) : 4;
    var kpiObj = { e: 0, i: 0, d: 0 };
    tl.to(aoKpiRow, { opacity: 1, duration: 0.8, ease: 'power2.out', onComplete: _animKpiBars }, kpiStartT);
    tl.to(kpiObj, {
        e: expTotal, i: impTotal, d: deficit, duration: 2, ease: 'power1.out',
        onUpdate: function() {
            if (elV1) elV1.textContent = kpiObj.e.toFixed(1);
            if (elV2) elV2.textContent = kpiObj.i.toFixed(1);
            if (elV3) elV3.textContent = '-' + kpiObj.d.toFixed(1);
        }
    }, kpiStartT + 0.3);

    /* Phase 4: 地球左移 + 数据链路 */
    tl.call(function() {
        if (!cmActive || cmCurrentAct !== 0) return;
        document.getElementById('globeViz').classList.add('shift-left');
        document.getElementById('aoHud').classList.add('hud-left');
        var _sb = document.getElementById('cmSideBg'); if (_sb) _sb.classList.add('active');
    }, null, kpiStartT + 1.5);
    tl.call(function() {
        if (!cmActive || cmCurrentAct !== 0) return;
        _startDataLink('0,255,136', 12);
        _globePulse('#00d4aa', 0.35);
    }, null, kpiStartT + 2.5);

    /* Phase 5: 出口vs进口商品结构对比图 */
    var cw = document.getElementById('aoChartWrap');
    cw.style.display = 'block';
    cw.classList.add('side', 'large');
    cw.style.width = 'clamp(320px,38vw,600px)';
    cw.style.position = 'absolute'; cw.style.left = 'auto'; cw.style.right = '0'; cw.style.top = '50%'; cw.style.transform = 'translateY(-50%)';
    _decorateChart('进出口贸易流向');
    var chartEl = document.getElementById('aoChartEl');
    if (typeof echarts !== 'undefined') {
        _aoChart = echarts.init(chartEl, 'dark');
        /* ── Sankey 贸易流向图：出口+进口双向 ── */
        var expTotal = +(exp24.mineral/10000 + exp24.equip/10000 + exp24.chem/10000 + exp24.rare/10000 + exp24.agri/10000 + exp24.other/10000).toFixed(1);
        var impTotal = +(imp24.resource/10000 + imp24.equip/10000 + imp24.hiMfg/10000 + imp24.chem/10000 + imp24.agri/10000 + imp24.other/10000).toFixed(1);
        _aoChart.setOption({
            backgroundColor: 'transparent',
            title: { text: '进出口贸易流', left: 'center', top: 4,
                textStyle: { color: 'rgba(0,210,168,.6)', fontSize: 14, fontWeight: 600, fontFamily: 'Noto Sans SC' } },
            tooltip: {
                backgroundColor: 'rgba(8,12,18,.94)', borderColor: 'rgba(0,210,168,.15)',
                textStyle: { color: '#e0ffe8', fontSize: 11 },
                appendToBody: true,
                formatter: function(p) {
                    if (p.dataType === 'edge') return p.data.source + ' → ' + p.data.target + '<br/>' + p.data.value + ' 亿$';
                    return p.name;
                }
            },
            series: [{
                type: 'sankey', layout: 'none', top: 36, bottom: 16, left: 30, right: 80,
                nodeWidth: 14, nodeGap: 10,
                orient: 'horizontal',
                layoutIterations: 0,
                emphasis: { focus: 'adjacency', lineStyle: { opacity: 0.6 } },
                lineStyle: { color: 'gradient', curveness: 0.5, opacity: 0.25 },
                label: { color: 'rgba(255,255,255,.7)', fontSize: 10, fontFamily: 'Noto Sans SC' },
                itemStyle: { borderWidth: 0 },
                data: [
                    { name: '内蒙古出口', itemStyle: { color: '#00d4aa' } },
                    { name: '矿产品',     itemStyle: { color: 'rgba(0,210,168,.85)' } },
                    { name: '机电设备(出)', itemStyle: { color: 'rgba(0,210,168,.7)' } },
                    { name: '化工品(出)',   itemStyle: { color: 'rgba(0,210,168,.55)' } },
                    { name: '稀土制品',     itemStyle: { color: 'rgba(0,210,168,.5)' } },
                    { name: '农畜产品(出)', itemStyle: { color: 'rgba(0,210,168,.4)' } },
                    { name: '其他(出)',     itemStyle: { color: 'rgba(0,210,168,.2)' } },
                    { name: '内蒙古进口', itemStyle: { color: 'rgba(0,158,148,.7)' } },
                    { name: '资源矿产',   itemStyle: { color: 'rgba(0,158,148,.6)' } },
                    { name: '机电设备(进)', itemStyle: { color: 'rgba(0,158,148,.5)' } },
                    { name: '高端制造',     itemStyle: { color: 'rgba(0,158,148,.45)' } },
                    { name: '化工品(进)',   itemStyle: { color: 'rgba(0,158,148,.35)' } },
                    { name: '农产品',       itemStyle: { color: 'rgba(0,158,148,.25)' } },
                    { name: '其他(进)',     itemStyle: { color: 'rgba(0,158,148,.15)' } }
                ],
                links: [
                    { source: '内蒙古出口', target: '矿产品',      value: +(exp24.mineral/10000).toFixed(1) },
                    { source: '内蒙古出口', target: '机电设备(出)', value: +(exp24.equip/10000).toFixed(1) },
                    { source: '内蒙古出口', target: '化工品(出)',   value: +(exp24.chem/10000).toFixed(1) },
                    { source: '内蒙古出口', target: '稀土制品',     value: +(exp24.rare/10000).toFixed(1) },
                    { source: '内蒙古出口', target: '农畜产品(出)', value: +(exp24.agri/10000).toFixed(1) },
                    { source: '内蒙古出口', target: '其他(出)',     value: +(exp24.other/10000).toFixed(1) },
                    { source: '资源矿产',   target: '内蒙古进口',  value: +(imp24.resource/10000).toFixed(1) },
                    { source: '机电设备(进)', target: '内蒙古进口', value: +(imp24.equip/10000).toFixed(1) },
                    { source: '高端制造',    target: '内蒙古进口',  value: +(imp24.hiMfg/10000).toFixed(1) },
                    { source: '化工品(进)',  target: '内蒙古进口',  value: +(imp24.chem/10000).toFixed(1) },
                    { source: '农产品',      target: '内蒙古进口',  value: +(imp24.agri/10000).toFixed(1) },
                    { source: '其他(进)',    target: '内蒙古进口',  value: +(imp24.other/10000).toFixed(1) }
                ],
                animationDuration: 2000, animationEasing: 'cubicOut'
            }]
        });
        /* 点击Sankey节点展示份额 */
        _aoChart.on('click', function(p) {
            if (p.dataType === 'node') {
                aoInsight.textContent = '聚焦：' + p.name + ' —— 点击贸易流线查看金额细节。';
            } else if (p.dataType === 'edge') {
                aoInsight.textContent = p.data.source + ' → ' + p.data.target + '：' + p.data.value + '亿美元';
            }
            if (typeof gsap !== 'undefined') gsap.fromTo(aoInsight, { opacity: 0.3 }, { opacity: 1, duration: 0.5 });
        });
    }
    tl.to(cw, { opacity: 1, duration: 1, onStart: function() { cw.classList.add('show', 'glow'); } }, kpiStartT + 3);

    /* Phase 6: 洞察 */
    aoInsight.textContent = '出口以矿产品为主(37%)，进口却是机电设备+高端制造(38%)——亿吨廉价煤炭换回来的是昂贵的精密设备。纯卖资源，就是在产业链底端打工。';
    tl.to(aoInsight, { opacity: 1, duration: 1, ease: 'power2.out' }, kpiStartT + 5);

    /* Phase 7: 缓慢旋转 — 深空远景俯瞰全球贸易格局 */
    if (hasWorld) {
        tl.to(pov, {
            lat: 15, lng: 200, altitude: 2.5, duration: 35, ease: 'none',
            onUpdate: function() { world.pointOfView(pov, 0); }
        }, 12);
    }
}

/* ═══════════════════════════════════════════
   §6  ACT II — 双碳倒逼的增长极限
   煤炭弧线 + 产量天花板 + 工资增速骤降
   ═══════════════════════════════════════════ */
function actTwo(hasGsap, hasWorld) {
    _actOneCleanup();

    var gv = document.getElementById('globeViz');
    gv.classList.remove('cm-blur', 'shift-left', 'shift-right', 'shift-up');
    gv.classList.add('cm-focus');
    gv.style.opacity = '1';

    /* Globe叙事：暗红大气 + 煤炭铁路运输线 — 单列火车dash沿轨道行驶 */
    if (hasWorld) {
        world.controls().minDistance = 1;
        world.globeImageUrl(''); _applyDarkGlobeMaterial();
        world.atmosphereColor('rgba(96,138,162,0.11)');
        world.atmosphereAltitude(0.15);
        world.arcsData([]).pointsData([]).htmlElementsData([]).ringsData([]);
        if (typeof loadedPaths !== 'undefined' && loadedPaths) world.pathsData(loadedPaths);

        /* 每条线路：1条实线铁轨 + 1条移动长段"火车车体" */
        var coalArcs = [];
        coalDests.forEach(function(d, i) {
            /* 铁轨 — 细实线 */
            coalArcs.push({
                startLat: IM[1], startLng: IM[0], endLat: d.lat, endLng: d.lng,
                color: ['rgba(255,180,100,0.25)', 'rgba(255,140,60,0.10)'],
                stroke: 0.35,
                dashLen: 0, dashGap: 0,
                dashInitGap: 0,
                speed: 0,
                alt: 0.012 + i * 0.001,
                cat: 'rail', label: d.name
            });
            /* 火车车体 — 沿轨道滑行的暖色长段 */
            coalArcs.push({
                startLat: IM[1], startLng: IM[0], endLat: d.lat, endLng: d.lng,
                color: ['rgba(255,210,80,0.95)', 'rgba(255,130,40,0.55)'],
                stroke: 1.4,
                dashLen: 0.06, dashGap: 0.94,
                dashInitGap: (i * 0.14) % 1,
                speed: 6000 + i * 300,
                alt: 0.013 + i * 0.001,
                cat: 'coal', label: d.name, comLabel: '传统能源/煤炭'
            });
        });

        var coalPts = [{ lat: IM[1], lng: IM[0], size: 0.6, color: '#00d4aa', alt: 0.02, name: '内蒙古', cat: 'origin' }];
        var coalLbls = [];
        var coalRings = [{ lat: IM[1], lng: IM[0], maxR: 4, propagationSpeed: 1, repeatPeriod: 900 }];

        coalDests.forEach(function(d) {
            coalPts.push({ lat: d.lat, lng: d.lng, size: 0.35, color: '#e0a060', alt: 0.008, name: d.name, cat: 'coal' });
            coalLbls.push({ lat: d.lat, lng: d.lng, name: d.name, color: '#ffd8a0', big: false, alt: 0.02, cat: 'coal' });
        });

        world.pointsData(coalPts).htmlElementsData(coalLbls).ringsData(coalRings);

        world.controls().autoRotate = false;
        /* ACT II: 从北方高纬度俯压 — 碳天花板压顶感 */
        var _curP = world.pointOfView();
        var pov = { lat: _curP.lat, lng: _curP.lng, altitude: _curP.altitude };
        if (hasGsap) {
            _camTween = gsap.timeline();
            world.controls().enabled = false;
            _camTween.to(pov, {
                lat: 45, lng: 100, altitude: 0.65,
                duration: 3, ease: 'power1.inOut',
                onUpdate: function() { world.pointOfView(pov, 0); }
            });
            _camTween.to(pov, {
                lat: 28, lng: 115, altitude: 0.85, duration: 18, ease: 'sine.inOut',
                onUpdate: function() { world.pointOfView(pov, 0); }
            });
        } else {
            world.pointOfView({ lat: 45, lng: 100, altitude: 0.65 }, 1500);
        }
    }

    _showOverlay('PUSH · II', '双碳倒逼的增长极限', {
        theme: 'red',
        coordLT: '52.00°N &nbsp; 100.00°E',
        statusTL: '>_ <span class="hl">LOAD</span> COAL_NET\n   MODE: COMPRESS_VIEW\n   ATMO: DARK_RED',
        statusBR: 'BLOCK: <span class="hl">CO2_CAP</span>\nENTROPY: HIGH'
    });

    var coal24 = 12.20;
    var wage24 = 21.50, wageGr24 = 9.5;
    var popGr24 = -3.70;

    _buildKpiRow([
        { id: 'ao2V1', val: '0', lbl: '煤炭产量', unit: '亿吨', cls: 'ao-kpi-gold', bar: 0.95 },
        { id: 'ao2V2', val: '0', lbl: '矿业人均年薪', unit: '万', cls: 'ao-kpi-blue', bar: 0.6 },
        { id: 'ao2V3', val: '0', lbl: '工资增速', unit: '%', cls: 'ao-kpi-red', bar: 0.3 },
        { id: 'ao2V4', val: '0', lbl: '人口自然增长', unit: '‰', cls: 'ao-kpi-red', bar: 0.1 }
    ]);

    var aoTitle = document.getElementById('aoTitle');
    var aoCounter = document.getElementById('aoCounter');
    var aoKpiRow = document.getElementById('aoKpiRow');
    var aoInsight = document.getElementById('aoInsight');
    var el1 = document.getElementById('ao2V1');
    var el2 = document.getElementById('ao2V2');
    var el3 = document.getElementById('ao2V3');
    var el4 = document.getElementById('ao2V4');

    if (!hasGsap) return;

    var tl = gsap.timeline();
    _actOneTL = tl;

    /* Phase 1: 标题 */
    tl.to(aoTitle, { opacity: 1, duration: 1.2, ease: 'power2.out' }, 0);
    tl.to(aoTitle, { opacity: 0, y: -40, duration: 0.8, ease: 'power2.in' }, 2.5);

    /* Phase 2: 铁轨+火车逐条射出 */
    if (hasWorld) {
        var curArcs = [];
        coalDests.forEach(function(dest, idx) {
            tl.call(function() {
                if (!cmActive || cmCurrentAct !== 1) return;
                /* 每条线路：1条铁轨 + 1条火车亮点 */
                curArcs.push(coalArcs[idx * 2]);       // 铁轨
                curArcs.push(coalArcs[idx * 2 + 1]);   // 火车
                world.arcsData(curArcs.slice());
                aoCounter.textContent = '煤炭运输线路 ' + (idx + 1) + '/' + coalDests.length + ' · ' + dest.name;
            }, null, 2 + idx * 0.4);
        });
        tl.to(aoCounter, { opacity: 1, duration: 0.5 }, 2);
        tl.to(aoCounter, { opacity: 0, duration: 0.5 }, 2 + coalDests.length * 0.4 + 0.5);
    }

    /* Phase 3: KPI */
    var kObj = { a: 0, b: 0, c: 0, d: 0 };
    tl.to(aoKpiRow, { opacity: 1, duration: 0.8, onComplete: _animKpiBars }, 3.5);
    tl.to(kObj, {
        a: coal24, b: wage24, c: wageGr24, d: popGr24, duration: 2.5, ease: 'power1.out',
        onUpdate: function() {
            if (el1) el1.textContent = kObj.a.toFixed(1);
            if (el2) el2.textContent = kObj.b.toFixed(1);
            if (el3) el3.textContent = kObj.c.toFixed(1);
            if (el4) el4.textContent = kObj.d.toFixed(2);
        }
    }, 3.8);

    /* Phase 4: 地球右移 + 数据链路（镜像布局） */
    tl.call(function() {
        if (!cmActive || cmCurrentAct !== 1) return;
        document.getElementById('globeViz').classList.add('shift-right');
        document.getElementById('aoHud').classList.add('hud-right');
        var _sl = document.getElementById('cmSideBgLeft'); if (_sl) _sl.classList.add('active');
    }, null, 5);
    tl.call(function() {
        if (!cmActive || cmCurrentAct !== 1) return;
        _startDataLink('255,80,50', 12);
        _globePulse('#ff4020', 0.3);
    }, null, 5.8);

    /* Phase 5: 双轴图：煤炭产量曲线（已见顶）+ 工资增速柱（骤降）+ 人口增长率（跌入负值） */
    var cw = document.getElementById('aoChartWrap');
    cw.style.display = 'block';
    cw.classList.add('side', 'left', 'large');
    cw.style.width = 'clamp(320px,38vw,600px)';
    cw.style.position = 'absolute'; cw.style.left = '0'; cw.style.right = 'auto'; cw.style.top = '50%'; cw.style.transform = 'translateY(-50%)';
    _decorateChart('煤炭产业增长极限');
    var chartEl = document.getElementById('aoChartEl');
    if (typeof echarts !== 'undefined' && typeof nmgOldEngine !== 'undefined') {
        _aoChart = echarts.init(chartEl, 'dark');
        var yrs = nmgOldEngine.years;
        var F = nmgFunnel;
        _aoChart.setOption({
            backgroundColor: 'transparent',
            grid: { left: 52, right: 80, top: 44, bottom: 56 },
            legend: { top: 4, right: 8, textStyle: { color: 'rgba(255,255,255,.35)', fontSize: 10 },
                itemWidth: 12, itemHeight: 6 },
            dataZoom: [{
                type: 'slider', bottom: 4, height: 16, start: 0, end: 100,
                borderColor: 'rgba(255,255,255,.04)', backgroundColor: 'rgba(255,255,255,.02)',
                fillerColor: 'rgba(255,100,80,.08)', handleSize: '60%',
                handleStyle: { color: 'rgba(255,100,80,.4)', borderColor: 'rgba(255,100,80,.2)' },
                textStyle: { color: 'rgba(255,255,255,.3)', fontSize: 9 },
                dataBackground: { lineStyle: { color: 'rgba(255,100,80,.15)' }, areaStyle: { color: 'rgba(255,100,80,.04)' } }
            }],
            xAxis: {
                type: 'category', data: yrs, boundaryGap: false,
                axisLine: { lineStyle: { color: 'rgba(255,255,255,.06)' } },
                axisLabel: { color: 'rgba(255,255,255,.35)', fontFamily: 'Orbitron', fontSize: 10 }
            },
            yAxis: [
                { type: 'value', name: '亿吨 / 万元',
                  nameTextStyle: { color: 'rgba(0,210,168,.35)', fontSize: 9 },
                  axisLine: { show: false },
                  splitLine: { lineStyle: { color: 'rgba(255,255,255,.03)' } },
                  axisLabel: { color: 'rgba(0,210,168,.4)', fontFamily: 'Orbitron', fontSize: 10 } },
                { type: 'value', name: '%',
                  nameTextStyle: { color: 'rgba(255,100,80,.35)', fontSize: 9 },
                  axisLine: { show: false }, splitLine: { show: false },
                  axisLabel: { color: 'rgba(255,100,80,.35)', fontFamily: 'Orbitron', fontSize: 10 } }
            ],
            series: [
                {
                    name: '煤炭产量(亿吨)', type: 'line', data: nmgOldEngine.coalOutput, smooth: 0.3,
                    symbol: 'circle', symbolSize: 6,
                    lineStyle: { color: 'rgba(0,210,168,.85)', width: 2.5 },
                    itemStyle: { color: '#00d4aa' },
                    areaStyle: { color: {
                        type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
                        colorStops: [
                            { offset: 0, color: 'rgba(0,210,168,.18)' },
                            { offset: 1, color: 'rgba(0,210,168,.01)' }
                        ]
                    } },
                    markLine: {
                        silent: true, symbol: 'none',
                        data: [{ yAxis: 12, name: '天花板' }],
                        lineStyle: { color: 'rgba(255,70,50,.45)', type: 'dashed', width: 1.5 },
                        label: { show: true, position: 'end', formatter: '⚠ 产量天花板 ≈12亿吨', color: 'rgba(255,100,80,.7)', fontSize: 10 }
                    },
                    emphasis: { lineStyle: { width: 4 }, itemStyle: { borderWidth: 3, borderColor: '#fff' } },
                    animationDuration: 1500
                },
                {
                    name: '矿业年薪(万)', type: 'line', data: nmgOldEngine.mineWage, smooth: 0.3,
                    symbol: 'diamond', symbolSize: 5,
                    lineStyle: { color: 'rgba(0,210,168,.7)', width: 2 },
                    itemStyle: { color: '#5098d8' },
                    animationDuration: 1600
                },
                {
                    name: '工资增速%', type: 'bar', data: nmgOldEngine.mineWageGr, yAxisIndex: 1,
                    barWidth: 14,
                    itemStyle: {
                        color: function(p) {
                            return p.value < 8 ? 'rgba(255,80,60,.65)' : 'rgba(100,200,220,.5)';
                        },
                        borderRadius: [3, 3, 0, 0]
                    },
                    animationDuration: 1200
                },
                {
                    name: '人口增长‰', type: 'line', data: F.popGrowth, yAxisIndex: 1, smooth: 0.3,
                    symbol: 'triangle', symbolSize: 5,
                    lineStyle: { color: 'rgba(255,100,80,.6)', width: 1.8, type: 'dashed' },
                    itemStyle: { color: '#ff6644' },
                    markLine: {
                        silent: true, symbol: 'none',
                        data: [{ yAxis: 0 }],
                        lineStyle: { color: 'rgba(255,255,255,.15)', type: 'solid', width: 1 },
                        label: { show: true, position: 'start', formatter: '零增长线', color: 'rgba(255,255,255,.25)', fontSize: 9 }
                    },
                    emphasis: { lineStyle: { width: 3 } },
                    animationDuration: 1800
                }
            ],
            tooltip: {
                backgroundColor: 'rgba(12,18,35,.92)', borderColor: 'rgba(255,255,255,.08)',
                textStyle: { color: '#eafaff', fontSize: 11 }, trigger: 'axis',
                appendToBody: true,
                formatter: function(params) {
                    var yr = params[0] ? params[0].axisValue : '';
                    var h = '<b style="color:rgba(0,229,255,.7)">' + yr + '</b><br>';
                    params.forEach(function(p) {
                        var dot = '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:' + p.color + ';margin-right:5px"></span>';
                        h += dot + p.seriesName + '：<b>' + p.value + '</b><br>';
                    });
                    return h;
                }
            },
            visualMap: {
                show: false, seriesIndex: 2, dimension: 0,
                pieces: [{ gte: 6, lte: 8, color: 'rgba(255,60,40,.08)' }]
            },
            markArea: { silent: true, data: [[
                { xAxis: '2022', itemStyle: { color: 'rgba(255,60,40,.04)' } },
                { xAxis: '2024' }
            ]] }
        });
        /* 点击年份展示详情 */
        _aoChart.on('click', function(p) {
            var yr = p.name || (p.data && p.data.name);
            if (p.seriesName === '煤炭产量(亿吨)') {
                aoInsight.textContent = yr + '年煤炭产量' + p.value + '亿吨——逼近12亿吨天花板，增量空间几乎为零。';
            } else if (p.seriesName === '工资增速%') {
                var tag = p.value < 8 ? '⚠ 增速骤降' : '尚在高位';
                aoInsight.textContent = yr + '年矿业工资增速' + p.value + '%，' + tag + '。行业收缩信号明显。';
            } else if (p.seriesName === '人口增长‰') {
                aoInsight.textContent = yr + '年人口自然增长率' + p.value + '‰' + (p.value < 0 ? '——已跌入负增长区间。' : '。');
            }
            if (typeof gsap !== 'undefined') gsap.fromTo(aoInsight, { opacity: 0.3 }, { opacity: 1, duration: 0.5 });
        });
    }
    tl.to(cw, { opacity: 1, duration: 0.8, onStart: function() { cw.classList.add('show', 'glow'); } }, 6.5);

    aoInsight.textContent = '碳达峰碳中和硬指标之下，煤炭产量增速放缓至3.1%，工资增速从23.9%骤降至9.5%。人口连续4年负增长(-3.70‰)。继续依赖挖煤和粗放重工，增长引擎就会直接熄火。';
    tl.to(aoInsight, { opacity: 1, duration: 1, ease: 'power2.out' }, 8.5);
}

/* ═══════════════════════════════════════════
   §7  ACT III — 天赐风光 · 自然的馈赠 (PULL·I)
   内蒙古自然条件优势：风大、光足、地广 → 新能源圣地
   ═══════════════════════════════════════════ */
function actThree(hasGsap, hasWorld) {
    _actOneCleanup();

    var gv = document.getElementById('globeViz');
    gv.classList.remove('cm-blur', 'shift-left', 'shift-right', 'shift-up');
    gv.classList.add('cm-focus');
    gv.style.opacity = '1';

    /* Globe叙事：翠绿大气 + 绿电辐射弧线 + 🌬️风机群 → 自然资源辐射全国 */
    if (hasWorld) {
        world.controls().minDistance = 1;
        world.globeImageUrl(''); _applyDarkGlobeMaterial();
        world.atmosphereColor('rgba(96,138,162,0.11)');
        world.atmosphereAltitude(0.25);
        world.arcsData([]).pointsData([]).htmlElementsData([]).ringsData([]);
        if (typeof loadedPaths !== 'undefined' && loadedPaths) world.pathsData(loadedPaths);

        var greenArcs = mkGreenArcs(2024);
        var gPts = [{ lat: IM[1], lng: IM[0], size: 0.6, color: '#00d4aa', alt: 0.02, name: '内蒙古', cat: 'origin' }];
        var gLbls = [];
        var gRings = [{ lat: IM[1], lng: IM[0], maxR: 5, propagationSpeed: 1.2, repeatPeriod: 800 }];

        greenDests.forEach(function(d) {
            gPts.push({ lat: d.lat, lng: d.lng, size: 0.35, color: '#00d4aa', alt: 0.008, name: d.name, cat: 'green' });
            gLbls.push({ lat: d.lat, lng: d.lng, name: d.name, color: '#a0ffd0', big: false, alt: 0.02, cat: 'green' });
        });

        /* 风机标注点 — 内蒙古主要风电基地 */
        var turbineSites = [
            { lat: 43.93, lng: 116.05, name: '锡林郭勒风电场' },
            { lat: 40.99, lng: 113.13, name: '乌兰察布风电场' },
            { lat: 40.74, lng: 107.39, name: '巴彦淖尔风电场' },
            { lat: 42.26, lng: 118.87, name: '赤峰风电场' },
            { lat: 38.85, lng: 105.73, name: '阿拉善光伏风电' },
            { lat: 46.08, lng: 122.04, name: '兴安盟风电基地' }
        ];
        turbineSites.forEach(function(t) {
            gPts.push({ lat: t.lat, lng: t.lng, size: 0.2, color: '#60ffa0', alt: 0.015, name: t.name, cat: 'turbine' });
            gLbls.push({ lat: t.lat, lng: t.lng, name: t.name, color: '#80ffc0', big: false, alt: 0.05, cat: 'turbine' });
        });

        world.pointsData(gPts).htmlElementsData(gLbls).ringsData(gRings);

        world.controls().autoRotate = false;
        /* ACT III: 从西北远处看过来 — 追随风从西往东吹的方向 */
        var _curP = world.pointOfView();
        var pov = { lat: _curP.lat, lng: _curP.lng, altitude: _curP.altitude };
        if (hasGsap) {
            _camTween = gsap.timeline();
            world.controls().enabled = false;
            _camTween.to(pov, {
                lat: 46, lng: 90, altitude: 1.0,
                duration: 3, ease: 'power1.inOut',
                onUpdate: function() { world.pointOfView(pov, 0); }
            });
            _camTween.to(pov, {
                lat: 38, lng: 115, altitude: 0.65, duration: 22, ease: 'sine.inOut',
                onUpdate: function() { world.pointOfView(pov, 0); }
            });
        } else {
            world.pointOfView({ lat: 46, lng: 90, altitude: 1.0 }, 1500);
        }
    }

    _showOverlay('PULL · I', '天赐风光 · 自然的馈赠', {
        theme: 'green',
        coordLT: '50.00°N &nbsp; 80.00°E',
        statusTL: '>_ <span class="hl">EXEC</span> GREEN_ARC\n   TYPE: WIND+SOLAR\n   FLOW: RADIATE_ALL',
        statusBR: 'SIGNAL: <span class="hl">CLEAN</span>\nVECTOR: W→E'
    });

    var CL = typeof nmgClimate !== 'undefined' ? nmgClimate : null;
    var NE = typeof nmgNewEngine !== 'undefined' ? nmgNewEngine : null;

    var windSpd  = CL ? CL.nmg[0] : 5.8;
    var sunHours = CL ? CL.nmg[1] : 3100;
    var windPct  = CL ? CL.windSharePct : 21;
    var costKwh  = CL ? CL.nmg[4] : 0.22;

    _buildKpiRow([
        { id: 'ao3V1', val: '0', lbl: '年均风速', unit: 'm/s', cls: 'ao-kpi-green', bar: 0.72 },
        { id: 'ao3V2', val: '0', lbl: '年日照时数', unit: 'h', cls: 'ao-kpi-gold', bar: 0.88 },
        { id: 'ao3V3', val: '0', lbl: '风能占全国', unit: '%', cls: 'ao-kpi-blue', bar: 0.5 },
        { id: 'ao3V4', val: '0', lbl: '度电成本', unit: '元', cls: 'ao-kpi-green', bar: 0.35 }
    ]);

    var aoTitle = document.getElementById('aoTitle');
    var aoCounter = document.getElementById('aoCounter');
    var aoKpiRow = document.getElementById('aoKpiRow');
    var aoInsight = document.getElementById('aoInsight');
    var el1 = document.getElementById('ao3V1');
    var el2 = document.getElementById('ao3V2');
    var el3 = document.getElementById('ao3V3');
    var el4 = document.getElementById('ao3V4');

    if (!hasGsap) return;

    var tl = gsap.timeline();
    _actOneTL = tl;

    /* Phase 1: 标题 */
    tl.to(aoTitle, { opacity: 1, duration: 1.2, ease: 'power2.out' }, 0);
    tl.to(aoTitle, { opacity: 0, y: -40, duration: 0.8, ease: 'power2.in' }, 2.5);

    /* Phase 2: 绿电弧线逐条射出 */
    if (hasWorld) {
        var curGreenArcs = [];
        greenArcs.forEach(function(arc, idx) {
            tl.call(function() {
                if (!cmActive || cmCurrentAct !== 2) return;
                curGreenArcs.push(arc);
                world.arcsData(curGreenArcs.slice());
                var destIdx = idx % greenDests.length;
                aoCounter.textContent = '绿电输送 ' + (destIdx + 1) + '/' + greenDests.length + ' · ' + greenDests[destIdx].name;
            }, null, 2 + idx * 0.35);
        });
        tl.to(aoCounter, { opacity: 1, duration: 0.5 }, 2);
        tl.to(aoCounter, { opacity: 0, duration: 0.5 }, 2 + greenDests.length * 0.35 + 0.5);


    }

    /* Phase 3: KPI — 自然禀赋数据 */
    var kObj = { a: 0, b: 0, c: 0, d: 0 };
    tl.to(aoKpiRow, { opacity: 1, duration: 0.8 }, 3.5);
    tl.to(kObj, {
        a: windSpd, b: sunHours, c: windPct, d: costKwh, duration: 2.5, ease: 'power1.out',
        onUpdate: function() {
            if (el1) el1.textContent = kObj.a.toFixed(1);
            if (el2) el2.textContent = Math.round(kObj.b).toLocaleString();
            if (el3) el3.textContent = Math.round(kObj.c);
            if (el4) el4.textContent = kObj.d.toFixed(2);
        }
    }, 3.8);

    /* Phase 4: 地球左移 + 数据链路（绿色） */
    tl.call(function() {
        if (!cmActive || cmCurrentAct !== 2) return;
        document.getElementById('globeViz').classList.add('shift-left');
        document.getElementById('aoHud').classList.add('hud-left');
        var _sb = document.getElementById('cmSideBg'); if (_sb) _sb.classList.add('active');
    }, null, 5);
    tl.call(function() {
        if (!cmActive || cmCurrentAct !== 2) return;
        _startDataLink('80,232,160', 14);
        _globePulse('#30d158', 0.35);
    }, null, 5.8);

    /* Phase 5: 自然禀赋对比雷达图 — 为什么是内蒙古？ */
    var cw = document.getElementById('aoChartWrap');
    cw.style.display = 'block';
    cw.classList.add('side', 'large');
    cw.style.position = 'absolute'; cw.style.left = 'auto'; cw.style.right = '0'; cw.style.top = '50%'; cw.style.transform = 'translateY(-50%)';
    _decorateChart('风光资源禀赋');
    var chartEl = document.getElementById('aoChartEl');
    if (typeof echarts !== 'undefined' && CL) {
        _aoChart = echarts.init(chartEl, 'dark');

        /* ── 雷达图：内蒙古 vs 全国 vs 沿海 五维度对比 ── */
        var costMax = 0.5;
        /* 归一化到0-100方便雷达显示 */
        var windMax = 8, sunMax = 3500, densMax = 300, landMax = 50;
        var nmgRadar  = [
            (CL.nmg[0]/windMax*100).toFixed(0)*1,
            (CL.nmg[1]/sunMax*100).toFixed(0)*1,
            (CL.nmg[2]/densMax*100).toFixed(0)*1,
            (CL.nmg[3]/landMax*100).toFixed(0)*1,
            Math.round(((costMax - CL.nmg[4]) / costMax) * 100)
        ];
        var natRadar = [
            (CL.national[0]/windMax*100).toFixed(0)*1,
            (CL.national[1]/sunMax*100).toFixed(0)*1,
            (CL.national[2]/densMax*100).toFixed(0)*1,
            (CL.national[3]/landMax*100).toFixed(0)*1,
            Math.round(((costMax - CL.national[4]) / costMax) * 100)
        ];
        var coastRadar = [
            (CL.coastal[0]/windMax*100).toFixed(0)*1,
            (CL.coastal[1]/sunMax*100).toFixed(0)*1,
            (CL.coastal[2]/densMax*100).toFixed(0)*1,
            (CL.coastal[3]/landMax*100).toFixed(0)*1,
            Math.round(((costMax - CL.coastal[4]) / costMax) * 100)
        ];

        _aoChart.setOption({
            backgroundColor: 'transparent',
            title: { text: '新能源禀赋五维雷达', left: 'center', top: 4,
                textStyle: { color: 'rgba(0,210,168,.5)', fontSize: 12, fontWeight: 600 } },
            legend: {
                bottom: 4, textStyle: { color: 'rgba(255,255,255,.55)', fontSize: 10 },
                itemWidth: 16, itemHeight: 8, itemGap: 20,
                data: ['内蒙古', '全国均值', '沿海省份']
            },
            radar: {
                indicator: [
                    { name: '年均风速', max: 100 },
                    { name: '年日照', max: 100 },
                    { name: '风能密度', max: 100 },
                    { name: '可利用荒地', max: 100 },
                    { name: '度电成本优势', max: 100 }
                ],
                center: ['50%', '48%'], radius: '65%',
                shape: 'circle',
                axisName: { color: 'rgba(0,210,168,.55)', fontSize: 10 },
                splitArea: { areaStyle: { color: ['rgba(0,210,168,.02)', 'rgba(0,210,168,.04)', 'rgba(0,210,168,.02)', 'rgba(0,210,168,.04)', 'rgba(0,210,168,.02)'] } },
                axisLine: { lineStyle: { color: 'rgba(0,210,168,.1)' } },
                splitLine: { lineStyle: { color: 'rgba(0,210,168,.08)' } }
            },
            series: [{
                type: 'radar',
                symbol: 'circle', symbolSize: 5,
                emphasis: { areaStyle: { opacity: 0.35 }, lineStyle: { width: 3 } },
                data: [
                    { name: '内蒙古', value: nmgRadar,
                      lineStyle: { color: '#00d4aa', width: 2.5, shadowColor: 'rgba(0,210,168,.4)', shadowBlur: 10 },
                      areaStyle: { color: 'rgba(0,210,168,.15)' },
                      itemStyle: { color: '#00d4aa', borderColor: '#00d4aa' } },
                    { name: '全国均值', value: natRadar,
                      lineStyle: { color: 'rgba(0,210,168,.5)', width: 1.5 },
                      areaStyle: { color: 'rgba(0,210,168,.06)' },
                      itemStyle: { color: 'rgba(0,210,168,.6)' } },
                    { name: '沿海省份', value: coastRadar,
                      lineStyle: { color: 'rgba(255,255,255,.2)', width: 1.5, type: 'dashed' },
                      areaStyle: { color: 'rgba(255,255,255,.03)' },
                      itemStyle: { color: 'rgba(255,255,255,.3)' } }
                ],
                animationDuration: 2000
            }],
            tooltip: {
                backgroundColor: 'rgba(8,12,18,.94)', borderColor: 'rgba(0,210,168,.12)',
                textStyle: { color: '#e0ffe8', fontSize: 10 },
                appendToBody: true,
                formatter: function(p) {
                    if (!p.data || !p.data.value) return '';
                    var dims = ['年均风速', '年日照', '风能密度', '可利用荒地', '度电成本优势'];
                    var h = '<b style="color:#00d4aa">' + p.name + '</b><br>';
                    p.data.value.forEach(function(v, i) { h += dims[i] + '：<b>' + v + '</b>/100<br>'; });
                    return h;
                }
            }
        });
        /* 点击雷达区域展示对比信息 */
        _aoChart.on('click', function(p) {
            if (p.name === '内蒙古') {
                aoInsight.textContent = '内蒙古五维全优：风速、日照、风能密度、荒地面积、度电成本——全国无出其右。';
            } else if (p.name === '全国均值') {
                aoInsight.textContent = '全国均值在各维度均大幅落后于内蒙古，尤其是可利用荒地和风能密度差距显著。';
            } else {
                aoInsight.textContent = '沿海省份虽有经济优势，但自然禀赋远逊于内蒙古——新能源赛道，天赋决定起跑线。';
            }
            if (typeof gsap !== 'undefined') gsap.fromTo(aoInsight, { opacity: 0.3 }, { opacity: 1, duration: 0.5 });
        });
    }
    tl.to(cw, { opacity: 1, duration: 0.8, onStart: function() { cw.classList.add('show', 'glow'); } }, 6.5);

    aoInsight.textContent = '年均风速5.8m/s(全国第一)，年日照3100小时(全国前三)，40万km²荒漠戈壁可建电站——内蒙古的天赋，是用气候和地理写就的能源版图。度电成本仅0.22元，是沿海的一半。';
    tl.to(aoInsight, { opacity: 1, duration: 1, ease: 'power2.out' }, 8.5);
}

/* ═══════════════════════════════════════════
   §8  ACT IV — 算力跨维变现 (PULL·II)
   绿电→算力价值链 + 算力爆发柱 + 科技投入折线
   ═══════════════════════════════════════════ */
function actFour(hasGsap, hasWorld) {
    _actOneCleanup();

    var gv = document.getElementById('globeViz');
    gv.classList.remove('cm-blur', 'shift-left', 'shift-right', 'shift-up');
    gv.classList.add('cm-focus');
    gv.style.opacity = '1';

    /* Globe叙事：青蓝大气 + 算力辐射弧线（绿电流向算力节点城市） */
    if (hasWorld) {
        world.controls().minDistance = 1;
        world.globeImageUrl(''); _applyDarkGlobeMaterial();
        world.atmosphereColor('rgba(96,138,162,0.11)');
        world.atmosphereAltitude(0.32);
        world.arcsData([]).pointsData([]).htmlElementsData([]).ringsData([]);
        if (typeof loadedPaths !== 'undefined' && loadedPaths) world.pathsData(loadedPaths);

        /* 数据中心节点城市 */
        var dcCities = [
            { lat: 41.03, lng: 113.13, name: '乌兰察布', role: '算力枢纽', size: 0.5 },
            { lat: 40.84, lng: 111.75, name: '呼和浩特', role: '数据中心', size: 0.4 },
            { lat: 39.61, lng: 109.99, name: '鄂尔多斯', role: '绿算基地', size: 0.35 },
            { lat: 40.66, lng: 109.84, name: '包头', role: '智算节点', size: 0.3 }
        ];
        var dcPts = [{ lat: IM[1], lng: IM[0], size: 0.6, color: '#64d8cb', alt: 0.02, name: '内蒙古', cat: 'origin' }];
        var dcLbls = [];
        var dcRings = [{ lat: IM[1], lng: IM[0], maxR: 5, propagationSpeed: 1.2, repeatPeriod: 800 }];

        /* 算力弧线：内蒙古 → 各算力城市 + 城市 → 北京/天津（东数西算回传） */
        var dcArcs = [];
        dcCities.forEach(function(c, ci) {
            dcPts.push({ lat: c.lat, lng: c.lng, size: c.size, color: '#64d8cb', alt: 0.01, name: c.name, cat: 'data' });
            dcLbls.push({ lat: c.lat, lng: c.lng, name: c.name, color: '#a0f0e0', big: false, alt: 0.015 + ci * 0.008, cat: 'data' });
            dcRings.push({ lat: c.lat, lng: c.lng, maxR: 3, propagationSpeed: 0.8, repeatPeriod: 1200 });
            dcArcs.push({
                startLat: IM[1], startLng: IM[0], endLat: c.lat, endLng: c.lng,
                color: ['rgba(0,210,168,.8)', 'rgba(0,210,168,.15)'], stroke: 1.5, dashLength: 0.4, dashGap: 0.15, dashAnimateTime: 2500
            });
        });
        /* 东数西算回传弧线：乌兰察布 → 北京 */
        dcArcs.push({
            startLat: 41.03, startLng: 113.13, endLat: 39.9, endLng: 116.4,
            color: ['rgba(255,214,10,.7)', 'rgba(255,214,10,.15)'], stroke: 2, dashLength: 0.3, dashGap: 0.1, dashAnimateTime: 2000
        });
        dcPts.push({ lat: 39.9, lng: 116.4, size: 0.4, color: '#ffd60a', alt: 0.01, name: '北京', cat: 'demand' });
        dcLbls.push({ lat: 39.9, lng: 116.4, name: '北京', color: '#ffd060', big: false, alt: 0.02, cat: 'demand' });

        world.pointsData(dcPts).htmlElementsData(dcLbls).ringsData(dcRings);
        world.controls().autoRotate = false;
        /* ACT IV: 从东部需求端(太平洋方向)回望内蒙古 — 东数西算逆向视角 */
        var _curP = world.pointOfView();
        var pov = { lat: _curP.lat, lng: _curP.lng, altitude: _curP.altitude };
        if (hasGsap) {
            _camTween = gsap.timeline();
            world.controls().enabled = false;
            _camTween.to(pov, {
                lat: 40, lng: 120, altitude: 0.9,
                duration: 3, ease: 'power1.inOut',
                onUpdate: function() { world.pointOfView(pov, 0); }
            });
            _camTween.to(pov, {
                lat: 42, lng: 110, altitude: 0.75, duration: 18, ease: 'sine.inOut',
                onUpdate: function() { world.pointOfView(pov, 0); }
            });
        } else {
            world.pointOfView({ lat: 40, lng: 120, altitude: 0.9 }, 1500);
        }
    }

    _showOverlay('PULL · II', '算力跨维变现', {
        theme: 'cyan',
        coordLT: '40.00°N &nbsp; 120.00°E',
        statusTL: '>_ <span class="hl">LINK</span> DATA_NODE\n   ROUTE: EAST←WEST\n   PROTO: COMPUTE_V2',
        statusBR: 'CIPHER: <span class="hl">DC04</span>\nLATENCY: 8ms'
    });

    var NE = typeof nmgNewEngine !== 'undefined' ? nmgNewEngine : null;
    var dataCenterP24 = NE ? NE.dataCenterP[8] : 1400;
    var greenPwr24    = NE ? NE.greenPower[8] : 1148;
    var sciSpend24    = NE ? NE.sciSpend[8] : 86.27;
    var infoInvest24  = NE ? NE.infoInvest[8] : 312;

    _buildKpiRow([
        { id: 'ao4V1', val: '0', lbl: '算力规模', unit: 'P', cls: 'ao-kpi-blue', bar: 0.85 },
        { id: 'ao4V2', val: '0', lbl: '绿电输送', unit: '亿kWh', cls: 'ao-kpi-green', bar: 0.7 },
        { id: 'ao4V3', val: '0', lbl: '科技投入', unit: '亿元', cls: 'ao-kpi-gold', bar: 0.55 },
        { id: 'ao4V4', val: '0', lbl: '信息业投资', unit: '亿', cls: 'ao-kpi-blue', bar: 0.6 }
    ]);

    var aoTitle = document.getElementById('aoTitle');
    var aoCounter = document.getElementById('aoCounter');
    var aoKpiRow = document.getElementById('aoKpiRow');
    var aoInsight = document.getElementById('aoInsight');
    var el1 = document.getElementById('ao4V1');
    var el2 = document.getElementById('ao4V2');
    var el3 = document.getElementById('ao4V3');
    var el4 = document.getElementById('ao4V4');

    if (!hasGsap) return;

    var tl = gsap.timeline();
    _actOneTL = tl;

    /* Phase 1: 标题 */
    tl.to(aoTitle, { opacity: 1, duration: 1.2, ease: 'power2.out' }, 0);
    tl.to(aoTitle, { opacity: 0, y: -40, duration: 0.8, ease: 'power2.in' }, 2.5);

    /* Phase 2: 算力弧线逐条射出 */
    if (hasWorld) {
        var curDcArcs = [];
        dcArcs.forEach(function(arc, idx) {
            tl.call(function() {
                if (!cmActive || cmCurrentAct !== 3) return;
                curDcArcs.push(arc);
                world.arcsData(curDcArcs.slice());
                var lbl = idx < dcCities.length ? dcCities[idx].name + ' · ' + dcCities[idx].role : '北京 · 算力需求端';
                aoCounter.textContent = '算力节点 ' + (idx + 1) + '/' + dcArcs.length + ' · ' + lbl;
            }, null, 2 + idx * 0.5);
        });
        tl.to(aoCounter, { opacity: 1, duration: 0.5 }, 2);
        tl.to(aoCounter, { opacity: 0, duration: 0.5 }, 2 + dcArcs.length * 0.5 + 0.5);
    }

    /* Phase 3: KPI */
    var kObj = { a: 0, b: 0, c: 0, d: 0 };
    tl.to(aoKpiRow, { opacity: 1, duration: 0.8, onComplete: _animKpiBars }, 3.5);
    tl.to(kObj, {
        a: dataCenterP24, b: greenPwr24, c: sciSpend24, d: infoInvest24,
        duration: 2.5, ease: 'power1.out',
        onUpdate: function() {
            if (el1) el1.textContent = Math.round(kObj.a).toLocaleString();
            if (el2) el2.textContent = Math.round(kObj.b).toLocaleString();
            if (el3) el3.textContent = kObj.c.toFixed(1);
            if (el4) el4.textContent = Math.round(kObj.d);
        }
    }, 3.8);

    /* Phase 4: 地球左移 + 数据链路（青蓝色） */
    tl.call(function() {
        if (!cmActive || cmCurrentAct !== 3) return;
        document.getElementById('globeViz').classList.add('shift-left');
        document.getElementById('aoHud').classList.add('hud-left');
        var _sb = document.getElementById('cmSideBg'); if (_sb) _sb.classList.add('active');
    }, null, 5);
    tl.call(function() {
        if (!cmActive || cmCurrentAct !== 3) return;
        _startDataLink('100,216,203', 14);
        _globePulse('#64d8cb', 0.35);
    }, null, 5.8);

    /* Phase 5: 算力爆发柱 + 绿电折线 + 科技投入折线 — 展示煤→电→算跨维升级 */
    var cw = document.getElementById('aoChartWrap');
    cw.style.display = 'block';
    cw.classList.add('side', 'large');
    cw.style.width = 'clamp(320px,38vw,600px)';
    cw.style.position = 'absolute'; cw.style.left = 'auto'; cw.style.right = '0'; cw.style.top = '50%'; cw.style.transform = 'translateY(-50%)';
    _decorateChart('算力产业升级');
    var chartEl = document.getElementById('aoChartEl');
    if (typeof echarts !== 'undefined' && NE) {
        _aoChart = echarts.init(chartEl, 'dark');
        _aoChart.setOption({
            backgroundColor: 'transparent',
            grid: { left: 52, right: 56, top: 44, bottom: 56 },
            legend: { top: 4, right: 8, textStyle: { color: 'rgba(255,255,255,.4)', fontSize: 10 },
                itemWidth: 14, itemHeight: 8 },
            dataZoom: [{
                type: 'slider', bottom: 4, height: 16, start: 0, end: 100,
                borderColor: 'rgba(255,255,255,.04)', backgroundColor: 'rgba(255,255,255,.02)',
                fillerColor: 'rgba(0,210,168,.08)', handleSize: '60%',
                handleStyle: { color: 'rgba(0,210,168,.4)', borderColor: 'rgba(0,210,168,.2)' },
                textStyle: { color: 'rgba(255,255,255,.3)', fontSize: 9 },
                dataBackground: { lineStyle: { color: 'rgba(0,210,168,.15)' }, areaStyle: { color: 'rgba(0,210,168,.04)' } }
            }],
            xAxis: {
                type: 'category', data: NE.years, boundaryGap: true,
                axisLine: { lineStyle: { color: 'rgba(255,255,255,.06)' } },
                axisLabel: { color: 'rgba(255,255,255,.35)', fontFamily: 'Orbitron', fontSize: 10 }
            },
            yAxis: [
                { type: 'value', name: 'P(算力)',
                  nameTextStyle: { color: 'rgba(0,210,168,.4)', fontSize: 9 },
                  axisLine: { show: false },
                  splitLine: { lineStyle: { color: 'rgba(255,255,255,.03)' } },
                  axisLabel: { color: 'rgba(0,210,168,.4)', fontFamily: 'Orbitron', fontSize: 10 } },
                { type: 'value', name: '亿kWh / 亿元',
                  nameTextStyle: { color: 'rgba(0,210,168,.35)', fontSize: 9 },
                  axisLine: { show: false }, splitLine: { show: false },
                  axisLabel: { color: 'rgba(0,210,168,.35)', fontFamily: 'Orbitron', fontSize: 10 } }
            ],
            series: [
                {
                    name: '算力规模(P)', type: 'bar', data: NE.dataCenterP,
                    barWidth: 20,
                    itemStyle: {
                        color: {
                            type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
                            colorStops: [
                                { offset: 0, color: 'rgba(0,210,168,.75)' },
                                { offset: 1, color: 'rgba(0,210,168,.08)' }
                            ]
                        },
                        borderRadius: [3, 3, 0, 0]
                    },
                    markPoint: {
                        data: [{ type: 'max', name: 'PEAK' }],
                        symbol: 'pin', symbolSize: 42,
                        label: { show: true, formatter: '70×', fontSize: 10, fontWeight: 700, color: '#fff' },
                        itemStyle: { color: 'rgba(0,210,168,.85)' }
                    },
                    emphasis: { itemStyle: { shadowBlur: 20, shadowColor: 'rgba(0,210,168,.5)' } },
                    animationDuration: 1400
                },
                {
                    name: '绿电输送(亿kWh)', type: 'line', data: NE.greenPower, yAxisIndex: 1,
                    smooth: 0.3, symbol: 'circle', symbolSize: 6,
                    lineStyle: { color: 'rgba(0,210,168,.8)', width: 2.5 },
                    itemStyle: { color: '#00d4aa' },
                    areaStyle: { color: {
                        type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
                        colorStops: [
                            { offset: 0, color: 'rgba(0,210,168,.15)' },
                            { offset: 1, color: 'rgba(0,210,168,.01)' }
                        ]
                    } },
                    animationDuration: 1600
                },
                {
                    name: '科技投入(亿元)', type: 'line', data: NE.sciSpend, yAxisIndex: 1,
                    smooth: 0.3, symbol: 'diamond', symbolSize: 5,
                    lineStyle: { color: 'rgba(0,158,148,.7)', width: 2 },
                    itemStyle: { color: '#5098d8' },
                    animationDuration: 1800
                }
            ],
            tooltip: {
                backgroundColor: 'rgba(12,18,35,.92)', borderColor: 'rgba(0,210,168,.15)',
                textStyle: { color: '#eafaff', fontSize: 11 }, trigger: 'axis',
                appendToBody: true,
                formatter: function(params) {
                    var yr = params[0] ? params[0].axisValue : '';
                    var h = '<b style="color:rgba(0,229,255,.7)">' + yr + '</b>';
                    params.forEach(function(p) {
                        h += '<br>' + p.marker + ' ' + p.seriesName + '：<b>' + (typeof p.value === 'number' ? p.value.toLocaleString() : p.value) + '</b>';
                    });
                    return h;
                }
            }
        });
        /* 点击柱体高亮并显示增长倍数 */
        _aoChart.on('click', function(p) {
            if (p.seriesName === '算力规模(P)' && p.dataIndex > 0) {
                var first = NE.dataCenterP[0] || 1;
                var ratio = (p.value / first).toFixed(0);
                aoInsight.textContent = p.name + '年算力达到' + p.value + 'P，较' + NE.years[0] + '年增长' + ratio + '倍。';
                gsap.fromTo(aoInsight, { opacity: 0.3 }, { opacity: 1, duration: 0.5 });
            }
        });
    }
    tl.to(cw, { opacity: 1, duration: 0.8, onStart: function() { cw.classList.add('show', 'glow'); } }, 6.5);

    aoInsight.textContent = '算力从20P爆发至1400P，增长70倍——东数西算战略下，内蒙古把廉价绿电变成高附加值算力，1度电从0.26元变成了价值数十元的AI推理服务。煤→电→算，跨维变现。';
    tl.to(aoInsight, { opacity: 1, duration: 1, ease: 'power2.out' }, 8.5);
}

/* ═══════════════════════════════════════════
   §9  ACT V — 冷凉区位的天然优势 (PULL·III)
   Globe显示内蒙古→北京近距离 + 数据中心城市分布
   ECharts：PUE对比 + 延迟对比 + 电价优势
   ═══════════════════════════════════════════ */
function actFive(hasGsap, hasWorld) {
    _actOneCleanup();

    var gv = document.getElementById('globeViz');
    gv.classList.remove('cm-blur', 'shift-left', 'shift-right', 'shift-up');
    gv.classList.add('cm-focus');
    gv.style.opacity = '1';

    /* Globe叙事：冷蓝大气 + 数据中心城市点 + 北京近距离弧线 */
    if (hasWorld) {
        world.controls().minDistance = 1;
        world.globeImageUrl(''); _applyDarkGlobeMaterial();
        world.atmosphereColor('rgba(96,138,162,0.11)');
        world.atmosphereAltitude(0.18);
        world.arcsData([]).pointsData([]).htmlElementsData([]).ringsData([]);
        if (typeof loadedPaths !== 'undefined' && loadedPaths) world.pathsData(loadedPaths);

        /* 数据中心城市 + 北京/天津需求端 */
        var dcNodes = [
            { lat: 41.03, lng: 113.13, name: '乌兰察布', pue: 1.15, dist: 320, size: 0.5 },
            { lat: 40.84, lng: 111.75, name: '呼和浩特', pue: 1.20, dist: 400, size: 0.4 },
            { lat: 39.61, lng: 109.99, name: '鄂尔多斯', pue: 1.18, dist: 560, size: 0.35 }
        ];
        var dcPts = [{ lat: IM[1], lng: IM[0], size: 0.5, color: '#5090ff', alt: 0.02, name: '内蒙古', cat: 'origin' }];
        var dcLbls = [];
        var dcRings = [];
        var dcArcs = [];

        dcNodes.forEach(function(n) {
            dcPts.push({ lat: n.lat, lng: n.lng, size: n.size, color: '#64b5f6', alt: 0.01, name: n.name, cat: 'dc' });
            dcLbls.push({ lat: n.lat, lng: n.lng, name: n.name + ' PUE=' + n.pue, color: '#a0d0ff', big: false, alt: 0.02, cat: 'dc' });
            dcRings.push({ lat: n.lat, lng: n.lng, maxR: 3, propagationSpeed: 0.8, repeatPeriod: 1200 });
            /* 城市 → 北京 短距离弧线 */
            dcArcs.push({
                startLat: n.lat, startLng: n.lng, endLat: 39.9, endLng: 116.4,
                color: ['rgba(100,180,255,.7)', 'rgba(100,180,255,.15)'], stroke: 1.8, dashLength: 0.3, dashGap: 0.1, dashAnimateTime: 1800
            });
        });
        dcPts.push({ lat: 39.9, lng: 116.4, size: 0.45, color: '#ffd060', alt: 0.015, name: '北京', cat: 'demand' });
        dcLbls.push({ lat: 39.9, lng: 116.4, name: '北京 · <5ms延迟', color: '#ffe080', big: false, alt: 0.025, cat: 'demand' });

        world.pointsData(dcPts).htmlElementsData(dcLbls).ringsData(dcRings);
        world.controls().autoRotate = false;
        /* ACT V: 超低空近距离 — 强调内蒙古紧邻京津冀的地理优势 */
        var _curP = world.pointOfView();
        var pov = { lat: _curP.lat, lng: _curP.lng, altitude: _curP.altitude };
        if (hasGsap) {
            _camTween = gsap.timeline();
            world.controls().enabled = false;
            _camTween.to(pov, {
                lat: 41, lng: 114.5, altitude: 0.3,
                duration: 3, ease: 'power1.inOut',
                onUpdate: function() { world.pointOfView(pov, 0); }
            });
            _camTween.to(pov, {
                lat: 39.5, lng: 112, altitude: 0.4, duration: 16, ease: 'sine.inOut',
                onUpdate: function() { world.pointOfView(pov, 0); }
            });
        } else {
            world.pointOfView({ lat: 41, lng: 114.5, altitude: 0.3 }, 1500);
        }
    }

    _showOverlay('PULL · III', '冷凉区位的天然优势', {
        theme: 'ice',
        coordLT: '41.00°N &nbsp; 114.50°E',
        statusTL: '>_ <span class="hl">MAP</span> COOL_ZONE\n   AVG_TEMP: -1.3°C\n   PUE: ≤1.15',
        statusBR: 'ZONE: <span class="hl">ICE_BELT</span>\nCOOL_DAYS: 210+'
    });

    _buildKpiRow([
        { id: 'ao5V1', val: '0', lbl: '乌兰察布PUE', cls: 'ao-kpi-blue', bar: 0.92 },
        { id: 'ao5V2', val: '0', lbl: '距北京', unit: 'km', cls: 'ao-kpi-gold', bar: 0.6 },
        { id: 'ao5V3', val: '0', lbl: '年均气温', unit: '℃', cls: 'ao-kpi-blue', bar: 0.3 },
        { id: 'ao5V4', val: '0', lbl: '电价', unit: '元/kWh', cls: 'ao-kpi-green', bar: 0.45 }
    ]);

    var aoTitle = document.getElementById('aoTitle');
    var aoCounter = document.getElementById('aoCounter');
    var aoKpiRow = document.getElementById('aoKpiRow');
    var aoInsight = document.getElementById('aoInsight');
    var el1 = document.getElementById('ao5V1');
    var el2 = document.getElementById('ao5V2');
    var el3 = document.getElementById('ao5V3');
    var el4 = document.getElementById('ao5V4');

    if (!hasGsap) return;

    var tl = gsap.timeline();
    _actOneTL = tl;

    /* Phase 1: 标题 */
    tl.to(aoTitle, { opacity: 1, duration: 1.2, ease: 'power2.out' }, 0);
    tl.to(aoTitle, { opacity: 0, y: -40, duration: 0.8, ease: 'power2.in' }, 2.5);

    /* Phase 2: 弧线逐条射出 */
    if (hasWorld) {
        var curArcs = [];
        dcArcs.forEach(function(arc, idx) {
            tl.call(function() {
                if (!cmActive || cmCurrentAct !== 4) return;
                curArcs.push(arc);
                world.arcsData(curArcs.slice());
                aoCounter.textContent = dcNodes[idx].name + ' → 北京 ' + dcNodes[idx].dist + 'km';
            }, null, 2 + idx * 0.6);
        });
        tl.to(aoCounter, { opacity: 1, duration: 0.5 }, 2);
        tl.to(aoCounter, { opacity: 0, duration: 0.5 }, 2 + dcNodes.length * 0.6 + 0.5);
    }

    /* Phase 3: KPI */
    var kObj = { a: 0, b: 0, c: 0, d: 0 };
    tl.to(aoKpiRow, { opacity: 1, duration: 0.8, onComplete: _animKpiBars }, 3.5);
    tl.to(kObj, {
        a: 1.15, b: 320, c: 4.3, d: 0.26, duration: 2.5, ease: 'power1.out',
        onUpdate: function() {
            if (el1) el1.textContent = kObj.a.toFixed(2);
            if (el2) el2.textContent = Math.round(kObj.b);
            if (el3) el3.textContent = kObj.c.toFixed(1);
            if (el4) el4.textContent = kObj.d.toFixed(2);
        }
    }, 3.8);

    /* Phase 4: 地球左移 + 图表在右 */
    tl.call(function() {
        if (!cmActive || cmCurrentAct !== 4) return;
        document.getElementById('globeViz').classList.add('shift-left');
        document.getElementById('aoHud').classList.add('hud-left');
        var _sb = document.getElementById('cmSideBg'); if (_sb) _sb.classList.add('active');
    }, null, 5);
    tl.call(function() {
        if (!cmActive || cmCurrentAct !== 4) return;
        _startDataLink('100,160,255', 12);
        _globePulse('#5090ff', 0.3);
    }, null, 5.8);

    /* Phase 5: PUE + 距离 + 电价横向对比条形图 */
    var cw = document.getElementById('aoChartWrap');
    cw.style.display = 'block';
    cw.classList.add('side', 'large');
    cw.style.width = 'clamp(320px,38vw,600px)';
    cw.style.position = 'absolute'; cw.style.left = 'auto'; cw.style.right = '0'; cw.style.top = '50%'; cw.style.transform = 'translateY(-50%)';
    _decorateChart('冷凉区位PUE对比');
    var chartEl = document.getElementById('aoChartEl');
    if (typeof echarts !== 'undefined') {
        _aoChart = echarts.init(chartEl, 'dark');
        var cities = ['上海', '贵阳', '中卫', '张家口', '乌兰察布'];
        var pueData = [1.58, 1.35, 1.30, 1.25, 1.15];
        var distData = [1200, 2200, 1800, 180, 320];
        var priceData = [0.65, 0.38, 0.32, 0.42, 0.26];
        /* 乌兰察布高亮色，其他渐淡 */
        var HL = 'rgba(128,212,255,.92)';
        var DIM = 'rgba(128,212,255,.18)';
        var MID = 'rgba(128,212,255,.35)';
        function barColor(i) { return i === 4 ? HL : (i >= 3 ? MID : DIM); }
        _aoChart.setOption({
            backgroundColor: 'transparent',
            grid: [
                { left: 80, right: 55, top: 32, height: '24%' },
                { left: 80, right: 55, top: '40%', height: '24%' },
                { left: 80, right: 55, bottom: 20, height: '24%' }
            ],
            title: [
                { text: '⬢ PUE(越低越优)', left: 80, top: 10, textStyle: { color: 'rgba(128,212,255,.6)', fontSize: 10, fontWeight: 600, fontFamily: 'Noto Sans SC' } },
                { text: '⬢ 距北京(km)', left: 80, top: '38%', textStyle: { color: 'rgba(128,212,255,.6)', fontSize: 10, fontWeight: 600, fontFamily: 'Noto Sans SC' } },
                { text: '⬢ 电价(元/kWh)', left: 80, bottom: '27%', textStyle: { color: 'rgba(128,212,255,.6)', fontSize: 10, fontWeight: 600, fontFamily: 'Noto Sans SC' } }
            ],
            xAxis: [
                { gridIndex: 0, show: false, max: 2 },
                { gridIndex: 1, show: false, max: 2600 },
                { gridIndex: 2, show: false, max: 0.8 }
            ],
            yAxis: [
                { gridIndex: 0, type: 'category', data: cities, inverse: false,
                  axisLine: { show: false }, axisTick: { show: false },
                                    axisLabel: { color: function(v, i) { return i === 4 ? '#80d4ff' : 'rgba(255,255,255,.4)'; }, fontSize: 10, fontWeight: function(v, i) { return i === 4 ? 700 : 400; } } },
                { gridIndex: 1, type: 'category', data: cities, inverse: false,
                  axisLine: { show: false }, axisTick: { show: false },
                  axisLabel: { show: false } },
                { gridIndex: 2, type: 'category', data: cities, inverse: false,
                  axisLine: { show: false }, axisTick: { show: false },
                  axisLabel: { show: false } }
            ],
            series: [
                {
                    name: 'PUE', type: 'bar', xAxisIndex: 0, yAxisIndex: 0, barWidth: 14,
                    data: pueData.map(function(v, i) {
                        return { value: v, itemStyle: { color: barColor(i), borderRadius: [0, 3, 3, 0] } };
                    }),
                    label: { show: true, position: 'right', color: function(p) { return p.dataIndex === 4 ? '#80d4ff' : 'rgba(255,255,255,.35)'; },
                        fontSize: 10, fontFamily: 'Orbitron', fontWeight: function(p) { return p.dataIndex === 4 ? 700 : 400; },
                        formatter: function(p) { return p.value + (p.dataIndex === 4 ? ' ★' : ''); } },
                    emphasis: { itemStyle: { shadowBlur: 16, shadowColor: 'rgba(128,212,255,.4)' } },
                    animationDuration: 1200, animationDelay: function(i) { return i * 120; }
                },
                {
                    name: '距北京(km)', type: 'bar', xAxisIndex: 1, yAxisIndex: 1, barWidth: 14,
                    data: distData.map(function(v, i) {
                        return { value: v, itemStyle: { color: barColor(i), borderRadius: [0, 3, 3, 0] } };
                    }),
                    label: { show: true, position: 'right', color: function(p) { return p.dataIndex === 4 ? '#80d4ff' : 'rgba(255,255,255,.35)'; },
                        fontSize: 10, fontFamily: 'Orbitron', fontWeight: function(p) { return p.dataIndex === 4 ? 700 : 400; },
                        formatter: function(p) { return p.value + 'km' + (p.dataIndex === 4 ? ' ★' : ''); } },
                    emphasis: { itemStyle: { shadowBlur: 16, shadowColor: 'rgba(128,212,255,.4)' } },
                    animationDuration: 1400, animationDelay: function(i) { return i * 120; }
                },
                {
                    name: '电价(元)', type: 'bar', xAxisIndex: 2, yAxisIndex: 2, barWidth: 14,
                    data: priceData.map(function(v, i) {
                        return { value: v, itemStyle: { color: barColor(i), borderRadius: [0, 3, 3, 0] } };
                    }),
                    label: { show: true, position: 'right', color: function(p) { return p.dataIndex === 4 ? '#80d4ff' : 'rgba(255,255,255,.35)'; },
                        fontSize: 10, fontFamily: 'Orbitron', fontWeight: function(p) { return p.dataIndex === 4 ? 700 : 400; },
                        formatter: function(p) { return p.value + '元' + (p.dataIndex === 4 ? ' ★' : ''); } },
                    emphasis: { itemStyle: { shadowBlur: 16, shadowColor: 'rgba(128,212,255,.4)' } },
                    animationDuration: 1600, animationDelay: function(i) { return i * 120; }
                }
            ],
            tooltip: {
                backgroundColor: 'rgba(8,12,18,.94)', borderColor: 'rgba(128,212,255,.15)',
                textStyle: { color: '#e0ffe8', fontSize: 11 }, trigger: 'item',
                appendToBody: true,
                formatter: function(p) {
                    var city = cities[p.dataIndex] || '';
                    var best = p.dataIndex === 4 ? ' <span style="color:#80d4ff">★ 全国最优</span>' : '';
                    return '<b style="font-size:13px">' + city + '</b><br>' + p.seriesName + '：<b>' + p.value + '</b>' + best;
                }
            }
        });
        /* 点击城市对比 */
        _aoChart.on('click', function(p) {
            var city = cities[p.dataIndex] || '';
            if (p.dataIndex === 4) {
                aoInsight.textContent = '乌兰察布：PUE=1.15（全国最低）+ 320km近京 + 0.26元电价 —— 三项全能冠军，冷凉区位不可替代。';
            } else {
                var pDiff = (pueData[p.dataIndex] - pueData[4]).toFixed(2);
                var prDiff = (priceData[p.dataIndex] - priceData[4]).toFixed(2);
                aoInsight.textContent = city + '：PUE高出' + pDiff + '，电价贵' + prDiff + '元/kWh——综合成本差距使其难以与乌兰察布竞争。';
            }
            if (typeof gsap !== 'undefined') gsap.fromTo(aoInsight, { opacity: 0.3 }, { opacity: 1, duration: 0.5 });
        });
    }
    tl.to(cw, { opacity: 1, duration: 0.8, onStart: function() { cw.classList.add('show', 'glow'); } }, 6.5);

    aoInsight.textContent = '乌兰察布：年均气温4.3℃，自然冷却让PUE低至1.15（全国最优）；距北京仅320km，网络延迟<5ms；工业电价0.26元/kWh，不到上海的一半——冷凉、近京、廉电，三大天然王牌。';
    tl.to(aoInsight, { opacity: 1, duration: 1, ease: 'power2.out' }, 8.5);
}

/* ═══════════════════════════════════════════
   §9b  ACT VI — 重塑人才引力场 (PULL·IV)
   Globe城市转型点 + 人才散点图（薪资×增速）
   ═══════════════════════════════════════════ */
function actSix(hasGsap, hasWorld) {
    _actOneCleanup();

    var gv = document.getElementById('globeViz');
    gv.classList.remove('cm-blur', 'shift-left', 'shift-right', 'shift-up');
    gv.classList.add('cm-focus');
    gv.style.opacity = '1';

    /* 隐藏Canvas如果之前ACT V打开了 */
    document.getElementById('cmCanvas').style.display = 'none';

    /* Globe叙事：紫蓝大气 + 全国高校→内蒙古人才输送弧线 + 校徽 */
    if (hasWorld) {
        world.controls().minDistance = 1;
        world.globeImageUrl(''); _applyDarkGlobeMaterial();
        world.atmosphereColor('rgba(96,138,162,0.11)');
        world.atmosphereAltitude(0.2);
        world.arcsData([]).pointsData([]).htmlElementsData([]).ringsData([]);
        if (typeof loadedPaths !== 'undefined' && loadedPaths) world.pathsData(loadedPaths);

        var uniArcs = mkUniArcs();
        var uPts  = [{ lat: IM[1], lng: IM[0], size: 0.5, color: '#B48CF0', alt: 0.02, name: '内蒙古', cat: 'origin' }];
        var uLbls = [];
        var uRings = [{ lat: IM[1], lng: IM[0], maxR: 4, propagationSpeed: 1, repeatPeriod: 900 }];

        uniData.forEach(function(u) {
            uPts.push({ lat: u.lat, lng: u.lng, size: 0.3, color: u.color || '#B48CF0', alt: 0.01, name: u.name, cat: 'uni' });
            uLbls.push({
                lat: u.lat, lng: u.lng,
                name: u.name, abbr: u.abbr,
                color: '#d0b0ff', big: false, alt: 0.035, cat: 'uni',
                badgeColor: u.color || '#8B008B',
                logo: u.logo || '',
                graduates: u.graduates, majors: u.majors
            });
        });

        world.pointsData(uPts).htmlElementsData(uLbls).ringsData(uRings);
        world.controls().autoRotate = false;
        /* ACT VI: 从中国西南方向全景俯瞰 — 人才从各地涌入 */
        var _curP = world.pointOfView();
        var pov = { lat: _curP.lat, lng: _curP.lng, altitude: _curP.altitude };
        if (hasGsap) {
            _camTween = gsap.timeline();
            world.controls().enabled = false;
            _camTween.to(pov, {
                lat: 35, lng: 112, altitude: 1.1,
                duration: 3, ease: 'power1.inOut',
                onUpdate: function() { world.pointOfView(pov, 0); }
            });
            _camTween.to(pov, {
                lat: 38, lng: 115, altitude: 0.85, duration: 16, ease: 'sine.inOut',
                onUpdate: function() { world.pointOfView(pov, 0); }
            });
        } else {
            world.pointOfView({ lat: 35, lng: 112, altitude: 1.1 }, 1500);
        }
    }

    _showOverlay('PULL · IV', '重塑人才引力场', {
        theme: 'purple',
        coordLT: '35.00°N &nbsp; 112.00°E',
        statusTL: '>_ <span class="hl">SCAN</span> TALENT_FIELD\n   UNIV: ' + (typeof uniData !== 'undefined' ? uniData.length : 12) + '\n   WEIGHT: STEM+EDU',
        statusBR: 'GRAVITY: <span class="hl">↑SHIFT</span>\nSYNC: CAMPUS→NMG'
    });

    /* 找新能源+科技行业数据 */
    var newEnJob = 0, avgSalary = 0, cnt = 0;
    if (typeof nmgTalentData !== 'undefined' && nmgTalentData[2024]) {
        nmgTalentData[2024].forEach(function(d) {
            if (d.category === 'energy' || d.category === 'tech') {
                newEnJob += d.capacity;
                avgSalary += d.salary * d.capacity;
                cnt += d.capacity;
            }
        });
        if (cnt > 0) avgSalary = +(avgSalary / cnt).toFixed(1);
    }
    var popRate = typeof nmgPopulation !== 'undefined' ? nmgPopulation[2024].natural : -0.90;

    _buildKpiRow([
        { id: 'ao6V1', val: '0', lbl: '能源+科技就业', unit: '万人', cls: 'ao-kpi-blue', bar: 0.55 },
        { id: 'ao6V2', val: '0', lbl: '平均年薪', unit: '万元', cls: 'ao-kpi-gold', bar: 0.7 },
        { id: 'ao6V3', val: '0', lbl: '人口自然增长率', unit: '‰', cls: 'ao-kpi-red', bar: 0.15 }
    ]);

    var aoTitle = document.getElementById('aoTitle');
    var aoCounter = document.getElementById('aoCounter');
    var aoKpiRow = document.getElementById('aoKpiRow');
    var aoInsight = document.getElementById('aoInsight');
    var el1 = document.getElementById('ao6V1');
    var el2 = document.getElementById('ao6V2');
    var el3 = document.getElementById('ao6V3');

    if (!hasGsap) return;

    var tl = gsap.timeline();
    _actOneTL = tl;

    /* Phase 1: 标题 */
    tl.to(aoTitle, { opacity: 1, duration: 1.2, ease: 'power2.out' }, 0);
    tl.to(aoTitle, { opacity: 0, y: -40, duration: 0.8, ease: 'power2.in' }, 2.5);

    /* Phase 1.5: 高校弧线逐条射出 */
    if (hasWorld && typeof uniArcs !== 'undefined' && uniArcs) {
        var curUniArcs = [];
        uniData.forEach(function(u, idx) {
            tl.call(function() {
                if (!cmActive || cmCurrentAct !== 5) return;
                curUniArcs.push(uniArcs[idx]);
                world.arcsData(curUniArcs.slice());
                aoCounter.textContent = '🎓 ' + u.name + ' → 内蒙古 (' + (idx + 1) + '/' + uniData.length + ')';
            }, null, 2 + idx * 0.3);
        });
        tl.to(aoCounter, { opacity: 1, duration: 0.5 }, 2);
        tl.to(aoCounter, { opacity: 0, duration: 0.5 }, 2 + uniData.length * 0.3 + 0.5);
    }

    /* Phase 2: KPI */
    var kObj = { a: 0, b: 0, c: 0 };
    tl.to(aoKpiRow, { opacity: 1, duration: 0.8, onComplete: _animKpiBars }, 3.5);
    tl.to(kObj, {
        a: newEnJob, b: avgSalary, c: popRate, duration: 2, ease: 'power1.out',
        onUpdate: function() {
            if (el1) el1.textContent = kObj.a.toFixed(1);
            if (el2) el2.textContent = kObj.b.toFixed(1);
            if (el3) el3.textContent = kObj.c.toFixed(2);
        }
    }, 3.8);

    /* Phase 3: 地球右移 + 数据链路（紫色·镜像布局） */
    tl.call(function() {
        if (!cmActive || cmCurrentAct !== 5) return;
        document.getElementById('globeViz').classList.add('shift-right');
        document.getElementById('aoHud').classList.add('hud-right');
    }, null, 5);
    tl.call(function() {
        if (!cmActive || cmCurrentAct !== 5) return;
        _startDataLink('180,140,240', 12);
        _globePulse('#00d4aa', 0.3);
    }, null, 5.8);

    /* Phase 4: 高校毕业生留区就业分析（数据来源：自治区教育厅2023届年度报告） */
    var cw = document.getElementById('aoChartWrap');
    cw.style.display = 'block';
    cw.classList.add('side', 'left', 'large');
    cw.style.position = 'absolute'; cw.style.left = '0'; cw.style.right = 'auto'; cw.style.top = '50%'; cw.style.transform = 'translateY(-50%)';
    _decorateChart('高校毕业生留区就业');
    var chartEl = document.getElementById('aoChartEl');
    if (typeof echarts !== 'undefined' && typeof nmgEduReport !== 'undefined') {
        _aoChart = echarts.init(chartEl, 'dark');
        var rpt = nmgEduReport;
        var indData = rpt.byIndustry.filter(function(d){ return d.name !== '其他'; });

        /* ── 三色定义 ── */
        var cTeal   = { a:'rgba(0,210,168,',  hex:'#00d2a8' };
        var cBlue   = { a:'rgba(0,180,220,',   hex:'#00b4dc' };
        var cPurple = { a:'rgba(150,120,240,', hex:'#9678f0' };

        /* ── Activity-Rings：缩小尺寸、环间留缝 ── */
        var ringDefs = [
            { rate: 82.95, label: '专科',  c: cTeal,   outer: '52%', inner: '44%' },
            { rate: 73.94, label: '本科',  c: cBlue,   outer: '40%', inner: '32%' },
            { rate: 64.31, label: '研究生', c: cPurple, outer: '28%', inner: '20%' }
        ];
        var ringSeries = [];
        var cx = '50%', cy = '36%';

        ringDefs.forEach(function(r, idx) {
            /* 暗轨 */
            ringSeries.push({
                type: 'pie', radius: [r.inner, r.outer], center: [cx, cy],
                startAngle: 225, silent: true, animation: false,
                label: { show: false }, emphasis: { disabled: true },
                data: [{ value: 1, itemStyle: { color: r.c.a + '.06)' } }], z: 1
            });
            /* 亮弧 */
            ringSeries.push({
                type: 'pie', radius: [r.inner, r.outer], center: [cx, cy],
                startAngle: 225, silent: false,
                label: { show: false },
                emphasis: { scale: false, itemStyle: { shadowBlur: 16, shadowColor: r.c.a + '.35)' } },
                itemStyle: { borderRadius: 6 },
                data: [
                    { value: r.rate, name: r.label,
                      itemStyle: {
                          color: new echarts.graphic.LinearGradient(0, 0, 1, 1, [
                              { offset: 0, color: r.c.a + '.9)' },
                              { offset: 1, color: r.c.a + '.5)' }
                          ]),
                          shadowBlur: 10, shadowColor: r.c.a + '.2)'
                      }},
                    { value: 100 - r.rate,
                      itemStyle: { color: 'transparent' },
                      emphasis: { disabled: true } }
                ],
                animationDuration: 1600, animationDelay: idx * 220,
                animationEasing: 'cubicOut', z: 2
            });
        });

        /* ── 中心文字（用单个 rich-text 避免重叠） ── */
        ringSeries.push({
            type: 'pie', radius: [0, 0], center: [cx, cy],
            silent: true, animation: false,
            label: {
                show: true, position: 'center',
                formatter: '{big|77.4}{unit|%}\n{sub|留区就业率}',
                rich: {
                    big: { fontSize: 28, fontWeight: 700,
                        fontFamily: '"OPPO Sans","Inter",sans-serif',
                        color: 'rgba(230,245,255,.9)',
                        textShadowBlur: 14, textShadowColor: 'rgba(0,210,168,.2)' },
                    unit: { fontSize: 12,
                        fontFamily: '"OPPO Sans",sans-serif',
                        color: 'rgba(180,160,220,.4)', verticalAlign: 'bottom', padding: [0,0,2,1] },
                    sub: { fontSize: 9,
                        fontFamily: '"Noto Sans SC",sans-serif',
                        color: 'rgba(180,160,220,.28)', padding: [4,0,0,0] }
                }
            },
            data: [{ value: 0 }], z: 3
        });

        /* ── 图例横排在环下方 ── */
        var legendGraphic = [];
        var legY = '68%';
        var legSpacing = 30;   /* 百分比间距 */
        ringDefs.forEach(function(r, i) {
            var lx = 20 + i * legSpacing;
            legendGraphic.push(
                { type: 'circle', left: lx + '%', top: legY,
                  shape: { r: 4 }, style: { fill: r.c.hex }, z: 10 },
                { type: 'text', left: (lx + 3) + '%', top: legY,
                  style: {
                      text: r.label + '  ' + r.rate.toFixed(1) + '%',
                      font: '500 12px "OPPO Sans","Noto Sans SC",sans-serif',
                      fill: r.c.hex
                  }, z: 10 }
            );
        });

        _aoChart.setOption({
            backgroundColor: 'transparent',
            series: ringSeries,
            graphic: [
                { type: 'text', left: 'center', top: 4, style: {
                    text: '2023 届  ·  全区 16.1 万毕业生  ·  12.5 万人留区',
                    font: '400 9px "Noto Sans SC",sans-serif',
                    fill: 'rgba(180,160,220,.22)', textAlign: 'center'
                }}
            ].concat(legendGraphic),
            tooltip: {
                show: true,
                appendToBody: true,
                backgroundColor: 'rgba(12,18,35,.94)',
                borderColor: 'rgba(180,140,240,.12)',
                textStyle: { color: '#eafaff', fontSize: 11 },
                formatter: function(p) {
                    if (p.seriesType === 'pie' && p.data.value > 50) {
                        return '<b>' + p.name + '</b> 留区率: <b style="color:' + p.color + '">' + p.data.value.toFixed(2) + '%</b>';
                    }
                    return '';
                }
            }
        });

        /* ═══ HTML: 高校卡片 + 行业流向 ═══ */
        var schoolCards = [
            { name: '内蒙古师范大学', rate: 76.32, total: 9272, keep: 7076, color: '#2e8b57', logo: 'img/内蒙古师范大学.png' },
            { name: '内蒙古大学',     rate: 66.38, total: 6333, keep: 4204, color: '#1e90ff', logo: 'img/内蒙古大学.png' }
        ];
        var cardsHtml = '<div style="display:flex;gap:10px;padding:0 12px;margin-bottom:8px;">';
        schoolCards.forEach(function(s) {
            var pct = s.rate.toFixed(1);
            cardsHtml +=
                '<div style="flex:1;display:flex;align-items:center;gap:10px;' +
                    'background:rgba(255,255,255,.025);border:1px solid rgba(255,255,255,.06);border-radius:10px;padding:10px 14px;">' +
                    '<img src="' + s.logo + '" style="width:30px;height:30px;border-radius:50%;object-fit:contain;' +
                        'background:rgba(0,0,0,.25);border:1px solid rgba(255,255,255,.08);" onerror="this.style.display=\'none\'">' +
                    '<div style="flex:1;min-width:0;">' +
                        '<div style="font-size:11px;font-weight:500;color:rgba(230,245,255,.7);font-family:\'Noto Sans SC\',sans-serif;' +
                            'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + s.name + '</div>' +
                        '<div style="font-size:8px;color:rgba(180,160,220,.28);font-family:\'Noto Sans SC\',sans-serif;margin-top:2px;">' +
                            s.total + '人毕业 · ' + s.keep + '人留蒙</div>' +
                    '</div>' +
                    '<div style="text-align:right;white-space:nowrap;">' +
                        '<span style="font-size:22px;font-weight:700;font-family:\'OPPO Sans\',\'Inter\',sans-serif;color:' + s.color + ';">' + pct + '</span>' +
                        '<span style="font-size:10px;color:rgba(180,160,220,.3);font-family:\'OPPO Sans\',sans-serif;">%</span>' +
                    '</div>' +
                '</div>';
        });
        cardsHtml += '</div>';

        /* 行业流向标签 */
        cardsHtml += '<div style="display:flex;flex-wrap:wrap;gap:4px 6px;padding:0 12px;">';
        indData.forEach(function(d, i) {
            var op = Math.max(0.28, 0.62 - i * 0.06).toFixed(2);
            cardsHtml += '<span style="background:rgba(180,140,240,' + (op * 0.07).toFixed(3) + ');' +
                'border:1px solid rgba(180,140,240,' + (op * 0.16).toFixed(3) + ');' +
                'border-radius:10px;padding:2px 8px;font-size:9px;color:rgba(208,176,255,' + op + ');' +
                'font-family:\'Noto Sans SC\',sans-serif;white-space:nowrap;">' +
                d.name + ' ' + d.pct + '%</span>';
        });
        cardsHtml += '</div>';

        var cardsDiv = document.createElement('div');
        cardsDiv.innerHTML = cardsHtml;
        cardsDiv.style.cssText = 'position:absolute;bottom:4px;left:0;right:0;pointer-events:none;';
        chartEl.parentNode.appendChild(cardsDiv);
        var origDispose = _aoChart.dispose.bind(_aoChart);
        _aoChart.dispose = function() { if (cardsDiv.parentNode) cardsDiv.parentNode.removeChild(cardsDiv); origDispose(); };
    }
    tl.to(cw, { opacity: 1, duration: 0.8, onStart: function() { cw.classList.add('show', 'glow'); } }, 6.5);

    aoInsight.textContent = '2023届全区16.1万高校毕业生中77.43%留区就业，内蒙古大学留蒙率66.38%（4204人），内蒙古师范大学76.32%（7076人）——本土高校是留住人才的核心引擎。（数据来源：自治区教育厅年度报告）';
    tl.to(aoInsight, { opacity: 1, duration: 1, ease: 'power2.out' }, 8.5);
}

/* ═══════════════════════════════════════════
   §9c  FINAL — 答案
   汇总打字机 + Globe绿电弧线旋转收尾
   ═══════════════════════════════════════════ */
function actFinal(hasGsap, hasWorld) {
    _actOneCleanup();

    /* 隐藏Canvas + 图表面板 */
    document.getElementById('cmCanvas').style.display = 'none';
    document.getElementById('cmGlassPanel').classList.remove('show');

    var gv = document.getElementById('globeViz');
    gv.classList.remove('cm-blur');
    gv.classList.remove('shift-left');
    gv.classList.remove('shift-right');
    gv.classList.remove('shift-up');
    var _sb = document.getElementById('cmSideBg'); if (_sb) _sb.classList.remove('active');
    gv.classList.add('cm-focus');

    if (hasWorld) {
        world.globeImageUrl(''); _applyDarkGlobeMaterial();
        world.atmosphereColor('rgba(96,138,162,0.11)');
        world.atmosphereAltitude(0.25);
        world.arcsData([]).pointsData([]).htmlElementsData([]).ringsData([]);
        if (typeof loadedPaths !== 'undefined' && loadedPaths) world.pathsData(loadedPaths);
        if (typeof mkGreenArcs === 'function') world.arcsData(mkGreenArcs());
        world.pointsData([{ lat: IM[1], lng: IM[0], size: 0.5, color: '#00d4aa', alt: 0.02, name: '内蒙古', cat: 'origin' }]);
        world.htmlElementsData([]);
        world.ringsData([{ lat: IM[1], lng: IM[0], maxR: 5, propagationSpeed: 1, repeatPeriod: 800 }]);
        world.controls().autoRotate = false;
        /* 平滑过渡镜头 — GSAP统一运镜 */
        var _curP = world.pointOfView();
        var pov = { lat: _curP.lat, lng: _curP.lng, altitude: _curP.altitude };
        if (hasGsap) {
            _camTween = gsap.timeline();
            world.controls().enabled = false;
            _camTween.to(pov, {
                lat: 25, lng: 90, altitude: 2.2,
                duration: 3, ease: 'power1.inOut',
                onUpdate: function() { world.pointOfView(pov, 0); }
            });
            _camTween.to(pov, {
                lat: 30, lng: 160, altitude: 2.0, duration: 35, ease: 'sine.inOut',
                onUpdate: function() { world.pointOfView(pov, 0); }
            });
        } else {
            world.pointOfView({ lat: 25, lng: 90, altitude: 2.2 }, 1800);
        }
    }

    _showOverlay('FINAL', '答案', {
        theme: 'green',
        statusTL: '>_ <span class="hl">COMPILE</span> ALL_ACTS\n   STATUS: COMPLETE'
    });

    /* 上下渐变遮罩 */
    var ov = document.getElementById('cmActOv');
    var existMask = ov.querySelector('.ao-final-mask');
    if (!existMask) {
        existMask = document.createElement('div');
        existMask.className = 'ao-final-mask';
        ov.appendChild(existMask);
    }

    /* 打字机滚动容器 */
    var tw = document.getElementById('aoTypewriter');
    tw.style.display = 'block';
    tw.innerHTML = '<div class="ao-typewriter-inner" id="aoTwInner"></div>';
    var twInner = document.getElementById('aoTwInner');

    var aoTitle = document.getElementById('aoTitle');

    if (!hasGsap) return;

    var tl = gsap.timeline();
    _actOneTL = tl;

    tl.to(aoTitle, { opacity: 1, duration: 1.5, ease: 'power2.out' }, 0);
    tl.to(aoTitle, { opacity: 0, y: -40, duration: 0.8, ease: 'power2.in' }, 3);
    tl.to(tw, { opacity: 1, duration: 0.6 }, 4);
    tl.call(function() {
        _scrollTypeWriter(FINAL_TEXT, twInner, tw, 0);
    }, [], 4.2);
}

/* ═══════════════════════════════════════════
   §10  事件绑定
   ═══════════════════════════════════════════ */
/* 进度点点击 */
document.querySelectorAll('.cm-prog-dot').forEach(function(dot) {
    dot.addEventListener('click', function() {
        if (!cmActive) return;
        var act = parseInt(this.getAttribute('data-act'));
        if (act !== cmCurrentAct) playAct(act);
    });
});

/* 下一幕 */
document.getElementById('cmNext').addEventListener('click', function() {
    if (!cmActive) return;
    if (cmCurrentAct < ACTS.length - 1) {
        playAct(cmCurrentAct + 1);
    } else {
        exitCinematicMode();
    }
});

/* 退出 */
document.getElementById('cmExit').addEventListener('click', function() {
    if (cmActive) exitCinematicMode();
});

/* FINAL结束按钮 — 自由探索 */
document.getElementById('aoEndExplore').addEventListener('click', function() {
    if (cmActive) exitCinematicMode();
});
/* FINAL结束按钮 — 更多问题解答：返回问题画廊 */
document.getElementById('aoEndMore').addEventListener('click', function() {
    if (cmActive) {
        exitCinematicMode();
        /* 延迟返回画廊，等exitCinematicMode动画完成 */
        setTimeout(function() { _returnToGallery(); }, 700);
    }
});

/** 返回问题画廊 */
function _returnToGallery() {
    appStarted = false;
    document.querySelector('.hud').style.display = 'none';
    document.querySelector('.right-panel').style.display = 'none';
    document.querySelector('.timeline').style.display = 'none';
    document.getElementById('viewSwitch').style.display = 'none';
    document.getElementById('globeViz').style.opacity = '0';
    document.getElementById('homeBtn').style.display = 'none';
    document.getElementById('page3Right').style.display = 'none';

    /* 清理所有可视化页面 */
    var indViz = document.getElementById('industryViz');
    var lhViz = document.getElementById('livelihoodViz');
    var tlViz = document.getElementById('talentViz');
    if (indViz) { indViz.classList.remove('active'); indViz.style.display = 'none'; }
    if (lhViz) { lhViz.classList.remove('active'); lhViz.style.display = 'none'; }
    if (tlViz) { tlViz.classList.remove('active'); tlViz.style.display = 'none'; }
    if (typeof stopIndustryAnim === 'function') stopIndustryAnim();
    if (typeof stopLivelihoodAnim === 'function') stopLivelihoodAnim();
    if (typeof disposeTalentChart === 'function') disposeTalentChart();
    if (typeof currentPage !== 'undefined') currentPage = 1;

    var lp = document.getElementById('landingPage');
    lp.style.display = '';
    lp.classList.remove('landing-exit');
    lp.style.opacity = '0';
    /* 重置CSS动画 — 先清除再强制reflow */
    var animItems = lp.querySelectorAll('.land-typo-bg,.land-questions,.land-logo,.land-idx,.land-bottom-line,.land-bottom-hint,.land-vert-divide,.land-mongol-deco,.land-right-info,.land-sky-glow,.land-grass-glow,.land-corner,.land-khamr,.land-hee-border');
    animItems.forEach(function(el) { el.style.animation = 'none'; });
    void lp.offsetHeight; /* force reflow */
    animItems.forEach(function(el) { el.style.animation = ''; });
    setTimeout(function() {
        lp.style.transition = 'opacity .6s ease';
        lp.style.opacity = '1';
        if (typeof startSphereAnim === 'function') startSphereAnim();
    }, 50);
}

/* ═══════════════════════════════════════════
   §11  兼容旧 guided.js 接口
   保证 main.js 中已有的引用不报错
   ═══════════════════════════════════════════ */
var guidedActive = false;
function enterGuidedMode() { enterCinematicMode(); }
function exitGuidedMode() { exitCinematicMode(); }

/* Landing 问题卡片绑定 — 事件委托(兼容克隆无限滚动) */
if (document.getElementById('landingPage')) {
    var qScroll = document.querySelector('.land-q-scroll');
    if (qScroll) {
        qScroll.addEventListener('click', function(e) {
            var card = e.target.closest('.land-q');
            if (!card) return;
            if (card.classList.contains('land-q--pending')) return; /* pending由main.js处理 */
            if (card.classList.contains('q-card--active') || card.getAttribute('data-q') === '0') {
                enterCinematicMode();
            } else if (card.classList.contains('q-card--q2') || card.getAttribute('data-q') === '1') {
                if (typeof enterQ2Mode === 'function') enterQ2Mode();
            }
        });
    }
}

/* 旧导航条绑定（兼容） */
var gnNext = document.getElementById('gnNext');
var gnPrev = document.getElementById('gnPrev');
var gnExit = document.getElementById('gnExit');
if (gnNext) gnNext.addEventListener('click', function() {
    if (cmActive && cmCurrentAct < ACTS.length - 1) playAct(cmCurrentAct + 1);
    else if (cmActive) exitCinematicMode();
});
if (gnPrev) gnPrev.addEventListener('click', function() {
    if (cmActive && cmCurrentAct > 0) playAct(cmCurrentAct - 1);
});
if (gnExit) gnExit.addEventListener('click', function() {
    if (cmActive) exitCinematicMode();
});
document.querySelectorAll('.gn-dot').forEach(function(dot) {
    dot.addEventListener('click', function() {
        if (!cmActive) return;
        var ch = parseInt(this.getAttribute('data-ch'));
        if (ch < ACTS.length && ch !== cmCurrentAct) playAct(ch);
    });
});

/* Home 按钮回到问题画廊 */
document.getElementById('homeBtn').addEventListener('click', function() {
    /* Q2乳业模式 */
    if (typeof q2Active !== 'undefined' && q2Active) {
        if (typeof _q2ReturnToGallery === 'function') { _q2ReturnToGallery(); return; }
    }
    /* Q1电影模式 */
    if (cmActive) exitCinematicMode();
    setTimeout(function() { _returnToGallery(); }, cmActive ? 700 : 50);
});
