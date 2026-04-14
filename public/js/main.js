// ========== 全局状态 ==========
let categories = [];
let allTags = [];
let currentMaterial = null;
let currentPage = 1;
let pageSize = 12;
let filters = { category: '', subcategory: '', type: '', tag: '', search: '' };
let searchTimeout = null;
let isLoading = false;

// ========== 初始化 ==========
async function init() {
  try {
    const [catRes, tagRes] = await Promise.all([
      fetch('/api/categories').then(r => r.json()),
      fetch('/api/tags').then(r => r.json())
    ]);
    categories = catRes;
    allTags = tagRes;

    renderCategoryFilter();
    renderTagFilter();
    renderTypeFilter();
    bindEvents();

    // 支持 URL 参数搜索（从考试页推荐素材跳转过来）
    const urlParams = new URLSearchParams(window.location.search);
    const urlSearch = urlParams.get('search');
    if (urlSearch) {
      filters.search = urlSearch;
      document.getElementById('searchInput').value = urlSearch;
    }

    loadMaterials();
  } catch (err) {
    showToast('卷帙浩繁，稍后再试');
  }
}

function bindEvents() {
  // 防抖搜索
  document.getElementById('searchInput').addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      filters.search = e.target.value.trim();
      currentPage = 1;
      loadMaterials();
    }, 400);
  });

  // Esc 关闭阅读器
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeReader();
  });
}

// ========== 渲染分类 + 子分类 ==========
function renderCategoryFilter() {
  const container = document.getElementById('categoryFilter');
  let html = `<button class="filter-item active" onclick="selectCategory('','','',this)">全部卷宗</button>`;

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
}

function selectCategory(catId, subId, level, el) {
  // 记录当前展开状态（在清除之前）
  const currentGroup = el.closest('.cat-group');
  const wasExpanded = currentGroup ? currentGroup.classList.contains('expanded') : false;

  // 清除所有高亮和展开
  document.querySelectorAll('.filter-item').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.sub-filter-item').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.cat-group').forEach(g => g.classList.remove('expanded'));

  // 清除标签
  filters.tag = '';
  document.querySelectorAll('.tag-btn').forEach(p => p.classList.remove('active'));
  const allTagBtn = document.querySelector('.tag-btn');
  if (allTagBtn) allTagBtn.classList.add('active');

  if (!catId) {
    // 全部卷宗
    el.classList.add('active');
    filters.category = '';
    filters.subcategory = '';
  } else if (level === 'sub') {
    // 子分类
    const group = el.closest('.cat-group');
    group.classList.add('expanded');
    group.querySelector('.filter-item').classList.add('active');
    el.classList.add('active');
    filters.category = catId;
    filters.subcategory = subId;
  } else {
    // 一级分类：重复点击切换展开/收起
    el.classList.add('active');
    const hasSubs = currentGroup.querySelector('.sub-filter-list');
    if (hasSubs) currentGroup.classList.toggle('expanded', !wasExpanded);
    filters.category = catId;
    filters.subcategory = '';
  }

  currentPage = 1;
  loadMaterials();
  if (window.innerWidth <= 768) closeSidebar();
}

// ========== 渲染标签 ==========
function renderTagFilter() {
  const container = document.getElementById('tagFilter');
  let html = `<button class="tag-btn active" onclick="selectTag('',this)">全部</button>`;
  allTags.slice(0, 12).forEach(t => {
    html += `<button class="tag-btn" onclick="selectTag('${t}',this)">${t}</button>`;
  });
  container.innerHTML = html;
}

function selectTag(tag, el) {
  // 选标签时清除分类
  filters.tag = tag;
  filters.category = '';
  filters.subcategory = '';

  document.querySelectorAll('.filter-item').forEach(p => p.classList.remove('active'));
  const allFilterBtn = document.querySelector('.filter-item');
  if (allFilterBtn) allFilterBtn.classList.add('active');
  document.querySelectorAll('.cat-group').forEach(g => g.classList.remove('expanded'));
  document.querySelectorAll('.sub-filter-item').forEach(p => p.classList.remove('active'));

  document.querySelectorAll('.tag-btn').forEach(p => p.classList.remove('active'));
  el.classList.add('active');

  currentPage = 1;
  loadMaterials();
  if (window.innerWidth <= 768) closeSidebar();
}

// ========== 渲染类型筛选条 ==========
function renderTypeFilter() {
  const container = document.getElementById('typeFilter');
  const typeNames = { 'story': '人物事例', 'hot': '时事热点', 'quote': '名言金句' };
  let html = `<button class="type-btn active" onclick="selectType('',this)">全部</button>`;
  Object.entries(typeNames).forEach(([id, name]) => {
    html += `<button class="type-btn" onclick="selectType('${id}',this)">${name}</button>`;
  });
  container.innerHTML = html;
}

function selectType(type, el) {
  filters.type = type;
  document.querySelectorAll('.type-btn').forEach(p => p.classList.remove('active'));
  el.classList.add('active');
  currentPage = 1;
  loadMaterials();
}
function toggleSidebar() {
  document.getElementById('artSidebar').classList.toggle('open');
  document.getElementById('sidebarOverlay').classList.toggle('active');
}

function closeSidebar() {
  document.getElementById('artSidebar').classList.remove('open');
  document.getElementById('sidebarOverlay').classList.remove('active');
}

// ========== 加载数据 ==========
async function loadMaterials() {
  if (isLoading) return;
  isLoading = true;

  const grid = document.getElementById('materialsGrid');
  // 首页显示骨架加载
  if (currentPage === 1) {
    grid.innerHTML = '<div class="loading-skeleton"><div class="sk-card"></div><div class="sk-card"></div><div class="sk-card"></div><div class="sk-card"></div><div class="sk-card"></div><div class="sk-card"></div></div>';
  }

  try {
    const params = new URLSearchParams({
      category: filters.category,
      subcategory: filters.subcategory,
      type: filters.type,
      tag: filters.tag,
      search: filters.search,
      page: currentPage,
      pageSize: pageSize
    });

    const res = await fetch('/api/materials?' + params);
    if (!res.ok) throw new Error('请求失败');
    const data = await res.json();
    document.getElementById('totalCount').textContent = data.total;
    renderGrid(data.data);

    document.getElementById('loadMoreWrapper').style.display =
      currentPage * pageSize < data.total ? 'block' : 'none';
    document.getElementById('emptyState').style.display =
      data.data.length === 0 ? 'block' : 'none';
  } catch (err) {
    showToast('获取卷宗失败');
    if (currentPage === 1) grid.innerHTML = '';
  } finally {
    isLoading = false;
  }
}

// ========== 渲染杂志卡片 ==========
function renderGrid(materials) {
  const grid = document.getElementById('materialsGrid');
  if (currentPage === 1) grid.innerHTML = '';

  const fragment = document.createDocumentFragment();

  materials.forEach(m => {
    const cat = categories.find(c => c.id === m.category);
    const catName = cat ? cat.name.replace(/[^\u4e00-\u9fa5]/g, '') : '佚名卷';
    const sourceStr = m.source ? ` · ${escapeHtml(m.source)}` : '';

    const card = document.createElement('div');
    card.className = 'mag-card';
    card.onclick = () => openReader(m.id);
    card.innerHTML = `
      <div class="mag-card-inner">
        <div class="mag-meta">${catName}${sourceStr}</div>
        <div class="mag-title">${escapeHtml(m.title)}</div>
        <div class="mag-excerpt">${escapeHtml(m.content)}</div>
      </div>
    `;
    fragment.appendChild(card);
  });

  grid.appendChild(fragment);
}

function loadMore() { if (isLoading) return; currentPage++; loadMaterials(); }

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
