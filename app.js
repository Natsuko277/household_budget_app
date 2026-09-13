/* ==========================================================
   家計ノート app.js
   データはすべてブラウザの localStorage に保存されます。
   ========================================================== */

const STORAGE_KEY = 'kakeibo-data-v1';

const DEFAULT_CATEGORIES = [
  { id: 'c-food', name: '食費', type: 'expense' },
  { id: 'c-transport', name: '交通費', type: 'expense' },
  { id: 'c-home', name: '住居費', type: 'expense' },
  { id: 'c-daily', name: '日用品', type: 'expense' },
  { id: 'c-fun', name: '娯楽費', type: 'expense' },
  { id: 'c-medical', name: '医療費', type: 'expense' },
  { id: 'c-other-ex', name: 'その他', type: 'expense' },
  { id: 'c-salary', name: '給料', type: 'income' },
  { id: 'c-allowance', name: 'お小遣い', type: 'income' },
  { id: 'c-other-in', name: 'その他', type: 'income' },
];

const CATEGORY_COLORS = [
  '#B5482A', '#4B6E4E', '#C9A15C', '#6E5A8C',
  '#3F7C8A', '#B5763C', '#8C5A6E', '#5C7A3F',
  '#A24E6E', '#4A6E8C',
];

function loadData() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    const initial = { transactions: [], categories: DEFAULT_CATEGORIES, assets: [] };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
    return initial;
  }
  try {
    const parsed = JSON.parse(raw);
    if (!parsed.categories || parsed.categories.length === 0) parsed.categories = DEFAULT_CATEGORIES;
    if (!parsed.transactions) parsed.transactions = [];
    if (!parsed.assets) parsed.assets = [];
    return parsed;
  } catch (e) {
    const initial = { transactions: [], categories: DEFAULT_CATEGORIES, assets: [] };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
    return initial;
  }
}

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

const state = loadData();

/* ---------------- ユーティリティ ---------------- */

function uid(prefix) {
  return prefix + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
}

function yen(amount) {
  const n = Math.round(Number(amount) || 0);
  return '¥' + n.toLocaleString('ja-JP');
}

function todayISO() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

function monthKeyOf(dateStr) {
  return dateStr.slice(0, 7); // "YYYY-MM"
}

function monthLabel(key) {
  const [y, m] = key.split('-');
  return `${y}年${Number(m)}月`;
}

function categoryColor(categoryId) {
  const idx = state.categories.findIndex(c => c.id === categoryId);
  return CATEGORY_COLORS[(idx < 0 ? 0 : idx) % CATEGORY_COLORS.length];
}

function categoryName(categoryId) {
  const c = state.categories.find(c => c.id === categoryId);
  return c ? c.name : '未分類';
}

/* ---------------- 画面切り替え ---------------- */

const screens = document.querySelectorAll('.screen');
const tabButtons = document.querySelectorAll('.tabbar__btn');

function showScreen(name) {
  screens.forEach(s => s.classList.toggle('active', s.id === `screen-${name}`));
  tabButtons.forEach(b => b.classList.toggle('is-active', b.dataset.screen === name));
  if (name === 'list') renderListScreen();
  if (name === 'assets') renderAssetsScreen();
  if (name === 'report') renderReportScreen();
}

tabButtons.forEach(btn => {
  btn.addEventListener('click', () => showScreen(btn.dataset.screen));
});

/* ==========================================================
   記録画面(支出・収入の入力)
   ========================================================== */

let currentTxType = 'expense';

const typeToggleBtns = document.querySelectorAll('.type-toggle__btn');
const txForm = document.getElementById('txForm');
const txAmount = document.getElementById('txAmount');
const txDate = document.getElementById('txDate');
const txMemo = document.getElementById('txMemo');
const txCategoryList = document.getElementById('txCategoryList');
const txEditId = document.getElementById('txEditId');
const txSubmitBtn = document.getElementById('txSubmitBtn');
const txCancelEditBtn = document.getElementById('txCancelEditBtn');

let selectedCategoryId = null;

typeToggleBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    currentTxType = btn.dataset.type;
    typeToggleBtns.forEach(b => b.classList.toggle('is-active', b === btn));
    selectedCategoryId = null;
    renderCategoryChips();
  });
});

function renderCategoryChips() {
  const cats = state.categories.filter(c => c.type === currentTxType);
  if (!selectedCategoryId && cats.length) selectedCategoryId = cats[0].id;
  txCategoryList.innerHTML = '';
  cats.forEach(c => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'chip' + (c.id === selectedCategoryId ? ' is-selected' : '');
    chip.textContent = c.name;
    chip.addEventListener('click', () => {
      selectedCategoryId = c.id;
      renderCategoryChips();
    });
    txCategoryList.appendChild(chip);
  });
}

txDate.value = todayISO();

txForm.addEventListener('submit', (e) => {
  e.preventDefault();
  if (!selectedCategoryId) { alert('カテゴリを選んでください'); return; }
  if (!txAmount.value || Number(txAmount.value) <= 0) { alert('金額を入力してください'); return; }

  if (txEditId.value) {
    const t = state.transactions.find(t => t.id === txEditId.value);
    if (t) {
      t.type = currentTxType;
      t.amount = Number(txAmount.value);
      t.date = txDate.value;
      t.categoryId = selectedCategoryId;
      t.memo = txMemo.value.trim();
    }
  } else {
    state.transactions.push({
      id: uid('tx'),
      type: currentTxType,
      amount: Number(txAmount.value),
      date: txDate.value,
      categoryId: selectedCategoryId,
      memo: txMemo.value.trim(),
    });
  }
  saveData();
  resetTxForm();
  updateHeader();
  showScreen('list');
});

function resetTxForm() {
  txForm.reset();
  txDate.value = todayISO();
  txEditId.value = '';
  txSubmitBtn.textContent = '記録する';
  txCancelEditBtn.hidden = true;
  selectedCategoryId = null;
  renderCategoryChips();
}

txCancelEditBtn.addEventListener('click', resetTxForm);

function editTransaction(id) {
  const t = state.transactions.find(t => t.id === id);
  if (!t) return;
  currentTxType = t.type;
  typeToggleBtns.forEach(b => b.classList.toggle('is-active', b.dataset.type === t.type));
  selectedCategoryId = t.categoryId;
  renderCategoryChips();
  txAmount.value = t.amount;
  txDate.value = t.date;
  txMemo.value = t.memo || '';
  txEditId.value = t.id;
  txSubmitBtn.textContent = '更新する';
  txCancelEditBtn.hidden = false;
  showScreen('record');
  window.scrollTo(0, 0);
}

function deleteTransaction(id) {
  if (!confirm('この記録を削除しますか?')) return;
  state.transactions = state.transactions.filter(t => t.id !== id);
  saveData();
  renderListScreen();
  updateHeader();
}

/* ---------------- カテゴリ管理モーダル ---------------- */

const categoryModal = document.getElementById('categoryModal');
const addCategoryBtn = document.getElementById('addCategoryBtn');
const closeCategoryModalBtn = document.getElementById('closeCategoryModalBtn');
const saveCategoryBtn = document.getElementById('saveCategoryBtn');
const newCategoryName = document.getElementById('newCategoryName');
const categoryManageList = document.getElementById('categoryManageList');

addCategoryBtn.addEventListener('click', () => {
  renderCategoryManageList();
  categoryModal.hidden = false;
});
closeCategoryModalBtn.addEventListener('click', () => { categoryModal.hidden = true; });

saveCategoryBtn.addEventListener('click', () => {
  const name = newCategoryName.value.trim();
  if (!name) return;
  state.categories.push({ id: uid('cat'), name, type: currentTxType });
  saveData();
  newCategoryName.value = '';
  renderCategoryChips();
  renderCategoryManageList();
});

function renderCategoryManageList() {
  const cats = state.categories.filter(c => c.type === currentTxType);
  categoryManageList.innerHTML = '';
  cats.forEach(c => {
    const li = document.createElement('li');
    const nameSpan = document.createElement('span');
    nameSpan.textContent = c.name;
    const delBtn = document.createElement('button');
    delBtn.className = 'icon-btn';
    delBtn.textContent = '削除';
    delBtn.addEventListener('click', () => {
      const inUse = state.transactions.some(t => t.categoryId === c.id);
      if (inUse && !confirm('このカテゴリを使った記録があります。カテゴリだけ削除しますか?(記録は「未分類」として残ります)')) return;
      state.categories = state.categories.filter(cat => cat.id !== c.id);
      saveData();
      if (selectedCategoryId === c.id) selectedCategoryId = null;
      renderCategoryChips();
      renderCategoryManageList();
    });
    li.appendChild(nameSpan);
    li.appendChild(delBtn);
    categoryManageList.appendChild(li);
  });
}

/* ==========================================================
   一覧画面
   ========================================================== */

const listMonthFilter = document.getElementById('listMonthFilter');
const txList = document.getElementById('txList');
const txListEmpty = document.getElementById('txListEmpty');
const listIncomeTotal = document.getElementById('listIncomeTotal');
const listExpenseTotal = document.getElementById('listExpenseTotal');
const listBalanceTotal = document.getElementById('listBalanceTotal');

function allMonthKeysFromTransactions() {
  const keys = new Set(state.transactions.map(t => monthKeyOf(t.date)));
  keys.add(monthKeyOf(todayISO()));
  return Array.from(keys).sort().reverse();
}

function populateMonthSelect(selectEl, keys, previousValue) {
  selectEl.innerHTML = '';
  keys.forEach(key => {
    const opt = document.createElement('option');
    opt.value = key;
    opt.textContent = monthLabel(key);
    selectEl.appendChild(opt);
  });
  if (previousValue && keys.includes(previousValue)) selectEl.value = previousValue;
}

listMonthFilter.addEventListener('change', renderListScreen);

function renderListScreen() {
  const keys = allMonthKeysFromTransactions();
  const prevValue = listMonthFilter.value || monthKeyOf(todayISO());
  populateMonthSelect(listMonthFilter, keys, prevValue);
  const month = listMonthFilter.value;

  const monthTx = state.transactions
    .filter(t => monthKeyOf(t.date) === month)
    .sort((a, b) => b.date.localeCompare(a.date));

  let income = 0, expense = 0;
  monthTx.forEach(t => t.type === 'income' ? income += t.amount : expense += t.amount);
  listIncomeTotal.textContent = yen(income);
  listExpenseTotal.textContent = yen(expense);
  listBalanceTotal.textContent = yen(income - expense);

  txList.innerHTML = '';
  txListEmpty.hidden = monthTx.length > 0;

  monthTx.forEach(t => {
    const li = document.createElement('li');

    const info = document.createElement('div');
    info.className = 'ledger-item__info';
    const cat = document.createElement('span');
    cat.className = 'ledger-item__cat';
    cat.textContent = categoryName(t.categoryId);
    const memo = document.createElement('span');
    memo.className = 'ledger-item__memo';
    memo.textContent = t.memo || '(メモなし)';
    const date = document.createElement('span');
    date.className = 'ledger-item__date';
    date.textContent = t.date;
    info.appendChild(cat);
    info.appendChild(memo);
    info.appendChild(date);

    const right = document.createElement('div');
    right.className = 'ledger-item__right';
    const amount = document.createElement('span');
    amount.className = 'ledger-item__amount ' + (t.type === 'expense' ? 'is-expense' : 'is-income');
    amount.textContent = (t.type === 'expense' ? '-' : '+') + yen(t.amount);

    const editBtn = document.createElement('button');
    editBtn.className = 'icon-btn';
    editBtn.textContent = '✎';
    editBtn.setAttribute('aria-label', '編集');
    editBtn.addEventListener('click', () => editTransaction(t.id));

    const delBtn = document.createElement('button');
    delBtn.className = 'icon-btn';
    delBtn.textContent = '✕';
    delBtn.setAttribute('aria-label', '削除');
    delBtn.addEventListener('click', () => deleteTransaction(t.id));

    right.appendChild(amount);
    right.appendChild(editBtn);
    right.appendChild(delBtn);

    li.appendChild(info);
    li.appendChild(right);
    txList.appendChild(li);
  });
}

/* ==========================================================
   資産画面
   ========================================================== */

const assetForm = document.getElementById('assetForm');
const assetDate = document.getElementById('assetDate');
const assetNisa = document.getElementById('assetNisa');
const assetIdeco = document.getElementById('assetIdeco');
const assetEditId = document.getElementById('assetEditId');
const assetSubmitBtn = document.getElementById('assetSubmitBtn');
const assetCancelEditBtn = document.getElementById('assetCancelEditBtn');
const assetList = document.getElementById('assetList');
const assetListEmpty = document.getElementById('assetListEmpty');
const assetTotalValue = document.getElementById('assetTotalValue');
const assetNisaValue = document.getElementById('assetNisaValue');
const assetIdecoValue = document.getElementById('assetIdecoValue');

assetDate.value = todayISO();
let assetChartInstance = null;

assetForm.addEventListener('submit', (e) => {
  e.preventDefault();
  if (!assetDate.value) return;
  if (assetEditId.value) {
    const a = state.assets.find(a => a.id === assetEditId.value);
    if (a) {
      a.date = assetDate.value;
      a.nisa = Number(assetNisa.value) || 0;
      a.ideco = Number(assetIdeco.value) || 0;
    }
  } else {
    state.assets.push({
      id: uid('asset'),
      date: assetDate.value,
      nisa: Number(assetNisa.value) || 0,
      ideco: Number(assetIdeco.value) || 0,
    });
  }
  saveData();
  resetAssetForm();
  renderAssetsScreen();
  updateHeader();
});

function resetAssetForm() {
  assetForm.reset();
  assetDate.value = todayISO();
  assetEditId.value = '';
  assetSubmitBtn.textContent = '記録する';
  assetCancelEditBtn.hidden = true;
}

assetCancelEditBtn.addEventListener('click', resetAssetForm);

function editAsset(id) {
  const a = state.assets.find(a => a.id === id);
  if (!a) return;
  assetDate.value = a.date;
  assetNisa.value = a.nisa;
  assetIdeco.value = a.ideco;
  assetEditId.value = a.id;
  assetSubmitBtn.textContent = '更新する';
  assetCancelEditBtn.hidden = false;
  window.scrollTo(0, 0);
}

function deleteAsset(id) {
  if (!confirm('この資産記録を削除しますか?')) return;
  state.assets = state.assets.filter(a => a.id !== id);
  saveData();
  renderAssetsScreen();
  updateHeader();
}

function latestAsset() {
  if (!state.assets.length) return null;
  return [...state.assets].sort((a, b) => a.date.localeCompare(b.date)).at(-1);
}

function renderAssetsScreen() {
  const latest = latestAsset();
  const total = latest ? latest.nisa + latest.ideco : 0;
  assetTotalValue.textContent = yen(total);
  assetNisaValue.textContent = yen(latest ? latest.nisa : 0);
  assetIdecoValue.textContent = yen(latest ? latest.ideco : 0);

  const sorted = [...state.assets].sort((a, b) => b.date.localeCompare(a.date));
  assetList.innerHTML = '';
  assetListEmpty.hidden = sorted.length > 0;

  sorted.forEach(a => {
    const li = document.createElement('li');
    const info = document.createElement('div');
    info.className = 'ledger-item__info';
    const cat = document.createElement('span');
    cat.className = 'ledger-item__cat';
    cat.textContent = `NISA ${yen(a.nisa)} ／ iDeCo ${yen(a.ideco)}`;
    const date = document.createElement('span');
    date.className = 'ledger-item__date';
    date.textContent = a.date;
    info.appendChild(cat);
    info.appendChild(date);

    const right = document.createElement('div');
    right.className = 'ledger-item__right';
    const amount = document.createElement('span');
    amount.className = 'ledger-item__amount is-income';
    amount.textContent = yen(a.nisa + a.ideco);

    const editBtn = document.createElement('button');
    editBtn.className = 'icon-btn';
    editBtn.textContent = '✎';
    editBtn.addEventListener('click', () => editAsset(a.id));

    const delBtn = document.createElement('button');
    delBtn.className = 'icon-btn';
    delBtn.textContent = '✕';
    delBtn.addEventListener('click', () => deleteAsset(a.id));

    right.appendChild(amount);
    right.appendChild(editBtn);
    right.appendChild(delBtn);
    li.appendChild(info);
    li.appendChild(right);
    assetList.appendChild(li);
  });

  renderAssetChart();
}

function renderAssetChart() {
  const sorted = [...state.assets].sort((a, b) => a.date.localeCompare(b.date));
  const ctx = document.getElementById('assetChart');
  if (assetChartInstance) assetChartInstance.destroy();
  if (!sorted.length) return;

  assetChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: sorted.map(a => a.date),
      datasets: [
        {
          label: '総資産',
          data: sorted.map(a => a.nisa + a.ideco),
          borderColor: '#4B6E4E',
          backgroundColor: 'rgba(75,110,78,0.12)',
          fill: true,
          tension: 0.25,
        },
        {
          label: '積立NISA',
          data: sorted.map(a => a.nisa),
          borderColor: '#B5482A',
          backgroundColor: 'transparent',
          borderDash: [4, 3],
          tension: 0.25,
        },
        {
          label: 'iDeCo',
          data: sorted.map(a => a.ideco),
          borderColor: '#C9A15C',
          backgroundColor: 'transparent',
          borderDash: [4, 3],
          tension: 0.25,
        },
      ],
    },
    options: {
      responsive: true,
      plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 11 } } } },
      scales: {
        y: { ticks: { callback: v => yen(v) } },
      },
    },
  });
}

/* ==========================================================
   レポート画面(カテゴリ別円グラフ)
   ========================================================== */

const reportMonthFilter = document.getElementById('reportMonthFilter');
const categoryBreakdown = document.getElementById('categoryBreakdown');
const reportEmpty = document.getElementById('reportEmpty');
let categoryChartInstance = null;

reportMonthFilter.addEventListener('change', renderReportScreen);

function renderReportScreen() {
  const keys = allMonthKeysFromTransactions();
  const prevValue = reportMonthFilter.value || monthKeyOf(todayISO());
  populateMonthSelect(reportMonthFilter, keys, prevValue);
  const month = reportMonthFilter.value;

  const monthExpenses = state.transactions.filter(t => t.type === 'expense' && monthKeyOf(t.date) === month);

  const totals = {};
  monthExpenses.forEach(t => {
    totals[t.categoryId] = (totals[t.categoryId] || 0) + t.amount;
  });
  const entries = Object.entries(totals).sort((a, b) => b[1] - a[1]);

  const ctx = document.getElementById('categoryChart');
  if (categoryChartInstance) categoryChartInstance.destroy();
  reportEmpty.hidden = entries.length > 0;
  categoryBreakdown.innerHTML = '';

  if (!entries.length) return;

  categoryChartInstance = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: entries.map(([id]) => categoryName(id)),
      datasets: [{
        data: entries.map(([, v]) => v),
        backgroundColor: entries.map(([id]) => categoryColor(id)),
        borderColor: '#FBF4E3',
        borderWidth: 2,
      }],
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
    },
  });

  const totalAmount = entries.reduce((s, [, v]) => s + v, 0);
  entries.forEach(([id, amount]) => {
    const li = document.createElement('li');
    const dot = document.createElement('span');
    dot.className = 'dot';
    dot.style.background = categoryColor(id);
    const name = document.createElement('span');
    name.className = 'cb-name';
    const pct = totalAmount ? Math.round((amount / totalAmount) * 100) : 0;
    name.textContent = `${categoryName(id)} (${pct}%)`;
    const amt = document.createElement('span');
    amt.className = 'cb-amount';
    amt.textContent = yen(amount);
    li.appendChild(dot);
    li.appendChild(name);
    li.appendChild(amt);
    categoryBreakdown.appendChild(li);
  });
}

/* ==========================================================
   ヘッダーの要約表示
   ========================================================== */

function updateHeader() {
  const month = monthKeyOf(todayISO());
  let income = 0, expense = 0;
  state.transactions.filter(t => monthKeyOf(t.date) === month).forEach(t => {
    t.type === 'income' ? income += t.amount : expense += t.amount;
  });
  document.getElementById('headerBalance').textContent = yen(income - expense);

  const latest = latestAsset();
  document.getElementById('headerAssets').textContent = yen(latest ? latest.nisa + latest.ideco : 0);
}

/* ==========================================================
   初期化
   ========================================================== */

renderCategoryChips();
renderListScreen();
renderAssetsScreen();
renderReportScreen();
updateHeader();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('service-worker.js').catch(() => {});
  });
}
