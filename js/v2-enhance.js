/* ============================================================
   个人主页 V2 视觉增强 · 预览专用脚本
   原则：本文件与 styles-v2.css 一起构成「覆盖层」，
        不修改任何 V1 文件（index.html / styles.css / main.js）。
   说明：V1 main.js 已覆盖全部基础交互（导航折叠、返回顶部、
        锚点高亮、邮箱混淆），此处只做 V2 的增量修正。
   ============================================================ */
(function(){
  'use strict';

  // 标记 V2 预览脚本已加载（便于控制台核验）
  window.__V2_PREVIEW__ = true;

  /* ---------- P0-4 · 凿边扰动幅度 3.5% → 5% ----------
     V1 的 jaggedRects 是 IIFE 内部函数、未导出，无法直接调参；
     但它的唯一副作用是写 el.style.clipPath。本脚本加载在 main.js 之后，
     故按同一算法（每边插点 top4/right5/bottom4/left5，共 18 点）重跑一遍即可，
     完全不触碰 V1 的 main.js。 */
  var AMT = 5;                 // V1 为 3.5
  var TOP = 4, RIGHT = 5, BOTTOM = 4, LEFT = 5;

  function jaggedRects(el){
    var j = function(){ return (Math.random() * 2 - 1) * AMT; };
    var pts = [];
    var i;
    for(i = 0; i <= TOP; i++)    pts.push([100 * i / TOP, j()]);            // 顶边 左→右
    for(i = 1; i <= RIGHT; i++)  pts.push([100 + j(), 100 * i / RIGHT]);    // 右边 上→下
    for(i = 1; i <= BOTTOM; i++) pts.push([100 - 100 * i / BOTTOM, 100 + j()]); // 底边 右→左
    for(i = 1; i < LEFT; i++)    pts.push([j(), 100 - 100 * i / LEFT]);     // 左边 下→上
    el.style.clipPath = 'polygon(' + pts.map(function(p){
      return p[0].toFixed(2) + '% ' + p[1].toFixed(2) + '%';
    }).join(',') + ')';
  }

  var cards = document.querySelectorAll('.card');
  for(var n = 0; n < cards.length; n++) jaggedRects(cards[n]);
  window.__V2_JAG_AMT__ = AMT;   // 供验收脚本读取
  window.__V2_JAG_CARDS__ = cards.length;

  /* ---------- P1-8 · 卡片外部落影 ----------
     关键发现：.card 带 clip-path（V1 的 1% 内缩 + 上面的凿边），而 clip-path 会
     裁掉元素「自身」画出的全部 filter / box-shadow 输出——实测在卡下方
     0 像素可见（红色夸张落影也不出现）；同元素上 overflow 与 clip-path:
     none 的对照证明裁剪源是 clip-path 而非 overflow。
     故落影必须画在被裁元素「之外」：每张卡配一个绝对定位的空元素充当影子，
     用 box-shadow 做「贴地 + 扩散」两层。不改 HTML、不动栅格布局。
     影子一律挂到 main.wrap（其 position:relative 已是最近的定位祖先），
     坐标用 getBoundingClientRect 差值换算成相对 wrap 内边距盒的偏移。 */
  var sh = [];
  function syncShadows(){
    var wrap = document.querySelector('main.wrap');
    if(!wrap) return;
    var wr = wrap.getBoundingClientRect();
    var wl = wr.left + wrap.clientLeft, wt = wr.top + wrap.clientTop;
    var list = document.querySelectorAll('.card');
    for(var i = 0; i < list.length; i++){
      var r = list[i].getBoundingClientRect();
      var s = sh[i];
      if(!s){
        s = document.createElement('i');
        s.className = 'v2-cardshadow';
        s.setAttribute('aria-hidden', 'true');
        wrap.appendChild(s);
        sh[i] = s;
      }
      s.style.left   = Math.round(r.left - wl) + 'px';
      s.style.top    = Math.round(r.top  - wt) + 'px';
      s.style.width  = Math.round(r.width)  + 'px';
      s.style.height = Math.round(r.height) + 'px';
    }
    window.__V2_SHADOWS__ = list.length;
  }
  syncShadows();                                   // 脚本在 body 末尾，布局已可用
  window.addEventListener('load', syncShadows);    // 图片/字体落位后校正尺寸
  if(document.fonts && document.fonts.ready && document.fonts.ready.then){
    document.fonts.ready.then(syncShadows);        // 衬线字体度量变化会改卡高
  }
  var shadowTimer;
  window.addEventListener('resize', function(){
    clearTimeout(shadowTimer);
    shadowTimer = setTimeout(syncShadows, 150);
  });
})();
