# 📚 高考作文素材库「拾光阅」

> 为高考考生打造的作文素材积累与命题分析平台，提供素材浏览、AI 智能生成、历年真题查阅等功能。

## 功能概览

### 学生端

| 功能 | 说明 |
|------|------|
| 素材浏览 | 古风杂志风三栏布局，支持分类/标签/类型多维筛选 |
| 全文搜索 | 标题、正文、标签、话题模糊检索 |
| 阅读浮窗 | 仿书本打开的沉浸式阅读体验，一键复制 |
| 历年真题 | 2016-2025 全国各省市高考作文题，按年份/地区/关键词筛选 |

### 管理后台

| 功能 | 说明 |
|------|------|
| 素材 CRUD | 新增、编辑、删除、批量删除，支持标签/话题/延伸链接 |
| 分类管理 | 动态增删改一级/二级分类，实时生效 |
| 数据导入导出 | JSON 格式一键导出/导入 |
| AI 素材生成 | 输入话题，AI 自动生成并筛选，进入待审核队列 |
| 名著素材挖掘 | 12 部预置经典 + 自由输入任意书名，按高考主题角度生成素材 |
| 审核队列 | AI 生成的素材需人工审核后才对学生展示 |
| 数据统计 | 素材总数、分类分布、类型分布 |

### 认证权限

| 角色 | 权限范围 |
|------|---------|
| `admin` | 全部功能：素材管理、分类管理、导入导出、AI 配置与生成 |
| `editor` | 素材管理 + AI 生成/名著挖掘（不能修改分类、导入导出、AI 配置） |

## 技术栈

| 层次 | 技术 |
|------|------|
| 后端 | Node.js + Express 4 |
| 数据库 | SQLite (better-sqlite3)，WAL 模式 |
| 前端 | 原生 HTML/CSS/JS（无框架） |
| 认证 | Session + HttpOnly Cookie + bcryptjs |
| AI | OpenAI 兼容接口（智谱 GLM / DeepSeek 等） |

## 项目结构

```
WritingGuidance_high/
├── server.js              # Express 服务主入口
├── db.js                  # SQLite 初始化与表结构定义
├── auth.js                # 认证模块（用户/Session/中间件）
├── ai.js                  # AI 接口封装（生成/筛选/名著挖掘）
├── setup-admin.js         # CLI 创建管理员账户工具
├── migrate.js             # JSON → SQLite 一次性数据迁移脚本
├── batchGenerate.js       # 批量生成工具
├── package.json
│
├── data/
│   ├── gaokao.db          # SQLite 数据库（运行时生成）
│   ├── classics.json      # 名著书目配置（12 部中国经典）
│   ├── materials.json     # 原始素材数据（迁移前）
│   └── examQuestions.json # 原始真题数据（迁移前）
│
├── views/
│   └── admin.html         # 管理后台页面（需认证）
│
└── public/
    ├── index.html          # 学生端首页
    ├── exam.html           # 历年真题页
    ├── login.html          # 登录页
    ├── css/
    │   ├── style.css       # 学生端样式（古风主题）
    │   ├── admin.css       # 管理后台样式
    │   └── exam.css        # 真题页样式
    └── js/
        ├── main.js         # 学生端逻辑
        ├── admin.js        # 管理后台逻辑
        └── exam.js         # 真题页逻辑
```

## 快速开始

### 环境要求

- Node.js >= 18
- npm

### 安装

```bash
git clone https://github.com/zjw-711/WritingGuidance.git
cd WritingGuidance
npm install
```

### 创建管理员账户

```bash
npm run setup-admin
# 按提示输入用户名和密码
```

或直接在代码中创建：

```bash
node -e "
const { getDb } = require('./db');
const { createUser } = require('./auth');
require('./db');
createUser('admin', 'your_password', 'admin');
console.log('管理员创建成功');
"
```

### 启动

```bash
npm start
```

服务启动后访问：

| 页面 | 地址 |
|------|------|
| 学生端首页 | http://localhost:3001 |
| 历年真题 | http://localhost:3001/exam |
| 登录页 | http://localhost:3001/login |
| 管理后台 | http://localhost:3001/admin |

> 端口默认 3001，可通过环境变量 `PORT` 修改。

### 数据迁移（仅首次）

如果从 JSON 数据迁移到 SQLite：

```bash
node migrate.js
```

## AI 素材生成配置

进入管理后台 → **AI 素材** → **AI 接口配置**，填写：

| 配置项 | 说明 | 示例 |
|--------|------|------|
| API Base URL | OpenAI 兼容接口地址 | `https://open.bigmodel.cn/api/paas/v4` |
| API Key | 接口密钥 | 从服务商获取 |
| 模型名称 | 模型 ID | `glm-4-flash`、`deepseek-chat` 等 |

支持所有 OpenAI 兼容的 AI 服务商（智谱、DeepSeek、通义千问、Moonshot 等）。

配置完成后可点击「测试连接」验证。推理模型（如 glm-5、deepseek-r1）会自动跳过 `temperature` 和 `response_format` 参数。

## 名著素材挖掘

支持两种方式：

1. **预置书目**：从下拉建议中选择（红楼梦、三国演义、论语、史记等 12 部经典）
2. **自由输入**：手动输入任意书名（如「老人与海」「百年孤独」）

可选指定主题角度（如「逆境与超越」「真情与世俗」），AI 会围绕该主题从名著中提取人物/情节/金句，生成带论证分析的素材卡。

所有 AI 生成的素材进入「待审核队列」，管理员审核通过后才会在学生端展示。

## 数据库架构

### 主表

| 表名 | 说明 |
|------|------|
| `categories` | 一级分类（10 大类：科技人文、文化传承、青年成长等） |
| `subcategories` | 二级分类（每类 4 个子方向，共 40 个） |
| `types` | 素材类型（人物事例、时事热点、名言金句） |
| `materials` | 素材主表（标题/正文/分类/状态等） |
| `question_analysis` | 命题分析 |
| `exam_questions` | 历年高考真题 |
| `users` | 用户账户（username/password_hash/role） |
| `sessions` | 登录会话（token/expires_at） |

### 关联表

| 表名 | 说明 |
|------|------|
| `material_tags` | 素材标签 |
| `material_topics` | 素材适用话题 |
| `material_links` | 素材延伸链接（百科/视频/文章） |
| `qa_materials` | 命题分析关联素材 |
| `qa_angles` | 命题分析写作角度 |
| `exam_keywords` | 真题关键词 |
| `exam_angles` | 真题写作角度 |
| `exam_materials` | 真题关联素材 |

> 所有关联表设 `ON DELETE CASCADE`，素材删除时自动清理引用。

## API 接口

### 公开接口（无需认证）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/categories` | 获取分类列表（含二级） |
| GET | `/api/types` | 获取素材类型 |
| GET | `/api/materials` | 获取素材列表（支持筛选/搜索/分页） |
| GET | `/api/materials/:id` | 获取单个素材详情 |
| GET | `/api/tags` | 获取所有标签 |
| GET | `/api/exam-questions` | 获取真题列表 |
| GET | `/api/exam-questions/:id` | 获取真题详情（含关联素材） |
| GET | `/api/exam-meta/years` | 获取真题年份列表 |
| GET | `/api/exam-meta/regions` | 获取真题地区列表 |
| GET | `/api/question-analysis` | 获取命题分析列表 |
| GET | `/api/question-analysis/:id` | 获取命题分析详情 |
| GET | `/api/classics` | 获取名著书目列表 |

### 认证接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/auth/login` | 登录 |
| POST | `/api/auth/logout` | 登出 |
| GET | `/api/auth/me` | 获取当前用户信息 |

### 管理接口（需认证）

| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| POST | `/api/materials` | 登录用户 | 新增素材 |
| PUT | `/api/materials/:id` | 登录用户 | 更新素材 |
| DELETE | `/api/materials/:id` | 登录用户 | 删除素材 |
| POST | `/api/materials/batch-delete` | 登录用户 | 批量删除 |
| GET | `/api/materials/pending` | 登录用户 | 获取待审核素材 |
| PUT | `/api/materials/:id/approve` | 登录用户 | 审核通过 |
| PUT | `/api/materials/:id/reject` | 登录用户 | 审核拒绝 |
| PUT | `/api/categories` | admin | 替换分类体系 |
| GET | `/api/stats` | 登录用户 | 数据统计 |
| GET | `/api/export` | admin | 导出全部数据 |
| POST | `/api/import` | admin | 导入数据 |
| GET | `/api/ai/config` | admin | 获取 AI 配置（Key 脱敏） |
| PUT | `/api/ai/config` | admin | 更新 AI 配置 |
| POST | `/api/ai/test` | admin | 测试 AI 连接 |
| POST | `/api/ai/generate` | 登录用户 | AI 话题生成素材 |
| POST | `/api/ai/generate-classics` | 登录用户 | AI 名著挖掘素材 |

### 素材列表查询参数

```
GET /api/materials?category=xxx&subcategory=xxx&type=xxx&tag=xxx&search=xxx&page=1&pageSize=20
```

## 设计特点

- **古风美学**：宣纸质感背景（SVG 噪点纹理）、竖排标题、朱砂红强调色、宋体排版
- **沉浸阅读**：点击素材卡片弹出仿书本翻开的阅读浮窗，支持 Esc 关闭
- **响应式适配**：移动端侧边栏/面板切换为抽屉式，触控友好
- **骨架屏加载**：首页加载时显示占位卡片，提升感知性能
- **批量查询优化**：`buildMaterials()` 使用 `IN` + Map 替代 N+1 查询
- **AI 双重筛选**：生成后自动过 `screenCandidate` 质量筛选，拒绝陈旧/空洞素材

## License

MIT
