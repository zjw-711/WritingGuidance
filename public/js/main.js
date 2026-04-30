// ========== 全局状态 ==========
let categories = [];

// ========== 初始化 ==========
async function init() {
  try {
    const catRes = await fetch('/api/categories').then(r => r.json());
    categories = catRes;

    renderCategoryFilter();
    bindEvents();
  } catch (err) {
    showToast('卷帙浩繁，稍后再试');
  }
}

function bindEvents() {
  // Esc 关闭阅读器
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeReader();
  });
}

// ========== 渲染分类 + 子分类 ==========
function renderCategoryFilter() {
  const container = document.getElementById('categoryFilter');
  let html = '';

  categories.forEach(c => {
    const subs = c.subcategories || [];
    const catName = c.name.replace(/[^\u4e00-\u9fa5]/g, '');
    const hasSubs = subs.length > 0;
    html += `
      <div class="cat-group" data-cat="${c.id}">
        <button class="filter-item${hasSubs ? ' has-subs' : ''}" onclick="selectCategory('${c.id}','','',this)">
          <span class="cat-name">${catName}</span>
          ${hasSubs ? '<span class="cat-arrow">›</span>' : ''}
        </button>
        ${hasSubs ? `
          <div class="sub-filter-list">
            ${subs.map(s => `
              <button class="sub-filter-item" onclick="selectCategory('${c.id}','${s.id}','sub',this)">${s.name}</button>
            `).join('')}
          </div>
        ` : ''}
      </div>
    `;
  });

  container.innerHTML = html;

  // 显示教程全局概览，不再自动加载第一个教程
  showTutorialDirectory();
}

function selectCategory(catId, subId, level, el) {
  // 记录当前展开状态
  const currentGroup = el.closest('.cat-group');
  const wasExpanded = currentGroup ? currentGroup.classList.contains('expanded') : false;

  // 清除所有高亮和展开
  document.querySelectorAll('.filter-item').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.sub-filter-item').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.cat-group').forEach(g => g.classList.remove('expanded'));

  if (level === 'sub') {
    // 二级分类 → 加载子分类教程（有则显示，无则 fallback 到父分类教程）
    const group = el.closest('.cat-group');
    group.classList.add('expanded');
    group.querySelector('.filter-item').classList.add('active');
    el.classList.add('active');
    loadTutorialData(catId, subId);
  } else {
    // 一级分类 → 显示教程
    el.classList.add('active');
    const hasSubs = currentGroup.querySelector('.sub-filter-list');
    if (hasSubs) currentGroup.classList.toggle('expanded', !wasExpanded);
    loadTutorialData(catId);
  }

  if (window.innerWidth <= 768) closeSidebar();
}

function toggleSidebar() {
  document.getElementById('artSidebar').classList.toggle('open');
  document.getElementById('sidebarOverlay').classList.toggle('active');
}

function closeSidebar() {
  document.getElementById('artSidebar').classList.remove('open');
  document.getElementById('sidebarOverlay').classList.remove('active');
}

// ========== 阅读器 ==========
async function openReader(id) {
  // 先打开弹窗，显示加载状态
  document.getElementById('readerContent').innerHTML = '<div class="reader-loading">翻阅中...</div>';
  document.getElementById('readerOverlay').classList.add('active');
  document.getElementById('readerModal').classList.add('open');
  document.body.style.overflow = 'hidden';

  try {
    const res = await fetch('/api/materials/' + id);
    if (!res.ok) throw new Error('获取失败');
    const m = await res.json();
    currentMaterial = m;

    const cat = categories.find(c => c.id === m.category);
    const catName = cat ? cat.name.replace(/[^\u4e00-\u9fa5]/g, '') : '';

    // 子分类名
    let subName = '';
    if (cat && cat.subcategories) {
      const sub = cat.subcategories.find(s => s.id === m.subcategory);
      if (sub) subName = sub.name;
    }

    let metaHtml = '';
    if (catName) metaHtml += `收录于《${catName}》`;
    if (subName) metaHtml += `<span class="sub-badge">${escapeHtml(subName)}</span>`;
    if (m.source) metaHtml += ` &nbsp;|&nbsp; 源自：${escapeHtml(m.source)}`;

    document.getElementById('readerContent').innerHTML = `
      <h2>${escapeHtml(m.title)}</h2>
      <div class="meta">${metaHtml}</div>
      <div class="text-body">${escapeHtml(m.content)}</div>
      ${m.tags && m.tags.length ? `
        <div class="detail-section">
          <div class="detail-label">标签</div>
          <div class="tag-list">${m.tags.map(t => `<span class="tag-item">${escapeHtml(t)}</span>`).join('')}</div>
        </div>
      ` : ''}
      ${m.applicableTopics && m.applicableTopics.length ? `
        <div class="detail-section">
          <div class="detail-label">适用话题</div>
          <div class="tag-list">${m.applicableTopics.map(t => `<span class="topic-item">${escapeHtml(t)}</span>`).join('')}</div>
        </div>
      ` : ''}
      ${m.links && m.links.length ? `
        <div class="detail-section">
          <div class="detail-label">延伸阅读</div>
          <div class="link-list">
            ${m.links.map(link => `
              <a class="link-item" href="${escapeHtml(link.url)}" target="_blank" rel="noopener noreferrer">
                <span class="link-icon">${getLinkIcon(link.type)}</span>
                <span class="link-title">${escapeHtml(link.title)}</span>
                <span class="link-arrow">↗</span>
              </a>
            `).join('')}
          </div>
        </div>
      ` : ''}
    `;
  } catch (err) {
    document.getElementById('readerContent').innerHTML = '<div class="reader-loading">翻阅失败，请关闭重试</div>';
  }
}

function closeReader() {
  document.getElementById('readerOverlay').classList.remove('active');
  document.getElementById('readerModal').classList.remove('open');
  document.body.style.overflow = '';
}

// ========== 复制 ==========
function copyMaterial() {
  if (!currentMaterial) return;
  const m = currentMaterial;
  const text = `《${m.title}》\n\n${m.content}\n\n—— ${m.source || '佚名'}`;

  if (navigator.clipboard) {
    navigator.clipboard.writeText(text).then(() => showToast('已临摹至剪贴板'));
  } else {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    showToast('已临摹至剪贴板');
  }
}

// ========== Toast ==========
function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3000);
}

// ========== 工具函数 ==========
function getLinkIcon(type) {
  const icons = { 'video': '🎬', 'article': '📄', 'wiki': '📚', 'news': '📰', 'social': '💬' };
  return icons[type] || '🔗';
}

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ========== 启动 ==========
init();

// ========== 教程数据管理 ==========
let currentTutorialData = null;
let currentQuestionIndex = 0;
let currentExampleIndex = 0;
let currentMiniType = '';

// 从 API 加载教程数据
async function loadTutorialData(categoryId, subcategoryId = null) {
  // 隐藏教程总览，显示教程面板
  const directory = document.getElementById('tutorialDirectory');
  const panel = document.getElementById('tutorialPanel');
  if (directory) directory.style.display = 'none';
  if (panel) panel.style.display = '';

  try {
    let res;
    if (subcategoryId) {
      // 子分类 → 调用 by-subcategory 端点（带 fallback）
      res = await fetch(`/api/tutorials/by-subcategory/${categoryId}/${subcategoryId}`);
    } else {
      // 父分类 → 调用 by-category 端点
      res = await fetch(`/api/tutorials/by-category/${categoryId}`);
    }
    if (!res.ok) {
      currentTutorialData = null;
      showEmptyTutorial('该分类暂无教程内容，敬请期待');
      return;
    }
    currentTutorialData = await res.json();
    renderTutorial(currentTutorialData);
  } catch (err) {
    console.error('加载教程失败:', err);
    showToast('加载教程失败');
    showEmptyTutorial('加载教程失败');
  }
}

// 显示空教程提示
function showEmptyTutorial(message = '该分类暂无教程内容，敬请期待。') {
  // 隐藏教程总览，显示教程面板
  const directory = document.getElementById('tutorialDirectory');
  const panel = document.getElementById('tutorialPanel');
  if (directory) directory.style.display = 'none';
  if (panel) panel.style.display = '';

  document.getElementById('tutorialTitle').textContent = '📖 写作教程';
  document.getElementById('tutorialProposition').innerHTML = `
    <p style="text-align:center;padding:40px 0;color:var(--ink-light);">${escapeHtml(message)}</p>
    <div style="text-align:center;">
      <button class="btn-back-directory" onclick="backToDirectory()">返回教程总览</button>
    </div>
  `;
  document.getElementById('tutorialDirections').innerHTML = '';
  document.getElementById('questionTabs').innerHTML = '';
  document.getElementById('questionContent').innerHTML = '';
  document.getElementById('tutorialApproach').innerHTML = '';
  document.getElementById('tutorialPhilosophy').innerHTML = '';
  document.getElementById('tutorialMaterials').innerHTML = '';
  document.getElementById('exampleTabs').innerHTML = '';
  document.getElementById('exampleContent').innerHTML = '';
  document.getElementById('tipsGrid').innerHTML = '';
  document.getElementById('essayTabs').innerHTML = '';
  document.getElementById('essayContent').innerHTML = '';
}

// 渲染教程内容
function renderTutorial(tutorial) {
  const fallbackTag = tutorial.isFallback ? '（通用教程）' : '';
  document.getElementById('tutorialTitle').textContent = `📖 写作教程 · ${tutorial.title}${fallbackTag}`;
  document.getElementById('tutorialProposition').textContent = tutorial.propositionAnalysis || '';

  const directions = tutorial.directions || [];
  document.getElementById('tutorialDirections').innerHTML = directions.map(d => `
    <div class="direction-item">• <strong>${escapeHtml(d.title)}：</strong>${escapeHtml(d.description || '')}</div>
  `).join('');

  const questions = tutorial.questions || [];
  document.getElementById('questionTabs').innerHTML = questions.map((q, i) => `
    <button class="question-tab${i === 0 ? ' active' : ''}" onclick="selectQuestion(${i})">${escapeHtml(q.short_title || '')}</button>
  `).join('');

  currentQuestionIndex = 0;
  if (questions.length > 0) renderQuestion(questions[0]);

  document.getElementById('tutorialPhilosophy').innerHTML = tutorial.philosophyGuide || '';

  currentMiniType = '';
  renderMiniMaterials(tutorial.materials || []);

  const examples = tutorial.examples || [];
  document.getElementById('exampleTabs').innerHTML = examples.map((e, i) => `
    <button class="example-tab${i === 0 ? ' active' : ''}" onclick="selectExample(${i})">${escapeHtml(e.short_title || '')}</button>
  `).join('');
  currentExampleIndex = 0;
  if (examples.length > 0) renderExample(examples[0]);

  renderTips(tutorial.tips || []);

  const essays = tutorial.essays || [];
  document.getElementById('essayTabs').innerHTML = essays.map((e, i) => `
    <button class="essay-tab${i === 0 ? ' active' : ''}" onclick="selectEssay(${i})">${escapeHtml(e.title || '范文' + (i + 1))}</button>
  `).join('');
  if (essays.length > 0) renderEssay(essays[0]);
  else document.getElementById('essayContent').innerHTML = '';
}

function renderQuestion(question) {
  document.getElementById('questionContent').innerHTML = `
    <div class="question-title">${escapeHtml(question.title)}</div>
    <div class="question-text">${escapeHtml(question.question_text || '')}</div>
    <div class="question-note">${escapeHtml(question.note || '')}</div>
  `;
  const approachEl = document.getElementById('tutorialApproach');
  if (question.writing_approach) {
    approachEl.innerHTML = `<div class="approach-label">写作思路</div><div class="approach-content">${question.writing_approach}</div>`;
    approachEl.style.display = '';
  } else {
    approachEl.innerHTML = '';
    approachEl.style.display = 'none';
  }
}

function selectQuestion(index) {
  currentQuestionIndex = index;
  const questions = currentTutorialData?.questions || [];
  if (questions[index]) {
    document.querySelectorAll('.question-tab').forEach((tab, i) => tab.classList.toggle('active', i === index));
    renderQuestion(questions[index]);
  }
}

function renderExample(example) {
  document.getElementById('exampleContent').innerHTML = `
    <div class="example-title">${escapeHtml(example.title)}</div>
    <div class="example-text">${example.example_text || ''}</div>
    <div class="example-highlight">${escapeHtml(example.highlight || '')}</div>
    <div class="example-analysis"><strong>结构解析：</strong>${escapeHtml(example.analysis || '')}</div>
  `;
}

function selectExample(index) {
  currentExampleIndex = index;
  const examples = currentTutorialData?.examples || [];
  if (examples[index]) {
    document.querySelectorAll('.example-tab').forEach((tab, i) => tab.classList.toggle('active', i === index));
    renderExample(examples[index]);
  }
}

function renderMiniMaterials(materials) {
  let filtered = currentMiniType ? materials.filter(m => m.type === currentMiniType) : materials;
  const display = filtered.slice(0, 6);
  document.getElementById('tutorialMaterials').innerHTML = display.map(m => `
    <div class="mini-card" onclick="openReader('${m.id}')">
      <div class="mini-card-title">${escapeHtml(m.title)}</div>
      <div class="mini-card-content">${m.content || ''}</div>
      ${m.tag ? `<div class="mini-card-tag">${escapeHtml(m.tag)}</div>` : ''}
    </div>
  `).join('');
}

function selectMiniType(type, el) {
  currentMiniType = type;
  document.querySelectorAll('.mini-type-btn').forEach(btn => btn.classList.remove('active'));
  el.classList.add('active');
  renderMiniMaterials(currentTutorialData?.materials || []);
}

function goToMaterial(id) {
  window.location.href = `/materials?highlight=${id}`;
}

function showMoreMaterials() {
  const catId = currentTutorialData?.categoryId || 'youth';
  const subId = currentTutorialData?.subcategoryId;
  let url = `/materials?category=${catId}`;
  if (subId) url += `&subcategory=${subId}`;
  window.location.href = url;
}

function renderTips(tips) {
  if (!tips || tips.length === 0) {
    document.getElementById('tipsGrid').innerHTML = '';
    return;
  }
  document.getElementById('tipsGrid').innerHTML = tips.map(tip => `
    <div class="tip-card">
      <div class="tip-icon">${tip.icon || '💡'}</div>
      <div class="tip-title">${escapeHtml(tip.title)}</div>
      <div class="tip-content">${escapeHtml(tip.content)}</div>
    </div>
  `).join('');
}

// ========== 范文 ==========
let currentEssayIndex = 0;

function renderEssay(essay) {
  if (!essay) {
    document.getElementById('essayContent').innerHTML = '';
    return;
  }
  document.getElementById('essayContent').innerHTML = `
    <div class="essay-title-row">
      <span class="essay-title">${escapeHtml(essay.title || '')}</span>
      ${essay.score ? `<span class="essay-score">${escapeHtml(essay.score)}</span>` : ''}
    </div>
    <div class="essay-text">${escapeHtml(essay.essay_text || '')}</div>
    ${essay.highlight ? `
      <div class="essay-highlight">
        <div class="essay-highlight-label">亮点摘录</div>
        ${escapeHtml(essay.highlight)}
      </div>
    ` : ''}
    ${essay.analysis ? `
      <div class="essay-analysis"><strong>名师点评：</strong>${escapeHtml(essay.analysis)}</div>
    ` : ''}
  `;
}

function selectEssay(index) {
  currentEssayIndex = index;
  const essays = currentTutorialData?.essays || [];
  if (essays[index]) {
    document.querySelectorAll('.essay-tab').forEach((tab, i) => tab.classList.toggle('active', i === index));
    renderEssay(essays[index]);
  }
}

// ========== 打印/导出PDF ==========
function printTutorial() {
  if (!currentTutorialData) {
    showToast('暂无教程内容可打印');
    return;
  }
  closeReader();

  const data = currentTutorialData;

  // 为 Tab 类板块生成包含全部条目的 HTML
  const questionsHTML = generatePrintQuestions(data.questions || []);
  const examplesHTML = generatePrintExamples(data.examples || []);
  const essaysHTML = generatePrintEssays(data.essays || []);

  // 注入临时展开容器
  const questionSection = document.getElementById('questionContent').parentElement;
  const exampleSection = document.getElementById('exampleContent').parentElement;
  const essaySection = document.getElementById('essayContent').parentElement;

  const printQuestionsEl = createPrintContainer('printQuestionsAll', questionsHTML);
  const printExamplesEl = createPrintContainer('printExamplesAll', examplesHTML);
  const printEssaysEl = createPrintContainer('printEssaysAll', essaysHTML);

  questionSection.appendChild(printQuestionsEl);
  exampleSection.appendChild(printExamplesEl);
  essaySection.appendChild(printEssaysEl);

  // 隐藏单条 Tab 内容
  document.getElementById('questionContent').classList.add('print-hide');
  document.getElementById('exampleContent').classList.add('print-hide');
  document.getElementById('essayContent').classList.add('print-hide');

  // 推荐素材展示全部（不限 6 条）
  const materialsContainer = document.getElementById('tutorialMaterials');
  const originalMaterialsHTML = materialsContainer.innerHTML;
  const allMaterials = data.materials || [];
  materialsContainer.innerHTML = allMaterials.map(m => `
    <div class="mini-card" onclick="openReader('${m.id}')">
      <div class="mini-card-title">${escapeHtml(m.title)}</div>
      <div class="mini-card-content">${m.content || ''}</div>
      ${m.tag ? `<div class="mini-card-tag">${escapeHtml(m.tag)}</div>` : ''}
    </div>
  `).join('');
  materialsContainer.dataset.originalHTML = originalMaterialsHTML;

  // 清理函数
  const cleanup = () => {
    printQuestionsEl.remove();
    printExamplesEl.remove();
    printEssaysEl.remove();
    document.getElementById('questionContent').classList.remove('print-hide');
    document.getElementById('exampleContent').classList.remove('print-hide');
    document.getElementById('essayContent').classList.remove('print-hide');
    if (materialsContainer.dataset.originalHTML) {
      materialsContainer.innerHTML = materialsContainer.dataset.originalHTML;
      delete materialsContainer.dataset.originalHTML;
    }
    window.removeEventListener('afterprint', cleanup);
  };

  window.addEventListener('afterprint', cleanup);
  window.print();
  // 兜底：部分浏览器不支持 afterprint
  setTimeout(cleanup, 1000);
}

function createPrintContainer(id, innerHTML) {
  const el = document.createElement('div');
  el.id = id;
  el.className = 'print-all-container';
  el.innerHTML = innerHTML;
  return el;
}

function generatePrintQuestions(questions) {
  if (!questions.length) return '';
  return questions.map((q, i) => `
    <div class="print-items-group">
      <div class="print-item-title">题目 ${i + 1}：${escapeHtml(q.title)}</div>
      <div class="print-item-body">
        <p>${escapeHtml(q.question_text || '')}</p>
        ${q.note ? `<p class="question-note">${escapeHtml(q.note)}</p>` : ''}
        ${q.writing_approach ? `<p><strong>写作思路：</strong>${q.writing_approach}</p>` : ''}
      </div>
    </div>
  `).join('');
}

function generatePrintExamples(examples) {
  if (!examples.length) return '';
  return examples.map((e, i) => `
    <div class="print-items-group">
      <div class="print-item-title">示例 ${i + 1}：${escapeHtml(e.title)}</div>
      <div class="print-item-body">
        ${e.example_text || ''}
        ${e.highlight ? `<div class="example-highlight">${escapeHtml(e.highlight)}</div>` : ''}
        ${e.analysis ? `<div class="example-analysis"><strong>结构解析：</strong>${escapeHtml(e.analysis)}</div>` : ''}
      </div>
    </div>
  `).join('');
}

function generatePrintEssays(essays) {
  if (!essays.length) return '';
  return essays.map((e, i) => `
    <div class="print-items-group">
      <div class="print-item-title">${e.title ? escapeHtml(e.title) : '范文' + (i + 1)}${e.score ? '（' + escapeHtml(e.score) + '）' : ''}</div>
      <div class="print-item-body">
        <div style="text-indent:2em;white-space:pre-wrap">${escapeHtml(e.essay_text || '')}</div>
        ${e.highlight ? `
          <div class="essay-highlight">
            <div class="essay-highlight-label">亮点摘录</div>
            ${escapeHtml(e.highlight)}
          </div>
        ` : ''}
        ${e.analysis ? `<div class="essay-analysis"><strong>名师点评：</strong>${escapeHtml(e.analysis)}</div>` : ''}
      </div>
    </div>
  `).join('');
}

// ========== 教程全局概览 ==========
async function showTutorialDirectory() {
  const directory = document.getElementById('tutorialDirectory');
  const panel = document.getElementById('tutorialPanel');

  // 显示目录，隐藏面板
  if (directory) directory.style.display = '';
  if (panel) panel.style.display = 'none';

  const grid = document.getElementById('directoryGrid');
  grid.innerHTML = '<div class="reader-loading">加载中...</div>';

  try {
    const res = await fetch('/api/tutorials');
    if (!res.ok) throw new Error('加载失败');
    const tutorials = await res.json();
    renderDirectory(tutorials);
  } catch (err) {
    grid.innerHTML = '<div class="reader-loading">加载失败，请稍后再试</div>';
  }
}

function renderDirectory(tutorials) {
  const grid = document.getElementById('directoryGrid');
  if (!tutorials || tutorials.length === 0) {
    grid.innerHTML = '<div class="reader-loading">暂无教程内容</div>';
    return;
  }

  grid.innerHTML = tutorials.map(t => {
    const catName = t.categoryName || '';
    const excerpt = t.propositionAnalysis || '暂无命题分析';
    const questionCount = t.questionsCount || 0;
    const directionCount = t.directionsCount || 0;

    return `
      <div class="directory-card" onclick="loadTutorialFromDirectory('${t.categoryId || ''}', '${t.subcategoryId || ''}')">
        <div class="directory-card-cat">${escapeHtml(catName)}</div>
        <div class="directory-card-title">${escapeHtml(t.title || '未命名教程')}</div>
        <div class="directory-card-excerpt">${escapeHtml(excerpt)}</div>
        <div class="directory-card-meta">
          <span>📝 ${questionCount} 道出题示例</span>
          <span>🧭 ${directionCount} 个出题方向</span>
        </div>
      </div>
    `;
  }).join('');
}

function loadTutorialFromDirectory(categoryId, subcategoryId) {
  if (subcategoryId && subcategoryId !== 'null' && subcategoryId !== 'undefined') {
    loadTutorialData(categoryId, subcategoryId);
  } else {
    loadTutorialData(categoryId);
  }
}

function backToDirectory() {
  showTutorialDirectory();
  // 重置侧边栏选中状态
  document.querySelectorAll('.filter-item').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.sub-filter-item').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.cat-group').forEach(g => g.classList.remove('expanded'));
}
