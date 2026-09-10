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
})();
