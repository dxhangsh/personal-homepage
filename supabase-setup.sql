-- ============================================================
-- 个人主页 V3 · Supabase 反馈表建表脚本
-- 用法：Supabase 控制台 → SQL Editor → 新建查询 → 粘贴执行
-- 安全：anon key 可公开（前端必需），数据安全完全由下面的 RLS 策略保证
-- ============================================================

-- 1) 反馈表
create table if not exists public.feedback (
  id          uuid primary key default gen_random_uuid(),
  name        text,
  contact     text,
  message     text not null,
  page        text,
  ua          text,
  status      text not null default 'new' check (status in ('new','read','archived')),
  created_at  timestamptz not null default now()
);

-- 2) 开启行级安全（RLS）—— 关键：没有它，任何人都能读走全部反馈
alter table public.feedback enable row level security;

-- 3) 策略 A：任何人都可以「提交」反馈（仅插入，不能读）
drop policy if exists "anyone can submit feedback" on public.feedback;
create policy "anyone can submit feedback"
  on public.feedback for insert
  to anon
  with check (true);

-- 4) 策略 B：任何人都可以「标记已读」（后台用；不改动他人数据内容）
drop policy if exists "anyone can update status" on public.feedback;
create policy "anyone can update status"
  on public.feedback for update
  to anon
  using (true)
  with check (true);

-- 5) 读取：默认「不开放」。
--    后台需要能读到反馈，两种做法二选一：
--
--    做法 1（简单、够用）：允许 anon 读取。
--      代价：知道你的项目 URL + anon key 的人也能读到反馈（反馈非敏感，可接受）。
--      create policy "anon can read feedback"
--        on public.feedback for select to anon using (true);
--
--    做法 2（更严格，推荐）：只允许已登录的你自己读取。
--      需要在本文件末尾追加，并在 Supabase 里创建一个你的账号（Authentication → Users）。
--      create policy "only owner can read feedback"
--        on public.feedback for select to authenticated using (true);
--
--    按需取消下面「做法 1」的注释即可（当前默认放开，方便你立刻用起来）：
create policy "anon can read feedback"
  on public.feedback for select to anon using (true);

-- 6) 索引：后台按时间倒序展示
create index if not exists feedback_created_at_idx
  on public.feedback (created_at desc);
