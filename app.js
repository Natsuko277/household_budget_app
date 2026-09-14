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
  } else {
    state.assets.push({
      id: uid('asset'),
      date: assetDate.value,
      nisa: Number(assetNisa.value) || 0,
      ideco: Number(assetIdeco.value) || 0,
      accounts,
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
  accountNameInputs.forEach((input, i) => { input.value = state.accountNames[i]; });
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
  const accounts = a.accounts || [0, 0, 0];
  accountBalanceInputs.forEach((inp, i) => { inp.value = accounts[i]; });
  assetEditId.value = a.id;
  assetSubmitBtn.textContent = '更新する';
  assetCancelEditBtn.hidden = false;
  showScreen('assets');
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

// 最新の資産記録 + それ以降に記録された収支を反映した「現在の推定総資産」
function estimatedTotalAssets() {
  const latest = latestAsset();
  if (!latest) return { total: 0, since: null, hasFollowUp: false };
  let net = 0;
  let hasFollowUp = false;
  state.transactions.forEach(t => {
    if (t.date > latest.date) {
      hasFollowUp = true;
      net += (t.type === 'income' ? t.amount : -t.amount);
    }
  });
  return { total: snapshotTotal(latest) + net, since: latest.date, hasFollowUp };
}

function renderAssetsScreen() {
  const latest = latestAsset();
  const est = estimatedTotalAssets();
  assetTotalValue.textContent = yen(est.total);
  assetTotalNote.textContent = est.since
    ? (est.hasFollowUp
        ? `${est.since}時点の記録に、それ以降の支出・収入を反映した金額です`
        : `${est.since}時点で記録した金額です`)
    : '資産の記録がまだありません';

  assetBreakdown.innerHTML = '';
  const breakdownItems = [
    ['積立NISA', latest ? latest.nisa : 0],
    ['iDeCo', latest ? latest.ideco : 0],
    ...state.accountNames.map((name, i) => [name, latest && latest.accounts ? latest.accounts[i] : 0]),
  ];
  breakdownItems.forEach(([label, amount]) => {
    const span = document.createElement('span');
    const strong = document.createElement('strong');
    strong.textContent = yen(amount);
    span.appendChild(document.createTextNode(label + ' '));
    span.appendChild(strong);
    assetBreakdown.appendChild(span);
  });

  const sorted = [...state.assets].sort((a, b) => b.date.localeCompare(a.date));
  assetList.innerHTML = '';
  assetListEmpty.hidden = sorted.length > 0;

  sorted.forEach(a => {
    const li = document.createElement('li');
    const info = document.createElement('div');
    info.className = 'ledger-item__info';
    const cat = document.createElement('span');
    cat.className = 'ledger-item__cat';
    const accParts = state.accountNames.map((name, i) => `${name} ${yen((a.accounts || [0, 0, 0])[i])}`).join(' ／ ');
    cat.textContent = `NISA ${yen(a.nisa)} ／ iDeCo ${yen(a.ideco)} ／ ${accParts}`;
    const date = document.createElement('span');
    date.className = 'ledger-item__date';
    date.textContent = a.date;
    info.appendChild(cat);
    info.appendChild(date);

    const right = document.createElement('div');
    right.className = 'ledger-item__right';
    const amount = document.createElement('span');
    amount.className = 'ledger-item__amount is-income';
    amount.textContent = yen(snapshotTotal(a));

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
          data: sorted.map(a => snapshotTotal(a)),
          borderColor: '#2F8F5E',
          backgroundColor: 'rgba(47,143,94,0.12)',
          fill: true,
          tension: 0.25,
        },
        {
          label: '積立NISA',
          data: sorted.map(a => a.nisa),
          borderColor: '#E8722C',
          backgroundColor: 'transparent',
          borderDash: [4, 3],
          tension: 0.25,
        },
        {
          label: 'iDeCo',
          data: sorted.map(a => a.ideco),
          borderColor: '#3AA179',
          backgroundColor: 'transparent',
          borderDash: [4, 3],
          tension: 0.25,
        },
        {
          label: '口座合計',
          data: sorted.map(a => accountsTotal(a)),
          borderColor: '#F2A65A',
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
const budgetSection = document.getElementById('budgetSection');
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

  if (entries.length) {
    categoryChartInstance = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: entries.map(([id]) => categoryName(id)),
        datasets: [{
          data: entries.map(([, v]) => v),
          backgroundColor: entries.map(([id]) => categoryColor(id)),
          borderColor: '#FFFDF9',
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

  renderBudgetSection(month, totals);
}

function renderBudgetSection(month, totals) {
  const expenseCats = state.categories.filter(c => c.type === 'expense');
  budgetSection.innerHTML = '';
  const isCurrentMonth = month === monthKeyOf(todayISO());

  expenseCats.forEach(cat => {
    const spent = totals[cat.id] || 0;
    const budget = state.budgets[cat.id] || 0;

    const row = document.createElement('div');
    row.className = 'budget-row';

    const head = document.createElement('div');
    head.className = 'budget-row__head';
    const name = document.createElement('span');
    name.className = 'budget-row__name';
    name.textContent = cat.name;
    const spentSpan = document.createElement('span');
    spentSpan.className = 'budget-row__spent';
    spentSpan.textContent = budget ? `${yen(spent)} / ${yen(budget)}` : yen(spent);
    head.appendChild(name);
    head.appendChild(spentSpan);

    const bar = document.createElement('div');
    bar.className = 'budget-bar';
    if (budget > 0) {
      const fill = document.createElement('div');
      const pct = Math.min(100, (spent / budget) * 100);
      fill.className = 'budget-bar__fill' + (spent > budget ? ' is-over' : '');
      fill.style.width = pct + '%';
      bar.appendChild(fill);
    }

    const inputLabel = document.createElement('label');
    inputLabel.className = 'budget-row__input';
    const inputCaption = document.createElement('span');
    inputCaption.textContent = '月の予算';
    const input = document.createElement('input');
    input.type = 'number';
    input.min = '0';
    input.step = '1';
    input.placeholder = '未設定';
    input.value = budget || '';
    input.addEventListener('change', () => {
      const v = Number(input.value) || 0;
      if (v > 0) state.budgets[cat.id] = v; else delete state.budgets[cat.id];
      saveData();
      renderReportScreen();
    });
    inputLabel.appendChild(inputCaption);
    inputLabel.appendChild(input);

    row.appendChild(head);
    if (budget > 0) row.appendChild(bar);
    row.appendChild(inputLabel);

    if (isCurrentMonth && budget > 0 && spent > budget) {
      const warn = document.createElement('p');
      warn.className = 'budget-row__warn';
      warn.textContent = `予算を${yen(spent - budget)}オーバーしています`;
      row.appendChild(warn);
    }

    budgetSection.appendChild(row);
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
  document.getElementById('headerAssets').textContent = yen(estimatedTotalAssets().total);
}

/* ==========================================================
   カレンダー画面
   ========================================================== */

const calMonthLabel = document.getElementById('calMonthLabel');
const calMonthSummary = document.getElementById('calMonthSummary');
const calendarGrid = document.getElementById('calendarGrid');
const calSelectedTitle = document.getElementById('calSelectedTitle');
const calDayList = document.getElementById('calDayList');
const calDayEmpty = document.getElementById('calDayEmpty');

const today = new Date();
let calYear = today.getFullYear();
let calMonth = today.getMonth(); // 0-11
let calSelectedDate = todayISO();

document.getElementById('calPrevBtn').addEventListener('click', () => changeCalMonth(-1));
document.getElementById('calNextBtn').addEventListener('click', () => changeCalMonth(1));

function changeCalMonth(diff) {
  calMonth += diff;
  if (calMonth < 0) { calMonth = 11; calYear -= 1; }
  if (calMonth > 11) { calMonth = 0; calYear += 1; }
  renderCalendarScreen();
}

function pad2(n) { return String(n).padStart(2, '0'); }

function formatDateJa(dateStr) {
  const [y, m, d] = dateStr.split('-');
  return `${y}年${Number(m)}月${Number(d)}日`;
}

function renderCalendarScreen() {
  const monthKey = `${calYear}-${pad2(calMonth + 1)}`;
  calMonthLabel.textContent = `${calYear}年${calMonth + 1}月`;

  const dailyExpense = {};
  const dailyIncome = {};
  let monthExpenseTotal = 0;
  let monthIncomeTotal = 0;

  state.transactions.forEach(t => {
    if (monthKeyOf(t.date) !== monthKey) return;
    if (t.type === 'expense') {
      dailyExpense[t.date] = (dailyExpense[t.date] || 0) + t.amount;
      monthExpenseTotal += t.amount;
    } else {
      dailyIncome[t.date] = true;
      monthIncomeTotal += t.amount;
    }
  });

  calMonthSummary.textContent = `この月の支出 ${yen(monthExpenseTotal)} ／ 収入 ${yen(monthIncomeTotal)} ／ 差引 ${yen(monthIncomeTotal - monthExpenseTotal)}`;

  const maxDaily = Math.max(0, ...Object.values(dailyExpense));

  calendarGrid.innerHTML = '';
  ['日', '月', '火', '水', '木', '金', '土'].forEach((w, i) => {
    const cell = document.createElement('div');
    cell.className = 'calendar-grid__weekday' + (i === 0 ? ' is-sun' : i === 6 ? ' is-sat' : '');
    cell.textContent = w;
    calendarGrid.appendChild(cell);
  });

  const firstWeekday = new Date(calYear, calMonth, 1).getDay();
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();

  for (let i = 0; i < firstWeekday; i++) {
    const empty = document.createElement('div');
    empty.className = 'calendar-grid__cell is-empty';
    calendarGrid.appendChild(empty);
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${calYear}-${pad2(calMonth + 1)}-${pad2(d)}`;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'calendar-grid__cell';
    if (dateStr === todayISO()) btn.classList.add('is-today');
    if (dateStr === calSelectedDate) btn.classList.add('is-selected');

    const num = document.createElement('span');
    num.className = 'calendar-grid__num';
    num.textContent = d;
    btn.appendChild(num);

    if (dailyExpense[dateStr]) {
      const ratio = maxDaily ? dailyExpense[dateStr] / maxDaily : 0;
      btn.style.background = `rgba(232, 114, 44, ${(0.10 + ratio * 0.35).toFixed(2)})`;
      const amt = document.createElement('span');
      amt.className = 'calendar-grid__amount';
      amt.textContent = yen(dailyExpense[dateStr]);
      btn.appendChild(amt);
    }
    if (dailyIncome[dateStr]) {
      const dot = document.createElement('span');
      dot.className = 'calendar-grid__dot';
      btn.appendChild(dot);
    }

    btn.addEventListener('click', () => {
      calSelectedDate = dateStr;
      renderCalendarScreen();
    });

    calendarGrid.appendChild(btn);
  }

  renderCalendarDayList();
}

function renderCalendarDayList() {
  calSelectedTitle.textContent = formatDateJa(calSelectedDate) + 'の記録';
  const dayTx = state.transactions
    .filter(t => t.date === calSelectedDate)
    .sort((a, b) => a.type.localeCompare(b.type));
  calDayList.innerHTML = '';
  calDayEmpty.hidden = dayTx.length > 0;
  dayTx.forEach(t => calDayList.appendChild(createTxListItem(t)));
}

/* ==========================================================
   初期化
   ========================================================== */

renderCategoryChips();
renderListScreen();
renderAssetsScreen();
renderReportScreen();
renderCalendarScreen();
updateHeader();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('service-worker.js').catch(() => {});
  });
}
