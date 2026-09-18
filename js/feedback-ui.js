/* ============================================================
   个人主页 V3 · 反馈前端交互（feedback-ui.js）
   ------------------------------------------------------------
   功能：表单校验 → 提交 → 三态反馈（提交中/成功/失败）
   约束：零依赖；洞窟光效下表单必须可见可用（见 styles-v3.css）
   ============================================================ */
(function(){
  'use strict';

  var form = document.getElementById('fbForm');
  if(!form || !window.FeedbackStore) return;

  var msgEl   = document.getElementById('fbMsg');
  var nameEl  = document.getElementById('fbName');
  var mailEl  = document.getElementById('fbContact');
  var statusEl= document.getElementById('fbStatus');
  var submitEl= document.getElementById('fbSubmit');
  var countEl = document.getElementById('fbCount');
  var MAX = 600;

  /* ---------- 字数计数 ---------- */
  function syncCount(){
    if(countEl) countEl.textContent = msgEl.value.length + ' / ' + MAX;
  }
  msgEl.addEventListener('input', syncCount);
  syncCount();

  /* ---------- 状态提示 ---------- */
  function say(text, kind){
    statusEl.textContent = text || '';
    statusEl.className = 'fb-status' + (kind ? ' ' + kind : '');
    statusEl.setAttribute('role', kind === 'error' ? 'alert' : 'status');
  }

  /* ---------- 校验（错误信息遵循「哪里错+怎么改」） ---------- */
  function validate(){
    var msg = msgEl.value.trim();
    if(msg.length < 4){
      say('反馈内容太短了，请至少写 4 个字，方便我理解你的想法。', 'error');
      msgEl.focus();
      return null;
    }
    if(msg.length > MAX){
      say('反馈内容超出 ' + MAX + ' 字上限，请精简后提交。', 'error');
      msgEl.focus();
      return null;
    }
    var mail = mailEl.value.trim();
    if(mail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)){
      say('邮箱格式看起来不对，正确形式如 name@example.com；也可以留空。', 'error');
      mailEl.focus();
      return null;
    }
    return { name: nameEl.value.trim(), contact: mail, message: msg,
             page: location.pathname };
  }

  /* ---------- 提交 ---------- */
  form.addEventListener('submit', function(e){
    e.preventDefault();
    var data = validate();
    if(!data) return;

    submitEl.disabled = true;
    submitEl.textContent = '正在送达…';
    say('正在把你的反馈送到我的后台…', '');

    window.FeedbackStore.submit(data).then(function(res){
      form.reset();
      syncCount();
      var where = res.mode === 'cloud' ? '已保存到我的云端后台' : '已保存在本机（云端未配置）';
      say('收到了，谢谢你的反馈！' + where + '，我会认真读的。', 'ok');
      submitEl.disabled = false;
      submitEl.textContent = '再写一条';
    }).catch(function(err){
      submitEl.disabled = false;
      submitEl.textContent = '重新发送';
      say('没能送达：' + (err && err.message ? err.message : '未知错误') +
          '。请检查网络后重试，或直接邮件联系我。', 'error');
    });
  });

  /* ---------- 洞窟光效下保障表单可见：聚焦时把火把移到表单区 ---------- */
  var section = document.getElementById('feedback');
  function drawLightToForm(){
    var e = window.CaveLight && window.CaveLight._engine;
    if(!e || !e.started) return;
    // 等滚动稳定后再测量，否则 rect 取自滚动中途、火把会被引到错误位置
    requestAnimationFrame(function(){
      setTimeout(function(){
        var r = section.getBoundingClientRect();
        if(r.bottom < 0 || r.top > innerHeight) return;      // 不在视口内则不引导
        // 火把停在表单「上方外侧」，照亮周边而不压住输入区（避免与表单抢焦点）
        var cy = Math.round(Math.max(70, r.top - 90));
        e.tx = Math.round(r.left + r.width * 0.22);
        e.ty = cy;
        e.moved = true;
        if(e.handoff) e.handoff = false;                     // 表单优先，立即进入跟手
      }, 120);
    });
  }
  [nameEl, mailEl, msgEl].forEach(function(el){
    el.addEventListener('focus', drawLightToForm);
  });

  /* 表单进入视口时也把光引过来，避免访客面对一片黑 */
  if('IntersectionObserver' in window){
    var io = new IntersectionObserver(function(entries){
      entries.forEach(function(en){ if(en.isIntersecting) drawLightToForm(); });
    }, { threshold: 0.35 });
    io.observe(section);
  }
})();
