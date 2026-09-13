const DEFAULT_ANALYTICS = {
  sessionsStarted: 0,
  tasksCompleted: 0,
  distractionsCaught: 0,
  distractionsToday: 0,
  distractionDate: "",
  distractionsClosedTab: 0,
  totalMinutesSaved: 0,
  recentSessions: []
};

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(["analytics", "frictionActive"], (data) => {
    const updates = {};
    if (!data.analytics) updates.analytics = DEFAULT_ANALYTICS;
    if (typeof data.frictionActive !== "boolean") updates.frictionActive = true;
    if (Object.keys(updates).length) chrome.storage.local.set(updates);
  });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "SET_SESSION_ALARM" && sender.tab?.id) {
    const alarmName = `friction-flow-session-${sender.tab.id}`;
    chrome.alarms.create(alarmName, { delayInMinutes: Math.max(message.durationMinutes || 1, 1 / 60) });
    sendResponse({ ok: true });
  }

  if (message.action === "CANCEL_SESSION_ALARM" && sender.tab?.id) {
    chrome.alarms.clear(`friction-flow-session-${sender.tab.id}`);
    sendResponse({ ok: true });
  }

  if (message.action === "SESSION_RESULT") {
    recordSessionResult(message.result, message.minutesSaved || 0, () => sendResponse({ ok: true }));
    return true;
  }

  if (message.action === "CLOSE_TAB" && sender.tab?.id) {
    chrome.tabs.remove(sender.tab.id);
    sendResponse({ ok: true });
  }

  if (message.action === "UPDATE_BADGE" && sender.tab?.id) {
    chrome.action.setBadgeText({ text: message.text || "", tabId: sender.tab.id });
    chrome.action.setBadgeBackgroundColor({ color: "#d1ae65", tabId: sender.tab.id });
    sendResponse({ ok: true });
  }

  if (message.action === "CLEAR_BADGE" && sender.tab?.id) {
    chrome.action.setBadgeText({ text: "", tabId: sender.tab.id });
    sendResponse({ ok: true });
  }

  return true;
});

chrome.tabs.onRemoved.addListener((tabId) => {
  chrome.alarms.clear(`friction-flow-session-${tabId}`);
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (!alarm.name.startsWith("friction-flow-session-")) return;
  const tabId = Number(alarm.name.replace("friction-flow-session-", ""));
  chrome.tabs.sendMessage(tabId, { action: "SESSION_EXPIRED" }).catch(() => {});
});

function recordSessionResult(result, minutesSaved, onComplete) {
  chrome.storage.local.get("analytics", (data) => {
    const analytics = { ...DEFAULT_ANALYTICS, ...(data.analytics || {}) };
    const today = new Date().toISOString().slice(0, 10);
    if (analytics.distractionDate !== today) {
      analytics.distractionsToday = 0;
      analytics.distractionDate = today;
    }
    const session = {
      intent: result.intent,
      outcome: result.outcome,
      durationMinutes: result.durationMinutes,
      finishedAt: Date.now()
    };
    analytics.sessionsStarted += result.started ? 1 : 0;
    analytics.tasksCompleted += result.outcome === "completed" ? 1 : 0;
    analytics.distractionsCaught += result.outcome === "distracted" ? 1 : 0;
    analytics.distractionsToday += result.outcome === "distracted" ? 1 : 0;
    analytics.distractionsClosedTab += result.outcome === "distracted_closed" ? 1 : 0;
    analytics.totalMinutesSaved += result.outcome === "completed" ? minutesSaved : 0;
    if (result.outcome === "distracted_closed") {
      if (analytics.recentSessions?.[0]?.intent === result.intent) {
        analytics.recentSessions[0] = { ...analytics.recentSessions[0], outcome: "distracted_closed" };
      }
    } else {
      analytics.recentSessions = [session, ...(analytics.recentSessions || [])].slice(0, 8);
    }
    chrome.storage.local.set({ analytics }, onComplete);
  });
}
