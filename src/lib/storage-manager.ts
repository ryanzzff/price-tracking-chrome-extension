export interface ProductData {
  url: string;
  title: string;
  price: number;
  shopId: string;
  itemCode: string;
  description?: string;
  images?: string[];
  availability?: string;
  seller?: string;
  timestamp?: number;
}

export interface Product extends ProductData {
  id: string;
  createdAt: number;
  updatedAt: number;
  priceHistory: PricePoint[];
  alerts: AlertSettings;
}

export interface PricePoint {
  price: number;
  timestamp: number;
}

export interface AlertSettings {
  enabled: boolean;
  threshold: number;
  type: 'both' | 'decrease' | 'increase';
}

export interface AddProductResult {
  id: string;
  isNew: boolean;
}

export interface ImportResult {
  success: boolean;
  count?: number;
  error?: string;
}

export interface ExportData {
  version: string;
  exportDate: string;
  products: Record<string, Product>;
  priceHistory: Record<string, PricePoint[]>;
}

export class ProductStorageManager {
  public readonly PRODUCTS_KEY = 'trackedProducts';
  public readonly HISTORY_KEY = 'priceHistory';
  public readonly cache = new Map<string, Product>();

  constructor() {}

  generateProductId(url: string): string {
    // Extract shop and item code from Rakuten URL
    const matches = url.match(/item\.rakuten\.co\.jp\/([^\/]+)\/([^\/]+)/);
    if (matches) {
      return `${matches[1]}_${matches[2]}`;
    }
    // Fallback to URL hash
    return btoa(url).replace(/[^a-zA-Z0-9]/g, '').substring(0, 16);
  }

  async getAllProducts(): Promise<Record<string, Product>> {
    const result = await chrome.storage.local.get(this.PRODUCTS_KEY);
    return result[this.PRODUCTS_KEY] || {};
  }

  async getProduct(productId: string): Promise<Product | null> {
    // Check cache first
    if (this.cache.has(productId)) {
      return this.cache.get(productId)!;
    }
    
    const products = await this.getAllProducts();
    const product = products[productId] || null;
    
    // Cache for future access
    if (product) {
      this.cache.set(productId, product);
    }
    
    return product;
  }

  async addProduct(productData: ProductData): Promise<AddProductResult> {
    const products = await this.getAllProducts();
    const productId = this.generateProductId(productData.url);
    
    // Check if already tracking
    if (products[productId]) {
      return { id: productId, isNew: false };
    }
    
    const now = Date.now();
    products[productId] = {
      ...productData,
      id: productId,
      createdAt: now,
      updatedAt: now,
      priceHistory: [{
        price: productData.price,
        timestamp: now
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

  async updateProduct(productId: string, updates: Partial<Product>): Promise<Product> {
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

  async deleteProduct(productId: string): Promise<void> {
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

  async addPricePoint(productId: string, price: number): Promise<void> {
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

  async getPriceHistory(productId: string): Promise<PricePoint[]> {
    const result = await chrome.storage.local.get(this.HISTORY_KEY);
    const allHistory = result[this.HISTORY_KEY] || {};
    return allHistory[productId] || [];
  }

  async savePriceHistory(productId: string, history: PricePoint[]): Promise<void> {
    const result = await chrome.storage.local.get(this.HISTORY_KEY);
    const allHistory = result[this.HISTORY_KEY] || {};
    allHistory[productId] = history;
    await chrome.storage.local.set({ [this.HISTORY_KEY]: allHistory });
  }

  async deletePriceHistory(productId: string): Promise<void> {
    const result = await chrome.storage.local.get(this.HISTORY_KEY);
    const allHistory = result[this.HISTORY_KEY] || {};
    delete allHistory[productId];
    await chrome.storage.local.set({ [this.HISTORY_KEY]: allHistory });
  }

  async exportData(): Promise<ExportData> {
    const products = await this.getAllProducts();
    const history = await chrome.storage.local.get(this.HISTORY_KEY);
    
    return {
      version: '1.0.0',
      exportDate: new Date().toISOString(),
      products: products,
      priceHistory: history[this.HISTORY_KEY] || {}
    };
  }

  async importData(jsonData: string): Promise<ImportResult> {
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
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }
}