const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, 'data', 'gaokao.db');

let db = null;

function initDb() {
  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    -- ========== 主表 ==========
    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      icon TEXT DEFAULT '📁'
    );

    CREATE TABLE IF NOT EXISTS subcategories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS types (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS materials (
      id TEXT PRIMARY KEY,
      title TEXT DEFAULT '',
      content TEXT DEFAULT '',
      category_id TEXT REFERENCES categories(id),
      subcategory_id TEXT REFERENCES subcategories(id),
      type_id TEXT REFERENCES types(id),
      source TEXT DEFAULT '',
      created_at TEXT DEFAULT (date('now'))
    );

    CREATE TABLE IF NOT EXISTS question_analysis (
      id TEXT PRIMARY KEY,
      title TEXT DEFAULT '',
      category_id TEXT REFERENCES categories(id),
      subcategory_id TEXT REFERENCES subcategories(id),
      question_type TEXT DEFAULT '',
      sample_question TEXT DEFAULT '',
      tips TEXT DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS exam_questions (
      id TEXT PRIMARY KEY,
      year INTEGER NOT NULL,
      region TEXT NOT NULL,
      region_type TEXT DEFAULT '',
      content TEXT DEFAULT '',
      requirement TEXT DEFAULT '',
      analysis TEXT DEFAULT '',
      created_at TEXT DEFAULT (date('now'))
    );

    -- ========== 关联表 ==========
    CREATE TABLE IF NOT EXISTS material_tags (
      material_id TEXT NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
      tag TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS material_topics (
      material_id TEXT NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
      topic TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS material_links (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      material_id TEXT NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
      title TEXT DEFAULT '',
      url TEXT DEFAULT '',
      type TEXT DEFAULT 'article'
    );

    CREATE TABLE IF NOT EXISTS qa_materials (
      qa_id TEXT NOT NULL REFERENCES question_analysis(id) ON DELETE CASCADE,
      material_id TEXT NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
      PRIMARY KEY (qa_id, material_id)
    );

    CREATE TABLE IF NOT EXISTS qa_angles (
      qa_id TEXT NOT NULL REFERENCES question_analysis(id) ON DELETE CASCADE,
      angle TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS exam_keywords (
      exam_id TEXT NOT NULL REFERENCES exam_questions(id) ON DELETE CASCADE,
      keyword TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS exam_angles (
      exam_id TEXT NOT NULL REFERENCES exam_questions(id) ON DELETE CASCADE,
      angle TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS exam_materials (
      exam_id TEXT NOT NULL REFERENCES exam_questions(id) ON DELETE CASCADE,
      material_id TEXT NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
      PRIMARY KEY (exam_id, material_id)
    );

    -- ========== 索引 ==========
    CREATE INDEX IF NOT EXISTS idx_subcategories_category ON subcategories(category_id);
    CREATE INDEX IF NOT EXISTS idx_materials_category ON materials(category_id);
    CREATE INDEX IF NOT EXISTS idx_materials_type ON materials(type_id);
    CREATE INDEX IF NOT EXISTS idx_materials_created ON materials(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_material_tags_tag ON material_tags(tag);
    CREATE INDEX IF NOT EXISTS idx_material_tags_mid ON material_tags(material_id);
    CREATE INDEX IF NOT EXISTS idx_material_topics_mid ON material_topics(material_id);
    CREATE INDEX IF NOT EXISTS idx_material_links_mid ON material_links(material_id);
    CREATE INDEX IF NOT EXISTS idx_exam_questions_year ON exam_questions(year DESC);
    CREATE INDEX IF NOT EXISTS idx_exam_questions_region ON exam_questions(region);
    CREATE INDEX IF NOT EXISTS idx_qa_materials_qa ON qa_materials(qa_id);
    CREATE INDEX IF NOT EXISTS idx_exam_materials_exam ON exam_materials(exam_id);
  `);

  return db;
}

function getDb() {
  if (!db) initDb();
  return db;
}

function generateId(prefix = 'm') {
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

module.exports = { initDb, getDb, generateId };
