/* ══════════════════════════════════════════
   intro.js — 叙事式开场
   Phase 0: Logo 视频 → Phase 2: 叙事文字 + 加载条 → 揭幕 Landing
   ══════════════════════════════════════════ */
'use strict';
(function() {
    var overlay = document.getElementById('introOverlay');
    if (!overlay) return;

    /* 隐藏 landing + 暂停 globe 渲染节省 GPU */
    var landingPage = document.getElementById('landingPage');
    if (landingPage) landingPage.style.visibility = 'hidden';
    var globeEl = document.getElementById('globeViz');
    if (globeEl) globeEl.style.display = 'none';
    /* 隐藏浮动面板，防止闪烁 */
    var page3Right = document.getElementById('page3Right');
    if (page3Right) page3Right.style.display = 'none';
    /* 视频期间隐藏 overlay 减轻合成压力 */
    overlay.style.display = 'none';

    /* ══ Phase 0: Logo 视频 ══ */
    var logoPhase = document.getElementById('introLogoPhase');
    var logoVideo = document.getElementById('introLogoVideo');
    var logoFlash = document.getElementById('introLogoFlash');
    var logoSkip  = document.getElementById('introLogoSkip');

    var phase2   = document.getElementById('introPhase2');
    var loadFill = document.getElementById('introLoadFill');
    var loadText = document.getElementById('introLoadText');
    var skipBtn  = document.getElementById('introSkipBtn');
    var narrative= document.getElementById('introNarrative');

    /* 叙事区先隐藏 */
    if (phase2) phase2.style.opacity = '0';

    var logoPhaseEnded = false;
    var scriptsLoaded = false;   /* 重型脚本是否已全部加载 */

    /* ── 动态顺序加载重型脚本（视频结束后才执行，避免阻塞主线程） ── */
    var deferredScripts = [
        'https://cdn.jsdelivr.net/npm/globe.gl@2.33.0/dist/globe.gl.min.js',
        'https://cdn.jsdelivr.net/npm/topojson-client@3/dist/topojson-client.min.js',
        'js/director.js?v=20250701',
        'js/dairy.js?v=20250701',
        'js/globe.js?v=20250701',
        'js/pages.js?v=20250701',
        'js/main.js?v=20250701'
    ];
    var scriptsLoadedCount = 0;

    function loadScriptsSequentially(list, idx, cb) {
        if (idx >= list.length) { cb(); return; }
        var s = document.createElement('script');
        s.src = list[idx];
        s.onload = s.onerror = function() {
            scriptsLoadedCount++;
            loadScriptsSequentially(list, idx + 1, cb);
        };
        document.body.appendChild(s);
    }

    function beginScriptLoading() {
        loadScriptsSequentially(deferredScripts, 0, function() {
            scriptsLoaded = true;
        });
    }

    function endLogoPhase() {
        if (logoPhaseEnded) return;
        logoPhaseEnded = true;

        /* 视频暂停 */
        if (logoVideo) {
            logoVideo.pause();
        }

        /* 开始加载重型脚本（此时视频已停止，主线程空闲） */
        beginScriptLoading();

        /* 先恢复 overlay（黑底 z-index:9999）挡住下方元素，再让 logo(z:10000) 淡出 */
        overlay.style.display = '';

        /* logo层直接淡出，无闪光 */
        if (logoPhase) logoPhase.classList.add('logo-out');
        setTimeout(function() {
            if (logoPhase) logoPhase.style.display = 'none';
            if (logoVideo) { logoVideo.removeAttribute('src'); logoVideo.load(); }
            startPhase2();
        }, 800);
    }

    /* 视频播放  */
    if (logoVideo && logoPhase) {
        /* 等待视频缓冲足够后再播放，避免开头卡顿 */
        function tryPlay() {
            logoVideo.classList.add('vid-show');
            logoVideo.play().catch(function() {
                /* 有声自动播放被阻止 → 静音重试 */
                logoVideo.muted = true;
                logoVideo.play().catch(function() {
                    /* 仍失败，直接跳到叙事 */
                    endLogoPhase();
                });
            });
        }

        if (logoVideo.readyState >= 4) {
            /* 已经缓冲就绪 */
            setTimeout(tryPlay, 100);
        } else {
            logoVideo.addEventListener('canplaythrough', function onReady() {
                logoVideo.removeEventListener('canplaythrough', onReady);
                tryPlay();
            });
            /* 超时保底：2秒后如果还没ready也开始播放 */
            setTimeout(function() {
                if (!logoVideo.classList.contains('vid-show')) tryPlay();
            }, 2000);
        }

        /* 视频播放结束 → 过渡到叙事 */
        logoVideo.addEventListener('ended', function() {
            endLogoPhase();
        });

        /* Skip 按钮 */
        if (logoSkip) {
            logoSkip.addEventListener('click', function() {
                endLogoPhase();
            });
        }
    } else {
        /* 无视频元素，直接启动叙事 */
        if (logoPhase) logoPhase.style.display = 'none';
        setTimeout(startPhase2Init, 100);
    }

    function startPhase2Init() {
        beginScriptLoading();
        overlay.style.display = '';
        if (phase2) phase2.style.opacity = '1';
        canvas.style.display = '';
        animRunning = true; renderLoop();
        smokeIntensity = 1;
        setTimeout(function() {
            startNarrative();
            startLoader();
        }, 600);
    }

    function startPhase2() {
        overlay.style.display = '';
        if (phase2) {
            phase2.style.transition = 'opacity .8s ease';
            phase2.style.opacity = '1';
        }
        canvas.style.display = '';
        animRunning = true; renderLoop();
        smokeIntensity = 1;
        setTimeout(function() {
            startNarrative();
            startLoader();
        }, 400);
    }

    /* ══════════════════════════════════════
       烟雾/极光 Canvas — 大团烟雾粒子
       ══════════════════════════════════════ */
    var canvas = document.getElementById('introCanvas');
    canvas.style.display = 'none';   /* 视频期间隐藏，Phase 2 时恢复 */
    var ctx = canvas.getContext('2d');
    var W, H;
    var smokeParticles = [];
    var auroraT = 0;
    var animRunning = false;  /* 视频期间不跑 canvas，Phase 2 再启动 */
    var smokeIntensity = 0.3;
    var revealProgress = 0;

    function resize() {
        W = canvas.width = window.innerWidth;
        H = canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    /* ── 烟雾粒子 ── */
    function SmokeP() {
        this.reset();
    }
    SmokeP.prototype.reset = function() {
        this.x = Math.random() * W;
        this.y = H + Math.random() * 200;
        this.r = Math.random() * 120 + 60;
        this.vx = (Math.random() - 0.5) * 0.6;
        this.vy = -(Math.random() * 0.8 + 0.3);
        this.alpha = Math.random() * 0.06 + 0.02;
        this.life = 1;
        this.decay = Math.random() * 0.001 + 0.0005;
        var colors = [
            [0, 229, 255],
            [0, 255, 204],
            [100, 180, 220],
            [180, 200, 220]
        ];
        var c = colors[Math.floor(Math.random() * colors.length)];
        this.cr = c[0]; this.cg = c[1]; this.cb = c[2];
    };

    for (var i = 0; i < 60; i++) {
        var sp = new SmokeP();
        sp.y = Math.random() * H;
        sp.life = Math.random();
        smokeParticles.push(sp);
    }

    /* ── 极光波浪 ── */
    function drawAurora(t, intensity) {
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        for (var wave = 0; wave < 3; wave++) {
            ctx.beginPath();
            var baseY = H * 0.35 + wave * 40;
            var amp = 40 + wave * 20;
            var freq = 0.003 - wave * 0.0005;
            var colors = ['rgba(0,229,255,', 'rgba(0,255,204,', 'rgba(100,180,255,'];
            for (var x = 0; x <= W; x += 3) {
                var y = baseY +
                    Math.sin(x * freq + t * 0.8 + wave * 2) * amp +
                    Math.sin(x * freq * 2.5 + t * 1.2) * amp * 0.3;
                if (x === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.lineTo(W, H);
            ctx.lineTo(0, H);
            ctx.closePath();
            var grd = ctx.createLinearGradient(0, baseY - amp, 0, baseY + 200);
            grd.addColorStop(0, colors[wave] + (0.015 * intensity) + ')');
            grd.addColorStop(0.3, colors[wave] + (0.04 * intensity) + ')');
            grd.addColorStop(1, 'transparent');
            ctx.fillStyle = grd;
            ctx.fill();
        }
        ctx.restore();
    }

    /* ── 主渲染循环 ── */
    function renderLoop() {
        if (!animRunning) return;
        ctx.clearRect(0, 0, W, H);

        var grd = ctx.createRadialGradient(W * 0.5, H * 0.45, 0, W * 0.5, H * 0.45, Math.max(W, H) * 0.6);
        grd.addColorStop(0, 'rgba(0,20,40,' + (0.3 * smokeIntensity) + ')');
        grd.addColorStop(1, 'transparent');
        ctx.fillStyle = grd;
        ctx.fillRect(0, 0, W, H);

        auroraT += 0.008;
        drawAurora(auroraT, smokeIntensity);

        ctx.globalCompositeOperation = 'screen';
        for (var i = 0; i < smokeParticles.length; i++) {
            var p = smokeParticles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.life -= p.decay;
            if (p.life <= 0) { p.reset(); continue; }

            var a = p.alpha * p.life * smokeIntensity;
            var rGrd = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
            rGrd.addColorStop(0, 'rgba(' + p.cr + ',' + p.cg + ',' + p.cb + ',' + (a * 1.5) + ')');
            rGrd.addColorStop(0.4, 'rgba(' + p.cr + ',' + p.cg + ',' + p.cb + ',' + (a * 0.5) + ')');
            rGrd.addColorStop(1, 'rgba(' + p.cr + ',' + p.cg + ',' + p.cb + ',0)');
            ctx.fillStyle = rGrd;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalCompositeOperation = 'source-over';

        requestAnimationFrame(renderLoop);
    }
    /* renderLoop 由 startPhase2 启动，视频期间不运行 */

    /* ══════════════════════════════════════
       叙事+加载 — 自动启动
       ══════════════════════════════════════ */
    var narrativeLines = [
        '你以为内蒙古只有草原和牛羊？',
        '',
        '全国风电第一、光伏第一，',
        '羊绒出口占全球七成，',
        '一个旗县的瓜子养活半个中国，',
        '冻土之上长出千亿级产业帝国。',
        '',
        '而这些，只是冰山一角。',
        '让数据替内蒙古说话。'
    ];

    var narrativeDone = false;
    var loadDone = false;

    /* 叙事和加载由 Phase 0 视频结束后触发（startPhase2 / startPhase2Init） */

    /* ── 叙事文字逐字浮现（字幕式） ── */
    function startNarrative() {
        var html = '';
        var wordIdx = 0;
        for (var li = 0; li < narrativeLines.length; li++) {
            var line = narrativeLines[li];
            if (line === '') { html += '<br>'; continue; }
            for (var ci = 0; ci < line.length; ci++) {
                html += '<span data-wi="' + wordIdx + '">' + line[ci] + '</span>';
                wordIdx++;
            }
            if (li < narrativeLines.length - 1) html += '<br>';
        }
        narrative.innerHTML = html;

        var spans = narrative.querySelectorAll('span');
        var charDelay = 80;
        for (var si = 0; si < spans.length; si++) {
            (function(el, d) {
                setTimeout(function() { el.classList.add('nar-show'); }, d);
            })(spans[si], si * charDelay + 400);
        }
        var totalNarTime = spans.length * charDelay + 400 + 600;
        setTimeout(function() {
            /* 等待观众读完文字再揭幕 */
        }, totalNarTime);
        setTimeout(function() {
            narrativeDone = true;
            tryReveal();
        }, totalNarTime + 3000);
    }

    /* ── 加载进度（跟踪真实脚本加载） ── */
    var loadProg = 0;
    function startLoader() {
        var total = deferredScripts.length;
        var iv = setInterval(function() {
            /* 真实进度 = 已加载脚本比例，平滑追赶 */
            var realProg = (scriptsLoadedCount / total) * 100;
            /* 平滑：每帧最多追赶差值的 20%，最少 +0.3 */
            var diff = realProg - loadProg;
            if (diff > 0) {
                loadProg += Math.max(diff * 0.2, 0.3);
            } else {
                loadProg += 0.15;  /* 微量前进保持动画感 */
            }
            if (loadProg > 99.5 && scriptsLoaded) loadProg = 100;
            if (loadProg > 95 && !scriptsLoaded) loadProg = 95; /* 卡在95等脚本 */
            loadFill.style.width = Math.round(loadProg) + '%';
            loadText.textContent = Math.round(loadProg) + '%';
            if (loadProg >= 100) {
                clearInterval(iv);
                loadText.textContent = 'Ready';
                loadDone = true;
                tryReveal();
            }
        }, 80);
    }

    /* ── 双条件：叙事播完 AND 加载完 才揭幕 ── */
    function tryReveal() {
        if (narrativeDone && loadDone) {
            setTimeout(performReveal, 500);
        }
    }

    /* ══════════════════════════════════════
       揭幕 → 显示 landing
       ══════════════════════════════════════ */
    var revealed = false;
    function performReveal() {
        if (revealed) return;
        revealed = true;

        /* 先渐隐叙事文字和加载条 */
        if (narrative) {
            narrative.style.transition = 'opacity 1s ease';
            narrative.style.opacity = '0';
        }
        var loadBar = document.querySelector('.intro-load-bar');
        if (loadBar) {
            loadBar.style.transition = 'opacity .8s ease';
            loadBar.style.opacity = '0';
        }

        /* 文字渐隐后再揭幕 */
        setTimeout(function() {
            /* 恢复 globe 渲染 */
            if (globeEl) globeEl.style.display = '';

            if (landingPage) landingPage.style.visibility = 'visible';
            /* page3Right 保持隐藏，由 pages.js switchPage(3) 管理 */

            overlay.style.transition = 'opacity 1.6s cubic-bezier(.25,1,.5,1)';
            overlay.style.opacity = '0';

            setTimeout(function() {
                animRunning = false;
                overlay.style.display = 'none';
            }, 1800);
        }, 800);
    }

    /* ── Skip ── */
    skipBtn.addEventListener('click', function() {
        if (!revealed) performReveal();
    });

    /* ── 鼠标交互：粒子跟随 ── */
    var mx = W / 2, my = H / 2;
    overlay.addEventListener('mousemove', function(e) {
        mx = e.clientX; my = e.clientY;
        for (var i = 0; i < 3; i++) {
            var idx = Math.floor(Math.random() * smokeParticles.length);
            var p = smokeParticles[idx];
            var dx = mx - p.x, dy = my - p.y;
            var dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 300) {
                p.vx += dx * 0.0003;
                p.vy += dy * 0.0003;
            }
        }
    });

    /* ── 点击产生烟雾爆发 ── */
    overlay.addEventListener('click', function(e) {
        if (revealed) return;
        for (var k = 0; k < 5; k++) {
            var np = new SmokeP();
            np.x = e.clientX + (Math.random() - 0.5) * 40;
            np.y = e.clientY + (Math.random() - 0.5) * 40;
            np.r = Math.random() * 80 + 40;
            np.vx = (Math.random() - 0.5) * 2;
            np.vy = (Math.random() - 0.5) * 2 - 0.5;
            np.alpha = 0.08;
            np.life = 0.8;
            smokeParticles.push(np);
        }
        while (smokeParticles.length > 100) smokeParticles.shift();
    });
})();
