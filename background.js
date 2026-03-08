/**
 * background.js — Manifest V3 Service Worker
 *
 * Listens for the extension icon click and forwards a message
 * to the content script running on the active tab.
 * The content script will validate the URL and run the autofill logic.
 */

chrome.action.onClicked.addListener(async (tab) => {
  // Only proceed if the active tab has a valid ID
  if (!tab.id) return;

  try {
    await chrome.tabs.sendMessage(tab.id, { action: "runAutofill" });
  } catch (err) {
    // Content script may not be injected yet (e.g. on a non-matching page).
    console.warn("[Flee Autofill] Could not reach content script:", err.message);
  }
});
