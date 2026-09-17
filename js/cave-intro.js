/* ============================================================
   个人主页 V2 · 洞窟引子（cave-intro）
   流程：
     1. 全黑背景，硫磺粉材质文字逐行浮现（间隔 1.5s，共 7 行）
     2. 木棍浮现，点击「拿起」→ 原生光标消失，木棍飞至顶部正中竖起
     3. 文字破碎成粒子 → 汇聚于木棍上方游走数圈 → 冲向木棍穿透点燃
        （冲击瞬间：屏震 + 爆闪 + 火星爆发，着重冲击力）
     4. 引子淡出，无缝衔接洞窟主页（火把光标 + 探索光效）
   接口：基于 window.CaveLight（cave-light.js），引子结束调用 begin({x,y})
   降级：prefers-reduced-motion 跳过粒子动画直接点火
   ============================================================ */
(function(){
  'use strict';

  var LINES = [
    '朋友，欢迎来到我的主页！',
    '在这里，你能看到我的成长历程、兴趣爱好',
    '理想目标、成果展示、个人思考……',
    '一言以蔽之，我何以走到今天这一步。',
    '无论是想增进对我的了解，还是仅仅出于好奇，',
    '相信你的疑惑都能在这里得到解答。',
    '准备好探索我的个人空间了吗？'
  ];
  var INTERVAL = 1500;      // 逐行浮现间隔
  var FIRST_DELAY = 700;    // 首行延迟

  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var mount = document.getElementById('caveIntro');
  if(!mount || !window.CaveLight) return;

  /* ---------- 构建 DOM ---------- */
  var linesBox = document.createElement('div'); linesBox.className = 'ci-lines';
  var lineEls = LINES.map(function(text){
    var p = document.createElement('p'); p.className = 'ci-line'; p.textContent = text;
    linesBox.appendChild(p); return p;
  });
  var stickWrap = document.createElement('div'); stickWrap.className = 'ci-stickwrap';
  var stick = document.createElement('div'); stick.className = 'ci-stick';
  stick.setAttribute('role','button'); stick.setAttribute('tabindex','0');
  stick.setAttribute('aria-label','拿起火把，开启奇幻之旅');
  var stickLabel = document.createElement('div'); stickLabel.className = 'ci-sticklabel';
  stickLabel.textContent = '↑ 开启奇幻之旅';
  stickWrap.appendChild(stick); stickWrap.appendChild(stickLabel);
  var fx = document.createElement('canvas'); fx.id = 'introFx'; fx.setAttribute('aria-hidden','true');
  mount.appendChild(linesBox); mount.appendChild(stickWrap); mount.appendChild(fx);
  var fctx = fx.getContext('2d');

  document.body.classList.add('ci-lock');   // 引子期间锁定页面滚动

  /* ---------- 逐行浮现 ---------- */
  lineEls.forEach(function(el, i){
    setTimeout(function(){ el.classList.add('on'); }, FIRST_DELAY + i*INTERVAL);
  });
  setTimeout(function(){ stickWrap.classList.add('on'); }, FIRST_DELAY + LINES.length*INTERVAL + 300);

  /* ---------- 拿起木棍 ---------- */
  var picked = false, tip = {x:0, y:0};
  function pickup(){
    if(picked) return; picked = true;
    document.body.classList.add('cave-mode');           // 原生光标消失（火把接管）
    stickLabel.classList.add('off');
    // 木棍定位到当前渲染位置 → 飞至顶部正中竖起
    var r = stick.getBoundingClientRect();
    // 旋转（-6deg）不改变元素中心，故用视觉中心 + 未旋转尺寸换算 fixed 定位，
    // 避免直接使用旋转后的外接框（其高度被放大到 ~31px 而非 13px）造成落点偏移。
    var cx = r.left + r.width/2, cy = r.top + r.height/2;
    var uw = stick.offsetWidth, uh = stick.offsetHeight;
    stick.style.position = 'fixed';
    stick.style.left = (cx - uw/2)+'px'; stick.style.top = (cy - uh/2)+'px';
    stick.style.width = uw+'px'; stick.style.margin = '0';
    tip.x = Math.round(innerWidth/2);
    tip.y = Math.round(innerHeight*0.12);
    // 强制回流后触发过渡
    void stick.offsetWidth;
    var dx = tip.x - cx, dy = tip.y - cy;   // 中心对齐到 tip，落点严格重合
    stick.style.transform = 'translate('+dx+'px,'+dy+'px) rotate(-84deg)';
    stick.style.transition = 'transform .95s cubic-bezier(.55,.06,.28,1)';
    stick.style.zIndex = '3';
    setTimeout(function(){ if(reduced){ ignite(); } else { shatter(); } }, 1000);
  }
  stick.addEventListener('click', pickup);
  stick.addEventListener('keydown', function(e){ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); pickup(); } });

  /* ---------- 文字破碎 → 游走 → 冲击点燃 ---------- */
  var parts = [];
  function shatter(){
    fx.width = innerWidth; fx.height = innerHeight;
    lineEls.forEach(function(el){
      var r = el.getBoundingClientRect();
      if(r.width < 10 || r.height < 5) return;
      var cs = getComputedStyle(el);
      var off = document.createElement('canvas');
      off.width = Math.ceil(r.width); off.height = Math.ceil(r.height);
      var octx = off.getContext('2d');
      octx.font = cs.fontWeight+' '+cs.fontSize+' '+cs.fontFamily;
      octx.textAlign = 'center'; octx.textBaseline = 'middle';
      octx.fillStyle = '#f0d878';
      octx.fillText(el.textContent, off.width/2, off.height/2);
      var data = octx.getImageData(0,0,off.width,off.height).data;
      var step = 4;
      for(var y=0; y<off.height; y+=step){
        for(var x=0; x<off.width; x+=step){
          var a = data[(y*off.width+x)*4+3];
          if(a > 110){
            parts.push({
              x: r.left+x, y: r.top+y,
              vx: (Math.random()-0.5)*1.4, vy: (Math.random()-0.5)*1.2 - 0.5,
              ang: Math.atan2(r.top+y-tip.y, r.left+x-tip.x),
              rad: Math.hypot(r.left+x-tip.x, r.top+y-tip.y) || 8,
              orbit: 24 + Math.random()*46,
              w: (Math.random()<0.5?1:-1)*(5.5+Math.random()*2.5),
              sz: 1 + Math.random()*1.4
            });
          }
        }
      }
      el.style.transition = 'opacity .22s'; el.style.opacity = '0';
    });
    // 粒子总量封顶（性能保护）
    while(parts.length > 2600){
      parts.splice(Math.floor(Math.random()*parts.length), 1);
    }
    requestAnimationFrame(tick);
  }

  var phase = 'A', pStart = 0;
  var D_A = reduced?0:500, D_B = reduced?0:1900, D_C = 400;
  function tick(now){
    if(!pStart) pStart = now;
    var t = now - pStart;
    fctx.clearRect(0,0,fx.width,fx.height);
    fctx.globalCompositeOperation = 'lighter';

    if(phase==='A' && t >= D_A){ phase='B'; pStart=now; }
    else if(phase==='B' && t >= D_B){ phase='C'; pStart=now; }
    else if(phase==='C' && t >= D_C){ ignite(); return; }

    for(var i=parts.length-1;i>=0;i--){
      var p = parts[i];
      if(phase==='A'){
        p.x += p.vx; p.y += p.vy; p.vx*=0.96; p.vy*=0.96;
      } else if(phase==='B'){
        p.ang += p.w/60;
        var pull = 1 - 0.022;
        p.rad = p.orbit + (p.rad - p.orbit)*pull;
        p.x = tip.x + Math.cos(p.ang)*p.rad;
        p.y = tip.y + Math.sin(p.ang)*p.rad*0.72;
      } else { // C 冲向木棍（穿透感：越接近越快）
        p.rad *= 0.82;
        if(p.rad < 3){ p.rad = 2 + Math.random()*30; }   // 冲过后从外围再补一轮冲击
        p.x = tip.x + Math.cos(p.ang)*p.rad;
        p.y = tip.y + Math.sin(p.ang)*p.rad*0.72;
      }
      fctx.fillStyle = 'rgba('+(255)+','+(200+Math.floor(55*Math.random()))+','+(90+Math.floor(60*Math.random()))+',0.95)';
      fctx.beginPath();
      fctx.arc(p.x, p.y, p.sz, 0, Math.PI*2);
      fctx.fill();
    }
    requestAnimationFrame(tick);
  }

  /* ---------- 点燃 ---------- */
  function ignite(){
    CaveLight.begin({x: tip.x, y: tip.y});
    try{ window.CaveLight._engine.burst(tip.x, tip.y, 46); }catch(e){}
    // 冲击爆闪 + 屏震
    mount.classList.add('shake');
    flash(tip.x, tip.y);
    // 无缝衔接：引子木棍与火把位置重合，交叉淡出木棍避免"两根棍子"重影
    stick.style.transition = 'opacity .35s ease';
    stick.style.opacity = '0';
    setTimeout(function(){
      mount.classList.add('fade');
      document.body.classList.remove('ci-lock');
      CaveLight.emit('reveal');
      setTimeout(function(){ mount.hidden = true; }, 900);
    }, 380);
  }
  function flash(x, y){
    var t0 = performance.now();
    function f(now){
      var t = (now-t0)/380;
      if(t>1){ fctx.clearRect(0,0,fx.width,fx.height); return; }
      fctx.clearRect(0,0,fx.width,fx.height);
      var r = 20 + t*260;
      fctx.globalCompositeOperation = 'lighter';
      var g = fctx.createRadialGradient(x,y,0,x,y,r);
      g.addColorStop(0,'rgba(255,246,214,'+(0.95*(1-t))+')');
      g.addColorStop(0.5,'rgba(255,170,60,'+(0.55*(1-t))+')');
      g.addColorStop(1,'rgba(255,120,30,0)');
      fctx.fillStyle = g;
      fctx.fillRect(x-r,y-r,r*2,r*2);
      requestAnimationFrame(f);
    }
    requestAnimationFrame(f);
  }

  /* ---------- 兜底：引子脚本异常时直接点火，不阻塞主页 ---------- */
  window.addEventListener('error', function(ev){
    if(!CaveLight.started && ev.filename && ev.filename.indexOf('cave-intro')>-1 && !picked){
      try{ mount.hidden = true; document.body.classList.remove('ci-lock'); }catch(e){}
      CaveLight.begin();
    }
  }, true);
})();
