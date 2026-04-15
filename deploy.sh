#!/bin/bash
# ==========================================
# 高考作文素材库「拾光阅」一键部署脚本
# 使用方法：bash deploy.sh
# ==========================================

set -e

# ---------- 配置区（按提示输入）----------
echo ""
echo "=========================================="
echo "  高考作文素材库「拾光阅」一键部署"
echo "=========================================="
echo ""

# 检测是否 root
if [ "$EUID" -ne 0 ]; then
  echo "请使用 root 用户运行：sudo bash deploy.sh"
  exit 1
fi

# 交互式输入
read -p "管理后台用户名 [admin]: " ADMIN_USER
ADMIN_USER=${ADMIN_USER:-admin}

read -sp "管理后台密码（至少6位）: " ADMIN_PASS
echo ""
if [ ${#ADMIN_PASS} -lt 6 ]; then
  echo "❌ 密码至少6位"
  exit 1
fi

read -p "域名或公网IP（如 example.com 或 1.2.3.4）: " DOMAIN
if [ -z "$DOMAIN" ]; then
  echo "❌ 必须输入域名或IP"
  exit 1
fi

INSTALL_DIR="/opt/WritingGuidance"

echo ""
echo "即将部署到: $INSTALL_DIR"
echo "访问地址: http://$DOMAIN"
echo ""

# ---------- 1. 安装 Node.js ----------
echo ">>> [1/6] 安装 Node.js ..."
if ! command -v node &> /dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
  apt-get install -y nodejs
fi
echo "  Node.js $(node -v) ✅"

# ---------- 2. 安装依赖工具 ----------
echo ">>> [2/6] 安装 PM2、Nginx、Git ..."
npm install -g pm2 2>/dev/null || true
apt-get update -qq
apt-get install -y nginx git > /dev/null 2>&1
echo "  ✅"

# ---------- 3. 拉取项目 ----------
echo ">>> [3/6] 拉取项目代码 ..."
if [ -d "$INSTALL_DIR" ]; then
  echo "  检测到已存在，拉取最新代码 ..."
  cd $INSTALL_DIR && git pull
else
  git clone https://github.com/zjw-711/WritingGuidance.git $INSTALL_DIR
  cd $INSTALL_DIR
fi
npm install --production
echo "  ✅"

# ---------- 4. 创建管理员 ----------
echo ">>> [4/6] 创建管理员账户 ..."
node -e "
const { getDb } = require('./db');
const db = getDb();
const { createUser } = require('./auth');
try {
  createUser('${ADMIN_USER}', '${ADMIN_PASS}', 'admin');
  console.log('  ✅');
} catch(e) {
  if (e.message.includes('UNIQUE')) {
    console.log('  用户已存在，跳过 ✅');
  } else {
    throw e;
  }
}
"

# ---------- 5. 启动服务 ----------
echo ">>> [5/6] 启动服务 ..."
NODE_ENV=production pm2 delete gaokao 2>/dev/null || true
NODE_ENV=production pm2 start server.js --name gaokao
pm2 save
# 设置开机自启
pm2 startup 2>/dev/null | tail -1 > /tmp/pm2_startup.sh
bash /tmp/pm2_startup.sh 2>/dev/null || true
echo "  ✅"

# ---------- 6. 配置 Nginx ----------
echo ">>> [6/6] 配置 Nginx 反向代理 ..."
cat > /etc/nginx/sites-available/gaokao << NGINX_CONF
server {
    listen 80;
    server_name ${DOMAIN};

    client_max_body_size 10m;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
NGINX_CONF

ln -sf /etc/nginx/sites-available/gaokao /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
echo "  ✅"

# ---------- 防火墙 ----------
ufw allow 22 2>/dev/null || true
ufw allow 80 2>/dev/null || true
ufw allow 443 2>/dev/null || true

# ---------- 自动备份 ----------
cat > /opt/backup_gaokao.sh << 'BACKUP'
#!/bin/bash
DIR="/opt/backups"
mkdir -p $DIR
cp /opt/WritingGuidance/data/gaokao.db "$DIR/gaokao_$(date +%F).db"
find $DIR -name "gaokao_*.db" -mtime +30 -delete
BACKUP
chmod +x /opt/backup_gaokao.sh
(crontab -l 2>/dev/null; echo "0 3 * * * /opt/backup_gaokao.sh") | crontab -

# ---------- 完成 ----------
echo ""
echo "=========================================="
echo "  🎉 部署完成！"
echo ""
echo "  学生端：http://${DOMAIN}"
echo "  管理后台：http://${DOMAIN}/admin"
echo "  用户名：${ADMIN_USER}"
echo ""
echo "  日常命令："
echo "    查看状态：pm2 status"
echo "    查看日志：pm2 logs gaokao"
echo "    重启服务：pm2 restart gaokao"
echo "    更新代码：cd ${INSTALL_DIR} && git pull && npm install && pm2 restart gaokao"
echo ""
echo "  如需 HTTPS，运行："
echo "    apt install -y certbot python3-certbot-nginx"
echo "    certbot --nginx -d ${DOMAIN}"
echo "=========================================="
