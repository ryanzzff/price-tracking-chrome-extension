import type { ProductData } from '../lib/storage-manager.js';

export interface ExtractedProductData extends ProductData {
  availability: string;
  timestamp: number;
}

export class RakutenProductExtractor {
  public productData: ExtractedProductData | null = null;
  public trackingEnabled = true;

  constructor() {
    this.initializeLanguage();
  }

  private async initializeLanguage(): Promise<void> {
    try {
      await chrome.storage.sync.get('selectedLanguage');
    } catch (error) {
      console.warn('Failed to load language preference, using Japanese:', error);
    }
  }

  private getMessage(key: string): string {
    try {
      return chrome.i18n.getMessage(key) || key;
    } catch (error) {
      console.warn(`Failed to get message for key "${key}":`, error);
      return key;
    }
  }

  async init(): Promise<void> {
    console.log('🔧 RakutenProductExtractor: Initializing...', new Date().toISOString());
    
    // Check if tracking is enabled
    const settings = await chrome.storage.sync.get(['trackingEnabled', 'debugMode', 'autoTrack']);
    this.trackingEnabled = settings.trackingEnabled !== false;
    const debugMode = settings.debugMode || false;
    const autoTrack = settings.autoTrack !== undefined ? settings.autoTrack : true;
    console.log('⚙️ Tracking enabled:', this.trackingEnabled);
    console.log('🤖 Auto-track enabled:', autoTrack);
    console.log('🐛 Debug mode:', debugMode);
    
    // Try multiple detection methods
    let isProduct = false;
    
    // Method 1: Immediate detection
    console.log('🔍 Method 1: Immediate detection');
    isProduct = this.isProductPage();
    
    if (!isProduct) {
      // Method 2: Retry with delays
      console.log('🔍 Method 2: Retry with delays');
      isProduct = await this.retryProductDetection();
    }
    
    if (!isProduct) {
      // Method 3: MutationObserver for dynamic content
      console.log('🔍 Method 3: MutationObserver for dynamic content');
      isProduct = await this.waitForProductElements();
    }
    
    console.log('📝 Final result - Is product page:', isProduct);
    
    if ((isProduct && this.trackingEnabled) || debugMode) {
      console.log('✅ Product page detected or debug mode active, proceeding with extraction');
      this.extractProductData();
      this.injectTrackingUI();
      
      // Auto-track if enabled
      if (autoTrack && !debugMode && this.productData) {
        console.log('🤖 Auto-tracking enabled, automatically tracking product...');
        await this.autoTrackProduct();
      }
      
      // Passively check and store today's price if needed
      if (!debugMode) {
        await this.checkAndStoreTodaysPrice();
      }
    } else {
      console.log('❌ Not a product page or tracking disabled');
      console.log('   - Is product page:', isProduct);
      console.log('   - Tracking enabled:', this.trackingEnabled);
      console.log('   - Debug mode:', debugMode);
    }
  }

  isProductPage(): boolean {
    // Rakuten product URL pattern: /shop-id/item-code/
    const urlPattern = /item\.rakuten\.co\.jp\/[^\/]+\/[^\/]+/;
    const urlMatches = urlPattern.test(window.location.href);
    
    const selectors = [
      'span.normal_reserve_item_name',  // Current Rakuten structure
      'meta[itemprop="name"]',          // Meta tag fallback
      '.item_name',
      'span.item_name',
      'h1.item-name', 
      '.product-title',
      'h1.item_name',
      'h1[itemprop="name"]',
      '.item_title',
      '.itemName',
      '.product_name',
      '.goods_name',
      'h1',
      '.title',
      '[data-testid="item-name"]',
      '.item-title'
    ];
    const element = document.querySelector(selectors.join(', '));
    
    console.log('🔍 URL pattern match:', urlMatches, 'for URL:', window.location.href);
    console.log('🎯 Product element found:', !!element);
    if (element) {
      console.log('📋 Product element text:', element.textContent?.substring(0, 100));
    }
    console.log('🧪 All selectors tried:', selectors);
    
    return urlMatches && !!element;
  }

  getProductTitle(): string | null {
    const selectors = [
      'span.normal_reserve_item_name',  // Current Rakuten structure
      'meta[itemprop="name"]',          // Meta tag fallback
      '.item_name',
      'span.item_name',
      '.item-name', 
      'h1.item_name',
      '.product-title',
      'h1[itemprop="name"]',
      '.item_title',
      '.itemName',
      '.product_name',
      '.goods_name',
      'h1',
      '.title',
      '[data-testid="item-name"]',
      '.item-title'
    ];
    
    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) {
        // Handle meta tags differently
        if (element.tagName === 'META') {
          const content = element.getAttribute('content');
          if (content?.trim()) {
            console.log(`✅ Found product title with meta selector "${selector}":`, content.trim().substring(0, 50));
            return content.trim();
          }
        } else if (element.textContent?.trim()) {
          console.log(`✅ Found product title with selector "${selector}":`, element.textContent?.trim().substring(0, 50));
          return element.textContent?.trim() || null;
        }
      }
    }
    console.log('❌ No product title found with any selector');
    return null;
  }

  getProductPrice(): number | null {
    const priceSelectors = [
      'div.item-price--3LAZB',          // Current Rakuten structure main container
      'div#itemPrice',                  // Current Rakuten structure ID
      'div.number--50WuC',             // Current Rakuten price number container
      'div.primary--31sgd',            // Current Rakuten price value
      '.price2',                       // Most common on modern Rakuten pages
      '.price1',
      '.price',
      '.item_price',
      '.price-value',
      '.itemPrice',
      'span[itemprop="price"]',
      '[data-testid="price"]',
      '.product_price',
      '.goods_price', 
      '.sale_price',
      '.current_price',
      '.main_price',
      '.item-price',
      '.price_now',
      '.priceArea'
    ];

    for (const selector of priceSelectors) {
      const element = document.querySelector(selector);
      if (element) {
        let text = element.textContent || '';
        console.log(`🔍 Found price element with selector ${selector}: "${text.substring(0, 50)}"`);
        
        // Special handling for nested price structure
        if (selector.includes('item-price--3LAZB') || selector.includes('itemPrice')) {
          // Look for nested price number in current Rakuten structure
          const numberElement = element.querySelector('div.primary--31sgd, div.number--50WuC');
          if (numberElement) {
            text = numberElement.textContent || '';
            console.log(`🔍 Found nested price text: "${text}"`);
          }
        }
        
        // Extract price from Japanese format (¥1,234 or 1,234円 or just 1,234)
        const matches = text.match(/[\d,]+/);
        if (matches) {
          const price = parseInt(matches[0].replace(/,/g, ''));
          console.log(`💰 Extracted price: ${price}`);
          return price;
        }
      }
    }
    
    console.warn('❌ No price found with available selectors');
    return null;
  }

  getAvailability(): string {
    const availabilityPatterns = {
      available: ['在庫あり', '在庫有り', '即納', '当日発送', 'お届け'],
      outOfStock: ['在庫なし', '在庫切れ', '売り切れ', '完売', '販売終了', '売り切れ中', '在庫切れ中'],
      backorder: ['取り寄せ', '予約', 'お取り寄せ', '入荷待ち']
    };

    // FIRST PRIORITY: Check if purchase buttons are present and enabled
    // This is the most reliable indicator of availability
    const addToCartButton = document.querySelector('[aria-label="かごに追加"]:not([disabled])');
    const purchaseButton = document.querySelector('[aria-label="購入手続きへ"]:not([disabled])');
    
    if (addToCartButton && purchaseButton) {
      console.log('📦 Found enabled purchase buttons, product is available for purchase');
      return 'available';
    }

    // SECOND PRIORITY: Check for delivery information as a positive availability indicator
    const deliveryInfo = document.querySelector('.normal-reserve-deliveryDate');
    if (deliveryInfo && deliveryInfo.textContent?.includes('お届け')) {
      console.log('📦 Found delivery information, assuming available');
      return 'available';
    }

    // THIRD PRIORITY: Check quantity selector (if present, usually means available)
    const quantitySelector = document.querySelector('.normal-reserve-quantity input[type="tel"]');
    if (quantitySelector && !quantitySelector.hasAttribute('disabled')) {
      console.log('📦 Found enabled quantity selector, assuming available');
      return 'available';
    }

    // FOURTH PRIORITY: Check text-based availability indicators
    const availabilitySelectors = [
      '.stock_status',
      '.availability', 
      '.item-stock',
      '.normal-reserve-inventory', // Inventory area
      '.text-display--2xC98' // General text displays (but be more selective)
    ];

    // Check for explicit stock status messages
    for (const selector of availabilitySelectors) {
      const elements = document.querySelectorAll(selector);
      for (const element of elements) {
        const text = (element.textContent || '').toLowerCase();
        
        // Check for definitive out of stock patterns
        if (availabilityPatterns.outOfStock.some(pattern => text.includes(pattern))) {
          console.log(`📦 Found out of stock indicator: "${text.substring(0, 50)}" in ${selector}`);
          return 'out_of_stock';
        }
        
        if (availabilityPatterns.backorder.some(pattern => text.includes(pattern))) {
          console.log(`📦 Found backorder indicator: "${text.substring(0, 50)}" in ${selector}`);
          return 'backorder';
        }
        
        if (availabilityPatterns.available.some(pattern => text.includes(pattern))) {
          console.log(`📦 Found available indicator: "${text.substring(0, 50)}" in ${selector}`);
          return 'available';
        }
      }
    }

    // Check for disabled purchase buttons (strong indicator of unavailability)
    const disabledAddToCart = document.querySelector('[aria-label="かごに追加"][disabled]');
    const disabledPurchase = document.querySelector('[aria-label="購入手続きへ"][disabled]');
    
    if (disabledAddToCart || disabledPurchase) {
      console.log('📦 Found disabled purchase buttons, likely out of stock');
      return 'out_of_stock';
    }
    
    console.log('📦 No clear availability indicators found, returning unknown');
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

  getSeller(): string | null {
    // Try to extract shop/seller name from various elements
    const selectors = [
      '.shop_name',
      '.seller_name',
      '.shop-name', 
      '.store-name',
      '[data-testid="shop-name"]',
      '.shopName',
      '.storeName',
      'meta[property="shop:name"]',
      'meta[name="shop"]',
      '.breadcrumb a[href*="/shop/"]' // Breadcrumb link to shop
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) {
        // Handle meta tags
        if (element.tagName === 'META') {
          const content = element.getAttribute('content');
          if (content?.trim()) {
            console.log(`✅ Found seller name with meta selector "${selector}":`, content.trim());
            return content.trim();
          }
        } else if (element.textContent?.trim()) {
          console.log(`✅ Found seller name with selector "${selector}":`, element.textContent.trim());
          return element.textContent.trim();
        }
      }
    }

    // Fallback: Extract shop name from URL (shopId)
    const shopId = this.extractShopId();
    if (shopId) {
      console.log('📍 Using shopId as fallback seller name:', shopId);
      return shopId;
    }
    
    console.log('❌ No seller name found');
    return null;
  }

  extractProductData(): ExtractedProductData {
    console.log('Extracting product data from URL:', window.location.href);
    
    const title = this.getProductTitle();
    const price = this.getProductPrice();
    const shopId = this.extractShopId();
    const itemCode = this.extractItemCode();
    const seller = this.getSeller();
    
    console.log('Extracted data:', { title, price, shopId, itemCode, seller });
    
    const productInfo: ExtractedProductData = {
      url: window.location.href,
      shopId: shopId || '',
      itemCode: itemCode || '',
      title: title || '',
      price: price || 0,
      seller: seller || undefined,
      availability: this.getAvailability(),
      timestamp: Date.now()
    };

    this.productData = productInfo;
    console.log('Final product data:', productInfo);
    return productInfo;
  }

  injectTrackingUI(): void {
    console.log('🎨 Injecting tracking UI...');
    
    // Check if button already exists
    if (document.querySelector('#rakuten-price-tracker-fab')) {
      console.log('⚠️ Button already exists, removing old one');
      document.querySelector('#rakuten-price-tracker-fab')?.remove();
    }
    
    // Create floating action button container
    const trackButton = document.createElement('div');
    trackButton.id = 'rakuten-price-tracker-fab';
    
    // Apply container styles inline
    Object.assign(trackButton.style, {
      position: 'fixed',
      bottom: '10px',
      left: '20px',
      zIndex: '999999',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      fontSize: '14px',
      pointerEvents: 'auto'
    });
    
    // Get product info for display FIRST
    const productTitle = this.productData?.title || 'Product not detected';
    const productPrice = this.productData?.price || 0;
    const hasValidData = this.productData && this.productData.title && this.productData.price > 0;
    const formattedPrice = productPrice ? `¥${productPrice.toLocaleString()}` : 'Price not detected';
    const truncatedTitle = productTitle.length > 30 ? productTitle.substring(0, 30) + '...' : productTitle;
    
    // Set different button color based on detection success
    const buttonColor = hasValidData ? '#3b82f6' : '#ef4444'; // Blue for success, red for failure
    
    // Choose icon and text based on validation
    const iconPath = hasValidData 
      ? '<path d="M19 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-2 10h-4v4h-2v-4H7v-2h4V7h2v4h4v2z"/>'
      : '<path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"/>';
    
    const buttonText = hasValidData ? this.getMessage('trackPrice') : '⚠️ Detection Issue';

    // Create main button element
    const button = document.createElement('button');
    button.dataset.rptButton = 'track';
    button.dataset.trackingState = 'idle';
    
    // Store validation state as data attribute for hover effects
    button.dataset.hasValidData = hasValidData?.toString() || 'false';
    button.dataset.defaultColor = buttonColor;
    
    // Apply button styles inline (now that buttonColor is defined)
    Object.assign(button.style, {
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      padding: '8px 12px',
      background: buttonColor,
      color: 'white',
      border: 'none',
      borderRadius: '16px',
      cursor: 'pointer',
      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
      transition: 'all 0.3s ease',
      fontSize: '14px',
      fontWeight: '500',
      textDecoration: 'none',
      minWidth: '280px',
      maxWidth: '350px'
    });

    // Add SVG icon and detailed product info
    button.innerHTML = `
      <div style="display: flex; align-items: center; gap: 12px; width: 100%;">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" style="flex-shrink: 0;">
          ${iconPath}
        </svg>
        <div style="display: flex; flex-direction: column; align-items: flex-start; flex: 1; min-width: 0;">
          <div class="rpt-button-text" style="font-weight: 600; font-size: 14px; margin-bottom: 2px;">
            ${buttonText}
          </div>
          <div class="rpt-product-title" style="font-weight: 400; font-size: 12px; opacity: 0.9; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%;" title="${productTitle}">
            ${truncatedTitle}
          </div>
          <div class="rpt-product-price" style="font-weight: 600; font-size: 13px; color: #fef3c7; margin-top: 1px;">
            ${formattedPrice}
          </div>
        </div>
      </div>
    `;
    
    // Create status indicator
    const statusIndicator = document.createElement('div');
    statusIndicator.className = 'rpt-status-indicator';
    statusIndicator.dataset.rptStatus = 'indicator';
    
    // Apply status indicator styles inline
    Object.assign(statusIndicator.style, {
      marginTop: '8px',
      padding: '8px 12px',
      background: 'white',
      borderRadius: '8px',
      boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
      fontSize: '12px',
      fontWeight: '500',
      color: '#374151',
      whiteSpace: 'nowrap',
      display: 'none'
    });
    
    // Add hover effects
    button.addEventListener('mouseenter', () => {
      const trackingState = button.dataset.trackingState || 'idle';
      if (trackingState === 'idle') {
        const isValid = button.dataset.hasValidData === 'true';
        const hoverColor = isValid ? '#2563eb' : '#dc2626';
        button.style.background = hoverColor;
        button.style.transform = 'translateY(-2px)';
        button.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)';
      } else if (trackingState === 'tracking') {
        button.style.background = '#059669';
        button.style.transform = 'translateY(-2px)';
        button.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)';
      } else if (trackingState === 'auto-tracked') {
        button.style.background = '#7c3aed';
        button.style.transform = 'translateY(-2px)';
        button.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)';
      }
    });
    
    button.addEventListener('mouseleave', () => {
      const trackingState = button.dataset.trackingState || 'idle';
      if (trackingState === 'idle') {
        const defaultColor = button.dataset.defaultColor || '#3b82f6';
        button.style.background = defaultColor;
        button.style.transform = 'translateY(0)';
        button.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)';
      } else if (trackingState === 'tracking') {
        button.style.background = '#10b981';
        button.style.transform = 'translateY(0)';
        button.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)';
      } else if (trackingState === 'auto-tracked') {
        button.style.background = '#8b5cf6';
        button.style.transform = 'translateY(0)';
        button.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)';
      }
    });
    
    // Append elements
    trackButton.appendChild(button);
    trackButton.appendChild(statusIndicator);
    document.body.appendChild(trackButton);
    
    console.log('✅ Tracking button injected successfully with inline styles');

    // Add click event listener
    button.addEventListener('click', () => {
      const isValid = button.dataset.hasValidData === 'true';
      if (isValid) {
        this.trackProduct();
      } else {
        this.showStatus('Cannot track: Product data not detected', 'error');
      }
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
        this.showStatus(this.getMessage('trackingStarted'), 'success');
      }
    } catch (error) {
      console.error('Failed to track product:', error);
      this.showStatus(this.getMessage('errorOccurred'), 'error');
    }
  }

  async autoTrackProduct(): Promise<void> {
    if (!this.productData) return;

    try {
      const response = await chrome.runtime.sendMessage({
        action: 'TRACK_PRODUCT',
        data: this.productData
      });

      if (response.success) {
        console.log('🤖 Product auto-tracked successfully:', this.productData.title);
        this.updateButtonState('auto-tracked');
        this.showStatus('Auto-tracked!', 'success');
      }
    } catch (error) {
      console.error('Failed to auto-track product:', error);
      this.showStatus('Auto-track failed', 'error');
    }
  }

  updateButtonState(state: string): void {
    const button = document.querySelector('#rakuten-price-tracker-fab button') as HTMLElement;
    if (button) {
      if (state === 'tracking') {
        // Update button styling for manual tracking state
        button.classList.add('tracking');
        button.dataset.trackingState = 'tracking';
        button.style.background = '#10b981';
        const textElement = button.querySelector('.rpt-button-text');
        if (textElement) {
          textElement.textContent = '✓ ' + this.getMessage('tracking');
        }
        
        // Update icon to checkmark
        const existingIcon = button.querySelector('svg');
        if (existingIcon) {
          existingIcon.innerHTML = `
            <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"/>
          `;
        }
      } else if (state === 'auto-tracked') {
        // Update button styling for auto-tracked state
        button.classList.add('tracking');
        button.dataset.trackingState = 'auto-tracked';
        button.style.background = '#8b5cf6'; // Purple color for auto-tracked
        const textElement = button.querySelector('.rpt-button-text');
        if (textElement) {
          textElement.textContent = '⚡ Auto-tracked';
        }
        
        // Update icon to lightning bolt
        const existingIcon = button.querySelector('svg');
        if (existingIcon) {
          existingIcon.innerHTML = `
            <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z"/>
          `;
        }
      }
    }
  }

  showStatus(message: string, type: 'success' | 'error'): void {
    const indicator = document.querySelector('[data-rpt-status="indicator"]') as HTMLElement;
    if (indicator) {
      // Show indicator and set message
      indicator.style.display = 'block';
      indicator.textContent = message;
      
      // Update colors based on type
      if (type === 'success') {
        indicator.style.background = '#f0fdf4';
        indicator.style.color = '#166534';
      } else {
        indicator.style.background = '#fef2f2';
        indicator.style.color = '#dc2626';
      }
      
      setTimeout(() => {
        indicator.style.display = 'none';
        // Reset to default colors
        indicator.style.background = 'white';
        indicator.style.color = '#374151';
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

  async retryProductDetection(): Promise<boolean> {
    const maxAttempts = 10;
    const delay = 500; // 500ms between attempts
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      console.log(`⏳ Retry attempt ${attempt}/${maxAttempts} at ${new Date().toISOString()}`);
      
      // Wait before checking
      await new Promise(resolve => setTimeout(resolve, delay));
      
      // Check if elements are now available
      if (this.isProductPage()) {
        console.log(`✅ Product detected on retry attempt ${attempt}`);
        return true;
      }
    }
    
    console.log('❌ Product detection failed after all retry attempts');
    return false;
  }

  async waitForProductElements(): Promise<boolean> {
    return new Promise((resolve) => {
      console.log('👀 Starting MutationObserver for product elements...');
      
      const timeout = 5000; // 5 second timeout
      let observer: MutationObserver | null = null;
      
      const timeoutId = setTimeout(() => {
        console.log('⏰ MutationObserver timeout reached');
        observer?.disconnect();
        resolve(false);
      }, timeout);
      
      observer = new MutationObserver((mutations) => {
        console.log(`🔄 DOM mutation detected (${mutations.length} changes)`);
        
        if (this.isProductPage()) {
          console.log('✅ Product detected via MutationObserver');
          clearTimeout(timeoutId);
          observer?.disconnect();
          resolve(true);
        }
      });
      
      // Start observing
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: false,
        characterData: true
      });
      
      console.log('👁️ MutationObserver started, watching for changes...');
    });
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