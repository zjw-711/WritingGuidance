// 全局状态
let categories = [];
let types = [];
let allTags = [];
let currentMaterial = null;
let currentPage = 1;
let pageSize = 12;
let filters = { category: '', subcategory: '', tag: '', search: '' };
let searchTimeout = null;

// 初始化
async function init() {
  try {
    const [catRes, typeRes, tagRes] = await Promise.all([
      fetch('/api/categories').then(r => r.json()),
      fetch('/api/types').then(r => r.json()),
      fetch('/api/tags').then(r => r.json())
    ]);
    categories = catRes;
    types = typeRes;
    allTags = tagRes;

    renderCategoryFilter();
    renderTagFilter();
    loadMaterials();
    bindEvents();
  } catch (err) {
    showToast('数据加载失败，请检查网络');
  }
}

// 绑定事件
function bindEvents() {
  const searchInput = document.getElementById('searchInput');
  searchInput.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      filters.search = e.target.value.trim();
      currentPage = 1;
      loadMaterials();
    }, 400); // 400ms防抖
  });

  // 节流滚动事件
  let ticking = false;
  window.addEventListener('scroll', () => {
    if (!ticking) {
      window.requestAnimationFrame(() => {
        const btn = document.getElementById('btnTop');
        if (window.scrollY > 400) btn.classList.add('visible');
        else btn.classList.remove('visible');
        ticking = false;
      });
      ticking = true;
    }
  });

  document.addEventListener('keydown', e => { 
    if (e.key === 'Escape') closeDrawer(); 
  });
}

// 渲染主分类
function renderCategoryFilter() {
  const container = document.getElementById('categoryFilter');
  let html = `<div class="pill active" onclick="selectCategory('', this)">全部</div>`;
  
  categories.forEach(c => {
    html += `<div class="pill" data-id="${c.id}" onclick="selectCategory('${c.id}', this)">${c.icon} ${c.name}</div>`;
  });
  
  container.innerHTML = html;
}

// 渲染子分类
function renderSubcategoryFilter(catId) {
  const group = document.getElementById('subcategoryFilterGroup');
  const container = document.getElementById('subcategoryFilter');
  
  if (!catId) {
    group.style.display = 'none';
    return;
  }

  const cat = categories.find(c => c.id === catId);
  if (!cat || !cat.subcategories || cat.subcategories.length === 0) {
    group.style.display = 'none';
    return;
  }

  group.style.display = 'flex';
  let html = `<div class="pill active" onclick="selectSubcategory('${catId}', '', this)">全部子类</div>`;
  cat.subcategories.forEach(s => {
    html += `<div class="pill" onclick="selectSubcategory('${catId}', '${s.id}', this)">${s.name}</div>`;
  });
  
  container.innerHTML = html;
}

// 分类选择
function selectCategory(catId, el) {
  document.querySelectorAll('#categoryFilter .pill').forEach(p => p.classList.remove('active'));
  el.classList.add('active');

  filters.category = catId;
  filters.subcategory = '';
  filters.tag = '';
  
  // 重置标签高亮
  document.querySelectorAll('#tagFilter .pill').forEach(p => p.classList.remove('active'));
  document.querySelector('#tagFilter .pill').classList.add('active');

  renderSubcategoryFilter(catId);
  
  currentPage = 1;
  loadMaterials();
}

function selectSubcategory(catId, subId, el) {
  document.querySelectorAll('#subcategoryFilter .pill').forEach(p => p.classList.remove('active'));
  el.classList.add('active');

  filters.subcategory = subId;
  currentPage = 1;
  loadMaterials();
}

// 渲染标签
function renderTagFilter() {
  const container = document.getElementById('tagFilter');
  let html = `<div class="pill active" onclick="selectTag('', this)">全部</div>`;
  allTags.slice(0, 15).forEach(t => {
    html += `<div class="pill" onclick="selectTag('${t}', this)">${t}</div>`;
  });
  container.innerHTML = html;
}

function selectTag(tag, el) {
  // 选标签时清除分类状态
  filters.tag = tag;
  filters.category = '';
  filters.subcategory = '';

  document.querySelectorAll('#categoryFilter .pill, #subcategoryFilter .pill').forEach(p => p.classList.remove('active'));
  document.querySelector('#categoryFilter .pill').classList.add('active');
  document.getElementById('subcategoryFilterGroup').style.display = 'none';

  document.querySelectorAll('#tagFilter .pill').forEach(p => p.classList.remove('active'));
  el.classList.add('active');

  currentPage = 1;
  loadMaterials();
}

// 加载数据
async function loadMaterials() {
  const params = new URLSearchParams({
    category: filters.category,
    subcategory: filters.subcategory,
    tag: filters.tag,
    search: filters.search,
    page: currentPage,
    pageSize: pageSize
  });

  try {
    const res = await fetch('/api/materials?' + params).then(r => r.json());
    document.getElementById('totalCount').textContent = res.total;
    renderMaterials(res.data);

    document.getElementById('loadMoreWrapper').style.display = 
      res.data.length < res.total ? 'block' : 'none';
    document.getElementById('emptyState').style.display = 
      res.data.length === 0 ? 'block' : 'none';
  } catch (err) {
    showToast('获取数据失败');
  }
}

function renderMaterials(materials) {
  const grid = document.getElementById('materialsGrid');
  if (currentPage === 1) grid.innerHTML = '';

  const fragment = document.createDocumentFragment();

  materials.forEach(m => {
    const cat = categories.find(c => c.id === m.category);
    let subName = '';
    if (cat && cat.subcategories) {
      const sub = cat.subcategories.find(s => s.id === m.subcategory);
      if (sub) subName = sub.name;
    }

    const card = document.createElement('div');
    card.className = 'card';
    card.onclick = () => openDrawer(m.id);
    card.innerHTML = `
      <div class="card-meta">
        ${cat ? `<span class="badge badge-cat">${cat.icon} ${cat.name}</span>` : ''}
        ${subName ? `<span class="badge badge-sub">${escapeHtml(subName)}</span>` : ''}
      </div>
      <div class="card-title">${escapeHtml(m.title)}</div>
      <div class="card-desc">${escapeHtml(m.content)}</div>
      <div class="card-footer">
        <div class="card-tags">
          ${(m.tags || []).slice(0, 2).map(t => `<span class="card-tag">${escapeHtml(t)}</span>`).join('')}
        </div>
        ${m.source ? `<div style="font-size:0.8rem; color:var(--text-muted)">${escapeHtml(m.source)}</div>` : ''}
      </div>
    `;
    fragment.appendChild(card);
  });

  grid.appendChild(fragment);
}

function loadMore() { 
  currentPage++; 
  loadMaterials(); 
}

// 抽屉详情
async function openDrawer(id) {
  try {
    const m = await fetch('/api/materials/' + id).then(r => r.json());
    currentMaterial = m;

    const cat = categories.find(c => c.id === m.category);
    let subName = '';
    if (cat && cat.subcategories) {
      const sub = cat.subcategories.find(s => s.id === m.subcategory);
      if (sub) subName = sub.name;
    }

    document.getElementById('drawerContent').innerHTML = `
      <div class="badge-group">
        ${cat ? `<span class="badge badge-cat">${cat.icon} ${cat.name}</span>` : ''}
        ${subName ? `<span class="badge badge-sub">${escapeHtml(subName)}</span>` : ''}
      </div>
      <h2>${escapeHtml(m.title)}</h2>
      ${m.source ? `<div class="meta-source">来源: ${escapeHtml(m.source)}</div>` : ''}
      
      <div class="content-body">${escapeHtml(m.content)}</div>

      ${m.tags && m.tags.length ? `
        <div class="detail-section">
          <h4>相关标签</h4>
          <div class="tag-container">
            ${m.tags.map(t => `<span class="tag-item">${escapeHtml(t)}</span>`).join('')}
          </div>
        </div>
      ` : ''}

      ${m.applicableTopics && m.applicableTopics.length ? `
        <div class="detail-section">
          <h4>适用话题</h4>
          <div class="tag-container">
            ${m.applicableTopics.map(t => `<span class="tag-item" style="background:#f0fdf4; border-color:#bbf7d0; color:#166534">${escapeHtml(t)}</span>`).join('')}
          </div>
        </div>
      ` : ''}
    `;

    document.getElementById('drawerOverlay').classList.add('active');
    document.getElementById('detailDrawer').classList.add('open');
    document.body.style.overflow = 'hidden';
  } catch (err) {
    showToast('加载详情失败');
  }
}

function closeDrawer() {
  document.getElementById('drawerOverlay').classList.remove('active');
  document.getElementById('detailDrawer').classList.remove('open');
  document.body.style.overflow = '';
}

// 复制
function copyMaterial() {
  if (!currentMaterial) return;
  const m = currentMaterial;
  const text = `【${m.title}】

${m.content}

来源：${m.source || '未知'}`;
  
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text).then(() => showToast('复制成功'));
  } else {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    showToast('复制成功');
  }
}

// 工具函数
function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2500);
}

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// 启动
init();