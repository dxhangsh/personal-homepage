/* ============================================================
   个人主页 V1 · 交互脚本
   功能：卡片随机凿边 · 移动端导航折叠 · 返回顶部 · 锚点高亮
   原则：零依赖、原生 JS、不阻塞渲染（defer 加载）
   ============================================================ */
(function(){
  'use strict';

  /* ---------- 1. 每张卡片生成随机凿边（保持基本轮廓，边中随机扰动） ---------- */
  function jaggedRects(el){
    const top=4, right=5, bottom=4, left=5;   // 每边插入点数
    const amt=3.5;                             // 扰动幅度 %
    const j=()=> (Math.random()*2-1)*amt;      // 法向偏移
    let pts=[];
    for(let i=0;i<=top;i++) pts.push([100*i/top, j()]);          // 顶边 左→右
    for(let i=1;i<=right;i++) pts.push([100+j(), 100*i/right]);  // 右边 上→下
    for(let i=1;i<=bottom;i++) pts.push([100-100*i/bottom, 100+j()]); // 底边 右→左
    for(let i=1;i<left;i++) pts.push([j(), 100-100*i/left]);     // 左边 下→上
    el.style.clipPath='polygon('+pts.map(p=>p[0].toFixed(2)+'% '+p[1].toFixed(2)+'%').join(',')+')';
  }
  document.querySelectorAll('.card').forEach(jaggedRects);

  /* ---------- 2. 移动端导航折叠 ---------- */
  var navToggle=document.querySelector('.nav-toggle');
  var navMenu=document.getElementById('navMenu');
  if(navToggle && navMenu){
    navToggle.addEventListener('click',function(){
      var open=navMenu.classList.toggle('open');
      navToggle.setAttribute('aria-expanded', open?'true':'false');
      navToggle.setAttribute('aria-label', open?'关闭菜单':'打开菜单');
    });
    // 点击菜单项后收起
    navMenu.addEventListener('click',function(e){
      if(e.target.tagName==='A'){ navMenu.classList.remove('open'); navToggle.setAttribute('aria-expanded','false'); }
    });
  }

  /* ---------- 3. 返回顶部 ---------- */
  var toTop=document.getElementById('toTop');
  if(toTop){
    window.addEventListener('scroll',function(){
      toTop.classList.toggle('show', window.scrollY>400);
    },{passive:true});
    toTop.addEventListener('click',function(){ window.scrollTo({top:0, behavior:'smooth'}); });
  }

  /* ---------- 4. 锚点平滑滚动（兼容非 CSS scroll-behavior 场景）+ 偏移吸顶导航 ---------- */
  document.querySelectorAll('a[href^="#"]').forEach(function(a){
    a.addEventListener('click',function(e){
      var id=a.getAttribute('href');
      if(id.length<2) return;
      var target=document.querySelector(id);
      if(!target) return;
      e.preventDefault();
      var navH=document.querySelector('.topnav') ? document.querySelector('.topnav').offsetHeight : 0;
      var y=target.getBoundingClientRect().top + window.scrollY - navH - 14;
      window.scrollTo({top:y, behavior:'smooth'});
    });
  });

  /* ---------- 5. 当前锚点高亮 ---------- */
  var sections=document.querySelectorAll('main section[id], section[id]');
  var navLinks=document.querySelectorAll('.nav-menu a');
  var observer=new IntersectionObserver(function(entries){
    entries.forEach(function(entry){
      if(entry.isIntersecting){
        navLinks.forEach(function(l){
          l.classList.toggle('active', l.getAttribute('href')==='#'+entry.target.id);
        });
      }
    });
  },{rootMargin:'-45% 0px -50% 0px'});
  sections.forEach(function(s){ if(s.id) observer.observe(s); });
})();
