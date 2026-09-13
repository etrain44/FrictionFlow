const weeklyLimit = 1000;
let credits = 420;
const completedActions = new Set();
const proofBonusClaimed = new Set();
const proofBonusAmount = 20;

const balance = document.querySelector('#credit-balance');
const fill = document.querySelector('#balance-fill');
const change = document.querySelector('#balance-change');
const message = document.querySelector('#balance-message');
const status = document.querySelector('#status-pill');
const recoveryBanner = document.querySelector('#recovery-banner');
const completedCount = document.querySelector('#completed-count');
const toast = document.querySelector('#toast');
const totalActions = document.querySelectorAll('.action-card').length;
const proofForm = document.querySelector('#proof-form');
const proofFile = document.querySelector('#proof-file');
const proofPreview = document.querySelector('#proof-preview');
const submitProof = document.querySelector('#submit-proof');
const proofStatus = document.querySelector('#proof-status');
const proofSection = document.querySelector('.proof-section');
let selectedProof = null;
const historyList = document.querySelector('#history-list');
const calendarView = document.querySelector('#calendar-view');
const calendarGrid = document.querySelector('#calendar-grid');
const calendarMonthLabel = document.querySelector('#calendar-month-label');
const calendarMonthTotal = document.querySelector('#calendar-month-total');
const selectedDay = document.querySelector('#selected-day');
const previousMonth = document.querySelector('#previous-month');
const nextMonth = document.querySelector('#next-month');
const themesView = document.querySelector('#themes-view');
const settingsView = document.querySelector('#settings-view');
const weekStart = document.querySelector('#week-start');
const notificationsSetting = document.querySelector('#notifications-setting');
const resetWeek = document.querySelector('#reset-week');
const storedTheme = localStorage.getItem('replenish-theme');
const availableThemes = ['frictionflow', 'default', 'midnight', 'citrus', 'sunset', 'contrast', 'halloween', 'winter', 'spring', 'summer', 'harvest'];
const savedTheme = availableThemes.includes(storedTheme) ? storedTheme : 'frictionflow';
const today = new Date();
let calendarDate = new Date(today.getFullYear(), today.getMonth(), 1);
const activityDays = new Map();
let transactions = [
  { label: 'Weekly reserve', detail: 'Monday reset', amount: 1000 },
  { label: 'Reddit', detail: '33 minutes of scrolling', amount: -660 },
  { label: 'Read for 15 minutes', detail: 'Productive win', amount: 80 },
];
let trackedApps = [
  { app: 'Reddit', cost: 20, avatarClass: 'app-avatar-a', initial: 'R' },
  { app: 'X', cost: 15, avatarClass: 'app-avatar-b', initial: 'X' },
  { app: 'Instagram', cost: 20, avatarClass: 'app-avatar-c', initial: 'I' },
  { app: 'YouTube', cost: 15, avatarClass: 'app-avatar-d', initial: 'Y' },
];
let managingApps = false;
const appList = document.querySelector('#app-list');
const manageAppsButton = document.querySelector('#manage-apps');
const appsSection = document.querySelector('.apps-section');
const appAddForm = document.querySelector('#app-add-form');
const importFrictionFlowButton = document.querySelector('#import-frictionflow');
const IMPORTED_SESSIONS_KEY = 'replenish-imported-frictionflow';

document.body.dataset.theme = savedTheme;
notificationsSetting.checked = localStorage.getItem('replenish-notifications') !== 'off';
weekStart.value = localStorage.getItem('replenish-week-start') || 'Monday';

function dateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function addActivity(date, label, amount) {
  const key = dateKey(date);
  const current = activityDays.get(key) || { earned: 0, spent: 0, labels: [] };
  if (amount >= 0) current.earned += amount;
  else current.spent += Math.abs(amount);
  current.labels.push(label);
  activityDays.set(key, current);
}

addActivity(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1), 'Read for 15 minutes', 80);
addActivity(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1), 'Reddit', -60);
addActivity(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 4), 'Move for 20 minutes', 150);
addActivity(new Date(today.getFullYear(), today.getMonth() - 1, 18), 'Cook a real meal', 100);

function render() {
  const percentage = Math.max(0, Math.min(100, (credits / weeklyLimit) * 100));
  const isRecoveryMode = credits === 0;
  balance.textContent = credits;
  fill.style.width = `${percentage}%`;
  recoveryBanner.hidden = !isRecoveryMode;
  status.textContent = isRecoveryMode ? 'Recovery mode' : credits < 200 ? 'Running low' : 'In balance';
  status.style.color = isRecoveryMode ? '#f1876b' : '';
  status.style.borderColor = isRecoveryMode ? '#74443b' : '';
  message.textContent = isRecoveryMode ? 'Your weekly reserve is empty. Every win adds time back.' : credits < 200 ? 'A little focus now keeps your options open.' : "You've got room for a focused week.";
  document.querySelector('#credit-limit').textContent = weeklyLimit.toLocaleString();
  document.querySelector('#history-limit').textContent = weeklyLimit.toLocaleString();
  change.textContent = credits === weeklyLimit ? 'Full reserve' : '+120 this week';
  completedCount.textContent = `${completedActions.size} of ${totalActions}`;

  document.querySelectorAll('.action-card').forEach((card) => {
    const isComplete = completedActions.has(card.dataset.label);
    card.classList.toggle('completed', isComplete);
  });
  renderHistory();
  renderCalendar();
}

function renderHistory() {
  let runningBalance = 0;
  const rows = [...transactions].reverse().map((transaction) => {
    runningBalance += transaction.amount;
    const type = transaction.amount >= 0 ? 'earned' : 'spent';
    const sign = transaction.amount >= 0 ? '+' : '−';
    return `<div class="history-item"><span class="history-dot ${type}">${type === 'earned' ? '+' : '−'}</span><span class="history-copy"><strong>${transaction.label}</strong><small>${transaction.detail}</small></span><span class="history-amount ${type}">${sign}${Math.abs(transaction.amount)}</span></div>`;
  }).join('');
  historyList.innerHTML = rows;
}

function renderCalendar() {
  const year = calendarDate.getFullYear();
  const month = calendarDate.getMonth();
  const monthName = calendarDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const previousDays = new Date(year, month, 0).getDate();
  const cells = [];
  let monthEarned = 0;
  let monthSpent = 0;

  for (let index = 0; index < 42; index += 1) {
    const dayNumber = index - firstDay + 1;
    const cellDate = dayNumber < 1 ? new Date(year, month - 1, previousDays + dayNumber) : dayNumber > daysInMonth ? new Date(year, month + 1, dayNumber - daysInMonth) : new Date(year, month, dayNumber);
    const inMonth = cellDate.getMonth() === month;
    const key = dateKey(cellDate);
    const activity = activityDays.get(key);
    if (inMonth && activity) {
      monthEarned += activity.earned;
      monthSpent += activity.spent;
    }
    const isToday = key === dateKey(today);
    const classes = ['calendar-day', inMonth ? '' : 'other-month', isToday ? 'today' : ''].filter(Boolean).join(' ');
    const marker = activity ? `<span class="day-total">+${activity.earned}${activity.spent ? ` <span class="spent-total">−${activity.spent}</span>` : ''}</span>` : '';
    cells.push(`<button class="${classes}" type="button" data-date="${key}" ${inMonth ? '' : 'disabled'}>${cellDate.getDate()}${marker}</button>`);
  }

  calendarMonthLabel.textContent = monthName;
  calendarMonthTotal.textContent = `+${monthEarned} / −${monthSpent}`;
  calendarGrid.innerHTML = cells.join('');
  previousMonth.disabled = month <= today.getMonth() - 11 && year <= today.getFullYear();
  nextMonth.disabled = year >= today.getFullYear() && month >= today.getMonth();
  calendarGrid.querySelectorAll('.calendar-day:not([disabled])').forEach((day) => {
    day.addEventListener('click', () => {
      calendarGrid.querySelectorAll('.calendar-day').forEach((cell) => cell.classList.remove('selected'));
      day.classList.add('selected');
      const activity = activityDays.get(day.dataset.date);
      const date = new Date(`${day.dataset.date}T12:00:00`);
      const label = date.toLocaleDateString(undefined, { month: 'long', day: 'numeric' });
      selectedDay.textContent = activity ? `${label}: ${activity.labels.join(', ')}. +${activity.earned} earned${activity.spent ? `, −${activity.spent} spent` : ''}.` : `${label}: no logged activity.`;
    });
  });
}

function showToast(text) {
  toast.textContent = text;
  toast.classList.add('show');
  window.clearTimeout(showToast.timeout);
  showToast.timeout = window.setTimeout(() => toast.classList.remove('show'), 2400);
}

const appModal = document.querySelector('#app-modal');
const appModalTitle = document.querySelector('#app-modal-title');
const appModalMessage = document.querySelector('#app-modal-message');
const appModalInput = document.querySelector('#app-modal-input');
const appModalYes = document.querySelector('#app-modal-yes');
const appModalNo = document.querySelector('#app-modal-no');
let modalResolve = null;

function closeModal(result) {
  appModal.hidden = true;
  if (modalResolve) {
    const resolve = modalResolve;
    modalResolve = null;
    resolve(result);
  }
}

appModalYes.addEventListener('click', () => closeModal(appModalInput.hidden ? true : appModalInput.value));
appModalNo.addEventListener('click', () => closeModal(appModalInput.hidden ? false : null));
appModal.addEventListener('click', (event) => {
  if (event.target === appModal) closeModal(appModalInput.hidden ? false : null);
});

function askYesNo(title, message) {
  appModalTitle.textContent = title;
  appModalMessage.textContent = message;
  appModalInput.hidden = true;
  appModal.hidden = false;
  return new Promise((resolve) => { modalResolve = resolve; });
}

function askForMinutes(title, message, defaultValue) {
  appModalTitle.textContent = title;
  appModalMessage.textContent = message;
  appModalInput.hidden = false;
  appModalInput.value = defaultValue;
  appModal.hidden = false;
  window.setTimeout(() => appModalInput.focus(), 50);
  return new Promise((resolve) => { modalResolve = resolve; });
}

document.querySelectorAll('.action-card').forEach((card) => {
  card.addEventListener('click', async () => {
    const label = card.dataset.label;
    const wasCompleted = completedActions.has(label);
    const reward = Number(card.dataset.reward);
    credits = Math.min(weeklyLimit, credits + reward);
    completedActions.add(label);
    addActivity(today, label, reward);
    transactions.push({ label, detail: 'Completed', amount: reward });
    render();
    showToast(wasCompleted ? `${label} logged again, +${reward} credits.` : `${label} completed. +${reward} credits awarded.`);
    if (!proofBonusClaimed.has(label)) {
      const wantsProof = await askYesNo('Add photo proof?', `Want to add photo proof for "${label}" for a +${proofBonusAmount} bonus?`);
      if (wantsProof) {
        document.querySelector('#proof-activity').value = label;
        proofSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  });
});

proofFile.addEventListener('change', () => {
  selectedProof = proofFile.files[0];
  if (!selectedProof) {
    submitProof.disabled = true;
    proofPreview.hidden = true;
    return;
  }
  proofPreview.src = URL.createObjectURL(selectedProof);
  proofPreview.hidden = false;
  submitProof.disabled = false;
  proofStatus.hidden = true;
});

proofForm.addEventListener('submit', (event) => {
  event.preventDefault();
  if (!selectedProof) return;
  const activity = document.querySelector('#proof-activity').value;
  if (!completedActions.has(activity)) {
    showToast(`Complete ${activity.toLowerCase()} before adding photo proof.`);
    return;
  }
  if (proofBonusClaimed.has(activity)) {
    showToast(`${activity} already has its proof bonus this week.`);
    return;
  }
  credits = Math.min(weeklyLimit, credits + proofBonusAmount);
  proofBonusClaimed.add(activity);
  addActivity(today, activity, proofBonusAmount);
  transactions.push({ label: activity, detail: 'Photo proof bonus', amount: proofBonusAmount });
  render();
  proofFile.value = '';
  selectedProof = null;
  proofPreview.hidden = true;
  submitProof.disabled = true;
  proofStatus.textContent = `Proof accepted for ${activity.toLowerCase()}. +${proofBonusAmount} bonus credits added.`;
  proofStatus.hidden = false;
  showToast(`+${proofBonusAmount} bonus credits for showing your work.`);
});

function renderApps() {
  appList.innerHTML = trackedApps.map((entry, index) => `<div class="app-row" data-index="${index}"><span class="app-row-inner"><span class="app-avatar ${entry.avatarClass}">${entry.initial}</span><span class="app-name"><strong>${entry.app}</strong><small>Tracked by FrictionFlow</small></span>${managingApps ? `<span class="app-cost-edit"><input type="number" min="1" max="200" value="${entry.cost}" data-cost-index="${index}"><small>/ min</small></span><button class="app-remove" type="button" data-remove-index="${index}" aria-label="Remove ${entry.app}">×</button>` : `<span class="app-cost">−${entry.cost} / min</span>`}</span></div>`).join('');
}

appList.addEventListener('click', async (event) => {
  const removeButton = event.target.closest('[data-remove-index]');
  if (removeButton) {
    trackedApps.splice(Number(removeButton.dataset.removeIndex), 1);
    renderApps();
    return;
  }
  if (managingApps) return;
  const row = event.target.closest('.app-row');
  if (!row) return;
  const entry = trackedApps[Number(row.dataset.index)];
  if (credits === 0) {
    showToast('Reserve empty. Complete a productive action to continue.');
    return;
  }
  const input = await askForMinutes(`Log ${entry.app} usage`, `How many minutes of ${entry.app} did you use?`, '1');
  if (input === null) return;
  const minutes = Math.max(1, Math.min(180, Math.round(Number(input)) || 0));
  if (!minutes) {
    showToast('Enter a whole number of minutes.');
    return;
  }
  const totalCost = entry.cost * minutes;
  credits = Math.max(0, credits - totalCost);
  addActivity(today, entry.app, -totalCost);
  transactions.push({ label: entry.app, detail: `${minutes} minute${minutes === 1 ? '' : 's'} of app usage`, amount: -totalCost });
  render();
  showToast(`${entry.app} used for ${minutes} minute${minutes === 1 ? '' : 's'}. ${credits} credits left.`);
});

appList.addEventListener('change', (event) => {
  const costInput = event.target.closest('[data-cost-index]');
  if (!costInput) return;
  const index = Number(costInput.dataset.costIndex);
  const value = Math.max(1, Math.min(200, Number(costInput.value) || 1));
  trackedApps[index].cost = value;
  costInput.value = value;
});

manageAppsButton.addEventListener('click', () => {
  managingApps = !managingApps;
  appsSection.classList.toggle('managing', managingApps);
  manageAppsButton.textContent = managingApps ? 'Done' : 'Manage';
  appAddForm.hidden = !managingApps;
  renderApps();
});

appAddForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const nameInput = document.querySelector('#app-add-name');
  const costInput = document.querySelector('#app-add-cost');
  const name = nameInput.value.trim();
  const cost = Math.max(1, Math.min(200, Number(costInput.value) || 0));
  if (!name || !cost) return;
  const avatarClasses = ['app-avatar-a', 'app-avatar-b', 'app-avatar-c', 'app-avatar-d'];
  trackedApps.push({ app: name, cost, avatarClass: avatarClasses[trackedApps.length % avatarClasses.length], initial: name.charAt(0).toUpperCase() });
  nameInput.value = '';
  costInput.value = '';
  renderApps();
  showToast(`${name} added to your apps.`);
});

document.querySelector('.icon-button').addEventListener('click', () => {
  document.querySelector('.nav-item[data-view="settings"]').click();
});

importFrictionFlowButton.addEventListener('click', async () => {
  if (!window.frictionFlowBridge) {
    showToast('Import is only available in the Replenish desktop app.');
    return;
  }
  const data = await window.frictionFlowBridge.importSync();
  if (!data) return;
  if (data.error) {
    showToast(data.error);
    return;
  }
  const imported = JSON.parse(localStorage.getItem(IMPORTED_SESSIONS_KEY) || '[]');
  const importedSet = new Set(imported);
  let newCredits = 0;
  let importedCount = 0;
  (data.recentSessions || []).forEach((session) => {
    const id = `${session.intent}-${session.finishedAt}`;
    if (importedSet.has(id)) return;
    importedSet.add(id);
    importedCount += 1;
    if (session.outcome === 'completed') {
      const reward = Math.max(50, Math.round((session.durationMinutes || 1) * 10));
      credits = Math.min(weeklyLimit, credits + reward);
      addActivity(today, `FrictionFlow: ${session.intent}`, reward);
      transactions.push({ label: `FrictionFlow: ${session.intent}`, detail: 'Focused session completed', amount: reward });
      newCredits += reward;
    } else if (session.outcome === 'distracted_closed') {
      const reward = 20;
      credits = Math.min(weeklyLimit, credits + reward);
      addActivity(today, 'FrictionFlow: caught a drift', reward);
      transactions.push({ label: 'FrictionFlow: caught a drift', detail: 'Closed the tab instead of extending', amount: reward });
      newCredits += reward;
    } else {
      addActivity(today, `FrictionFlow: ${session.intent}`, 0);
      transactions.push({ label: `FrictionFlow: ${session.intent}`, detail: 'Distraction logged', amount: 0 });
    }
  });
  localStorage.setItem(IMPORTED_SESSIONS_KEY, JSON.stringify([...importedSet]));
  render();
  showToast(importedCount ? `Imported ${importedCount} FrictionFlow session${importedCount === 1 ? '' : 's'}, +${newCredits} credits.` : 'No new FrictionFlow sessions to import.');
});

renderApps();

weekStart.addEventListener('change', () => {
  localStorage.setItem('replenish-week-start', weekStart.value);
  showToast(`Week now starts on ${weekStart.value}.`);
});

notificationsSetting.addEventListener('change', () => {
  localStorage.setItem('replenish-notifications', notificationsSetting.checked ? 'on' : 'off');
  showToast(notificationsSetting.checked ? 'Low-balance notifications are on.' : 'Low-balance notifications are off.');
});

resetWeek.addEventListener('click', () => {
  credits = weeklyLimit;
  completedActions.clear();
  proofBonusClaimed.clear();
  transactions = [{ label: 'Weekly reserve', detail: 'Manual reset', amount: weeklyLimit }];
  activityDays.clear();
  render();
  showToast('This week\'s demo data was reset.');
});

document.querySelectorAll('.nav-item').forEach((item) => {
  item.addEventListener('click', () => {
    document.querySelectorAll('.nav-item').forEach((navItem) => navItem.classList.remove('active'));
    item.classList.add('active');
    const view = item.dataset.view || 'today';
    document.querySelectorAll('.today-view').forEach((todayView) => { todayView.hidden = view !== 'today'; });
    document.querySelector('#history-view').hidden = view !== 'history';
    calendarView.hidden = view !== 'calendar';
    themesView.hidden = view !== 'themes';
    settingsView.hidden = view !== 'settings';
    render();
  });
});

document.querySelectorAll('.theme-option').forEach((option) => {
  option.addEventListener('click', () => {
    const theme = option.dataset.theme;
    document.body.dataset.theme = theme;
    localStorage.setItem('replenish-theme', theme);
    document.querySelectorAll('.theme-option').forEach((themeOption) => {
      const isActive = themeOption === option;
      themeOption.classList.toggle('active', isActive);
      themeOption.setAttribute('aria-checked', String(isActive));
    });
    showToast(`${option.querySelector('strong').textContent} theme selected.`);
  });
});


document.querySelectorAll('.theme-option').forEach((option) => {
  const isActive = option.dataset.theme === savedTheme;
  option.classList.toggle('active', isActive);
  option.setAttribute('aria-checked', String(isActive));
});

previousMonth.addEventListener('click', () => {
  calendarDate = new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1, 1);
  renderCalendar();
});

nextMonth.addEventListener('click', () => {
  calendarDate = new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 1);
  renderCalendar();
});

render();
