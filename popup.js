const DEFAULT_ANALYTICS = { sessionsStarted: 0, tasksCompleted: 0, distractionsCaught: 0, distractionsClosedTab: 0, totalMinutesSaved: 0, recentSessions: [] };
let activeSessionTimer = null;
let activeTab = null;

const getStorage = (keys) => new Promise((resolve) => chrome.storage.local.get(keys, resolve));
const setStorage = (values) => new Promise((resolve) => chrome.storage.local.set(values, resolve));

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", "\"": "&quot;" }[character]));
}

function formatSessionTime(timestamp) {
  if (!timestamp) return "Time unavailable";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(timestamp));
}

function formatCountdown(milliseconds) {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return hours ? `${hours}h ${String(minutes).padStart(2, "0")}m ${String(seconds).padStart(2, "0")}s remaining` : `${minutes}m ${String(seconds).padStart(2, "0")}s remaining`;
}

function outcomeLabel(outcome) {
  if (outcome === "completed") return "Completed";
  if (outcome === "distracted_closed") return "Closed it";
  return "Distracted";
}

function outcomeClass(outcome) {
  if (outcome === "completed") return "completed";
  if (outcome === "distracted_closed") return "closed";
  return "distracted";
}

function renderActiveSession(session) {
  const panel = document.getElementById("active-session");
  const intent = document.getElementById("active-intent");
  const countdown = document.getElementById("active-countdown");
  if (!session) {
    panel.classList.remove("visible");
    window.clearInterval(activeSessionTimer);
    activeSessionTimer = null;
    return;
  }
  const endTime = session.startedAt + session.durationMinutes * 60000;
  const update = () => {
    const remaining = endTime - Date.now();
    if (remaining <= 0) {
      panel.classList.remove("visible");
      window.clearInterval(activeSessionTimer);
      activeSessionTimer = null;
      return;
    }
    panel.classList.add("visible");
    intent.textContent = session.intent;
    countdown.textContent = formatCountdown(remaining);
  };
  window.clearInterval(activeSessionTimer);
  update();
  if (panel.classList.contains("visible")) activeSessionTimer = window.setInterval(update, 1000);
}

async function getActiveTabSession() {
  const tabs = await new Promise((resolve) => chrome.tabs.query({ active: true, currentWindow: true }, resolve));
  const tab = tabs[0];
  activeTab = tab || null;
  if (!tab?.url) return null;
  try {
    const domain = new URL(tab.url).hostname;
    const data = await getStorage(`frictionFlowSession:${domain}`);
    const session = data[`frictionFlowSession:${domain}`];
    return session?.sessionActive && Date.now() < session.startedAt + session.durationMinutes * 60000 ? session : null;
  } catch (error) {
    return null;
  }
}

async function render() {
  const data = await getStorage(["analytics", "frictionActive", "utilityModeActive"]);
  const analytics = { ...DEFAULT_ANALYTICS, ...(data.analytics || {}) };
  const totalOutcomes = analytics.tasksCompleted + analytics.distractionsCaught;
  const completionRate = totalOutcomes ? Math.round((analytics.tasksCompleted / totalOutcomes) * 100) : 0;
  document.getElementById("sessions-value").textContent = analytics.sessionsStarted;
  document.getElementById("completion-value").textContent = `${completionRate}%`;
  document.getElementById("distractions-value").textContent = analytics.distractionsCaught;
  document.getElementById("saved-value").textContent = `${analytics.totalMinutesSaved}m focused`;
  document.getElementById("closed-value").textContent = `${analytics.distractionsClosedTab || 0} closed`;
  document.getElementById("friction-toggle").checked = data.frictionActive !== false;
  document.getElementById("utility-toggle").checked = data.utilityModeActive === true;
  renderActiveSession(await getActiveTabSession());
  const list = document.getElementById("recent-list");
  list.innerHTML = analytics.recentSessions.length ? analytics.recentSessions.slice(0, 5).map((entry) => `<details class="recent-item"><summary><span class="recent-intent">${escapeHtml(entry.intent)}</span><span class="outcome ${outcomeClass(entry.outcome)}">${outcomeLabel(entry.outcome)}</span></summary><div class="recent-details"><p>${escapeHtml(entry.intent)}</p><time datetime="${entry.finishedAt ? new Date(entry.finishedAt).toISOString() : ""}">${formatSessionTime(entry.finishedAt)}</time></div></details>`).join("") : `<p class="empty">Your first intentional session starts here.</p>`;
}

function sendToActiveTab(message) {
  if (!activeTab?.id) {
    document.getElementById("feedback").textContent = "Open a supported site first.";
    return;
  }
  chrome.tabs.sendMessage(activeTab.id, message).catch(() => {
    document.getElementById("feedback").textContent = "This control is unavailable on the current page.";
  });
}

document.getElementById("friction-toggle").addEventListener("change", (event) => {
  setStorage({ frictionActive: event.target.checked });
  document.getElementById("feedback").textContent = event.target.checked ? "Friction is active." : "Friction is paused.";
});

document.getElementById("utility-toggle").addEventListener("change", (event) => {
  setStorage({ utilityModeActive: event.target.checked });
  sendToActiveTab({ action: "TOGGLE_UTILITY_MODE", active: event.target.checked });
});

document.getElementById("demo-speed-bump").addEventListener("click", () => sendToActiveTab({ action: "FORCE_SPEED_BUMP" }));
document.getElementById("demo-expire").addEventListener("click", () => sendToActiveTab({ action: "SESSION_EXPIRED" }));
document.getElementById("demo-mock-data").addEventListener("click", async () => {
  const data = await getStorage("analytics");
  const now = Date.now();
  const analytics = { ...DEFAULT_ANALYTICS, ...(data.analytics || {}) };
  analytics.sessionsStarted = Math.max(analytics.sessionsStarted, 12);
  analytics.tasksCompleted = Math.max(analytics.tasksCompleted, 8);
  analytics.distractionsCaught = Math.max(analytics.distractionsCaught, 4);
  analytics.totalMinutesSaved = Math.max(analytics.totalMinutesSaved, 37);
  analytics.recentSessions = [
    { intent: "Compare two research sources", outcome: "completed", durationMinutes: 5, finishedAt: now - 3600000 },
    { intent: "Watch the launch walkthrough", outcome: "distracted", durationMinutes: 3, finishedAt: now - 7200000 },
    { intent: "Reply to the project thread", outcome: "completed", durationMinutes: 10, finishedAt: now - 86400000 },
    ...(analytics.recentSessions || [])
  ].slice(0, 8);
  await setStorage({ analytics });
  document.getElementById("feedback").textContent = "Demo analytics loaded.";
  render();
});

document.getElementById("clear-data").addEventListener("click", async () => {
  await setStorage({ analytics: DEFAULT_ANALYTICS });
  document.getElementById("feedback").textContent = "Session data cleared.";
  render();
});

document.getElementById("sync-export").addEventListener("click", async () => {
  const data = await getStorage("analytics");
  const analytics = { ...DEFAULT_ANALYTICS, ...(data.analytics || {}) };
  const payload = {
    source: "FrictionFlow",
    exportedAt: Date.now(),
    totalMinutesSaved: analytics.totalMinutesSaved,
    tasksCompleted: analytics.tasksCompleted,
    distractionsCaught: analytics.distractionsCaught,
    distractionsClosedTab: analytics.distractionsClosedTab,
    recentSessions: analytics.recentSessions || []
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const status = document.getElementById("sync-status");
  chrome.downloads.download({ url, filename: "frictionflow-sync.json", saveAs: false, conflictAction: "overwrite" }, (downloadId) => {
    URL.revokeObjectURL(url);
    status.textContent = downloadId ? "Exported to Downloads/frictionflow-sync.json" : "Export failed — check download permissions.";
  });
});

render();
