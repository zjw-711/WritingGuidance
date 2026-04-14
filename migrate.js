/**
 * 一次性迁移脚本：JSON → SQLite
 * 用法：node migrate.js
 */
const fs = require('fs');
const path = require('path');
const { initDb, generateId } = require('./db');

const MATERIALS_FILE = path.join(__dirname, 'data', 'materials.json');
const EXAM_FILE = path.join(__dirname, 'data', 'examQuestions.json');

function migrate() {
  const db = initDb();

  // 读取 JSON 数据
  const materialsData = JSON.parse(fs.readFileSync(MATERIALS_FILE, 'utf-8'));
  const examData = JSON.parse(fs.readFileSync(EXAM_FILE, 'utf-8'));

  console.log('开始迁移数据...');

  const migrateAll = db.transaction(() => {
    // 1. Types（3 条固定数据）
    const insertType = db.prepare('INSERT OR IGNORE INTO types (id, name) VALUES (?, ?)');
    for (const t of materialsData.types) {
      insertType.run(t.id, t.name);
    }
    console.log(`  类型: ${materialsData.types.length} 条`);

    // 2. Categories + Subcategories
    const insertCat = db.prepare('INSERT OR IGNORE INTO categories (id, name, icon) VALUES (?, ?, ?)');
    const insertSub = db.prepare('INSERT OR IGNORE INTO subcategories (id, name, category_id) VALUES (?, ?, ?)');

    for (const c of materialsData.categories) {
      insertCat.run(c.id, c.name, c.icon || '📁');
      for (const s of (c.subcategories || [])) {
        insertSub.run(s.id, s.name, c.id);
      }
    }
    console.log(`  分类: ${materialsData.categories.length} 个一级, ${materialsData.categories.reduce((n, c) => n + (c.subcategories || []).length, 0)} 个二级`);

    // 3. Materials + tags/topics/links
    const insertMat = db.prepare(`INSERT OR IGNORE INTO materials (id, title, content, category_id, subcategory_id, type_id, source, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
    const insertTag = db.prepare('INSERT INTO material_tags (material_id, tag) VALUES (?, ?)');
    const insertTopic = db.prepare('INSERT INTO material_topics (material_id, topic) VALUES (?, ?)');
    const insertLink = db.prepare('INSERT INTO material_links (material_id, title, url, type) VALUES (?, ?, ?, ?)');

    for (const m of materialsData.materials) {
      insertMat.run(m.id, m.title, m.content, m.category || null, m.subcategory || null,
        m.type || null, m.source || '', m.createdAt || '2026-01-01');

      for (const tag of (m.tags || [])) {
        insertTag.run(m.id, tag);
      }
      for (const topic of (m.applicableTopics || [])) {
        insertTopic.run(m.id, topic);
      }
      for (const link of (m.links || [])) {
        insertLink.run(m.id, link.title, link.url, link.type || 'article');
      }
    }
    console.log(`  素材: ${materialsData.materials.length} 条`);

    // 收集已有的素材 ID，用于过滤悬空引用
    const existingMaterialIds = new Set(materialsData.materials.map(m => m.id));

    // 4. Question Analysis + angles + materials
    const insertQA = db.prepare(`INSERT OR IGNORE INTO question_analysis (id, title, category_id, subcategory_id, question_type, sample_question, tips)
      VALUES (?, ?, ?, ?, ?, ?, ?)`);
    const insertQAAngle = db.prepare('INSERT INTO qa_angles (qa_id, angle) VALUES (?, ?)');
    const insertQAMat = db.prepare('INSERT INTO qa_materials (qa_id, material_id) VALUES (?, ?)');

    for (const qa of (materialsData.questionAnalysis || [])) {
      insertQA.run(qa.id, qa.title, qa.category || null, qa.subcategory || null,
        qa.questionType || '', qa.sampleQuestion || '', qa.tips || '');

      for (const angle of (qa.angles || [])) {
        insertQAAngle.run(qa.id, angle);
      }
      for (const mid of (qa.materialIds || [])) {
        if (existingMaterialIds.has(mid)) {
          insertQAMat.run(qa.id, mid);
        }
      }
    }
    console.log(`  命题分析: ${(materialsData.questionAnalysis || []).length} 条`);

    // 5. Exam Questions + keywords/angles/materials
    const insertExam = db.prepare(`INSERT OR IGNORE INTO exam_questions (id, year, region, region_type, content, requirement, analysis, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
    const insertExamKw = db.prepare('INSERT INTO exam_keywords (exam_id, keyword) VALUES (?, ?)');
    const insertExamAngle = db.prepare('INSERT INTO exam_angles (exam_id, angle) VALUES (?, ?)');
    const insertExamMat = db.prepare('INSERT INTO exam_materials (exam_id, material_id) VALUES (?, ?)');

    for (const eq of examData.examQuestions) {
      insertExam.run(eq.id, eq.year, eq.region, eq.regionType || '',
        eq.content || '', eq.requirement || '', eq.analysis || '', eq.createdAt || '2026-01-01');

      for (const kw of (eq.keywords || [])) {
        insertExamKw.run(eq.id, kw);
      }
      for (const angle of (eq.angles || [])) {
        insertExamAngle.run(eq.id, angle);
      }
      for (const mid of (eq.linkedMaterialIds || [])) {
        if (existingMaterialIds.has(mid)) {
          insertExamMat.run(eq.id, mid);
        }
      }
    }
    console.log(`  历年真题: ${examData.examQuestions.length} 条`);
  });

  try {
    migrateAll();
    console.log('\n迁移成功！数据库文件: data/gaokao.db');

    // 验证
    const db2 = db;
    const counts = {
      categories: db2.prepare('SELECT COUNT(*) as c FROM categories').get().c,
      subcategories: db2.prepare('SELECT COUNT(*) as c FROM subcategories').get().c,
      materials: db2.prepare('SELECT COUNT(*) as c FROM materials').get().c,
      tags: db2.prepare('SELECT COUNT(*) as c FROM material_tags').get().c,
      links: db2.prepare('SELECT COUNT(*) as c FROM material_links').get().c,
      qa: db2.prepare('SELECT COUNT(*) as c FROM question_analysis').get().c,
      exams: db2.prepare('SELECT COUNT(*) as c FROM exam_questions').get().c,
    };
    console.log('\n数据验证:', JSON.stringify(counts, null, 2));
  } catch (err) {
    console.error('迁移失败:', err.message);
    process.exit(1);
  }
}

migrate();
