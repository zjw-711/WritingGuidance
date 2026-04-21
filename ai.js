const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.join(__dirname, 'data', 'ai-config.json');

function readAiConfig() {
  try {
    if (!fs.existsSync(CONFIG_PATH)) {
      return {
        provider: 'mock',
        apiKey: '',
        baseUrl: '',
        model: '',
        enabled: false
      };
    }
    const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
    const parsed = JSON.parse(raw);
    return {
      provider: parsed.provider || 'mock',
      apiKey: parsed.apiKey || '',
      baseUrl: parsed.baseUrl || '',
      model: parsed.model || '',
      enabled: Boolean(parsed.enabled && parsed.apiKey && parsed.baseUrl && parsed.model)
    };
  } catch (err) {
    console.error('[AI] 读取配置失败：', err.message);
    return {
      provider: 'mock',
      apiKey: '',
      baseUrl: '',
      model: '',
      enabled: false
    };
  }
}

function saveAiConfig(config) {
  const next = {
    provider: config.provider || 'openai-compatible',
    apiKey: config.apiKey || '',
    baseUrl: config.baseUrl || '',
    model: config.model || '',
    enabled: Boolean(config.apiKey && config.baseUrl && config.model)
  };
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(next, null, 2), 'utf-8');
  return readAiConfig();
}

// 请求超时时间（毫秒）
const REQUEST_TIMEOUT = 120000;

async function chatCompletion(messages) {
  const config = readAiConfig();
  if (!config.enabled) {
    return null;
  }

  // 推理模型不支持 response_format 和 temperature，且需要更多 token
  const isReasoningModel = /glm-5|glm-4-long|o[13](-mini|-preview)?|deepseek-r1/i.test(config.model);

  const body = {
    model: config.model,
    messages
  };
  if (!isReasoningModel) {
    body.temperature = 0.2;
    body.response_format = { type: 'json_object' };
  }
  body.max_tokens = isReasoningModel ? 8192 : 4096;

  const res = await fetch(config.baseUrl.replace(/\/$/, '') + '/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + config.apiKey
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT)
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error('AI 请求失败：' + text);
  }

  const data = await res.json();
  let content = data.choices && data.choices[0] && data.choices[0].message
    ? data.choices[0].message.content
    : '';

  if (!content) throw new Error('AI 返回为空');

  // 清理推理模型可能附带的 <think>...</think> 标签
  content = content.replace(/<think>[\s\S]*?<\/think>/g, '').trim();

  // 尝试从 markdown 代码块中提取 JSON
  const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) content = jsonMatch[1].trim();

  try {
    return JSON.parse(content);
  } catch (e) {
    // 尝试提取第一个 JSON 对象/数组
    const objMatch = content.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
    if (objMatch) {
      return JSON.parse(objMatch[1]);
    }
    throw new Error('AI 返回内容无法解析为 JSON：' + content.slice(0, 200));
  }
}

function truncateText(text, max = 4000) {
  if (!text) return '';
  return text.length > max ? text.slice(0, max) : text;
}

function fallbackScreening(input) {
  const text = [input.title || '', input.content || ''].join('\n');
  const novelty = /(20[12]\d|人工智能|航天|非遗|博物馆|青年|数字|乡村|心理|科技|纪录片)/.test(text) ? 82 : 60;
  const detail = text.length > 120 ? 78 : 55;
  const usability = /(责任|青年|创新|文化|科技|坚持|成长|家国|教育)/.test(text) ? 84 : 66;
  const total = Math.round((novelty + detail + usability) / 3);
  return {
    recommended: total >= 70,
    totalScore: total,
    noveltyScore: novelty,
    detailScore: detail,
    usabilityScore: usability,
    overusedRisk: /袁隆平|苏轼|司马迁|屠呦呦|海伦凯勒|爱迪生|岳飞|文天祥|雷锋/.test(text) ? 'high' : 'low',
    themes: inferThemes(text),
    reason: total >= 70 ? '内容具备一定新颖度和作文迁移价值，可进入候审。' : '内容较泛或细节不足，建议补充来源与具体情境。'
  };
}

function inferThemes(text) {
  const map = [
    ['科技与人文', /(人工智能|科技|算法|数字|航天|技术)/],
    ['文化传承', /(文化|非遗|文物|敦煌|博物馆|传统)/],
    ['青年成长', /(青年|成长|选择|梦想|学生|挫折)/],
    ['责任担当', /(责任|担当|坚守|奉献|使命)/],
    ['家国情怀', /(家国|国家|中国|民族|复兴)/],
    ['教育公平', /(教育|学校|老师|课堂|阅读)/],
    ['人与自然', /(生态|环保|自然|绿色|低碳)/]
  ];
  const themes = map.filter(([, regex]) => regex.test(text)).map(([name]) => name);
  return themes.length ? themes.slice(0, 5) : ['现实议题'];
}


async function screenCandidate(input) {
  const prompt = {
    role: 'system',
    content: '你是中国高三作文素材编辑。请判断输入材料是否适合收录为作文素材。必须避免陈旧、老套、被滥用、空泛鸡汤。只返回 JSON，字段：recommended,totalScore,noveltyScore,detailScore,usabilityScore,overusedRisk,themes,reason。'
  };
  const user = {
    role: 'user',
    content: JSON.stringify({
      title: input.title || '',
      source: input.source || '',
      content: truncateText(input.content || '', 3500)
    })
  };

  const result = await chatCompletion([prompt, user]);
  return result || fallbackScreening(input);
}


/**
 * 按话题/分类批量生成高考作文素材
 */
async function generateMaterialsByTopic(topic, category, subcategories, count = 3, existingTitles = []) {
  // 构建去重提示
  let dedupHint = '';
  if (existingTitles.length > 0) {
    const titleList = existingTitles.slice(0, 200).map(t => `「${t}」`).join('、');
    dedupHint = `\n\n6. 以下素材已经收录，请勿生成相同或高度相似的素材（标题或核心人物/事件重复均算）：\n${titleList}`;
  }

  const prompt = {
    role: 'system',
    content: `你是中国高三作文素材编辑。请根据用户给出的话题，生成 ${count} 条高考作文素材。

严格要求：
1. 禁止使用以下陈旧/被滥用的例子：袁隆平、苏轼、司马迁、屠呦呦、海伦凯勒、爱迪生、贝多芬、张海迪、霍金、居里夫人、岳飞、文天祥、林则徐、雷锋
2. 素材优先选用近年的真实事件和人物。如果不确定年份细节，宁可不写年份，也不要编造。可以写经典但被大众忽视的角度或人物
3. 内容要饱满扎实，必须有具体的人名、事件经过、关键细节。不要空洞说教和鸡汤
4. 每条素材 200-400 字，要包含足够的信息量让学生能直接引用
5. 标签和适用话题要贴合高考作文常考主题（如：责任担当、创新思维、文化传承、青年成长等）${dedupHint}

只返回 JSON，格式为：
{
  "materials": [
    {
      "title": "素材标题",
      "content": "素材正文（200-400字，有具体细节）",
      "type": "story 或 hot 或 quote",
      "source": "出处（如知道请写明，不确定可写空字符串）",
      "tags": ["标签1", "标签2", "标签3"],
      "applicableTopics": ["适用话题1", "适用话题2"]
    }
  ]
}`
  };

  const user = {
    role: 'user',
    content: JSON.stringify({
      topic,
      category,
      availableSubcategories: subcategories,
      count
    })
  };

  const result = await chatCompletion([prompt, user]);
  if (!result || !result.materials || !Array.isArray(result.materials)) {
    return [];
  }

  // 对每条素材进行筛选
  const qualified = [];
  for (const mat of result.materials.slice(0, count)) {
    try {
      const screening = await screenCandidate(mat);
      mat._screening = screening;
      if (screening.recommended) {
        qualified.push(mat);
      } else {
        console.log(`[AI] 素材「${mat.title}」未通过筛选（${screening.totalScore}分）：${screening.reason}`);
      }
    } catch (err) {
      console.warn(`[AI] 素材「${mat.title}」筛选异常，使用回退筛选：`, err.message);
      mat._screening = fallbackScreening(mat);
      if (mat._screening.recommended) {
        qualified.push(mat);
      }
    }
  }

  return qualified;
}

/**
 * 从经典名著中按高考主题维度挖掘素材
 * @param {Object} classic - 名著信息 { id, title, author, era, description, themes }
 * @param {string} theme - 可选，指定某个主题角度（不指定则覆盖该书所有关联主题）
 * @param {number} count - 生成素材数量
 * @param {string[]} existingTitles - 已有素材标题（去重用）
 */
async function generateClassicsMaterials(classic, theme, count = 3, existingTitles = []) {
  // 构建去重提示
  let dedupHint = '';
  if (existingTitles.length > 0) {
    const titleList = existingTitles.slice(0, 200).map(t => `「${t}」`).join('、');
    dedupHint = `\n\n6. 以下素材已经收录，请勿生成相同或高度相似的素材：\n${titleList}`;
  }

  const themeHint = theme
    ? `请围绕"${theme}"这一主题角度进行挖掘。`
    : `请从以下主题角度中选择最有写作价值的方向来挖掘：${(classic.themes || []).join('、')}。`;

  const prompt = {
    role: 'system',
    content: `你是中国高三作文素材编辑，专精经典名著。请从用户指定的名著中挖掘高考作文素材。

严格要求：
1. 素材必须出自指定名著的真实内容，人物、情节、原句都要准确，禁止编造
2. 每条素材围绕一个高考常考主题角度展开，说明如何用名著中的具体内容来论证该主题
3. 内容要包含：具体人物/情节/原文引用 + 该角度如何用于作文论证的分析
4. 每条素材 200-400 字，信息量饱满，让学生能直接引用到作文中
5. 避免老生常谈的角度，寻找新颖、有深度的切入方式${dedupHint}

${themeHint}

只返回 JSON，格式为：
{
  "materials": [
    {
      "title": "素材标题（格式建议：名著名·主题角度）",
      "content": "素材正文（200-400字，包含名著具体内容+论证角度分析）",
      "type": "story 或 quote",
      "source": "出处（格式：名著名·作者，如"红楼梦·曹雪芹"）",
      "tags": ["标签1", "标签2", "标签3"],
      "applicableTopics": ["适用高考话题1", "适用高考话题2"]
    }
  ]
}`
  };

  const user = {
    role: 'user',
    content: JSON.stringify({
      classic: {
        title: classic.title,
        author: classic.author,
        era: classic.era,
        description: classic.description
      },
      theme: theme || '',
      count
    })
  };

  const result = await chatCompletion([prompt, user]);
  if (!result || !result.materials || !Array.isArray(result.materials)) {
    return [];
  }

  // 对每条素材进行筛选
  const qualified = [];
  for (const mat of result.materials.slice(0, count)) {
    try {
      const screening = await screenCandidate(mat);
      mat._screening = screening;
      if (screening.recommended) {
        qualified.push(mat);
      } else {
        console.log(`[AI] 名著素材「${mat.title}」未通过筛选（${screening.totalScore}分）：${screening.reason}`);
      }
    } catch (err) {
      console.warn(`[AI] 名著素材「${mat.title}」筛选异常，使用回退筛选：`, err.message);
      mat._screening = fallbackScreening(mat);
      if (mat._screening.recommended) {
        qualified.push(mat);
      }
    }
  }

  return qualified;
}

module.exports = {
  readAiConfig,
  saveAiConfig,
  chatCompletion,
  screenCandidate,
  generateMaterialsByTopic,
  generateClassicsMaterials
};
