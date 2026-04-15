// ========== 全局状态 ==========
let categories = [];
let types = [];
let formTags = [];
let formTopics = [];
let formLinks = [];
let adminPage = 1;
let adminPageSize = 15;
let currentUser = null;

// ========== 认证工具 ==========

// 带认证检查的 fetch 封装，遇到 401 自动跳转登录页
async function authFetch(url, options = {}) {
  const res = await fetch(url, options);
  if (res.status === 401) {
    window.location.href = '/login';
    throw new Error('未登录');
  }
  return res;
}

async function logout() {
  try {
    await fetch('/api/auth/logout', { method: 'POST' });
  } catch {}
  window.location.href = '/login';
}

// 根据角色隐藏/显示功能区
function applyRolePermissions() {
  if (!currentUser) return;
  const isAdmin = currentUser.role === 'admin';

  // editor 不能看到：分类管理、导入导出、AI 配置
  const navImport = document.getElementById('navImport');
  const navCategories = document.getElementById('navCategories');
  if (navImport) navImport.style.display = isAdmin ? '' : 'none';
  if (navCategories) navCategories.style.display = isAdmin ? '' : 'none';

  // AI 配置区（AI 生成和名著挖掘保留）
  const aiConfigCard = document.querySelector('.ai-config-card');
  if (aiConfigCard) aiConfigCard.style.display = isAdmin ? '' : 'none';

  // 显示当前用户
  const userEl = document.getElementById('currentUser');
  if (userEl) {
    userEl.textContent = `${currentUser.username}（${currentUser.role === 'admin' ? '管理员' : '编辑'}）`;
  }
}

// ========== 初始化 ==========
async function init() {
  // 先检查登录状态
  try {
    const meRes = await fetch('/api/auth/me');
    if (!meRes.ok) {
      window.location.href = '/login';
      return;
    }
    const meData = await meRes.json();
    currentUser = meData.user;
  } catch {
    window.location.href = '/login';
    return;
  }

  const [catRes, typeRes] = await Promise.all([
    fetch('/api/categories').then(r => r.json()),
    fetch('/api/types').then(r => r.json())
  ]);
  categories = catRes;
  types = typeRes;

  applyRolePermissions();
  populateFilters();
  populateFormSelects();
  setupTagInputs();
  loadAdminMaterials();
  if (currentUser.role === 'admin') {
    loadAiConfig();
  }
  populateAiCategorySelect();
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
  if (name === 'tutorials') { populateTutorialCategoryFilter(); loadTutorials(); }
  if (name === 'ai') loadPendingMaterials();
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
        <td><input type="checkbox" class="row-check" data-id="${escapeAttr(m.id)}"></td>
        <td title="${escapeHtml(m.title)}">${escapeHtml(m.title)}</td>
        <td>${cat ? cat.icon + ' ' + cat.name : '-'}</td>
        <td>${type ? type.name : '-'}</td>
        <td>${(m.tags || []).map(t => `<span class="table-tag">${escapeHtml(t)}</span>`).join('')}</td>
        <td>${m.createdAt || '-'}</td>
        <td>
          <button class="btn-sm btn-edit" onclick="editMaterial('${escapeAttr(m.id)}')">编辑</button>
          <button class="btn-sm btn-del" onclick="deleteMaterial('${escapeAttr(m.id)}')">删除</button>
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
    res = await authFetch('/api/materials/' + editId, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(material)
    });
  } else {
    res = await authFetch('/api/materials', {
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
  const res = await authFetch('/api/materials/' + id, { method: 'DELETE' }).then(r => r.json());
  if (res.success) {
    showToast('已删除', 'success');
    loadAdminMaterials();
  }
}

async function batchDelete() {
  const ids = [...document.querySelectorAll('.row-check:checked')].map(cb => cb.dataset.id);
  if (!ids.length) { showToast('请先勾选素材', 'error'); return; }
  if (!confirm(`确定要删除选中的 ${ids.length} 条素材吗？`)) return;

  const res = await authFetch('/api/materials/batch-delete', {
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

  const res = await authFetch('/api/import', {
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

// ========== 批量上传 ==========

// 分类/类型名称映射（用于预览表格显示）
const CATEGORY_NAMES = {
  tech:'科技创新', virtue:'品德修养', nature:'人与自然', culture:'文化传承',
  society:'社会民生', youth:'青春成长', patriotism:'家国情怀', philosophy:'哲理思辨',
  humanity:'人文关怀', rolemodel:'时代楷模'
};
const TYPE_NAMES = { story:'人物事例', hot:'时事热点', quote:'名言金句' };

// 缓存待导入数据
let pendingBatchMaterials = [];

// 下载模板
function downloadTemplate() {
  const template = {
    materials: [
      {
        title: "示例素材1：人物事迹",
        content: "这里写素材正文，200-400字。包含具体的人名、事件经过、关键细节……",
        category: "tech",
        subcategory: "tech-ai",
        type: "story",
        source: "来源出处",
        tags: ["标签1", "标签2", "标签3"],
        applicableTopics: ["适用话题1", "适用话题2"]
      },
      {
        title: "示例素材2：时事热点",
        content: "这里写时事素材正文……",
        category: "society",
        type: "hot",
        source: "",
        tags: ["热点", "社会"],
        applicableTopics: ["社会公平", "责任担当"]
      },
      {
        title: "示例素材3：名言金句",
        content: "这里写名言金句及其解读……",
        category: "philosophy",
        type: "quote",
        source: "出处",
        tags: ["哲理"],
        applicableTopics: ["思辨与智慧"]
      }
    ]
  };
  const blob = new Blob([JSON.stringify(template, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = '素材上传模板.json';
  a.click();
  URL.revokeObjectURL(url);
}

// 处理拖拽
(function initDropZone() {
  const zone = document.getElementById('dropZone');
  if (!zone) return;
  zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('dragover'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
  zone.addEventListener('drop', e => {
    e.preventDefault();
    zone.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith('.json')) {
      handleBatchUpload(file);
    } else {
      showToast('请上传 .json 文件', 'error');
    }
  });
})();

// 文件选择
function handleBatchFile(e) {
  const file = e.target.files[0];
  if (!file) return;
  handleBatchUpload(file);
  e.target.value = '';
}

// 解析并校验上传文件
async function handleBatchUpload(file) {
  let data;
  try {
    const text = await file.text();
    data = JSON.parse(text);
  } catch {
    showToast('文件解析失败，请检查 JSON 格式', 'error');
    return;
  }

  // 兼容两种格式：{ materials: [...] } 或直接 [...]
  const materials = Array.isArray(data) ? data : (data.materials || []);
  if (!materials.length) {
    showToast('未找到素材数据，请检查文件格式', 'error');
    return;
  }

  // 校验
  const validCategories = new Set(Object.keys(CATEGORY_NAMES));
  const validTypes = new Set(Object.keys(TYPE_NAMES));
  pendingBatchMaterials = [];

  for (let i = 0; i < materials.length; i++) {
    const m = materials[i];
    const errors = [];
    if (!m.title) errors.push('缺少标题');
    if (!m.content) errors.push('缺少正文');
    if (m.category && !validCategories.has(m.category)) errors.push(`分类 "${m.category}" 无效`);
    if (m.type && !validTypes.has(m.type)) errors.push(`类型 "${m.type}" 无效`);
    pendingBatchMaterials.push({ ...m, _index: i + 1, _errors: errors });
  }

  showBatchPreview();
}

// 渲染预览表格
function showBatchPreview() {
  const preview = document.getElementById('batchPreview');
  const summary = document.getElementById('batchSummary');
  const tbody = document.getElementById('batchTableBody');

  const validCount = pendingBatchMaterials.filter(m => m._errors.length === 0).length;
  const errCount = pendingBatchMaterials.filter(m => m._errors.length > 0).length;

  summary.innerHTML = `
    <div class="summary-item">共 <strong>${pendingBatchMaterials.length}</strong> 条</div>
    <div class="summary-item" style="color:#16a34a;">有效 <strong>${validCount}</strong> 条</div>
    ${errCount > 0 ? `<div class="summary-item" style="color:#dc2626;">无效 <strong>${errCount}</strong> 条</div>` : ''}
  `;

  tbody.innerHTML = pendingBatchMaterials.map(m => `
    <tr>
      <td>${m._index}</td>
      <td title="${(m.title || '').replace(/"/g, '&quot;')}">${m.title || '<em style="color:#dc2626;">（空）</em>'}</td>
      <td>${CATEGORY_NAMES[m.category] || m.category || '-'}</td>
      <td>${TYPE_NAMES[m.type] || m.type || '-'}</td>
      <td>${(m.tags || []).slice(0, 3).join('、') || '-'}</td>
      <td class="${m._errors.length ? 'status-err' : 'status-ok'}">${m._errors.length ? m._errors.join('；') : '有效'}</td>
    </tr>
  `).join('');

  // 禁用/启用导入按钮
  document.getElementById('confirmBatchBtn').disabled = validCount === 0;

  preview.style.display = 'block';
}

// 确认导入
async function confirmBatchImport() {
  const validMaterials = pendingBatchMaterials.filter(m => m._errors.length === 0);
  if (!validMaterials.length) return;

  const btn = document.getElementById('confirmBatchBtn');
  btn.disabled = true;
  btn.textContent = '导入中...';

  try {
    const res = await authFetch('/api/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ materials: validMaterials })
    }).then(r => r.json());

    if (res.success) {
      let msg = `成功导入 ${res.imported} 条素材`;
      if (res.skipped > 0) {
        msg += `，跳过 ${res.skipped} 条无效数据`;
      }
      showToast(msg, 'success');
      cancelBatch();
      loadMaterials(); // 刷新素材列表
    } else {
      showToast(res.error || '导入失败', 'error');
    }
  } catch (err) {
    showToast('网络错误，请重试', 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = '确认导入';
  }
}

// 取消批量上传
function cancelBatch() {
  pendingBatchMaterials = [];
  document.getElementById('batchPreview').style.display = 'none';
  document.getElementById('batchFile').value = '';
}

// ========== 数据统计 ==========
async function loadStats() {
  const stats = await authFetch('/api/stats').then(r => r.json());
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
    const stats = await authFetch('/api/stats').then(r => r.json());
    const affectedMats = removedCatIds.reduce((n, cid) => n + (stats.categoryStats[cid] || 0), 0);
    if (affectedMats > 0) {
      if (!confirm(`本次操作将移除 ${removedCatIds.length} 个分类，其中有 ${affectedMats} 条素材会失去分类归属（素材不会被删除）。\n\n确定继续？`)) return;
    }
  }

  const res = await authFetch('/api/categories', {
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

function escapeAttr(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/'/g, '&#39;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ========== 启动 ==========
init();

// ========== AI 素材功能 ==========

function populateAiCategorySelect() {
  const sel = document.getElementById('aiCategory');
  let html = '<option value="">不限分类</option>';
  categories.forEach(c => {
    html += `<option value="${c.id}">${c.name}</option>`;
  });
  sel.innerHTML = html;
}

async function loadAiConfig() {
  try {
    const config = await authFetch('/api/ai/config').then(r => r.json());
    document.getElementById('aiBaseUrl').value = config.baseUrl || '';
    document.getElementById('aiApiKey').value = config.apiKey || '';
    document.getElementById('aiModel').value = config.model || '';
    const statusEl = document.getElementById('aiStatus');
    if (config.enabled) {
      statusEl.textContent = '✅ 已配置';
      statusEl.className = 'ai-status success';
    } else {
      statusEl.textContent = '⚠️ 未配置';
      statusEl.className = 'ai-status';
    }
  } catch (err) {
    console.error('加载 AI 配置失败：', err);
  }
}

async function saveAiConfig() {
  const config = {
    provider: 'openai-compatible',
    baseUrl: document.getElementById('aiBaseUrl').value.trim(),
    apiKey: document.getElementById('aiApiKey').value.trim(),
    model: document.getElementById('aiModel').value.trim()
  };
  try {
    const res = await authFetch('/api/ai/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    }).then(r => r.json());
    if (res.success) {
      alert('配置已保存');
      loadAiConfig();
    } else {
      alert('保存失败：' + (res.error || '未知错误'));
    }
  } catch (err) {
    alert('保存失败：' + err.message);
  }
}

async function testAiConnection() {
  const statusEl = document.getElementById('aiStatus');
  statusEl.textContent = '⏳ 测试中...';
  statusEl.className = 'ai-status';
  try {
    await saveAiConfig();
    const res = await authFetch('/api/ai/test', { method: 'POST' }).then(r => r.json());
    if (res.success) {
      statusEl.textContent = '✅ ' + res.message;
      statusEl.className = 'ai-status success';
    } else {
      statusEl.textContent = '❌ ' + res.error;
      statusEl.className = 'ai-status error';
    }
  } catch (err) {
    statusEl.textContent = '❌ 测试失败：' + err.message;
    statusEl.className = 'ai-status error';
  }
}

async function generateAiMaterials() {
  const topic = document.getElementById('aiTopic').value.trim();
  const category = document.getElementById('aiCategory').value;
  const count = parseInt(document.getElementById('aiCount').value);
  const progressEl = document.getElementById('aiGenProgress');
  const btn = document.getElementById('aiGenBtn');

  if (!topic) { alert('请输入话题'); return; }

  btn.disabled = true;
  btn.textContent = '生成中...';
  progressEl.style.display = 'block';
  progressEl.textContent = `正在生成 ${count} 条素材，请稍候（约需 10-30 秒）...`;
  progressEl.className = 'ai-gen-progress';

  try {
    const res = await authFetch('/api/ai/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic, category, count })
    }).then(r => r.json());

    if (res.success) {
      progressEl.textContent = `生成完成！共 ${res.count} 条素材通过筛选，已加入待审核队列。`;
      progressEl.className = 'ai-gen-progress';
      document.getElementById('aiTopic').value = '';
      loadPendingMaterials();
    } else {
      progressEl.textContent = '生成失败：' + (res.error || '未知错误');
      progressEl.className = 'ai-gen-progress error';
    }
  } catch (err) {
    progressEl.textContent = '请求失败：' + err.message;
    progressEl.className = 'ai-gen-progress error';
  } finally {
    btn.disabled = false;
    btn.textContent = '生成素材';
  }
}

async function loadPendingMaterials() {
  try {
    const res = await authFetch('/api/materials/pending?pageSize=50').then(r => r.json());
    document.getElementById('pendingCount').textContent = res.total;
    const tbody = document.getElementById('pendingTableBody');
    tbody.innerHTML = '';

    res.data.forEach(m => {
      const cat = categories.find(c => c.id === m.category);
      const type = types.find(t => t.id === m.type);
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${escapeHtml(m.title)}</td>
        <td>${cat ? cat.name : '-'}</td>
        <td>${type ? type.name : '-'}</td>
        <td><span class="score-badge medium">AI生成</span></td>
        <td>${escapeHtml(m.source || '')}</td>
        <td>
          <div class="review-actions">
            <button class="btn-approve" onclick="approveMaterial('${escapeAttr(m.id)}')">通过</button>
            <button class="btn-secondary" style="padding:4px 10px;font-size:0.8rem" onclick="editPendingMaterial('${escapeAttr(m.id)}')">编辑</button>
            <button class="btn-reject" onclick="rejectMaterial('${escapeAttr(m.id)}')">拒绝</button>
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error('加载待审核素材失败：', err);
  }
}

async function approveMaterial(id) {
  try {
    const res = await authFetch(`/api/materials/${id}/approve`, { method: 'PUT' }).then(r => r.json());
    if (res.success) {
      loadPendingMaterials();
    } else {
      alert('操作失败');
    }
  } catch (err) {
    alert('操作失败：' + err.message);
  }
}

async function rejectMaterial(id) {
  if (!confirm('确定拒绝此素材？')) return;
  try {
    const res = await authFetch(`/api/materials/${id}/reject`, { method: 'PUT' }).then(r => r.json());
    if (res.success) {
      loadPendingMaterials();
    } else {
      alert('操作失败');
    }
  } catch (err) {
    alert('操作失败：' + err.message);
  }
}

function editPendingMaterial(id) {
  // 跳转到编辑表单，审核通过后保存
  editMaterial(id);
}

// ========== 名著素材挖掘 ==========

let classicsList = [];

// 加载名著建议列表到 datalist
async function loadClassicsList() {
  try {
    classicsList = await fetch('/api/classics').then(r => r.json());
    const datalist = document.getElementById('classicSuggestions');
    datalist.innerHTML = classicsList.map(c =>
      `<option value="${c.title}（${c.era}·${c.author}）">`
    ).join('');
    // 输入时联动主题
    document.getElementById('classicInput').addEventListener('input', updateClassicThemes);
  } catch (err) {
    console.error('加载名著列表失败：', err);
  }
}

function updateClassicThemes() {
  const inputVal = document.getElementById('classicInput').value.trim();
  const themeSel = document.getElementById('classicTheme');
  themeSel.innerHTML = '<option value="">全部主题</option>';

  // 尝试匹配预置名著（按标题模糊匹配）
  const matched = classicsList.find(c => inputVal.includes(c.title) || c.title.includes(inputVal));
  if (!matched || !matched.themes) return;

  matched.themes.forEach(t => {
    themeSel.innerHTML += `<option value="${t}">${t}</option>`;
  });
}

// 解析用户输入，匹配预置名著或构建自定义名著信息
function resolveClassicInput() {
  const inputVal = document.getElementById('classicInput').value.trim();
  if (!inputVal) return null;

  // 先尝试精确/模糊匹配预置名著
  const matched = classicsList.find(c => inputVal.includes(c.title) || c.title.includes(inputVal));
  if (matched) return { type: 'preset', classic: matched };

  // 自定义输入：提取用户输入的书名
  // 支持格式："书名"、"书名·作者"、"书名（作者）" 等
  const title = inputVal.replace(/[（()·\-\s].*$/, '').replace(/《》/g, '').trim();
  return { type: 'custom', classic: { id: '', title: title || inputVal, author: '', era: '', description: '', themes: [] } };
}

async function generateClassicsMaterials() {
  const resolved = resolveClassicInput();
  if (!resolved) { alert('请输入或选择名著名称'); return; }

  const theme = document.getElementById('classicTheme').value;
  const count = parseInt(document.getElementById('classicCount').value);
  const progressEl = document.getElementById('classicGenProgress');
  const resultEl = document.getElementById('classicGenResult');
  const btn = document.getElementById('classicGenBtn');

  const classic = resolved.classic;
  const themeHint = theme ? `「${theme}」角度` : '全部主题角度';

  btn.disabled = true;
  btn.textContent = '挖掘中...';
  progressEl.style.display = 'block';
  progressEl.textContent = `正在从《${classic.title}》中挖掘 ${themeHint} 的素材，请稍候...`;
  progressEl.className = 'ai-gen-progress';
  resultEl.style.display = 'none';

  try {
    const body = resolved.type === 'preset'
      ? { classicId: classic.id, theme, count }
      : { customTitle: classic.title, theme, count };

    const res = await authFetch('/api/ai/generate-classics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }).then(r => r.json());

    if (res.success) {
      progressEl.textContent = `挖掘完成！从《${classic.title}》中找到 ${res.count} 条素材，已加入待审核队列。`;

      if (res.materials && res.materials.length > 0) {
        resultEl.style.display = 'block';
        resultEl.innerHTML = `
          <div style="margin-bottom:8px;font-weight:600;">生成预览：</div>
          ${res.materials.map(m => `
            <div style="background:#f8f8f0;border-left:3px solid #b5493b;padding:8px 12px;margin-bottom:8px;border-radius:0 4px 4px 0;">
              <div style="font-weight:600;margin-bottom:4px;">${escapeHtml(m.title)}</div>
              <div style="font-size:0.85rem;color:#666;line-height:1.5;">${escapeHtml((m.content || '').substring(0, 120))}...</div>
              <div style="margin-top:4px;">${(m.tags || []).map(t => `<span style="display:inline-block;background:#e8e4db;padding:2px 8px;border-radius:10px;font-size:0.75rem;margin-right:4px;">${escapeHtml(t)}</span>`).join('')}</div>
            </div>
          `).join('')}
        `;
      }

      loadPendingMaterials();
    } else {
      progressEl.textContent = '挖掘失败：' + (res.error || '未知错误');
      progressEl.className = 'ai-gen-progress error';
    }
  } catch (err) {
    progressEl.textContent = '请求失败：' + err.message;
    progressEl.className = 'ai-gen-progress error';
  } finally {
    btn.disabled = false;
    btn.textContent = '挖掘素材';
  }
}

// 初始化时加载名著列表
loadClassicsList();

// ========== 教程管理 ==========

let tutorialsData = [];
let currentEditTutorialId = null;

// 填充教程分类筛选下拉
function populateTutorialCategoryFilter() {
  const sel = document.getElementById('tutorialCategoryFilter');
  if (!sel) return;
  sel.innerHTML = '<option value="">全部分类</option>';
  categories.forEach(c => {
    sel.innerHTML += `<option value="${c.id}">${c.icon} ${c.name}</option>`;
  });
}

// 加载教程列表
async function loadTutorials() {
  const catFilter = document.getElementById('tutorialCategoryFilter')?.value || '';
  try {
    const params = catFilter ? `?category=${catFilter}` : '';
    const res = await authFetch(`/api/tutorials${params}`).then(r => r.json());
    tutorialsData = res;
    renderTutorialList();
  } catch (err) {
    console.error('加载教程失败:', err);
    showToast('加载教程失败', 'error');
  }
}

// 渲染教程列表
function renderTutorialList() {
  const container = document.getElementById('tutorialList');
  if (!container) return;

  if (!tutorialsData.length) {
    container.innerHTML = '<div class="tutorial-empty">暂无教程，点击上方按钮新建</div>';
    return;
  }

  container.innerHTML = tutorialsData.map(t => {
    const cat = categories.find(c => c.id === t.categoryId);
    const catName = cat ? `${cat.icon} ${cat.name}` : '未分类';
    const preview = (t.propositionAnalysis || '').substring(0, 80);
    return `
      <div class="tutorial-card" onclick="openTutorialEditModal('${t.id}')">
        <div class="tutorial-card-header">
          <span class="tutorial-card-cat">${catName}</span>
          <span class="tutorial-card-date">${t.createdAt?.split('T')[0] || ''}</span>
        </div>
        <div class="tutorial-card-title">${escapeHtml(t.title)}</div>
        <div class="tutorial-card-preview">${escapeHtml(preview)}...</div>
        <div class="tutorial-card-stats">
          <span>出题方向 ${t.directionsCount || 0}</span>
          <span>出题示例 ${t.questionsCount || 0}</span>
          <span>写作示例 ${t.examplesCount || 0}</span>
          <span>写作锦囊 ${t.tipsCount || 0}</span>
        </div>
      </div>
    `;
  }).join('');
}

// 打开教程编辑弹窗
async function openTutorialEditModal(id) {
  currentEditTutorialId = id;
  const modal = document.getElementById('tutorialEditModal');
  const titleEl = document.getElementById('tutorialModalTitle');
  const deleteBtn = document.getElementById('tutorialDeleteBtn');

  if (id) {
    titleEl.textContent = '编辑教程';
    deleteBtn.style.display = 'inline-block';
    // 加载教程详情
    try {
      const tutorial = await authFetch(`/api/tutorials/${id}`).then(r => r.json());
      renderTutorialEditForm(tutorial);
    } catch (err) {
      showToast('加载教程详情失败', 'error');
      return;
    }
  } else {
    titleEl.textContent = '新建教程';
    deleteBtn.style.display = 'none';
    renderTutorialEditForm(null);
  }

  modal.classList.add('active');
}

// 关闭教程编辑弹窗
function closeTutorialEditModal() {
  document.getElementById('tutorialEditModal').classList.remove('active');
  currentEditTutorialId = null;
}

// 渲染教程编辑表单
function renderTutorialEditForm(tutorial) {
  const container = document.getElementById('tutorialModalBody');
  const isNew = !tutorial;

  // 默认数据结构
  const data = tutorial || {
    categoryId: '',
    title: '',
    propositionAnalysis: '',
    philosophyGuide: '',
    directions: [],
    questions: [],
    examples: [],
    tips: [],
    materialIds: []
  };

  container.innerHTML = `
    <div class="tutorial-form">
      <!-- 基本信息 -->
      <div class="form-row">
        <div class="form-group" style="flex:1">
          <label>关联分类 *</label>
          <select id="tutCategoryId" required>
            <option value="">请选择分类</option>
            ${categories.map(c => `<option value="${c.id}" ${data.categoryId === c.id ? 'selected' : ''}>${c.icon} ${c.name}</option>`).join('')}
          </select>
        </div>
        <div class="form-group" style="flex:2">
          <label>教程标题 *</label>
          <input type="text" id="tutTitle" value="${escapeHtml(data.title)}" placeholder="如：青年成长类作文写作指南" required>
        </div>
      </div>

      <!-- 命题分析 -->
      <div class="form-group">
        <label>命题分析</label>
        <textarea id="tutProposition" rows="4" placeholder="分析该分类命题的特点、常见角度...">${escapeHtml(data.propositionAnalysis || '')}</textarea>
      </div>

      <!-- 哲学素材运用 -->
      <div class="form-group">
        <label>哲学素材运用指南</label>
        <textarea id="tutPhilosophy" rows="4" placeholder="如何运用哲学思辨素材...">${escapeHtml(data.philosophyGuide || '')}</textarea>
      </div>

      <!-- 出题方向 -->
      <div class="form-section">
        <div class="form-section-header">
          <label>出题方向</label>
          <button type="button" class="btn-add-item" onclick="addTutorialDirection()">+ 添加方向</button>
        </div>
        <div id="tutDirectionsContainer" class="items-container">
          ${(data.directions || []).map((d, i) => renderDirectionItem(d, i)).join('')}
        </div>
      </div>

      <!-- 出题示例 -->
      <div class="form-section">
        <div class="form-section-header">
          <label>出题示例</label>
          <button type="button" class="btn-add-item" onclick="addTutorialQuestion()">+ 添加示例</button>
        </div>
        <div id="tutQuestionsContainer" class="items-container">
          ${(data.questions || []).map((q, i) => renderQuestionItem(q, i)).join('')}
        </div>
      </div>

      <!-- 写作示例 -->
      <div class="form-section">
        <div class="form-section-header">
          <label>写作示例</label>
          <button type="button" class="btn-add-item" onclick="addTutorialExample()">+ 添加示例</button>
        </div>
        <div id="tutExamplesContainer" class="items-container">
          ${(data.examples || []).map((e, i) => renderExampleItem(e, i)).join('')}
        </div>
      </div>

      <!-- 写作锦囊 -->
      <div class="form-section">
        <div class="form-section-header">
          <label>写作锦囊</label>
          <button type="button" class="btn-add-item" onclick="addTutorialTip()">+ 添加锦囊</button>
        </div>
        <div id="tutTipsContainer" class="items-container tips-container">
          ${(data.tips || []).map((t, i) => renderTipItem(t, i)).join('')}
        </div>
      </div>

      <!-- 推荐素材 -->
      <div class="form-section">
        <div class="form-section-header">
          <label>推荐素材（最多6条）</label>
          <button type="button" class="btn-add-item" onclick="openMaterialPicker()">+ 选择素材</button>
        </div>
        <div id="tutMaterialsContainer" class="materials-picker-list">
          ${(data.materials || []).map((m, i) => `
            <div class="picked-material" data-id="${m.id}">
              <span class="picked-material-title">${escapeHtml(m.title)}</span>
              <button type="button" class="btn-remove-item" onclick="removePickedMaterial(${i})">✕</button>
            </div>
          `).join('')}
        </div>
        <input type="hidden" id="tutMaterialIds" value="${(data.materialIds || []).join(',')}">
      </div>
    </div>
  `;
}

// 出题方向单项模板
function renderDirectionItem(d, i) {
  return `
    <div class="item-card direction-item" data-index="${i}">
      <div class="item-card-header">
        <span>方向 ${i + 1}</span>
        <button type="button" class="btn-remove-item" onclick="removeTutorialDirection(${i})">删除</button>
      </div>
      <div class="item-card-body">
        <input type="text" class="direction-title" placeholder="方向标题（如：梦想与坚持）" value="${escapeHtml(d.title || '')}">
        <textarea class="direction-desc" placeholder="方向描述..." rows="2">${escapeHtml(d.description || '')}</textarea>
      </div>
    </div>
  `;
}

// 出题示例单项模板
function renderQuestionItem(q, i) {
  return `
    <div class="item-card question-item" data-index="${i}">
      <div class="item-card-header">
        <span>示例 ${i + 1}</span>
        <button type="button" class="btn-remove-item" onclick="removeTutorialQuestion(${i})">删除</button>
      </div>
      <div class="item-card-body">
        <div class="form-row compact">
          <input type="text" class="q-short-title" placeholder="简称（标签显示）" value="${escapeHtml(q.short_title || '')}">
          <input type="text" class="q-title" placeholder="完整标题" value="${escapeHtml(q.title || '')}" style="flex:2">
        </div>
        <textarea class="q-text" placeholder="题目内容..." rows="3">${escapeHtml(q.question_text || '')}</textarea>
        <textarea class="q-note" placeholder="备注/提示..." rows="2">${escapeHtml(q.note || '')}</textarea>
        <textarea class="q-approach" placeholder="写作思路..." rows="3">${escapeHtml(q.writing_approach || '')}</textarea>
      </div>
    </div>
  `;
}

// 写作示例单项模板
function renderExampleItem(e, i) {
  return `
    <div class="item-card example-item" data-index="${i}">
      <div class="item-card-header">
        <span>示例 ${i + 1}</span>
        <button type="button" class="btn-remove-item" onclick="removeTutorialExample(${i})">删除</button>
      </div>
      <div class="item-card-body">
        <div class="form-row compact">
          <input type="text" class="e-short-title" placeholder="简称" value="${escapeHtml(e.short_title || '')}">
          <input type="text" class="e-title" placeholder="完整标题" value="${escapeHtml(e.title || '')}" style="flex:2">
        </div>
        <textarea class="e-text" placeholder="示例正文..." rows="4">${escapeHtml(e.example_text || '')}</textarea>
        <textarea class="e-highlight" placeholder="亮点/精彩句段..." rows="2">${escapeHtml(e.highlight || '')}</textarea>
        <textarea class="e-analysis" placeholder="结构解析..." rows="2">${escapeHtml(e.analysis || '')}</textarea>
      </div>
    </div>
  `;
}

// 写作锦囊单项模板
function renderTipItem(t, i) {
  return `
    <div class="item-card tip-item" data-index="${i}">
      <div class="item-card-header">
        <span>锦囊 ${i + 1}</span>
        <button type="button" class="btn-remove-item" onclick="removeTutorialTip(${i})">删除</button>
      </div>
      <div class="item-card-body compact">
        <div class="form-row compact">
          <input type="text" class="tip-icon" placeholder="图标" value="${escapeHtml(t.icon || '💡')}" style="width:60px">
          <input type="text" class="tip-title" placeholder="锦囊标题" value="${escapeHtml(t.title || '')}" style="flex:2">
        </div>
        <textarea class="tip-content" placeholder="锦囊内容..." rows="3">${escapeHtml(t.content || '')}</textarea>
      </div>
    </div>
  `;
}

// 添加/删除出题方向
function addTutorialDirection() {
  const container = document.getElementById('tutDirectionsContainer');
  const index = container.children.length;
  const div = document.createElement('div');
  div.innerHTML = renderDirectionItem({}, index);
  container.appendChild(div.firstElementChild);
}

function removeTutorialDirection(index) {
  const container = document.getElementById('tutDirectionsContainer');
  const item = container.querySelector(`[data-index="${index}"]`);
  if (item) item.remove();
  // 重新编号
  container.querySelectorAll('.direction-item').forEach((el, i) => {
    el.querySelector('.item-card-header span').textContent = `方向 ${i + 1}`;
    el.dataset.index = i;
  });
}

// 添加/删除出题示例
function addTutorialQuestion() {
  const container = document.getElementById('tutQuestionsContainer');
  const index = container.children.length;
  const div = document.createElement('div');
  div.innerHTML = renderQuestionItem({}, index);
  container.appendChild(div.firstElementChild);
}

function removeTutorialQuestion(index) {
  const container = document.getElementById('tutQuestionsContainer');
  const item = container.querySelector(`[data-index="${index}"]`);
  if (item) item.remove();
  container.querySelectorAll('.question-item').forEach((el, i) => {
    el.querySelector('.item-card-header span').textContent = `示例 ${i + 1}`;
    el.dataset.index = i;
  });
}

// 添加/删除写作示例
function addTutorialExample() {
  const container = document.getElementById('tutExamplesContainer');
  const index = container.children.length;
  const div = document.createElement('div');
  div.innerHTML = renderExampleItem({}, index);
  container.appendChild(div.firstElementChild);
}

function removeTutorialExample(index) {
  const container = document.getElementById('tutExamplesContainer');
  const item = container.querySelector(`[data-index="${index}"]`);
  if (item) item.remove();
  container.querySelectorAll('.example-item').forEach((el, i) => {
    el.querySelector('.item-card-header span').textContent = `示例 ${i + 1}`;
    el.dataset.index = i;
  });
}

// 添加/删除写作锦囊
function addTutorialTip() {
  const container = document.getElementById('tutTipsContainer');
  const index = container.children.length;
  const div = document.createElement('div');
  div.innerHTML = renderTipItem({}, index);
  container.appendChild(div.firstElementChild);
}

function removeTutorialTip(index) {
  const container = document.getElementById('tutTipsContainer');
  const item = container.querySelector(`[data-index="${index}"]`);
  if (item) item.remove();
  container.querySelectorAll('.tip-item').forEach((el, i) => {
    el.querySelector('.item-card-header span').textContent = `锦囊 ${i + 1}`;
    el.dataset.index = i;
  });
}

// 素材选择器
let materialPickerData = [];
let pickedMaterialIds = [];

async function openMaterialPicker() {
  // 加载素材列表
  const catId = document.getElementById('tutCategoryId')?.value || '';
  const params = catId ? `?category=${catId}&pageSize=50` : '?pageSize=50';
  try {
    const res = await authFetch(`/api/materials${params}`).then(r => r.json());
    materialPickerData = res.data || [];
    showMaterialPickerModal();
  } catch (err) {
    showToast('加载素材失败', 'error');
  }
}

function showMaterialPickerModal() {
  // 已选素材
  pickedMaterialIds = (document.getElementById('tutMaterialIds')?.value || '').split(',').filter(Boolean);

  // 创建临时选择器弹窗
  let picker = document.getElementById('materialPickerModal');
  if (!picker) {
    picker = document.createElement('div');
    picker.id = 'materialPickerModal';
    picker.className = 'material-picker-overlay';
    picker.onclick = (e) => { if (e.target === picker) closeMaterialPicker(); };
    picker.innerHTML = `
      <div class="material-picker-modal">
        <div class="material-picker-header">
          <h4>选择推荐素材（最多6条）</h4>
          <button onclick="closeMaterialPicker()">×</button>
        </div>
        <div class="material-picker-search">
          <input type="text" id="materialPickerSearch" placeholder="搜索素材..." oninput="filterMaterialPicker()">
        </div>
        <div class="material-picker-list" id="materialPickerList"></div>
        <div class="material-picker-footer">
          <button class="btn-primary" onclick="confirmMaterialPicker()">确认选择</button>
          <button class="btn-secondary" onclick="closeMaterialPicker()">取消</button>
        </div>
      </div>
    `;
    document.body.appendChild(picker);
  }

  renderMaterialPickerList();
  picker.classList.add('active');
}

function filterMaterialPicker() {
  const kw = (document.getElementById('materialPickerSearch')?.value || '').toLowerCase();
  renderMaterialPickerList(kw);
}

function renderMaterialPickerList(kw = '') {
  const list = document.getElementById('materialPickerList');
  const filtered = kw ? materialPickerData.filter(m => m.title.toLowerCase().includes(kw)) : materialPickerData;

  list.innerHTML = filtered.slice(0, 30).map(m => {
    const isSelected = pickedMaterialIds.includes(m.id);
    return `
      <div class="picker-material-item ${isSelected ? 'selected' : ''}" onclick="togglePickMaterial('${m.id}')">
        <div class="picker-material-check">${isSelected ? '✓' : ''}</div>
        <div class="picker-material-info">
          <div class="picker-material-title">${escapeHtml(m.title)}</div>
          <div class="picker-material-excerpt">${escapeHtml((m.content || '').substring(0, 50))}...</div>
        </div>
      </div>
    `;
  }).join('');
}

function togglePickMaterial(id) {
  const idx = pickedMaterialIds.indexOf(id);
  if (idx >= 0) {
    pickedMaterialIds.splice(idx, 1);
  } else {
    if (pickedMaterialIds.length >= 6) {
      showToast('最多选择6条素材', 'error');
      return;
    }
    pickedMaterialIds.push(id);
  }
  renderMaterialPickerList(document.getElementById('materialPickerSearch')?.value || '');
}

function confirmMaterialPicker() {
  // 更新已选素材显示
  const container = document.getElementById('tutMaterialsContainer');
  const idsInput = document.getElementById('tutMaterialIds');

  idsInput.value = pickedMaterialIds.join(',');

  // 显示选中的素材
  container.innerHTML = pickedMaterialIds.map(id => {
    const m = materialPickerData.find(x => x.id === id);
    if (!m) return '';
    return `
      <div class="picked-material" data-id="${id}">
        <span class="picked-material-title">${escapeHtml(m.title)}</span>
        <button type="button" class="btn-remove-item" onclick="removePickedMaterialById('${id}')">✕</button>
      </div>
    `;
  }).join('');

  closeMaterialPicker();
}

function removePickedMaterial(index) {
  const container = document.getElementById('tutMaterialsContainer');
  const idsInput = document.getElementById('tutMaterialIds');
  const ids = idsInput.value.split(',').filter(Boolean);
  ids.splice(index, 1);
  idsInput.value = ids.join(',');

  // 重新渲染
  container.querySelectorAll('.picked-material').forEach((el, i) => {
    if (i === index) el.remove();
  });
}

function removePickedMaterialById(id) {
  const idsInput = document.getElementById('tutMaterialIds');
  const ids = idsInput.value.split(',').filter(Boolean);
  const idx = ids.indexOf(id);
  if (idx >= 0) {
    ids.splice(idx, 1);
    idsInput.value = ids.join(',');
  }
  const container = document.getElementById('tutMaterialsContainer');
  const item = container.querySelector(`[data-id="${id}"]`);
  if (item) item.remove();
}

function closeMaterialPicker() {
  const picker = document.getElementById('materialPickerModal');
  if (picker) picker.classList.remove('active');
}

// 收集教程表单数据
function collectTutorialFormData() {
  const categoryId = document.getElementById('tutCategoryId')?.value || '';
  const title = document.getElementById('tutTitle')?.value.trim() || '';
  const propositionAnalysis = document.getElementById('tutProposition')?.value.trim() || '';
  const philosophyGuide = document.getElementById('tutPhilosophy')?.value.trim() || '';

  if (!categoryId || !title) {
    showToast('请填写分类和标题', 'error');
    return null;
  }

  // 收集出题方向
  const directions = [];
  document.querySelectorAll('.direction-item').forEach(el => {
    directions.push({
      title: el.querySelector('.direction-title')?.value.trim() || '',
      description: el.querySelector('.direction-desc')?.value.trim() || ''
    });
  });

  // 收集出题示例
  const questions = [];
  document.querySelectorAll('.question-item').forEach(el => {
    questions.push({
      shortTitle: el.querySelector('.q-short-title')?.value.trim() || '',
      title: el.querySelector('.q-title')?.value.trim() || '',
      text: el.querySelector('.q-text')?.value.trim() || '',
      note: el.querySelector('.q-note')?.value.trim() || '',
      approach: el.querySelector('.q-approach')?.value.trim() || ''
    });
  });

  // 收集写作示例
  const examples = [];
  document.querySelectorAll('.example-item').forEach(el => {
    examples.push({
      shortTitle: el.querySelector('.e-short-title')?.value.trim() || '',
      title: el.querySelector('.e-title')?.value.trim() || '',
      text: el.querySelector('.e-text')?.value.trim() || '',
      highlight: el.querySelector('.e-highlight')?.value.trim() || '',
      analysis: el.querySelector('.e-analysis')?.value.trim() || ''
    });
  });

  // 收集写作锦囊
  const tips = [];
  document.querySelectorAll('.tip-item').forEach(el => {
    tips.push({
      icon: el.querySelector('.tip-icon')?.value.trim() || '💡',
      title: el.querySelector('.tip-title')?.value.trim() || '',
      content: el.querySelector('.tip-content')?.value.trim() || ''
    });
  });

  // 收集推荐素材
  const materialIds = (document.getElementById('tutMaterialIds')?.value || '').split(',').filter(Boolean);

  return {
    categoryId,
    title,
    propositionAnalysis,
    philosophyGuide,
    directions,
    questions,
    examples,
    tips,
    materialIds
  };
}

// 保存教程
async function saveTutorial() {
  const data = collectTutorialFormData();
  if (!data) return;

  try {
    let res;
    if (currentEditTutorialId) {
      // 更新
      res = await authFetch(`/api/tutorials/${currentEditTutorialId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      }).then(r => r.json());
    } else {
      // 新建
      res = await authFetch('/api/tutorials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      }).then(r => r.json());
    }

    if (res.success) {
      showToast(currentEditTutorialId ? '教程已更新' : '教程已创建', 'success');
      closeTutorialEditModal();
      loadTutorials();
    } else {
      showToast(res.error || '保存失败', 'error');
    }
  } catch (err) {
    showToast('保存失败: ' + err.message, 'error');
  }
}

// 删除教程
async function deleteTutorial() {
  if (!currentEditTutorialId) return;
  if (!confirm('确定要删除此教程吗？')) return;

  try {
    const res = await authFetch(`/api/tutorials/${currentEditTutorialId}`, {
      method: 'DELETE'
    }).then(r => r.json());

    if (res.success) {
      showToast('教程已删除', 'success');
      closeTutorialEditModal();
      loadTutorials();
    } else {
      showToast(res.error || '删除失败', 'error');
    }
  } catch (err) {
    showToast('删除失败: ' + err.message, 'error');
  }
}
