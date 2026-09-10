/* ============================================================
   个人主页 V2 · 洞窟探索光效引擎（cave-light）
   需求映射：
     1. 光标替换为燃烧火把动画（DOM 火焰 + 原生光标隐藏）
     2. 火星粒子实时效果（canvas 粒子，随移动加速喷发）
     3. 呼吸式照亮（半径/亮度正弦呼吸 + 随机闪烁）
     4. 主界面初始完全黑暗；光标照过区域「永久稍暗但可见」
     5. 光标周围为相对最亮处
     6. 预留引入界面接口：window.CaveLight（enter/onReady/begin）
   实现：双 canvas（记忆层 + 黑暗层），destination-out 逐帧冲孔
   约束：零依赖；prefers-reduced-motion 全量降级
   ============================================================ */
(function(){
  'use strict';

  /* ---------- 引入界面接口（预留） ---------- */
  // 后续接入引导页时：调用 CaveLight.begin(options) 显式点火；
  // 或监听 CaveLight.on('ready') 在黑暗就绪后播放开场动画再 reveal。
  var listeners = {};
  var CaveLight = {
    version: '1.0.0',
    started: false,
    config: {
      darkness: 0.98,        // 初始黑暗不透明度（0.965 ≈ 全黑但保留 3.5% 轮廓）
      memoryAlpha: 0.42,      // 探索记忆冲孔强度（走过区域变「稍暗但可见」）
      torchRadius: 230,       // 火把基准照亮半径 px
      torchCoreAlpha: 0.93,   // 火把中心最亮冲孔强度
      breatheAmp: 0.085,      // 呼吸幅度（半径 ±8.5%）
      breatheSpeed: 1.6,      // 呼吸频率（rad/s）
      flicker: 0.05,          // 随机闪烁幅度
      sparkRate: 0.5,         // 火星基础喷发率（个/帧，随移动倍增）
      warm: '255,166,66'      // 火光暖色 RGB
    },
    begin: function(opts){ if(!engine.started){ Object.assign(CaveLight.config, opts||{}); engine.start(); } },
    enter: function(fn){ /* 预留：引导界面结束后的进入回调 */ CaveLight.on('reveal', fn); },
    on: function(evt, fn){ (listeners[evt]=listeners[evt]||[]).push(fn); return CaveLight; },
    emit: function(evt, data){ (listeners[evt]||[]).forEach(function(f){ try{ f(data); }catch(e){} }); }
  };
  window.CaveLight = CaveLight;

  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var engine = {
    started: false,
    mem: null, memCtx: null,     // 记忆层（持久，白色渐变累积）
    dark: null, darkCtx: null,   // 黑暗层（每帧重绘，盖在内容上）
    torch: null,                 // 火把 DOM
    mx: innerWidth/2, my: innerHeight/2,
    px: 0, py: 0,                // 上一帧光标（算速度）
    speed: 0,
    t0: performance.now(),
    sparks: [],
    running: false,

    start: function(){
      if(this.started) return;
      this.started = true; CaveLight.started = true;
      var self = this;

      // 记忆层
      this.mem = document.createElement('canvas');
      this.mem.width = innerWidth; this.mem.height = innerHeight;
      this.memCtx = this.mem.getContext('2d');

      // 黑暗层（盖在内容上，指针穿透）
      this.dark = document.createElement('canvas');
      this.dark.id = 'caveDark';
      this.dark.width = innerWidth; this.dark.height = innerHeight;
      this.dark.style.cssText = 'position:fixed;inset:0;z-index:9990;pointer-events:none;';
      document.body.appendChild(this.dark);
      this.darkCtx = this.dark.getContext('2d');

      // 火把光标
      this.torch = document.createElement('div');
      this.torch.id = 'caveTorch';
      this.torch.setAttribute('aria-hidden','true');
      this.torch.innerHTML = '<span class="cv-stick"></span><span class="cv-flame"><i></i><i></i><i></i></span><span class="cv-halo"></span>';
      document.body.appendChild(this.torch);

      document.body.classList.add('cave-mode'); // 隐藏原生光标

      window.addEventListener('resize', function(){ self.resize(); });
      window.addEventListener('pointermove', function(e){ self.onMove(e); }, {passive:true});
      window.addEventListener('pointerdown', function(e){ self.burst(e.clientX, e.clientY, 14); }, {passive:true});

      // 初始把视口中心也作为「火把落点」，避免首帧无从看清
      this.stamp(this.mx, this.my, CaveLight.config.torchRadius*0.9, CaveLight.config.memoryAlpha*0.5);
      this.loop();
      CaveLight.emit('ready');
    },

    resize: function(){
      [this.mem, this.dark].forEach(function(c){
        c.width = innerWidth; c.height = innerHeight;
      });
    },

    onMove: function(e){
      this.mx = e.clientX; this.my = e.clientY;
      this.torch.style.transform = 'translate('+(e.clientX)+'px,'+(e.clientY)+'px)';
      if(!this.running) return;
      var dx = e.clientX-this.px, dy = e.clientY-this.py;
      this.speed = Math.min(Math.sqrt(dx*dx+dy*dy), 60);
      // 探索记忆：随移动持续盖印（间隔距离阀值防过密）
      var d = Math.sqrt(dx*dx+dy*dy);
      if(d > 6){
        this.px = e.clientX; this.py = e.clientY;
        this.stamp(e.clientX, e.clientY, CaveLight.config.torchRadius*0.45, CaveLight.config.memoryAlpha);
      }
      // 火星：移动越快喷发越多
      var n = Math.random() < CaveLight.config.sparkRate + this.speed*0.012 ? 1 : 0;
      if(n && !reduced) this.spawnSpark(e.clientX, e.clientY);
    },

    stamp: function(x, y, r, alpha){
      var g = this.memCtx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(0.55, 'rgba(255,255,255,0.55)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      // 记忆层封顶策略：以 'source-over' + 固定 alpha 盖印，重复经过不会无限增亮，
      // 但渐变叠加仍会缓慢趋近该 alpha 上限（正确模拟「稍暗但可见」的记忆留存）
      this.memCtx.globalCompositeOperation = 'source-over';
      this.memCtx.fillStyle = g;
      this.memCtx.fillRect(x-r, y-r, r*2, r*2);
    },

    spawnSpark: function(x, y){
      if(this.sparks.length > 90) return;
      var a = Math.random()*Math.PI*2, sp = 0.6+Math.random()*1.8;
      this.sparks.push({
        x: x+(Math.random()-0.5)*10, y: y-14+(Math.random()-0.5)*6,
        vx: Math.cos(a)*sp*0.7, vy: -1.2-Math.random()*1.6,
        life: 1, decay: 0.012+Math.random()*0.02,
        size: 1+Math.random()*1.8
      });
    },
    burst: function(x, y, n){ for(var i=0;i<n;i++) this.spawnSpark(x, y); },

    loop: function(){
      var self = this;
      function frame(now){
        var cfg = CaveLight.config;
        var t = (now - self.t0)/1000;
        // 呼吸 + 闪烁
        var breathe = reduced ? 0 : Math.sin(t*cfg.breatheSpeed)*cfg.breatheAmp;
        var flick = reduced ? 0 : (Math.random()-0.5)*cfg.flicker;
        var R = cfg.torchRadius * (1 + breathe + flick);
        var dctx = self.darkCtx;

        // 1) 全黑暗底
        dctx.globalCompositeOperation = 'source-over';
        dctx.clearRect(0,0,self.dark.width,self.dark.height);
        dctx.fillStyle = 'rgba(6,4,2,'+cfg.darkness+')';
        dctx.fillRect(0,0,self.dark.width,self.dark.height);

        // 2) 探索记忆冲孔（走过 → 永久「稍暗但可见」：冲孔强度恒为 memoryAlpha，路径重叠不增亮）
        dctx.globalCompositeOperation = 'destination-out';
        dctx.globalAlpha = cfg.memoryAlpha;
        dctx.drawImage(self.mem, 0, 0);
        dctx.globalAlpha = 1;

        // 3) 火把当前最亮区冲孔
        var g = dctx.createRadialGradient(self.mx, self.my, 0, self.mx, self.my, R);
        g.addColorStop(0, 'rgba(0,0,0,'+cfg.torchCoreAlpha+')');
        g.addColorStop(0.38, 'rgba(0,0,0,'+(cfg.torchCoreAlpha*0.8)+')');
        g.addColorStop(0.68, 'rgba(0,0,0,'+(cfg.torchCoreAlpha*0.38)+')');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        dctx.fillStyle = g;
        dctx.fillRect(self.mx-R, self.my-R, R*2, R*2);

        // 4) 火光暖色叠加（只在当前照亮区，营造火把色温）
        dctx.globalCompositeOperation = 'source-over';
        var w = dctx.createRadialGradient(self.mx, self.my, 0, self.mx, self.my, R*0.85);
        w.addColorStop(0, 'rgba('+cfg.warm+',0.14)');
        w.addColorStop(0.6, 'rgba('+cfg.warm+',0.05)');
        w.addColorStop(1, 'rgba('+cfg.warm+',0)');
        dctx.fillStyle = w;
        dctx.fillRect(self.mx-R, self.my-R, R*2, R*2);

        // 5) 火星粒子（在最亮处上方，永远可见）
        for(var i=self.sparks.length-1;i>=0;i--){
          var p = self.sparks[i];
          p.x += p.vx; p.y += p.vy;
          p.vy += 0.012;                       // 微重力
          p.vx *= 0.995;
          p.life -= p.decay;
          if(p.life<=0){ self.sparks.splice(i,1); continue; }
          dctx.globalCompositeOperation = 'source-over';
          dctx.fillStyle = 'rgba(255,'+(140+Math.floor(90*p.life))+','+(40*p.life|0)+','+(p.life*0.95)+')';
          dctx.beginPath();
          dctx.arc(p.x, p.y, p.size*p.life+0.4, 0, Math.PI*2);
          dctx.fill();
        }

        // 火把 DOM 呼吸缩放
        if(!reduced){
          self.torch.style.setProperty('--breathe', (1+breathe*0.6).toFixed(3));
        }
        requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
      this.running = true;
    }
  };

  /* ---------- 启动策略 ----------
     默认：黑暗立即生效，首次指针移动时点火（无鼠标的环境不阻塞阅读）。
     预留接口：引导页就绪后调用 CaveLight.begin() 显式控制点火时机。 */
  function armOnce(){
    document.removeEventListener('pointermove', armOnce);
    engine.start();
  }
  document.addEventListener('pointermove', armOnce, {once:false, passive:true});
  window.CaveLight._engine = engine;
})();
