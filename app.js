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
  '#E8722C', '#2F8F5E', '#F2A65A', '#3AA179',
  '#C9591E', '#6FA98A', '#EDA65C', '#1F6E4A',
  '#D97F3D', '#4C8C6B',
];

function loadData() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    const initial = {
      transactions: [],
      categories: DEFAULT_CATEGORIES,
      assets: [],
      accountNames: ['口座1', '口座2', '口座3'],
      budgets: {},
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
    return initial;
  }
  try {
    const parsed = JSON.parse(raw);
    if (!parsed.categories || parsed.categories.length === 0) parsed.categories = DEFAULT_CATEGORIES;
    if (!parsed.transactions) parsed.transactions = [];
    if (!parsed.assets) parsed.assets = [];
    if (!parsed.accountNames || parsed.accountNames.length !== 3) parsed.accountNames = ['口座1', '口座2', '口座3'];
    if (!parsed.budgets) parsed.budgets = {};
    parsed.assets.forEach(a => { if (!a.accounts || a.accounts.length !== 3) a.accounts = [0, 0, 0]; });
    return parsed;
  } catch (e) {
    const initial = {
      transactions: [],
      categories: DEFAULT_CATEGORIES,
      assets: [],
      accountNames: ['口座1', '口座2', '口座3'],
      budgets: {},
    };
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
  if (name === 'calendar') renderCalendarScreen();
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

function createTxListItem(t) {
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
  delBtn.addEventListener('click', () => {
    deleteTransaction(t.id);
    if (typeof renderCalendarScreen === 'function' && document.getElementById('screen-calendar').classList.contains('active')) {
      renderCalendarScreen();
    }
  });

  right.appendChild(amount);
  right.appendChild(editBtn);
  right.appendChild(delBtn);

  li.appendChild(info);
  li.appendChild(right);
  return li;
}

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
  monthTx.forEach(t => txList.appendChild(createTxListItem(t)));
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
const assetTotalNote = document.getElementById('assetTotalNote');
const assetBreakdown = document.getElementById('assetBreakdown');

const accountNameInputs = [0, 1, 2].map(i => document.getElementById(`accountName${i}`));
const accountBalanceInputs = [0, 1, 2].map(i => document.getElementById(`accountBalance${i}`));

accountNameInputs.forEach((input, i) => {
  input.value = state.accountNames[i];
  input.addEventListener('change', () => {
    const name = input.value.trim() || `口座${i + 1}`;
    input.value = name;
    state.accountNames[i] = name;
    saveData();
    renderAssetsScreen();
  });
});

assetDate.value = todayISO();
let assetChartInstance = null;

function accountsTotal(a) {
  return (a.accounts || [0, 0, 0]).reduce((s, v) => s + (Number(v) || 0), 0);
}

function snapshotTotal(a) {
  return (a.nisa || 0) + (a.ideco || 0) + accountsTotal(a);
}

assetForm.addEventListener('submit', (e) => {
  e.preventDefault();
  if (!assetDate.value) return;
  const accounts = accountBalanceInputs.map(inp => Number(inp.value) || 0);

  if (assetEditId.value) {
    const a = state.assets.find(a => a.id === assetEditId.value);
    if (a) {
      a.date = assetDate.value;
      a.nisa = Number(assetNisa.value) || 0;
      a.ideco = Number(assetIdeco.value) || 0;
      a.accounts = accounts;
    }
  }
