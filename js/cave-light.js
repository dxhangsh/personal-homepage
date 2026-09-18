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
      memoryAlpha: 0.34,      // 探索记忆冲孔强度（走过区域变「稍暗但可见」）
      torchRadius: 230,       // 火把基准照亮半径 px
      torchCoreAlpha: 0.93,   // 火把中心最亮冲孔强度
      breatheAmp: 0.085,      // 呼吸幅度（半径 ±8.5%）
      breatheSpeed: 1.6,      // 呼吸频率（rad/s）
      flicker: 0.05,          // 随机闪烁幅度
      sparkRate: 0.5,         // 火星基础喷发率（个/帧，随移动倍增）
      warm: '255,166,66'      // 火光暖色 RGB
    },
    begin: function(opts){
      if(engine.started) return;
      var o = opts||{}, x = o.x, y = o.y;
      delete o.x; delete o.y;
      Object.assign(CaveLight.config, o);
      engine.start(x, y);
    },
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

    start: function(x, y){
      if(this.started) return;
      this.started = true; CaveLight.started = true;
      var self = this;
      // mx/my = 火把当前渲染位置（缓动）；tx/ty = 光标目标位置
      // 点燃瞬间 mx/my 位于引子木棍处（顶部），随后平滑滑行到光标，避免"瞬移回下面"
      if(typeof x==='number' && typeof y==='number'){ this.mx = x; this.my = y; }
      this.tx = this.mx; this.ty = this.my;   // 光照目标也从顶部起步（与火把一致）
      this.px = this.mx; this.py = this.my;   // 速度基准同步，避免首帧速度虚高
      this.handoff = true;      // 首次交接：用更慢的缓动做可见滑行
      this.moved = false;       // 用户是否已真正移动过光标
      this.handoffT = 0;        // 交接起点时间戳
      this.follow = 0.06;       // 交接期跟随系数（配合 700ms 定时窗口，约 93% 位移完成）
      this.handoffDur = 700;    // 交接滑行时长（ms），到期切回常规跟随
      this.followNormal = 0.3;  // 常规跟随系数（约 0.1s 到位，接近原生光标手感）

      // 记忆层：文档坐标系全页画布（不显示，仅存储探索痕迹）
      this.docH = Math.max(document.documentElement.scrollHeight, innerHeight);
      this.mem = document.createElement('canvas');
      this.mem.width = document.documentElement.scrollWidth || innerWidth;
      this.mem.height = this.docH;
      this.memCtx = this.mem.getContext('2d');

      // 黑暗层：视口大小、fixed；每帧按当前滚动位置从记忆层合成
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
      // 火把初始位置必须与传入坐标同步（否则元素停在默认位置、与引子木棍错位）
      this.torch.style.transform = 'translate('+this.mx+'px,'+this.my+'px)';

      document.body.classList.add('cave-mode'); // 隐藏原生光标

      // 功能豁免区：这些区域在洞窟光效下仍需可辨识可操作（如反馈表单）
      this.exempts = Array.prototype.slice.call(document.querySelectorAll('[data-cave-exempt]'));

      window.addEventListener('resize', function(){ self.resize(); });
      window.addEventListener('pointermove', function(e){ self.onMove(e); }, {passive:true});
      window.addEventListener('pointerdown', function(e){ self.burst(e.clientX, e.clientY, 14); }, {passive:true});

      // 初始把视口中心也作为「火把落点」（文档坐标），避免首帧无从看清
      this.stamp(this.mx + window.scrollX, this.my + window.scrollY,
                 CaveLight.config.torchRadius*0.9, CaveLight.config.memoryAlpha*0.5);
      this.loop();
      CaveLight.emit('ready');
    },

    resize: function(){
      // 黑暗层跟随视口
      this.dark.width = innerWidth; this.dark.height = innerHeight;
      // 记忆层随文档高度增长（保留旧痕迹：拷贝到新画布）
      var newH = Math.max(document.documentElement.scrollHeight, innerHeight);
      var newW = document.documentElement.scrollWidth || innerWidth;
      if(newH > this.mem.height || newW > this.mem.width){
        var old = this.mem;
        this.mem = document.createElement('canvas');
        this.mem.width = Math.max(newW, old.width);
        this.mem.height = Math.max(newH, old.height);
        this.memCtx = this.mem.getContext('2d');
        this.memCtx.drawImage(old, 0, 0);
      }
      this.docH = newH;
    },

    onMove: function(e){
      // 只记录目标位置；实际渲染位置由 loop() 缓动追随（避免瞬移）
      this.tx = e.clientX; this.ty = e.clientY;
      this.moved = true;
      if(!this.running) return;
      var dx0 = e.clientX - this.mx, dy0 = e.clientY - this.my;
      if(this.handoff && Math.sqrt(dx0*dx0+dy0*dy0) > 2){
        // 交接滑行尚未结束：不盖印、不喷火星，保持"火把从木棍处飘来"的观感
        return;
      }
      var dx = e.clientX-this.px, dy = e.clientY-this.py;
      this.speed = Math.min(Math.sqrt(dx*dx+dy*dy), 60);
      // 探索记忆：随移动持续盖印（文档坐标，滚动后痕迹仍对准页面位置）
      var d = Math.sqrt(dx*dx+dy*dy);
      if(d > 6){
        this.px = e.clientX; this.py = e.clientY;
        this.stamp(this.mx + window.scrollX, this.my + window.scrollY,
                   CaveLight.config.torchRadius*0.75, CaveLight.config.memoryAlpha);
      }
      // 火星：移动越快喷发越多
      var n = Math.random() < CaveLight.config.sparkRate + this.speed*0.012 ? 1 : 0;
      if(n && !reduced) this.spawnSpark(this.mx, this.my);
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

        // 火把位置缓动追随：交接期慢（可见滑行），到位后切换常规跟随
        var fdx = self.tx - self.mx, fdy = self.ty - self.my;
        // 交接滑行：自用户首次移动起计时，到期切回常规跟手（指数缓动渐近，不能用距离阈值收尾）
        if(self.handoff && self.moved){
          if(!self.handoffT) self.handoffT = now;
          if(now - self.handoffT > self.handoffDur) self.handoff = false;
        }
        var k = self.handoff ? self.follow : self.followNormal;
        self.mx += fdx * k;
        self.my += fdy * k;
                self.torch.style.transform = 'translate('+self.mx.toFixed(1)+'px,'+self.my.toFixed(1)+'px)';
        // 呼吸 + 闪烁
        var breathe = reduced ? 0 : Math.sin(t*cfg.breatheSpeed)*cfg.breatheAmp;
        var flick = reduced ? 0 : (Math.random()-0.5)*cfg.flicker;
        var R = cfg.torchRadius * (1 + breathe + flick);
        var dctx = self.darkCtx;

        // 1) 全黑暗底（仅视口）
        dctx.globalCompositeOperation = 'source-over';
        dctx.clearRect(0,0,self.dark.width,self.dark.height);
        dctx.fillStyle = 'rgba(6,4,2,'+cfg.darkness+')';
        dctx.fillRect(0,0,self.dark.width,self.dark.height);

        // 2) 探索记忆冲孔：记忆层是文档坐标，按当前滚动偏移对齐视口
        //    （走到页面深处，黑暗与痕迹同步滚动——整页皆洞窟）
        dctx.globalCompositeOperation = 'destination-out';
        dctx.globalAlpha = cfg.memoryAlpha;
        dctx.drawImage(self.mem, -window.scrollX, -window.scrollY);
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
        var w = dctx.createRadialGradient(self.mx, self.my, 0, self.mx, self.my, R*0.6);
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
     点火完全由引子（cave-intro.js）通过 CaveLight.begin({x,y}) 控制；
     引子脚本异常时由其兜底逻辑直接 begin()，不会出现无光标的死页。 */
  window.CaveLight._engine = engine;
})();
