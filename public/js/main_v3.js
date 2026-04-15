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

    renderFilters();
    loadMaterials();
    bindEvents();
  } catch (err) {
    showToast('卷帙浩繁，稍后再试');
  }
}

function bindEvents() {
  const searchInput = document.getElementById('searchInput');
  searchInput.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      filters.search = e.target.value.trim();
      currentPage = 1;
      loadMaterials();
    }, 400);
  });

  document.addEventListener('keydown', e => { 
    if (e.key === 'Escape') closeReader(); 
  });
}

// 渲染导航
function renderFilters() {
  const catContainer = document.getElementById('categoryFilter');
  let catHtml = `<button class="filter-item active" onclick="selectCategory('', this)">全部卷宗</button>`;
  
  categories.forEach(c => {
    // 提取中文前缀用于显示
    catHtml += `<button class="filter-item" onclick="selectCategory('${c.id}', this)">${c.name.replace(/[^\u4e00-\u9fa5]/g, '')}</button>`;
  });
  catContainer.innerHTML = catHtml;

  const tagContainer = document.getElementById('tagFilter');
  let tagHtml = `<button class="tag-btn active" onclick="selectTag('', this)">全部</button>`;
  allTags.slice(0, 12).forEach(t => {
    tagHtml += `<button class="tag-btn" onclick="selectTag('${t}', this)">${t}</button>`;
  });
  tagContainer.innerHTML = tagHtml;
}

function selectCategory(catId, el) {
  document.querySelectorAll('.filter-item').forEach(p => p.classList.remove('active'));
  el.classList.add('active');

  filters.category = catId;
  filters.subcategory = '';
  filters.tag = '';
  
  document.querySelectorAll('.tag-btn').forEach(p => p.classList.remove('active'));
  document.querySelector('.tag-btn').classList.add('active');
  
  currentPage = 1;
  loadMaterials();
}

function selectTag(tag, el) {
  filters.tag = tag;
  filters.category = '';
  filters.subcategory = '';

  document.querySelectorAll('.filter-item').forEach(p => p.classList.remove('active'));
  document.querySelector('.filter-item').classList.add('active');

  document.querySelectorAll('.tag-btn').forEach(p => p.classList.remove('active'));
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
    renderGrid(res.data);

    document.getElementById('loadMoreWrapper').style.display = 
      res.data.length < res.total ? 'block' : 'none';
    document.getElementById('emptyState').style.display = 
      res.data.length === 0 ? 'block' : 'none';
  } catch (err) {
    showToast('获取卷宗失败');
  }
}

function renderGrid(materials) {
  const grid = document.getElementById('materialsGrid');
  if (currentPage === 1) grid.innerHTML = '';

  const fragment = document.createDocumentFragment();

  materials.forEach(m => {
    const cat = categories.find(c => c.id === m.category);
    const catName = cat ? cat.name.replace(/[^\u4e00-\u9fa5]/g, '') : '佚名卷';

    const card = document.createElement('div');
    card.className = 'mag-card';
    card.onclick = () => openReader(m.id);
    
    // 提取前缀用于排版美化
    const sourceStr = m.source ? ` · ${escapeHtml(m.source)}` : '';
    
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

function loadMore() { 
  currentPage++; 
  loadMaterials(); 
}

// 阅读器
async function openReader(id) {
  try {
    const m = await fetch('/api/materials/' + id).then(r => r.json());
    currentMaterial = m;

    const cat = categories.find(c => c.id === m.category);
    const catName = cat ? cat.name.replace(/[^\u4e00-\u9fa5]/g, '') : '';
    
    let metaHtml = '';
    if (catName) metaHtml += `收录于《${catName}》`;
    if (m.source) metaHtml += `&nbsp;&nbsp;|&nbsp;&nbsp;源自：${escapeHtml(m.source)}`;

    document.getElementById('readerContent').innerHTML = `
      <h2>${escapeHtml(m.title)}</h2>
      <div class="meta">${metaHtml}</div>
      <div class="text-body">${escapeHtml(m.content)}</div>
    `;

    document.getElementById('readerOverlay').classList.add('active');
    document.getElementById('readerModal').classList.add('open');
    document.body.style.overflow = 'hidden';
  } catch (err) {
    showToast('翻阅失败，请稍后重试');
  }
}

function closeReader() {
  document.getElementById('readerOverlay').classList.remove('active');
  document.getElementById('readerModal').classList.remove('open');
  document.body.style.overflow = '';
}

// 复制
function copyMaterial() {
  if (!currentMaterial) return;
  const m = currentMaterial;
  const text = `《${m.title}》

${m.content}

—— ${m.source || '佚名'}`;
  
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

// Toast
function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3000);
}

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

init();