// ========== 全局状态 ==========
let years = [];
let regions = [];
let currentQuestion = null;
let currentPage = 1;
const pageSize = 12;
let filters = { year: '', region: '', regionType: '', keyword: '' };
let isLoading = false;

// ========== 工具函数 ==========
function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function showToast(msg) {
  let toast = document.getElementById('examToast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'examToast';
    toast.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%) translateY(-20px);padding:12px 28px;border-radius:8px;color:white;font-size:0.95rem;box-shadow:0 4px 12px rgba(0,0,0,0.15);z-index:300;opacity:0;transition:all 0.3s;pointer-events:none;background:#ef4444;';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.classList.add('show');
  toast.style.opacity = '1';
  toast.style.transform = 'translateX(-50%) translateY(0)';
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(-50%) translateY(-20px)';
  }, 3000);
}

// ========== 初始化 ==========
async function init() {
  try {
    const [yearsRes, regionsRes] = await Promise.all([
      fetch('/api/exam-meta/years').then(r => { if (!r.ok) throw new Error('获取年份失败'); return r.json(); }),
      fetch('/api/exam-meta/regions').then(r => { if (!r.ok) throw new Error('获取地区失败'); return r.json(); })
    ]);
    years = yearsRes;
    regions = regionsRes;

    renderYearTags();
    renderRegionFilter();
    loadQuestions();

    window.addEventListener('scroll', () => {
      document.getElementById('btnTop').classList.toggle('visible', window.scrollY > 400);
    });
  } catch (err) {
    showToast('页面初始化失败，请刷新重试');
    console.error('init error:', err);
  }
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
  if (isLoading) return;
  isLoading = true;

  // 显示加载状态
  const grid = document.getElementById('examGrid');
  if (currentPage === 1) {
    grid.innerHTML = '<div style="text-align:center;padding:60px;color:var(--text-light);">加载中...</div>';
  }

  try {
    const params = new URLSearchParams();
    if (filters.year) params.set('year', filters.year);
    if (filters.region) params.set('region', filters.region);
    if (filters.regionType) params.set('regionType', filters.regionType);
    if (filters.keyword) params.set('keyword', filters.keyword);
    params.set('page', currentPage);
    params.set('pageSize', pageSize);

    const res = await fetch('/api/exam-questions?' + params);
    if (!res.ok) throw new Error('请求失败');
    const data = await res.json();

    document.getElementById('examTotal').textContent = data.total;
    renderQuestions(data.data);

    document.getElementById('examLoadMore').style.display =
      (currentPage * pageSize < data.total) ? 'block' : 'none';
    document.getElementById('examEmpty').style.display =
      data.data.length === 0 ? 'block' : 'none';
  } catch (err) {
    showToast('加载真题失败，请重试');
    console.error('loadQuestions error:', err);
    if (currentPage === 1) grid.innerHTML = '';
  } finally {
    isLoading = false;
  }
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
  if (isLoading) return;
  currentPage++;
  loadQuestions();
}

// ========== 详情弹窗 ==========
async function openDetail(id) {
  const body = document.getElementById('examModalBody');
  body.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-light);">加载中...</div>';
  document.getElementById('examModalOverlay').classList.add('active');
  document.body.style.overflow = 'hidden';

  try {
    const res = await fetch('/api/exam-questions/' + id);
    if (!res.ok) throw new Error('获取详情失败');
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
          '<div class="qa-material-item" onclick="window.open(\'/?search=' + encodeURIComponent(m.title) + '\',\'_blank\')">' +
            '<span class="qa-material-dot"></span>' +
            '<span>' + escapeHtml(m.title) + '</span>' +
          '</div>'
        ).join('') + '</div>';
    }

    body.innerHTML = html;
  } catch (err) {
    body.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-light);">加载失败，请关闭重试</div>';
    console.error('openDetail error:', err);
  }
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
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => {
      const btn = document.querySelector('.btn-copy');
      btn.textContent = '✅ 已复制';
      setTimeout(() => { btn.textContent = '📋 复制题目'; }, 2000);
    }).catch(() => fallbackCopy(text));
  } else {
    fallbackCopy(text);
  }
}

function fallbackCopy(text) {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  try {
    document.execCommand('copy');
    const btn = document.querySelector('.btn-copy');
    btn.textContent = '✅ 已复制';
    setTimeout(() => { btn.textContent = '📋 复制题目'; }, 2000);
  } catch (e) {
    showToast('复制失败，请手动复制');
  }
  document.body.removeChild(textarea);
}

// ========== 启动 ==========
init();
