// ========== 全局状态 ==========
let years = [];
let regions = [];
let currentQuestion = null;
let currentPage = 1;
const pageSize = 12;
let filters = { year: '', region: '', regionType: '', keyword: '' };

// ========== 工具函数 ==========
function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ========== 初始化 ==========
async function init() {
  const [yearsRes, regionsRes] = await Promise.all([
    fetch('/api/exam-meta/years').then(r => r.json()),
    fetch('/api/exam-meta/regions').then(r => r.json())
  ]);
  years = yearsRes;
  regions = regionsRes;

  renderYearTags();
  renderRegionFilter();
  loadQuestions();

  window.addEventListener('scroll', () => {
    document.getElementById('btnTop').classList.toggle('visible', window.scrollY > 400);
  });
}

// ========== 年份标签 ==========
function renderYearTags() {
  const container = document.getElementById('yearTags');
  let html = '<button class="year-tag active" onclick="selectYear(\'\',this)">全部</button>';
  years.forEach(y => {
    html += '<button class="year-tag" onclick="selectYear(' + y + ',this)">' + y + '</button>';
  });
  container.innerHTML = html;
}

function selectYear(year, btn) {
  document.querySelectorAll('.year-tag').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  filters.year = year;
  currentPage = 1;
  loadQuestions();
}

// ========== 地区下拉 ==========
function renderRegionFilter() {
  const select = document.getElementById('regionFilter');
  regions.forEach(r => {
    const opt = document.createElement('option');
    opt.value = r;
    opt.textContent = r;
    select.appendChild(opt);
  });
}

// ========== 筛选 ==========
function applyFilters() {
  filters.region = document.getElementById('regionFilter').value;
  filters.regionType = document.getElementById('regionTypeFilter').value;
  filters.keyword = document.getElementById('examSearch').value.trim();
  currentPage = 1;
  loadQuestions();
}

// ========== 加载题目 ==========
async function loadQuestions() {
  const params = new URLSearchParams();
  if (filters.year) params.set('year', filters.year);
  if (filters.region) params.set('region', filters.region);
  if (filters.regionType) params.set('regionType', filters.regionType);
  if (filters.keyword) params.set('keyword', filters.keyword);
  params.set('page', currentPage);
  params.set('pageSize', pageSize);

  const res = await fetch('/api/exam-questions?' + params).then(r => r.json());
  document.getElementById('examTotal').textContent = res.total;
  renderQuestions(res.data);

  document.getElementById('examLoadMore').style.display =
    (currentPage * pageSize < res.total) ? 'block' : 'none';
  document.getElementById('examEmpty').style.display =
    res.data.length === 0 ? 'block' : 'none';
}

function renderQuestions(questions) {
  const grid = document.getElementById('examGrid');
  if (currentPage === 1) grid.innerHTML = '';

  questions.forEach(q => {
    const card = document.createElement('div');
    card.className = 'exam-card';
    card.onclick = () => openDetail(q.id);
    card.innerHTML =
      '<div class="exam-card-header">' +
        '<span class="exam-card-year">' + q.year + '</span>' +
        '<span class="exam-card-region">' + escapeHtml(q.region) + '</span>' +
      '</div>' +
      '<div class="exam-card-content">' + escapeHtml(q.content) + '</div>' +
      '<div class="exam-card-footer">' +
        '<div class="exam-card-keywords">' +
          (q.keywords || []).map(k => '<span class="card-tag">' + escapeHtml(k) + '</span>').join('') +
        '</div>' +
        '<span class="exam-card-arrow">查看详情 ›</span>' +
      '</div>';
    grid.appendChild(card);
  });
}

function loadMore() {
  currentPage++;
  loadQuestions();
}

// ========== 详情弹窗 ==========
async function openDetail(id) {
  const res = await fetch('/api/exam-questions/' + id);
  const q = await res.json();
  currentQuestion = q;

  let html =
    '<div class="detail-badges">' +
      '<span class="badge-year">' + q.year + '年</span>' +
      '<span class="badge-region">' + escapeHtml(q.region) + '</span>' +
    '</div>' +
    '<div class="detail-content">' + escapeHtml(q.content) + '</div>';

  if (q.requirement) {
    html += '<div class="exam-requirement">📝 要求：' + escapeHtml(q.requirement) + '</div>';
  }

  if (q.keywords && q.keywords.length) {
    html += '<div class="detail-label">🏷️ 主题关键词</div>' +
      '<div class="tag-list">' +
        q.keywords.map(k => '<span class="tag-item">' + escapeHtml(k) + '</span>').join('') +
      '</div>';
  }

  if (q.angles && q.angles.length) {
    html += '<div class="exam-section">' +
      '<div class="detail-label">💡 写作角度</div>' +
      '<ul class="exam-angles">' +
        q.angles.map(a => '<li>' + escapeHtml(a) + '</li>').join('') +
      '</ul></div>';
  }

  if (q.analysis) {
    html += '<div class="exam-section">' +
      '<div class="detail-label">📊 命题分析</div>' +
      '<div class="exam-analysis">' + escapeHtml(q.analysis) + '</div></div>';
  }

  if (q.linkedMaterials && q.linkedMaterials.length) {
    html += '<div class="exam-section">' +
      '<div class="detail-label">📎 推荐素材</div>' +
      q.linkedMaterials.map(m =>
        '<div class="qa-material-item" onclick="window.open(\'/\',\'_blank\')">' +
          '<span class="qa-material-dot"></span>' +
          '<span>' + escapeHtml(m.title) + '</span>' +
        '</div>'
      ).join('') + '</div>';
  }

  document.getElementById('examModalBody').innerHTML = html;
  document.getElementById('examModalOverlay').classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeExamModal(e) {
  if (e.target === document.getElementById('examModalOverlay')) {
    closeExamModalDirect();
  }
}

function closeExamModalDirect() {
  document.getElementById('examModalOverlay').classList.remove('active');
  document.body.style.overflow = '';
}

// ESC 关闭弹窗
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeExamModalDirect();
});

// ========== 复制题目 ==========
function copyExamQuestion() {
  if (!currentQuestion) return;
  const text = currentQuestion.year + '年 ' + currentQuestion.region + '\n\n' +
    currentQuestion.content + '\n\n要求：' + (currentQuestion.requirement || '');
  navigator.clipboard.writeText(text).then(() => {
    const btn = document.querySelector('.btn-copy');
    btn.textContent = '✅ 已复制';
    setTimeout(() => { btn.textContent = '📋 复制题目'; }, 2000);
  }).catch(() => {
    // 降级方案
    const textarea = document.createElement('textarea');
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    const btn = document.querySelector('.btn-copy');
    btn.textContent = '✅ 已复制';
    setTimeout(() => { btn.textContent = '📋 复制题目'; }, 2000);
  });
}

// ========== 启动 ==========
init();
