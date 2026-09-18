/* ============================================================
   个人主页 V3 · 配置（config.js）
   ------------------------------------------------------------
   填入 Supabase 项目信息后，反馈功能自动切换到云端模式。
   未填写时自动使用浏览器本地存储（local mode），链路仍可完整测试。

   ⚠️ 安全须知（务必遵守）
   · 这里只允许放 anon public key —— 它是设计上可公开的前端密钥，
     数据安全由数据库的 RLS（行级安全策略）保证。
   · 严禁把 service_role 私钥写进任何前端文件或提交到 Git，
     那等于把数据库的完全控制权公开。
   · 本文件已加入 .gitignore 的示例保护说明；如需公开仓库，
     也可安全提交 anon key（配合正确的 RLS 策略）。
   ============================================================ */
window.FEEDBACK_CONFIG = {
  /* 形如 https://xxxxxxxxxxxx.supabase.co */
  supabaseUrl: '',

  /* Supabase 项目设置 → API → Project API keys → anon / public */
  supabaseAnonKey: ''
};
