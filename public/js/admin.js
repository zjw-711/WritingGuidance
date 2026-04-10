// ========== 全局状态 ==========
let categories = [];
let types = [];
let formTags = [];
let formTopics = [];
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
    applicableTopics: [...formTopics]
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
  renderTagItems('tagInputWrapper', 'tagInput', formTags);
  renderTagItems('topicInputWrapper', 'topicInput', formTopics);

  document.getElementById('formTitle').textContent = '编辑素材';
  showSection('add');
}

function resetForm() {
  document.getElementById('materialForm').reset();
  document.getElementById('editId').value = '';
  document.getElementById('formTitle').textContent = '添加素材';
  formTags = [];
  formTopics = [];
  renderTagItems('tagInputWrapper', 'tagInput', formTags);
  renderTagItems('topicInputWrapper', 'topicInput', formTopics);
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

// ========== 工具函数 ==========
function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ========== 启动 ==========
init();
