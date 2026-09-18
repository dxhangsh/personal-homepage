/* ============================================================
   个人主页 V3 · 反馈数据层（feedback-store.js）
   ------------------------------------------------------------
   设计：双模存储，零依赖
     · 模式 A（云端）Supabase REST —— 配置填入 config.js 后自动启用
     · 模式 B（本地）localStorage —— 未配置凭据时的回退，保证链路可测
   安全：
     · 仅使用 anon public key（前端可见属设计如此，靠 RLS 约束）
     · service_role 私钥严禁出现在任何前端文件
   ============================================================ */
(function(){
  'use strict';

  var CFG = window.FEEDBACK_CONFIG || {};
  var TABLE = 'feedback';
  var LS_KEY = 'v3_feedback_local';

  function isCloudReady(){
    return !!(CFG.supabaseUrl && CFG.supabaseAnonKey &&
              CFG.supabaseUrl.indexOf('http') === 0 &&
              CFG.supabaseAnonKey.length > 20);
  }

  function headers(){
    return {
      'apikey': CFG.supabaseAnonKey,
      'Authorization': 'Bearer ' + CFG.supabaseAnonKey,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    };
  }

  /* ---------- 本地回退 ---------- */
  function lsRead(){
    try{ return JSON.parse(localStorage.getItem(LS_KEY) || '[]'); }catch(e){ return []; }
  }
  function lsWrite(list){
    try{ localStorage.setItem(LS_KEY, JSON.stringify(list)); return true; }catch(e){ return false; }
  }

  /* ---------- 统一条目结构 ----------
     { id, name, contact, message, page, ua, created_at, status }
     status: new | read | archived                                        */

  function normalize(row){
    return {
      id: row.id,
      name: row.name || '',
      contact: row.contact || '',
      message: row.message || '',
      page: row.page || '',
      ua: row.ua || '',
      created_at: row.created_at || new Date().toISOString(),
      status: row.status || 'new'
    };
  }

  var Store = {
    mode: function(){ return isCloudReady() ? 'cloud' : 'local'; },

    /* 提交反馈 */
    submit: function(data){
      var entry = normalize({
        id: 'local-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7),
        name: data.name, contact: data.contact, message: data.message,
        page: data.page, ua: navigator.userAgent.slice(0, 180),
        created_at: new Date().toISOString(), status: 'new'
      });

      if(!isCloudReady()){
        var list = lsRead(); list.unshift(entry);
        return lsWrite(list)
          ? Promise.resolve({ ok: true, mode: 'local', entry: entry })
          : Promise.reject(new Error('浏览器本地存储不可用（可能处于隐私模式）'));
      }

      return fetch(CFG.supabaseUrl.replace(/\/$/, '') + '/rest/v1/' + TABLE, {
        method: 'POST', headers: headers(),
        body: JSON.stringify({
          name: entry.name, contact: entry.contact, message: entry.message,
          page: entry.page, ua: entry.ua
        })
      }).then(function(res){
        if(!res.ok){
          return res.text().then(function(t){
            throw new Error('云端写入失败（' + res.status + '）：' + (t || '').slice(0, 160));
          });
        }
        return res.json().then(function(rows){
          return { ok: true, mode: 'cloud', entry: normalize(rows[0] || entry) };
        });
      });
    },

    /* 列出反馈（后台用） */
    list: function(){
      if(!isCloudReady()){
        return Promise.resolve({ ok: true, mode: 'local', rows: lsRead().map(normalize) });
      }
      return fetch(CFG.supabaseUrl.replace(/\/$/, '') + '/rest/v1/' + TABLE +
                   '?select=*&order=created_at.desc', { headers: headers() })
        .then(function(res){
          if(!res.ok) return res.text().then(function(t){
            throw new Error('读取失败（' + res.status + '）：' + (t || '').slice(0, 160));
          });
          return res.json().then(function(rows){
            return { ok: true, mode: 'cloud', rows: rows.map(normalize) };
          });
        });
    },

    /* 更新状态（后台用；本地模式同样支持） */
    setStatus: function(id, status){
      if(!isCloudReady()){
        var list = lsRead().map(function(r){ return r.id === id ? Object.assign({}, r, {status: status}) : r; });
        lsWrite(list);
        return Promise.resolve({ ok: true, mode: 'local' });
      }
      return fetch(CFG.supabaseUrl.replace(/\/$/, '') + '/rest/v1/' + TABLE + '?id=eq.' + encodeURIComponent(id), {
        method: 'PATCH', headers: headers(), body: JSON.stringify({ status: status })
      }).then(function(res){
        if(!res.ok) throw new Error('状态更新失败（' + res.status + '）');
        return { ok: true, mode: 'cloud' };
      });
    },

    /* 清空本地数据（仅本地模式；供测试与后台清理） */
    clearLocal: function(){ lsWrite([]); return Promise.resolve({ ok: true }); }
  };

  window.FeedbackStore = Store;
})();
