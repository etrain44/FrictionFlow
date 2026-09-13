(() => {
  if (window.__FRICTION_FLOW_INITIALIZED__) {
    return;
  }
  window.__FRICTION_FLOW_INITIALIZED__ = true;

  const MAX_DAILY_EXTENSION_DISTRACTIONS = 6;
  const STANDARD_EXTENSION_MINUTES = 1;
  const REDUCED_EXTENSION_MINUTES = 0.5;
  const MINIMUM_EXTENSION_MINUTES = 0.25;
  const domain = location.hostname;
  const sessionKey = `frictionFlowSession:${domain}`;
  const host = document.createElement("div");
  host.id = "friction-flow-host";
  const shadow = host.attachShadow({ mode: "open" });
  shadow.innerHTML = `<style>
    :host, * { box-sizing: border-box; }
    .ff-backdrop { position: fixed; inset: 0; display: grid; place-items: center; padding: 24px; background: rgba(7,12,18,.66); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); pointer-events: auto; font-family: Arial,sans-serif; }
    .ff-modal { width: min(440px,100%); padding: 32px; color:#f5f1e8; background:#121a1d; border:1px solid #3e5754; border-radius:18px; box-shadow:0 24px 80px rgba(0,0,0,.5); }
    .ff-kicker { color:#d1ae65; font:700 12px Arial,sans-serif; letter-spacing:1.8px; text-transform:uppercase; }
    h1 { margin:10px 0 12px; color:#f5f1e8; font:700 30px/1.08 Georgia,serif; } p { margin:0 0 24px; color:#b9c4bd; font:14px/1.6 Arial,sans-serif; }
    label { display:block; margin:0 0 8px; color:#e3e9e2; font:700 13px Arial,sans-serif; } textarea, select, input[type=number] { width:100%; color:#f5f1e8; background:#1b2829; border:1px solid #49635e; border-radius:9px; padding:12px; font:14px Arial,sans-serif; outline:none; } textarea { min-height:82px; resize:vertical; } textarea:focus, select:focus, input[type=number]:focus { border-color:#d1ae65; box-shadow:0 0 0 3px rgba(209,174,101,.15); } .ff-duration { margin:18px 0 22px; } .ff-error { min-height:18px; margin:7px 0 0; color:#f0a18f !important; font:12px Arial,sans-serif; }
    button { width:100%; border:0; border-radius:9px; padding:13px 16px; cursor:pointer; font:700 14px Arial,sans-serif; } .ff-primary { color:#12201f; background:#d1ae65; } .ff-primary:hover { background:#e3c981; } .ff-secondary { color:#f5f1e8; background:#304342; } .ff-actions { display:grid; gap:10px; margin-top:22px; } .ff-stat { margin:0 0 22px; padding:14px; color:#dbe7dc; background:#1a2929; border-left:3px solid #d1ae65; border-radius:5px; font:13px/1.5 Arial,sans-serif; }
    .ff-drift-pill { position:fixed; left:50%; top:22px; z-index:2147483647; transform:translateX(-50%); padding:10px 15px; color:#16201d; background:#d1ae65; border:1px solid #f0d18b; border-radius:999px; box-shadow:0 8px 25px rgba(0,0,0,.28); font:700 12px Arial,sans-serif; animation:ff-drift-in .3s ease-out,ff-drift-pulse 2s ease-in-out .3s infinite; pointer-events:none; white-space:nowrap; }
    @keyframes ff-drift-in { from { opacity:0; transform:translate(-50%,-8px); } to { opacity:1; transform:translate(-50%,0); } } @keyframes ff-drift-pulse { 0%,100% { box-shadow:0 8px 25px rgba(0,0,0,.28); } 50% { box-shadow:0 8px 30px rgba(209,174,101,.38); } }
  </style>`;

  function mountHost() {
    const root = document.body || document.documentElement;
    if (root && !root.contains(host)) {
      root.appendChild(host);
    }
  }

  if (document.documentElement) mountHost();
  document.addEventListener("DOMContentLoaded", mountHost, { once: true });

  let session = null;
  let scrollDistance = 0;
  let lastScrollY = window.scrollY;
  const SHORT_FORM_SCROLL_THRESHOLD = 600;
  function getScrollThreshold() {
    return /\/(reels?|shorts)(\/|$)/.test(location.pathname) ? SHORT_FORM_SCROLL_THRESHOLD : Math.max(window.innerHeight * 3, 1500);
  }
  let breathCard = null;
  let breathBackdrop = null;
  let breathTimer = null;
  let driftCheckTimer = null;
  let driftPillTimer = null;
  let badgeTimer = null;
  let isLocked = false;
  let originalBodyOverflow = "";
  if (document.body) {
    originalBodyOverflow = document.body.style.overflow;
  } else {
    document.addEventListener("DOMContentLoaded", () => {
      if (document.body) originalBodyOverflow = document.body.style.overflow;
    }, { once: true });
  }

  const storageGet = (keys) => new Promise((resolve) => chrome.storage.local.get(keys, resolve));
  const storageSet = (values) => new Promise((resolve) => chrome.storage.local.set(values, resolve));

  function applyUtilityMode(active) {
    const styleId = "ff-clean-feed-style";
    const existingStyle = document.getElementById(styleId);
    if (!active) {
      existingStyle?.remove();
      return;
    }
    if (existingStyle) return;
    const style = document.createElement("style");
    style.id = styleId;
    style.textContent = `
      #secondary #related,
      ytd-watch-next-secondary-results-renderer,
      #right-sidebar-container,
      shreddit-feed[pagetype="popular"],
      aside[aria-label="Popular Communities"],
      div[aria-label="Timeline: Trending now"],
      div[aria-label="Who to follow"],
      div[data-testid="sidebarColumn"] section { display: none !important; }
    `;
    (document.head || document.documentElement).appendChild(style);
  }

  function stopDriftScanner() {
    window.clearInterval(driftCheckTimer);
    driftCheckTimer = null;
    window.clearTimeout(driftPillTimer);
    driftPillTimer = null;
    shadow.querySelector(".ff-drift-pill")?.remove();
  }

  function getIntentKeywords(intent) {
    const stopwords = new Set(["about", "after", "again", "also", "because", "before", "being", "between", "could", "from", "have", "here", "into", "just", "more", "need", "only", "please", "that", "their", "there", "these", "they", "this", "through", "want", "were", "what", "when", "where", "which", "while", "with", "would", "your"]);
    return [...new Set(String(intent).toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((word) => word.length > 3 && !stopwords.has(word)))];
  }

  function scanForIntentDrift() {
    if (!session?.sessionActive || isLocked || !session.intent) return;
    const keywords = getIntentKeywords(session.intent);
    if (!keywords.length) return;
    const visibleText = [...document.querySelectorAll("h1, h2, h3, p, a")].filter((element) => {
      const rect = element.getBoundingClientRect();
      return rect.bottom > 0 && rect.top < window.innerHeight && rect.right > 0 && rect.left < window.innerWidth;
    }).map((element) => element.textContent || "").join(" ").toLowerCase();
    const matchedCount = keywords.filter((keyword) => visibleText.includes(keyword)).length;
    if (matchedCount / keywords.length >= 0.5) return;
    shadow.querySelector(".ff-drift-pill")?.remove();
    const pill = document.createElement("div");
    pill.className = "ff-drift-pill";
    pill.textContent = `⚠️ Intent Drift: Looking for "${session.intent}"?`;
    shadow.appendChild(pill);
    window.clearTimeout(driftPillTimer);
    driftPillTimer = window.setTimeout(() => pill.remove(), 7000);
  }

  function startDriftScanner() {
    stopDriftScanner();
    scanForIntentDrift();
    driftCheckTimer = window.setInterval(scanForIntentDrift, 15000);
  }

  function formatBadgeText(remainingMs) {
    if (remainingMs <= 0) return "";
    return remainingMs >= 60000 ? `${Math.ceil(remainingMs / 60000)}m` : `${Math.ceil(remainingMs / 1000)}s`;
  }

  function sendBadgeUpdate() {
    if (!session?.sessionActive) return;
    const remainingMs = session.startedAt + session.durationMinutes * 60000 - Date.now();
    chrome.runtime.sendMessage({ action: "UPDATE_BADGE", text: formatBadgeText(remainingMs) }).catch(() => {});
  }

  function startBadgeTimer() {
    window.clearInterval(badgeTimer);
    sendBadgeUpdate();
    badgeTimer = window.setInterval(sendBadgeUpdate, 1000);
  }

  function clearBadge() {
    window.clearInterval(badgeTimer);
    badgeTimer = null;
    chrome.runtime.sendMessage({ action: "CLEAR_BADGE" }).catch(() => {});
  }

  function lockPage() {
    isLocked = true;
    stopDriftScanner();
    if (document.body) {
      if (!originalBodyOverflow) originalBodyOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
    }
  }

  function unlockPage() {
    isLocked = false;
    if (document.body) {
      document.body.style.overflow = originalBodyOverflow;
    }
  }

  function renderIntentModal() {
    pauseMedia();
    if (document.activeElement instanceof HTMLElement && !host.contains(document.activeElement)) {
      document.activeElement.blur();
    }
    lockPage();
    shadow.innerHTML += `<div class="ff-backdrop" id="ff-intent-backdrop"><form class="ff-modal" id="ff-intent-form">
      <div class="ff-kicker">A small pause before the feed</div>
      <h1>Beyond The Feed: State Your Intent</h1>
      <p>Give this visit a job. A clear intention makes it easier to notice when the useful part is over.</p>
      <label for="ff-intent">What specific task brings you here?</label>
      <textarea id="ff-intent" minlength="5" required placeholder="I am here to..."></textarea>
      <p class="ff-error" id="ff-intent-error"></p>
      <div class="ff-duration"><label for="ff-duration-select">Time budget</label><select id="ff-duration-select"><option value="1">1 min · demo mode</option><option value="3">3 min</option><option value="5">5 min</option><option value="10">10 min</option><option value="15">15 min</option><option value="custom">Custom</option></select><div id="ff-custom-time-wrap" style="display:none;margin-top:10px"><label for="ff-custom-time">Custom minutes</label><input id="ff-custom-time" type="number" min="1" max="120" step="1" placeholder="1–120 minutes"><p class="ff-error" id="ff-custom-time-error"></p></div></div>
      <button class="ff-primary" type="submit">Begin Focused Session</button>
      <button class="ff-secondary" id="ff-preview" type="button">Try 30-second preview</button>
    </form></div>`;
    shadow.getElementById("ff-intent-form").addEventListener("submit", beginSession);
    shadow.getElementById("ff-preview").addEventListener("click", beginPreview);
    shadow.getElementById("ff-duration-select").addEventListener("change", toggleCustomTime);
    shadow.getElementById("ff-intent").focus();
  }

  function toggleCustomTime(event) {
    shadow.getElementById("ff-custom-time-wrap").style.display = event.target.value === "custom" ? "block" : "none";
  }

  async function beginPreview() {
    await startSession("30-second preview", 0.5, true);
  }

  async function beginSession(event) {
    event.preventDefault();
    const intentInput = shadow.getElementById("ff-intent");
    const intent = intentInput.value.trim();
    if (intent.length < 5) {
      shadow.getElementById("ff-intent-error").textContent = "Please name a specific task (at least 5 characters).";
      intentInput.focus();
      return;
    }
    const durationSelect = shadow.getElementById("ff-duration-select");
    const customTime = shadow.getElementById("ff-custom-time");
    const durationMinutes = durationSelect.value === "custom" ? Number(customTime.value) : Number(durationSelect.value);
    if (!Number.isInteger(durationMinutes) || durationMinutes < 1 || durationMinutes > 120) {
      shadow.getElementById("ff-custom-time-error").textContent = "Choose a whole number from 1 to 120 minutes.";
      customTime.focus();
      return;
    }
    await startSession(intent, durationMinutes, false);
  }

  async function startSession(intent, durationMinutes, isPreview) {
    session = { intent, durationMinutes, isPreview, startedAt: Date.now(), sessionActive: true, domain };
    await storageSet({ [sessionKey]: session });
    if (!isPreview) await incrementStarted();
    chrome.runtime.sendMessage({ action: "SET_SESSION_ALARM", durationMinutes }).catch(() => {});
    shadow.getElementById("ff-intent-backdrop").remove();
    unlockPage();
    resetThreshold();
    startDriftScanner();
    startBadgeTimer();
  }

  async function incrementStarted() {
    const data = await storageGet("analytics");
    const analytics = data.analytics || { sessionsStarted: 0, tasksCompleted: 0, distractionsCaught: 0, totalMinutesSaved: 0, recentSessions: [] };
    analytics.sessionsStarted += 1;
    await storageSet({ analytics });
  }

  function renderReflection() {
    if (shadow.getElementById("ff-reflection-backdrop")) return;
    lockPage();
    const safeIntent = escapeHtml(session?.intent || "your task");
    shadow.innerHTML += `<div class="ff-backdrop" id="ff-reflection-backdrop"><section class="ff-modal">
      <div class="ff-kicker">Session complete</div><h1>Time is up.</h1>
      <p>Your stated intent was: <strong>“${safeIntent}”</strong></p>
      <p>Did you complete what you came here to do?</p>
      <div class="ff-actions"><button class="ff-primary" id="ff-done">Yes, I am done</button><button class="ff-secondary" id="ff-distracted">No, I got distracted</button></div>
    </section></div>`;
    shadow.getElementById("ff-done").addEventListener("click", () => finishSession("completed"));
    shadow.getElementById("ff-distracted").addEventListener("click", showDistractionStats);
  }

  async function showDistractionStats() {
    const modal = shadow.querySelector("#ff-reflection-backdrop .ff-modal");
    if (session.isPreview) {
      modal.innerHTML = `<div class="ff-kicker">Preview complete</div><h1>That was a test run.</h1><p class="ff-stat">Your 30-second preview is not included in FrictionFlow analytics.</p><div class="ff-actions"><button class="ff-primary" id="ff-preview-extension">Grant 1-minute extension</button><button class="ff-secondary" id="ff-preview-close">Close this tab</button></div>`;
      modal.querySelector("#ff-preview-extension").addEventListener("click", grantExtension);
      modal.querySelector("#ff-preview-close").addEventListener("click", () => chrome.runtime.sendMessage({ action: "CLOSE_TAB" }).catch(() => {}));
      return;
    }
    const data = await storageGet("analytics") || {};
    const analytics = data.analytics && typeof data.analytics === "object" ? data.analytics : { sessionsStarted: 0, tasksCompleted: 0, distractionsCaught: 0, distractionsToday: 0, recentSessions: [] };
    const caught = analytics.distractionsCaught + 1;
    const today = `${new Date().getUTCFullYear()}-${String(new Date().getUTCMonth() + 1).padStart(2, "0")}-${String(new Date().getUTCDate()).padStart(2, "0")}`;
    const previousDistractionsToday = analytics.distractionDate === today ? analytics.distractionsToday || 0 : 0;
    const distractionsToday = previousDistractionsToday + 1;
    const extensionMarkup = distractionsToday >= MAX_DAILY_EXTENSION_DISTRACTIONS
      ? `<p class="ff-stat">You have reached today's extension limit. Close this tab to protect your attention.</p>`
      : `<button class="ff-primary" id="ff-extension">Grant a shorter extension</button>`;
    const severity = distractionsToday === 1
      ? { kicker: "Pattern noticed", headline: "You caught the drift." }
      : distractionsToday <= 3
      ? { kicker: "Pattern repeating", headline: "This is becoming a habit." }
      : { kicker: "Losing the thread", headline: "The feed is winning." };
    const body = distractionsToday === 1
      ? "You can take one full minute if you still need it."
      : distractionsToday <= 3
      ? "Your next extension will be shorter — this is turning into a pattern."
      : "The feed keeps winning these. Closing the tab is the stronger move here.";
    modal.innerHTML = `<div class="ff-kicker">${severity.kicker}</div><h1>${severity.headline}</h1><p class="ff-stat">This is distraction #${caught} logged by FrictionFlow. ${body}</p><div class="ff-actions">${extensionMarkup}<button class="ff-secondary" id="ff-close">Close this tab</button></div>`;
    await chrome.runtime.sendMessage({ action: "SESSION_RESULT", result: { intent: session.intent, outcome: "distracted", durationMinutes: session.durationMinutes, started: false }, minutesSaved: 0 }).catch(() => {});
    modal.querySelector("#ff-extension")?.addEventListener("click", grantExtension);
    modal.querySelector("#ff-close").addEventListener("click", () => {
      chrome.runtime.sendMessage({ action: "SESSION_RESULT", result: { intent: session.intent, outcome: "distracted_closed", durationMinutes: session.durationMinutes, started: false }, minutesSaved: 0 }).catch(() => {});
      chrome.runtime.sendMessage({ action: "CLOSE_TAB" }).catch(() => {});
    });
  }

  async function grantExtension() {
    const data = await storageGet("analytics") || {};
    const analytics = data.analytics && typeof data.analytics === "object" ? data.analytics : {};
    const today = `${new Date().getUTCFullYear()}-${String(new Date().getUTCMonth() + 1).padStart(2, "0")}-${String(new Date().getUTCDate()).padStart(2, "0")}`;
    const distractionsToday = analytics.distractionDate === today ? analytics.distractionsToday || 0 : 0;
    if (distractionsToday >= MAX_DAILY_EXTENSION_DISTRACTIONS) return;
    const extensionMinutes = distractionsToday === 1 ? STANDARD_EXTENSION_MINUTES : distractionsToday <= 3 ? REDUCED_EXTENSION_MINUTES : MINIMUM_EXTENSION_MINUTES;
    session = { ...session, durationMinutes: extensionMinutes, startedAt: Date.now(), sessionActive: true };
    await storageSet({ [sessionKey]: session });
    chrome.runtime.sendMessage({ action: "SET_SESSION_ALARM", durationMinutes: extensionMinutes }).catch(() => {});
    shadow.getElementById("ff-reflection-backdrop")?.remove();
    unlockPage();
    resetThreshold();
    startDriftScanner();
    startBadgeTimer();
  }

  async function finishSession(outcome) {
    const finishedSession = { ...session, sessionActive: false };
    await storageSet({ [sessionKey]: finishedSession });
    if (!session.isPreview) {
      chrome.runtime.sendMessage({ action: "SESSION_RESULT", result: { intent: session.intent, outcome, durationMinutes: session.durationMinutes, started: true }, minutesSaved: session.durationMinutes }).catch(() => {});
    }
    if (outcome === "completed") {
      document.body.innerHTML = `<main style="display:grid;place-items:center;min-height:100vh;background:#12201f;color:#edf4ec;font:16px Arial,sans-serif;text-align:center;padding:24px"><div><p style="color:#d1ae65;text-transform:uppercase;letter-spacing:2px;font-size:12px">FrictionFlow</p><h1 style="font:42px Georgia,serif">You made room for what mattered.</h1><p>Your session is complete. This tab can be closed.</p></div></main>`;
      shadow.innerHTML = "";
      stopDriftScanner();
      clearBadge();
      unlockPage();
    }
  }

  function resetThreshold() {
    scrollDistance = 0;
    lastScrollY = window.scrollY;
  }

  function blockFeedInput(event) {
    const modalVisible = Boolean(shadow.querySelector(".ff-backdrop"));
    if (!breathCard && !modalVisible) return;
    if (event.composedPath().includes(host)) return;
    if (breathCard && event.type === "keydown" && event.target.closest?.("button, input, textarea, select")) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
  }

  function stopHostBubble(event) {
    event.stopPropagation();
  }

  function showBreathCard() {
    if (breathCard || isLocked) return;
    pauseMedia();
    breathBackdrop = document.createElement("div");
    breathBackdrop.className = "ff-page-bump-backdrop";
    breathBackdrop.setAttribute("aria-hidden", "true");
    breathBackdrop.style.cssText = "position:fixed;inset:0;z-index:2147483645;background:rgba(7,12,18,.2);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);pointer-events:auto";
    document.body.appendChild(breathBackdrop);
    breathCard = document.createElement("aside");
    breathCard.className = "ff-page-bump";
    breathCard.style.cssText = "position:fixed;left:50%;bottom:28px;transform:translateX(-50%);z-index:2147483646;width:min(420px,calc(100% - 32px));padding:20px;color:#edf4ec;background:#12201f;border:1px solid #52766e;border-radius:14px;box-shadow:0 18px 50px rgba(0,0,0,.35);font-family:Arial,sans-serif";
    breathCard.innerHTML = `<h2 style="margin:0 0 7px;font:700 19px Georgia,serif">You've reached your feed threshold for this page.</h2><p style="margin:0 0 15px;color:#b9c4bd;font-size:13px">Take a 5-second breath before deciding what comes next.</p><div style="display:flex;align-items:center;justify-content:space-between;gap:12px"><span class="ff-bump-timer" style="min-width:28px;color:#d1ae65;font-size:22px;font-weight:700;text-align:center">5</span><button class="ff-bump-proceed" disabled style="width:auto;border:0;border-radius:9px;padding:10px 15px;color:#12201f;background:#5b6259;cursor:not-allowed;font-weight:700">Proceed</button></div>`;
    document.body.appendChild(breathCard);
    const timer = breathCard.querySelector(".ff-bump-timer");
    const proceed = breathCard.querySelector(".ff-bump-proceed");
    let remaining = 5;
    breathTimer = window.setInterval(() => {
      remaining -= 1;
      timer.textContent = remaining;
      if (remaining <= 0) {
        window.clearInterval(breathTimer);
        proceed.disabled = false;
        proceed.style.background = "#d1ae65";
        proceed.style.cursor = "pointer";
      }
    }, 1000);
    proceed.addEventListener("click", () => {
      window.clearInterval(breathTimer);
      breathBackdrop?.remove();
      breathBackdrop = null;
      breathCard.remove();
      breathCard = null;
      resetThreshold();
    });
  }

  function trackScroll() {
    if (!session?.sessionActive || isLocked || breathCard) return;
    const currentY = window.scrollY;
    const delta = currentY - lastScrollY;
    if (delta > 0) scrollDistance += delta;
    lastScrollY = currentY;
    if (scrollDistance >= getScrollThreshold()) {
      window.scrollTo({ top: Math.max(0, currentY - Math.min(delta, 120)), behavior: "instant" });
      showBreathCard();
    }
  }

  function pauseMedia() {
    document.querySelectorAll("video, audio").forEach((media) => {
      try { media.pause(); } catch (error) { /* Some embedded players reject script control. */ }
    });
  }

  function escapeHtml(value) { return value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", "\"": "&quot;" }[character])); }

  chrome.runtime.onMessage.addListener((message) => {
    if (message.action === "FORCE_SPEED_BUMP") showBreathCard();
    if (message.action === "TOGGLE_UTILITY_MODE") applyUtilityMode(message.active);
    if (message.action === "SESSION_EXPIRED" && session?.sessionActive) {
      session.sessionActive = false;
      storageSet({ [sessionKey]: session });
      pauseMedia();
      stopDriftScanner();
      clearBadge();
      if (session.isPreview) {
        session = null;
        renderIntentModal();
        return;
      }
      renderReflection();
    }
  });

  let scrollTick = false;
  window.addEventListener("scroll", () => {
    if (scrollTick) return;
    scrollTick = true;
    window.requestAnimationFrame(() => { trackScroll(); scrollTick = false; });
  }, { passive: true });
  window.addEventListener("wheel", blockFeedInput, { capture: true, passive: false });
  window.addEventListener("touchmove", blockFeedInput, { capture: true, passive: false });
  window.addEventListener("keydown", blockFeedInput, { capture: true });
  window.addEventListener("keypress", blockFeedInput, { capture: true });
  window.addEventListener("keyup", blockFeedInput, { capture: true });
  document.addEventListener("keydown", blockFeedInput, { capture: true });
  document.addEventListener("keypress", blockFeedInput, { capture: true });
  document.addEventListener("keyup", blockFeedInput, { capture: true });
  host.addEventListener("keydown", stopHostBubble);
  host.addEventListener("keypress", stopHostBubble);
  host.addEventListener("keyup", stopHostBubble);

  (async function initialize() {
    const data = await storageGet([sessionKey, "frictionActive", "utilityModeActive"]);
    applyUtilityMode(data.utilityModeActive === true);
    if (data.frictionActive === false) { clearBadge(); return; }
    const storedSession = data[sessionKey];
    if (storedSession?.sessionActive && Date.now() < storedSession.startedAt + storedSession.durationMinutes * 60000) {
      session = storedSession;
      startDriftScanner();
      startBadgeTimer();
      return;
    }
    clearBadge();
    renderIntentModal();
  })();
})();
