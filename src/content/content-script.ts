import { RakutenProductExtractor } from './rakuten-extractor.js';

// Initialize when DOM is ready
function initializeExtractor() {
  console.log('🟢 Rakuten Price Tracker: Content script starting');
  console.log('🔍 Current URL:', window.location.href);
  console.log('📄 Document ready state:', document.readyState);
  
  const extractor = new RakutenProductExtractor();
  
  // Add debug helper to window for testing
  (window as any).rptDebug = {
    enableDebugMode: async () => {
      await chrome.storage.sync.set({ debugMode: true });
      console.log('🐛 Debug mode enabled. Reloading...');
      window.location.reload();
    },
    disableDebugMode: async () => {
      await chrome.storage.sync.set({ debugMode: false });
      console.log('🐛 Debug mode disabled. Reloading...');
      window.location.reload();
    },
    showButton: () => {
      extractor.injectTrackingUI();
      console.log('🎨 Button manually injected for testing');
    }
  };
  
  console.log('🔧 Debug commands available:');
  console.log('   - rptDebug.enableDebugMode() - Show button on all pages');
  console.log('   - rptDebug.disableDebugMode() - Normal mode');
  console.log('   - rptDebug.showButton() - Force show button');
  
  extractor.init().catch(error => {
    console.error('❌ Failed to initialize Rakuten Product Extractor:', error);
  });
}

console.log('🚀 Rakuten Price Tracker: Content script loaded');

if (document.readyState === 'loading') {
  console.log('⏳ Waiting for DOMContentLoaded...');
  document.addEventListener('DOMContentLoaded', initializeExtractor);
} else {
  console.log('✅ Document already ready, initializing immediately');
  initializeExtractor();
}