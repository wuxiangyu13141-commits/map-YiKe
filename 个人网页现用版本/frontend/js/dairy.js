/* ══════════════════════════════════════════
   dairy.js — Q2 白色帝国：内蒙古乳业五幕叙事
   完全独立模块，不污染 Q1 命名空间
   ══════════════════════════════════════════ */
'use strict';

/* ── Mock Data：内蒙古乳业核心数据 ── */
var DAIRY = {
    /* 序章 — 灵魂拷问 */
    hook: {
        profitPerBox: 0.27,          /* 元/盒，平均净利润 */
        pricePerBox: 3.5,            /* 元/盒，零售均价 */
        annualBoxes: 310,            /* 亿盒，年产量 */
        totalRevenue: 1890,          /* 亿元，头部两家合计营收 2024 */
    },

    /* 第一幕 — 极限规模法则 */
    scale: {
        /* 伊利+蒙牛 年度数据 2019-2024 */
        years: [2019, 2020, 2021, 2022, 2023, 2024],
        yiliRevenue:   [902, 969, 1106, 1232, 1262, 1302],  /* 亿元 */
        mengniuRevenue:[790, 760,  881,  926,  987, 1032],
        yiliProfit:    [70,  71,   87,   94,   104,  113],
        mengniuProfit: [41,  35,   50,   54,   59,   63],
        /* 单盒经济学 */
        boxEcon: {
            retail: 3.50,     /* 零售价 */
            rawMilk: 1.40,    /* 原奶成本 */
            packaging: 0.35,  /* 包材 */
            logistics: 0.55,  /* 冷链物流 */
            marketing: 0.45,  /* 营销 */
            tax: 0.15,        /* 税费 */
            profit: 0.27,     /* 净利 */
            other: 0.33       /* 其他 */
        },
        /* 消费频次 */
        popBillion: 14.1,         /* 亿人 */
        avgConsumption: 42.5,     /* 人均乳制品消费kg/年 */
        dailyBoxesMillion: 8493,  /* 万盒/天 */
    },

    /* 第二幕 — 重资产堡垒 */
    capex: {
        years: [2019, 2020, 2021, 2022, 2023, 2024],
        fixedAssets:  [480, 540, 650, 780, 890, 1020],  /* 亿元，两家合计固定资产 */
        smartFarms:   [15,  22,  38,  56,  78,  96],    /* 智慧牧场数量 */
        autoFactories:[8,   12,  18,  24,  30,  35],    /* 全自动工厂数量 */
        cowCount:     [120, 135, 158, 180, 205, 230],   /* 万头自有奶牛 */
        /* 单个超级工厂指标 */
        megaFactory: {
            dailyProcess: 3600,  /* 吨/天 */
            robots: 280,         /* 工业机器人 */
            workers: 30,         /* 仅需工人 */
            investBn: 30,        /* 亿元投资 */
            tempControl: '0.5℃' /* 温控精度 */
        }
    },

    /* 第三幕 — 白色大动脉 */
    coldChain: {
        routeKm: 3200,           /* 呼和浩特→广州 公里 */
        hoursToShelf: 48,        /* 从挤奶到上架 小时 */
        coldTrucks: 15000,       /* 冷链车辆数 */
        warehouses: 82,          /* 冷库数量 */
        coverCities: 380,        /* 覆盖城市数 */
        /* 关键线路 */
        routes: [
            { from: '呼和浩特', to: '北京',   km: 470,  h: 8,  latF: 40.8, lngF: 111.7, latT: 39.9, lngT: 116.4 },
            { from: '呼和浩特', to: '上海',   km: 1720, h: 24, latF: 40.8, lngF: 111.7, latT: 31.2, lngT: 121.5 },
            { from: '呼和浩特', to: '广州',   km: 3200, h: 36, latF: 40.8, lngF: 111.7, latT: 23.1, lngT: 113.3 },
            { from: '呼和浩特', to: '成都',   km: 1900, h: 28, latF: 40.8, lngF: 111.7, latT: 30.6, lngT: 104.1 },
            { from: '呼和浩特', to: '武汉',   km: 1400, h: 20, latF: 40.8, lngF: 111.7, latT: 30.6, lngT: 114.3 },
            { from: '呼和浩特', to: '西安',   km: 870,  h: 12, latF: 40.8, lngF: 111.7, latT: 34.3, lngT: 108.9 },
            { from: '呼和浩特', to: '哈尔滨', km: 1650, h: 22, latF: 40.8, lngF: 111.7, latT: 45.8, lngT: 126.5 },
            { from: '呼和浩特', to: '乌鲁木齐', km: 2400, h: 32, latF: 40.8, lngF: 111.7, latT: 43.8, lngT: 87.6 },
            { from: '呼和浩特', to: '昆明',   km: 2800, h: 34, latF: 40.8, lngF: 111.7, latT: 25.0, lngT: 102.7 },
            { from: '呼和浩特', to: '拉萨',   km: 3100, h: 40, latF: 40.8, lngF: 111.7, latT: 29.7, lngT: 91.1 },
        ]
    },

    /* 第四幕 — 万企吸附场 */
    cluster: {
        coreCompanies: ['伊利', '蒙牛'],
        totalClusterGDP: 3200,    /* 亿元，产业集群总产值 */
        enterprises: 4800,        /* 上下游企业数 */
        employees: 150,           /* 万就业人口 */
        /* 产业链节点 */
        nodes: [
            { name: '牧草种植',   val: 280,  type: 'upstream',   jobs: 18 },
            { name: '饲料加工',   val: 190,  type: 'upstream',   jobs: 8 },
            { name: '兽药疫苗',   val: 65,   type: 'upstream',   jobs: 3 },
            { name: '种牛繁育',   val: 120,  type: 'upstream',   jobs: 5 },
            { name: '奶牛养殖',   val: 520,  type: 'upstream',   jobs: 25 },
            { name: '原奶收购',   val: 340,  type: 'core',       jobs: 12 },
            { name: '乳品加工',   val: 1890, type: 'core',       jobs: 15 },
            { name: '包装印刷',   val: 210,  type: 'downstream', jobs: 10 },
            { name: '冷链物流',   val: 380,  type: 'downstream', jobs: 22 },
            { name: '仓储配送',   val: 160,  type: 'downstream', jobs: 12 },
            { name: '零售终端',   val: 450,  type: 'downstream', jobs: 30 },
            { name: '品牌营销',   val: 180,  type: 'downstream', jobs: 8 },
            { name: '质检认证',   val: 45,   type: 'support',    jobs: 2 },
            { name: '设备制造',   val: 95,   type: 'support',    jobs: 4 },
            { name: '金融保险',   val: 78,   type: 'support',    jobs: 3 },
        ],
        /* 乘数效应 */
        multiplier: 2.7  /* 核心产业每1元产值带动上下游2.7元 */
    },

    /* 终章文案 */
    finalText:
        '一盒奶只赚 0.27 元，\n' +
        '但 14 亿人每天喝掉 8500 万盒。\n\n' +
        '这不是一门精巧的生意，\n' +
        '这是一场关于规模、速度和重力的战争。\n\n' +
        '千亿投入砸出全自动工厂，\n' +
        '3000 公里冷链昼夜不停，\n' +
        '4800 家企业被吸入同一个引力场——\n\n' +
        '内蒙古用最笨重的方式，\n' +
        '砸出了一个无人能复制的白色帝国。'
};

/* ── Q2 五幕配置 ── */
var Q2_ACTS = [
    { label: '序章',        title: '灵魂拷问',
      insight: '一盒奶利润不到三毛钱——但正是这"最笨"的生意，撑起千亿帝国' },
    { label: '第一幕',      title: '极限规模法则',
      insight: '14亿人×每天8500万盒——数量的暴力美学碾压一切精巧的商业模式' },
    { label: '第二幕',      title: '重资产堡垒',
      insight: '千亿固定资产投入，280个机器人守一座工厂——养牛是一门重工业' },
    { label: '第三幕',      title: '白色大动脉',
      insight: '跨越3000公里，48小时从牧场到货架——生死时速的冷链帝国' },
    { label: '第四幕',      title: '万企吸附场',
      insight: '核心乳企如引力源，4800家上下游企业被吸附——乘数效应2.7倍' },
    { label: '终章',        title: '白色帝国',
      insight: '最笨重的生意，最不可复制的护城河' }
];

/* ── Q2 状态变量 ── */
var q2Active = false;
var q2CurrentAct = 0;
var _q2TL = null;          /* GSAP timeline */
var _q2Timers = [];         /* setTimeout refs */
var _q2Chart = null;        /* ECharts实例 */
var _q2AnimId = null;       /* Canvas动画帧 */
var _q2Canvas = null;
var _q2Ctx = null;

/* ══════════════════════════════════════════
   Q2 通用工具
   ══════════════════════════════════════════ */
function _q2Cleanup() {
    if (_q2TL) { _q2TL.kill(); _q2TL = null; }
    _q2Timers.forEach(function(t) { clearTimeout(t); });
    _q2Timers = [];
    if (_q2AnimId) { cancelAnimationFrame(_q2AnimId); _q2AnimId = null; }
    if (_q2Chart) { _q2Chart.dispose(); _q2Chart = null; }
    var c = document.getElementById('q2Canvas');
    if (c) { c.style.display = 'none'; }
    var ov = document.getElementById('q2Overlay');
    if (ov) ov.style.display = 'none';
    /* 隐藏产品大图 */
    var imgY = document.getElementById('q2ImgYili');
    var imgM = document.getElementById('q2ImgMengniu');
    if (imgY) { gsap && gsap.killTweensOf(imgY); imgY.style.display = 'none'; imgY.style.opacity = '0'; }
    if (imgM) { gsap && gsap.killTweensOf(imgM); imgM.style.display = 'none'; imgM.style.opacity = '0'; }
}

function _q2ShowOv(label, heading) {
    var ov = document.getElementById('q2Overlay');
    ov.style.display = 'flex';
    document.getElementById('q2Label').textContent = label;
    document.getElementById('q2Heading').textContent = heading;
    var t = document.getElementById('q2Title');
    t.style.opacity = 0; t.style.transform = '';
    gsap && gsap.set(t, { clearProps: 'x,y' });
    document.getElementById('q2Counter').textContent = '';
    document.getElementById('q2Counter').style.opacity = 0;
    document.getElementById('q2KpiRow').innerHTML = '';
    document.getElementById('q2KpiRow').style.opacity = 0;
    var ins = document.getElementById('q2Insight');
    ins.textContent = ''; ins.style.opacity = 0;
    var tw = document.getElementById('q2Typewriter');
    tw.style.display = 'none'; tw.innerHTML = ''; tw.style.opacity = 0;
    var endBtns = document.getElementById('q2EndBtns');
    if (endBtns) { endBtns.style.display = 'none'; endBtns.classList.remove('show'); }
    var cw = document.getElementById('q2ChartWrap');
    if (cw) { cw.style.display = 'none'; cw.style.opacity = ''; }
    return ov;
}

function _q2BuildKpi(items) {
    var h = '';
    items.forEach(function(it, i) {
        if (i > 0) h += '<div class="ao-kpi-sep"></div>';
        h += '<div class="ao-kpi ' + (it.cls || '') + '">' +
             '<div class="ao-kpi-val" id="' + (it.id || '') + '">' + (it.val || '0') + '</div>' +
             '<div class="ao-kpi-lbl">' + it.lbl + '</div></div>';
    });
    document.getElementById('q2KpiRow').innerHTML = h;
}

function _q2TypeWriter(text, el, i) {
    if (!q2Active || i > text.length) {
        if (i > text.length) {
            var endBtns = document.getElementById('q2EndBtns');
            if (endBtns) {
                endBtns.style.display = '';
                setTimeout(function() { endBtns.classList.add('show'); }, 100);
            }
        }
        return;
    }
    var displayed = text.substring(0, i).replace(/\n/g, '<br>');
    el.innerHTML = displayed + '<span class="cm-cursor"></span>';
    /* 自动滚到底部 */
    var parent = el.parentElement;
    if (parent && parent.classList.contains('ao-typewriter')) {
        parent.scrollTop = parent.scrollHeight;
    }
    
    /* 检测是否刚打完一个换行符，如果是则等待更长时间 */
    var delay = 80; // 基础打字速度从50ms降到80ms
    if (i > 0 && text[i - 1] === '\n') {
        delay = 800; // 每行结束后等待800ms再继续下一行
    }
    setTimeout(function() { _q2TypeWriter(text, el, i + 1); }, delay);
}

/* ══════════════════════════════════════════
   序章 — 灵魂拷问
   一滴白色流体 vs 巨大空间 = 微利 vs 帝国
   ══════════════════════════════════════════ */
function q2Act0(hasGsap) {
    _q2Cleanup();
    _q2ShowOv('序章', '灵魂拷问');

    var canvas = document.getElementById('q2Canvas');
    canvas.style.display = 'block';
    canvas.style.opacity = '1';
    _q2Canvas = canvas;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    canvas.style.width = window.innerWidth + 'px';
    canvas.style.height = window.innerHeight + 'px';
    var ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    _q2Ctx = ctx;

    var W = window.innerWidth, H = window.innerHeight;
    var cx = W * 0.5, cy = H * 0.5;

    /* 一滴奶：中心白色粒子群（极小，~30px半径） */
    var droplets = [];
    for (var i = 0; i < 120; i++) {
        var ang = Math.random() * Math.PI * 2;
        var rad = Math.random() * 25;
        droplets.push({
            x: cx + Math.cos(ang) * rad,
            y: cy + Math.sin(ang) * rad,
            vx: (Math.random() - 0.5) * 0.3,
            vy: (Math.random() - 0.5) * 0.3,
            r: 0.8 + Math.random() * 2.5,
            alpha: 0.4 + Math.random() * 0.6,
            phase: Math.random() * Math.PI * 2
        });
    }

    var t = 0;
    var phase = 0; /* 0=聚集, 1=数字显现, 2=爆发扩散 */
    var phaseTime = 0;

    function render() {
        t += 0.016;
        phaseTime += 0.016;
        /* 渐变背景底色 */
        var bgGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(W, H) * 0.6);
        bgGrad.addColorStop(0, 'rgba(12,16,28,0.18)');
        bgGrad.addColorStop(1, 'rgba(5,5,8,0.22)');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, W, H);

        if (phase === 0) {
            /* 聚集态：小液滴在中心微微浮动 */
            for (var i = 0; i < droplets.length; i++) {
                var d = droplets[i];
                var dx = cx - d.x, dy = cy - d.y;
                var dist = Math.sqrt(dx * dx + dy * dy) + 0.1;
                d.vx += dx / dist * 0.02;
                d.vy += dy / dist * 0.02;
                d.vx *= 0.97; d.vy *= 0.97;
                d.x += d.vx; d.y += d.vy;

                var twinkle = 0.5 + 0.5 * Math.sin(t * 2 + d.phase);
                ctx.beginPath();
                ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(220,235,255,' + (d.alpha * twinkle * 0.8).toFixed(3) + ')';
                ctx.fill();
            }

            /* 中心辉光 — 更亮更丰富 */
            var glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, 60);
            glow.addColorStop(0, 'rgba(255,255,255,0.2)');
            glow.addColorStop(0.3, 'rgba(0,210,168,0.1)');
            glow.addColorStop(0.6, 'rgba(0,158,148,0.04)');
            glow.addColorStop(1, 'transparent');
            ctx.fillStyle = glow;
            ctx.beginPath(); ctx.arc(cx, cy, 60, 0, Math.PI * 2); ctx.fill();

            /* 外圈柔光环 */
            ctx.strokeStyle = 'rgba(0,180,90,0.06)';
            ctx.lineWidth = 1;
            var ringR = 35 + Math.sin(t) * 5;
            ctx.beginPath(); ctx.arc(cx, cy, ringR, 0, Math.PI * 2); ctx.stroke();

            if (phaseTime > 3) { phase = 1; phaseTime = 0; }
        }

        if (phase === 1) {
            for (var i = 0; i < droplets.length; i++) {
                var d = droplets[i];
                var dx = cx - d.x, dy = cy - d.y;
                d.vx += dx * 0.001; d.vy += dy * 0.001;
                d.vx *= 0.98; d.vy *= 0.98;
                d.x += d.vx; d.y += d.vy;
                var tw = 0.5 + 0.5 * Math.sin(t * 2 + d.phase);
                ctx.beginPath();
                ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(220,235,255,' + (d.alpha * tw * 0.6).toFixed(3) + ')';
                ctx.fill();
            }

            /* 中心光晕 */
            var glow2 = ctx.createRadialGradient(cx, cy, 0, cx, cy, 80);
            glow2.addColorStop(0, 'rgba(255,255,255,0.12)');
            glow2.addColorStop(0.5, 'rgba(0,158,148,0.05)');
            glow2.addColorStop(1, 'transparent');
            ctx.fillStyle = glow2;
            ctx.beginPath(); ctx.arc(cx, cy, 80, 0, Math.PI * 2); ctx.fill();

            var textAlpha = Math.min(1, phaseTime / 1.5) * 0.85;
            ctx.font = 'bold ' + Math.round(W * 0.07) + 'px "Courier New", monospace';
            ctx.textAlign = 'center';
            ctx.fillStyle = 'rgba(255,255,255,' + textAlpha.toFixed(3) + ')';
            ctx.fillText('¥0.27', cx, cy + 5);
            /* 文字光晕 */
            ctx.shadowColor = 'rgba(0,158,148,0.4)';
            ctx.shadowBlur = 30;
            ctx.fillText('¥0.27', cx, cy + 5);
            ctx.shadowBlur = 0;

            ctx.font = Math.round(W * 0.013) + 'px system-ui, sans-serif';
            ctx.fillStyle = 'rgba(160,200,230,' + (textAlpha * 0.6).toFixed(3) + ')';
            ctx.fillText('每盒净利润', cx, cy + W * 0.045);

            if (phaseTime > 2.5) { phase = 2; phaseTime = 0; }
        }

        if (phase === 2) {
            var expandT = Math.min(1, phaseTime / 3);
            var expandEase = 1 - Math.pow(1 - expandT, 3);
            var targetR = Math.min(W, H) * 0.42;

            for (var i = 0; i < droplets.length; i++) {
                var d = droplets[i];
                var dx = d.x - cx, dy = d.y - cy;
                var dist = Math.sqrt(dx * dx + dy * dy) + 0.1;
                var targetDist = (i / droplets.length) * targetR * expandEase;
                var pushStr = (targetDist - dist) * 0.02;
                d.vx += (dx / dist) * pushStr;
                d.vy += (dy / dist) * pushStr;
                d.vx *= 0.95; d.vy *= 0.95;
                d.x += d.vx; d.y += d.vy;

                var tw = 0.5 + 0.5 * Math.sin(t * 2 + d.phase);
                ctx.beginPath();
                ctx.arc(d.x, d.y, d.r * (1 + expandEase * 0.5), 0, Math.PI * 2);
                /* 颜色随扩散逐渐变蓝白 */
                var cr = Math.round(200 + expandEase * 55);
                var cg = Math.round(220 + expandEase * 35);
                ctx.fillStyle = 'rgba(' + cr + ',' + cg + ',255,' + (d.alpha * tw * (0.4 + expandEase * 0.4)).toFixed(3) + ')';
                ctx.fill();
            }

            /* 扩散光波环 */
            if (expandT > 0.1) {
                var waveR = expandEase * targetR * 0.8;
                ctx.strokeStyle = 'rgba(0,158,148,' + (0.15 * (1 - expandEase)).toFixed(3) + ')';
                ctx.lineWidth = 2;
                ctx.beginPath(); ctx.arc(cx, cy, waveR, 0, Math.PI * 2); ctx.stroke();
            }

            if (expandT > 0.3) {
                var bigAlpha = Math.min(0.9, (expandT - 0.3) / 0.5);
                ctx.font = 'bold ' + Math.round(W * 0.12) + 'px "Courier New", monospace';
                ctx.textAlign = 'center';
                ctx.fillStyle = 'rgba(255,255,255,' + bigAlpha.toFixed(3) + ')';
                var countUp = Math.round(1890 * Math.min(1, (expandT - 0.3) / 0.7));
                ctx.shadowColor = 'rgba(0,180,90,0.5)';
                ctx.shadowBlur = 40;
                ctx.fillText(countUp + '亿', cx, cy + 5);
                ctx.shadowBlur = 0;

                ctx.font = Math.round(W * 0.014) + 'px system-ui, sans-serif';
                ctx.fillStyle = 'rgba(0,158,148,' + (bigAlpha * 0.6).toFixed(3) + ')';
                ctx.fillText('两家乳企 · 合计年营收', cx, cy + W * 0.065);
            }
        }

        _q2AnimId = requestAnimationFrame(render);
    }

    render();

    /* GSAP: 标题动画 */
    if (hasGsap) {
        var tl = gsap.timeline();
        _q2TL = tl;
        var aoTitle = document.getElementById('q2Title');
        var aoInsight = document.getElementById('q2Insight');
        tl.to(aoTitle, { opacity: 1, duration: 1.2, ease: 'power2.out' }, 0);
        tl.to(aoTitle, { opacity: 0, y: -40, duration: 0.8 }, 2.5);
        aoInsight.textContent = Q2_ACTS[0].insight;
        tl.to(aoInsight, { opacity: 0.7, duration: 1 }, 8);
    }
}

/* ══════════════════════════════════════════
   第一幕 — 极限规模法则 (The Scale Paradox)
   单盒成本分解环形图 + 粒子从1裂变到无穷 + 营收折线
   ══════════════════════════════════════════ */
function q2Act1(hasGsap) {
    _q2Cleanup();
    _q2ShowOv('第一幕', '极限规模法则');

    /* Canvas: 数量暴力美学 — 粒子从1到8500万盒 */
    var canvas = document.getElementById('q2Canvas');
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

    /* 粒子池，从少到多 */
    var boxes = [{ x: W * 0.5, y: H * 0.5, vx: 0, vy: 0, r: 3, born: 0 }];
    var maxBoxes = 600; /* 性能限制，视觉代表数百亿盒 */
    var spawnRate = 0; /* 每帧生成数，逐步加速 */
    var t = 0;
    var displayCount = 1;

    function render() {
        t += 0.016;
        ctx.fillStyle = 'rgba(5,5,5,0.12)';
        ctx.fillRect(0, 0, W, H);

        /* 逐渐加速生成 — 模拟指数增长 */
        spawnRate = Math.min(8, t * 0.8);
        var toSpawn = Math.floor(spawnRate);
        if (Math.random() < (spawnRate - toSpawn)) toSpawn++;

        for (var s = 0; s < toSpawn && boxes.length < maxBoxes; s++) {
            /* 从已有粒子位置"分裂" */
            var parent = boxes[Math.floor(Math.random() * boxes.length)];
            var ang = Math.random() * Math.PI * 2;
            var speed = 0.5 + Math.random() * 2;
            boxes.push({
                x: parent.x + Math.cos(ang) * 3,
                y: parent.y + Math.sin(ang) * 3,
                vx: Math.cos(ang) * speed,
                vy: Math.sin(ang) * speed,
                r: 0.8 + Math.random() * 1.5,
                born: t
            });
        }

        /* 更新 + 绘制 */
        for (var i = 0; i < boxes.length; i++) {
            var b = boxes[i];
            /* 微弱向外扩散 + 环形约束 */
            var dx = b.x - W * 0.5, dy = b.y - H * 0.5;
            var dist = Math.sqrt(dx * dx + dy * dy) + 0.1;
            var maxR = Math.min(W, H) * 0.38;
            if (dist > maxR) {
                b.vx -= (dx / dist) * 0.3;
                b.vy -= (dy / dist) * 0.3;
            }
            b.vx *= 0.99; b.vy *= 0.99;
            b.x += b.vx; b.y += b.vy;

            var age = t - b.born;
            var fadeIn = Math.min(1, age / 0.5);
            var pulse = 0.5 + 0.5 * Math.sin(t * 3 + i * 0.1);
            var alpha = fadeIn * (0.15 + pulse * 0.25);

            ctx.beginPath();
            ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255,255,255,' + alpha.toFixed(3) + ')';
            ctx.fill();
        }

        /* 中心大数字 — 计数器加速 */
        var targetCount = Math.min(8493, Math.round(Math.pow(t / 8, 3) * 8493));
        displayCount += (targetCount - displayCount) * 0.08;
        var showCount = Math.round(displayCount);

        ctx.font = 'bold ' + Math.round(W * 0.07) + 'px "Courier New", monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.shadowColor = 'rgba(0,180,90,0.4)';
        ctx.shadowBlur = 30;
        ctx.fillText(showCount.toLocaleString() + ' 万盒', W * 0.5, H * 0.45);
        ctx.shadowBlur = 0;

        ctx.font = Math.round(W * 0.012) + 'px system-ui';
        ctx.fillStyle = 'rgba(0,158,148,0.4)';
        ctx.fillText('每天 · 中国消费', W * 0.5, H * 0.45 + W * 0.04);

        _q2AnimId = requestAnimationFrame(render);
    }
    render();

    /* GSAP + ECharts */
    if (!hasGsap) return;
    var tl = gsap.timeline();
    _q2TL = tl;

    var aoTitle = document.getElementById('q2Title');
    var aoInsight = document.getElementById('q2Insight');
    var kpiRow = document.getElementById('q2KpiRow');

    tl.to(aoTitle, { opacity: 1, duration: 1.2 }, 0);
    tl.to(aoTitle, { opacity: 0, y: -40, duration: 0.8 }, 2.5);

    /* KPI：单盒利润 vs 日销量 vs 年营收 */
    _q2BuildKpi([
        { id: 'q2K1', val: '0.27', lbl: '元 · 单盒净利', cls: 'ao-kpi-gold' },
        { id: 'q2K2', val: '0', lbl: '万盒 · 日销量', cls: 'ao-kpi-blue' },
        { id: 'q2K3', val: '0', lbl: '亿元 · 年营收', cls: 'ao-kpi-red' }
    ]);
    tl.to(kpiRow, { opacity: 1, duration: 0.8 }, 3.5);

    var kObj = { daily: 0, rev: 0 };
    tl.to(kObj, {
        daily: 8493, rev: 1890, duration: 3, ease: 'power1.out',
        onUpdate: function() {
            var e2 = document.getElementById('q2K2');
            var e3 = document.getElementById('q2K3');
            if (e2) e2.textContent = Math.round(kObj.daily).toLocaleString();
            if (e3) e3.textContent = Math.round(kObj.rev);
        }
    }, 3.8);

    /* ECharts出现时淡出canvas计数器 */
    tl.call(function() {
        var cvs = document.getElementById('q2Canvas');
        gsap.to(cvs, { opacity: 0, duration: 1.5 });
    }, [], 6);

    /* ── Apple PPT 产品大图飞入 ── */
    tl.call(function() {
        var imgY = document.getElementById('q2ImgYili');
        var imgM = document.getElementById('q2ImgMengniu');
        if (!imgY || !imgM) return;

        /* 显示 + 从远处飞入 */
        imgY.style.display = 'block';
        imgM.style.display = 'block';

        gsap.fromTo(imgY, {
            opacity: 0,
            x: -120,
            rotateY: 40,
            scale: 0.6
        }, {
            opacity: 0.85,
            x: 0,
            rotateY: 18,
            scale: 0.92,
            duration: 1.8,
            ease: 'power3.out'
        });

        gsap.fromTo(imgM, {
            opacity: 0,
            x: 120,
            rotateY: -40,
            scale: 0.6
        }, {
            opacity: 0.85,
            x: 0,
            rotateY: -18,
            scale: 0.92,
            duration: 1.8,
            ease: 'power3.out',
            delay: 0.2
        });

        /* 持续微浮动呼吸感 */
        gsap.to(imgY, {
            y: '-=12', rotateX: -3,
            duration: 3, ease: 'sine.inOut', repeat: -1, yoyo: true, delay: 2
        });
        gsap.to(imgM, {
            y: '+=12', rotateX: -1,
            duration: 3.5, ease: 'sine.inOut', repeat: -1, yoyo: true, delay: 2.3
        });
    }, [], 5.5);

    /* ECharts: 单盒成本分解 + 6年营收对比 */
    tl.call(function() {
        var cw = document.getElementById('q2ChartWrap');
        cw.style.display = 'block';
        _q2Chart = echarts.init(document.getElementById('q2ChartEl'), 'dark');

        var be = DAIRY.scale.boxEcon;

        /* ── 乳白色系成本环 ── */
        var costColors = [
            /* 原奶 — 乳白主色 */
            new echarts.graphic.LinearGradient(0,0,1,1,[{offset:0,color:'#00d4aa'},{offset:1,color:'#00aa55'}]),
            /* 物流 — 冷链蓝 */
            new echarts.graphic.LinearGradient(0,0,1,1,[{offset:0,color:'#00d4aa'},{offset:1,color:'#5098d8'}]),
            /* 营销 — 暖金 */
            new echarts.graphic.LinearGradient(0,0,1,1,[{offset:0,color:'#66ffbb'},{offset:1,color:'#00aa55'}]),
            /* 包材 — 牛皮纸棕 */
            new echarts.graphic.LinearGradient(0,0,1,1,[{offset:0,color:'#44dd88'},{offset:1,color:'#008844'}]),
            /* 其他 — 温灰 */
            new echarts.graphic.LinearGradient(0,0,1,1,[{offset:0,color:'#22cc77'},{offset:1,color:'#006633'}]),
            /* 税费 — 淡紫灰 */
            new echarts.graphic.LinearGradient(0,0,1,1,[{offset:0,color:'#55eebb'},{offset:1,color:'#009955'}]),
            /* 利润 — 薄荷绿(微薄利润感) */
            new echarts.graphic.LinearGradient(0,0,1,1,[{offset:0,color:'#00d4aa'},{offset:1,color:'#00bb55'}])
        ];
        var costData = [
            { value: be.rawMilk, name: '原奶 ¥' + be.rawMilk },
            { value: be.logistics, name: '物流 ¥' + be.logistics },
            { value: be.marketing, name: '营销 ¥' + be.marketing },
            { value: be.packaging, name: '包材 ¥' + be.packaging },
            { value: be.other, name: '其他 ¥' + be.other },
            { value: be.tax, name: '税费 ¥' + be.tax },
            { value: be.profit, name: '利润 ¥' + be.profit }
        ];
        costData.forEach(function(d, i) { d.itemStyle = { color: costColors[i] }; });

        /* ── 品牌色：伊利蓝 / 蒙牛绿 ── */
        var yiliColor = new echarts.graphic.LinearGradient(0,0,0,1,[
            {offset:0,color:'rgba(0,210,168,0.95)'},{offset:1,color:'rgba(0,210,168,0.45)'}]);
        var mengniuColor = new echarts.graphic.LinearGradient(0,0,0,1,[
            {offset:0,color:'rgba(0,158,148,0.95)'},{offset:1,color:'rgba(0,158,148,0.45)'}]);

        _q2Chart.setOption({
            backgroundColor: 'transparent',
            grid: { left: '55%', right: '5%', top: '18%', bottom: '16%' },
            title: [
                { text: '单盒成本分解', subtext: '每盒 250ml 定价 ¥' + (be.rawMilk + be.logistics + be.marketing + be.packaging + be.other + be.tax + be.profit).toFixed(1),
                  left: '18%', top: '4%', textAlign: 'center',
                  textStyle: { color: 'rgba(200,255,220,0.85)', fontSize: 14, fontWeight: 600 },
                  subtextStyle: { color: 'rgba(0,210,168,0.45)', fontSize: 10 } },
                { text: '{yili|伊利}  vs  {mengniu|蒙牛}', left: '72%', top: '4%', textAlign: 'center',
                  textStyle: { rich: {
                      yili: { color: '#00d4aa', fontSize: 15, fontWeight: 700 },
                      mengniu: { color: '#00d4aa', fontSize: 15, fontWeight: 700 }
                  } } }
            ],
            tooltip: { trigger: 'item',
                       backgroundColor: 'rgba(5,15,10,0.92)', borderColor: 'rgba(0,210,168,0.2)', borderWidth: 1,
                       textStyle: { color: '#e0ffe8', fontSize: 12 },
                       formatter: function(p) {
                           if (p.seriesType === 'pie') return '<b>' + p.name + '</b><br/>占比 ' + p.percent + '%';
                           return p.seriesName + ' · ' + p.name + '<br/><b>' + p.value + ' 亿元</b>';
                       }
            },
            animationDuration: 1200, animationEasing: 'cubicOut',
            graphic: (function() {
                /* ── 伊利 SVG logo (蓝色风格简化标识) ── */
                var yiliSvg = 'data:image/svg+xml,' + encodeURIComponent(
                    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 40">' +
                    '<defs><linearGradient id="yg" x1="0" y1="0" x2="1" y2="1">' +
                    '<stop offset="0" stop-color="#00d4aa"/><stop offset="1" stop-color="#5098d8"/>' +
                    '</linearGradient></defs>' +
                    '<rect rx="6" width="120" height="40" fill="#051510" stroke="#5098d8" stroke-width="1" opacity="0.9"/>' +
                    '<text x="60" y="15" text-anchor="middle" font-size="9" fill="#00d4aa" font-family="Arial" letter-spacing="2">YILI GROUP</text>' +
                    '<text x="60" y="32" text-anchor="middle" font-size="16" fill="url(#yg)" font-weight="700" font-family="system-ui">伊 利 集 团</text>' +
                    '</svg>');
                /* ── 蒙牛 SVG logo (绿色风格简化标识) ── */
                var mengniuSvg = 'data:image/svg+xml,' + encodeURIComponent(
                    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 40">' +
                    '<defs><linearGradient id="mg" x1="0" y1="0" x2="1" y2="1">' +
                    '<stop offset="0" stop-color="#00d4aa"/><stop offset="1" stop-color="#00aa55"/>' +
                    '</linearGradient></defs>' +
                    '<rect rx="6" width="120" height="40" fill="#051510" stroke="#00aa55" stroke-width="1" opacity="0.9"/>' +
                    '<text x="60" y="15" text-anchor="middle" font-size="9" fill="#00d4aa" font-family="Arial" letter-spacing="2">MENGNIU</text>' +
                    '<text x="60" y="32" text-anchor="middle" font-size="16" fill="url(#mg)" font-weight="700" font-family="system-ui">蒙 牛 乳 业</text>' +
                    '</svg>');
                return [
                    { type: 'image', left: '54%', top: '9%', style: { image: yiliSvg, width: 96, height: 32 } },
                    { type: 'image', left: '54%', top: '15%', style: { image: mengniuSvg, width: 96, height: 32 } }
                ];
            })(),
            series: [
                /* ── 成本环形 ── */
                {
                    name: '成本', type: 'pie', radius: ['35%', '60%'],
                    center: ['18%', '56%'],
                    label: { color: 'rgba(0,210,168,0.7)', fontSize: 11,
                             formatter: function(p) { return p.name.split(' ')[0] + ' ¥' + p.value; } },
                    labelLine: { lineStyle: { color: 'rgba(0,210,168,0.2)' } },
                    emphasis: { scale: true, scaleSize: 8,
                               label: { fontSize: 13, fontWeight: 600, color: '#00d4aa' },
                               itemStyle: { shadowBlur: 20, shadowColor: 'rgba(0,210,168,0.3)' } },
                    data: costData
                },
                /* ── 伊利营收柱 ── */
                {
                    name: '伊利', type: 'bar',
                    data: DAIRY.scale.yiliRevenue,
                    itemStyle: { color: yiliColor, borderRadius: [4,4,0,0] },
                    emphasis: { itemStyle: { shadowBlur: 12, shadowColor: 'rgba(0,210,168,0.4)' } },
                    barWidth: '28%', barGap: '20%',
                    xAxisIndex: 0, yAxisIndex: 0,
                    animationDelay: function(idx) { return idx * 150; }
                },
                /* ── 蒙牛营收柱 ── */
                {
                    name: '蒙牛', type: 'bar',
                    data: DAIRY.scale.mengniuRevenue,
                    itemStyle: { color: mengniuColor, borderRadius: [4,4,0,0] },
                    emphasis: { itemStyle: { shadowBlur: 12, shadowColor: 'rgba(0,158,148,0.4)' } },
                    barWidth: '28%',
                    xAxisIndex: 0, yAxisIndex: 0,
                    animationDelay: function(idx) { return idx * 150 + 80; }
                }
            ],
            xAxis: { type: 'category', data: DAIRY.scale.years.map(String),
                     axisLabel: { color: 'rgba(0,210,168,0.55)', fontSize: 11 },
                     axisLine: { lineStyle: { color: 'rgba(0,210,168,0.12)' } },
                     axisTick: { show: false } },
            yAxis: { type: 'value', name: '亿元',
                     axisLabel: { color: 'rgba(0,210,168,0.4)', fontSize: 10 },
                     splitLine: { lineStyle: { color: 'rgba(0,210,168,0.06)' } },
                     nameTextStyle: { color: 'rgba(0,210,168,0.45)' } },
            legend: { show: true, top: '91%', icon: 'roundRect', itemWidth: 14, itemHeight: 8,
                      textStyle: { color: 'rgba(0,210,168,0.6)', fontSize: 11 },
                      data: [
                          { name: '伊利', itemStyle: { color: '#00d4aa' } },
                          { name: '蒙牛', itemStyle: { color: '#00d4aa' } }
                      ] }
        });
        gsap.to(cw, { opacity: 1, duration: 1 });
        /* 图表出现后，产品图回退为半透明背景 */
        var iy = document.getElementById('q2ImgYili');
        var im = document.getElementById('q2ImgMengniu');
        if (iy) gsap.to(iy, { opacity: 0.25, scale: 1.0, duration: 1.5, ease: 'power2.out' });
        if (im) gsap.to(im, { opacity: 0.25, scale: 1.0, duration: 1.5, ease: 'power2.out' });
    }, [], 7);

    aoInsight.textContent = Q2_ACTS[1].insight;
    tl.to(aoInsight, { opacity: 0.7, duration: 1 }, 10);
}

/* ══════════════════════════════════════════
   第二幕 — 重资产堡垒 (The Heavy-Asset Moat)
   3D等距网格矩阵 + 柱体拔地而起 = 工业压迫感
   ══════════════════════════════════════════ */
function q2Act2(hasGsap) {
    _q2Cleanup();
    _q2ShowOv('第二幕', '重资产堡垒');

    var canvas = document.getElementById('q2Canvas');
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

    /* ═══ 未来工厂群 — 玻璃厂房 + 机械臂 + 中央光塔 ═══ */
    var unit = Math.min(W, H) * 0.01;

    /* 等距投影参数 */
    var ISO_ANG = Math.PI / 6; /* 30° */
    var COS_A = Math.cos(ISO_ANG), SIN_A = Math.sin(ISO_ANG);
    var CX = W * 0.5, CY = H * 0.58;

    function isoProject(gx, gy, gz) {
        var sx = CX + (gx - gy) * COS_A * unit;
        var sy = CY + (gx + gy) * SIN_A * unit - gz * unit;
        return [sx, sy];
    }

    /* ── 草地底板菱形 ── */
    var grassExtent = 28;

    /* ── 工厂建筑定义 ── */
    var buildings = [
        /* 中央主厂（最大，蓝色发光核心） */
        { gx: -3, gy: -3, bw: 6, bd: 6, bh: 7, core: true, delay: 0.4 },
        /* 左翼 */
        { gx: -12, gy: -5, bw: 5, bd: 4, bh: 4.5, core: false, delay: 0.7 },
        { gx: -12, gy:  3, bw: 5, bd: 4, bh: 4.5, core: false, delay: 0.9 },
        /* 右翼 */
        { gx:  5, gy: -5, bw: 5, bd: 4, bh: 4.5, core: false, delay: 0.8 },
        { gx:  5, gy:  3, bw: 5, bd: 4, bh: 4.5, core: false, delay: 1.0 },
        /* 远端小楼 */
        { gx: -19, gy: -2, bw: 4, bd: 3, bh: 3.5, core: false, delay: 1.2 },
        { gx: -19, gy:  5, bw: 4, bd: 3, bh: 3.5, core: false, delay: 1.3 },
        { gx:  13, gy: -2, bw: 4, bd: 3, bh: 3.5, core: false, delay: 1.1 },
        { gx:  13, gy:  5, bw: 4, bd: 3, bh: 3.5, core: false, delay: 1.4 }
    ];

    /* ── 圆形储罐 ── */
    var tanks = [
        { gx: -8, gy: -9, r: 1.5, h: 2.5, delay: 1.5 },
        { gx: -5, gy: -10, r: 1.2, h: 2, delay: 1.6 },
        { gx:  8, gy:  9, r: 1.5, h: 2.5, delay: 1.7 },
        { gx:  11, gy:  8, r: 1.2, h: 2, delay: 1.8 },
        { gx: -7, gy:  10, r: 1.3, h: 2.2, delay: 1.65 },
        { gx:  6, gy: -10, r: 1.3, h: 2.2, delay: 1.55 }
    ];

    /* ── 管道连接线 ── */
    var pipes = [
        { from: [0,0,3.5], to: [-9,-3,2.25] },
        { from: [0,0,3.5], to: [-9, 5,2.25] },
        { from: [0,0,3.5], to: [7.5,-3,2.25] },
        { from: [0,0,3.5], to: [7.5, 5,2.25] },
        { from: [-9,-3,2.25], to: [-17, -0.5, 1.75] },
        { from: [-9, 5,2.25], to: [-17, 6.5, 1.75] },
        { from: [7.5,-3,2.25], to: [15, -0.5, 1.75] },
        { from: [7.5, 5,2.25], to: [15, 6.5, 1.75] }
    ];

    /* ── 机械臂数据 ── */
    var robotArms = [];
    buildings.forEach(function(b) {
        if (b.core) {
            for (var ra = 0; ra < 4; ra++) {
                robotArms.push({ gx: b.gx + 1 + ra, gy: b.gy + b.bd * 0.5, bh: b.bh, phase: ra * 1.5, parent: b });
            }
        } else if (b.bw >= 5) {
            for (var rb = 0; rb < 2; rb++) {
                robotArms.push({ gx: b.gx + 1 + rb * 2, gy: b.gy + b.bd * 0.5, bh: b.bh, phase: rb * 2.0, parent: b });
            }
        }
    });

    /* ── 太阳能板区域 ── */
    var solarPanels = [];
    for (var sp_r = 0; sp_r < 4; sp_r++) {
        for (var sp_c = 0; sp_c < 6; sp_c++) {
            solarPanels.push({ gx: -25 + sp_c * 2.5, gy: -14 + sp_r * 2.5, w: 2, d: 1.8, delay: 1.8 + (sp_r + sp_c) * 0.05 });
        }
    }

    /* ── 浮动粒子 ── */
    var particles = [];
    for (var pp = 0; pp < 50; pp++) {
        particles.push({
            x: Math.random() * W, y: Math.random() * H,
            vx: (Math.random() - 0.5) * 0.3,
            vy: -0.2 - Math.random() * 0.4,
            size: 0.6 + Math.random() * 1.2,
            phase: Math.random() * Math.PI * 2
        });
    }

    var t = 0;
    var scanY = -50;

    function render() {
        t += 0.016;

        /* ── 清屏 + 暗色渐变背景 ── */
        var bgGrad = ctx.createLinearGradient(0, 0, 0, H);
        bgGrad.addColorStop(0, '#050a14');
        bgGrad.addColorStop(0.4, '#0a1628');
        bgGrad.addColorStop(0.7, '#0d1f2f');
        bgGrad.addColorStop(1, '#0a1a18');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, W, H);

        /* ── 远处大气雾光 ── */
        var fogGrad = ctx.createRadialGradient(CX, CY - H * 0.1, 0, CX, CY - H * 0.1, W * 0.55);
        fogGrad.addColorStop(0, 'rgba(0,120,60,0.08)');
        fogGrad.addColorStop(0.5, 'rgba(0,60,30,0.03)');
        fogGrad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = fogGrad;
        ctx.fillRect(0, 0, W, H);

        /* ── 草地底板 ── */
        var gTL = isoProject(-grassExtent, -grassExtent, 0);
        var gTR = isoProject(grassExtent, -grassExtent, 0);
        var gBR = isoProject(grassExtent, grassExtent, 0);
        var gBL = isoProject(-grassExtent, grassExtent, 0);
        var grassGrad = ctx.createLinearGradient(gTL[0], gTL[1], gBR[0], gBR[1]);
        grassGrad.addColorStop(0, 'rgba(35,85,40,0.6)');
        grassGrad.addColorStop(0.5, 'rgba(45,100,50,0.5)');
        grassGrad.addColorStop(1, 'rgba(30,75,35,0.4)');
        ctx.fillStyle = grassGrad;
        ctx.beginPath();
        ctx.moveTo(gTL[0], gTL[1]); ctx.lineTo(gTR[0], gTR[1]);
        ctx.lineTo(gBR[0], gBR[1]); ctx.lineTo(gBL[0], gBL[1]);
        ctx.closePath(); ctx.fill();

        /* 草地网格细线 */
        ctx.strokeStyle = 'rgba(80,160,90,0.08)';
        ctx.lineWidth = 0.5;
        for (var gl = -grassExtent; gl <= grassExtent; gl += 4) {
            var la = isoProject(gl, -grassExtent, 0), lb = isoProject(gl, grassExtent, 0);
            ctx.beginPath(); ctx.moveTo(la[0], la[1]); ctx.lineTo(lb[0], lb[1]); ctx.stroke();
            var lc = isoProject(-grassExtent, gl, 0), ld = isoProject(grassExtent, gl, 0);
            ctx.beginPath(); ctx.moveTo(lc[0], lc[1]); ctx.lineTo(ld[0], ld[1]); ctx.stroke();
        }

        /* ── 太阳能板 ── */
        for (var si = 0; si < solarPanels.length; si++) {
            var sp = solarPanels[si];
            var sElapsed = t - sp.delay;
            if (sElapsed < 0) continue;
            var sEase = Math.min(1, sElapsed / 0.8);
            var spH = 0.3; /* 略高于地面 */
            var sAlpha = sEase * 0.7;
            var s0 = isoProject(sp.gx, sp.gy, spH);
            var s1 = isoProject(sp.gx + sp.w, sp.gy, spH);
            var s2 = isoProject(sp.gx + sp.w, sp.gy + sp.d, spH);
            var s3 = isoProject(sp.gx, sp.gy + sp.d, spH);
            /* 面板 */
            ctx.fillStyle = 'rgba(0,60,30,' + (sAlpha * 0.8).toFixed(3) + ')';
            ctx.beginPath();
            ctx.moveTo(s0[0], s0[1]); ctx.lineTo(s1[0], s1[1]);
            ctx.lineTo(s2[0], s2[1]); ctx.lineTo(s3[0], s3[1]);
            ctx.closePath(); ctx.fill();
            /* 反光条 */
            ctx.strokeStyle = 'rgba(0,158,148,' + (sAlpha * 0.4).toFixed(3) + ')';
            ctx.lineWidth = 0.5;
            ctx.stroke();
            /* 中间分割线 */
            var sm1 = isoProject(sp.gx + sp.w * 0.5, sp.gy, spH);
            var sm2 = isoProject(sp.gx + sp.w * 0.5, sp.gy + sp.d, spH);
            ctx.beginPath(); ctx.moveTo(sm1[0], sm1[1]); ctx.lineTo(sm2[0], sm2[1]); ctx.stroke();
        }

        /* ── 管道 ── */
        for (var pi = 0; pi < pipes.length; pi++) {
            var pp_ = pipes[pi];
            var pA = isoProject(pp_.from[0], pp_.from[1], pp_.from[2]);
            var pB = isoProject(pp_.to[0], pp_.to[1], pp_.to[2]);
            var pipeAlpha = Math.min(0.4, t * 0.08);
            ctx.strokeStyle = 'rgba(0,158,148,' + pipeAlpha.toFixed(3) + ')';
            ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(pA[0], pA[1]); ctx.lineTo(pB[0], pB[1]); ctx.stroke();
            /* 管道上流动光点 */
            var flowP = (t * 0.3 + pi * 0.4) % 1;
            var fpx = pA[0] + (pB[0] - pA[0]) * flowP;
            var fpy = pA[1] + (pB[1] - pA[1]) * flowP;
            ctx.save();
            ctx.shadowColor = 'rgba(0,220,100,0.6)';
            ctx.shadowBlur = 6;
            ctx.beginPath(); ctx.arc(fpx, fpy, 3, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(0,255,120,' + (pipeAlpha * 1.5).toFixed(3) + ')';
            ctx.fill(); ctx.restore();
        }

        /* ── 储罐（从后往前） ── */
        var sortedTanks = tanks.slice().sort(function(a, b) { return (a.gx + a.gy) - (b.gx + b.gy); });
        for (var ti = 0; ti < sortedTanks.length; ti++) {
            var tk = sortedTanks[ti];
            var tkEl = t - tk.delay;
            if (tkEl < 0) continue;
            var tkEase = Math.min(1, tkEl / 1.0);
            var tkCurH = tk.h * tkEase;
            var tkCenter = isoProject(tk.gx, tk.gy, 0);
            var tkTop = isoProject(tk.gx, tk.gy, tkCurH);
            var tkRpx = tk.r * unit * 0.9;
            /* 圆柱体 */
            ctx.fillStyle = 'rgba(0,80,40,' + (tkEase * 0.7).toFixed(3) + ')';
            ctx.beginPath();
            ctx.ellipse(tkCenter[0], tkCenter[1], tkRpx, tkRpx * 0.45, 0, 0, Math.PI * 2);
            ctx.fill();
            /* 柱身 */
            ctx.fillStyle = 'rgba(0,110,55,' + (tkEase * 0.5).toFixed(3) + ')';
            ctx.fillRect(tkCenter[0] - tkRpx, tkTop[1], tkRpx * 2, tkCenter[1] - tkTop[1]);
            /* 顶盖 */
            ctx.fillStyle = 'rgba(0,160,80,' + (tkEase * 0.6).toFixed(3) + ')';
            ctx.beginPath();
            ctx.ellipse(tkTop[0], tkTop[1], tkRpx, tkRpx * 0.45, 0, 0, Math.PI * 2);
            ctx.fill();
            /* 边缘高光 */
            ctx.strokeStyle = 'rgba(0,220,110,' + (tkEase * 0.3).toFixed(3) + ')';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.ellipse(tkTop[0], tkTop[1], tkRpx, tkRpx * 0.45, 0, 0, Math.PI * 2);
            ctx.stroke();
        }

        /* ── 建筑排序（从后往前画） ── */
        var sortedBuildings = buildings.slice().sort(function(a, b) { return (a.gx + a.gy) - (b.gx + b.gy); });

        for (var bi = 0; bi < sortedBuildings.length; bi++) {
            var b = sortedBuildings[bi];
            var bElapsed = t - b.delay;
            if (bElapsed < 0) continue;
            var bEase = Math.min(1, bElapsed / 1.5);
            var eased = 1 - Math.pow(1 - bEase, 3);
            var curH = b.bh * eased;

            /* 8个角 */
            var p0 = isoProject(b.gx, b.gy, 0);             /* 前下左 */
            var p1 = isoProject(b.gx + b.bw, b.gy, 0);      /* 前下右 */
            var p2 = isoProject(b.gx + b.bw, b.gy + b.bd, 0);/* 后下右 */
            var p3 = isoProject(b.gx, b.gy + b.bd, 0);      /* 后下左 */
            var p4 = isoProject(b.gx, b.gy, curH);           /* 前上左 */
            var p5 = isoProject(b.gx + b.bw, b.gy, curH);   /* 前上右 */
            var p6 = isoProject(b.gx + b.bw, b.gy + b.bd, curH); /* 后上右 */
            var p7 = isoProject(b.gx, b.gy + b.bd, curH);   /* 后上左 */

            var glassAlpha = b.core ? 0.18 : 0.12;
            var frameAlpha = b.core ? 0.6 : 0.4;
            var glassHue = b.core ? '190,220,255' : '150,190,220';

            /* 后面（如果可见） */
            ctx.fillStyle = 'rgba(' + glassHue + ',' + (glassAlpha * eased * 0.5).toFixed(3) + ')';
            ctx.beginPath();
            ctx.moveTo(p3[0], p3[1]); ctx.lineTo(p2[0], p2[1]);
            ctx.lineTo(p6[0], p6[1]); ctx.lineTo(p7[0], p7[1]);
            ctx.closePath(); ctx.fill();

            /* 左面 — 深色玻璃 */
            ctx.fillStyle = 'rgba(' + glassHue + ',' + (glassAlpha * eased * 0.7).toFixed(3) + ')';
            ctx.beginPath();
            ctx.moveTo(p0[0], p0[1]); ctx.lineTo(p3[0], p3[1]);
            ctx.lineTo(p7[0], p7[1]); ctx.lineTo(p4[0], p4[1]);
            ctx.closePath(); ctx.fill();

            /* 右面 — 亮玻璃 */
            ctx.fillStyle = 'rgba(' + glassHue + ',' + (glassAlpha * eased).toFixed(3) + ')';
            ctx.beginPath();
            ctx.moveTo(p1[0], p1[1]); ctx.lineTo(p2[0], p2[1]);
            ctx.lineTo(p6[0], p6[1]); ctx.lineTo(p5[0], p5[1]);
            ctx.closePath(); ctx.fill();

            /* 前面 — 主要可见面 */
            var frontGrad = ctx.createLinearGradient(p0[0], p4[1], p0[0], p0[1]);
            frontGrad.addColorStop(0, 'rgba(' + glassHue + ',' + (glassAlpha * eased * 1.2).toFixed(3) + ')');
            frontGrad.addColorStop(1, 'rgba(' + glassHue + ',' + (glassAlpha * eased * 0.3).toFixed(3) + ')');
            ctx.fillStyle = frontGrad;
            ctx.beginPath();
            ctx.moveTo(p0[0], p0[1]); ctx.lineTo(p1[0], p1[1]);
            ctx.lineTo(p5[0], p5[1]); ctx.lineTo(p4[0], p4[1]);
            ctx.closePath(); ctx.fill();

            /* 顶面 */
            ctx.fillStyle = 'rgba(' + glassHue + ',' + (glassAlpha * eased * 1.5).toFixed(3) + ')';
            ctx.beginPath();
            ctx.moveTo(p4[0], p4[1]); ctx.lineTo(p5[0], p5[1]);
            ctx.lineTo(p6[0], p6[1]); ctx.lineTo(p7[0], p7[1]);
            ctx.closePath(); ctx.fill();

            /* 玻璃框架线 — 亮边 */
            ctx.save();
            ctx.strokeStyle = 'rgba(0,220,100,' + (frameAlpha * eased).toFixed(3) + ')';
            ctx.shadowColor = 'rgba(0,158,148,' + (eased * 0.4).toFixed(3) + ')';
            ctx.shadowBlur = 4;
            ctx.lineWidth = 1.2;
            /* 前面框 */
            ctx.beginPath();
            ctx.moveTo(p0[0], p0[1]); ctx.lineTo(p1[0], p1[1]);
            ctx.lineTo(p5[0], p5[1]); ctx.lineTo(p4[0], p4[1]); ctx.closePath(); ctx.stroke();
            /* 右面框 */
            ctx.beginPath();
            ctx.moveTo(p1[0], p1[1]); ctx.lineTo(p2[0], p2[1]);
            ctx.lineTo(p6[0], p6[1]); ctx.lineTo(p5[0], p5[1]); ctx.closePath(); ctx.stroke();
            /* 顶框 */
            ctx.beginPath();
            ctx.moveTo(p4[0], p4[1]); ctx.lineTo(p5[0], p5[1]);
            ctx.lineTo(p6[0], p6[1]); ctx.lineTo(p7[0], p7[1]); ctx.closePath(); ctx.stroke();
            ctx.restore();

            /* 玻璃格栅（前面横线） — 模拟玻璃幕墙分格 */
            var gridSegs = Math.floor(b.bh);
            for (var gs = 1; gs < gridSegs; gs++) {
                var gRatio = gs / gridSegs * eased;
                var gH = b.bh * gRatio;
                var gL = isoProject(b.gx, b.gy, gH);
                var gR = isoProject(b.gx + b.bw, b.gy, gH);
                ctx.strokeStyle = 'rgba(0,220,100,' + (0.12 * eased).toFixed(3) + ')';
                ctx.lineWidth = 0.5;
                ctx.beginPath(); ctx.moveTo(gL[0], gL[1]); ctx.lineTo(gR[0], gR[1]); ctx.stroke();
            }
            /* 竖向分格 */
            var vSegs = Math.floor(b.bw);
            for (var vs = 1; vs < vSegs; vs++) {
                var vBot = isoProject(b.gx + vs, b.gy, 0);
                var vTop = isoProject(b.gx + vs, b.gy, curH);
                ctx.beginPath(); ctx.moveTo(vBot[0], vBot[1]); ctx.lineTo(vTop[0], vTop[1]); ctx.stroke();
            }

            /* 核心建筑：中央光塔 */
            if (b.core && eased > 0.3) {
                var towerX = b.gx + b.bw * 0.5;
                var towerY = b.gy + b.bd * 0.5;
                var towerBase = isoProject(towerX, towerY, curH * 0.3);
                var towerTop = isoProject(towerX, towerY, curH * 1.1);
                var towerGlow = (eased - 0.3) / 0.7;
                /* 光柱 */
                ctx.save();
                ctx.shadowColor = 'rgba(0,158,148,' + (towerGlow * 0.6).toFixed(3) + ')';
                ctx.shadowBlur = 30;
                var pillarGrad = ctx.createLinearGradient(towerBase[0], towerTop[1], towerBase[0], towerBase[1]);
                pillarGrad.addColorStop(0, 'rgba(0,220,100,' + (towerGlow * 0.5).toFixed(3) + ')');
                pillarGrad.addColorStop(0.5, 'rgba(0,180,90,' + (towerGlow * 0.3).toFixed(3) + ')');
                pillarGrad.addColorStop(1, 'rgba(0,120,60,' + (towerGlow * 0.1).toFixed(3) + ')');
                ctx.fillStyle = pillarGrad;
                var tW = unit * 0.8;
                ctx.fillRect(towerBase[0] - tW, towerTop[1], tW * 2, towerBase[1] - towerTop[1]);
                ctx.restore();
                /* 光塔顶部脉冲 */
                var pulse = 0.5 + 0.5 * Math.sin(t * 2.5);
                ctx.save();
                ctx.shadowColor = 'rgba(0,230,110,' + (towerGlow * pulse * 0.8).toFixed(3) + ')';
                ctx.shadowBlur = 25;
                var topGrad = ctx.createRadialGradient(towerTop[0], towerTop[1], 0, towerTop[0], towerTop[1], unit * 3);
                topGrad.addColorStop(0, 'rgba(0,255,130,' + (towerGlow * pulse * 0.7).toFixed(3) + ')');
                topGrad.addColorStop(1, 'rgba(0,158,148,0)');
                ctx.beginPath(); ctx.arc(towerTop[0], towerTop[1], unit * 3, 0, Math.PI * 2);
                ctx.fillStyle = topGrad; ctx.fill();
                ctx.restore();
                /* 中央环形扫描 */
                var ringR = unit * 4 * (0.5 + 0.5 * Math.sin(t * 1.2));
                ctx.strokeStyle = 'rgba(0,220,100,' + (towerGlow * 0.15).toFixed(3) + ')';
                ctx.lineWidth = 1;
                ctx.beginPath(); ctx.ellipse(towerTop[0], towerTop[1], ringR, ringR * 0.45, 0, 0, Math.PI * 2); ctx.stroke();
            }
        }

        /* ── 机械臂（建筑内透视可见） ── */
        for (var ai = 0; ai < robotArms.length; ai++) {
            var arm = robotArms[ai];
            var armParent = arm.parent;
            var armElapsed = t - armParent.delay;
            if (armElapsed < 0.8) continue;
            var armEase = Math.min(1, (armElapsed - 0.8) / 1.0);

            var armBase = isoProject(arm.gx, arm.gy, 0);
            var armAngle = Math.sin(t * 1.5 + arm.phase) * 0.6;
            var segment1 = arm.bh * 0.4 * unit * armEase;
            var segment2 = arm.bh * 0.3 * unit * armEase;
            var elbowX = armBase[0] + Math.sin(armAngle) * segment1 * 0.5;
            var elbowY = armBase[1] - segment1;
            var tipAngle = armAngle + Math.sin(t * 2.2 + arm.phase) * 0.4;
            var tipX = elbowX + Math.sin(tipAngle) * segment2 * 0.6;
            var tipY = elbowY - segment2;

            var armAlpha = armEase * 0.55;
            /* 底座 */
            ctx.fillStyle = 'rgba(0,160,80,' + armAlpha.toFixed(3) + ')';
            ctx.beginPath(); ctx.arc(armBase[0], armBase[1], unit * 0.5, 0, Math.PI * 2); ctx.fill();
            /* 第一节 */
            ctx.strokeStyle = 'rgba(0,220,100,' + armAlpha.toFixed(3) + ')';
            ctx.lineWidth = 2.5;
            ctx.beginPath(); ctx.moveTo(armBase[0], armBase[1]); ctx.lineTo(elbowX, elbowY); ctx.stroke();
            /* 关节 */
            ctx.fillStyle = 'rgba(0,220,100,' + armAlpha.toFixed(3) + ')';
            ctx.beginPath(); ctx.arc(elbowX, elbowY, unit * 0.3, 0, Math.PI * 2); ctx.fill();
            /* 第二节 */
            ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(elbowX, elbowY); ctx.lineTo(tipX, tipY); ctx.stroke();
            /* 末端执行器火花 */
            if (armEase > 0.5) {
                var sparkAlpha = (armEase - 0.5) * 2 * (0.3 + 0.4 * Math.abs(Math.sin(t * 8 + arm.phase)));
                ctx.save();
                ctx.shadowColor = 'rgba(0,220,100,' + sparkAlpha.toFixed(3) + ')';
                ctx.shadowBlur = 8;
                ctx.beginPath(); ctx.arc(tipX, tipY, unit * 0.25, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(0,255,120,' + sparkAlpha.toFixed(3) + ')';
                ctx.fill(); ctx.restore();
            }
        }

        /* ── 水平扫描线 ── */
        scanY += 0.5;
        if (scanY > H + 50) scanY = -50;
        var scanGrad2 = ctx.createLinearGradient(0, scanY - 40, 0, scanY + 40);
        scanGrad2.addColorStop(0, 'rgba(77,200,255,0)');
        scanGrad2.addColorStop(0.5, 'rgba(77,200,255,0.04)');
        scanGrad2.addColorStop(1, 'rgba(77,200,255,0)');
        ctx.fillStyle = scanGrad2;
        ctx.fillRect(0, scanY - 40, W, 80);

        /* ── 浮动粒子 ── */
        for (var pi2 = 0; pi2 < particles.length; pi2++) {
            var pt = particles[pi2];
            pt.x += pt.vx; pt.y += pt.vy;
            if (pt.y < -10) { pt.y = H + 10; pt.x = Math.random() * W; }
            if (pt.x < -10 || pt.x > W + 10) pt.x = Math.random() * W;
            var ptAlpha = 0.1 + 0.2 * Math.sin(t * 1.5 + pt.phase);
            ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(120,210,255,' + ptAlpha.toFixed(3) + ')';
            ctx.fill();
        }

        /* ── 顶部标签 ── */
        var labelAlpha = Math.min(0.9, t * 0.06);
        ctx.save();
        ctx.shadowColor = 'rgba(60,180,255,0.5)';
        ctx.shadowBlur = 20;
        ctx.font = 'bold ' + Math.round(W * 0.022) + 'px system-ui';
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(220,245,255,' + labelAlpha.toFixed(3) + ')';
        ctx.fillText('35 座全自动工厂', W * 0.5, H * 0.12);
        ctx.shadowBlur = 0;
        ctx.font = Math.round(W * 0.012) + 'px system-ui';
        ctx.fillStyle = 'rgba(160,215,245,' + (labelAlpha * 0.6).toFixed(3) + ')';
        ctx.fillText('每座投资 30 亿 · 280 个机器人 · 仅需 30 名工人', W * 0.5, H * 0.155);
        ctx.restore();

        _q2AnimId = requestAnimationFrame(render);
    }
    render();

    if (!hasGsap) return;
    var tl = gsap.timeline();
    _q2TL = tl;

    var aoTitle = document.getElementById('q2Title');
    var aoInsight = document.getElementById('q2Insight');
    var kpiRow = document.getElementById('q2KpiRow');

    tl.to(aoTitle, { opacity: 1, duration: 1.2 }, 0);
    tl.to(aoTitle, { opacity: 0, y: -40, duration: 0.8 }, 2.5);

    _q2BuildKpi([
        { id: 'q2K1', val: '0', lbl: '亿元 · 固定资产', cls: 'ao-kpi-blue' },
        { id: 'q2K2', val: '0', lbl: '座 · 智慧牧场', cls: 'ao-kpi-gold' },
        { id: 'q2K3', val: '0', lbl: '万头 · 自有奶牛', cls: 'ao-kpi-red' }
    ]);
    tl.to(kpiRow, { opacity: 1, duration: 0.8 }, 3.5);

    var kObj = { cap: 0, farms: 0, cows: 0 };
    tl.to(kObj, {
        cap: 1020, farms: 96, cows: 230, duration: 3, ease: 'power1.out',
        onUpdate: function() {
            var e1 = document.getElementById('q2K1');
            var e2 = document.getElementById('q2K2');
            var e3 = document.getElementById('q2K3');
            if (e1) e1.textContent = Math.round(kObj.cap);
            if (e2) e2.textContent = Math.round(kObj.farms);
            if (e3) e3.textContent = Math.round(kObj.cows);
        }
    }, 3.8);

    /* 淡出Canvas柱体，为ECharts让路 */
    tl.call(function() {
        var cvs = document.getElementById('q2Canvas');
        gsap.to(cvs, { opacity: 0, duration: 1.5 });
    }, [], 6);

    /* ECharts: 固定资产投入飙升 */
    tl.call(function() {
        var cw = document.getElementById('q2ChartWrap');
        cw.style.display = 'block';
        _q2Chart = echarts.init(document.getElementById('q2ChartEl'), 'dark');
        _q2Chart.setOption({
            backgroundColor: 'transparent',
            tooltip: { trigger: 'axis', backgroundColor: 'rgba(5,15,10,0.9)', borderColor: 'rgba(0,158,148,0.2)',
                       textStyle: { color: '#e0ffe8' } },
            legend: { top: '5%', textStyle: { color: 'rgba(0,210,168,0.6)', fontSize: 11 } },
            grid: { left: '10%', right: '10%', top: '18%', bottom: '12%' },
            animationDuration: 1200, animationEasing: 'cubicOut',
            xAxis: { type: 'category', data: DAIRY.capex.years.map(String),
                     axisLabel: { color: 'rgba(0,210,168,0.6)' },
                     axisLine: { lineStyle: { color: 'rgba(0,158,148,0.15)' } },
                     axisTick: { show: false } },
            yAxis: [
                { type: 'value', name: '亿元', position: 'left',
                  axisLabel: { color: 'rgba(0,210,168,0.45)' },
                  splitLine: { lineStyle: { color: 'rgba(0,158,148,0.06)' } },
                  nameTextStyle: { color: 'rgba(0,158,148,0.5)' } },
                { type: 'value', name: '数量', position: 'right',
                  axisLabel: { color: 'rgba(0,210,168,0.45)' },
                  splitLine: { show: false },
                  nameTextStyle: { color: 'rgba(0,158,148,0.5)' } }
            ],
            series: [
                { name: '固定资产', type: 'bar', data: DAIRY.capex.fixedAssets,
                  itemStyle: { color: new echarts.graphic.LinearGradient(0,0,0,1,[
                    {offset:0,color:'rgba(0,210,168,0.9)'},{offset:1,color:'rgba(0,150,75,0.4)'}
                  ]), borderRadius: [4,4,0,0] }, barWidth: '35%',
                  animationDelay: function(idx) { return idx * 200; } },
                { name: '智慧牧场', type: 'line', yAxisIndex: 1,
                  data: DAIRY.capex.smartFarms, smooth: true,
                  lineStyle: { color: '#5098d8', width: 2.5, shadowColor: 'rgba(0,158,148,0.3)', shadowBlur: 8 },
                  itemStyle: { color: '#5098d8', borderWidth: 2 },
                  areaStyle: { color: new echarts.graphic.LinearGradient(0,0,0,1,[
                    {offset:0,color:'rgba(0,158,148,0.15)'},{offset:1,color:'rgba(0,158,148,0)'}
                  ]) },
                  symbol: 'circle', symbolSize: 7 },
                { name: '全自动工厂', type: 'line', yAxisIndex: 1,
                  data: DAIRY.capex.autoFactories, smooth: true,
                  lineStyle: { color: '#00d4aa', width: 2.5, shadowColor: 'rgba(0,210,168,0.3)', shadowBlur: 8 },
                  itemStyle: { color: '#00d4aa', borderWidth: 2 },
                  areaStyle: { color: new echarts.graphic.LinearGradient(0,0,0,1,[
                    {offset:0,color:'rgba(0,210,168,0.12)'},{offset:1,color:'rgba(0,210,168,0)'}
                  ]) },
                  symbol: 'circle', symbolSize: 7 }
            ]
        });
        gsap.to(cw, { opacity: 1, duration: 1 });
    }, [], 7);

    aoInsight.textContent = Q2_ACTS[2].insight;
    tl.to(aoInsight, { opacity: 0.7, duration: 1 }, 10);
}

/* ══════════════════════════════════════════
   第三幕 — 白色大动脉 (Cold-Chain Speed)
   Globe.gl 冷链线路从呼和浩特辐射全国
   Canvas叠层：速度粒子流 + 计时器
   ══════════════════════════════════════════ */
function q2Act3(hasGsap, hasWorld) {
    _q2Cleanup();
    _q2ShowOv('第三幕', '白色大动脉');

    /* 先确保Globe容器可见（透明），再设置相机 */
    var gv = document.getElementById('globeViz');
    gv.style.transition = 'none';
    gv.style.opacity = '0';
    gv.classList.add('cm-focus');

    /* Globe设置：聚焦中国 */
    var pov;
    if (hasWorld) {
        _applyDarkGlobeMaterial();
        world.showAtmosphere(true);
        world.atmosphereColor('rgba(0,160,200,0.15)');
        world.atmosphereAltitude(0.25);
        world.arcsData([]).pointsData([]).htmlElementsData([]).ringsData([]);
        if (typeof loadedPaths !== 'undefined' && loadedPaths) world.pathsData(loadedPaths);
        world.controls().autoRotate = false;
        
        world.pointOfView({ lat: 35, lng: 108, altitude: 1.8 }, 1500);
        
        pov = { lat: 35, lng: 108, altitude: 1.8 };
    }

    /* 延迟淡入 */
    setTimeout(function() {
        gv.style.transition = 'opacity 1s';
        gv.style.opacity = '1';
    }, 200);

    /* 逐条射出冷链弧线 */
    var routes = DAIRY.coldChain.routes;
    var curArcs = [];
    var curPoints = [];

    if (!hasGsap) return;
    var tl = gsap.timeline();
    _q2TL = tl;

    var aoTitle = document.getElementById('q2Title');
    var aoInsert = document.getElementById('q2Insight');
    var kpiRow = document.getElementById('q2KpiRow');
    var counter = document.getElementById('q2Counter');

    tl.to(aoTitle, { opacity: 1, duration: 1.2 }, 0);
    tl.to(aoTitle, { opacity: 0, y: -40, duration: 0.8 }, 2.5);

    /* KPI */
    _q2BuildKpi([
        { id: 'q2K1', val: '0', lbl: '公里 · 最远线路', cls: 'ao-kpi-blue' },
        { id: 'q2K2', val: '0', lbl: '辆 · 冷链车队', cls: 'ao-kpi-gold' },
        { id: 'q2K3', val: '0', lbl: '城市 · 覆盖', cls: 'ao-kpi-red' }
    ]);
    tl.to(kpiRow, { opacity: 1, duration: 0.8 }, 3);
    tl.to(counter, { opacity: 0.8, duration: 0.5 }, 3);

    var kObj = { km: 0, trucks: 0, cities: 0 };
    tl.to(kObj, {
        km: 3200, trucks: 15000, cities: 380, duration: 3, ease: 'power1.out',
        onUpdate: function() {
            var e1 = document.getElementById('q2K1');
            var e2 = document.getElementById('q2K2');
            var e3 = document.getElementById('q2K3');
            if (e1) e1.textContent = Math.round(kObj.km).toLocaleString();
            if (e2) e2.textContent = Math.round(kObj.trucks).toLocaleString();
            if (e3) e3.textContent = Math.round(kObj.cities);
        }
    }, 3.3);

    /* 逐条射出弧线 */
    routes.forEach(function(route, idx) {
        tl.call(function() {
            if (!q2Active) return;
            curArcs.push({
                startLat: route.latF, startLng: route.lngF,
                endLat: route.latT, endLng: route.lngT,
                color: ['rgba(255,255,255,0.6)', 'rgba(77,171,255,0.2)'],
                stroke: 1.5,
                dashLength: 0.4, dashGap: 0.2,
                dashAnimateTime: 2000
            });
            curPoints.push({
                lat: route.latT, lng: route.lngT,
                size: 0.4, color: '#4dabff',
                label: route.to
            });

            if (hasWorld) {
                world.arcsData(curArcs.slice());
                world.arcColor('color').arcStroke('stroke')
                     .arcDashLength('dashLength').arcDashGap('dashGap')
                     .arcDashAnimateTime('dashAnimateTime');
                world.pointsData(curPoints.slice());
                world.pointColor('color').pointAltitude(0.01).pointRadius('size');
            }

            counter.textContent = '冷链线路 ' + (idx + 1) + '/' + routes.length + ' · ' + route.from + ' → ' + route.to + ' · ' + route.km + 'km / ' + route.h + 'h';
        }, null, 3.5 + idx * 0.8);
    });

    /* ECharts: 到货时间对比 */
    var chartT = 3.5 + routes.length * 0.8 + 1;
    tl.call(function() {
        var cw = document.getElementById('q2ChartWrap');
        cw.style.display = 'block';
        _q2Chart = echarts.init(document.getElementById('q2ChartEl'), 'dark');

        var sortedRoutes = routes.slice().sort(function(a, b) { return a.h - b.h; });
        _q2Chart.setOption({
            backgroundColor: 'transparent',
            title: { text: '挤奶→上架 到货时间', left: 'center', top: '5%',
                     textStyle: { color: 'rgba(200,220,255,0.8)', fontSize: 14, fontWeight: 600 } },
            tooltip: { trigger: 'axis', backgroundColor: 'rgba(5,15,10,0.9)', borderColor: 'rgba(0,158,148,0.2)',
                       textStyle: { color: '#e0ffe8' } },
            grid: { left: '18%', right: '12%', top: '18%', bottom: '8%' },
            animationDuration: 1000, animationEasing: 'cubicOut',
            xAxis: { type: 'value', name: '小时',
                     axisLabel: { color: 'rgba(0,210,168,0.55)' },
                     splitLine: { lineStyle: { color: 'rgba(0,158,148,0.06)' } },
                     nameTextStyle: { color: 'rgba(0,158,148,0.5)' } },
            yAxis: { type: 'category',
                     data: sortedRoutes.map(function(r) { return r.to; }),
                     axisLabel: { color: 'rgba(0,210,168,0.7)', fontSize: 11 },
                     axisLine: { lineStyle: { color: 'rgba(0,158,148,0.12)' } } },
            series: [{
                type: 'bar', data: sortedRoutes.map(function(r) {
                    var h = r.h;
                    var color; 
                    if (h <= 12) color = new echarts.graphic.LinearGradient(0,0,1,0,[{offset:0,color:'rgba(80,220,120,0.3)'},{offset:1,color:'rgba(80,220,120,0.85)'}]);
                    else if (h <= 24) color = new echarts.graphic.LinearGradient(0,0,1,0,[{offset:0,color:'rgba(80,170,255,0.3)'},{offset:1,color:'rgba(80,170,255,0.85)'}]);
                    else if (h <= 36) color = new echarts.graphic.LinearGradient(0,0,1,0,[{offset:0,color:'rgba(0,158,148,0.3)'},{offset:1,color:'rgba(0,158,148,0.85)'}]);
                    else color = new echarts.graphic.LinearGradient(0,0,1,0,[{offset:0,color:'rgba(255,100,90,0.3)'},{offset:1,color:'rgba(255,100,90,0.85)'}]);
                    return { value: h, itemStyle: { color: color, borderRadius: [0,4,4,0] } };
                }),
                barWidth: '55%',
                label: { show: true, position: 'right', color: 'rgba(0,210,168,0.6)',
                         formatter: function(p) { return p.value + 'h'; }, fontSize: 11 },
                animationDelay: function(idx) { return idx * 120; }
            }]
        });
        gsap.to(cw, { opacity: 1, duration: 1 });
    }, [], chartT);

    aoInsert.textContent = Q2_ACTS[3].insight;
    tl.to(aoInsert, { opacity: 0.7, duration: 1 }, chartT + 2);
}

/* ══════════════════════════════════════════
   第四幕 — 万企吸附场 (Gravity Network)
   Canvas力导向图：乳业核心吸附15个产业节点
   ══════════════════════════════════════════ */
function q2Act4(hasGsap) {
    _q2Cleanup();
    _q2ShowOv('第四幕', '万企吸附场');

    /* 隐藏Globe */
    var gv = document.getElementById('globeViz');
    gv.classList.remove('cm-focus');
    gv.style.transition = 'opacity 0.8s';
    gv.style.opacity = '0';

    var cvs = document.getElementById('q2Canvas');
    cvs.style.display = 'block';
    cvs.style.opacity = '1';
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    cvs.width = window.innerWidth * dpr;
    cvs.height = window.innerHeight * dpr;
    cvs.style.width = window.innerWidth + 'px';
    cvs.style.height = window.innerHeight + 'px';
    var ctx = cvs.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    _q2Canvas = cvs; _q2Ctx = ctx;

    var W = window.innerWidth, H = window.innerHeight;
    var cx = W / 2, cy = H * 0.38;

    /* 构建节点：中心核心 + 15个产业链节点 */
    var nodes = DAIRY.cluster.nodes;
    var coreNode = { x: cx, y: cy, vx: 0, vy: 0, r: 40, label: '乳业核心', color: 'rgba(255,255,255,0.9)', type: 'core', fixed: true };

    /* 为每个产业节点分配初始位置（圆周外部随机散落） */
    var typeColors = { upstream: 'rgba(80,220,120,', midstream: 'rgba(0,210,168,', downstream: 'rgba(0,158,148,', support: 'rgba(180,140,250,' };
    var simNodes = nodes.map(function(n, i) {
        var angle = (Math.PI * 2 / nodes.length) * i + (Math.random() - 0.5) * 0.3;
        var dist = 250 + Math.random() * 150;
        var baseColor = typeColors[n.type] || 'rgba(255,255,255,';
        var r = 12 + Math.sqrt(n.val) * 0.8;
        return {
            x: cx + Math.cos(angle) * dist,
            y: cy + Math.sin(angle) * dist,
            tx: cx + Math.cos(angle) * (80 + r * 2 + i * 4),
            ty: cy + Math.sin(angle) * (80 + r * 2 + i * 4),
            vx: 0, vy: 0,
            r: r, label: n.name, color: baseColor,
            val: n.val, jobs: n.jobs, type: n.type,
            alpha: 0, arrived: false
        };
    });

    /* 动画：节点被"吸入" */
    var startT = performance.now();
    var pulled = false;
    var pullT = 2000;

    function draw(now) {
        if (!q2Active) return;
        var t = now - startT;
        ctx.clearRect(0, 0, W, H);

        /* 中心核心 — 脉冲光圈 */
        var pulse = 1 + Math.sin(t * 0.003) * 0.15;
        /* 外围光晕 */
        var grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreNode.r * pulse * 3);
        grad.addColorStop(0, 'rgba(0,210,168,0.2)');
        grad.addColorStop(0.3, 'rgba(60,140,255,0.08)');
        grad.addColorStop(0.6, 'rgba(40,100,220,0.03)');
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.beginPath();
        ctx.arc(cx, cy, coreNode.r * pulse * 3, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();
        /* 核心圆 */
        var coreGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreNode.r);
        coreGrad.addColorStop(0, 'rgba(255,255,255,0.2)');
        coreGrad.addColorStop(0.7, 'rgba(90,170,255,0.1)');
        coreGrad.addColorStop(1, 'rgba(60,130,220,0.05)');
        ctx.beginPath();
        ctx.arc(cx, cy, coreNode.r, 0, Math.PI * 2);
        ctx.fillStyle = coreGrad;
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,158,148,0.5)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        /* 呼吸光环 */
        ctx.strokeStyle = 'rgba(0,158,148,' + (0.1 + 0.08 * Math.sin(t * 0.002)).toFixed(3) + ')';
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.arc(cx, cy, coreNode.r * pulse * 1.5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.font = 'bold 12px system-ui';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('乳业核心', cx, cy);

        /* 引力吸附阶段 */
        if (t > pullT && !pulled) pulled = true;

        simNodes.forEach(function(nd, i) {
            /* 延迟出现 */
            var spawnDelay = 500 + i * 200;
            if (t < spawnDelay) return;
            nd.alpha = Math.min(1, nd.alpha + 0.03);

            if (pulled) {
                /* 向目标位置运动 */
                var dx = nd.tx - nd.x;
                var dy = nd.ty - nd.y;
                var dist = Math.sqrt(dx * dx + dy * dy);
                if (dist > 2) {
                    nd.x += dx * 0.04;
                    nd.y += dy * 0.04;
                } else {
                    nd.arrived = true;
                }
            }

            /* 连线到核心 */
            if (nd.alpha > 0.3) {
                ctx.beginPath();
                ctx.moveTo(cx, cy);
                ctx.lineTo(nd.x, nd.y);
                ctx.strokeStyle = nd.color + (nd.arrived ? '0.35)' : '0.15)');
                ctx.lineWidth = nd.arrived ? 1.2 : 0.6;
                ctx.stroke();

                /* 流动粒子 */
                if (nd.arrived) {
                    var flowT = (t * 0.001 + i * 0.7) % 1;
                    var fx = cx + (nd.x - cx) * flowT;
                    var fy = cy + (nd.y - cy) * flowT;
                    ctx.beginPath();
                    ctx.arc(fx, fy, 2.5, 0, Math.PI * 2);
                    ctx.fillStyle = nd.color + '0.7)';
                    ctx.fill();
                    /* 第二粒子 */
                    var flowT2 = (t * 0.001 + i * 0.7 + 0.5) % 1;
                    var fx2 = cx + (nd.x - cx) * flowT2;
                    var fy2 = cy + (nd.y - cy) * flowT2;
                    ctx.beginPath();
                    ctx.arc(fx2, fy2, 1.5, 0, Math.PI * 2);
                    ctx.fillStyle = nd.color + '0.4)';
                    ctx.fill();
                }
            }

            /* 节点圆 — 发光填充 */
            var nodeGrad = ctx.createRadialGradient(nd.x, nd.y, 0, nd.x, nd.y, nd.r * 1.5);
            nodeGrad.addColorStop(0, nd.color + (0.25 * nd.alpha) + ')');
            nodeGrad.addColorStop(0.7, nd.color + (0.1 * nd.alpha) + ')');
            nodeGrad.addColorStop(1, nd.color + '0)');
            ctx.beginPath();
            ctx.arc(nd.x, nd.y, nd.r * 1.5, 0, Math.PI * 2);
            ctx.fillStyle = nodeGrad;
            ctx.fill();
            ctx.beginPath();
            ctx.arc(nd.x, nd.y, nd.r, 0, Math.PI * 2);
            ctx.fillStyle = nd.color + (0.2 * nd.alpha) + ')';
            ctx.fill();
            ctx.strokeStyle = nd.color + (0.7 * nd.alpha) + ')';
            ctx.lineWidth = 1.2;
            ctx.stroke();

            /* 标签 */
            if (nd.alpha > 0.5) {
                ctx.fillStyle = 'rgba(230,240,255,' + (0.85 * nd.alpha) + ')';
                ctx.font = '11px system-ui';
                ctx.textAlign = 'center';
                ctx.fillText(nd.label, nd.x, nd.y - nd.r - 8);
                ctx.fillStyle = 'rgba(180,210,240,' + (0.6 * nd.alpha) + ')';
                ctx.font = '10px system-ui';
                ctx.fillText(nd.val + '亿', nd.x, nd.y + 4);
            }
        });

        /* 中心总数 */
        if (t > pullT + 3000) {
            ctx.save();
            ctx.shadowColor = 'rgba(0,158,148,0.4)';
            ctx.shadowBlur = 15;
            ctx.fillStyle = 'rgba(210,230,255,0.7)';
            ctx.font = '600 12px system-ui';
            ctx.textAlign = 'center';
            ctx.fillText('产业集群 · ' + DAIRY.cluster.totalClusterGDP + '亿', cx, cy + coreNode.r + 20);
            ctx.fillText('乘数效应 × ' + DAIRY.cluster.multiplier, cx, cy + coreNode.r + 38);
            ctx.restore();
        }

        _q2AnimId = requestAnimationFrame(draw);
    }
    _q2AnimId = requestAnimationFrame(draw);

    if (!hasGsap) return;
    var tl = gsap.timeline();
    _q2TL = tl;

    var aoTitle = document.getElementById('q2Title');
    var aoInsight = document.getElementById('q2Insight');
    var kpiRow = document.getElementById('q2KpiRow');
    var counter = document.getElementById('q2Counter');

    tl.to(aoTitle, { opacity: 1, duration: 1.2 }, 0);
    tl.to(aoTitle, { opacity: 0, y: -40, duration: 0.8 }, 2.5);

    /* KPI */
    _q2BuildKpi([
        { id: 'q2K1', val: '0', lbl: '家 · 关联企业', cls: 'ao-kpi-blue' },
        { id: 'q2K2', val: '0', lbl: '亿 · 集群GDP', cls: 'ao-kpi-gold' },
        { id: 'q2K3', val: '0', lbl: '× 乘数效应', cls: 'ao-kpi-red' }
    ]);
    tl.to(kpiRow, { opacity: 1, duration: 0.8 }, 4);
    tl.to(counter, { opacity: 0.8, duration: 0.5 }, 4);

    var kObj = { ent: 0, gdp: 0, mult: 1 };
    tl.to(kObj, {
        ent: DAIRY.cluster.enterprises, gdp: DAIRY.cluster.totalClusterGDP, mult: DAIRY.cluster.multiplier,
        duration: 3.5, ease: 'power1.out',
        onUpdate: function() {
            var e1 = document.getElementById('q2K1');
            var e2 = document.getElementById('q2K2');
            var e3 = document.getElementById('q2K3');
            if (e1) e1.textContent = Math.round(kObj.ent).toLocaleString();
            if (e2) e2.textContent = Math.round(kObj.gdp).toLocaleString();
            if (e3) e3.textContent = kObj.mult.toFixed(1);
        }
    }, 4.3);

    /* ECharts: 产业链节点价值图 */
    tl.to(cvs, { opacity: 0, duration: 1.5 }, 7);
    tl.call(function() {
        var cw = document.getElementById('q2ChartWrap');
        cw.style.display = 'block';
        _q2Chart = echarts.init(document.getElementById('q2ChartEl'), 'dark');

        var sorted = nodes.slice().sort(function(a, b) { return b.val - a.val; });
        var tGrads = {
            upstream: [new echarts.graphic.LinearGradient(0,0,1,0,[{offset:0,color:'rgba(60,200,100,0.9)'},{offset:1,color:'rgba(100,240,140,0.6)'}]),'rgba(60,200,100,0.4)'],
            midstream: [new echarts.graphic.LinearGradient(0,0,1,0,[{offset:0,color:'rgba(60,160,255,0.9)'},{offset:1,color:'rgba(120,200,255,0.6)'}]),'rgba(60,160,255,0.4)'],
            downstream: [new echarts.graphic.LinearGradient(0,0,1,0,[{offset:0,color:'rgba(240,190,40,0.9)'},{offset:1,color:'rgba(255,220,80,0.6)'}]),'rgba(240,190,40,0.4)'],
            support: [new echarts.graphic.LinearGradient(0,0,1,0,[{offset:0,color:'rgba(160,120,240,0.9)'},{offset:1,color:'rgba(200,170,255,0.6)'}]),'rgba(160,120,240,0.4)']
        };
        _q2Chart.setOption({
            backgroundColor: 'transparent',
            title: { text: '乳业产业链节点产值', left: 'center', top: '5%',
                     textStyle: { color: 'rgba(220,235,255,0.85)', fontSize: 14, fontWeight: 600 } },
            tooltip: { trigger: 'axis', backgroundColor: 'rgba(5,15,10,0.92)', borderColor: 'rgba(0,158,148,0.25)', borderWidth: 1,
                       textStyle: { color: '#d0e0f0', fontSize: 12 },
                       formatter: function(p) { return '<span style="color:#78c8ff;font-weight:600">' + p[0].name + '</span><br/>产值: ' + p[0].value + '亿<br/>就业: ' + sorted[p[0].dataIndex].jobs + '万人'; } },
            grid: { left: '22%', right: '12%', top: '18%', bottom: '8%' },
            xAxis: { type: 'value', name: '亿元',
                     axisLabel: { color: 'rgba(200,215,235,0.6)', fontSize: 11 },
                     splitLine: { lineStyle: { color: 'rgba(0,158,148,0.06)' } },
                     nameTextStyle: { color: 'rgba(200,215,235,0.5)' } },
            yAxis: { type: 'category',
                     data: sorted.map(function(n) { return n.name; }),
                     axisLabel: { color: 'rgba(220,235,255,0.75)', fontSize: 11 },
                     axisLine: { lineStyle: { color: 'rgba(0,158,148,0.12)' } } },
            series: [{
                type: 'bar',
                data: sorted.map(function(n, i) {
                    var g = tGrads[n.type] || [new echarts.graphic.LinearGradient(0,0,1,0,[{offset:0,color:'rgba(200,200,200,0.8)'},{offset:1,color:'rgba(200,200,200,0.4)'}]),'rgba(200,200,200,0.3)'];
                    return { value: n.val, itemStyle: { color: g[0], borderRadius: [0,4,4,0] }, emphasis: { itemStyle: { shadowBlur: 12, shadowColor: g[1] } } };
                }),
                barWidth: '55%',
                label: { show: true, position: 'right', color: 'rgba(220,235,255,0.7)',
                         formatter: function(p) { return p.value + '亿'; }, fontSize: 11 },
                animationDelay: function(i) { return i * 100; },
                animationDuration: 800,
                animationEasing: 'cubicOut'
            }],
            animationDuration: 800,
            animationEasing: 'cubicOut'
        });
        gsap.to(cw, { opacity: 1, duration: 1 });
    }, [], 8);

    aoInsight.textContent = Q2_ACTS[4].insight;
    tl.to(aoInsight, { opacity: 0.7, duration: 1 }, 11);
}

/* ══════════════════════════════════════════
   终章 — 打字机总结 + 结束按钮
   ══════════════════════════════════════════ */
function q2ActFinal(hasGsap) {
    _q2Cleanup();
    _q2ShowOv('终章', '白色帝国');

    /* 隐藏Globe */
    var gv = document.getElementById('globeViz');
    gv.classList.remove('cm-focus');
    gv.style.transition = 'opacity 0.8s';
    gv.style.opacity = '0';

    if (!hasGsap) return;
    var tl = gsap.timeline();
    _q2TL = tl;

    var aoTitle = document.getElementById('q2Title');
    var twEl = document.getElementById('q2Typewriter');
    var endBtns = document.getElementById('q2EndBtns');

    tl.to(aoTitle, { opacity: 1, duration: 1.5 }, 0);
    tl.to(aoTitle, { opacity: 0, y: -30, duration: 0.8 }, 3);

    tl.call(function() {
        twEl.style.display = 'block';
        twEl.style.opacity = '1';
        twEl.innerHTML = '<div class="ao-typewriter-inner" id="q2TwInner"></div>';
        var inner = document.getElementById('q2TwInner');
        _q2TypeWriter(DAIRY.finalText, inner, 0);
    }, [], 4);
}

/* ══════════════════════════════════════════
   编排层：enterQ2Mode / exitQ2Mode / playQ2Act
   ══════════════════════════════════════════ */
function enterQ2Mode() {
    if (appStarted) return;
    appStarted = true;
    q2Active = true;
    q2CurrentAct = 0;

    /* 隐藏landing（跟Q1同样使用landing-exit class） */
    if (typeof stopSphereAnim === 'function') stopSphereAnim();
    var lp = document.getElementById('landingPage');
    lp.classList.add('landing-exit');

    setTimeout(function() {
        lp.style.display = 'none';

        /* 显示Q2电影模式 */
        var q2Wrap = document.getElementById('q2CinematicMode');
        q2Wrap.style.display = 'block';
        setTimeout(function() { q2Wrap.style.opacity = '1'; }, 50);

        /* Globe初始状态 */
        document.getElementById('globeViz').style.opacity = '0';

        /* 显示Home按钮 */
        var hb = document.getElementById('homeBtn');
        if (hb) hb.style.display = '';

        /* 进度点 */
        _q2InitProgress();

        playQ2Act(0);
    }, 900);
}

function exitQ2Mode() {
    q2Active = false;
    _q2Cleanup();

    var q2Wrap = document.getElementById('q2CinematicMode');
    q2Wrap.style.transition = 'opacity 0.6s';
    q2Wrap.style.opacity = '0';
    setTimeout(function() { q2Wrap.style.display = 'none'; }, 600);

    /* 恢复Globe + 交互控制 */
    var gv = document.getElementById('globeViz');
    gv.classList.remove('cm-focus');
    gv.style.opacity = '0';
    if (typeof world !== 'undefined' && world.controls) {
        world.controls().enabled = true;
        world.controls().enableRotate = true;
    }

    appStarted = false;
}

function _q2ReturnToGallery() {
    exitQ2Mode();
    /* 回到landing（复用Q1的_returnToGallery逻辑） */
    setTimeout(function() {
        var lp = document.getElementById('landingPage');
        lp.style.display = '';
        lp.classList.remove('landing-exit');
        lp.style.opacity = '0';
        var animItems = lp.querySelectorAll('.land-typo-bg,.land-questions,.land-logo,.land-idx,.land-bottom-line,.land-bottom-hint,.land-vert-divide,.land-mongol-deco,.land-right-info,.land-sky-glow,.land-grass-glow,.land-corner,.land-khamr,.land-hee-border');
        animItems.forEach(function(el) { el.style.animation = 'none'; });
        void lp.offsetHeight;
        animItems.forEach(function(el) { el.style.animation = ''; });
        setTimeout(function() {
            lp.style.transition = 'opacity .6s ease';
            lp.style.opacity = '1';
            if (typeof startSphereAnim === 'function') startSphereAnim();
        }, 50);
        appStarted = false;
    }, 700);
}

function _q2InitProgress() {
    var bar = document.getElementById('q2Progress');
    if (!bar) return;
    bar.innerHTML = '';
    Q2_ACTS.forEach(function(act, i) {
        var dot = document.createElement('div');
        dot.className = 'cm-dot' + (i === 0 ? ' active' : '');
        dot.setAttribute('data-idx', i);
        bar.appendChild(dot);
    });
}

function playQ2Act(idx) {
    if (idx < 0 || idx >= Q2_ACTS.length) return;
    _q2Cleanup();
    q2CurrentAct = idx;

    /* 更新进度点 */
    var dots = document.querySelectorAll('#q2Progress .cm-dot');
    dots.forEach(function(d, i) { d.classList.toggle('active', i === idx); });

    /* 黑屏过渡 */
    var overlay = document.getElementById('q2Overlay');
    overlay.style.opacity = '0';
    setTimeout(function() {
        overlay.style.opacity = '1';
        var hasGsap = typeof gsap !== 'undefined';
        var hasWorld = typeof world !== 'undefined' && world;
        switch (idx) {
            case 0: q2Act0(hasGsap); break;
            case 1: q2Act1(hasGsap); break;
            case 2: q2Act2(hasGsap); break;
            case 3: q2Act3(hasGsap, hasWorld); break;
            case 4: q2Act4(hasGsap); break;
            case 5: q2ActFinal(hasGsap); break;
        }
    }, 400);
}

/* 事件绑定 (DOM ready 后自动执行) */
(function _q2BindEvents() {
    function bind() {
        var nextBtn = document.getElementById('q2Next');
        var exitBtn = document.getElementById('q2Exit');
        var endExplore = document.getElementById('q2EndExplore');
        var endMore = document.getElementById('q2EndMore');

        if (nextBtn) nextBtn.addEventListener('click', function() {
            if (q2CurrentAct < Q2_ACTS.length - 1) {
                playQ2Act(q2CurrentAct + 1);
            }
        });
        if (exitBtn) exitBtn.addEventListener('click', function() {
            exitQ2Mode();
        });
        if (endExplore) endExplore.addEventListener('click', function() {
            exitQ2Mode();
            /* 进入自由探索（与Q1一致：显示Globe + HUD面板） */
            setTimeout(function() {
                var gv = document.getElementById('globeViz');
                gv.style.transition = 'opacity 0.8s';
                gv.style.opacity = '1';
                if (typeof refreshArcs === 'function') refreshArcs();
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
                document.querySelectorAll('.nav-btn').forEach(function(b) { b.classList.remove('active'); });
                var firstNav = document.querySelector('.nav-btn[data-page="1"]');
                if (firstNav) firstNav.classList.add('active');
                if (typeof currentPage !== 'undefined') currentPage = 1;
            }, 650);
        });
        if (endMore) endMore.addEventListener('click', function() {
            _q2ReturnToGallery();
        });
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bind);
    } else {
        bind();
    }
})();
