const TASKS_KEY = 'wg-dienste-v1';
const RESET_KEY = 'wg-dienste-last-reset-v1';
const groups = [{ id: 'weekly', title: 'Wöchentlich' }, { id: 'biweekly', title: 'Alle 2 Wochen' }, { id: 'monthly', title: 'Monatlich' }];
const starter = [
  { id: 's1', name: 'Küche putzen', freq: 'weekly', done: false },
  { id: 's2', name: 'Bad reinigen', freq: 'weekly', done: false },
  { id: 's3', name: 'Bio-Müll leeren', freq: 'weekly', done: false },
  { id: 's9', name: 'Kompost-Müll leeren', freq: 'weekly', done: false },
  { id: 's4', name: 'Böden saugen', freq: 'weekly', done: false },
  { id: 's5', name: 'Staub wischen', freq: 'weekly', done: false },
  { id: 's6', name: 'Kühlschrank auswischen', freq: 'weekly', done: false },
  { id: 's7', name: 'Backofen reinigen', freq: 'weekly', done: false },
  { id: 's8', name: 'Fenster putzen', freq: 'weekly', done: false }
];
const $ = (selector) => document.querySelector(selector);
function readStorage(key) { try { return localStorage.getItem(key); } catch { return null; } }
function writeStorage(key, value) { try { localStorage.setItem(key, value); } catch { /* App bleibt auch ohne Speicher nutzbar. */ } }
function loadTasks() {
  let saved;
  try { saved = JSON.parse(readStorage(TASKS_KEY)); } catch { saved = null; }
  const list = Array.isArray(saved) ? saved : starter.map(task => ({ ...task }));
  const tasks = list.filter(task => !(task.id === 's3' && task.name === 'Müll rausbringen'));
  for (const task of tasks) if (!['weekly', 'biweekly', 'monthly'].includes(task.freq)) task.freq = 'weekly';
  const monthlyCounts = [1, 2, 3, 4].map(week => tasks.filter(task => task.freq === 'monthly' && task.week === week).length);
  for (const task of tasks.filter(task => task.freq === 'monthly' && ![1, 2, 3, 4].includes(task.week))) { const week = monthlyCounts.indexOf(Math.min(...monthlyCounts)); task.week = week + 1; monthlyCounts[week]++; }
  if (!tasks.some(task => task.name === 'Bio-Müll leeren')) tasks.push({ id: 's3', name: 'Bio-Müll leeren', freq: 'weekly', done: false });
  if (!tasks.some(task => task.name === 'Kompost-Müll leeren')) tasks.push({ id: 's9', name: 'Kompost-Müll leeren', freq: 'weekly', done: false });
  return tasks;
}
let tasks = loadTasks();
function persist() { writeStorage(TASKS_KEY, JSON.stringify(tasks)); }
function currentWeeklyCycle(date = new Date()) {
  const monday = new Date(date);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  monday.setHours(18, 0, 0, 0);
  if (date < monday) monday.setDate(monday.getDate() - 7);
  return `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`;
}
function checkForWeeklyReset() {
  const cycle = currentWeeklyCycle();
  const lastReset = readStorage(RESET_KEY);
  if (lastReset === null) { writeStorage(RESET_KEY, cycle); return false; }
  if (lastReset === cycle) return false;
  tasks = tasks.map(task => ({ ...task, done: false }));
  persist();
  writeStorage(RESET_KEY, cycle);
  render();
  showToast('Neue Woche – Aufgaben zurückgesetzt');
  return true;
}
function renderTaskRow(task, root) {
  const row = document.createElement('div');
  row.className = 'task' + (task.done ? ' done' : '');
  const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.className = 'check'; checkbox.checked = !!task.done;
  checkbox.setAttribute('aria-label', task.name + ' erledigt');
  checkbox.addEventListener('change', () => { task.done = checkbox.checked; persist(); render(); if (task.done) showToast('Aufgabe abgehakt ✓'); });
  const name = document.createElement('span'); name.className = 'task-name'; name.textContent = task.name;
  const frequencyLabel = document.createElement('span'); frequencyLabel.className = 'frequency-label';
  frequencyLabel.textContent = task.freq === 'biweekly' ? 'Alle 2 Wochen' : task.freq === 'monthly' ? `Monatlich · Woche ${task.week}` : 'Wöchentlich';
  const remove = document.createElement('button'); remove.className = 'remove'; remove.type = 'button'; remove.textContent = '×'; remove.setAttribute('aria-label', task.name + ' entfernen');
  remove.addEventListener('click', () => { tasks = tasks.filter(item => item.id !== task.id); persist(); render(); });
  row.append(checkbox, name, frequencyLabel, remove); root.append(row);
}
function render() {
  const nextMonday = new Date(); nextMonday.setHours(0, 0, 0, 0);
  nextMonday.setDate(nextMonday.getDate() + ((8 - nextMonday.getDay()) % 7 || 7));
  $('#mondayDate').textContent = new Intl.DateTimeFormat('de-DE', { weekday: 'long', day: 'numeric', month: 'long' }).format(nextMonday);
  const mondayItems = $('#mondayItems'); mondayItems.innerHTML = '';
  const dateForWeek = new Date(Date.UTC(nextMonday.getFullYear(), nextMonday.getMonth(), nextMonday.getDate()));
  dateForWeek.setUTCDate(dateForWeek.getUTCDate() + 4 - (dateForWeek.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(dateForWeek.getUTCFullYear(), 0, 1));
  const isoWeek = Math.ceil((((dateForWeek - yearStart) / 86400000) + 1) / 7);
  const monthWeek = Math.min(4, Math.ceil(nextMonday.getDate() / 7));
  const mondayTasks = tasks.filter(task => task.freq === 'weekly' || (task.freq === 'biweekly' && isoWeek % 2 === 1) || (task.freq === 'monthly' && task.week === monthWeek));
  if (!mondayTasks.length) mondayItems.innerHTML = '<div class="empty">Für diesen Montag sind keine Aufgaben vorgesehen.</div>';
  else for (const task of mondayTasks) renderTaskRow(task, mondayItems);
  const root = $('#groups'); root.innerHTML = '';
  for (const group of groups) {
    const list = tasks.filter(task => task.freq === group.id);
    const section = document.createElement('article'); section.className = 'group';
    section.innerHTML = `<div class="group-head"><div class="gtitle"><span class="dot"></span>${group.title}</div><span class="count">${list.length} ${list.length === 1 ? 'Aufgabe' : 'Aufgaben'}</span></div><div class="items"></div>`;
    const items = section.querySelector('.items');
    if (group.id === 'monthly' && list.length) {
      for (let week = 1; week <= 4; week++) {
        const weekTasks = list.filter(task => task.week === week);
        const block = document.createElement('section'); block.className = 'month-week';
        block.innerHTML = `<div class="week-title">Woche ${week}<span>${weekTasks.length}</span></div><div class="week-items"></div>`;
        const weekItems = block.querySelector('.week-items');
        if (weekTasks.length) for (const task of weekTasks) renderTaskRow(task, weekItems);
        else weekItems.innerHTML = '<div class="empty week-empty">Keine Aufgabe</div>';
        items.append(block);
      }
    } else if (!list.length) items.innerHTML = '<div class="empty">Noch keine Aufgaben</div>';
    else for (const task of list) renderTaskRow(task, items);
    root.append(section);
  }
  const done = tasks.filter(task => task.done).length;
  $('#progressText').innerHTML = `<b>${done}</b> von ${tasks.length} erledigt`;
  $('#progressFill').style.width = (tasks.length ? done / tasks.length * 100 : 0) + '%';
}
const today = new Intl.DateTimeFormat('de-DE', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());
$('#today').textContent = today.charAt(0).toUpperCase() + today.slice(1);
let toastTimer;
function showToast(message) { const toast = $('#toast'); toast.textContent = message; toast.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove('show'), 2200); }
let frequency = 'weekly';
function closeModal() { $('#overlay').classList.remove('show'); $('#form').reset(); frequency = 'weekly'; document.querySelectorAll('.choice').forEach(button => button.classList.toggle('selected', button.dataset.freq === frequency)); }
document.querySelectorAll('.choice').forEach(button => button.addEventListener('click', () => { frequency = button.dataset.freq; document.querySelectorAll('.choice').forEach(choice => choice.classList.toggle('selected', choice === button)); }));
$('#addBtn').addEventListener('click', () => { $('#overlay').classList.add('show'); $('#taskInput').focus(); });
$('#cancel').addEventListener('click', closeModal);
$('#overlay').addEventListener('click', event => { if (event.target.id === 'overlay') closeModal(); });
$('#form').addEventListener('submit', event => {
  event.preventDefault();
  const name = $('#taskInput').value.trim();
  if (!name) return;
  const monthlyCounts = [1, 2, 3, 4].map(week => tasks.filter(task => task.freq === 'monthly' && task.week === week).length);
  const week = frequency === 'monthly' ? monthlyCounts.indexOf(Math.min(...monthlyCounts)) + 1 : undefined;
  tasks.push({ id: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`, name, freq: frequency, ...(week ? { week } : {}), done: false });
  persist(); render(); closeModal(); showToast('Aufgabe eingetragen');
});
checkForWeeklyReset();
persist();
render();
setInterval(checkForWeeklyReset, 60_000);
window.addEventListener('focus', checkForWeeklyReset);



