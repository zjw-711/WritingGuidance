# 高考作文素材库「拾光阅」

> 为高考考生打造的作文素材积累、写作教程与命题分析平台，涵盖素材浏览、写作教程、历年真题、AI 智能生成等功能。

## 目录

- [功能概览](#功能概览)
- [技术架构](#技术架构)
- [项目结构](#项目结构)
- [快速开始](#快速开始)
- [页面说明](#页面说明)
- [写作教程系统](#写作教程系统)
- [管理后台](#管理后台)
- [AI 素材生成](#ai-素材生成)
- [认证与权限](#认证与权限)
- [数据库设计](#数据库设计)
- [API 接口文档](#api-接口文档)
- [一键部署](#一键部署)
- [设计特点](#设计特点)

---

## 功能概览

### 学生端

| 功能 | 说明 |
|------|------|
| 写作教程 | 按高考主题分类的完整写作指导，含命题分析、出题方向、出题示例、推荐素材、写作示例、写作锦囊、范文赏析 |
| 素材浏览 | 杂志风卡片布局，支持分类/子分类/标签/类型多维筛选，全文搜索 |
| 沉浸阅读 | 点击素材弹出仿书本翻开的阅读浮窗，展示完整内容、标签、话题、延伸链接，一键复制 |
| 历年真题 | 2016-2025 全国各省市高考作文题，按年份/地区/试卷类型/关键词筛选 |
| 教程导出 | 一键打印或导出为 PDF，自动展开所有 Tab 切换内容 |
| 响应式适配 | 移动端侧边栏/面板切换为抽屉式，触控友好 |

### 管理后台

| 功能 | 说明 |
|------|------|
| 素材 CRUD | 新增、编辑、删除、批量删除，支持标签/话题/延伸链接，状态筛选（已发布/待审核/已拒绝）|
| 教程管理 | 按分类创建教程，编辑出题方向、出题示例、写作示例、写作锦囊、范文赏析，关联推荐素材 |
| 分类管理 | 动态增删改一级/二级分类，实时生效 |
| 数据导入导出 | JSON 格式一键导出/导入，支持拖拽批量上传（含预览校验）|
| AI 素材生成 | 输入话题，AI 自动生成并质量筛选，进入待审核队列 |
| 名著素材挖掘 | 12 部预置经典 + 自由输入任意书名，按高考主题角度从名著中提取素材 |
| 审核队列 | AI 生成素材需人工审核后才对学生展示，支持通过/拒绝/编辑 |
| 数据统计 | 按状态/分类/类型的素材分布统计，教程数量，真题数量 |

---

## 技术架构

| 层次 | 技术 | 说明 |
|------|------|------|
| 后端 | Node.js + Express 4 | 单文件路由，约 1200 行 |
| 数据库 | SQLite (better-sqlite3) | WAL 模式、外键约束、21 个索引 |
| 前端 | 原生 HTML/CSS/JS | 无框架依赖，古风美学设计 |
| 认证 | Session + HttpOnly Cookie | bcryptjs 哈希，24h 过期，自动清理 |
| AI | OpenAI 兼容接口 | 支持智谱 GLM / DeepSeek / 通义千问 / Moonshot 等 |

**运行时依赖（仅 4 个）：**

```json
{
  "express": "^4.18.2",
  "better-sqlite3": "^12.9.0",
  "bcryptjs": "^3.0.3",
  "cors": "^2.8.5"
}
```

零开发依赖，`npm install` 即可运行。

---

## 项目结构

```
WritingGuidance_high/
├── server.js                 # Express 服务主入口（路由 + 业务逻辑）
├── db.js                     # SQLite 初始化与全部表结构定义
├── auth.js                   # 认证模块（密码哈希/Session/Cookie/中间件）
├── ai.js                     # AI 接口封装（生成/筛选/名著挖掘）
├── setup-admin.js            # CLI 交互式创建管理员账户
├── migrate.js                # JSON → SQLite 一次性数据迁移
├── migrate-tutorials.js      # 教程数据迁移脚本
├── batchGenerate.js          # 批量 AI 生成工具（按子分类遍历）
├── deploy.sh                 # 一键生产部署脚本（Ubuntu + Nginx + PM2）
├── package.json
├── .gitignore
│
├── data/                     # 数据目录
│   ├── gaokao.db             # SQLite 数据库（运行时自动生成）
│   ├── classics.json         # 名著书目配置（12 部中国经典）
│   ├── ai-config.json        # AI 接口配置（gitignored，含密钥）
│   ├── materials.json        # 原始素材数据（迁移前）
│   └── examQuestions.json    # 原始真题数据（迁移前）
│
├── views/
│   └── admin.html            # 管理后台页面（需认证，SPA 式 Tab 切换）
│
└── public/
    ├── index.html             # 学生端 — 写作教程首页
    ├── materials.html         # 学生端 — 素材浏览页
    ├── exam.html              # 学生端 — 历年真题页
    ├── login.html             # 登录页（内联 CSS/JS，自包含）
    ├── css/
    │   ├── style.css          # 学生端样式（古风主题，~1600 行）
    │   ├── admin.css          # 管理后台样式（~1300 行）
    │   └── exam.css           # 真题页样式（~540 行）
    └── js/
        ├── main.js            # 教程首页逻辑（教程加载/渲染/阅读浮窗/打印导出）
        ├── materials.js       # 素材浏览页逻辑（筛选/分页/搜索/阅读浮窗）
        ├── admin.js           # 管理后台逻辑（全功能 CRUD/分类/教程/AI/统计，~1944 行）
        └── exam.js            # 真题页逻辑（年份/地区筛选/详情弹窗/复制）
```

---

## 快速开始

### 环境要求

- Node.js >= 18
- npm

### 安装与启动

```bash
# 克隆项目
git clone https://github.com/zjw-711/WritingGuidance.git
cd WritingGuidance

# 安装依赖（仅 4 个，秒装）
npm install

# 创建管理员账户
npm run setup-admin

# 启动服务
npm start
```

服务启动后默认监听 **3001** 端口，可通过环境变量 `PORT` 修改：

```bash
PORT=8080 npm start
```

### 访问地址

| 页面 | 地址 | 认证 |
|------|------|------|
| 写作教程首页 | http://localhost:3001 | 无需 |
| 素材浏览 | http://localhost:3001/materials | 无需 |
| 历年真题 | http://localhost:3001/exam | 无需 |
| 登录页 | http://localhost:3001/login | 无需 |
| 管理后台 | http://localhost:3001/admin | 需要 |

### 数据迁移（仅首次）

如果从 JSON 种子数据迁移到 SQLite：

```bash
node migrate.js          # 素材 + 真题数据
node migrate-tutorials.js # 教程数据
```

---

## 页面说明

### 写作教程首页 (`/`)

核心学生端页面。左侧为分类导航侧边栏（支持分类展开/折叠、标签筛选、全文搜索），右侧为当前选中分类的完整写作教程面板。

教程面板包含 **9 个板块**：

| 序号 | 板块 | 内容 |
|------|------|------|
| 1 | 命题分析 | 该主题的高考命题趋势与核心矛盾分析 |
| 2 | 出题方向 | 可能的命题方向，每条含标题与描述 |
| 3 | 出题示例 | 多道模拟题（Tab 切换），每题含题目文本、备注、写作思路 |
| 4 | 哲学素材运用 | 哲学视角的素材引用指导 |
| 5 | 推荐素材 | 从素材库关联/自动填充的素材卡片（含类型筛选），展示完整内容，点击打开阅读浮窗 |
| 6 | 写作示例 | 多篇写作示例（Tab 切换），含范文片段、亮点、分析 |
| 7 | 写作锦囊 | 两列网格卡片，每张含图标、标题、要点 |
| 8 | 范文赏析 | 高分范文（Tab 切换），含全文、评分、亮点标注、点评分析 |
| 9 | 打印导出 | 点击「打印/导出PDF」按钮，自动展开所有 Tab 内容，调用浏览器原生打印 |

### 素材浏览页 (`/materials`)

与教程首页共用侧边栏。右侧为杂志风卡片网格，顶部有素材类型筛选（人物事例/时事热点/名言金句）。支持 URL 参数直链：

```
/materials?category=youth&tag=坚持&type=story&search=梦想&highlight=xxx
```

分页加载，点击卡片弹出阅读浮窗。

### 历年真题页 (`/exam`)

独立页面布局。顶部年份标签栏（2016-2025），下拉筛选地区、试卷类型（全国卷/新高考/自主命题），关键词搜索。卡片展示题面、年份、地区，点击展开详情弹窗（含写作角度、解析、关联素材）。

---

## 写作教程系统

教程是本平台的核心学习内容，按高考作文的 **10 大主题分类**组织：

| 分类 ID | 分类名称 | 子方向 |
|---------|---------|--------|
| `tech` | 科技人文 | 科技向善、创新探索、信息时代、人与自然 |
| `culture` | 文化传承 | 传统技艺、文化遗产、文化自信、中外交流 |
| `youth` | 青年成长 | 梦想坚持、选择担当、挫折超越、青春价值 |
| `virtue` | 品德修养 | 诚信正直、善良仁爱、责任担当、谦虚进取 |
| `society` | 社会生活 | 公平正义、民生关注、规则秩序、时代脉搏 |
| `nature` | 自然生态 | 生态保护、人与自然、绿色发展、生态文明 |
| `humanity` | 人文关怀 | 尊重生命、关爱弱者、同理共情、人文精神 |
| `philosophy` | 思辨哲理 | 辩证思维、矛盾统一、过程与结果、现象与本质 |
| `history` | 历史传承 | 以史为鉴、传承创新、家国情怀、民族精神 |
| `art` | 艺术审美 | 审美情趣、艺术创造、经典鉴赏、美与生活 |

每个分类对应一个教程，教程下的出题方向、出题示例、写作示例、锦囊、范文均可独立增删，并通过 `sort_order` 排序。

### 推荐素材的加载逻辑

教程的推荐素材支持两种来源：

1. **显式关联**：通过 `tutorial_materials` 关联表手动绑定的素材（上限 6 条）
2. **自动填充**：当关联不足 6 条时，自动从同分类下的已发布素材中补充

前端展示时返回素材的**完整内容**（非摘要），支持按类型（人物事例/时事热点/名言金句）筛选，点击卡片打开阅读浮窗查看详情。

---

## 管理后台

管理后台为单页应用，通过 Tab 切换 7 个功能面板：

### 1. 素材列表

- 顶部搜索栏 + 状态/分类/类型三级筛选
- 表格展示：标题、分类、类型、状态徽章（已发布/待审核/已拒绝）、操作按钮
- 支持勾选批量删除
- 分页加载

### 2. 素材编辑

- 标题、来源、分类（二级联动）、类型、正文
- 标签输入（回车添加，点 × 删除）
- 话题输入
- 延伸链接管理（标题 + URL + 类型）

### 3. 导入导出

- 一键导出全部数据为 JSON 文件
- JSON 文件导入（选择文件或拖拽上传）
- 批量上传：拖拽 JSON 文件，自动解析预览表格，支持校验后确认导入
- 提供导入模板下载

### 4. 分类管理

- 卡片式展示所有一级分类及其子分类
- 添加/编辑/删除一级分类和子分类
- 保存时自动检测变更，仅提交修改过的部分

### 5. 教程管理

- 按分类筛选教程列表，卡片展示标题 + 各模块条目数
- 创建/编辑弹窗：
  - 基础信息（标题、命题分析、哲学素材运用）
  - 出题方向（可增删，支持排序）
  - 出题示例（短标题、题目、备注、写作思路）
  - 写作示例（短标题、标题、示例内容、亮点、分析）
  - 写作锦囊（图标、标题、内容）
  - 范文赏析（标题、正文、评分、亮点、分析）
  - 推荐素材（素材选择器，可搜索/筛选）

### 6. 数据统计

- 总素材数 + 按状态分布（已发布/待审核/已拒绝）
- 按分类的素材分布
- 按类型的素材分布
- 教程总数、真题总数
- 未分类素材数量

### 7. AI 工具

- **AI 接口配置**：填写 Base URL、API Key、模型名称，支持测试连接
- **话题生成**：输入主题关键词，AI 批量生成素材，自动质量筛选
- **名著挖掘**：从下拉列表选择（12 部预置经典）或自由输入书名，可选指定主题角度
- **审核队列**：展示所有待审核素材，支持通过/拒绝/编辑

---

## AI 素材生成

### 接口配置

进入管理后台 → **AI 工具** → **AI 接口配置**：

| 配置项 | 说明 | 示例 |
|--------|------|------|
| API Base URL | OpenAI 兼容接口地址 | `https://open.bigmodel.cn/api/paas/v4` |
| API Key | 接口密钥 | 从服务商获取 |
| 模型名称 | 模型 ID | `glm-4-flash`、`deepseek-chat` 等 |

支持所有 OpenAI 兼容服务商（智谱、DeepSeek、通义千问、Moonshot 等）。推理模型（如 `glm-5`、`deepseek-r1`、`o1`/`o3`）会自动跳过 `temperature` 和 `response_format` 参数。

### 生成流程

1. 用户输入话题关键词（如「逆境成长」「科技伦理」）
2. AI 根据话题生成 N 条素材（含标题、正文、分类、标签、类型）
3. 每条素材经过 `screenCandidate` 质量筛选：
   - 评估**新颖度**（拒绝袁隆平、苏轼等高频陈旧案例）
   - 评估**详细度**（是否包含具体细节）
   - 评估**实用性**（是否可直接用于作文论证）
4. 通过筛选的素材以 `status='pending'` 写入数据库
5. 管理员在审核队列中人工审核通过后，素材对学生可见

### 名著素材挖掘

支持两种方式：

- **预置书目**：从下拉建议中选择（红楼梦、三国演义、论语、史记等 12 部经典）
- **自由输入**：手动输入任意书名（如「老人与海」「百年孤独」）

可选指定主题角度（如「逆境与超越」「真情与世俗」），AI 会围绕该主题从名著中提取人物/情节/金句，生成带论证分析的素材卡。

---

## 认证与权限

### 认证机制

| 环节 | 实现 |
|------|------|
| 密码存储 | bcryptjs 哈希（10 rounds） |
| Session Token | `crypto.randomBytes(32)` 生成 64 位 hex 字符串 |
| Session 存储 | SQLite `sessions` 表，含 `expires_at` 时间戳 |
| Session 有效期 | 24 小时 |
| Cookie | `HttpOnly` + `SameSite=Lax` + `Path=/` + `Max-Age` |
| Secure 标志 | 根据 `X-Forwarded-Proto` 头动态判断（Nginx 代理时自动启用）|
| 过期清理 | 启动时清理一次，之后每小时自动清理 |

### 角色权限

| 功能 | admin | editor |
|------|-------|--------|
| 素材增删改查 | ✅ | ✅ |
| 素材审核 | ✅ | ✅ |
| AI 生成/名著挖掘 | ✅ | ✅ |
| 教程管理 | ✅ | ❌ |
| 分类管理 | ✅ | ❌ |
| 导入导出 | ✅ | ❌ |
| AI 接口配置 | ✅ | ❌ |
| 数据统计 | ✅ | ✅ |

### 创建管理员

```bash
# 方式一：交互式 CLI
npm run setup-admin

# 方式二：代码直接创建
node -e "
const { getDb } = require('./db');
const { createUser } = require('./auth');
require('./db');
createUser('admin', 'your_password', 'admin');
console.log('管理员创建成功');
"
```

---

## 数据库设计

SQLite 数据库位于 `data/gaokao.db`，WAL 模式，外键约束开启。共 **19 张表**，**21 个索引**。

### 主表

```sql
-- 分类体系
categories (id TEXT PK, name TEXT, icon TEXT)              -- 10 个一级分类
subcategories (id TEXT PK, name TEXT, category_id FK)      -- ~40 个二级分类
types (id TEXT PK, name TEXT)                              -- 3 种素材类型

-- 核心内容
materials (id TEXT PK, title, content, category_id FK, subcategory_id FK,
           type_id FK, source, status, created_at)        -- 素材主表
question_analysis (id TEXT PK, title, category_id FK, ...) -- 命题分析
exam_questions (id TEXT PK, year INT, region, content, ...) -- 高考真题

-- 用户系统
users (id TEXT PK, username UNIQUE, password_hash, role, created_at)
sessions (token TEXT PK, user_id FK, created_at, expires_at)
```

### 素材关联表

```sql
material_tags (material_id FK, tag TEXT)                   -- 素材标签（一对多）
material_topics (material_id FK, topic TEXT)               -- 适用话题
material_links (id AUTOINCREMENT, material_id FK, title, url, type) -- 延伸链接
```

### 真题关联表

```sql
exam_keywords (exam_id FK, keyword TEXT)                   -- 真题关键词
exam_angles (exam_id FK, angle TEXT)                       -- 写作角度
exam_materials (exam_id FK, material_id FK, PK)            -- 关联素材
```

### 命题分析关联表

```sql
qa_materials (qa_id FK, material_id FK, PK)               -- 关联素材
qa_angles (qa_id FK, angle TEXT)                           -- 写作角度
```

### 教程系统表（7 张）

```sql
tutorials (id TEXT PK, category_id FK, title,              -- 教程主表
           proposition_analysis, philosophy_guide,
           created_at, updated_at)

tutorial_directions (id AUTOINCREMENT, tutorial_id FK,     -- 出题方向
                     title, description, sort_order)

tutorial_questions (id AUTOINCREMENT, tutorial_id FK,      -- 出题示例
                    short_title, title, question_text,
                    note, writing_approach, sort_order)

tutorial_examples (id AUTOINCREMENT, tutorial_id FK,       -- 写作示例
                   short_title, title, example_text,
                   highlight, analysis, sort_order)

tutorial_tips (id AUTOINCREMENT, tutorial_id FK,           -- 写作锦囊
               icon, title, content, sort_order)

tutorial_materials (tutorial_id FK, material_id FK,        -- 推荐素材关联
                    sort_order, PK)

tutorial_essays (id AUTOINCREMENT, tutorial_id FK,         -- 范文赏析
                 title, essay_text, score,
                 highlight, analysis, sort_order)
```

> 所有关联表设 `ON DELETE CASCADE`，父记录删除时自动清理引用。

### 索引

覆盖所有外键字段、排序字段（`created_at DESC`、`year DESC`）和常用查询字段（`tag`、`status`），共 21 个。

---

## API 接口文档

### 页面路由

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| GET | `/` | 无 | 写作教程首页 |
| GET | `/materials` | 无 | 素材浏览页 |
| GET | `/exam` | 无 | 历年真题页 |
| GET | `/login` | 无 | 登录页 |
| GET | `/admin` | 需要 | 管理后台 |

### 认证接口

| 方法 | 路径 | 参数 | 说明 |
|------|------|------|------|
| POST | `/api/auth/login` | `{username, password}` | 登录，返回 Session Cookie |
| POST | `/api/auth/logout` | — | 登出，销毁 Session |
| GET | `/api/auth/me` | — | 获取当前用户信息 |

### 分类与类型

| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| GET | `/api/categories` | 公开 | 获取分类树（含嵌套子分类）|
| PUT | `/api/categories` | admin | 替换整个分类体系 |
| GET | `/api/types` | 公开 | 获取素材类型列表 |
| GET | `/api/tags` | 公开 | 获取所有去重标签 |

### 素材 CRUD

| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| GET | `/api/materials` | 公开* | 素材列表（支持筛选/搜索/分页）|
| GET | `/api/materials/:id` | 公开 | 素材详情（含标签/话题/链接）|
| GET | `/api/materials/pending` | 登录 | 待审核素材列表 |
| POST | `/api/materials` | 登录 | 新增素材 |
| PUT | `/api/materials/:id` | 登录 | 更新素材 |
| DELETE | `/api/materials/:id` | 登录 | 删除素材 |
| POST | `/api/materials/batch-delete` | 登录 | 批量删除 `{ids: [...]}` |
| PUT | `/api/materials/:id/approve` | 登录 | 审核通过 |
| PUT | `/api/materials/:id/reject` | 登录 | 审核拒绝 |

> *公开接口仅返回 `status='approved'` 的素材；登录用户可通过 `status` 参数筛选。

**素材列表查询参数：**

```
GET /api/materials?category=xxx&subcategory=xxx&type=xxx&tag=xxx&search=xxx&status=xxx&page=1&pageSize=20
```

### 历年真题

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/exam-questions` | 真题列表（含关键词、写作角度）|
| GET | `/api/exam-questions/:id` | 真题详情（含关联素材）|
| GET | `/api/exam-meta/years` | 年份列表 |
| GET | `/api/exam-meta/regions` | 地区列表 |

**真题查询参数：**

```
GET /api/exam-questions?year=2024&region=北京&regionType=national&keyword=xxx&page=1&pageSize=20
```

### 写作教程

| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| GET | `/api/tutorials` | 公开 | 教程列表（含各模块条目数）|
| GET | `/api/tutorials/:id` | 公开 | 教程详情（含全部子数据）|
| GET | `/api/tutorials/by-category/:categoryId` | 公开 | 按分类获取教程 |
| POST | `/api/tutorials` | admin | 创建教程 |
| PUT | `/api/tutorials/:id` | admin | 更新教程 |
| DELETE | `/api/tutorials/:id` | admin | 删除教程 |

### 数据管理

| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| GET | `/api/export` | admin | 导出全部数据为 JSON |
| POST | `/api/import` | admin | 导入 JSON 数据 |
| GET | `/api/stats` | 登录 | 数据统计（按状态/分类/类型分布）|
| GET | `/api/classics` | 公开 | 名著书目列表 |

### AI 功能

| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| GET | `/api/ai/config` | admin | 获取 AI 配置（Key 脱敏）|
| PUT | `/api/ai/config` | admin | 更新 AI 配置 |
| POST | `/api/ai/test` | admin | 测试 AI 连接 |
| POST | `/api/ai/generate` | 登录 | 按话题生成素材 |
| POST | `/api/ai/generate-classics` | 登录 | 名著挖掘素材 |

### 命题分析

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/question-analysis` | 命题分析列表 |
| GET | `/api/question-analysis/:id` | 命题分析详情 |

---

## 一键部署

项目附带 `deploy.sh` 脚本，支持在 Ubuntu 服务器上一键部署：

```bash
sudo bash deploy.sh
```

脚本会自动完成：

1. 安装 Node.js 18（通过 nodesource）
2. 安装 PM2、Nginx、Git
3. 从 GitHub 拉取项目到 `/opt/WritingGuidance`
4. 交互式创建管理员账户
5. 使用 PM2 启动服务（`NODE_ENV=production`，自动开机启动）
6. 配置 Nginx 反向代理（80 → 127.0.0.1:3001）

**附加配置：**

- UFW 防火墙规则（22/80/443 端口）
- 每日 3:00 自动备份 `gaokao.db`（保留 30 天）
- 输出 HTTPS 配置指引（使用 certbot）

**日常运维命令：**

```bash
pm2 status              # 查看服务状态
pm2 logs gaokao         # 查看日志
pm2 restart gaokao      # 重启服务
cd /opt/WritingGuidance && git pull && npm install && pm2 restart gaokao  # 更新代码
```

---

## 设计特点

### 视觉设计

- **古风美学**：宣纸质感背景（SVG 噪点纹理）、竖排标题、朱砂红强调色、宋体排版（Noto Serif SC）
- **沉浸阅读**：仿书本翻开的阅读浮窗，纸张阴影 + 翻页感动画
- **印章元素**：品牌标识使用「拾光」印章风格

### 技术亮点

- **零前端依赖**：纯原生 HTML/CSS/JS，无构建步骤，无框架开销
- **批量查询优化**：`buildMaterials()` 使用 `IN` + Map 替代 N+1 查询，素材列表查询始终为 O(1) 数据库调用
- **AI 双重筛选**：生成后自动过 `screenCandidate` 质量筛选，拒绝陈旧/空洞素材；AI 不可用时降级为关键词启发式筛选
- **推理模型自适应**：自动检测 glm-5/deepseek-r1/o1 等推理模型，跳过不兼容参数
- **打印导出零依赖**：利用浏览器原生 `window.print()` + `@media print` CSS，无第三方库
- **Cookie Secure 动态判断**：根据 `X-Forwarded-Proto` 头决定是否设置 `Secure` 标志，HTTP/HTTPS 环境自适应
- **教程素材智能填充**：显式关联优先，不足时自动从同分类已发布素材中补充

---

## License

MIT
