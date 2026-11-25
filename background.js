/* ORACLE background service worker: keyboard commands and opening the dashboard. Makes no network requests. */
const DASH = chrome.runtime.getURL('dashboard.html');

chrome.commands.onCommand.addListener(async (cmd) => {
  if (cmd !== 'open-palette') return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  try { await chrome.tabs.sendMessage(tab.id, { type: 'oracle:palette' }); }
  catch (e) { chrome.tabs.create({ url: DASH + '#chat' }); } // browser pages can't run content scripts
});

chrome.runtime.onMessage.addListener((msg) => {
  if (msg && msg.type === 'oracle:openDashboard') chrome.tabs.create({ url: DASH + (msg.hash || '#chat') });
});

chrome.runtime.onInstalled.addListener((d) => {
  if (d.reason === 'install') chrome.tabs.create({ url: DASH + '#welcome' });
});
