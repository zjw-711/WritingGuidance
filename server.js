const express = require('express');
const cors = require('cors');
const path = require('path');
const { getDb, generateId } = require('./db');
const ai = require('./ai');
const fs = require('fs');
const {
  requireAuth, requireRole,
  verifyPassword, createSession, destroySession,
  setSessionCookie, clearSessionCookie, getSessionToken,
  cleanExpiredSessions
} = require('./auth');

// 加载名著配置
const CLASSICS = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'classics.json'), 'utf-8'));

const app = express();
const PORT = process.env.PORT || 3001;

// 生产环境信任 Nginx 反向代理
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ========== 工具函数 ==========
const db = getDb();

// 组装一条素材（含 tags, topics, links）
function buildMaterial(row) {
  if (!row) return null;
  const m = {
    id: row.id,
    title: row.title,
    content: row.content,
    category: row.category_id,
    subcategory: row.subcategory_id,
    type: row.type_id,
    source: row.source,
    tags: [],
    applicableTopics: [],
    links: [],
    status: row.status || 'approved',
    createdAt: row.created_at
  };
  const tags = db.prepare('SELECT tag FROM material_tags WHERE material_id = ?').all(row.id);
  m.tags = tags.map(t => t.tag);
  const topics = db.prepare('SELECT topic FROM material_topics WHERE material_id = ?').all(row.id);
  m.applicableTopics = topics.map(t => t.topic);
  const links = db.prepare('SELECT title, url, type FROM material_links WHERE material_id = ?').all(row.id);
  m.links = links;
  return m;
}

// 批量组装素材（减少 N+1 查询）
function buildMaterials(rows) {
  if (!rows || rows.length === 0) return [];
  const ids = rows.map(r => r.id);
  const placeholders = ids.map(() => '?').join(',');

  const allTags = db.prepare(`SELECT material_id, tag FROM material_tags WHERE material_id IN (${placeholders})`).all(...ids);
  const allTopics = db.prepare(`SELECT material_id, topic FROM material_topics WHERE material_id IN (${placeholders})`).all(...ids);
  const allLinks = db.prepare(`SELECT material_id, title, url, type FROM material_links WHERE material_id IN (${placeholders})`).all(...ids);

  const tagMap = new Map();
  const topicMap = new Map();
  const linkMap = new Map();
  for (const t of allTags) { if (!tagMap.has(t.material_id)) tagMap.set(t.material_id, []); tagMap.get(t.material_id).push(t.tag); }
  for (const t of allTopics) { if (!topicMap.has(t.material_id)) topicMap.set(t.material_id, []); topicMap.get(t.material_id).push(t.topic); }
  for (const l of allLinks) { if (!linkMap.has(l.material_id)) linkMap.set(l.material_id, []); linkMap.get(l.material_id).push({ title: l.title, url: l.url, type: l.type }); }

  return rows.map(row => ({
    id: row.id,
    title: row.title,
    content: row.content,
    category: row.category_id,
    subcategory: row.subcategory_id,
    type: row.type_id,
    source: row.source,
    tags: tagMap.get(row.id) || [],
    applicableTopics: topicMap.get(row.id) || [],
    links: linkMap.get(row.id) || [],
    status: row.status || 'approved',
    createdAt: row.created_at
  }));
}

// ========== 前端页面路由 ==========
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/admin', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'admin.html'));
});

app.get('/exam', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'exam.html'));
});

app.get('/materials', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'materials.html'));
});

// ========== API：认证 ==========
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: '请输入用户名和密码' });
  }

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user || !verifyPassword(password, user.password_hash)) {
    return res.status(401).json({ error: '用户名或密码错误' });
  }

  const session = createSession(user.id);
  setSessionCookie(res, session.token, req);
  res.json({ success: true, user: { username: user.username, role: user.role } });
});

app.post('/api/auth/logout', requireAuth, (req, res) => {
  const token = getSessionToken(req);
  if (token) destroySession(token);
  clearSessionCookie(res, req);
  res.json({ success: true });
});

app.get('/api/auth/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

// ========== API：分类 ==========
app.get('/api/categories', (req, res) => {
  const cats = db.prepare('SELECT * FROM categories ORDER BY id').all();
  const result = cats.map(c => {
    const subs = db.prepare('SELECT id, name FROM subcategories WHERE category_id = ?').all(c.id);
    return { id: c.id, name: c.name, icon: c.icon, subcategories: subs };
  });
  res.json(result);
});

app.put('/api/categories', requireAuth, requireRole('admin'), (req, res) => {
  const newCats = req.body;
  if (!Array.isArray(newCats)) return res.status(400).json({ error: '数据格式错误' });

  const replaceAll = db.transaction(() => {
    // 收集新的分类和子分类 ID
    const newCatIds = new Set(newCats.map(c => c.id));
    const newSubIds = new Set();
    for (const c of newCats) {
      for (const s of (c.subcategories || [])) newSubIds.add(s.id);
    }

    // 获取当前数据库中的旧 ID
    const oldCatIds = new Set(db.prepare('SELECT id FROM categories').all().map(r => r.id));
    const oldSubIds = new Set(db.prepare('SELECT id FROM subcategories').all().map(r => r.id));

    // 找出被删除的分类和子分类
    const removedCatIds = [...oldCatIds].filter(id => !newCatIds.has(id));
    const removedSubIds = [...oldSubIds].filter(id => !newSubIds.has(id));

    // 只清除被删除的子分类在素材中的引用（而非全部清空）
    for (const sid of removedSubIds) {
      db.prepare('UPDATE materials SET subcategory_id = NULL WHERE subcategory_id = ?').run(sid);
      db.prepare('UPDATE question_analysis SET subcategory_id = NULL WHERE subcategory_id = ?').run(sid);
    }

    // 清除被删除分类在素材中的引用
    for (const cid of removedCatIds) {
      db.prepare('UPDATE materials SET category_id = NULL, subcategory_id = NULL WHERE category_id = ?').run(cid);
      db.prepare('UPDATE question_analysis SET category_id = NULL, subcategory_id = NULL WHERE category_id = ?').run(cid);
    }

    // 删除被移除的子分类和分类
    for (const sid of removedSubIds) {
      db.prepare('DELETE FROM subcategories WHERE id = ?').run(sid);
    }
    for (const cid of removedCatIds) {
      db.prepare('DELETE FROM categories WHERE id = ?').run(cid);
    }

    // 更新或插入分类
    const upsertCat = db.prepare('INSERT OR REPLACE INTO categories (id, name, icon) VALUES (?, ?, ?)');
    for (const c of newCats) {
      upsertCat.run(c.id, c.name, c.icon || '📁');
    }

    // 更新或插入子分类（保留的子分类更新名称，新增的子分类插入）
    const upsertSub = db.prepare('INSERT OR REPLACE INTO subcategories (id, name, category_id) VALUES (?, ?, ?)');
    for (const c of newCats) {
      for (const s of (c.subcategories || [])) {
        upsertSub.run(s.id, s.name, c.id);
      }
    }
  });

  try {
    replaceAll();
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ========== API：素材类型 ==========
app.get('/api/types', (req, res) => {
  const types = db.prepare('SELECT * FROM types').all();
  res.json(types);
});

// ========== API：素材 CRUD ==========

// 获取素材列表（支持筛选、搜索、分页）
app.get('/api/materials', (req, res) => {
  const { category, type, search, tag, page = 1, pageSize = 20 } = req.query;
  const subcategory = req.query.subcategory;

  let whereClauses = [];
  let params = [];

  // 前台只显示已发布素材
  whereClauses.push("m.status = 'approved'");

  if (category) { whereClauses.push('m.category_id = ?'); params.push(category); }
  if (subcategory) { whereClauses.push('m.subcategory_id = ?'); params.push(subcategory); }
  if (type) { whereClauses.push('m.type_id = ?'); params.push(type); }
  if (tag) {
    whereClauses.push('m.id IN (SELECT material_id FROM material_tags WHERE tag = ?)');
    params.push(tag);
  }
  if (search) {
    const kw = '%' + search.toLowerCase() + '%';
    whereClauses.push(`(
      LOWER(m.title) LIKE ? OR LOWER(m.content) LIKE ?
      OR m.id IN (SELECT material_id FROM material_tags WHERE LOWER(tag) LIKE ?)
      OR m.id IN (SELECT material_id FROM material_topics WHERE LOWER(topic) LIKE ?)
    )`);
    params.push(kw, kw, kw, kw);
  }

  const where = whereClauses.length ? 'WHERE ' + whereClauses.join(' AND ') : '';

  const total = db.prepare(`SELECT COUNT(*) as c FROM materials m ${where}`).get(...params).c;

  const offset = (parseInt(page) - 1) * parseInt(pageSize);
  const rows = db.prepare(
    `SELECT m.* FROM materials m ${where} ORDER BY m.created_at DESC LIMIT ? OFFSET ?`
  ).all(...params, parseInt(pageSize), offset);

  const data = buildMaterials(rows);

  res.json({ total, page: parseInt(page), pageSize: parseInt(pageSize), data });
});

// 获取待审核素材（必须在 :id 路由之前）
app.get('/api/materials/pending', requireAuth, (req, res) => {
  const { page = 1, pageSize = 15 } = req.query;
  const total = db.prepare("SELECT COUNT(*) as c FROM materials WHERE status = 'pending'").get().c;
  const offset = (parseInt(page) - 1) * parseInt(pageSize);
  const rows = db.prepare("SELECT * FROM materials WHERE status = 'pending' ORDER BY created_at DESC LIMIT ? OFFSET ?").all(parseInt(pageSize), offset);
  const data = buildMaterials(rows);
  res.json({ total, page: parseInt(page), pageSize: parseInt(pageSize), data });
});

// 获取单个素材
app.get('/api/materials/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM materials WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: '素材不存在' });
  res.json(buildMaterial(row));
});

// 新增素材
app.post('/api/materials', requireAuth, (req, res) => {
  const id = generateId('m');
  const body = req.body;

  const insertAll = db.transaction(() => {
    db.prepare(`INSERT INTO materials (id, title, content, category_id, subcategory_id, type_id, source, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
        id, body.title || '', body.content || '', body.category || null,
        body.subcategory || null, body.type || null, body.source || '',
        new Date().toISOString().split('T')[0]
    );
    for (const tag of (body.tags || [])) {
      db.prepare('INSERT INTO material_tags (material_id, tag) VALUES (?, ?)').run(id, tag);
    }
    for (const topic of (body.applicableTopics || [])) {
      db.prepare('INSERT INTO material_topics (material_id, topic) VALUES (?, ?)').run(id, topic);
    }
    for (const link of (body.links || [])) {
      db.prepare('INSERT INTO material_links (material_id, title, url, type) VALUES (?, ?, ?, ?)').run(
        id, link.title || '', link.url || '', link.type || 'article'
      );
    }
  });

  try {
    insertAll();
    const material = buildMaterial(db.prepare('SELECT * FROM materials WHERE id = ?').get(id));
    res.json({ success: true, material });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 更新素材
app.put('/api/materials/:id', requireAuth, (req, res) => {
  const row = db.prepare('SELECT * FROM materials WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: '素材不存在' });

  const body = req.body;
  const updateAll = db.transaction(() => {
    db.prepare(`UPDATE materials SET
      title = ?, content = ?, category_id = ?, subcategory_id = ?,
      type_id = ?, source = ?
      WHERE id = ?`
    ).run(
      body.title !== undefined ? body.title : row.title,
      body.content !== undefined ? body.content : row.content,
      body.category || null,
      body.subcategory || null,
      body.type || null,
      body.source !== undefined ? body.source : row.source,
      req.params.id
    );

    // 替换 tags
    if (body.tags !== undefined) {
      db.prepare('DELETE FROM material_tags WHERE material_id = ?').run(req.params.id);
      for (const tag of body.tags) {
        db.prepare('INSERT INTO material_tags (material_id, tag) VALUES (?, ?)').run(req.params.id, tag);
      }
    }
    // 替换 topics
    if (body.applicableTopics !== undefined) {
      db.prepare('DELETE FROM material_topics WHERE material_id = ?').run(req.params.id);
      for (const topic of body.applicableTopics) {
        db.prepare('INSERT INTO material_topics (material_id, topic) VALUES (?, ?)').run(req.params.id, topic);
      }
    }
    // 替换 links
    if (body.links !== undefined) {
      db.prepare('DELETE FROM material_links WHERE material_id = ?').run(req.params.id);
      for (const link of body.links) {
        db.prepare('INSERT INTO material_links (material_id, title, url, type) VALUES (?, ?, ?, ?)').run(
          req.params.id, link.title || '', link.url || '', link.type || 'article'
        );
      }
    }
  });

  try {
    updateAll();
    const material = buildMaterial(db.prepare('SELECT * FROM materials WHERE id = ?').get(req.params.id));
    res.json({ success: true, material });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 删除素材（CASCADE 自动清理 qa_materials, exam_materials, tags, topics, links）
app.delete('/api/materials/:id', requireAuth, (req, res) => {
  const row = db.prepare('SELECT id FROM materials WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: '素材不存在' });
  const r = db.prepare('DELETE FROM materials WHERE id = ?').run(req.params.id);
  res.json({ success: true, deleted: r.changes });
});

// 批量删除素材
app.post('/api/materials/batch-delete', requireAuth, (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids)) return res.status(400).json({ error: 'ids 必须为数组' });

  const stmt = db.prepare('DELETE FROM materials WHERE id = ?');
  let deleted = 0;
  const batchDelete = db.transaction(() => {
    for (const id of ids) {
      const r = stmt.run(id);
      deleted += r.changes;
    }
  });
  batchDelete();
  res.json({ success: true, deleted });
});

// 获取所有标签（聚合）
app.get('/api/tags', (req, res) => {
  const tags = db.prepare('SELECT DISTINCT tag FROM material_tags ORDER BY tag').all();
  res.json(tags.map(t => t.tag));
});

// 数据统计
app.get('/api/stats', requireAuth, (req, res) => {
  const totalMaterials = db.prepare('SELECT COUNT(*) as c FROM materials').get().c;
  const catStats = {};
  db.prepare('SELECT category_id, COUNT(*) as c FROM materials GROUP BY category_id').all()
    .forEach(r => { catStats[r.category_id] = r.c; });
  const typeStats = {};
  db.prepare('SELECT type_id, COUNT(*) as c FROM materials GROUP BY type_id').all()
    .forEach(r => { typeStats[r.type_id] = r.c; });
  const totalCategories = db.prepare('SELECT COUNT(*) as c FROM categories').get().c;
  res.json({ totalMaterials, categoryStats: catStats, typeStats, totalCategories });
});

// 数据导出
app.get('/api/export', requireAuth, requireRole('admin'), (req, res) => {
  const categories = db.prepare('SELECT * FROM categories ORDER BY id').all().map(c => ({
    ...c,
    subcategories: db.prepare('SELECT id, name FROM subcategories WHERE category_id = ?').all(c.id)
  }));
  const types = db.prepare('SELECT * FROM types').all();
  const materialRows = db.prepare('SELECT * FROM materials ORDER BY created_at DESC').all();
  const materials = buildMaterials(materialRows);
  const questionAnalysis = db.prepare('SELECT * FROM question_analysis ORDER BY id').all().map(qa => ({
    ...qa,
    category: qa.category_id,
    subcategory: qa.subcategory_id,
    questionType: qa.question_type,
    sampleQuestion: qa.sample_question,
    materialIds: db.prepare('SELECT material_id FROM qa_materials WHERE qa_id = ?').all(qa.id).map(r => r.material_id),
    angles: db.prepare('SELECT angle FROM qa_angles WHERE qa_id = ?').all(qa.id).map(r => r.angle)
  }));

  const data = { categories, types, materials, questionAnalysis };
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', 'attachment; filename=materials_export.json');
  res.json(data);
});

// ========== API：历年高考真题 ==========

// 获取真题列表
app.get('/api/exam-questions', (req, res) => {
  const { year, region, regionType, keyword, page = 1, pageSize = 20 } = req.query;

  let whereClauses = [];
  let params = [];

  if (year) { whereClauses.push('e.year = ?'); params.push(parseInt(year)); }
  if (region) { whereClauses.push('e.region = ?'); params.push(region); }
  if (regionType) { whereClauses.push('e.region_type = ?'); params.push(regionType); }
  if (keyword) {
    const kw = '%' + keyword.toLowerCase() + '%';
    whereClauses.push(`(LOWER(e.content) LIKE ?
      OR e.id IN (SELECT exam_id FROM exam_keywords WHERE LOWER(keyword) LIKE ?))`);
    params.push(kw, kw);
  }

  const where = whereClauses.length ? 'WHERE ' + whereClauses.join(' AND ') : '';
  const total = db.prepare(`SELECT COUNT(*) as c FROM exam_questions e ${where}`).get(...params).c;

  const offset = (parseInt(page) - 1) * parseInt(pageSize);
  const rows = db.prepare(
    `SELECT e.* FROM exam_questions e ${where} ORDER BY e.year DESC, e.region ASC LIMIT ? OFFSET ?`
  ).all(...params, parseInt(pageSize), offset);

  const data = rows.map(r => ({
    id: r.id, year: r.year, region: r.region, regionType: r.region_type,
    content: r.content, requirement: r.requirement,
    keywords: db.prepare('SELECT keyword FROM exam_keywords WHERE exam_id = ?').all(r.id).map(k => k.keyword),
    angles: db.prepare('SELECT angle FROM exam_angles WHERE exam_id = ?').all(r.id).map(a => a.angle),
    analysis: r.analysis,
    linkedMaterialIds: db.prepare('SELECT material_id FROM exam_materials WHERE exam_id = ?').all(r.id).map(m => m.material_id),
    createdAt: r.created_at
  }));

  res.json({ total, page: parseInt(page), pageSize: parseInt(pageSize), data });
});

// 获取单个真题详情
app.get('/api/exam-questions/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM exam_questions WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: '真题不存在' });

  const linkedIds = db.prepare('SELECT material_id FROM exam_materials WHERE exam_id = ?').all(row.id)
    .map(r => r.material_id);

  const linkedMaterials = linkedIds.map(mid => {
    const m = db.prepare('SELECT * FROM materials WHERE id = ?').get(mid);
    return m ? buildMaterial(m) : null;
  }).filter(Boolean);

  res.json({
    id: row.id, year: row.year, region: row.region, regionType: row.region_type,
    content: row.content, requirement: row.requirement,
    keywords: db.prepare('SELECT keyword FROM exam_keywords WHERE exam_id = ?').all(row.id).map(k => k.keyword),
    angles: db.prepare('SELECT angle FROM exam_angles WHERE exam_id = ?').all(row.id).map(a => a.angle),
    analysis: row.analysis,
    linkedMaterialIds: linkedIds,
    linkedMaterials,
    createdAt: row.created_at
  });
});

// 获取真题年份列表
app.get('/api/exam-meta/years', (req, res) => {
  const years = db.prepare('SELECT DISTINCT year FROM exam_questions ORDER BY year DESC').all().map(r => r.year);
  res.json(years);
});

// 获取真题地区列表
app.get('/api/exam-meta/regions', (req, res) => {
  const regions = db.prepare('SELECT DISTINCT region FROM exam_questions ORDER BY region').all().map(r => r.region);
  res.json(regions);
});

// ========== API：命题分析 ==========

// 获取命题分析列表
app.get('/api/question-analysis', (req, res) => {
  const { category, subcategory } = req.query;
  let whereClauses = [];
  let params = [];

  if (category) { whereClauses.push('qa.category_id = ?'); params.push(category); }
  if (subcategory) { whereClauses.push('qa.subcategory_id = ?'); params.push(subcategory); }

  const where = whereClauses.length ? 'WHERE ' + whereClauses.join(' AND ') : '';
  const rows = db.prepare(`SELECT * FROM question_analysis qa ${where} ORDER BY qa.id`).all(...params);

  const result = rows.map(qa => ({
    id: qa.id,
    title: qa.title,
    category: qa.category_id,
    subcategory: qa.subcategory_id,
    questionType: qa.question_type,
    sampleQuestion: qa.sample_question,
    angles: db.prepare('SELECT angle FROM qa_angles WHERE qa_id = ?').all(qa.id).map(r => r.angle),
    tips: qa.tips,
    materialIds: db.prepare('SELECT material_id FROM qa_materials WHERE qa_id = ?').all(qa.id).map(r => r.material_id),
    materials: db.prepare('SELECT material_id FROM qa_materials WHERE qa_id = ?').all(qa.id).map(r => {
      const m = db.prepare('SELECT id, title, type_id FROM materials WHERE id = ?').get(r.material_id);
      return m ? { id: m.id, title: m.title, type: m.type_id } : null;
    }).filter(Boolean)
  }));

  res.json(result);
});

// 获取单个命题分析
app.get('/api/question-analysis/:id', (req, res) => {
  const qa = db.prepare('SELECT * FROM question_analysis WHERE id = ?').get(req.params.id);
  if (!qa) return res.status(404).json({ error: '命题分析不存在' });

  const midRows = db.prepare('SELECT material_id FROM qa_materials WHERE qa_id = ?').all(qa.id);
  const materials = midRows.map(r => {
    const m = db.prepare('SELECT * FROM materials WHERE id = ?').get(r.material_id);
    return m ? buildMaterial(m) : null;
  }).filter(Boolean);

  res.json({
    id: qa.id,
    title: qa.title,
    category: qa.category_id,
    subcategory: qa.subcategory_id,
    questionType: qa.question_type,
    sampleQuestion: qa.sample_question,
    angles: db.prepare('SELECT angle FROM qa_angles WHERE qa_id = ?').all(qa.id).map(r => r.angle),
    tips: qa.tips,
    materialIds: midRows.map(r => r.material_id),
    materials
  });
});

// 数据导入（支持批量上传，含字段校验）
app.post('/api/import', requireAuth, requireRole('admin'), (req, res) => {
  const imported = req.body;
  if (!imported.materials || !Array.isArray(imported.materials)) {
    return res.status(400).json({ error: '数据格式错误，需要 { "materials": [...] }' });
  }

  // 校验有效的分类/类型 ID
  const validCategories = new Set(db.prepare('SELECT id FROM categories').all().map(r => r.id));
  const validTypes = new Set(db.prepare('SELECT id FROM types').all().map(r => r.id));
  const validSubcats = new Set(db.prepare('SELECT id FROM subcategories').all().map(r => r.id));

  let imported_count = 0;
  const skipped = [];
  const errors = [];

  const doImport = db.transaction(() => {
    for (let i = 0; i < imported.materials.length; i++) {
      const m = imported.materials[i];

      // 校验必填字段
      if (!m.title || !m.content) {
        skipped.push({ index: i + 1, reason: '标题或正文为空' });
        continue;
      }

      // 校验分类/类型 ID（如果提供了的话）
      if (m.category && !validCategories.has(m.category)) {
        skipped.push({ index: i + 1, title: m.title, reason: `分类 "${m.category}" 不存在` });
        continue;
      }
      if (m.subcategory && !validSubcats.has(m.subcategory)) {
        skipped.push({ index: i + 1, title: m.title, reason: `二级分类 "${m.subcategory}" 不存在` });
        continue;
      }
      if (m.type && !validTypes.has(m.type)) {
        skipped.push({ index: i + 1, title: m.title, reason: `类型 "${m.type}" 不存在` });
        continue;
      }

      try {
        const id = generateId('m');
        const createdAt = m.createdAt || new Date().toISOString().split('T')[0];
        db.prepare(`INSERT INTO materials (id, title, content, category_id, subcategory_id, type_id, source, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
            id, m.title, m.content, m.category || null,
            m.subcategory || null, m.type || null, m.source || '', createdAt
        );
        for (const tag of (m.tags || [])) {
          db.prepare('INSERT INTO material_tags (material_id, tag) VALUES (?, ?)').run(id, tag);
        }
        for (const topic of (m.applicableTopics || [])) {
          db.prepare('INSERT INTO material_topics (material_id, topic) VALUES (?, ?)').run(id, topic);
        }
        for (const link of (m.links || [])) {
          db.prepare('INSERT INTO material_links (material_id, title, url, type) VALUES (?, ?, ?, ?)').run(
            id, link.title || '', link.url || '', link.type || 'article'
          );
        }
        imported_count++;
      } catch (err) {
        skipped.push({ index: i + 1, title: m.title, reason: err.message });
      }
    }
  });

  try {
    doImport();
    res.json({ success: true, imported: imported_count, skipped: skipped.length, errors: skipped });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ========== AI 配置 ==========
app.get('/api/ai/config', requireAuth, requireRole('admin'), (req, res) => {
  const config = ai.readAiConfig();
  // apiKey 脱敏
  res.json({
    ...config,
    apiKey: config.apiKey ? config.apiKey.slice(0, 6) + '***' : ''
  });
});

app.put('/api/ai/config', requireAuth, requireRole('admin'), (req, res) => {
  const config = req.body;
  // 如果 apiKey 是脱敏的（含 ***），保留原有的
  if (config.apiKey && config.apiKey.includes('***')) {
    const existing = ai.readAiConfig();
    config.apiKey = existing.apiKey;
  }
  const saved = ai.saveAiConfig(config);
  res.json({ success: true, config: { ...saved, apiKey: saved.apiKey ? saved.apiKey.slice(0, 6) + '***' : '' } });
});

// AI 连通性测试（真正发一次请求）
app.post('/api/ai/test', requireAuth, requireRole('admin'), async (req, res) => {
  const config = ai.readAiConfig();
  if (!config.enabled) return res.status(400).json({ error: '请先完成配置' });
  try {
    await ai.chatCompletion([
      { role: 'user', content: '请回复"连接成功"四个字，只返回 JSON：{"ok":true}' }
    ]);
    res.json({ success: true, message: 'AI 服务连接正常' });
  } catch (err) {
    res.status(400).json({ error: '连接失败：' + err.message });
  }
});

// ========== AI 素材生成 ==========
app.post('/api/ai/generate', requireAuth, async (req, res) => {
  const { topic, category, count = 3 } = req.body;
  if (!topic) return res.status(400).json({ error: '请输入话题' });

  const config = ai.readAiConfig();
  if (!config.enabled) return res.status(400).json({ error: 'AI 未配置，请先填写 API Key 和 Base URL' });

  try {
    // 获取该分类的子分类列表
    const subs = db.prepare('SELECT id, name FROM subcategories WHERE category_id = ?').all(category || '');

    // 查出同分类下已有素材标题，用于去重（避免全表扫描）
    let existing;
    if (category) {
      existing = db.prepare('SELECT title FROM materials WHERE category_id = ?').all(category);
    } else {
      existing = db.prepare('SELECT title FROM materials ORDER BY created_at DESC LIMIT 500').all();
    }
    const existingTitles = existing.map(r => r.title);

    const materials = await ai.generateMaterialsByTopic(topic, category, subs, count, existingTitles);

    // 存入数据库（status=pending）
    const saved = [];
    const insertMat = db.prepare(`INSERT INTO materials (id, title, content, category_id, subcategory_id, type_id, source, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', date('now'))`);
    const insertTag = db.prepare('INSERT INTO material_tags (material_id, tag) VALUES (?, ?)');
    const insertTopic = db.prepare('INSERT INTO material_topics (material_id, topic) VALUES (?, ?)');

    const insertAll = db.transaction((items) => {
      for (const mat of items) {
        const id = generateId('m');
        // 子分类留空，由管理员在审核时手动归类
        insertMat.run(id, mat.title, mat.content, category || null, null, mat.type || 'story', mat.source || 'AI 生成');
        for (const tag of (mat.tags || [])) insertTag.run(id, tag);
        for (const topic of (mat.applicableTopics || [])) insertTopic.run(id, topic);
        saved.push({ id, ...mat });
      }
    });

    insertAll(materials);
    res.json({ success: true, count: saved.length, materials: saved });
  } catch (err) {
    res.status(500).json({ error: 'AI 生成失败：' + err.message });
  }
});

// ========== 素材审核 ==========
app.put('/api/materials/:id/approve', requireAuth, (req, res) => {
  const result = db.prepare("UPDATE materials SET status = 'approved' WHERE id = ?").run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: '素材不存在' });
  res.json({ success: true });
});

app.put('/api/materials/:id/reject', requireAuth, (req, res) => {
  const result = db.prepare("UPDATE materials SET status = 'rejected' WHERE id = ?").run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: '素材不存在' });
  res.json({ success: true });
});

// ========== 名著素材挖掘 ==========

// 获取名著列表
app.get('/api/classics', (req, res) => {
  res.json(CLASSICS);
});

// 从名著生成素材
app.post('/api/ai/generate-classics', requireAuth, async (req, res) => {
  const { classicId, customTitle, theme, count = 3 } = req.body;
  if (!classicId && !customTitle) return res.status(400).json({ error: '请输入或选择名著名称' });

  // 优先匹配预置名著，否则用自定义输入构造
  let classic;
  if (classicId) {
    classic = CLASSICS.find(c => c.id === classicId);
    if (!classic) return res.status(400).json({ error: '名著不存在' });
  } else {
    classic = { id: '', title: customTitle, author: '', era: '', description: '', themes: [] };
  }

  const config = ai.readAiConfig();
  if (!config.enabled) return res.status(400).json({ error: 'AI 未配置，请先填写 API Key 和 Base URL' });

  try {
    // 查出同名著来源的已有素材标题，用于去重
    const existing = db.prepare("SELECT title FROM materials WHERE source LIKE ? ORDER BY created_at DESC LIMIT 500").all(`%${classic.title}%`);
    const existingTitles = existing.map(r => r.title);

    const materials = await ai.generateClassicsMaterials(classic, theme || '', count, existingTitles);

    // 名著素材尝试匹配"文化传承"分类
    const cultureCat = db.prepare("SELECT id FROM categories WHERE name LIKE '%文化%' OR name LIKE '%传承%' LIMIT 1").get();
    const categoryId = cultureCat ? cultureCat.id : null;

    // 存入数据库（status=pending）
    const saved = [];
    const insertMat = db.prepare(`INSERT INTO materials (id, title, content, category_id, subcategory_id, type_id, source, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', date('now'))`);
    const insertTag = db.prepare('INSERT INTO material_tags (material_id, tag) VALUES (?, ?)');
    const insertTopic = db.prepare('INSERT INTO material_topics (material_id, topic) VALUES (?, ?)');

    const insertAll = db.transaction((items) => {
      for (const mat of items) {
        const id = generateId('m');
        insertMat.run(id, mat.title, mat.content, categoryId, null, mat.type || 'story', mat.source || `${classic.title}·${classic.author}`);
        for (const tag of (mat.tags || [])) insertTag.run(id, tag);
        for (const topic of (mat.applicableTopics || [])) insertTopic.run(id, topic);
        saved.push({ id, ...mat });
      }
    });

    insertAll(materials);
    res.json({ success: true, count: saved.length, materials: saved });
  } catch (err) {
    res.status(500).json({ error: '名著素材生成失败：' + err.message });
  }
});

// ========== API：写作教程 ==========

// 获取教程列表（全部或按分类）
app.get('/api/tutorials', (req, res) => {
  const { category } = req.query;
  let whereClause = '';
  let params = [];

  if (category) {
    whereClause = 'WHERE t.category_id = ?';
    params.push(category);
  }

  const tutorials = db.prepare(`
    SELECT t.*, c.name as category_name
    FROM tutorials t
    LEFT JOIN categories c ON t.category_id = c.id
    ${whereClause}
    ORDER BY t.created_at DESC
  `).all(...params);

  res.json(tutorials.map(t => {
    // 统计关联数据数量
    const directionsCount = db.prepare('SELECT COUNT(*) as c FROM tutorial_directions WHERE tutorial_id = ?').get(t.id).c;
    const questionsCount = db.prepare('SELECT COUNT(*) as c FROM tutorial_questions WHERE tutorial_id = ?').get(t.id).c;
    const examplesCount = db.prepare('SELECT COUNT(*) as c FROM tutorial_examples WHERE tutorial_id = ?').get(t.id).c;
    const tipsCount = db.prepare('SELECT COUNT(*) as c FROM tutorial_tips WHERE tutorial_id = ?').get(t.id).c;

    return {
      id: t.id,
      categoryId: t.category_id,
      categoryName: t.category_name,
      title: t.title,
      propositionAnalysis: t.proposition_analysis,
      philosophyGuide: t.philosophy_guide,
      createdAt: t.created_at,
      directionsCount,
      questionsCount,
      examplesCount,
      tipsCount
    };
  }));
});

// 获取单个教程详情（含所有关联数据）
app.get('/api/tutorials/:id', (req, res) => {
  const tutorial = db.prepare('SELECT * FROM tutorials WHERE id = ?').get(req.params.id);
  if (!tutorial) return res.status(404).json({ error: '教程不存在' });

  // 出题方向
  const directions = db.prepare(`
    SELECT title, description
    FROM tutorial_directions
    WHERE tutorial_id = ?
    ORDER BY sort_order
  `).all(tutorial.id);

  // 出题示例
  const questions = db.prepare(`
    SELECT id, short_title, title, question_text, note, writing_approach
    FROM tutorial_questions
    WHERE tutorial_id = ?
    ORDER BY sort_order
  `).all(tutorial.id);

  // 写作示例
  const examples = db.prepare(`
    SELECT id, short_title, title, example_text, highlight, analysis
    FROM tutorial_examples
    WHERE tutorial_id = ?
    ORDER BY sort_order
  `).all(tutorial.id);

  // 写作锦囊
  const tips = db.prepare(`
    SELECT icon, title, content
    FROM tutorial_tips
    WHERE tutorial_id = ?
    ORDER BY sort_order
  `).all(tutorial.id);

  // 推荐素材
  const materialIds = db.prepare(`
    SELECT material_id, sort_order
    FROM tutorial_materials
    WHERE tutorial_id = ?
    ORDER BY sort_order
    LIMIT 6
  `).all(tutorial.id);

  const materials = materialIds.map(row => {
    const m = db.prepare(`
      SELECT m.id, m.title, m.content, m.type_id, m.source,
             (SELECT tag FROM material_tags WHERE material_id = m.id LIMIT 1) as tag
      FROM materials m
      WHERE m.id = ?
    `).get(row.material_id);
    if (!m) return null;
    return {
      id: m.id,
      title: m.title,
      excerpt: m.content.substring(0, 60) + '...',
      tag: m.tag || '',
      type: m.type_id
    };
  }).filter(Boolean);

  res.json({
    id: tutorial.id,
    categoryId: tutorial.category_id,
    title: tutorial.title,
    propositionAnalysis: tutorial.proposition_analysis,
    philosophyGuide: tutorial.philosophy_guide,
    directions,
    questions,
    examples,
    tips,
    materials
  });
});

// 按分类获取教程（便捷接口）
app.get('/api/tutorials/by-category/:categoryId', (req, res) => {
  const tutorial = db.prepare('SELECT * FROM tutorials WHERE category_id = ?').get(req.params.categoryId);
  if (!tutorial) return res.status(404).json({ error: '该分类暂无教程' });

  // 复用上面的详情逻辑
  req.params.id = tutorial.id;
  // 直接返回详情
  const directions = db.prepare(`
    SELECT title, description FROM tutorial_directions WHERE tutorial_id = ? ORDER BY sort_order
  `).all(tutorial.id);

  const questions = db.prepare(`
    SELECT id, short_title, title, question_text, note, writing_approach
    FROM tutorial_questions WHERE tutorial_id = ? ORDER BY sort_order
  `).all(tutorial.id);

  const examples = db.prepare(`
    SELECT id, short_title, title, example_text, highlight, analysis
    FROM tutorial_examples WHERE tutorial_id = ? ORDER BY sort_order
  `).all(tutorial.id);

  const tips = db.prepare(`
    SELECT icon, title, content FROM tutorial_tips WHERE tutorial_id = ? ORDER BY sort_order
  `).all(tutorial.id);

  const materialIds = db.prepare(`
    SELECT material_id FROM tutorial_materials WHERE tutorial_id = ? ORDER BY sort_order LIMIT 6
  `).all(tutorial.id);

  const materials = materialIds.map(row => {
    const m = db.prepare(`
      SELECT m.id, m.title, m.content, m.type_id,
             (SELECT tag FROM material_tags WHERE material_id = m.id LIMIT 1) as tag
      FROM materials m WHERE m.id = ?
    `).get(row.material_id);
    if (!m) return null;
    return { id: m.id, title: m.title, excerpt: m.content.substring(0, 60) + '...', tag: m.tag || '', type: m.type_id };
  }).filter(Boolean);

  res.json({
    id: tutorial.id,
    categoryId: tutorial.category_id,
    title: tutorial.title,
    propositionAnalysis: tutorial.proposition_analysis,
    philosophyGuide: tutorial.philosophy_guide,
    directions,
    questions,
    examples,
    tips,
    materials
  });
});

// 创建教程（admin）
app.post('/api/tutorials', requireAuth, requireRole('admin'), (req, res) => {
  const { categoryId, title, propositionAnalysis, philosophyGuide, directions, questions, examples, tips, materialIds } = req.body;

  if (!categoryId || !title) {
    return res.status(400).json({ error: '分类ID和标题为必填项' });
  }

  const id = generateId('t');

  const insertTutorial = db.prepare(`
    INSERT INTO tutorials (id, category_id, title, proposition_analysis, philosophy_guide)
    VALUES (?, ?, ?, ?, ?)
  `);

  const insertDirection = db.prepare(`
    INSERT INTO tutorial_directions (tutorial_id, title, description, sort_order)
    VALUES (?, ?, ?, ?)
  `);

  const insertQuestion = db.prepare(`
    INSERT INTO tutorial_questions (tutorial_id, short_title, title, question_text, note, writing_approach, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const insertExample = db.prepare(`
    INSERT INTO tutorial_examples (tutorial_id, short_title, title, example_text, highlight, analysis, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const insertTip = db.prepare(`
    INSERT INTO tutorial_tips (tutorial_id, icon, title, content, sort_order)
    VALUES (?, ?, ?, ?, ?)
  `);

  const insertMaterial = db.prepare(`
    INSERT INTO tutorial_materials (tutorial_id, material_id, sort_order)
    VALUES (?, ?, ?)
  `);

  const doInsert = db.transaction(() => {
    insertTutorial.run(id, categoryId, title, propositionAnalysis || '', philosophyGuide || '');

    (directions || []).forEach((d, i) => {
      insertDirection.run(id, d.title, d.description || '', i);
    });

    (questions || []).forEach((q, i) => {
      // 兼容两种命名：short_title / shortTitle, question_text / text, writing_approach / approach
      const shortTitle = q.short_title || q.shortTitle || '';
      const qTitle = q.title || '';
      const qText = q.question_text || q.text || '';
      const qNote = q.note || '';
      const qApproach = q.writing_approach || q.approach || '';
      insertQuestion.run(id, shortTitle, qTitle, qText, qNote, qApproach, i);
    });

    (examples || []).forEach((e, i) => {
      // 兼容两种命名：short_title / shortTitle, example_text / text
      const shortTitle = e.short_title || e.shortTitle || '';
      const eTitle = e.title || '';
      const eText = e.example_text || e.text || '';
      const eHighlight = e.highlight || '';
      const eAnalysis = e.analysis || '';
      insertExample.run(id, shortTitle, eTitle, eText, eHighlight, eAnalysis, i);
    });

    (tips || []).forEach((t, i) => {
      insertTip.run(id, t.icon || '💡', t.title, t.content || '', i);
    });

    (materialIds || []).forEach((mid, i) => {
      insertMaterial.run(id, mid, i);
    });
  });

  doInsert();
  res.json({ success: true, id });
});

// 更新教程（admin）
app.put('/api/tutorials/:id', requireAuth, requireRole('admin'), (req, res) => {
  const { title, propositionAnalysis, philosophyGuide, directions, questions, examples, tips, materialIds } = req.body;

  const tutorial = db.prepare('SELECT * FROM tutorials WHERE id = ?').get(req.params.id);
  if (!tutorial) return res.status(404).json({ error: '教程不存在' });

  const updateTutorial = db.prepare(`
    UPDATE tutorials SET title = ?, proposition_analysis = ?, philosophy_guide = ?, updated_at = datetime('now')
    WHERE id = ?
  `);

  const deleteDirections = db.prepare('DELETE FROM tutorial_directions WHERE tutorial_id = ?');
  const deleteQuestions = db.prepare('DELETE FROM tutorial_questions WHERE tutorial_id = ?');
  const deleteExamples = db.prepare('DELETE FROM tutorial_examples WHERE tutorial_id = ?');
  const deleteTips = db.prepare('DELETE FROM tutorial_tips WHERE tutorial_id = ?');
  const deleteMaterials = db.prepare('DELETE FROM tutorial_materials WHERE tutorial_id = ?');

  const insertDirection = db.prepare('INSERT INTO tutorial_directions (tutorial_id, title, description, sort_order) VALUES (?, ?, ?, ?)');
  const insertQuestion = db.prepare('INSERT INTO tutorial_questions (tutorial_id, short_title, title, question_text, note, writing_approach, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)');
  const insertExample = db.prepare('INSERT INTO tutorial_examples (tutorial_id, short_title, title, example_text, highlight, analysis, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)');
  const insertTip = db.prepare('INSERT INTO tutorial_tips (tutorial_id, icon, title, content, sort_order) VALUES (?, ?, ?, ?, ?)');
  const insertMaterial = db.prepare('INSERT INTO tutorial_materials (tutorial_id, material_id, sort_order) VALUES (?, ?, ?)');

  const doUpdate = db.transaction(() => {
    updateTutorial.run(title || tutorial.title, propositionAnalysis || '', philosophyGuide || '', req.params.id);

    // 清除并重新插入关联数据
    deleteDirections.run(req.params.id);
    deleteQuestions.run(req.params.id);
    deleteExamples.run(req.params.id);
    deleteTips.run(req.params.id);
    deleteMaterials.run(req.params.id);

    (directions || []).forEach((d, i) => insertDirection.run(req.params.id, d.title, d.description || '', i));

    (questions || []).forEach((q, i) => {
      // 兼容两种命名
      const shortTitle = q.short_title || q.shortTitle || '';
      const qText = q.question_text || q.text || '';
      const qApproach = q.writing_approach || q.approach || '';
      insertQuestion.run(req.params.id, shortTitle, q.title || '', qText, q.note || '', qApproach, i);
    });

    (examples || []).forEach((e, i) => {
      // 兼容两种命名
      const shortTitle = e.short_title || e.shortTitle || '';
      const eText = e.example_text || e.text || '';
      insertExample.run(req.params.id, shortTitle, e.title || '', eText, e.highlight || '', e.analysis || '', i);
    });

    (tips || []).forEach((t, i) => insertTip.run(req.params.id, t.icon || '💡', t.title, t.content || '', i));
    (materialIds || []).forEach((mid, i) => insertMaterial.run(req.params.id, mid, i));
  });

  doUpdate();
  res.json({ success: true });
});

// 删除教程（admin）
app.delete('/api/tutorials/:id', requireAuth, requireRole('admin'), (req, res) => {
  const tutorial = db.prepare('SELECT * FROM tutorials WHERE id = ?').get(req.params.id);
  if (!tutorial) return res.status(404).json({ error: '教程不存在' });

  db.prepare('DELETE FROM tutorials WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

app.listen(PORT, () => {
  // 启动时清理过期 session
  cleanExpiredSessions();
  // 每小时清理一次过期 session
  setInterval(() => cleanExpiredSessions(), 60 * 60 * 1000);

  console.log(`
  ========================================
    高考作文素材网站已启动！
    学生端：http://localhost:${PORT}
    管理端：http://localhost:${PORT}/admin
    真题库：http://localhost:${PORT}/exam
    登录页：http://localhost:${PORT}/login
  ========================================
  `);
});
