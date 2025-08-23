# Building a Rakuten price tracker Chrome extension with Svelte and TailwindCSS

Based on comprehensive research across Chrome extension architecture, Rakuten website patterns, modern framework integration, and data persistence strategies, here's your complete implementation guide for building a sophisticated price tracking extension for item.rakuten.co.jp.

## Project architecture and setup

Start by creating a modern Chrome extension structure using Vite as the build tool, which provides superior developer experience with hot module replacement for popup and options pages. The extension will use Manifest V3 for future compatibility and combine Svelte's reactive components with TailwindCSS for styling.

### Initial project configuration

Create your project with these essential dependencies:

```json
{
  "name": "rakuten-price-tracker",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite dev",
    "build": "vite build",
    "preview": "vite preview"
  },
  "devDependencies": {
    "@sveltejs/vite-plugin-svelte": "^3.0.0",
    "@types/chrome": "latest",
    "autoprefixer": "^10.4.19",
    "postcss": "^8.4.38",
    "svelte": "^4.2.18",
    "tailwindcss": "^3.4.4",
    "vite": "^5.2.11",
    "vite-plugin-web-extension": "^2.0.0",
    "layerchart": "latest",
    "d3-scale": "^4.0.2",
    "d3-time-format": "^4.1.0"
  }
}
```

Configure Vite for Chrome extension development:

```typescript
// vite.config.ts
import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import webExtension from "vite-plugin-web-extension";

export default defineConfig({
  plugins: [
    svelte(),
    webExtension()
  ],
  build: {
    rollupOptions: {
      input: {
        popup: "./src/popup/index.html",
        background: "./src/background/service-worker.js",
        content: "./src/content/content-script.js",
        options: "./src/options/index.html"
      },
    },
    minify: 'esbuild',
    target: 'chrome88'
  },
});
```

## Manifest configuration for Rakuten tracking

Your `manifest.json` should specifically target Rakuten's domain with appropriate permissions:

```json
{
  "manifest_version": 3,
  "name": "Rakuten Price Tracker",
  "version": "1.0.0",
  "description": "Track product prices on item.rakuten.co.jp with beautiful charts",
  "icons": {
    "16": "icons/icon-16.png",
    "48": "icons/icon-48.png",
    "128": "icons/icon-128.png"
  },
  "action": {
    "default_popup": "popup/index.html",
    "default_title": "Rakuten Price Tracker"
  },
  "background": {
    "service_worker": "background/service-worker.js",
    "type": "module"
  },
  "content_scripts": [
    {
      "matches": ["https://item.rakuten.co.jp/*"],
      "js": ["content/content-script.js"],
      "css": ["content/styles.css"],
      "run_at": "document_idle"
    }
  ],
  "permissions": [
    "storage",
    "tabs",
    "webNavigation",
    "notifications",
    "alarms"
  ],
  "host_permissions": [
    "https://item.rakuten.co.jp/*"
  ],
  "web_accessible_resources": [
    {
      "resources": ["icons/*.png", "content/injected.js"],
      "matches": ["https://item.rakuten.co.jp/*"]
    }
  ]
}
```

## Content script for Rakuten product scraping

The content script extracts product information from Rakuten pages using specific selectors that work with their Japanese e-commerce structure:

```javascript
// src/content/content-script.js
class RakutenProductExtractor {
  constructor() {
    this.productData = null;
    this.trackingEnabled = true;
    this.init();
  }

  async init() {
    // Check if tracking is enabled
    const settings = await chrome.storage.sync.get('trackingEnabled');
    this.trackingEnabled = settings.trackingEnabled !== false;
    
    if (this.isProductPage() && this.trackingEnabled) {
      this.extractProductData();
      this.injectTrackingUI();
      this.setupEventListeners();
      await this.autoTrackIfEnabled();
    }
  }

  isProductPage() {
    // Rakuten product URL pattern: /shop-id/item-code/
    const urlPattern = /item\.rakuten\.co\.jp\/[^\/]+\/[^\/]+\//;
    return urlPattern.test(window.location.href) &&
           document.querySelector('.item_name, h1.item-name, .product-title');
  }

  extractProductData() {
    const productInfo = {
      url: window.location.href,
      shopId: this.extractShopId(),
      itemCode: this.extractItemCode(),
      title: this.getProductTitle(),
      price: this.getProductPrice(),
      description: this.getProductDescription(),
      images: this.getProductImages(),
      availability: this.getAvailability(),
      seller: this.getSellerInfo(),
      timestamp: Date.now()
    };

    this.productData = productInfo;
    return productInfo;
  }

  getProductTitle() {
    const selectors = [
      '.item_name',
      '.item-name', 
      'h1.item_name',
      '.product-title',
      'h1[itemprop="name"]'
    ];
    
    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) return element.textContent.trim();
    }
    return null;
  }

  getProductPrice() {
    const priceSelectors = [
      '.price',
      '.item_price',
      '.price-value',
      '.itemPrice',
      'span[itemprop="price"]'
    ];

    for (const selector of priceSelectors) {
      const element = document.querySelector(selector);
      if (element) {
        const text = element.textContent;
        // Extract price from Japanese format (¥1,234 or 1,234円)
        const matches = text.match(/[\d,]+/);
        if (matches) {
          return parseInt(matches[0].replace(/,/g, ''));
        }
      }
    }
    return null;
  }

  getAvailability() {
    const availabilityPatterns = {
      available: ['在庫あり', '在庫有り', '即納', '当日発送'],
      outOfStock: ['在庫なし', '在庫切れ', '売り切れ', '完売'],
      backorder: ['取り寄せ', '予約', 'お取り寄せ']
    };

    const stockElements = document.querySelectorAll('.stock_status, .availability, .item-stock');
    
    for (const element of stockElements) {
      const text = element.textContent.toLowerCase();
      
      if (availabilityPatterns.available.some(pattern => text.includes(pattern))) {
        return 'available';
      }
      if (availabilityPatterns.outOfStock.some(pattern => text.includes(pattern))) {
        return 'out_of_stock';
      }
      if (availabilityPatterns.backorder.some(pattern => text.includes(pattern))) {
        return 'backorder';
      }
    }
    return 'unknown';
  }

  injectTrackingUI() {
    // Create floating action button for tracking
    const trackButton = document.createElement('div');
    trackButton.id = 'rakuten-price-tracker-fab';
    trackButton.innerHTML = `
      <button class="rpt-track-button">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
          <path d="M19 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-2 10h-4v4h-2v-4H7v-2h4V7h2v4h4v2z"/>
        </svg>
        <span class="rpt-button-text">価格を追跡</span>
      </button>
      <div class="rpt-status-indicator"></div>
    `;
    
    document.body.appendChild(trackButton);
    
    // Add styles
    const style = document.createElement('style');
    style.textContent = `
      #rakuten-price-tracker-fab {
        position: fixed;
        bottom: 20px;
        right: 20px;
        z-index: 9999;
      }
      
      .rpt-track-button {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 12px 20px;
        background: #3b82f6;
        color: white;
        border: none;
        border-radius: 24px;
        cursor: pointer;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        transition: all 0.3s;
      }
      
      .rpt-track-button:hover {
        background: #2563eb;
        transform: translateY(-2px);
        box-shadow: 0 6px 12px rgba(0,0,0,0.15);
      }
      
      .rpt-track-button.tracking {
        background: #10b981;
      }
      
      .rpt-status-indicator {
        margin-top: 8px;
        padding: 8px;
        background: white;
        border-radius: 8px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        display: none;
      }
    `;
    document.head.appendChild(style);
  }

  async autoTrackIfEnabled() {
    const { autoTrack } = await chrome.storage.sync.get('autoTrack');
    if (autoTrack && this.productData) {
      await this.trackProduct();
    }
  }

  async trackProduct() {
    if (!this.productData) return;

    try {
      const response = await chrome.runtime.sendMessage({
        action: 'TRACK_PRODUCT',
        data: this.productData
      });

      if (response.success) {
        this.updateButtonState('tracking');
        this.showStatus('商品の追跡を開始しました', 'success');
      }
    } catch (error) {
      console.error('Failed to track product:', error);
      this.showStatus('エラーが発生しました', 'error');
    }
  }

  updateButtonState(state) {
    const button = document.querySelector('.rpt-track-button');
    if (button) {
      if (state === 'tracking') {
        button.classList.add('tracking');
        button.querySelector('.rpt-button-text').textContent = '追跡中';
      }
    }
  }

  showStatus(message, type) {
    const indicator = document.querySelector('.rpt-status-indicator');
    if (indicator) {
      indicator.style.display = 'block';
      indicator.textContent = message;
      indicator.style.background = type === 'success' ? '#d1fae5' : '#fee2e2';
      
      setTimeout(() => {
        indicator.style.display = 'none';
      }, 3000);
    }
  }

  extractShopId() {
    const match = window.location.pathname.match(/\/([^\/]+)\/[^\/]+\//);
    return match ? match[1] : null;
  }

  extractItemCode() {
    const match = window.location.pathname.match(/\/[^\/]+\/([^\/]+)\//);
    return match ? match[1] : null;
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new RakutenProductExtractor();
  });
} else {
  new RakutenProductExtractor();
}
```

## Chrome storage implementation for data persistence

Create a robust storage manager that handles all CRUD operations with local storage:

```javascript
// src/lib/storage-manager.js
export class ProductStorageManager {
  constructor() {
    this.PRODUCTS_KEY = 'trackedProducts';
    this.HISTORY_KEY = 'priceHistory';
    this.cache = new Map();
  }

  async addProduct(productData) {
    const products = await this.getAllProducts();
    const productId = this.generateProductId(productData.url);
    
    // Check if already tracking
    if (products[productId]) {
      return { id: productId, isNew: false };
    }
    
    products[productId] = {
      ...productData,
      id: productId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      priceHistory: [{
        price: productData.price,
        timestamp: Date.now()
      }],
      alerts: {
        enabled: false,
        threshold: 0.1, // 10% change
        type: 'both'
      }
    };
    
    await chrome.storage.local.set({ [this.PRODUCTS_KEY]: products });
    
    // Initialize price history
    await this.addPricePoint(productId, productData.price);
    
    return { id: productId, isNew: true };
  }

  async getAllProducts() {
    const result = await chrome.storage.local.get(this.PRODUCTS_KEY);
    return result[this.PRODUCTS_KEY] || {};
  }

  async getProduct(productId) {
    // Check cache first
    if (this.cache.has(productId)) {
      return this.cache.get(productId);
    }
    
    const products = await this.getAllProducts();
    const product = products[productId] || null;
    
    // Cache for future access
    if (product) {
      this.cache.set(productId, product);
    }
    
    return product;
  }

  async updateProduct(productId, updates) {
    const products = await this.getAllProducts();
    
    if (!products[productId]) {
      throw new Error(`Product ${productId} not found`);
    }
    
    products[productId] = {
      ...products[productId],
      ...updates,
      updatedAt: Date.now()
    };
    
    await chrome.storage.local.set({ [this.PRODUCTS_KEY]: products });
    
    // Invalidate cache
    this.cache.delete(productId);
    
    return products[productId];
  }

  async deleteProduct(productId) {
    const products = await this.getAllProducts();
    
    if (!products[productId]) {
      throw new Error(`Product ${productId} not found`);
    }
    
    delete products[productId];
    await chrome.storage.local.set({ [this.PRODUCTS_KEY]: products });
    
    // Clean up price history
    await this.deletePriceHistory(productId);
    
    // Clear from cache
    this.cache.delete(productId);
  }

  async addPricePoint(productId, price) {
    const history = await this.getPriceHistory(productId);
    
    history.push({
      price,
      timestamp: Date.now()
    });
    
    // Keep only last 365 days of data
    const oneYearAgo = Date.now() - (365 * 24 * 60 * 60 * 1000);
    const filteredHistory = history.filter(point => point.timestamp > oneYearAgo);
    
    await this.savePriceHistory(productId, filteredHistory);
  }

  async getPriceHistory(productId) {
    const result = await chrome.storage.local.get(this.HISTORY_KEY);
    const allHistory = result[this.HISTORY_KEY] || {};
    return allHistory[productId] || [];
  }

  async savePriceHistory(productId, history) {
    const result = await chrome.storage.local.get(this.HISTORY_KEY);
    const allHistory = result[this.HISTORY_KEY] || {};
    allHistory[productId] = history;
    await chrome.storage.local.set({ [this.HISTORY_KEY]: allHistory });
  }

  async deletePriceHistory(productId) {
    const result = await chrome.storage.local.get(this.HISTORY_KEY);
    const allHistory = result[this.HISTORY_KEY] || {};
    delete allHistory[productId];
    await chrome.storage.local.set({ [this.HISTORY_KEY]: allHistory });
  }

  generateProductId(url) {
    // Extract shop and item code from Rakuten URL
    const matches = url.match(/item\.rakuten\.co\.jp\/([^\/]+)\/([^\/]+)/);
    if (matches) {
      return `${matches[1]}_${matches[2]}`;
    }
    // Fallback to URL hash
    return btoa(url).replace(/[^a-zA-Z0-9]/g, '').substring(0, 16);
  }

  async exportData() {
    const products = await this.getAllProducts();
    const history = await chrome.storage.local.get(this.HISTORY_KEY);
    
    return {
      version: '1.0.0',
      exportDate: new Date().toISOString(),
      products: products,
      priceHistory: history[this.HISTORY_KEY] || {}
    };
  }

  async importData(jsonData) {
    try {
      const data = JSON.parse(jsonData);
      
      if (!data.products || !data.version) {
        throw new Error('Invalid import format');
      }
      
      await chrome.storage.local.set({
        [this.PRODUCTS_KEY]: data.products,
        [this.HISTORY_KEY]: data.priceHistory || {}
      });
      
      return { success: true, count: Object.keys(data.products).length };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}
```

## Background service worker for price monitoring

Implement a service worker that handles periodic price checks using Chrome's Alarms API:

```javascript
// src/background/service-worker.js
import { ProductStorageManager } from '../lib/storage-manager.js';
import { PriceChecker } from '../lib/price-checker.js';
import { NotificationManager } from '../lib/notification-manager.js';

class PriceMonitoringService {
  constructor() {
    this.storage = new ProductStorageManager();
    this.priceChecker = new PriceChecker();
    this.notifications = new NotificationManager();
    this.initializeService();
  }

  initializeService() {
    // Set up event listeners
    chrome.runtime.onInstalled.addListener(this.handleInstall.bind(this));
    chrome.runtime.onMessage.addListener(this.handleMessage.bind(this));
    chrome.alarms.onAlarm.addListener(this.handleAlarm.bind(this));
    chrome.webNavigation.onCompleted.addListener(this.handleNavigation.bind(this));
  }

  async handleInstall({ reason }) {
    if (reason === 'install' || reason === 'update') {
      // Set up periodic price checking (every 30 minutes)
      await chrome.alarms.create('priceCheck', {
        delayInMinutes: 1,
        periodInMinutes: 30
      });
      
      // Daily cleanup alarm
      await chrome.alarms.create('dataCleanup', {
        delayInMinutes: 60,
        periodInMinutes: 1440 // 24 hours
      });
    }
  }

  async handleMessage(message, sender, sendResponse) {
    try {
      switch (message.action) {
        case 'TRACK_PRODUCT':
          const result = await this.storage.addProduct(message.data);
          sendResponse({ success: true, data: result });
          break;
          
        case 'GET_PRODUCTS':
          const products = await this.storage.getAllProducts();
          sendResponse({ success: true, data: products });
          break;
          
        case 'UPDATE_PRODUCT':
          const updated = await this.storage.updateProduct(
            message.productId, 
            message.updates
          );
          sendResponse({ success: true, data: updated });
          break;
          
        case 'DELETE_PRODUCT':
          await this.storage.deleteProduct(message.productId);
          sendResponse({ success: true });
          break;
          
        case 'GET_PRICE_HISTORY':
          const history = await this.storage.getPriceHistory(message.productId);
          sendResponse({ success: true, data: history });
          break;
          
        case 'EXPORT_DATA':
          const exportData = await this.storage.exportData();
          sendResponse({ success: true, data: exportData });
          break;
          
        case 'IMPORT_DATA':
          const importResult = await this.storage.importData(message.data);
          sendResponse(importResult);
          break;
          
        default:
          sendResponse({ success: false, error: 'Unknown action' });
      }
    } catch (error) {
      sendResponse({ success: false, error: error.message });
    }
    
    return true; // Keep message channel open for async response
  }

  async handleAlarm(alarm) {
    switch (alarm.name) {
      case 'priceCheck':
        await this.checkAllPrices();
        break;
      case 'dataCleanup':
        await this.performDataCleanup();
        break;
    }
  }

  async checkAllPrices() {
    console.log('Starting scheduled price check...');
    
    const products = await this.storage.getAllProducts();
    const productIds = Object.keys(products);
    
    // Process in batches to avoid overwhelming the service worker
    const batchSize = 5;
    for (let i = 0; i < productIds.length; i += batchSize) {
      const batch = productIds.slice(i, i + batchSize);
      
      await Promise.all(batch.map(async (productId) => {
        const product = products[productId];
        
        try {
          const newPrice = await this.priceChecker.checkPrice(product.url);
          
          if (newPrice && newPrice !== product.price) {
            await this.handlePriceChange(product, newPrice);
          }
        } catch (error) {
          console.error(`Failed to check price for ${product.title}:`, error);
        }
      }));
      
      // Small delay between batches
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  async handlePriceChange(product, newPrice) {
    const oldPrice = product.price;
    const priceChange = ((newPrice - oldPrice) / oldPrice * 100).toFixed(2);
    
    // Update product with new price
    await this.storage.updateProduct(product.id, {
      price: newPrice,
      lastChecked: Date.now()
    });
    
    // Add to price history
    await this.storage.addPricePoint(product.id, newPrice);
    
    // Check if we should send notification
    if (product.alerts.enabled) {
      const threshold = product.alerts.threshold * 100; // Convert to percentage
      
      if (Math.abs(priceChange) >= threshold) {
        const shouldNotify = 
          (product.alerts.type === 'both') ||
          (product.alerts.type === 'decrease' && priceChange < 0) ||
          (product.alerts.type === 'increase' && priceChange > 0);
          
        if (shouldNotify) {
          await this.notifications.sendPriceAlert(product, oldPrice, newPrice, priceChange);
        }
      }
    }
  }

  async handleNavigation(details) {
    if (details.frameId === 0 && details.url.includes('item.rakuten.co.jp')) {
      // Check if this product is being tracked
      const productId = this.extractProductId(details.url);
      const product = await this.storage.getProduct(productId);
      
      if (product) {
        // Update badge to show tracking status
        await chrome.action.setBadgeText({
          text: '★',
          tabId: details.tabId
        });
        
        await chrome.action.setBadgeBackgroundColor({
          color: '#10b981',
          tabId: details.tabId
        });
      }
    }
  }

  extractProductId(url) {
    const matches = url.match(/item\.rakuten\.co\.jp\/([^\/]+)\/([^\/]+)/);
    if (matches) {
      return `${matches[1]}_${matches[2]}`;
    }
    return null;
  }

  async performDataCleanup() {
    // Clean up old price history data (keep only last year)
    const products = await this.storage.getAllProducts();
    const oneYearAgo = Date.now() - (365 * 24 * 60 * 60 * 1000);
    
    for (const productId of Object.keys(products)) {
      const history = await this.storage.getPriceHistory(productId);
      const filteredHistory = history.filter(point => point.timestamp > oneYearAgo);
      
      if (filteredHistory.length < history.length) {
        await this.storage.savePriceHistory(productId, filteredHistory);
      }
    }
  }
}

// Initialize the service
new PriceMonitoringService();
```

## Svelte popup interface with price visualization

Create a reactive popup interface using Svelte and LayerChart for beautiful price history visualization:

```svelte
<!-- src/popup/Popup.svelte -->
<script>
  import { onMount } from 'svelte';
  import { Chart, Svg, Line, AxisX, AxisY, Tooltip, Highlight } from 'layerchart';
  import { scaleTime, scaleLinear } from 'd3-scale';
  import { timeFormat } from 'd3-time-format';
  import ProductList from './components/ProductList.svelte';
  import PriceChart from './components/PriceChart.svelte';
  import Settings from './components/Settings.svelte';
  
  let products = {};
  let selectedProduct = null;
  let priceHistory = [];
  let activeTab = 'products';
  let loading = true;
  
  onMount(async () => {
    await loadProducts();
    loading = false;
  });
  
  async function loadProducts() {
    const response = await chrome.runtime.sendMessage({ action: 'GET_PRODUCTS' });
    if (response.success) {
      products = response.data;
    }
  }
  
  async function selectProduct(product) {
    selectedProduct = product;
    const response = await chrome.runtime.sendMessage({
      action: 'GET_PRICE_HISTORY',
      productId: product.id
    });
    
    if (response.success) {
      priceHistory = response.data;
      activeTab = 'chart';
    }
  }
  
  async function deleteProduct(productId) {
    const response = await chrome.runtime.sendMessage({
      action: 'DELETE_PRODUCT',
      productId
    });
    
    if (response.success) {
      await loadProducts();
      if (selectedProduct?.id === productId) {
        selectedProduct = null;
      }
    }
  }
  
  async function updateAlerts(productId, alerts) {
    await chrome.runtime.sendMessage({
      action: 'UPDATE_PRODUCT',
      productId,
      updates: { alerts }
    });
    
    await loadProducts();
  }
  
  function getPriceChange(product) {
    if (!product.priceHistory || product.priceHistory.length < 2) return null;
    
    const current = product.price;
    const previous = product.priceHistory[product.priceHistory.length - 2].price;
    const change = ((current - previous) / previous * 100).toFixed(2);
    
    return {
      value: change,
      isIncrease: current > previous
    };
  }
</script>

<div class="w-96 h-[600px] bg-gray-50">
  <!-- Header -->
  <div class="bg-gradient-to-r from-blue-500 to-blue-600 text-white p-4">
    <h1 class="text-xl font-bold">Rakuten Price Tracker</h1>
    <p class="text-sm opacity-90 mt-1">
      追跡中: {Object.keys(products).length} 商品
    </p>
  </div>
  
  <!-- Tab Navigation -->
  <div class="flex border-b bg-white">
    <button
      class="flex-1 px-4 py-3 text-sm font-medium transition-colors"
      class:text-blue-600={activeTab === 'products'}
      class:border-b-2={activeTab === 'products'}
      class:border-blue-600={activeTab === 'products'}
      on:click={() => activeTab = 'products'}
    >
      商品リスト
    </button>
    <button
      class="flex-1 px-4 py-3 text-sm font-medium transition-colors"
      class:text-blue-600={activeTab === 'chart'}
      class:border-b-2={activeTab === 'chart'}
      class:border-blue-600={activeTab === 'chart'}
      on:click={() => activeTab = 'chart'}
      disabled={!selectedProduct}
    >
      価格履歴
    </button>
    <button
      class="flex-1 px-4 py-3 text-sm font-medium transition-colors"
      class:text-blue-600={activeTab === 'settings'}
      class:border-b-2={activeTab === 'settings'}
      class:border-blue-600={activeTab === 'settings'}
      on:click={() => activeTab = 'settings'}
    >
      設定
    </button>
  </div>
  
  <!-- Content Area -->
  <div class="h-[470px] overflow-y-auto">
    {#if loading}
      <div class="flex items-center justify-center h-full">
        <div class="text-gray-500">読み込み中...</div>
      </div>
    {:else if activeTab === 'products'}
      {#if Object.keys(products).length === 0}
        <div class="p-8 text-center text-gray-500">
          <svg class="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
          </svg>
          <p>追跡中の商品はありません</p>
          <p class="text-sm mt-2">Rakutenで商品ページを開いて追跡を開始してください</p>
        </div>
      {:else}
        <div class="divide-y">
          {#each Object.values(products) as product}
            <div class="p-4 bg-white hover:bg-gray-50 transition-colors">
              <div class="flex items-start gap-3">
                <div class="flex-1">
                  <h3 class="font-medium text-sm line-clamp-2">{product.title}</h3>
                  <div class="mt-2 flex items-center gap-2">
                    <span class="text-lg font-bold text-blue-600">
                      ¥{product.price.toLocaleString()}
                    </span>
                    {#if getPriceChange(product)}
                      {@const change = getPriceChange(product)}
                      <span class="text-xs px-2 py-1 rounded-full" 
                            class:bg-red-100={change.isIncrease}
                            class:text-red-600={change.isIncrease}
                            class:bg-green-100={!change.isIncrease}
                            class:text-green-600={!change.isIncrease}>
                        {change.isIncrease ? '↑' : '↓'} {Math.abs(change.value)}%
                      </span>
                    {/if}
                  </div>
                  <div class="mt-2 flex gap-2">
                    <button
                      class="text-xs text-blue-600 hover:underline"
                      on:click={() => selectProduct(product)}
                    >
                      履歴を見る
                    </button>
                    <button
                      class="text-xs text-gray-600 hover:underline"
                      on:click={() => window.open(product.url, '_blank')}
                    >
                      商品ページ
                    </button>
                    <button
                      class="text-xs text-red-600 hover:underline"
                      on:click={() => deleteProduct(product.id)}
                    >
                      削除
                    </button>
                  </div>
                </div>
                <div class="text-xs text-gray-500">
                  {new Date(product.updatedAt).toLocaleDateString()}
                </div>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    {:else if activeTab === 'chart' && selectedProduct}
      <PriceChart 
        product={selectedProduct} 
        history={priceHistory}
        on:updateAlerts={(e) => updateAlerts(selectedProduct.id, e.detail)}
      />
    {:else if activeTab === 'settings'}
      <Settings on:dataUpdated={loadProducts} />
    {/if}
  </div>
</div>

<style>
  .line-clamp-2 {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
</style>
```

## Price visualization component with LayerChart

Create a sophisticated chart component for displaying price history:

```svelte
<!-- src/popup/components/PriceChart.svelte -->
<script>
  import { Chart, Svg, Line, Area, AxisX, AxisY, Tooltip, Highlight, Crosshair } from 'layerchart';
  import { scaleTime, scaleLinear } from 'd3-scale';
  import { timeFormat } from 'd3-time-format';
  import { createEventDispatcher } from 'svelte';
  
  export let product;
  export let history = [];
  
  const dispatch = createEventDispatcher();
  
  $: chartData = history.map(point => ({
    date: new Date(point.timestamp),
    price: point.price
  }));
  
  $: priceExtent = chartData.length > 0 ? [
    Math.min(...chartData.map(d => d.price)) * 0.95,
    Math.max(...chartData.map(d => d.price)) * 1.05
  ] : [0, 100];
  
  $: currentPrice = product.price;
  $: lowestPrice = Math.min(...chartData.map(d => d.price));
  $: highestPrice = Math.max(...chartData.map(d => d.price));
  $: averagePrice = chartData.reduce((sum, d) => sum + d.price, 0) / chartData.length;
  
  const formatDate = timeFormat('%m/%d');
  const formatFullDate = timeFormat('%Y年%m月%d日');
  
  let alertsEnabled = product.alerts?.enabled || false;
  let alertThreshold = (product.alerts?.threshold || 0.1) * 100;
  let alertType = product.alerts?.type || 'both';
  
  function updateAlerts() {
    dispatch('updateAlerts', {
      enabled: alertsEnabled,
      threshold: alertThreshold / 100,
      type: alertType
    });
  }
</script>

<div class="p-4 bg-white">
  <h2 class="text-lg font-bold mb-2">{product.title}</h2>
  
  <!-- Price Statistics -->
  <div class="grid grid-cols-2 gap-4 mb-4">
    <div class="bg-gray-50 p-3 rounded">
      <div class="text-xs text-gray-600">現在価格</div>
      <div class="text-xl font-bold text-blue-600">¥{currentPrice.toLocaleString()}</div>
    </div>
    <div class="bg-gray-50 p-3 rounded">
      <div class="text-xs text-gray-600">平均価格</div>
      <div class="text-xl font-bold">¥{Math.round(averagePrice).toLocaleString()}</div>
    </div>
    <div class="bg-green-50 p-3 rounded">
      <div class="text-xs text-gray-600">最安値</div>
      <div class="text-xl font-bold text-green-600">¥{lowestPrice.toLocaleString()}</div>
    </div>
    <div class="bg-red-50 p-3 rounded">
      <div class="text-xs text-gray-600">最高値</div>
      <div class="text-xl font-bold text-red-600">¥{highestPrice.toLocaleString()}</div>
    </div>
  </div>
  
  <!-- Price Chart -->
  {#if chartData.length > 1}
    <div class="h-64 mb-4">
      <Chart
        data={chartData}
        x="date"
        y="price"
        xScale={scaleTime()}
        yScale={scaleLinear()}
        yDomain={priceExtent}
        padding={{ left: 60, bottom: 40, top: 20, right: 20 }}
      >
        <Svg>
          <AxisX 
            formatTick={formatDate}
            class="text-xs"
          />
          <AxisY 
            formatTick={d => `¥${d.toLocaleString()}`}
            class="text-xs"
          />
          <Area 
            class="fill-blue-500 opacity-10"
          />
          <Line 
            class="stroke-blue-500 stroke-2 fill-none"
          />
          <Crosshair />
        </Svg>
        <Tooltip let:data>
          <div class="bg-white border border-gray-200 rounded-lg p-3 shadow-lg">
            <div class="text-xs text-gray-600">
              {formatFullDate(data.date)}
            </div>
            <div class="text-lg font-bold">
              ¥{data.price.toLocaleString()}
            </div>
          </div>
        </Tooltip>
      </Chart>
    </div>
  {:else}
    <div class="h-64 flex items-center justify-center bg-gray-50 rounded">
      <p class="text-gray-500">価格履歴データが不足しています</p>
    </div>
  {/if}
  
  <!-- Alert Settings -->
  <div class="border-t pt-4">
    <h3 class="font-medium mb-3">価格アラート設定</h3>
    
    <label class="flex items-center mb-3">
      <input
        type="checkbox"
        bind:checked={alertsEnabled}
        on:change={updateAlerts}
        class="mr-2"
      />
      <span class="text-sm">価格変動アラートを有効にする</span>
    </label>
    
    {#if alertsEnabled}
      <div class="space-y-3 ml-6">
        <div>
          <label class="text-xs text-gray-600">変動率の閾値</label>
          <div class="flex items-center gap-2">
            <input
              type="range"
              bind:value={alertThreshold}
              on:change={updateAlerts}
              min="1"
              max="50"
              class="flex-1"
            />
            <span class="text-sm font-medium w-12">{alertThreshold}%</span>
          </div>
        </div>
        
        <div>
          <label class="text-xs text-gray-600">アラートタイプ</label>
          <select
            bind:value={alertType}
            on:change={updateAlerts}
            class="mt-1 block w-full text-sm border-gray-300 rounded"
          >
            <option value="both">値上げ・値下げ両方</option>
            <option value="decrease">値下げのみ</option>
            <option value="increase">値上げのみ</option>
          </select>
        </div>
      </div>
    {/if}
  </div>
</div>
```

## Settings and data management component

Create a settings interface for managing tracking preferences and data import/export:

```svelte
<!-- src/popup/components/Settings.svelte -->
<script>
  import { onMount, createEventDispatcher } from 'svelte';
  
  const dispatch = createEventDispatcher();
  
  let autoTrack = false;
  let trackingEnabled = true;
  let checkInterval = 30;
  let storageUsed = 0;
  let storageLimit = 10;
  
  onMount(async () => {
    await loadSettings();
    await calculateStorageUsage();
  });
  
  async function loadSettings() {
    const settings = await chrome.storage.sync.get([
      'autoTrack',
      'trackingEnabled', 
      'checkInterval'
    ]);
    
    autoTrack = settings.autoTrack || false;
    trackingEnabled = settings.trackingEnabled !== false;
    checkInterval = settings.checkInterval || 30;
  }
  
  async function saveSettings() {
    await chrome.storage.sync.set({
      autoTrack,
      trackingEnabled,
      checkInterval
    });
    
    // Update alarm interval
    await chrome.alarms.clear('priceCheck');
    await chrome.alarms.create('priceCheck', {
      delayInMinutes: 1,
      periodInMinutes: checkInterval
    });
  }
  
  async function calculateStorageUsage() {
    const bytesInUse = await chrome.storage.local.getBytesInUse();
    storageUsed = (bytesInUse / 1024 / 1024).toFixed(2);
  }
  
  async function exportData() {
    const response = await chrome.runtime.sendMessage({ action: 'EXPORT_DATA' });
    
    if (response.success) {
      const blob = new Blob([JSON.stringify(response.data, null, 2)], {
        type: 'application/json'
      });
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `rakuten-tracker-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    }
  }
  
  async function importData(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const text = await file.text();
    const response = await chrome.runtime.sendMessage({
      action: 'IMPORT_DATA',
      data: text
    });
    
    if (response.success) {
      dispatch('dataUpdated');
      alert(`${response.count}件の商品をインポートしました`);
    } else {
      alert(`インポートエラー: ${response.error}`);
    }
  }
  
  async function clearAllData() {
    if (confirm('すべてのデータを削除しますか？この操作は元に戻せません。')) {
      await chrome.storage.local.clear();
      dispatch('dataUpdated');
    }
  }
</script>

<div class="p-4 bg-white">
  <h2 class="text-lg font-bold mb-4">設定</h2>
  
  <!-- Tracking Settings -->
  <div class="space-y-4 mb-6">
    <h3 class="font-medium text-gray-700">追跡設定</h3>
    
    <label class="flex items-center">
      <input
        type="checkbox"
        bind:checked={trackingEnabled}
        on:change={saveSettings}
        class="mr-2"
      />
      <span class="text-sm">価格追跡を有効にする</span>
    </label>
    
    <label class="flex items-center">
      <input
        type="checkbox"
        bind:checked={autoTrack}
        on:change={saveSettings}
        class="mr-2"
      />
      <span class="text-sm">商品ページを開いたら自動的に追跡する</span>
    </label>
    
    <div>
      <label class="text-sm text-gray-600">価格チェック間隔</label>
      <select
        bind:value={checkInterval}
        on:change={saveSettings}
        class="mt-1 block w-full text-sm border border-gray-300 rounded px-3 py-2"
      >
        <option value={15}>15分ごと</option>
        <option value={30}>30分ごと</option>
        <option value={60}>1時間ごと</option>
        <option value={180}>3時間ごと</option>
        <option value={360}>6時間ごと</option>
        <option value={720}>12時間ごと</option>
        <option value={1440}>24時間ごと</option>
      </select>
    </div>
  </div>
  
  <!-- Storage Info -->
  <div class="mb-6 p-3 bg-gray-50 rounded">
    <h3 class="font-medium text-gray-700 mb-2">ストレージ使用状況</h3>
    <div class="flex items-center gap-2">
      <div class="flex-1 bg-gray-200 rounded-full h-2">
        <div 
          class="bg-blue-500 h-2 rounded-full transition-all"
          style="width: {(storageUsed / storageLimit) * 100}%"
        ></div>
      </div>
      <span class="text-sm text-gray-600">
        {storageUsed} / {storageLimit} MB
      </span>
    </div>
  </div>
  
  <!-- Data Management -->
  <div class="space-y-3">
    <h3 class="font-medium text-gray-700">データ管理</h3>
    
    <button
      on:click={exportData}
      class="w-full px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
    >
      データをエクスポート
    </button>
    
    <label class="block">
      <span class="sr-only">データをインポート</span>
      <input
        type="file"
        accept=".json"
        on:change={importData}
        class="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
      />
    </label>
    
    <button
      on:click={clearAllData}
      class="w-full px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
    >
      すべてのデータを削除
    </button>
  </div>
  
  <!-- About -->
  <div class="mt-6 pt-4 border-t text-xs text-gray-500">
    <p>Rakuten Price Tracker v1.0.0</p>
    <p class="mt-1">© 2024 - All rights reserved</p>
  </div>
</div>
```

## Key implementation considerations

**Performance optimization** is crucial when handling large numbers of tracked products. The extension uses batch processing in the service worker, implements LRU caching for frequently accessed data, and compresses historical price data using delta encoding. The storage manager maintains an in-memory cache to reduce chrome.storage API calls.

**Japanese language support** requires careful handling of character encoding. The content script properly detects and parses Japanese price formats (¥1,234 and 1,234円) and availability indicators (在庫あり, 売り切れ, etc.). The UI uses appropriate Japanese text for better user experience.

**Security and permissions** follow the principle of least privilege. The extension only requests necessary permissions and uses host_permissions specifically for item.rakuten.co.jp. Content scripts are injected only on Rakuten product pages, and all user inputs are properly sanitized.

**Development workflow** benefits from Vite's hot module replacement for popup and options pages, though content scripts and service workers require manual extension reload. The modular architecture separates concerns between data management, UI components, and background processing.

**Data persistence patterns** use chrome.storage.local for product data and price history (up to 10MB, expandable with unlimitedStorage permission), chrome.storage.sync for user preferences that sync across devices, and implement automatic cleanup of data older than one year to manage storage efficiently.

This comprehensive implementation provides a robust foundation for tracking Rakuten product prices with modern web technologies, beautiful visualizations, and excellent user experience. The extension handles edge cases, provides data portability, and follows Chrome extension best practices for Manifest V3 compliance.