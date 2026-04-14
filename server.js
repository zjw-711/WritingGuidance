const express = require('express');
const cors = require('cors');
const path = require('path');
const { getDb, generateId } = require('./db');

const app = express();
const PORT = process.env.PORT || 3001;

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
    createdAt: row.created_at
  };
  // tags
  const tags = db.prepare('SELECT tag FROM material_tags WHERE material_id = ?').all(row.id);
  m.tags = tags.map(t => t.tag);
  // topics
  const topics = db.prepare('SELECT topic FROM material_topics WHERE material_id = ?').all(row.id);
  m.applicableTopics = topics.map(t => t.topic);
  // links
  const links = db.prepare('SELECT title, url, type FROM material_links WHERE material_id = ?').all(row.id);
  m.links = links;
  return m;
}

// ========== 前端页面路由 ==========
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/exam', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'exam.html'));
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

app.put('/api/categories', (req, res) => {
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

    // 关键：INSERT OR REPLACE INTO categories 会先 DELETE 再 INSERT，
    // 而 subcategories 有 ON DELETE CASCADE，会导致所有子分类被级联删除。
    // 但 materials.subcategory_id → subcategories.id 是 NO ACTION，
    // 所以必须先清除 materials 和 question_analysis 中所有对子分类的引用。
    db.prepare('UPDATE materials SET subcategory_id = NULL WHERE subcategory_id IS NOT NULL').run();
    db.prepare('UPDATE question_analysis SET subcategory_id = NULL WHERE subcategory_id IS NOT NULL').run();

    // 清除被删除分类在素材和命题分析中的引用
    for (const cid of removedCatIds) {
      db.prepare('UPDATE materials SET category_id = NULL WHERE category_id = ?').run(cid);
      db.prepare('UPDATE question_analysis SET category_id = NULL WHERE category_id = ?').run(cid);
    }

    // 删除所有旧的子分类和分类（安全，因为引用已清除）
    db.prepare('DELETE FROM subcategories').run();
    for (const cid of removedCatIds) {
      db.prepare('DELETE FROM categories WHERE id = ?').run(cid);
    }

    // 更新或插入分类
    const upsertCat = db.prepare('INSERT OR REPLACE INTO categories (id, name, icon) VALUES (?, ?, ?)');
    for (const c of newCats) {
      upsertCat.run(c.id, c.name, c.icon || '📁');
    }

    // 插入子分类
    const insertSub = db.prepare('INSERT INTO subcategories (id, name, category_id) VALUES (?, ?, ?)');
    for (const c of newCats) {
      for (const s of (c.subcategories || [])) {
        insertSub.run(s.id, s.name, c.id);
      }
    }

    // 恢复保留分类的子分类引用（被删除分类的子分类不再恢复，其素材引用已设为 NULL）
    for (const c of newCats) {
      for (const s of (c.subcategories || [])) {
        db.prepare('UPDATE materials SET subcategory_id = ? WHERE subcategory_id IS NULL AND category_id = ?').run(s.id, c.id);
        db.prepare('UPDATE question_analysis SET subcategory_id = ? WHERE subcategory_id IS NULL AND category_id = ?').run(s.id, c.id);
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

  const data = rows.map(r => buildMaterial(r));

  res.json({ total, page: parseInt(page), pageSize: parseInt(pageSize), data });
});

// 获取单个素材
app.get('/api/materials/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM materials WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: '素材不存在' });
  res.json(buildMaterial(row));
});

// 新增素材
app.post('/api/materials', (req, res) => {
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
app.put('/api/materials/:id', (req, res) => {
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
      body.category !== undefined ? body.category : row.category_id,
      body.subcategory !== undefined ? body.subcategory : row.subcategory_id,
      body.type !== undefined ? body.type : row.type_id,
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
app.delete('/api/materials/:id', (req, res) => {
  const row = db.prepare('SELECT id FROM materials WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: '素材不存在' });
  const r = db.prepare('DELETE FROM materials WHERE id = ?').run(req.params.id);
  res.json({ success: true, deleted: r.changes });
});

// 批量删除素材
app.post('/api/materials/batch-delete', (req, res) => {
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
app.get('/api/stats', (req, res) => {
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
app.get('/api/export', (req, res) => {
  const categories = db.prepare('SELECT * FROM categories ORDER BY id').all().map(c => ({
    ...c,
    subcategories: db.prepare('SELECT id, name FROM subcategories WHERE category_id = ?').all(c.id)
  }));
  const types = db.prepare('SELECT * FROM types').all();
  const materials = db.prepare('SELECT * FROM materials ORDER BY created_at DESC').all().map(m => buildMaterial(m));
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

// 数据导入
app.post('/api/import', (req, res) => {
  const imported = req.body;
  if (!imported.materials || !Array.isArray(imported.materials)) {
    return res.status(400).json({ error: '数据格式错误' });
  }

  let count = 0;
  const doImport = db.transaction(() => {
    for (const m of imported.materials) {
      const id = generateId('m');
      const createdAt = m.createdAt || new Date().toISOString().split('T')[0];
      db.prepare(`INSERT INTO materials (id, title, content, category_id, subcategory_id, type_id, source, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
          id, m.title || '', m.content || '', m.category || null,
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
      count++;
    }
  });

  try {
    doImport();
    res.json({ success: true, imported: count });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`
  ========================================
    高考作文素材网站已启动！
    学生端：http://localhost:${PORT}
    管理端：http://localhost:${PORT}/admin
    真题库：http://localhost:${PORT}/exam
  ========================================
  `);
});
