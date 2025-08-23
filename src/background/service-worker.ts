import { BackgroundService } from './background-service.js';

// Initialize the background service
const service = new BackgroundService();

// Keep service worker alive
chrome.runtime.onConnect.addListener(() => {
  // Connection from popup or content script keeps service worker alive
});

console.log('Rakuten Price Tracker service worker initialized');