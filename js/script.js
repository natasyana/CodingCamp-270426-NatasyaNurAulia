// =============================================
//  script.js — Expense & Budget Visualizer
// =============================================

// ---------- Constants ----------
const STORAGE_KEY = 'budgetVisualizer_transactions';

const CATEGORY_ICONS = {
  Food:          '🍔',
  Transport:     '🚗',
  Shopping:      '🛍️',
  Health:        '💊',
  Entertainment: '🎮',
  Education:     '📚',
  Salary:        '💼',
  Other:         '📦',
};

const CATEGORY_COLORS = [
  '#6c63ff', '#22c55e', '#ef4444', '#f59e0b',
  '#3b82f6', '#ec4899', '#14b8a6', '#8b5cf6',
];

// ---------- State ----------
let transactions = loadFromStorage();
let chartInstance = null;

// ---------- DOM References ----------
const form            = document.getElementById('transactionForm');
const itemInput       = document.getElementById('itemName');
const amountInput     = document.getElementById('amount');
const typeSelect      = document.getElementById('type');
const categorySelect  = document.getElementById('category');
const totalBalanceEl  = document.getElementById('totalBalance');
const totalIncomeEl   = document.getElementById('totalIncome');
const totalExpenseEl  = document.getElementById('totalExpense');
const transactionList = document.getElementById('transactionList');
const listEmpty       = document.getElementById('listEmpty');
const chartEmpty      = document.getElementById('chartEmpty');
const clearAllBtn     = document.getElementById('clearAll');
const itemError       = document.getElementById('itemError');
const amountError     = document.getElementById('amountError');

// ---------- Init ----------
render();

// ---------- Event Listeners ----------
form.addEventListener('submit', handleAddTransaction);
clearAllBtn.addEventListener('click', handleClearAll);

// ---------- Handlers ----------
function handleAddTransaction(e) {
  e.preventDefault();

  const name     = itemInput.value.trim();
  const amount   = parseFloat(amountInput.value);
  const type     = typeSelect.value;
  const category = categorySelect.value;

  // Validation
  let valid = true;

  if (!name) {
    showError(itemInput, itemError, 'Please enter a description.');
    valid = false;
  } else {
    clearError(itemInput, itemError);
  }

  if (!amountInput.value || isNaN(amount) || amount <= 0) {
    showError(amountInput, amountError, 'Enter a valid amount greater than 0.');
    valid = false;
  } else {
    clearError(amountInput, amountError);
  }

  if (!valid) return;

  const transaction = {
    id:       Date.now(),
    name,
    amount,
    type,
    category,
    date:     new Date().toLocaleDateString('id-ID', {
                day: '2-digit', month: 'short', year: 'numeric'
              }),
  };

  transactions.unshift(transaction); // newest first
  saveToStorage();
  render();
  form.reset();
}

function handleDeleteTransaction(id) {
  transactions = transactions.filter(t => t.id !== id);
  saveToStorage();
  render();
}

function handleClearAll() {
  if (transactions.length === 0) return;
  if (!confirm('Delete all transactions? This cannot be undone.')) return;
  transactions = [];
  saveToStorage();
  render();
}

// ---------- Render ----------
function render() {
  renderSummary();
  renderList();
  renderChart();
}

function renderSummary() {
  const income  = transactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);

  const expense = transactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);

  const balance = income - expense;

  totalBalanceEl.textContent = formatRupiah(balance);
  totalIncomeEl.textContent  = formatRupiah(income);
  totalExpenseEl.textContent = formatRupiah(expense);

  // Color balance based on sign
  totalBalanceEl.style.color =
    balance < 0 ? '#fca5a5' : '#fff';
}

function renderList() {
  transactionList.innerHTML = '';

  if (transactions.length === 0) {
    listEmpty.style.display = 'block';
    return;
  }

  listEmpty.style.display = 'none';

  transactions.forEach(t => {
    const li = document.createElement('li');
    li.className = 'transaction-item';
    li.dataset.id = t.id;

    const sign = t.type === 'income' ? '+' : '-';

    li.innerHTML = `
      <span class="item-icon">${CATEGORY_ICONS[t.category] || '📦'}</span>
      <div class="item-info">
        <p class="item-name">${escapeHtml(t.name)}</p>
        <p class="item-meta">${t.category} · ${t.date}</p>
      </div>
      <span class="item-amount ${t.type}">${sign}${formatRupiah(t.amount)}</span>
      <button class="btn-delete" aria-label="Delete transaction" data-id="${t.id}">✕</button>
    `;

    li.querySelector('.btn-delete').addEventListener('click', () => {
      handleDeleteTransaction(t.id);
    });

    transactionList.appendChild(li);
  });
}

function renderChart() {
  const expenseTransactions = transactions.filter(t => t.type === 'expense');

  if (expenseTransactions.length === 0) {
    chartEmpty.style.display = 'block';
    if (chartInstance) {
      chartInstance.destroy();
      chartInstance = null;
    }
    return;
  }

  chartEmpty.style.display = 'none';

  // Aggregate by category
  const categoryTotals = {};
  expenseTransactions.forEach(t => {
    categoryTotals[t.category] = (categoryTotals[t.category] || 0) + t.amount;
  });

  const labels = Object.keys(categoryTotals);
  const data   = Object.values(categoryTotals);
  const colors = labels.map((_, i) => CATEGORY_COLORS[i % CATEGORY_COLORS.length]);

  const ctx = document.getElementById('expenseChart').getContext('2d');

  if (chartInstance) {
    // Update existing chart
    chartInstance.data.labels          = labels;
    chartInstance.data.datasets[0].data   = data;
    chartInstance.data.datasets[0].backgroundColor = colors;
    chartInstance.update();
  } else {
    // Create new chart
    chartInstance = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor:  colors,
          borderColor:      '#ffffff',
          borderWidth:      3,
          hoverOffset:      8,
        }],
      },
      options: {
        responsive:  true,
        cutout:      '60%',
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              padding:   14,
              font:      { size: 12 },
              usePointStyle: true,
              pointStyleWidth: 10,
            },
          },
          tooltip: {
            callbacks: {
              label(context) {
                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                const pct   = ((context.parsed / total) * 100).toFixed(1);
                return ` ${formatRupiah(context.parsed)} (${pct}%)`;
              },
            },
          },
        },
      },
    });
  }
}

// ---------- Storage ----------
function saveToStorage() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
}

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

// ---------- Helpers ----------
function formatRupiah(amount) {
  return 'Rp ' + Math.abs(amount).toLocaleString('id-ID');
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function showError(input, errorEl, message) {
  input.classList.add('invalid');
  errorEl.textContent = message;
}

function clearError(input, errorEl) {
  input.classList.remove('invalid');
  errorEl.textContent = '';
}

const toggleBtn = document.getElementById('dark-mode-toggle');

toggleBtn.addEventListener('click', () => {
  document.body.classList.toggle('dark-theme');

  // Opsional: Simpan pilihan tema ke Local Storage
  const isDark = document.body.classList.contains('dark-theme');
  localStorage.setItem('theme', isDark ? 'dark' : 'light');
});

// Cek tema saat halaman dibuka
if (localStorage.geItem('theme') === 'dark') {
    document.body.classList.add('dark-theme');
}