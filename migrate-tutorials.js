/**
 * 教程数据迁移脚本
 * 将模拟数据写入 tutorials 相关表
 */

const { getDb, generateId } = require('./db');

const db = getDb();

// 模拟教程数据（从 main.js 复制）
const mockTutorials = {
  'youth': {
    categoryId: 'youth',
    title: '青年成长',
    propositionAnalysis: '"青年成长"类命题常聚焦于：梦想与现实的张力、个人选择与社会期待的博弈、成长中的挫折与超越。审题时需抓住"成长"的动态性——不是静止状态，而是过程与蜕变。',
    philosophyGuide: '<p><strong>辩证法引入：</strong>"成长是矛盾的统一——梦想与现实的张力，恰恰是前行的动力。"</p><p><strong>量变质变：</strong>"每一次坚持都是量的积累，终将迎来质的飞跃。女足逆转夺冠，正是长期积淀的质变时刻。"</p><p><strong>否定之否定：</strong>"真正的成长不是直线，而是螺旋上升。挫折是对现状的否定，却孕育着更高层次的肯定。"</p>',
    directions: [
      { title: '梦想与坚持', description: '探讨青年追梦过程中的困境与坚守' },
      { title: '选择与担当', description: '个人发展与社会责任的平衡' },
      { title: '挫折与超越', description: '逆境中成长的价值与意义' }
    ],
    questions: [
      {
        shortTitle: '2024全国甲卷',
        title: '2024年全国甲卷作文题',
        text: '人们因技术发展得以更好地掌控时间，但也有人因此成了时间的仆人。请以"技术与时间"为主题，结合青年成长的思考，写一篇文章。',
        note: '关键词：技术、时间掌控、青年自主性',
        approach: '<p><strong>并列式结构：</strong>从"梦想""担当""超越"三个维度展开，每个维度配以典型人物素材。</p><p><strong>层进式结构：</strong>成长始于觉醒 → 成于坚守 → 升于超越，层层递进深化主题。</p><p><strong>对照式结构：</strong>对比"躺平"与"奋斗"两种青年姿态，以反面衬托正面价值。</p>'
      },
      {
        shortTitle: '2023新课标I卷',
        title: '2023年新课标I卷作文题',
        text: '好的故事，可以帮我们更好地表达和沟通，可以触动心灵、启迪智慧；好的故事，可以改变一个人的命运，可以展现一个民族的形象……故事是有力量的。请以"故事的力量"为主题写作。',
        note: '关键词：故事力量、表达沟通、人生影响',
        approach: '<p><strong>故事叙事式：</strong>以一个感人的成长故事为主线，层层铺展青年的奋斗历程。</p><p><strong>群像并列式：</strong>多个青年榜样故事并列，形成"奋斗群像"，增强说服力。</p><p><strong>哲思升华式：</strong>从具体故事上升到对成长本质的思辨，探讨"故事如何塑造人生"。</p>'
      },
      {
        shortTitle: '模拟题',
        title: '模拟命题：青春的选择',
        text: '在人生的十字路口，青年面临无数选择：是追逐个人梦想，还是承担社会责任？是安稳前行，还是冒险突围？请以"青春的选择"为题，谈谈你的思考。',
        note: '关键词：选择、梦想、责任、成长路径',
        approach: '<p><strong>辩证式结构：</strong>分析"梦想"与"责任"看似对立实则统一的关系。</p><p><strong>层进式结构：</strong>认识选择的多样性 → 理解选择的意义 → 做出有意义的选择。</p><p><strong>对照式结构：</strong>对比不同选择带来的不同人生轨迹，以实例论证"选择决定命运"。</p>'
      }
    ],
    examples: [
      {
        shortTitle: '并列式示例',
        title: '青春三问：梦想、担当、超越',
        text: `<p>青春是一场持续的追问与选择。第一问：<strong>梦想何为？</strong>袁隆平从田野到实验室，用一生追逐"让所有人吃饱饭"的梦；樊锦诗从繁华都市到大漠戈壁，以半个世纪守护千年文明。他们的青春，因梦想而有了方向。</p>
<p>第二问：<strong>担当何往？</strong>外卖小哥彭清林从十二米高的钱塘江大桥一跃而下，不是为了成为英雄，而是"做了该做的事"。当代青年返乡创业，用新知识带动乡村振兴——担当，从来不是空谈，而是行动。</p>
<p>第三问：<strong>超越何来？</strong>中国女足在0:2落后的绝境中逆转夺冠，诠释了"永不言弃"的真意。青春的超越，不是一帆风顺的航行，而是在逆境中依然选择前行。</p>`,
        highlight: '梁启超有言："少年自有少年狂，身似山河挺脊梁，敢将日月再丈量。"青春的答案，写在每一次选择、每一份担当、每一次超越中。',
        analysis: '并列式结构：以"梦想""担当""超越"三个关键词并列展开，每个维度配以典型人物素材，结尾引用名言升华主题。段落整齐，节奏分明。'
      },
      {
        shortTitle: '层进式示例',
        title: '从觉醒到超越',
        text: `<p>青年的成长，始于觉醒。何为觉醒？是意识到个人命运与社会相连，是明白"躺平"非出路、"奋斗"才是正途。樊锦诗在北大毕业时觉醒——她没有选择安逸，而是走向敦煌，因为她知道文化的根脉需要守护。</p>
<p>觉醒之后，是坚守。敦煌五十年，大漠孤烟，风沙漫漫。她忍受孤独、抵御诱惑，只为一个信念：莫高窟不能消失。这份坚守，是量变的积累，为质变做准备。</p>
<p>坚守的终点，是超越。女足姑娘们在绝境中逆转，不是因为天赋异禀，而是长期积淀后的爆发。超越，是对过往的否定，却孕育着更高层次的肯定。</p>`,
        highlight: '量变质变、否定之否定——辩证法的智慧在青年成长中生动呈现。',
        analysis: '层进式结构：觉醒→坚守→超越，层层递进深化主题。素材按时间线展开，体现成长的过程性，结尾以哲学概念升华。'
      },
      {
        shortTitle: '对照式示例',
        title: '躺平还是奋斗？',
        text: `<p>当"躺平"成为一种流行词，我们不禁追问：青年的人生，该如何选择？</p>
<p>有人选择躺平——放弃梦想、逃避责任、安于现状。他们或许觉得，世界太复杂、竞争太激烈、努力太辛苦。躺平，似乎是一种自我保护。</p>
<p>但也有人选择奋斗——袁隆平九十年如一日扎根稻田，樊锦诗半个世纪守护敦煌，彭清林关键时刻纵身一跃，女足姑娘逆境中永不言弃。他们的青春，因奋斗而闪光。</p>
<p>躺平者或许暂时轻松，但终将发现：逃避的人生，没有厚度。奋斗者或许一路艰辛，但他们收获的是：有意义的人生，有价值的青春。</p>`,
        highlight: '选择躺平，是对青春的辜负；选择奋斗，是对生命的尊重。',
        analysis: '对照式结构：以"躺平"与"奋斗"对比，反面衬托正面价值，强化论点说服力。素材作为正面例证，与反面形成张力。'
      }
    ],
    tips: [
      { icon: '✨', title: '开头抓眼球', content: '用设问、对比、名言引出主题，让阅卷老师一眼记住你的观点。' },
      { icon: '🔗', title: '过渡要自然', content: '段落之间用"然而""正是""与此同时"等词语衔接，避免生硬跳跃。' },
      { icon: '💡', title: '素材要鲜活', content: '选择有时代感的素材，避免陈旧事例。用细节描写增强说服力。' },
      { icon: '🎯', title: '结尾要升华', content: '不要简单重复开头，用哲理思辨或时代呼应，让主题更有深度。' }
    ],
    materialIds: ['m010', 'm007', 'm009', 'm001']
  },
  'culture': {
    categoryId: 'culture',
    title: '文化传承',
    propositionAnalysis: '"文化传承"类命题常探讨：传统与现代的关系、文化遗产保护的责任、文化创新与守正的平衡。审题关键在于理解"传承"不是简单的复制，而是在继承中创新。',
    philosophyGuide: '<p><strong>历史唯物主义：</strong>"文化传承是社会发展的精神纽带，承载着一个民族的集体记忆与价值认同。"</p><p><strong>辩证统一：</strong>"传统与现代看似对立，实则统一。传统为现代提供根基，现代为传统注入活力。"</p>',
    directions: [
      { title: '守正与创新', description: '如何在传承中保持文化精髓并创新发展' },
      { title: '遗产保护', description: '文化遗产的价值与保护责任' },
      { title: '文化自信', description: '传统文化的当代价值与青年担当' }
    ],
    questions: [
      {
        shortTitle: '2022全国乙卷',
        title: '2022年全国乙卷作文题',
        text: '双奥之城北京，见证了中国的跨越式发展。从2008到2022，中国以开放自信的姿态拥抱世界。请以"跨越"为主题，结合文化传承与发展写作。',
        note: '关键词：跨越、开放、自信、文化发展',
        approach: '<p><strong>并列式结构：</strong>从"守护""创新""传播"三个层面展开，展现文化传承的完整图景。</p><p><strong>层进式结构：</strong>认识文化价值 → 承担传承责任 → 实现创新转化。</p>'
      },
      {
        shortTitle: '模拟题',
        title: '模拟命题：传统文化的当代价值',
        text: '有人说传统文化是包袱，有人说它是根脉。作为新时代青年，你如何看待传统文化的当代价值？请写一篇文章表达你的观点。',
        note: '关键词：传统文化、当代价值、青年视角',
        approach: '<p><strong>辩证式结构：</strong>"守正"与"创新"并非对立，而是相辅相成——守正是根基，创新是生命力。</p>'
      }
    ],
    examples: [
      {
        shortTitle: '并列式示例',
        title: '传承的三重境界',
        text: `<p>文化传承，第一重是<strong>守护</strong>。樊锦诗扎根敦煌半个世纪，守护千年石窟；非遗传承人坚守技艺，守护民族文化根脉。守护，是传承的起点，是对历史的敬畏与责任。</p>
<p>第二重是<strong>创新</strong>。故宫文创让传统文化走进年轻人的日常，国风音乐将古典旋律与现代节拍融合。创新，不是背叛传统，而是赋予传统新的生命力，让它活在当下。</p>
<p>第三重是<strong>传播</strong>。数字敦煌让全球观众都能触摸千年文明，国风音乐在海外社交平台走红。传播，让文化从静态的遗产变成动态的交流，从本土的骄傲变成世界的财富。</p>`,
        highlight: '守护是根，创新是魂，传播是翼。三者相辅相成，方能让文化传承生生不息。',
        analysis: '并列式结构：守护→创新→传播，三个维度并列展开，素材均匀分布，逻辑清晰整齐。'
      },
      {
        shortTitle: '辩证式示例',
        title: '传统与现代的辩证',
        text: `<p>有人说传统文化是包袱，有人说它是根脉。两种观点看似对立，实则揭示了传承的辩证智慧。</p>
<p>传统文化确实有"包袱"的一面——那些不再适应时代的形式、观念，需要理性审视、创造性转化。但不能因此否定传统本身。樊锦诗保护敦煌，不是为了把石窟封存起来，而是用数字技术让它永恒存在。</p>
<p>"根脉"的价值更为深远。文化是一个民族的灵魂，承载着集体记忆与价值认同。故宫文创的成功，恰恰证明传统可以与现代相融合，根脉可以开出新花。</p>`,
        highlight: '不忘本来，吸收外来，面向未来——这才是文化传承的正确姿态。',
        analysis: '辩证式结构：先呈现对立观点，再分析二者的合理性，最后提出综合见解。素材作为论据支撑辩证分析。'
      }
    ],
    tips: [
      { icon: '📜', title: '引用经典', content: '引用经典文献或名人名言，增添文化底蕴，让论述更有说服力。' },
      { icon: '🔄', title: '古今对照', content: '将传统文化与现代生活对比，展现传承的时代意义与当代价值。' },
      { icon: '🎨', title: '具体案例', content: '用具体的文化项目（数字敦煌、故宫文创）作为例证，避免空泛议论。' },
      { icon: '🌏', title: '全球视野', content: '展现文化传播的国际影响，让主题从"传承"上升到"交流"。' }
    ],
    materialIds: ['m007', 'm008']
  },
  'humanity': {
    categoryId: 'humanity',
    title: '人性光辉',
    propositionAnalysis: '"人性光辉"类命题聚焦于：平凡人的英雄行为、善意的力量、人性中的真善美。审题时要抓住"光辉"的本质——在困境中闪耀的人性光芒。',
    philosophyGuide: '<p><strong>人性论：</strong>"人性之光，不在于惊天动地的壮举，而在于关键时刻的选择——那一刻，平凡人成为英雄。"</p><p><strong>价值论：</strong>"善意的价值不因微小而减损，每一份善意都是人性光辉的闪烁。"</p>',
    directions: [
      { title: '平凡与伟大', description: '普通人如何成为时代英雄' },
      { title: '善意传递', description: '小小的善意如何汇聚成大爱' },
      { title: '人性考验', description: '关键时刻的人性选择' }
    ],
    questions: [
      {
        shortTitle: '2021全国甲卷',
        title: '2021年全国甲卷作文题',
        text: '有人说，经过时间的沉淀，我们认识事物的价值会更深刻。请以"时间的沉淀"为主题，结合人生感悟写作。',
        note: '关键词：时间沉淀、价值认知、人性考验',
        approach: '<p><strong>故事叙事式：</strong>以一个感人的故事为主线，层层铺展人性的光辉。</p><p><strong>群像并列式：</strong>多个平凡英雄的故事并列，形成"光辉群像"。</p>'
      },
      {
        shortTitle: '模拟题',
        title: '模拟命题：平凡人的英雄时刻',
        text: '英雄不一定光芒万丈，平凡人也可以在关键时刻闪耀人性光辉。请以"平凡人的英雄时刻"为题，讲述你对英雄的理解。',
        note: '关键词：平凡英雄、人性光辉、关键时刻',
        approach: '<p><strong>哲思升华式：</strong>从具体事例上升到人性本质的思辨，探讨"何为真正的英雄"。</p>'
      }
    ],
    examples: [
      {
        shortTitle: '群像式示例',
        title: '平凡人的英雄群像',
        text: `<p>英雄不一定要光芒万丈。外卖小哥彭清林在钱塘江大桥上纵身一跃，用行动诠释了"平凡人的英雄时刻"。张桂梅扎根云南大山，创办免费女子高中，用教育点亮了无数女孩的命运。抗洪前线，普通市民挺身而出，筑起守护家园的人墙。</p>
<p>他们的名字或许不会被写进教科书，但他们的故事汇聚成时代的光辉群像。感动中国的人物中，有太多这样的面孔——平凡的身份，不平凡的选择。</p>
<p>雨果说："善良是历史中稀有的珍珠。"正是这些珍珠，串起了人性的项链，照亮了时代的前路。</p>`,
        highlight: '真正的英雄主义，是认清生活的真相后，依然选择善良与勇敢。',
        analysis: '群像并列式：多个平凡英雄故事并列呈现，形成"光辉群像"的视觉效果。结尾引用名言升华，增强感染力。'
      },
      {
        shortTitle: '哲思式示例',
        title: '何为真正的英雄',
        text: `<p>罗曼·罗兰说："世界上只有一种真正的英雄主义，就是认清生活真相后依然热爱生活。"这句话揭示了一个深刻的命题：英雄的本质，不在于能力的大小，而在于选择的勇气。</p>
<p>外卖小哥彭清林救人后说："我只是一个普通人，做了该做的事。"张桂梅校长从不以英雄自居，她说："这些孩子需要我。"真正的英雄，往往不自知。</p>
<p>这正是人性光辉最动人之处——它不是刻意为之的壮举，而是内心善良的自然流露。当善意不再需要理由，当勇气不再需要标榜，平凡人便成为真正的英雄。</p>`,
        highlight: '善意不需要理由，勇气不需要标榜——这便是人性最本真的光辉。',
        analysis: '哲思升华式：从名言引入，到具体事例论证，再到哲理升华，层层深入探讨"英雄"的本质。'
      }
    ],
    tips: [
      { icon: '💭', title: '情感共鸣', content: '用细腻的描写触动读者情感，让"光辉"不是抽象概念，而是真实感受。' },
      { icon: '👥', title: '群像塑造', content: '多个平凡人物并列呈现，形成"群像效应"，比单一案例更有说服力。' },
      { icon: '⚖️', title: '对比衬托', content: '用"平凡"衬托"伟大"，让英雄更显光辉，让读者更易共鸣。' },
      { icon: '🌟', title: '价值升华', content: '从具体故事上升到人性思考，探讨"何为英雄"的本质命题。' }
    ],
    materialIds: ['m009', 'm005']
  }
};

console.log('开始迁移教程数据...\n');

// 准备 SQL
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

// 使用事务批量插入
const migrate = db.transaction(() => {
  for (const [catId, data] of Object.entries(mockTutorials)) {
    const tutorialId = generateId('t');

    // 插入教程主表
    insertTutorial.run(
      tutorialId,
      data.categoryId,
      data.title,
      data.propositionAnalysis,
      data.philosophyGuide
    );

    console.log(`✓ 教程：${data.title} (${tutorialId})`);

    // 出题方向
    data.directions.forEach((d, i) => {
      insertDirection.run(tutorialId, d.title, d.description, i);
    });
    console.log(`  - 出题方向：${data.directions.length} 条`);

    // 出题示例
    data.questions.forEach((q, i) => {
      insertQuestion.run(tutorialId, q.shortTitle, q.title, q.text, q.note, q.approach, i);
    });
    console.log(`  - 出题示例：${data.questions.length} 条`);

    // 写作示例
    data.examples.forEach((e, i) => {
      insertExample.run(tutorialId, e.shortTitle, e.title, e.text, e.highlight, e.analysis, i);
    });
    console.log(`  - 写作示例：${data.examples.length} 条`);

    // 写作锦囊
    data.tips.forEach((t, i) => {
      insertTip.run(tutorialId, t.icon, t.title, t.content, i);
    });
    console.log(`  - 写作锦囊：${data.tips.length} 条`);

    // 推荐素材
    (data.materialIds || []).forEach((mid, i) => {
      // 先检查素材是否存在
      const exists = db.prepare('SELECT id FROM materials WHERE id = ?').get(mid);
      if (exists) {
        insertMaterial.run(tutorialId, mid, i);
      }
    });
    console.log(`  - 推荐素材：${data.materialIds?.length || 0} 条`);
  }
});

migrate();

// 验证
const count = db.prepare('SELECT COUNT(*) as count FROM tutorials').get();
const directions = db.prepare('SELECT COUNT(*) as count FROM tutorial_directions').get();
const questions = db.prepare('SELECT COUNT(*) as count FROM tutorial_questions').get();
const examples = db.prepare('SELECT COUNT(*) as count FROM tutorial_examples').get();
const tips = db.prepare('SELECT COUNT(*) as count FROM tutorial_tips').get();

console.log('\n迁移完成！统计：');
console.log(`  教程：${count.count}`);
console.log(`  出题方向：${directions.count}`);
console.log(`  出题示例：${questions.count}`);
console.log(`  写作示例：${examples.count}`);
console.log(`  写作锦囊：${tips.count}`);