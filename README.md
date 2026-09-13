# FrictionFlow

**Intentional friction for a more mindful web — paired with Replenish, its rewards companion.**

Built for **HackWesTX 2026**, themed *"Beyond the Feed."* FrictionFlow is a Chrome extension that asks you to name what you're actually here to do before an algorithmic feed gets the chance to answer that question for you. Replenish is a desktop app that turns your real, completed FrictionFlow sessions into a weekly reserve of focus credits you spend on the platforms FrictionFlow watches.

## The problem

Reddit, X, Instagram, and YouTube are built to remove the moment where you'd normally decide to stop. Endless feeds, autoplay, and short-form video strip away natural stopping cues so scrolling continues by default instead of by choice. FrictionFlow reintroduces that choice point — and Replenish gives it stakes.

## FrictionFlow (browser extension)

- **Intent Modal** — before you can scroll any supported site, you're asked what specific task brought you here and given a time budget for it, with a 30-second preview mode for quick demos.
- **Feed Speed Bump** — once you've scrolled past a threshold, the page pulls back and asks for a 5-second breath before continuing.
- **Intent Drift Detection** — periodically checks whether the visible page content still relates to your stated intent and surfaces a reminder if it doesn't.
- **Session Reflection** — asks directly whether you completed your task. A "no" logs a distraction and shows the pattern forming across the day.
- **Escalating Extensions** — repeated distractions in the same day get progressively shorter extension grants, with a hard daily cap. Closing the tab instead of extending is tracked as its own, distinct outcome.
- **Pure Utility Mode** — strips recommendation rails and algorithmic sidebars per-site, scoped to what's actually a "suggestion" rather than a site's core content (e.g. YouTube's watch-page sidebar, not the whole homepage).
- **Toolbar Badge Countdown** — the extension icon shows time remaining during an active session.
- **Export for Replenish** — one click saves a snapshot of your session data for the companion app to import.
- **Judge Demo Controls** — quickly trigger a speed bump, force-expire the timer, or load sample analytics for demoing without waiting out real timers.

## Replenish (desktop companion app)

- **Weekly focus credits** — a spendable reserve that resets weekly, with recovery messaging when it runs dry.
- **Small wins** — nine repeatable real-world actions (reading, exercise, journaling, etc.) that earn credits on every completion, with an optional photo-proof bonus you're prompted for right after completing one.
- **Mindful spending** — the four apps you spend credits on are the same platforms FrictionFlow tracks (Reddit, X, Instagram, YouTube), fully editable in Manage mode.
- **Import from FrictionFlow** — pulls in your exported session file and converts it into real activity: completed sessions and self-caught distractions earn credits automatically.
- **History, calendar, and themes** — a full activity log, a monthly calendar view, and ten selectable themes including a default FrictionFlow-gold theme that matches the extension's look.

## Installation

**Extension (unpacked/dev):**
1. Go to `chrome://extensions`, enable Developer mode.
2. Click **Load unpacked**, select the `frictionflow-extension` folder.

**Replenish (dev mode, no build needed):**
```
cd replenish-app
npm install
npm start
```

## Tech

- **FrictionFlow**: Manifest V3 Chrome extension — `chrome.storage`, `chrome.alarms`, `chrome.action`, and `chrome.downloads` for session state, timers, the badge countdown, and exporting data to Replenish. A shadow-DOM content script keeps the UI isolated from every host page.
- **Replenish**: Electron desktop app with a secure `contextIsolation` preload bridge for native file import, no external dependencies beyond Electron itself.
