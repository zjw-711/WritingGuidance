const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;
const DATA_FILE = path.join(__dirname, 'data', 'materials.json');

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ========== 工具函数 ==========
function readData() {
  const raw = fs.readFileSync(DATA_FILE, 'utf-8');
  return JSON.parse(raw);
}

function writeData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

function generateId() {
  return 'm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// ========== 前端页面路由 ==========
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// ========== API：分类 ==========
app.get('/api/categories', (req, res) => {
  const data = readData();
  res.json(data.categories);
});

app.put('/api/categories', (req, res) => {
  const data = readData();
  data.categories = req.body;
  writeData(data);
  res.json({ success: true });
});

// ========== API：素材类型 ==========
app.get('/api/types', (req, res) => {
  const data = readData();
  res.json(data.types);
});

// ========== API：素材 CRUD ==========

// 获取素材列表（支持筛选、搜索、分页）
app.get('/api/materials', (req, res) => {
  const data = readData();
  let materials = data.materials;

  const { category, type, search, tag, page = 1, pageSize = 20 } = req.query;

  // 按分类筛选
  if (category) {
    materials = materials.filter(m => m.category === category);
  }

  // 按子分类筛选
  const subcategory = req.query.subcategory;
  if (subcategory) {
    materials = materials.filter(m => m.subcategory === subcategory);
  }

  // 按类型筛选
  if (type) {
    materials = materials.filter(m => m.type === type);
  }

  // 按标签筛选
  if (tag) {
    materials = materials.filter(m => m.tags && m.tags.includes(tag));
  }

  // 关键词搜索（搜标题、内容、标签、适用话题）
  if (search) {
    const kw = search.toLowerCase();
    materials = materials.filter(m =>
      m.title.toLowerCase().includes(kw) ||
      m.content.toLowerCase().includes(kw) ||
      (m.tags && m.tags.some(t => t.toLowerCase().includes(kw))) ||
      (m.applicableTopics && m.applicableTopics.some(t => t.toLowerCase().includes(kw)))
    );
  }

  // 按创建时间倒序
  materials.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  // 分页
  const total = materials.length;
  const start = (parseInt(page) - 1) * parseInt(pageSize);
  const paged = materials.slice(start, start + parseInt(pageSize));

  res.json({
    total,
    page: parseInt(page),
    pageSize: parseInt(pageSize),
    data: paged
  });
});

// 获取单个素材
app.get('/api/materials/:id', (req, res) => {
  const data = readData();
  const material = data.materials.find(m => m.id === req.params.id);
  if (!material) return res.status(404).json({ error: '素材不存在' });
  res.json(material);
});

// 新增素材
app.post('/api/materials', (req, res) => {
  const data = readData();
  const material = {
    id: generateId(),
    title: req.body.title || '',
    content: req.body.content || '',
    category: req.body.category || '',
    subcategory: req.body.subcategory || '',
    type: req.body.type || '',
    tags: req.body.tags || [],
    source: req.body.source || '',
    applicableTopics: req.body.applicableTopics || [],
    createdAt: new Date().toISOString().split('T')[0]
  };
  data.materials.push(material);
  writeData(data);
  res.json({ success: true, material });
});

// 更新素材
app.put('/api/materials/:id', (req, res) => {
  const data = readData();
  const index = data.materials.findIndex(m => m.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: '素材不存在' });

  const material = data.materials[index];
  data.materials[index] = {
    ...material,
    title: req.body.title !== undefined ? req.body.title : material.title,
    content: req.body.content !== undefined ? req.body.content : material.content,
    category: req.body.category !== undefined ? req.body.category : material.category,
    subcategory: req.body.subcategory !== undefined ? req.body.subcategory : material.subcategory,
    type: req.body.type !== undefined ? req.body.type : material.type,
    tags: req.body.tags !== undefined ? req.body.tags : material.tags,
    source: req.body.source !== undefined ? req.body.source : material.source,
    applicableTopics: req.body.applicableTopics !== undefined ? req.body.applicableTopics : material.applicableTopics,
  };
  writeData(data);
  res.json({ success: true, material: data.materials[index] });
});

// 删除素材
app.delete('/api/materials/:id', (req, res) => {
  const data = readData();
  const index = data.materials.findIndex(m => m.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: '素材不存在' });

  data.materials.splice(index, 1);
  writeData(data);
  res.json({ success: true });
});

// 批量删除素材
app.post('/api/materials/batch-delete', (req, res) => {
  const data = readData();
  const { ids } = req.body;
  if (!Array.isArray(ids)) return res.status(400).json({ error: 'ids 必须为数组' });

  data.materials = data.materials.filter(m => !ids.includes(m.id));
  writeData(data);
  res.json({ success: true, deleted: ids.length });
});

// 获取所有标签（聚合）
app.get('/api/tags', (req, res) => {
  const data = readData();
  const tagSet = new Set();
  data.materials.forEach(m => {
    if (m.tags) m.tags.forEach(t => tagSet.add(t));
  });
  res.json([...tagSet].sort());
});

// 数据统计
app.get('/api/stats', (req, res) => {
  const data = readData();
  const totalMaterials = data.materials.length;
  const categoryStats = {};
  data.categories.forEach(c => {
    categoryStats[c.id] = data.materials.filter(m => m.category === c.id).length;
  });
  const typeStats = {};
  data.types.forEach(t => {
    typeStats[t.id] = data.materials.filter(m => m.type === t.id).length;
  });
  res.json({ totalMaterials, categoryStats, typeStats, totalCategories: data.categories.length });
});

// 数据导出
app.get('/api/export', (req, res) => {
  const data = readData();
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', 'attachment; filename=materials_export.json');
  res.json(data);
});

// ========== API：命题分析 ==========

// 获取命题分析列表（支持按分类和子分类筛选）
app.get('/api/question-analysis', (req, res) => {
  const data = readData();
  let qa = data.questionAnalysis || [];
  const { category, subcategory } = req.query;

  if (category) qa = qa.filter(q => q.category === category);
  if (subcategory) qa = qa.filter(q => q.subcategory === subcategory);

  // 为每条分析附带素材摘要
  qa = qa.map(q => ({
    ...q,
    materials: (q.materialIds || []).map(mid => {
      const m = data.materials.find(mat => mat.id === mid);
      return m ? { id: m.id, title: m.title, type: m.type } : null;
    }).filter(Boolean)
  }));

  res.json(qa);
});

// 获取单个命题分析
app.get('/api/question-analysis/:id', (req, res) => {
  const data = readData();
  const qa = (data.questionAnalysis || []).find(q => q.id === req.params.id);
  if (!qa) return res.status(404).json({ error: '命题分析不存在' });

  // 附带完整素材
  const result = {
    ...qa,
    materials: (qa.materialIds || []).map(mid => {
      return data.materials.find(m => m.id === mid) || null;
    }).filter(Boolean)
  };
  res.json(result);
});

// 数据导入
app.post('/api/import', (req, res) => {
  const imported = req.body;
  if (!imported.materials || !Array.isArray(imported.materials)) {
    return res.status(400).json({ error: '数据格式错误' });
  }
  const data = readData();
  // 为导入的素材重新生成 ID，避免冲突
  const newMaterials = imported.materials.map(m => ({
    ...m,
    id: generateId(),
    createdAt: m.createdAt || new Date().toISOString().split('T')[0]
  }));
  data.materials = [...data.materials, ...newMaterials];
  writeData(data);
  res.json({ success: true, imported: newMaterials.length });
});

app.listen(PORT, () => {
  console.log(`
  ========================================
    高考作文素材网站已启动！
    学生端：http://localhost:${PORT}
    管理端：http://localhost:${PORT}/admin
  ========================================
  `);
});
