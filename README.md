# 🎲 课堂点名系统

教室上课签到 & 随机点名系统。教师创建课程 → 学生扫码签到 → 教师网格监控 + 随机抽取点名。

## 功能

- **📱 扫码签到**：学生扫描二维码，填写学号姓名选择座位签到
- **🗺 网格视图**：实时座位网格，签到/空位/冲突一目了然
- **🎲 随机点名**：已签到学生中随机滚动抽取，支持框选区域范围内点名
- **📋 列表视图**：传统表格模式，支持手动补签、重置签到
- **📥 CSV 导出**：一键导出含签到状态的完整名单
- **🔗 实时推送**：SSE 技术，签到/重置即时同步到教师端
- **🔐 教师认证**：注册/登录，课程数据隔离

## 技术栈

| 层 | 技术 |
|---|------|
| 后端 | Node.js + Express |
| 模板 | EJS |
| 数据库 | SQLite (sql.js，纯 JS 实现，零依赖) |
| 实时推送 | Server-Sent Events (SSE) |
| 二维码 | qrcode 库 |
| 部署 | Docker + Nginx 反向代理 |

## 本地运行

```bash
# 安装依赖
npm install

# 启动（端口 3000）
npm start

# 开发模式（文件变更自动重启）
npm run dev
```

首次使用需创建教师账号：

```bash
node create-teacher.js 用户名 密码
```

然后访问：
- 教师端：http://localhost:3000/teacher/login
- 学生端：http://localhost:3000/student

## Docker 部署

```bash
# 生成密钥
echo "SESSION_SECRET=$(openssl rand -hex 32)" > .env

# 构建并启动（app + nginx）
docker compose up -d

# 查看日志
docker compose logs -f

# 更新代码后
git pull && docker compose build app && docker compose up -d
```

详细部署指南见 [DEPLOY.md](DEPLOY.md)。

## 项目结构

```
.
├── server.js              # Express 入口 + SSE
├── db.js                  # SQLite 数据库封装
├── routes/
│   ├── teacher.js         # 教师端路由 (470+ 行，核心业务)
│   └── student.js         # 学生端路由
├── views/
│   ├── partial/           # 公共模板 (header/footer)
│   ├── teacher/           # 教师页面 (dashboard/course/settings/login)
│   └── student/           # 学生页面 (checkin/verify)
├── public/
│   ├── style.css          # 全局样式
│   └── js/course/         # 课程页 JS 模块
│       ├── grid.js        # 座位网格 + 框选区域
│       ├── picker.js      # 随机点名状态机
│       ├── actions.js     # 课程操作（开始/结束/删除/QR）
│       ├── checkin.js     # 列表视图签到行
│       ├── manual.js      # 手动补签流程
│       ├── sse.js         # SSE 实时更新
│       └── main.js        # 视图切换 + 工具函数
├── lib/pinyin.js          # 拼音工具
├── Dockerfile
├── docker-compose.yml
├── nginx.conf
└── data/                  # SQLite 数据库文件（gitignore）
```

## 代码统计

| 类型 | 行数 |
|------|------|
| JavaScript (server + routes + 前端模块) | 1,697 |
| EJS 模板 | 761 |
| CSS | 728 |
| 文档 (Markdown) | 705 |
| 配置文件 | 112 |
| **合计** | **4,327** |

## License

MIT
