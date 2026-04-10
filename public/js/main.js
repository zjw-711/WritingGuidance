// ========== 全局状态 ==========
let categories = [];
let types = [];
let allTags = [];
let currentMaterial = null;
let currentPage = 1;
let pageSize = 12;
let filters = { category: '', subcategory: '', type: '', tag: '', search: '' };

// ========== 初始化 ==========
async function init() {
  const [catRes, typeRes, tagRes] = await Promise.all([
    fetch('/api/categories').then(r => r.json()),
    fetch('/api/types').then(r => r.json()),
    fetch('/api/tags').then(r => r.json())
  ]);
  categories = catRes;
  types = typeRes;
  allTags = tagRes;

  renderCategoryFilter();
  renderTypeFilter();
  renderTagFilter();
  loadMaterials();

  document.getElementById('searchInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') doSearch();
  });

  window.addEventListener('scroll', () => {
    const btn = document.getElementById('btnTop');
    btn.classList.toggle('visible', window.scrollY > 400);
  });
}

// ========== 渲染分类树（带二级展开）==========
function renderCategoryFilter() {
  const container = document.getElementById('categoryFilter');
  let html = '<button class="sidebar-item active" data-value="" data-cat="" onclick="selectCategory(\'\',\'\',this)"><span class="sidebar-item-icon">📋</span>全部素材</button>';

  categories.forEach(c => {
    const subs = c.subcategories || [];
    const hasSubs = subs.length > 0;
    html += `
      <div class="cat-group">
        <button class="sidebar-item cat-parent" data-value="${c.id}" onclick="toggleOrSelectCategory('${c.id}', this)">
          <span class="sidebar-item-icon">${c.icon}</span>
          <span class="cat-name">${c.name}</span>
          ${hasSubs ? '<span class="cat-arrow">›</span>' : ''}
        </button>
        ${hasSubs ? `
          <div class="cat-children" data-parent="${c.id}">
            ${subs.map(s => `
              <button class="sidebar-item cat-child" data-value="${s.id}" data-cat="${c.id}" onclick="selectSubcategory('${c.id}','${s.id}',this)">${s.name}</button>
            `).join('')}
          </div>
        ` : ''}
      </div>
    `;
  });

  container.innerHTML = html;
}

// 点击一级分类：展开/收起子分类，同时筛选
function toggleOrSelectCategory(catId, btn) {
  const group = btn.closest('.cat-group');
  const children = group.querySelector('.cat-children');

  // 展开/收起
  if (children) {
    const isOpen = children.classList.contains('open');
    // 先关闭其他所有展开的
    document.querySelectorAll('.cat-children.open').forEach(el => {
      if (el !== children) el.classList.remove('open');
    });
    document.querySelectorAll('.cat-parent.expanded').forEach(el => {
      if (el !== btn) el.classList.remove('expanded');
    });
    children.classList.toggle('open');
    btn.classList.toggle('expanded');
  }

  // 清除所有高亮
  clearAllActive();
  btn.classList.add('active');

  filters.category = catId;
  filters.subcategory = '';
  currentPage = 1;
  loadMaterials();
  loadQuestionAnalysis();

  if (window.innerWidth <= 768) closeSidebar();
}

// 点击二级子分类
function selectSubcategory(catId, subId, btn) {
  // 确保父级展开
  const group = btn.closest('.cat-group');
  const parent = group.querySelector('.cat-parent');
  const children = group.querySelector('.cat-children');
  if (children && !children.classList.contains('open')) {
    children.classList.add('open');
    parent.classList.add('expanded');
  }

  clearAllActive();
  btn.classList.add('active');

  filters.category = catId;
  filters.subcategory = subId;
  currentPage = 1;
  loadMaterials();
  loadQuestionAnalysis();

  if (window.innerWidth <= 768) closeSidebar();
}

// 兼容旧的 selectCategory 调用
function selectCategory(catId, subId, btn) {
  if (!catId) {
    clearAllActive();
    btn.classList.add('active');
    filters.category = '';
    filters.subcategory = '';
    currentPage = 1;
    loadMaterials();
    loadQuestionAnalysis();
    if (window.innerWidth <= 768) closeSidebar();
  }
}

function clearAllActive() {
  document.querySelectorAll('#categoryFilter .sidebar-item').forEach(b => b.classList.remove('active'));
}

// ========== 渲染类型和标签 ==========
function renderTypeFilter() {
  const container = document.getElementById('typeFilter');
  container.innerHTML = '<button class="sidebar-item active" data-value="" onclick="setFilter(\'type\',\'\',this)">全部类型</button>';
  types.forEach(t => {
    container.innerHTML += `<button class="sidebar-item" data-value="${t.id}" onclick="setFilter('type','${t.id}',this)">${t.name}</button>`;
  });
}

function renderTagFilter() {
  const container = document.getElementById('tagFilter');
  container.innerHTML = '<button class="sidebar-tag active" data-value="" onclick="setFilter(\'tag\',\'\',this)">全部</button>';
  allTags.slice(0, 20).forEach(t => {
    container.innerHTML += `<button class="sidebar-tag" data-value="${t}" onclick="setFilter('tag','${t}',this)">${t}</button>`;
  });
}

// ========== 通用筛选 ==========
function setFilter(key, value, btn) {
  filters[key] = value;
  const parent = btn.parentElement;
  parent.querySelectorAll('.sidebar-item, .sidebar-tag').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  currentPage = 1;
  loadMaterials();
  if (window.innerWidth <= 768) closeSidebar();
}

function doSearch() {
  filters.search = document.getElementById('searchInput').value.trim();
  currentPage = 1;
  loadMaterials();
}

// ========== 侧边栏开关 ==========
function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('sidebarOverlay').classList.toggle('active');
}

function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebarOverlay').classList.remove('active');
}

// ========== 加载素材 ==========
async function loadMaterials() {
  const params = new URLSearchParams({
    category: filters.category,
    subcategory: filters.subcategory,
    type: filters.type,
    tag: filters.tag,
    search: filters.search,
    page: currentPage,
    pageSize: pageSize
  });

  const res = await fetch('/api/materials?' + params).then(r => r.json());
  document.getElementById('totalCount').textContent = res.total;
  renderMaterials(res.data);

  document.getElementById('loadMoreWrapper').style.display = res.data.length < res.total ? 'block' : 'none';
  document.getElementById('emptyState').style.display = res.data.length === 0 ? 'block' : 'none';
}

function renderMaterials(materials) {
  const grid = document.getElementById('materialsGrid');
  if (currentPage === 1) grid.innerHTML = '';

  materials.forEach(m => {
    const cat = categories.find(c => c.id === m.category);
    const type = types.find(t => t.id === m.type);
    // 找到子分类名
    let subName = '';
    if (cat && cat.subcategories) {
      const sub = cat.subcategories.find(s => s.id === m.subcategory);
      if (sub) subName = sub.name;
    }

    const card = document.createElement('div');
    card.className = 'material-card';
    card.onclick = () => openModal(m.id);
    card.innerHTML = `
      <div class="card-header">
        ${cat ? `<span class="card-category">${cat.icon} ${cat.name}</span>` : ''}
        ${subName ? `<span class="card-subcategory">${escapeHtml(subName)}</span>` : ''}
        ${type ? `<span class="card-type">${type.name}</span>` : ''}
      </div>
      <div class="card-title">${escapeHtml(m.title)}</div>
      <div class="card-content">${escapeHtml(m.content)}</div>
      <div class="card-footer">
        <div class="card-tags">
          ${(m.tags || []).slice(0, 3).map(t => `<span class="card-tag">${escapeHtml(t)}</span>`).join('')}
        </div>
        <span class="card-source">${escapeHtml(m.source || '')}</span>
      </div>
    `;
    grid.appendChild(card);
  });
}

function loadMore() { currentPage++; loadMaterials(); }

// ========== 弹窗详情 ==========
async function openModal(id) {
  const m = await fetch('/api/materials/' + id).then(r => r.json());
  currentMaterial = m;

  const cat = categories.find(c => c.id === m.category);
  const type = types.find(t => t.id === m.type);
  let subName = '';
  if (cat && cat.subcategories) {
    const sub = cat.subcategories.find(s => s.id === m.subcategory);
    if (sub) subName = sub.name;
  }

  document.getElementById('modalBody').innerHTML = `
    ${cat ? `<span class="detail-category">${cat.icon} ${cat.name}</span>` : ''}
    ${subName ? `<span class="detail-subcategory">${escapeHtml(subName)}</span>` : ''}
    ${type ? `<span class="detail-type">${type.name}</span>` : ''}
    <div class="detail-title">${escapeHtml(m.title)}</div>
    ${m.source ? `<div class="detail-source">来源：${escapeHtml(m.source)}</div>` : ''}
    <div class="detail-content">${escapeHtml(m.content)}</div>
    ${m.tags && m.tags.length ? `
      <div class="detail-tags">
        <div class="detail-label">标签</div>
        <div class="tag-list">${m.tags.map(t => `<span class="tag-item">${escapeHtml(t)}</span>`).join('')}</div>
      </div>
    ` : ''}
    ${m.applicableTopics && m.applicableTopics.length ? `
      <div class="detail-topics">
        <div class="detail-label">适用话题</div>
        <div class="tag-list">${m.applicableTopics.map(t => `<span class="topic-item">${escapeHtml(t)}</span>`).join('')}</div>
      </div>
    ` : ''}
  `;

  document.getElementById('modalOverlay').classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeModal(e) { if (e.target === e.currentTarget) closeModalDirect(); }

function closeModalDirect() {
  document.getElementById('modalOverlay').classList.remove('active');
  document.body.style.overflow = '';
}

document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModalDirect(); });

// ========== 复制 ==========
function copyMaterial() {
  if (!currentMaterial) return;
  const m = currentMaterial;
  const text = `【${m.title}】\n\n${m.content}\n\n来源：${m.source || '未知'}`;
  navigator.clipboard.writeText(text).then(() => {
    showToast('复制成功！');
  }).catch(() => {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    showToast('复制成功！');
  });
}

// ========== Toast ==========
function showToast(msg) {
  let toast = document.querySelector('.toast');
  if (!toast) { toast = document.createElement('div'); toast.className = 'toast'; document.body.appendChild(toast); }
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2000);
}

// ========== 工具函数 ==========
function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ========== 右侧命题分析面板 ==========
async function loadQuestionAnalysis() {
  const params = new URLSearchParams();
  if (filters.subcategory) {
    params.set('subcategory', filters.subcategory);
  } else if (filters.category) {
    params.set('category', filters.category);
  }

  const res = await fetch('/api/question-analysis?' + params).then(r => r.json());
  renderQuestionAnalysis(res);
}

function renderQuestionAnalysis(list) {
  const body = document.getElementById('rightBody');

  if (!list.length) {
    body.innerHTML = '<div class="qa-hint">该分类暂无命题分析<br>可在管理后台添加</div>';
    return;
  }

  body.innerHTML = list.map(qa => `
    <div class="qa-card">
      <div class="qa-card-title">${escapeHtml(qa.title)}</div>
      <span class="qa-card-type">${escapeHtml(qa.questionType || '')}</span>
      <div class="qa-card-question">${escapeHtml(qa.sampleQuestion)}</div>
      <div class="qa-card-angles">
        <div class="qa-card-label">💡 写作角度</div>
        <div class="qa-angle-list">
          ${(qa.angles || []).map(a => `<span class="qa-angle">${escapeHtml(a)}</span>`).join('')}
        </div>
      </div>
      <div class="qa-card-tips">✏️ ${escapeHtml(qa.tips || '')}</div>
      <div class="qa-materials-title">📎 推荐素材</div>
      ${(qa.materials || []).map(m => `
        <div class="qa-material-item" onclick="openModal('${m.id}')">
          <span class="qa-material-dot"></span>
          <span>${escapeHtml(m.title)}</span>
        </div>
      `).join('')}
    </div>
  `).join('');
}

// 右侧面板切换（移动端/中等屏幕）
function toggleRightPanel() {
  document.getElementById('rightPanel').classList.toggle('open');
  document.getElementById('rightOverlay').classList.toggle('active');
}

// ========== 启动 ==========
init();
