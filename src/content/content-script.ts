import { RakutenProductExtractor } from './rakuten-extractor.js';

// Initialize when DOM is ready
function initializeExtractor() {
  const extractor = new RakutenProductExtractor();
  extractor.init().catch(error => {
    console.error('Failed to initialize Rakuten Product Extractor:', error);
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeExtractor);
} else {
  initializeExtractor();
}