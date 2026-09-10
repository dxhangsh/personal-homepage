/* ============================================================
   个人主页 V2 视觉增强 · 预览专用脚本（第二阶段）
   新增：Number Ticker 数字递增（Magic UI 手法，零依赖实现）
        滚动驱动动画由 CSS 原生承担；JS 仅做数字与回退补充
   ============================================================ */
(function(){
  'use strict';
  window.__V2_PREVIEW__ = true;

  /* ---------- Number Ticker：元素进入视口后数字递增到目标值 ---------- */
  function runTicker(el){
    if(el.dataset.ticked) return;
    el.dataset.ticked = '1';
    var target = parseInt(el.dataset.count || '0', 10);
    var suffix = el.dataset.suffix || '';
    var dur = 1400, t0 = null;
    function step(ts){
      if(!t0) t0 = ts;
      var p = Math.min((ts - t0) / dur, 1);
      // easeOutCubic
      var e = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(target * e) + suffix;
      if(p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }
  function initTickers(){
    var nums = document.querySelectorAll('.stat-num[data-count]');
    if(!nums.length) return;
    if(!('IntersectionObserver' in window)){
      nums.forEach(function(el){
        el.textContent = el.dataset.count + (el.dataset.suffix || '');
      });
      return;
    }
    var io = new IntersectionObserver(function(entries){
      entries.forEach(function(entry){
        if(entry.isIntersecting){ runTicker(entry.target); io.unobserve(entry.target); }
      });
    }, {threshold: .6});
    nums.forEach(function(el){ io.observe(el); });
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', initTickers);
  } else {
    initTickers();
  }
})();
