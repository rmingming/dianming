# 教室上课点名系统 — 需求文档

> 版本：v3.0 | 日期：2026-06-12 | 状态：已实现

---

## 1. 项目概述

### 1.1 项目背景

传统课堂点名耗时且容易出现代签、漏签等问题。本系统提供一套轻量级 Web 签到方案：学生通过手机浏览器访问签到页面，填写学号、姓名和座位坐标完成签到；教师通过后台实时查看签到情况，并可对异常签到进行重置。

### 1.2 核心目标

- **学生端**：无需安装 App，手机浏览器打开即用，10 秒内完成签到。
- **教师端**：实时查看签到列表，一目了然识别空位和冲突，一键重置异常签到。

### 1.3 技术边界

- 纯 Web 实现，无需原生 App
- **支持多课程同时进行**（多个教师可各自开课，互不干扰）
- 部署到服务器，学生和教师通过网络访问
- 教师后台需密码登录保护
- 座位范围 ≤ 20 排 × 20 列

---

## 2. 角色定义

| 角色 | 说明 |
|------|------|
| **教师** | 注册/登录后台，创建课程、导入学生名单、查看签到、重置签到 |
| **学生** | 通过手机浏览器输入课程口令 + 学号 + 姓名 + 座位完成签到 |

---

## 3. 功能需求

### 3.1 教师端功能

#### 3.1.1 教师账号

| 编号 | 需求 | 优先级 |
|------|------|--------|
| T-00 | 管理员通过**命令行创建教师账号**（`node create-teacher.js 用户名 密码`），公网无法注册 | P0 ✅ |
| T-00b | 教师使用用户名 + 密码**登录**后台系统 | P0 ✅ |
| T-00c | 登录状态通过 Session 保持，支持**注销** | P0 ✅ |

#### 3.1.2 课程管理

| 编号 | 需求 | 优先级 |
|------|------|--------|
| T-01 | 教师可以**创建多门课程**，每门课程独立管理 | P0 |
| T-02 | 创建课程时设置：课程名称、最大排数（≤20）、最大列数（≤20）、学生名单 | P0 |
| T-03 | 教师可以**开始/结束**某门课程的签到，系统自动生成 4 位数字口令 | P0 |
| T-04 | 教师可以查看当前课程的**口令**，支持**重新生成** | P1 |
| T-05 | 课程结束后学生无法签到，但教师仍可查看签到记录 | P0 |
| T-06 | 教师可以查看自己**所有课程的历史记录** | P0 ✅ |
| T-06b | 教师可查看课程**二维码**，投影到屏幕供学生扫码直达签到 | P1 ✅ |

#### 3.1.3 学生名单管理

| 编号 | 需求 | 优先级 |
|------|------|--------|
| T-07 | 创建课程时，教师可粘贴学生名单（格式：`学号,姓名`，每行一个） | P0 |
| T-08 | 学生签到时，后端**校验学号是否存在于名单中**，且姓名是否匹配 | P0 |
| T-09 | 名单外的学号**拒绝签到**，提示"学号不在本课程名单中" | P0 |
| T-10 | 教师可查看名单中**未签到学生**列表 | P1 |

#### 3.1.4 签到监控面板

| 编号 | 需求 | 优先级 |
|------|------|--------|
| T-11 | **实时签到列表**：表格展示已签到学生（学号、姓名、排、列、签到时间） | P0 |
| T-12 | **座位网格视图**：俯视图展示签到情况，已签到格子显示**学生姓名**（冲突红色高亮） | P0 ✅ |
| T-13 | **冲突高亮**：同一座位多人签到时红色标记 | P0 |
| T-14 | **统计概览**：应到人数、已签到人数、未签到人数、签到率 | P1 |
| T-15 | 签到列表支持**按排、列排序**，方便按座位核对 | P2 |

#### 3.1.5 签到管理

| 编号 | 需求 | 优先级 |
|------|------|--------|
| T-16 | 教师可以**重置某条签到**（二次确认），学生可重新签到 | P0 |
| T-17 | 重置为**软删除**，保留历史记录供追溯 | P0 |
| T-18 | 教师可以**手动代签**，从**未签到学生列表中选择**，只需输入排和列 | P2 ✅ |
| T-19 | 教师可以**导出签到列表**为 CSV 文件（UTF-8 BOM，Excel 直接打开） | P2 ✅ |

---

### 3.2 学生端功能

#### 3.2.1 签到流程

| 编号 | 需求 | 优先级 |
|------|------|--------|
| S-01 | 手机浏览器访问签到页面（无需登录） | P0 |
| S-02 | 输入**课程口令**进行验证，或**扫描二维码**自动验证直达签到表单 | P0 ✅ |
| S-02b | 二维码 URL 带 `?code=` 参数，服务端自动验证口令，跳过手动输入 | P1 ✅ |
| S-03 | 口令验证通过后显示课程名称，进入签到表单 | P0 ✅ |
| S-04 | 签到表单字段：**学号**、**姓名**、**排**（下拉 1~max）、**列**（下拉 1~max） | P0 ✅ |
| S-05 | 前端校验：所有字段必填，排/列在范围内 | P0 ✅ |
| S-06 | 后端校验：①口令有效 ②学号在名单中 ③姓名与名单匹配 ④该学号未重复签到 ⑤座位未被占用 | P0 ✅ |
| S-07 | 签到成功显示确认信息（学号 + 姓名 + 座位 + 时间） | P0 ✅ |
| S-08 | 签到失败显示具体错误原因 | P0 ✅ |

#### 3.2.2 重新签到

| 编号 | 需求 | 优先级 |
|------|------|--------|
| S-09 | 教师重置后，学生可用原学号重新签到 | P0 |
| S-10 | 重新签到流程与首次一致 | P0 |

---

## 4. 页面清单

### 4.1 教师端页面

| 页面 | 路由 | 说明 |
|------|------|------|
| 登录页 | `/teacher/login` | 用户名 + 密码登录（注册页面已移除，账号由管理员命令行创建） |
| 课程列表 | `/teacher/dashboard` | 查看所有课程，创建新课程，进入某门课程 |
| 课程详情 | `/teacher/course/:id` | 签到监控面板：统计 + 列表视图 + 网格视图 + 二维码弹窗 |
| 课程设置 | `/teacher/course/:id/settings` | 编辑课程名称、座位范围、学生名单 |

### 4.2 学生端页面

| 页面 | 路由 | 说明 |
|------|------|------|
| 口令验证 | `/student` | 输入课程口令 |
| 签到表单 | `/student/checkin/:sessionId` | 填写学号、姓名、排、列 |
| 签到结果 | 同表单页（弹窗/消息） | 成功/失败提示 |

---

## 5. 数据模型

### 5.1 数据库表

```
teachers
├── id          INTEGER PRIMARY KEY AUTOINCREMENT
├── username    TEXT UNIQUE NOT NULL        — 教师用户名
├── password    TEXT NOT NULL               — bcrypt 哈希
└── created_at  TEXT DEFAULT (datetime('now'))

courses
├── id          INTEGER PRIMARY KEY AUTOINCREMENT
├── teacher_id  INTEGER NOT NULL REFERENCES teachers(id)
├── name        TEXT NOT NULL               — 课程名称
├── password    TEXT NOT NULL               — 4位签到口令
├── max_row     INTEGER NOT NULL DEFAULT 10 — 最大排数 (≤20)
├── max_col     INTEGER NOT NULL DEFAULT 10 — 最大列数 (≤20)
├── status      TEXT NOT NULL DEFAULT 'active' — 'active' | 'ended'
├── created_at  TEXT
└── ended_at    TEXT

students (课程学生名单)
├── id          INTEGER PRIMARY KEY AUTOINCREMENT
├── course_id   INTEGER NOT NULL REFERENCES courses(id)
├── student_id  TEXT NOT NULL               — 学号
├── name        TEXT NOT NULL               — 姓名
└── UNIQUE(course_id, student_id)

checkins
├── id          INTEGER PRIMARY KEY AUTOINCREMENT
├── course_id   INTEGER NOT NULL REFERENCES courses(id)
├── student_id  TEXT NOT NULL               — 学号
├── name        TEXT NOT NULL               — 签到时的姓名
├── row         INTEGER NOT NULL
├── col         INTEGER NOT NULL
├── created_at  TEXT DEFAULT (datetime('now'))
├── reset_at    TEXT                        — NULL=有效, 非NULL=已重置
└── UNIQUE(course_id, student_id, reset_at) — 同一学生有效记录唯一
```

### 5.2 关键约束

| 约束 | 实现 |
|------|------|
| 同一课程内有效签到 `student_id` 唯一 | `UNIQUE(course_id, student_id)` WHERE reset_at IS NULL |
| 同一课程内 `(row, col)` 有效签到唯一 | 应用层校验 |
| 学号必须在课程名单中 | 签到前查询 `students` 表 |
| 密码 bcrypt 加密 | `bcrypt.hashSync()` |

---

## 6. API 设计

### 6.1 教师端 API

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| `POST` | `/api/teacher/register` | 无 | 教师注册 |
| `POST` | `/api/teacher/login` | 无 | 教师登录 |
| `POST` | `/api/teacher/logout` | Session | 教师注销 |
| `POST` | `/api/courses` | Session | 创建课程 |
| `GET` | `/api/courses` | Session | 获取教师的所有课程 |
| `GET` | `/api/courses/:id` | Session | 获取课程详情 |
| `PUT` | `/api/courses/:id` | Session | 更新课程配置 |
| `POST` | `/api/courses/:id/start` | Session | 开始签到（生成口令，激活课程） |
| `POST` | `/api/courses/:id/end` | Session | 结束签到 |
| `POST` | `/api/courses/:id/regenerate-password` | Session | 重新生成口令 |
| `GET` | `/api/courses/:id/checkins` | Session | 获取签到列表 |
| `DELETE` | `/api/courses/:id/checkins/:checkinId` | Session | 重置签到 |
| `POST` | `/api/courses/:id/checkins` | Session | 教师代签 |
| `GET` | `/api/courses/:id/export` | Session | 导出签到 CSV |

### 6.2 学生端 API

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/api/student/verify` | 验证课程口令，返回课程信息 |
| `POST` | `/api/student/checkin` | 提交签到 |

### 6.3 请求/响应示例

**验证口令**：
```json
// POST /api/student/verify
// Request
{ "password": "3721" }

// Response 200
{ "courseId": 1, "courseName": "高等数学 第3周", "maxRow": 10, "maxCol": 12 }

// Response 404
{ "error": "口令无效或课程已结束" }
```

**提交签到**：
```json
// POST /api/student/checkin
// Request
{ "courseId": 1, "studentId": "2024001", "name": "张三", "row": 3, "col": 4 }

// Response 201
{ "id": 1, "studentId": "2024001", "name": "张三", "row": 3, "col": 4, "createdAt": "..." }

// Response 409 — 座位冲突
{ "error": "该座位(3排4列)已被占用，请确认座位后重试" }

// Response 409 — 学号无效
{ "error": "学号 2024001 不在本课程名单中" }

// Response 409 — 姓名不匹配
{ "error": "姓名与名单中的姓名不一致" }

// Response 409 — 已签到
{ "error": "该学号已签到过了，如需修改请联系教师重置" }
```

---

## 7. 非功能需求

| 编号 | 需求 | 说明 |
|------|------|------|
| NF-01 | **响应式设计** | 学生端适配手机（375px+），教师端适配桌面/平板（768px+） |
| NF-02 | **实时刷新** | 教师端签到列表通过 SSE 自动推送更新 |
| NF-03 | **数据持久化** | SQLite 数据库存储，服务重启不丢数据 |
| NF-04 | **并发安全** | 座位占用检查使用数据库事务，防止竞态条件 |
| NF-05 | **会话隔离** | 不同课程口令对应不同课程，互不干扰 |
| NF-06 | **简单部署** | `npm install && node server.js` 即可运行 |
| NF-07 | **密码安全** | 教师密码 bcrypt 加密，Session 防伪造 |

---

## 8. 技术方案（已确定）

| 层级 | 选型 | 理由 |
|------|------|------|
| 运行时 | Node.js v24 | 轻量、事件驱动、适合实时推送 |
| 框架 | Express v4 | 成熟稳定、生态丰富 |
| 模板引擎 | EJS | 简单直观，无需前端构建 |
| 数据库 | **sql.js**（WASM 版 SQLite） | 零编译依赖，`npm install` 即用；内存操作 + 手动持久化到文件 |
| 实时推送 | **SSE** (Server-Sent Events) | 单向推送，比 WebSocket 更简单，浏览器原生 `EventSource` |
| 密码加密 | bcryptjs | 纯 JS 实现，无需编译 |
| 会话管理 | express-session | 成熟方案 |
| 二维码 | qrcode | 服务端生成 SVG 二维码，教师投影到屏幕供学生扫码 |
| 部署 | nginx + PM2 | nginx 处理 HTTPS/静态文件/SSE 缓冲，PM2 守护进程 |

---

## 9. 项目结构

```
dianming/
├── server.js              — 应用入口（Express + Session + SSE）
├── package.json
├── db.js                  — 数据库层（sql.js WASM + 手动持久化）
├── .gitignore             — Git 忽略规则
├── routes/
│   ├── teacher.js         — 教师端路由（注册/登录/课程/签到/二维码）
│   └── student.js         — 学生端路由（口令验证/扫码自动验证/签到提交）
├── views/
│   ├── partial/
│   │   ├── header.ejs     — 公共页头
│   │   └── footer.ejs     — 公共页尾
│   ├── teacher/
│   │   ├── login.ejs      — 登录页
│   │   ├── register.ejs   — 注册页
│   │   ├── dashboard.ejs  — 课程列表（含创建课程表单）
│   │   ├── course.ejs     — 签到监控面板（列表+网格+二维码弹窗+SSE实时）
│   │   └── settings.ejs   — 课程设置（名称/座位/学生名单）
│   └── student/
│       ├── verify.ejs     — 口令验证页（支持扫码自动验证）
│       └── checkin.ejs    — 签到表单页（含成功/失败结果）
├── public/
│   └── style.css          — 全局响应式样式
├── create-teacher.js      — 命令行创建教师账号（仅管理员）
├── test.js                — 核心功能集成测试
├── test_qr.js             — 二维码功能测试
├── Dockerfile             — Docker 镜像构建
├── docker-compose.yml     — 一键部署编排
├── nginx.conf             — 反向代理配置
├── .env.example           — 环境变量模板
├── DEPLOY.md              — 云部署指南
└── data/
    └── dianming.db        — SQLite 数据库文件（自动生成，服务重启不丢失）
```

---

## 10. 业务流程图

### 10.1 正常签到流程

```
教师注册 → 登录 → 创建课程(名称+座位范围+学生名单) → 开始签到(生成口令)
    → 学生访问签到页 → 输入口令 → 验证通过
    → 填写学号+姓名+座位 → 提交
    → 后端校验(学号✓ 姓名✓ 座位✓) → 签到成功
    → 教师后台实时显示
```

### 10.2 二维码扫码流程（v3.0 新增）

```
教师点击「📱 二维码」→ 弹窗展示签到二维码（投影到屏幕）
    → 学生手机相机扫码 → 浏览器打开 /student?code=口令
    → 服务端自动验证口令 → 直达签到表单
    → 填写学号+姓名+座位 → 提交 → 成功
```

### 10.3 冲突/纠错流程

```
学生签到座位已被占 → 提示"座位冲突"
    → 学生与教师确认 → 教师重置错误记录
    → 学生重新签到 → 成功
```

---

## 11. 部署方案

| 组件 | 选型 | 说明 |
|------|------|------|
| 云服务器 | 阿里云 ECS / 腾讯云 CVM（2核2G） | 单机足够支撑全校使用 |
| 反向代理 | nginx | HTTPS 终结点、静态文件、SSE 缓冲关闭 |
| 进程守护 | PM2 | 崩溃重启、开机自启、日志管理 |
| 数据库备份 | cron + rsync | 定时备份 `data/dianming.db` 到其他目录/服务器 |

部署架构：

```
用户浏览器（HTTPS）
       │
  ┌────▼──────────────┐
  │  nginx (443)       │  SSL + 静态文件 + 反向代理
  └────┬──────────────┘
       │ localhost:3000
  ┌────▼──────────────┐
  │  PM2 → Node.js     │  进程守护
  │  └─ server.js      │
  │     └─ sql.js      │  内存数据库 + data/dianming.db 持久化
  └────────────────────┘
```

---

## 12. 实现状态

| 模块 | 状态 |
|------|------|
| 教师登录（bcrypt + Session） | ✅ 已实现 |
| 命令行创建教师账号（公网注册已关闭） | ✅ 已实现 |
| 多课程管理（创建/开始/结束/设置） | ✅ 已实现 |
| 学生名单导入与学号校验 | ✅ 已实现 |
| 学生签到（口令验证 + 座位选择） | ✅ 已实现 |
| 座位冲突检测 | ✅ 已实现 |
| 教师重置签到（软删除） | ✅ 已实现 |
| SSE 实时推送（教师面板自动更新） | ✅ 已实现 |
| 座位网格视图（显示学生姓名） | ✅ 已实现 |
| 二维码扫码直达签到 | ✅ 已实现 |
| 从未签到列表手动补签 | ✅ 已实现 |
| CSV 导出（UTF-8 BOM） | ✅ 已实现 |
| 响应式设计（手机 + 桌面） | ✅ 已实现 |
| Docker / nginx / PM2 部署 | 📋 待实现 |
| 应到学生名单导入（CSV 文件上传） | 📋 待实现 |

> **状态：已确认 ✅**  
> 下一步：编码实现
