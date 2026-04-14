// ========== 全局状态 ==========
let categories = [];
let types = [];
let formTags = [];
let formTopics = [];
let formLinks = [];
let adminPage = 1;
let adminPageSize = 15;

// ========== 初始化 ==========
async function init() {
  const [catRes, typeRes] = await Promise.all([
    fetch('/api/categories').then(r => r.json()),
    fetch('/api/types').then(r => r.json())
  ]);
  categories = catRes;
  types = typeRes;

  populateFilters();
  populateFormSelects();
  setupTagInputs();
  loadAdminMaterials();
}

// ========== 页面切换 ==========
function showSection(name) {
  document.querySelectorAll('.admin-section').forEach(s => s.style.display = 'none');
  document.getElementById('section' + capitalize(name)).style.display = 'block';
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('nav' + capitalize(name)).classList.add('active');

  if (name === 'stats') loadStats();
  if (name === 'list') loadAdminMaterials();
  if (name === 'categories') loadCatMgmt();
}

function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

// ========== 填充筛选器 ==========
function populateFilters() {
  const catSelect = document.getElementById('adminCategoryFilter');
  catSelect.innerHTML = '<option value="">全部分类</option>';
  categories.forEach(c => {
    catSelect.innerHTML += `<option value="${c.id}">${c.icon} ${c.name}</option>`;
  });

  const typeSelect = document.getElementById('adminTypeFilter');
  typeSelect.innerHTML = '<option value="">全部类型</option>';
  types.forEach(t => {
    typeSelect.innerHTML += `<option value="${t.id}">${t.name}</option>`;
  });
}

function populateFormSelects() {
  const catSelect = document.getElementById('formCategory');
  catSelect.innerHTML = '<option value="">请选择分类</option>';
  categories.forEach(c => {
    catSelect.innerHTML += `<option value="${c.id}">${c.icon} ${c.name}</option>`;
  });

  // 一级分类切换时更新二级分类
  catSelect.addEventListener('change', updateSubcategoryOptions);
  updateSubcategoryOptions();

  const typeSelect = document.getElementById('formType');
  typeSelect.innerHTML = '<option value="">请选择类型</option>';
  types.forEach(t => {
    typeSelect.innerHTML += `<option value="${t.id}">${t.name}</option>`;
  });
}

// 根据选中的一级分类，更新二级分类下拉
function updateSubcategoryOptions() {
  const catId = document.getElementById('formCategory').value;
  const subSelect = document.getElementById('formSubcategory');
  const cat = categories.find(c => c.id === catId);

  if (!cat || !cat.subcategories || cat.subcategories.length === 0) {
    subSelect.innerHTML = '<option value="">无子分类</option>';
    subSelect.disabled = true;
    return;
  }

  subSelect.disabled = false;
  subSelect.innerHTML = '<option value="">请选择子分类</option>';
  cat.subcategories.forEach(s => {
    subSelect.innerHTML += `<option value="${s.id}">${s.name}</option>`;
  });
}

// ========== 标签输入组件 ==========
function setupTagInputs() {
  setupTagInput('tagInputWrapper', 'tagInput', formTags);
  setupTagInput('topicInputWrapper', 'topicInput', formTopics);
}

function setupTagInput(wrapperId, inputId, arr) {
  const wrapper = document.getElementById(wrapperId);
  const input = document.getElementById(inputId);

  wrapper.addEventListener('click', () => input.focus());

  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const val = input.value.trim();
      if (val && !arr.includes(val)) {
        arr.push(val);
        renderTagItems(wrapperId, inputId, arr);
      }
      input.value = '';
    }
    if (e.key === 'Backspace' && !input.value && arr.length) {
      arr.pop();
      renderTagItems(wrapperId, inputId, arr);
    }
  });
}

function renderTagItems(wrapperId, inputId, arr) {
  const wrapper = document.getElementById(wrapperId);
  const input = document.getElementById(inputId);
  // 清除旧标签
  wrapper.querySelectorAll('.tag-input-item').forEach(el => el.remove());
  // 在 input 前插入标签
  arr.forEach((tag, i) => {
    const span = document.createElement('span');
    span.className = 'tag-input-item';
    span.innerHTML = `${escapeHtml(tag)} <span class="remove-tag" onclick="removeTagItem('${wrapperId}','${inputId}',${i})">&times;</span>`;
    wrapper.insertBefore(span, input);
  });
}

function removeTagItem(wrapperId, inputId, index) {
  const arr = wrapperId === 'tagInputWrapper' ? formTags : formTopics;
  arr.splice(index, 1);
  renderTagItems(wrapperId, inputId, arr);
}

// ========== 素材列表加载 ==========
async function loadAdminMaterials() {
  const search = document.getElementById('adminSearch').value.trim();
  const category = document.getElementById('adminCategoryFilter').value;
  const type = document.getElementById('adminTypeFilter').value;

  const params = new URLSearchParams({ search, category, type, page: adminPage, pageSize: adminPageSize });
  const res = await fetch('/api/materials?' + params).then(r => r.json());

  renderAdminTable(res.data);
  renderPagination(res.total, res.page, res.pageSize);
}

function adminSearchMaterials() {
  adminPage = 1;
  loadAdminMaterials();
}

function renderAdminTable(materials) {
  const tbody = document.getElementById('adminTableBody');
  tbody.innerHTML = materials.map(m => {
    const cat = categories.find(c => c.id === m.category);
    const type = types.find(t => t.id === m.type);
    return `
      <tr>
        <td><input type="checkbox" class="row-check" data-id="${m.id}"></td>
        <td title="${escapeHtml(m.title)}">${escapeHtml(m.title)}</td>
        <td>${cat ? cat.icon + ' ' + cat.name : '-'}</td>
        <td>${type ? type.name : '-'}</td>
        <td>${(m.tags || []).map(t => `<span class="table-tag">${escapeHtml(t)}</span>`).join('')}</td>
        <td>${m.createdAt || '-'}</td>
        <td>
          <button class="btn-sm btn-edit" onclick="editMaterial('${m.id}')">编辑</button>
          <button class="btn-sm btn-del" onclick="deleteMaterial('${m.id}')">删除</button>
        </td>
      </tr>
    `;
  }).join('');
}

function renderPagination(total, currentPage, pageSize) {
  const totalPages = Math.ceil(total / pageSize);
  const container = document.getElementById('adminPagination');
  if (totalPages <= 1) { container.innerHTML = ''; return; }

  let html = '';
  html += `<button ${currentPage <= 1 ? 'disabled' : ''} onclick="goPage(${currentPage - 1})">上一页</button>`;
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= currentPage - 2 && i <= currentPage + 2)) {
      html += `<button class="${i === currentPage ? 'active' : ''}" onclick="goPage(${i})">${i}</button>`;
    } else if (i === currentPage - 3 || i === currentPage + 3) {
      html += `<button disabled>...</button>`;
    }
  }
  html += `<button ${currentPage >= totalPages ? 'disabled' : ''} onclick="goPage(${currentPage + 1})">下一页</button>`;
  container.innerHTML = html;
}

function goPage(p) {
  adminPage = p;
  loadAdminMaterials();
}

// ========== 全选 ==========
function toggleSelectAll() {
  const checked = document.getElementById('selectAll').checked;
  document.querySelectorAll('.row-check').forEach(cb => cb.checked = checked);
}

// ========== 新增/编辑素材 ==========
async function saveMaterial(e) {
  e.preventDefault();
  const editId = document.getElementById('editId').value;

  const material = {
    title: document.getElementById('formTitleInput').value.trim(),
    content: document.getElementById('formContent').value.trim(),
    category: document.getElementById('formCategory').value,
    subcategory: document.getElementById('formSubcategory').value,
    type: document.getElementById('formType').value,
    tags: [...formTags],
    source: document.getElementById('formSource').value.trim(),
    applicableTopics: [...formTopics],
    links: collectLinks()
  };

  if (!material.title || !material.content || !material.category || !material.type) {
    showToast('请填写必填项', 'error');
    return;
  }

  let res;
  if (editId) {
    res = await fetch('/api/materials/' + editId, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(material)
    });
  } else {
    res = await fetch('/api/materials', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(material)
    });
  }

  const data = await res.json();
  if (data.success) {
    showToast(editId ? '素材已更新' : '素材已添加', 'success');
    resetForm();
    showSection('list');
  } else {
    showToast('保存失败', 'error');
  }
}

async function editMaterial(id) {
  const m = await fetch('/api/materials/' + id).then(r => r.json());

  document.getElementById('editId').value = m.id;
  document.getElementById('formTitleInput').value = m.title;
  document.getElementById('formContent').value = m.content;
  document.getElementById('formCategory').value = m.category;
  // 先触发一级分类变更来填充二级选项
  updateSubcategoryOptions();
  document.getElementById('formSubcategory').value = m.subcategory || '';
  document.getElementById('formType').value = m.type;
  document.getElementById('formSource').value = m.source || '';

  formTags = [...(m.tags || [])];
  formTopics = [...(m.applicableTopics || [])];
  formLinks = [...(m.links || [])];
  renderTagItems('tagInputWrapper', 'tagInput', formTags);
  renderTagItems('topicInputWrapper', 'topicInput', formTopics);
  renderLinkRows();

  document.getElementById('formTitle').textContent = '编辑素材';
  showSection('add');
}

function resetForm() {
  document.getElementById('materialForm').reset();
  document.getElementById('editId').value = '';
  document.getElementById('formTitle').textContent = '添加素材';
  formTags = [];
  formTopics = [];
  formLinks = [];
  renderTagItems('tagInputWrapper', 'tagInput', formTags);
  renderTagItems('topicInputWrapper', 'topicInput', formTopics);
  renderLinkRows();
}

// ========== 删除 ==========
async function deleteMaterial(id) {
  if (!confirm('确定要删除这条素材吗？')) return;
  const res = await fetch('/api/materials/' + id, { method: 'DELETE' }).then(r => r.json());
  if (res.success) {
    showToast('已删除', 'success');
    loadAdminMaterials();
  }
}

async function batchDelete() {
  const ids = [...document.querySelectorAll('.row-check:checked')].map(cb => cb.dataset.id);
  if (!ids.length) { showToast('请先勾选素材', 'error'); return; }
  if (!confirm(`确定要删除选中的 ${ids.length} 条素材吗？`)) return;

  const res = await fetch('/api/materials/batch-delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids })
  }).then(r => r.json());

  if (res.success) {
    showToast(`已删除 ${res.deleted} 条`, 'success');
    document.getElementById('selectAll').checked = false;
    loadAdminMaterials();
  }
}

// ========== 导入导出 ==========
function exportData() {
  window.location.href = '/api/export';
}

async function importData(e) {
  const file = e.target.files[0];
  if (!file) return;

  const text = await file.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    showToast('文件格式错误', 'error');
    return;
  }

  const res = await fetch('/api/import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }).then(r => r.json());

  if (res.success) {
    showToast(`成功导入 ${res.imported} 条素材`, 'success');
    e.target.value = '';
  } else {
    showToast(res.error || '导入失败', 'error');
  }
}

// ========== 数据统计 ==========
async function loadStats() {
  const stats = await fetch('/api/stats').then(r => r.json());
  const grid = document.getElementById('statsGrid');

  let html = `
    <div class="stat-card">
      <div class="stat-number">${stats.totalMaterials}</div>
      <div class="stat-label">素材总数</div>
    </div>
    <div class="stat-card">
      <div class="stat-number">${stats.totalCategories}</div>
      <div class="stat-label">分类数</div>
    </div>
  `;

  categories.forEach(c => {
    html += `
      <div class="stat-card">
        <div class="stat-number">${stats.categoryStats[c.id] || 0}</div>
        <div class="stat-label">${c.icon} ${c.name}</div>
      </div>
    `;
  });

  types.forEach(t => {
    html += `
      <div class="stat-card">
        <div class="stat-number">${stats.typeStats[t.id] || 0}</div>
        <div class="stat-label">${t.name}</div>
      </div>
    `;
  });

  grid.innerHTML = html;
}

// ========== Toast ==========
function showToast(msg, type = 'success') {
  let toast = document.querySelector('.toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.className = 'toast ' + type;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2000);
}

// ========== 分类管理 ==========
let catMgmtData = [];          // 编辑中的分类副本
let catEditState = null;       // { mode: 'addCat'|'editCat'|'addSub'|'editSub', catIndex, subIndex? }

async function loadCatMgmt() {
  catMgmtData = await fetch('/api/categories').then(r => r.json());
  renderCatMgmt();
}

function renderCatMgmt() {
  const grid = document.getElementById('catMgmtGrid');
  if (!catMgmtData.length) {
    grid.innerHTML = '<div class="cat-mgmt-empty">暂无分类，点击上方按钮新增</div>';
    return;
  }

  grid.innerHTML = catMgmtData.map((cat, ci) => `
    <div class="cat-mgmt-card">
      <div class="cat-mgmt-header">
        <div class="cat-mgmt-info">
          <span class="cat-mgmt-icon">${escapeHtml(cat.icon || '📁')}</span>
          <span class="cat-mgmt-name">${escapeHtml(cat.name)}</span>
          <span class="cat-mgmt-id">ID: ${escapeHtml(cat.id)}</span>
        </div>
        <div class="cat-mgmt-actions">
          <button class="btn-sm btn-edit" onclick="openCatEditModal('editCat', ${ci})">编辑</button>
          <button class="btn-sm btn-del" onclick="deleteCat(${ci})">删除</button>
        </div>
      </div>
      <div class="cat-mgmt-subs">
        ${(cat.subcategories || []).map((sub, si) => `
          <div class="cat-mgmt-sub">
            <span class="cat-mgmt-sub-name">${escapeHtml(sub.name)}</span>
            <span class="cat-mgmt-sub-id">${escapeHtml(sub.id)}</span>
            <div class="cat-mgmt-sub-actions">
              <button class="btn-sm btn-edit" onclick="openCatEditModal('editSub', ${ci}, ${si})">编辑</button>
              <button class="btn-sm btn-del" onclick="deleteSub(${ci}, ${si})">删除</button>
            </div>
          </div>
        `).join('')}
        <button class="btn-add-sub" onclick="openCatEditModal('addSub', ${ci})">+ 新增子分类</button>
      </div>
    </div>
  `).join('') + `
    <div class="cat-mgmt-save-bar">
      <button class="btn-primary" onclick="saveAllCategories()">保存所有更改</button>
      <button class="btn-secondary" onclick="loadCatMgmt()">撤销所有更改</button>
    </div>
  `;
}

// 生成唯一 ID
function generateCatId(prefix, name) {
  return prefix + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
}

// 打开编辑弹窗
function openCatEditModal(mode, catIndex, subIndex) {
  catEditState = { mode, catIndex, subIndex };

  let title = '', icon = '', name = '';
  if (mode === 'editCat') {
    const cat = catMgmtData[catIndex];
    name = cat.name;
    icon = cat.icon || '';
    title = '编辑一级分类';
  } else if (mode === 'addCat') {
    title = '新增一级分类';
  } else if (mode === 'editSub') {
    name = catMgmtData[catIndex].subcategories[subIndex].name;
    title = '编辑子分类';
  } else if (mode === 'addSub') {
    title = '新增子分类';
  }

  const isCategory = (mode === 'addCat' || mode === 'editCat');
  const modal = document.getElementById('catEditModal');
  modal.querySelector('.cat-modal-title').textContent = title;
  document.getElementById('catEditName').value = name;
  document.getElementById('catEditIconRow').style.display = isCategory ? 'flex' : 'none';
  document.getElementById('catEditIcon').value = icon;
  modal.classList.add('active');
  document.getElementById('catEditName').focus();
}

function closeCatEditModal() {
  document.getElementById('catEditModal').classList.remove('active');
  catEditState = null;
}

function confirmCatEdit() {
  const name = document.getElementById('catEditName').value.trim();
  const icon = document.getElementById('catEditIcon').value.trim() || '📁';
  if (!name) { showToast('请输入分类名称', 'error'); return; }

  const { mode, catIndex, subIndex } = catEditState;

  if (mode === 'addCat') {
    catMgmtData.push({
      id: generateCatId('cat', name),
      name,
      icon,
      subcategories: []
    });
  } else if (mode === 'editCat') {
    catMgmtData[catIndex].name = name;
    catMgmtData[catIndex].icon = icon;
  } else if (mode === 'addSub') {
    if (!catMgmtData[catIndex].subcategories) catMgmtData[catIndex].subcategories = [];
    catMgmtData[catIndex].subcategories.push({
      id: generateCatId(catMgmtData[catIndex].id, name),
      name
    });
  } else if (mode === 'editSub') {
    catMgmtData[catIndex].subcategories[subIndex].name = name;
  }

  closeCatEditModal();
  renderCatMgmt();
}

function addCategory() {
  openCatEditModal('addCat', -1);
}

function deleteCat(ci) {
  const cat = catMgmtData[ci];
  if (!confirm(`确定要删除分类「${cat.name}」及其所有子分类吗？\n\n注意：该分类下的素材不会被删除，但会失去分类归属。`)) return;
  catMgmtData.splice(ci, 1);
  renderCatMgmt();
}

function deleteSub(ci, si) {
  const sub = catMgmtData[ci].subcategories[si];
  if (!confirm(`确定要删除子分类「${sub.name}」吗？\n\n注意：该子分类下的素材不会被删除，但会失去子分类归属。`)) return;
  catMgmtData[ci].subcategories.splice(si, 1);
  renderCatMgmt();
}

async function saveAllCategories() {
  // 校验：不能有重复 ID
  const allIds = [];
  catMgmtData.forEach(c => {
    allIds.push(c.id);
    (c.subcategories || []).forEach(s => allIds.push(s.id));
  });
  const dupIds = allIds.filter((id, i) => allIds.indexOf(id) !== i);
  if (dupIds.length) {
    showToast('存在重复 ID: ' + dupIds.join(', '), 'error');
    return;
  }

  // 检查被删除的分类/子分类下是否有素材
  const removedCatIds = categories.filter(c => !allIds.includes(c.id)).map(c => c.id);
  const removedSubIds = [];
  categories.forEach(c => {
    (c.subcategories || []).forEach(s => {
      if (!allIds.includes(s.id)) removedSubIds.push(s.id);
    });
  });

  if (removedCatIds.length > 0 || removedSubIds.length > 0) {
    const stats = await fetch('/api/stats').then(r => r.json());
    const affectedMats = removedCatIds.reduce((n, cid) => n + (stats.categoryStats[cid] || 0), 0);
    if (affectedMats > 0) {
      if (!confirm(`本次操作将移除 ${removedCatIds.length} 个分类，其中有 ${affectedMats} 条素材会失去分类归属（素材不会被删除）。\n\n确定继续？`)) return;
    }
  }

  const res = await fetch('/api/categories', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(catMgmtData)
  }).then(r => r.json());

  if (res.success) {
    // 更新全局 categories 并刷新表单下拉
    categories = JSON.parse(JSON.stringify(catMgmtData));
    populateFilters();
    populateFormSelects();
    showToast('分类已保存', 'success');
  } else {
    showToast('保存失败', 'error');
  }
}

// ========== 链接管理组件 ==========
const LINK_TYPES = [
  { value: 'wiki', label: '百科/知识' },
  { value: 'video', label: '视频' },
  { value: 'article', label: '文章' },
  { value: 'news', label: '新闻' },
  { value: 'social', label: '社交媒体' }
];

function addLinkRow(link) {
  formLinks.push(link || { title: '', url: '', type: 'article' });
  renderLinkRows();
}

function removeLinkRow(index) {
  formLinks.splice(index, 1);
  renderLinkRows();
}

function renderLinkRows() {
  const container = document.getElementById('linksContainer');
  if (!formLinks.length) {
    container.innerHTML = '<div class="links-empty">暂无链接，点击下方按钮添加</div>';
    return;
  }
  container.innerHTML = formLinks.map((link, i) => `
    <div class="link-row">
      <select class="link-type" data-index="${i}" onchange="updateLinkField(${i},'type',this.value)">
        ${LINK_TYPES.map(t => `<option value="${t.value}" ${link.type === t.value ? 'selected' : ''}>${t.label}</option>`).join('')}
      </select>
      <input type="text" class="link-title-input" placeholder="链接标题（如：百度百科：ChatGPT）" value="${escapeHtml(link.title)}" oninput="updateLinkField(${i},'title',this.value)">
      <input type="text" class="link-url-input" placeholder="https://..." value="${escapeHtml(link.url)}" oninput="updateLinkField(${i},'url',this.value)">
      <button type="button" class="btn-remove-link" onclick="removeLinkRow(${i})">✕</button>
    </div>
  `).join('');
}

function updateLinkField(index, field, value) {
  formLinks[index][field] = value;
}

function collectLinks() {
  return formLinks.filter(l => l.title.trim() && l.url.trim());
}

// ========== 工具函数 ==========
function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ========== 启动 ==========
init();
