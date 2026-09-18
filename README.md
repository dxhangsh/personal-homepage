# 个人主页 · 陈胤璋

一个纯静态（零构建、零依赖）的个人主页，胡桃木 × 橡木拟物化风格。

## 在线访问

**https://dxhangsh.github.io/personal-homepage/**

- 主页（含反馈入口）：`v2-preview.html`
- 反馈后台（仅本人使用，已设 noindex）：`admin.html`

反馈数据存放在 Supabase 云端，其他人提交的内容不会自动公开，只有本人在后台可见。

## 版本

| 版本 | 内容 |
| --- | --- |
| V1 | 骨架与视觉方向（胡桃木 × 橡木 × 黄铜拟物化） |
| V2 | 视觉打磨：质感升级、柔和提亮、洞窟探索光效、引子 |
| V3 | 反馈功能（前端表单 + 后台控制台）+ 公开发布 |

## 目录结构

```
index.html          V1 正式版
v2-preview.html     V2/V3 预览版（含洞窟光效、引子、反馈表单）
admin.html          反馈后台（仅本人使用，已设 noindex）
css/                样式（styles.css = V1，styles-v2.css / styles-v3.css = 覆盖层）
js/                 脚本（main.js = V1；其余为 V2/V3 模块）
assets/             贴图与图片
supabase-setup.sql  反馈表建表与 RLS 策略脚本
```

## 反馈功能说明

数据层支持双模，自动切换：

- **云端模式**：在 `js/config.js` 填入 Supabase 的 `supabaseUrl` 与 `supabaseAnonKey` 后自动启用
- **本地模式**：未配置时使用浏览器 localStorage（便于本地测试）

**安全约定**：前端只使用 anon public key（设计上可公开），数据安全由 Supabase 的 RLS 行级安全策略保证；`service_role` 私钥严禁出现在任何前端文件中。

建表与策略见 `supabase-setup.sql`，在 Supabase 控制台的 SQL Editor 中执行。

## 本地预览

```bash
python -m http.server 8124 --bind 127.0.0.1
```

然后访问 `http://127.0.0.1:8124/v2-preview.html`。

## 记录

开发全过程记录见 `WORKLOG.md`。
