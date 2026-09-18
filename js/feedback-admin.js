/* ============================================================
   个人主页 V3 · 反馈后台逻辑（feedback-admin.js）
   功能：列出反馈 / 搜索 / 按状态筛选 / 标记已读 / 导出 CSV
   ============================================================ */
(function(){
  'use strict';

  var rows = [], filter = 'all', q = '';

  var listEl = document.getElementById('list');
  var modeTag = document.getElementById('modeTag');
  var noteLocal = document.getElementById('noteLocal');

  function esc(s){
    return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
    });
  }

  function fmt(iso){
    var d = new Date(iso);
    if(isNaN(d)) return iso || '';
    var p = function(n){ return n < 10 ? '0' + n : '' + n; };
    return d.getFullYear() + '-' + p(d.getMonth()+1) + '-' + p(d.getDate()) +
           ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }

  function isToday(iso){
    var d = new Date(iso), n = new Date();
    return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
  }

  function visible(){
    var needle = q.trim().toLowerCase();
    return rows.filter(function(r){
      if(filter !== 'all' && (r.status || 'new') !== filter) return false;
      if(!needle) return true;
      return (r.name + ' ' + r.contact + ' ' + r.message).toLowerCase().indexOf(needle) > -1;
    });
  }

  function render(){
    var view = visible();

    document.getElementById('cTotal').textContent = rows.length;
    document.getElementById('cNew').textContent = rows.filter(function(r){ return (r.status||'new') === 'new'; }).length;
    document.getElementById('cToday').textContent = rows.filter(function(r){ return isToday(r.created_at); }).length;

    if(!view.length){
      listEl.innerHTML = '<div class="card empty">' +
        (rows.length ? '没有符合当前筛选的反馈。试试切换筛选条件或清空搜索词。'
                     : '还没有收到反馈。<br>把主页网址分享出去，访客提交后就会出现在这里。') +
        '</div>';
      return;
    }

    listEl.innerHTML = view.map(function(r){
      var st = r.status || 'new';
      return '<article class="card fb-item">' +
        '<div class="fb-item-head">' +
          '<div class="fb-who">' + (esc(r.name) || '匿名访客') +
            (r.contact ? '<span>' + esc(r.contact) + '</span>' : '') + '</div>' +
          '<div class="fb-when">' + esc(fmt(r.created_at)) + '</div>' +
        '</div>' +
        '<p class="fb-text">' + esc(r.message) + '</p>' +
        '<div class="fb-meta">' +
          (st === 'new' ? '<span class="badge-new">未读</span>'
            : st === 'archived' ? '<span class="badge-arch">已归档</span>'
            : '<span class="badge-read">已读</span>') +
          '<span>来源：' + esc(r.page || '—') + '</span>' +
          (st === 'new'
            ? '<button class="act" data-mark="read" data-id="' + esc(r.id) + '">标记为已读</button>'
            : st === 'archived'
            ? '<button class="act" data-mark="read" data-id="' + esc(r.id) + '">恢复为已读</button>'
            : '<button class="act" data-mark="new" data-id="' + esc(r.id) + '">标记为未读</button>') +
        '</div>' +
      '</article>';
    }).join('');
  }

  function load(){
    window.FeedbackStore.list().then(function(res){
      rows = res.rows || [];
      var cloud = res.mode === 'cloud';
      modeTag.textContent = cloud ? '云端模式（Supabase）' : '本地模式（浏览器存储）';
      modeTag.className = 'mode-tag' + (cloud ? ' cloud' : '');
      noteLocal.textContent = cloud ? '' :
        '当前未配置 Supabase，数据仅存在这台设备的浏览器里；填入凭据后会自动切换到云端。';
      render();
    }).catch(function(err){
      modeTag.textContent = '读取失败';
      listEl.innerHTML = '<div class="card empty">读取反馈失败：' + esc(err.message) +
        '<br>请检查 js/config.js 里的 Supabase 地址与 anon key 是否正确。</div>';
    });
  }

  /* ---------- 交互 ---------- */
  document.getElementById('q').addEventListener('input', function(e){ q = e.target.value; render(); });

  document.querySelectorAll('.filter-btn[data-f]').forEach(function(b){
    b.addEventListener('click', function(){
      filter = b.dataset.f;
      document.querySelectorAll('.filter-btn[data-f]').forEach(function(x){ x.classList.toggle('on', x === b); });
      render();
    });
  });

  listEl.addEventListener('click', function(e){
    var btn = e.target.closest('[data-mark]');
    if(!btn) return;
    var id = btn.dataset.id, next = btn.dataset.mark;
    window.FeedbackStore.setStatus(id, next).then(function(){
      rows = rows.map(function(r){ return r.id === id ? Object.assign({}, r, {status: next}) : r; });
      render();
    }).catch(function(err){ alert('更新失败：' + err.message); });
  });

  /* ---------- 导出 CSV（含 BOM，Excel 中文不乱码） ---------- */
  document.getElementById('exportBtn').addEventListener('click', function(){
    var head = ['时间', '称呼', '邮箱', '内容', '来源页面', '状态'];
    var lines = [head.join(',')];
    visible().forEach(function(r){
      var cells = [fmt(r.created_at), r.name, r.contact, r.message, r.page,
                   (r.status || 'new') === 'new' ? '未读'
                     : (r.status === 'archived' ? '已归档' : '已读')];
      lines.push(cells.map(function(c){
        return '"' + String(c == null ? '' : c).replace(/"/g, '""') + '"';
      }).join(','));
    });
    var blob = new Blob(['\ufeff' + lines.join('\r\n')], {type: 'text/csv;charset=utf-8'});
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'feedback-' + new Date().toISOString().slice(0, 10) + '.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  });

  load();
})();
