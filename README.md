# 小店搭子

单店 WhatsApp AI 工作台。前端使用 React + Vite，当前源码使用 Express 服务端提供静态页面和受保护的业务 API。

## 当前状态

线上现有版本是演示版。本仓库还包含尚未部署、尚未完成真实服务联调的接入代码，不代表 WAHA / Hermes 集成已经验证完成。

- `/`：浏览器本地演示空间。
- `/?live=1`：真实工作台登录入口，需要服务端环境配置。
- `server/index.mjs`：登录、PostgreSQL、WAHA、Hermes 和 CLI-to-API 连接实现。
- 当前尚未修改既有 wa-router，也未完成端到端人工接管和模型调用验证。

## 本地运行

```sh
npm ci
npm run dev
```

## 生产构建

```sh
npm run build
```

Zeabur 使用项目根目录的 Dockerfile 构建，HTTP 端口为 8080。

## 已实现

- 首页、消息、预约、AI 助手、设置五个页面。
- 四种行业模板，各自保存演示数据。
- 预约增改、员工时段冲突检查、营业时间检查。
- 对话人工接管、保存本地回复、恢复 AI 状态。
- AI 身份草稿及发布版本。
- PDF（文字版）、DOCX、TXT、MD、CSV 本地文字提取，知识预览和停用。
- 规则模拟聊天、资料来源、演示身份检查。
- 服务价格、人员号码和角色配置、操作记录。

## 演示边界

演示入口没有接入 WAHA、Hermes、后端数据库或真实登录。演示业务记录和上传文字仅保存在访问者自己的浏览器 localStorage，不会跨设备或跨访问者同步。演示角色界面和规则模拟不构成真实服务端授权。演示页面不会发送 WhatsApp 消息。

真实入口配置并部署后会访问真实数据，人工发送功能会发送 WhatsApp 消息。它不是演示沙盒；正式使用前仍需完成身份、权限、接管竞态和失败重试联调。

AI 的自由指令、语言和语气会保存，但测试区使用确定性规则匹配，不能验证真实模型效果。

## 后续真实接入

真实接入依赖已有 wa-router 的数据库结构（tenants、contacts、bookings、sop_rules、audit_log、processed_events）。本仓库不包含生产数据或密钥。

服务端变量：DATABASE_URL、TENANT_ID、WAHA_URL、WAHA_API_KEY、WAHA_SESSION、HERMES_API_URL、HERMES_API_KEY、HERMES_DASH_USER、HERMES_DASH_PASS、CLI_API_URL、CLI_API_KEY、PUBLIC_ORIGIN、PORT、NODE_ENV。仅在部署平台的服务端配置，切勿写入前端或提交到 Git。

登录沿用配置的 Hermes 管理员用户名和密码；会话为服务端内存会话，重启后需要重新登录。真实部署仍需完成现有消息路由协调，不得同时注册重复回复的机器人。不得在浏览器存储 WAHA 或模型密钥。
