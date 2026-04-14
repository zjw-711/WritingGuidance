/**
 * 批量素材生成脚本
 * 对每个子分类用关键词调用 AI 生成素材
 * 用法：node batchGenerate.js
 */
const db = require('./db');
const ai = require('./ai');

db.initDb();
const database = db.getDb();

// 每个子分类的关键词话题（2-3 个话题 × 3-4 条 ≈ 10 条）
const TOPIC_MAP = {
  // 🏮 文化传承
  'culture-confident': [
    '国潮崛起与年轻人文化自信',
    '中国传统文化在海外的传播与影响',
    '文化自信与民族认同'
  ],
  'culture-craft': [
    '非遗传承人的坚守与创新',
    '传统手工艺的现代复兴',
    '民间技艺的数字化保护'
  ],
  'culture-exchange': [
    '一带一路文化交流故事',
    '中外文明互鉴的典型案例',
    '中国影视文化出海'
  ],
  'culture-heritage': [
    '世界文化遗产保护的中国实践',
    '古建筑修复中的工匠精神',
    '考古新发现与文化寻根'
  ],

  // 🤝 人文关怀
  'humanity-care': [
    '留守儿童与乡村教育支持',
    '残障人士的就业与社会融入',
    '老年人的数字鸿沟与关怀'
  ],
  'humanity-empathy': [
    '同理心在医疗领域的体现',
    '灾难中的守望相助',
    '普通人之间的善意传递'
  ],
  'humanity-love': [
    '志愿服务与无私奉献',
    '国际人道主义援助中的中国力量',
    '跨越国界的爱心故事'
  ],
  'humanity-respect': [
    '多元文化的尊重与包容',
    '不同群体之间的理解与对话',
    '消除偏见与歧视的社会实践'
  ],

  // 🌿 人与自然
  'nature-eco': [
    '绿水青山就是金山银山的实践案例',
    '国家公园建设与生态保护',
    '生物多样性保护的中国行动'
  ],
  'nature-env': [
    '塑料污染治理的创新方案',
    '垃圾分类与循环经济',
    '守护碧水蓝天的环保行动'
  ],
  'nature-revere': [
    '人与自然和谐共生的哲学思考',
    '极端天气与人类反思',
    '敬畏自然与传统生态智慧'
  ],
  'nature-sustain': [
    '碳中和目标下的绿色转型',
    '新能源技术与可持续发展',
    '绿色生活方式的兴起'
  ],

  // 🇨🇳 家国情怀
  'patriotism-duty': [
    '新时代青年的家国担当',
    '边疆守卫者的无私奉献',
    '危难时刻挺身而出的普通人'
  ],
  'patriotism-mission': [
    '科技报国的青年科学家',
    '新时代的使命与青年选择',
    '建设强国的各行各业奋斗者'
  ],
  'patriotism-revive': [
    '中国制造到中国创造',
    '文化复兴与民族自信',
    '改革开放中的奋进故事'
  ],
  'patriotism-spirit': [
    '抗战精神的当代传承',
    '海外华侨的爱国情怀',
    '平凡岗位上的爱国表达'
  ],

  // 🧠 哲理思辨
  'phil-change': [
    '人工智能时代变与不变',
    '社会变革中的个人抉择',
    '传统与现代的碰撞融合'
  ],
  'phil-contradict': [
    '科技发展的双刃剑效应',
    '全球化与本土化的矛盾统一',
    '竞争与合作的辩证关系'
  ],
  'phil-dialectic': [
    '快与慢的生活哲学',
    '成功与失败的辩证思考',
    '个人与集体的关系思辨'
  ],
  'phil-tradeoff': [
    '取舍之间的人生智慧',
    '物质追求与精神富足',
    '短期利益与长远发展'
  ],

  // ⭐ 时代楷模
  'rolemodel-dedicate': [
    '扎根基层的奉献者',
    '默默付出的无名英雄',
    '退休后继续发光发热的老人'
  ],
  'rolemodel-hero': [
    '平凡岗位上的不平凡',
    '危难时刻的平民英雄',
    '快递小哥与外卖骑手的奋斗故事'
  ],
  'rolemodel-scientist': [
    '中国科学家的攻坚故事',
    '实验室里的坚守与突破',
    '青年科研人员的创新精神'
  ],
  'rolemodel-youth': [
    '00后的社会担当与创新',
    '大学生支教与乡村建设',
    '青年创业者的梦想与坚持'
  ],

  // 🏘️ 社会民生
  'society-edu': [
    '教育资源共享的探索',
    '职业教育的新发展',
    '乡村教师的坚守与改变'
  ],
  'society-fair': [
    '社会公平正义的进步',
    '法律援助与弱势群体保护',
    '消除贫困的中国经验'
  ],
  'society-health': [
    '公共卫生体系的完善',
    '基层医生的坚守',
    '心理健康与社会关注'
  ],
  'society-rural': [
    '乡村振兴中的青年力量',
    '电商助农的创新模式',
    '返乡创业的新农人'
  ],

  // 🔬 科技创新
  'tech-aerospace': [
    '中国航天的最新突破',
    '商业航天的发展与未来',
    '深空探测与人类梦想'
  ],
  'tech-ai': [
    'AI赋能教育的创新实践',
    '人工智能与艺术创作',
    '大模型技术的落地应用'
  ],
  'tech-digital': [
    '数字乡村建设',
    '数字经济赋能传统产业',
    '数字化转型中的机遇与挑战'
  ],
  'tech-ethics': [
    'AI伦理与人类责任',
    '基因编辑技术的伦理边界',
    '数据隐私与科技向善'
  ],

  // 💎 品德修养
  'virtue-duty': [
    '担当精神的当代诠释',
    '关键时刻的责任抉择',
    '普通人的担当故事'
  ],
  'virtue-honesty': [
    '诚信经营与品牌力量',
    '学术诚信与科研道德',
    '网络时代的诚信建设'
  ],
  'virtue-modest': [
    '谦虚使人进步的现实案例',
    '成功者的低调与谦逊',
    '虚心学习的成长故事'
  ],
  'virtue-persist': [
    '长期主义的坚持与收获',
    '逆境中的坚韧不拔',
    '匠人精神与日复一日'
  ],

  // 🌱 青春成长
  'youth-choice': [
    '高考后的人生选择',
    '志愿填报与理想追寻',
    '面对社会期望与自我追求的抉择'
  ],
  'youth-dream': [
    '追梦路上的青年故事',
    '从草根到舞台的逆袭',
    '青年运动员的奥运梦想'
  ],
  'youth-growth': [
    '失败中的成长与蜕变',
    '走出舒适区的勇气',
    '从迷茫到坚定的成长历程'
  ],
  'youth-think': [
    '信息时代的独立思考',
    '不随波逐流的青年',
    '批判性思维与社会参与'
  ]
};

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function run() {
  // 检查 AI 配置
  const config = ai.readAiConfig();
  if (!config.enabled) {
    console.error('❌ AI 未配置，请先在管理后台配置 API Key / Base URL / Model');
    process.exit(1);
  }
  console.log(`✅ AI 已配置: model=${config.model}`);

  // 获取所有子分类
  const subs = database.prepare(`
    SELECT s.id, s.name, c.id as cat_id, c.name as cat_name
    FROM subcategories s
    JOIN categories c ON c.id = s.category_id
    ORDER BY c.id, s.id
  `).all();

  console.log(`📋 共 ${subs.length} 个子分类，准备生成素材...\n`);

  let totalGenerated = 0;
  let totalSaved = 0;
  let errors = 0;

  for (const sub of subs) {
    const topics = TOPIC_MAP[sub.id];
    if (!topics) {
      console.log(`⚠️  跳过 ${sub.cat_name} > ${sub.name}（无关键词配置）`);
      continue;
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log(`📌 ${sub.cat_name} > ${sub.name}`);
    console.log(`${'='.repeat(60)}`);

    for (const topic of topics) {
      try {
        // 每个话题生成 3-4 条
        const count = topics.length === 3 ? 4 : 3;
        console.log(`  🔄 话题「${topic}」生成 ${count} 条...`);

        // 查已有标题
        const existing = database.prepare('SELECT title FROM materials').all();
        const existingTitles = existing.map(r => r.title);

        // 获取该分类的子分类列表
        const subList = database.prepare('SELECT id, name FROM subcategories WHERE category_id = ?').all(sub.cat_id);

        const materials = await ai.generateMaterialsByTopic(topic, sub.cat_id, subList, count, existingTitles);
        totalGenerated += materials.length;

        if (materials.length === 0) {
          console.log(`  ⚠️  未生成合格素材`);
          continue;
        }

        // 存入数据库
        const insertMat = database.prepare(`
          INSERT INTO materials (id, title, content, category_id, subcategory_id, type_id, source, status, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', date('now'))
        `);
        const insertTag = database.prepare('INSERT INTO material_tags (material_id, tag) VALUES (?, ?)');
        const insertTopic = database.prepare('INSERT INTO material_topics (material_id, topic) VALUES (?, ?)');

        const insertAll = database.transaction((items) => {
          for (const mat of items) {
            const id = db.generateId('m');
            insertMat.run(id, mat.title, mat.content, sub.cat_id, sub.id, mat.type || 'story', mat.source || 'AI 生成');
            for (const tag of (mat.tags || [])) insertTag.run(id, tag);
            for (const t of (mat.applicableTopics || [])) insertTopic.run(id, t);
            totalSaved++;
          }
        });

        insertAll(materials);

        console.log(`  ✅ 保存 ${materials.length} 条: ${materials.map(m => '「' + m.title + '」').join('、')}`);

        // 请求间隔，避免频率限制
        await sleep(3000);

      } catch (err) {
        errors++;
        console.error(`  ❌ 失败: ${err.message}`);
        // 出错后多等一会儿
        await sleep(8000);
      }
    }
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`📊 生成完毕！`);
  console.log(`   AI 生成并通过筛选: ${totalGenerated} 条`);
  console.log(`   成功存入数据库: ${totalSaved} 条`);
  console.log(`   失败次数: ${errors}`);
  console.log(`   状态: 全部为 pending（待审核），请到管理后台审核发布`);

  process.exit(0);
}

run();
