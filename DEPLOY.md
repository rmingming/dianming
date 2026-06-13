# 云服务器部署指南

## 总览

```
                    互联网
                       │
              ┌────────▼────────┐
              │  云负载均衡 (HTTPS) │  ← 云厂商自带，免费
              └────────┬────────┘
                       │ :80
              ┌────────▼────────┐
              │    nginx 容器     │  ← 反向代理 + 静态文件
              └────────┬────────┘
                       │ :3000
              ┌────────▼────────┐
              │    Node.js 容器   │  ← 点名系统
              │   (Express)      │
              │   (sql.js)       │
              └────────┬────────┘
                       │
              ┌────────▼────────┐
              │  SQLite db 卷    │  ← 数据持久化
              └─────────────────┘
```

## 一、云服务器准备

推荐：**阿里云 ECS** 或 **腾讯云 CVM**，最低配置 2核2G（约 50 元/月）。

```bash
# SSH 登录到服务器
ssh root@你的服务器IP
```

系统选 Ubuntu 22.04 或 CentOS 8+。

## 二、安装 Docker

```bash
# 一键安装（Ubuntu）
curl -fsSL https://get.docker.com | bash

# 安装 docker-compose-plugin
apt install docker-compose-plugin -y

# 验证
docker --version
docker compose version
```

## 三、上传项目

```bash
# 在服务器上
mkdir -p /opt/dianming
cd /opt/dianming

# 方式1：从本地上传（在你的电脑上执行）
# scp -r ./* root@服务器IP:/opt/dianming/

# 方式2：从 GitHub 克隆（如果推了仓库）
# git clone ...
```

## 四、配置环境变量

```bash
cd /opt/dianming

# 生成随机密钥
echo "SESSION_SECRET=$(openssl rand -hex 32)" > .env

# 确认
cat .env
```

## 五、启动服务

```bash
docker compose up -d
```

```bash
# 查看日志
docker compose logs -f

# 查看状态
docker compose ps
```

## 六、配置 HTTPS

### 阿里云 / 腾讯云

1. 在云控制台添加域名解析（A 记录 → 服务器 IP）
2. 申请免费 SSL 证书（云厂商自带）
3. 在**负载均衡**或 **CDN** 层配置 HTTPS，回源到服务器 80 端口

> 这样证书在云平台自动续期，不需要在服务器上配 certbot。

### 自配证书（certbot）

```bash
# 安装 certbot
apt install certbot python3-certbot-nginx -y

# 首先修改 nginx.conf 中的 server_name 为实际域名
vim nginx.conf   # server_name your-domain.com;

# 申请证书
certbot --nginx -d your-domain.com

# 重启
docker compose restart nginx
```

## 七、维护命令

```bash
# 更新代码
cd /opt/dianming
git pull                              # 拉新代码
docker compose build app              # 重建镜像
docker compose up -d                  # 重启

# 备份数据库
cp data/dianming.db backups/dianming-$(date +%Y%m%d).db

# 查看数据库内容
docker compose exec app node -e "
  const db = require('./db');
  db.init().then(() => {
    const r = require('./db').all('SELECT COUNT(*) as c FROM checkins');
    console.log('签到记录数:', r[0].c);
  });
"
```

## 八、成本估算

| 项目 | 月费 |
|------|------|
| 云服务器 2核2G | ~50 元 |
| 域名（可选） | ~5 元 |
| SSL 证书 | 免费（云厂商提供） |
| **合计** | **~55 元/月** |

> 如果暂不绑域名，直接用服务器公网 IP 访问也行，成本降到 ~50 元/月。

## 九、用公网 IP 直接访问（不绑域名）

如果暂时没有域名，直接用 IP：

1. 云服务器安全组开放 **80 端口**
2. `docker compose up -d` 启动
3. 访问 `http://你的公网IP/student`

二维码也会自动生成 IP 地址。

> ⚠️ 不绑域名就没有 HTTPS，浏览器会显示"不安全"。生产环境建议加域名 + 证书。
