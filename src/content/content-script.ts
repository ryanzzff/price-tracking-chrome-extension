import { RakutenProductExtractor } from './rakuten-extractor.js';

// Initialize when DOM is ready
function initializeExtractor() {
  console.log('🟢 Rakuten Price Tracker: Content script starting');
  console.log('🔍 Current URL:', window.location.href);
  console.log('📄 Document ready state:', document.readyState);
  
  const extractor = new RakutenProductExtractor();
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