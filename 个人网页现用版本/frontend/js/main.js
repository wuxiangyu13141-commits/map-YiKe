/* ══════════════════════════════════════════
   main.js - Landing + Home按钮 + 光标
   ══════════════════════════════════════════ */
'use strict';
/* ══════════════════════════════════════════
   ██  Landing — 纯黑无动画                  ██
   ══════════════════════════════════════════ */
var landingPage = document.getElementById('landingPage');

if (landingPage) {
    document.querySelector('.hud').style.display = 'none';
    document.querySelector('.right-panel').style.display = 'none';
    document.querySelector('.timeline').style.display = 'none';
    document.getElementById('viewSwitch').style.display = 'none';
    document.getElementById('globeViz').style.opacity = '0';
}

var appStarted = false;
function enterFreeExplore() {
    if (appStarted) return;
    appStarted = true;
    landingPage.classList.add('landing-exit');
    setTimeout(function() {
        landingPage.style.display = 'none';
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
        document.getElementById('globeViz').style.transition = 'opacity .8s ease';
        document.getElementById('globeViz').style.opacity = '1';
        /* 确保地球旋转控制已启用 */
        if (typeof world !== 'undefined' && world.controls) {
            world.controls().enabled = true;
            world.controls().enableRotate = true;
        }
        if (typeof _applyDarkGlobeMaterial === 'function') _applyDarkGlobeMaterial();
        /* 启用蓝色透明大气层 */
        if (typeof world !== 'undefined') {
            world.showAtmosphere(true);
            world.atmosphereColor('rgba(96,138,162,0.11)');
            world.atmosphereAltitude(0.22);
            if (typeof refreshArcs === 'function') refreshArcs();
            if (typeof loadedPaths !== 'undefined' && loadedPaths) world.pathsData(loadedPaths);
        }
    }, 500);
}

/* 首页自由探索按钮 */
var landFreeExploreBtn = document.getElementById('landFreeExplore');
if (landFreeExploreBtn) {
    landFreeExploreBtn.addEventListener('click', function() {
        enterFreeExplore();
    });
}

/* ══════════════════════════════════════════
   科技光标跟随光圈
   ══════════════════════════════════════════ */
var glow = document.getElementById('cursorGlow');
var dot = document.getElementById('cursorDot');
var glowX = 0, glowY = 0, targetX = 0, targetY = 0;
var isOnGlobe = false;

document.addEventListener('mousemove', function(e) {
    targetX = e.clientX; targetY = e.clientY;
    dot.style.left = e.clientX + 'px';
    dot.style.top = e.clientY + 'px';
});

/* 平滑跟随动画 */
function animateCursor() {
    glowX += (targetX - glowX) * 0.15;
    glowY += (targetY - glowY) * 0.15;
    glow.style.left = glowX + 'px';
    glow.style.top = glowY + 'px';
    requestAnimationFrame(animateCursor);
}
animateCursor();

document.getElementById('globeViz').addEventListener('mouseenter', function() {
    isOnGlobe = true;
    glow.classList.add('visible');
    dot.classList.add('visible');
});
document.getElementById('globeViz').addEventListener('mouseleave', function() {
    isOnGlobe = false;
    glow.classList.remove('visible', 'hover', 'click');
    dot.classList.remove('visible');
});

/* 悬停在弧线/点上时光圈放大 — 已集成到上方 onPointHover/onArcHover */

/* 点击脉冲 */
document.getElementById('globeViz').addEventListener('mousedown', function() {
    glow.classList.add('click');
});
document.addEventListener('mouseup', function() {
    glow.classList.remove('click');
});

/* ══════════════════════════════════════════
   Landing 问题列表 — 无限滚动 + 聚光灯
   首尾相连，中心卡片高亮，上下渐暗
   ══════════════════════════════════════════ */
(function() {
    var scroller = document.querySelector('.land-q-scroll');
    if (!scroller) return;
    var origCards = Array.prototype.slice.call(scroller.querySelectorAll('.land-q'));
    var N = origCards.length;
    if (!N) return;

    /* ── 克隆前后各一组，形成 3N 卡片 ── */
    var frag1 = document.createDocumentFragment();
    var frag2 = document.createDocumentFragment();
    for (var ci = 0; ci < N; ci++) {
        var c1 = origCards[ci].cloneNode(true);
        var c2 = origCards[ci].cloneNode(true);
        c1.classList.add('land-q--clone');
        c2.classList.add('land-q--clone');
        frag1.appendChild(c1);
        frag2.appendChild(c2);
    }
    scroller.insertBefore(frag1, scroller.firstChild);
    scroller.appendChild(frag2);

    var allCards = Array.prototype.slice.call(scroller.querySelectorAll('.land-q'));
    var totalCards = allCards.length;  /* 3N */

    /* ── 初始化滚到中间那组的第一张 ── */
    var jumpLock = false;
    function getCardH() {
        if (!allCards[0]) return 80;
        return allCards[0].offsetHeight + parseFloat(getComputedStyle(allCards[0]).marginTop || 0)
             + parseFloat(getComputedStyle(allCards[0]).marginBottom || 0);
    }
    function jumpToMid() {
        jumpLock = true;
        /* 把滚动位置设到中间组起始 */
        var oneSetH = 0;
        for (var k = 0; k < N; k++) oneSetH += allCards[k].offsetHeight + 1;
        scroller.scrollTop = oneSetH;
        jumpLock = false;
    }
    setTimeout(jumpToMid, 100);

    /* ── 聚光灯（连续渐变） ── */
    var FADE_RANGE = 320; /* 从中心到完全暗的像素距离 */
    function updateSpotlight() {
        var rect = scroller.getBoundingClientRect();
        var centerY = rect.top + rect.height * 0.5;
        var bestIdx = 0, bestDist = Infinity;
        for (var i = 0; i < totalCards; i++) {
            var cr = allCards[i].getBoundingClientRect();
            var mid = cr.top + cr.height * 0.5;
            var dist = Math.abs(mid - centerY);
            if (dist < bestDist) { bestDist = dist; bestIdx = i; }
            /* 连续衰减：0(中心)→1(边缘) */
            var t = Math.min(dist / FADE_RANGE, 1);
            var ease = t * t; /* 二次缓出，中心附近衰减慢 */
            var op = 1 - ease * 0.8;          /* 1 → 0.2 */
            var br = 1 - ease * 0.6;          /* 1 → 0.4 */
            var sc = 1 - ease * 0.05;         /* 1 → 0.95 */
            allCards[i].style.opacity = op.toFixed(3);
            allCards[i].style.filter = 'brightness(' + br.toFixed(3) + ')';
            allCards[i].style.transform = 'scale(' + sc.toFixed(4) + ')';
        }
        for (var j = 0; j < totalCards; j++) {
            allCards[j].classList.remove('land-q--spot');
        }
        allCards[bestIdx].classList.add('land-q--spot');
    }

    /* ── 无限滚动：边界回弹 ── */
    function checkLoop() {
        if (jumpLock) return;
        var oneSetH = 0;
        for (var k = 0; k < N; k++) oneSetH += allCards[k].offsetHeight + 1;
        var st = scroller.scrollTop;
        if (st < oneSetH * 0.3) {
            jumpLock = true;
            scroller.scrollTop = st + oneSetH;
            jumpLock = false;
        } else if (st > oneSetH * 1.7) {
            jumpLock = true;
            scroller.scrollTop = st - oneSetH;
            jumpLock = false;
        }
    }

    scroller.addEventListener('scroll', function() {
        if (!jumpLock) {
            updateSpotlight();
            checkLoop();
        }
    }, { passive: true });

    setTimeout(updateSpotlight, 600);

    /* ── 待开放卡片点击反馈 ── */
    scroller.addEventListener('click', function(e) {
        var card = e.target.closest('.land-q--pending');
        if (!card) return;
        e.preventDefault();
        e.stopPropagation();
        /* 已有toast就不重复创建 */
        if (card.querySelector('.land-q-toast')) return;
        var toast = document.createElement('div');
        toast.className = 'land-q-toast';
        toast.textContent = '🔒 敬请期待';
        card.appendChild(toast);
        setTimeout(function() { toast.classList.add('show'); }, 10);
        setTimeout(function() {
            toast.classList.remove('show');
            setTimeout(function() { if (toast.parentNode) toast.remove(); }, 400);
        }, 1600);
    });
})();