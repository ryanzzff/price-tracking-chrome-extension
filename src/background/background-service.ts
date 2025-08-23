import { ProductStorageManager } from '../lib/storage-manager.js';

interface ChromeAlarm {
  name: string;
}

interface NavigationDetails {
  frameId: number;
  url: string;
  tabId: number;
}

interface MessageRequest {
  action: string;
  data?: any;
  productId?: string;
  updates?: any;
}

interface InstallDetails {
  reason: string;
}

export class BackgroundService {
  private storage: ProductStorageManager;

  constructor() {
    this.storage = new ProductStorageManager();
    this.initializeService();
  }

  private initializeService(): void {
    // Set up event listeners - simplified for passive tracking only
    chrome.runtime.onMessage.addListener(this.handleMessage.bind(this));
    chrome.webNavigation.onCompleted.addListener(this.handleNavigation.bind(this));
  }

  async handleMessage(message: MessageRequest, sender: any, sendResponse: (response: any) => void): Promise<boolean> {
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
            message.productId!, 
            message.updates
          );
          sendResponse({ success: true, data: updated });
          break;
          
        case 'DELETE_PRODUCT':
          await this.storage.deleteProduct(message.productId!);
          sendResponse({ success: true });
          break;
          
        case 'GET_PRICE_HISTORY':
          const history = await this.storage.getPriceHistory(message.productId!);
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

        case 'CHECK_AND_STORE_PRICE':
          // New action for passive price tracking
          const { productId, price } = message;
          const wasAdded = await this.storage.addPricePointIfNew(productId, price);
          sendResponse({ success: true, priceAdded: wasAdded });
          break;
          
        default:
          sendResponse({ success: false, error: 'Unknown action' });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      sendResponse({ success: false, error: errorMessage });
    }
    
    return true; // Keep message channel open for async response
  }

  async handleNavigation(details: NavigationDetails): Promise<void> {
    if (details.frameId === 0 && details.url.includes('item.rakuten.co.jp')) {
      // Check if this product is being tracked
      const productId = this.extractProductId(details.url);
      if (productId) {
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
  }

  extractProductId(url: string): string | null {
    const matches = url.match(/item\.rakuten\.co\.jp\/([^\/]+)\/([^\/]+)/);
    if (matches) {
      return `${matches[1]}_${matches[2]}`;
    }
    return null;
  }
}