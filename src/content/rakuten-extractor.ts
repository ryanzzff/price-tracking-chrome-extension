import type { ProductData } from '../lib/storage-manager.js';

export interface ExtractedProductData extends ProductData {
  availability: string;
  timestamp: number;
}

export class RakutenProductExtractor {
  public productData: ExtractedProductData | null = null;
  public trackingEnabled = true;

  constructor() {}

  async init(): Promise<void> {
    // Check if tracking is enabled
    const settings = await chrome.storage.sync.get('trackingEnabled');
    this.trackingEnabled = settings.trackingEnabled !== false;
    
    if (this.isProductPage() && this.trackingEnabled) {
      this.extractProductData();
      this.injectTrackingUI();
      
      // Passively check and store today's price if needed
      await this.checkAndStoreTodaysPrice();
    }
  }

  isProductPage(): boolean {
    // Rakuten product URL pattern: /shop-id/item-code/
    const urlPattern = /item\.rakuten\.co\.jp\/[^\/]+\/[^\/]+\//;
    return urlPattern.test(window.location.href) &&
           !!document.querySelector('.item_name, h1.item-name, .product-title, h1.item_name, h1[itemprop="name"]');
  }

  getProductTitle(): string | null {
    const selectors = [
      '.item_name',
      '.item-name', 
      'h1.item_name',
      '.product-title',
      'h1[itemprop="name"]'
    ];
    
    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) return element.textContent?.trim() || null;
    }
    return null;
  }

  getProductPrice(): number | null {
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
        const text = element.textContent || '';
        // Extract price from Japanese format (¥1,234 or 1,234円)
        const matches = text.match(/[\d,]+/);
        if (matches) {
          return parseInt(matches[0].replace(/,/g, ''));
        }
      }
    }
    return null;
  }

  getAvailability(): string {
    const availabilityPatterns = {
      available: ['在庫あり', '在庫有り', '即納', '当日発送'],
      outOfStock: ['在庫なし', '在庫切れ', '売り切れ', '完売'],
      backorder: ['取り寄せ', '予約', 'お取り寄せ']
    };

    const stockElements = document.querySelectorAll('.stock_status, .availability, .item-stock');
    
    for (const element of stockElements) {
      const text = (element.textContent || '').toLowerCase();
      
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

  extractShopId(): string | null {
    const match = window.location.pathname.match(/\/([^\/]+)\/[^\/]+\//);
    return match ? match[1] : null;
  }

  extractItemCode(): string | null {
    const match = window.location.pathname.match(/\/[^\/]+\/([^\/]+)\//);
    return match ? match[1] : null;
  }

  extractProductData(): ExtractedProductData {
    const productInfo: ExtractedProductData = {
      url: window.location.href,
      shopId: this.extractShopId() || '',
      itemCode: this.extractItemCode() || '',
      title: this.getProductTitle() || '',
      price: this.getProductPrice() || 0,
      availability: this.getAvailability(),
      timestamp: Date.now()
    };

    this.productData = productInfo;
    return productInfo;
  }

  injectTrackingUI(): void {
    // Create floating action button for tracking
    const trackButton = document.createElement('div');
    trackButton.id = 'rakuten-price-tracker-fab';
    trackButton.className = 'fixed bottom-5 right-5 z-[999999] font-sans';
    
    // Create button element with TailwindCSS classes
    const button = document.createElement('button');
    button.className = 'flex items-center gap-2 px-5 py-3 bg-blue-500 text-white border-none rounded-full cursor-pointer shadow-lg transition-all duration-300 hover:bg-blue-600 hover:-translate-y-0.5 hover:shadow-xl text-sm font-medium';
    
    // Add SVG icon
    button.innerHTML = `
      <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" class="flex-shrink-0">
        <path d="M19 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-2 10h-4v4h-2v-4H7v-2h4V7h2v4h4v2z"/>
      </svg>
      <span class="rpt-button-text">価格を追跡</span>
    `;
    
    // Create status indicator
    const statusIndicator = document.createElement('div');
    statusIndicator.className = 'rpt-status-indicator mt-2 px-3 py-2 bg-white rounded-lg shadow-sm text-xs font-medium text-gray-700 whitespace-nowrap hidden';
    
    // Append elements
    trackButton.appendChild(button);
    trackButton.appendChild(statusIndicator);
    document.body.appendChild(trackButton);

    // Add click event listener
    button.addEventListener('click', () => {
      this.trackProduct();
    });
  }

  async trackProduct(): Promise<void> {
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

  updateButtonState(state: string): void {
    const button = document.querySelector('#rakuten-price-tracker-fab button') as HTMLElement;
    if (button) {
      if (state === 'tracking') {
        // Update button styling for tracking state
        button.className = button.className.replace('bg-blue-500 hover:bg-blue-600', 'bg-green-500 hover:bg-green-600');
        const textElement = button.querySelector('.rpt-button-text');
        if (textElement) {
          textElement.textContent = '追跡中';
        }
      }
    }
  }

  showStatus(message: string, type: 'success' | 'error'): void {
    const indicator = document.querySelector('.rpt-status-indicator') as HTMLElement;
    if (indicator) {
      // Remove hidden class and add appropriate styling
      indicator.classList.remove('hidden');
      indicator.textContent = message;
      
      // Update colors based on type
      if (type === 'success') {
        indicator.className = indicator.className.replace('bg-white text-gray-700', 'bg-green-100 text-green-800');
      } else {
        indicator.className = indicator.className.replace('bg-white text-gray-700', 'bg-red-100 text-red-800');
      }
      
      setTimeout(() => {
        indicator.classList.add('hidden');
        // Reset to default colors
        indicator.className = indicator.className.replace(/bg-(green|red)-100 text-(green|red)-800/, 'bg-white text-gray-700');
      }, 3000);
    }
  }

  async checkAndStoreTodaysPrice(): Promise<void> {
    if (!this.productData) return;

    try {
      const productId = this.generateProductId(this.productData.url);
      const response = await chrome.runtime.sendMessage({
        action: 'CHECK_AND_STORE_PRICE',
        productId,
        price: this.productData.price
      });

      if (response.success && response.priceAdded) {
        console.log('Today\'s price stored for product:', this.productData.title);
      }
    } catch (error) {
      console.error('Failed to check and store price:', error);
    }
  }

  private generateProductId(url: string): string {
    // Extract shop and item code from Rakuten URL
    const matches = url.match(/item\.rakuten\.co\.jp\/([^\/]+)\/([^\/]+)/);
    if (matches) {
      return `${matches[1]}_${matches[2]}`;
    }
    // Fallback to URL hash
    return btoa(url).replace(/[^a-zA-Z0-9]/g, '').substring(0, 16);
  }
}