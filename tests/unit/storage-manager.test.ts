import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ProductStorageManager } from '../../src/lib/storage-manager.js';

describe('ProductStorageManager', () => {
  let storageManager: ProductStorageManager;
  
  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();
    
    // Set up default mock responses
    chrome.storage.local.get.mockResolvedValue({});
    chrome.storage.local.set.mockResolvedValue(undefined);
    
    storageManager = new ProductStorageManager();
  });

  describe('constructor', () => {
    it('should initialize with correct properties', () => {
      expect(storageManager.PRODUCTS_KEY).toBe('trackedProducts');
      expect(storageManager.HISTORY_KEY).toBe('priceHistory');
      expect(storageManager.cache).toBeInstanceOf(Map);
    });
  });

  describe('generateProductId', () => {
    it('should generate ID from Rakuten URL', () => {
      const url = 'https://item.rakuten.co.jp/shop123/item456/';
      const result = storageManager.generateProductId(url);
      expect(result).toBe('shop123_item456');
    });

    it('should handle URL with extra parameters', () => {
      const url = 'https://item.rakuten.co.jp/shop123/item456/?param=value';
      const result = storageManager.generateProductId(url);
      expect(result).toBe('shop123_item456');
    });

    it('should fallback to base64 hash for non-standard URLs', () => {
      const url = 'https://invalid.url/path';
      const result = storageManager.generateProductId(url);
      expect(result).toHaveLength(16);
      expect(result).toMatch(/^[a-zA-Z0-9]+$/);
    });
  });

  describe('addProduct', () => {
    const mockProductData = {
      url: 'https://item.rakuten.co.jp/shop123/item456/',
      title: 'Test Product',
      price: 1000,
      shopId: 'shop123',
      itemCode: 'item456'
    };

    it('should add new product successfully', async () => {
      chrome.storage.local.get.mockResolvedValue({ trackedProducts: {} });
      
      const result = await storageManager.addProduct(mockProductData);
      
      expect(result.id).toBe('shop123_item456');
      expect(result.isNew).toBe(true);
      expect(chrome.storage.local.set).toHaveBeenCalledTimes(2); // products + history
    });

    it('should return existing product if already tracking', async () => {
      const existingProducts = {
        'shop123_item456': { ...mockProductData, id: 'shop123_item456' }
      };
      chrome.storage.local.get.mockResolvedValue({ trackedProducts: existingProducts });
      
      const result = await storageManager.addProduct(mockProductData);
      
      expect(result.id).toBe('shop123_item456');
      expect(result.isNew).toBe(false);
      expect(chrome.storage.local.set).not.toHaveBeenCalled();
    });

    it('should set default alert configuration', async () => {
      chrome.storage.local.get.mockResolvedValue({ trackedProducts: {} });
      
      await storageManager.addProduct(mockProductData);
      
      const setCall = chrome.storage.local.set.mock.calls[0][0];
      const addedProduct = setCall.trackedProducts['shop123_item456'];
      
      expect(addedProduct.alerts).toEqual({
        enabled: false,
        threshold: 0.1,
        type: 'both'
      });
    });
  });

  describe('getAllProducts', () => {
    it('should return empty object when no products stored', async () => {
      chrome.storage.local.get.mockResolvedValue({});
      
      const result = await storageManager.getAllProducts();
      
      expect(result).toEqual({});
    });

    it('should return all stored products', async () => {
      const mockProducts = {
        'product1': { id: 'product1', title: 'Product 1' },
        'product2': { id: 'product2', title: 'Product 2' }
      };
      chrome.storage.local.get.mockResolvedValue({ trackedProducts: mockProducts });
      
      const result = await storageManager.getAllProducts();
      
      expect(result).toEqual(mockProducts);
    });
  });

  describe('updateProduct', () => {
    const existingProduct = {
      id: 'test123',
      title: 'Original Title',
      price: 1000,
      createdAt: 1000000,
      updatedAt: 1000000
    };

    beforeEach(() => {
      // Mock Date.now for consistent testing
      vi.spyOn(Date, 'now').mockReturnValue(2000000);
    });

    it('should update existing product', async () => {
      const mockProducts = { 'test123': existingProduct };
      chrome.storage.local.get.mockResolvedValue({ trackedProducts: mockProducts });
      
      const updates = { price: 1500, title: 'Updated Title' };
      const result = await storageManager.updateProduct('test123', updates);
      
      expect(result.price).toBe(1500);
      expect(result.title).toBe('Updated Title');
      expect(result.updatedAt).toBe(2000000);
      expect(result.createdAt).toBe(1000000); // Should preserve original
    });

    it('should throw error for non-existent product', async () => {
      chrome.storage.local.get.mockResolvedValue({ trackedProducts: {} });
      
      await expect(storageManager.updateProduct('nonexistent', {}))
        .rejects.toThrow('Product nonexistent not found');
    });
  });

  describe('price history management', () => {
    beforeEach(() => {
      vi.spyOn(Date, 'now').mockReturnValue(1000000000);
    });

    it('should add price point to history', async () => {
      chrome.storage.local.get.mockResolvedValueOnce({ priceHistory: {} });
      
      await storageManager.addPricePoint('test123', 1500);
      
      const setCall = chrome.storage.local.set.mock.calls[0][0];
      expect(setCall.priceHistory.test123).toHaveLength(1);
      expect(setCall.priceHistory.test123[0]).toEqual({
        price: 1500,
        timestamp: 1000000000
      });
    });
  });

  describe('daily price checking', () => {
    beforeEach(() => {
      // Mock current date to be consistent
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-03-15 14:30:00'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    describe('hasTodaysPrice', () => {
      it('should return false when no history exists', async () => {
        chrome.storage.local.get.mockResolvedValue({});
        
        const result = await storageManager.hasTodaysPrice('test123');
        expect(result).toBe(false);
      });

      it('should return true when today\'s price exists', async () => {
        const todayTimestamp = new Date('2024-03-15 10:00:00').getTime();
        const history = {
          'test123': [
            { price: 1000, timestamp: todayTimestamp }
          ]
        };
        chrome.storage.local.get.mockResolvedValue({ priceHistory: history });
        
        const result = await storageManager.hasTodaysPrice('test123');
        expect(result).toBe(true);
      });

      it('should return false when only yesterday\'s price exists', async () => {
        const yesterdayTimestamp = new Date('2024-03-14 10:00:00').getTime();
        const history = {
          'test123': [
            { price: 1000, timestamp: yesterdayTimestamp }
          ]
        };
        chrome.storage.local.get.mockResolvedValue({ priceHistory: history });
        
        const result = await storageManager.hasTodaysPrice('test123');
        expect(result).toBe(false);
      });

      it('should return true for price at start of day', async () => {
        const startOfDay = new Date('2024-03-15 00:00:00').getTime();
        const history = {
          'test123': [
            { price: 1000, timestamp: startOfDay }
          ]
        };
        chrome.storage.local.get.mockResolvedValue({ priceHistory: history });
        
        const result = await storageManager.hasTodaysPrice('test123');
        expect(result).toBe(true);
      });

      it('should return true for price at end of day', async () => {
        const endOfDay = new Date('2024-03-15 23:59:59').getTime();
        const history = {
          'test123': [
            { price: 1000, timestamp: endOfDay }
          ]
        };
        chrome.storage.local.get.mockResolvedValue({ priceHistory: history });
        
        const result = await storageManager.hasTodaysPrice('test123');
        expect(result).toBe(true);
      });
    });

    describe('addPricePointIfNew', () => {
      it('should add price when no today\'s price exists', async () => {
        chrome.storage.local.get.mockResolvedValue({ priceHistory: {} });
        vi.spyOn(storageManager, 'hasTodaysPrice').mockResolvedValue(false);
        vi.spyOn(storageManager, 'addPricePoint').mockResolvedValue();
        
        const result = await storageManager.addPricePointIfNew('test123', 1500);
        
        expect(result).toBe(true);
        expect(storageManager.addPricePoint).toHaveBeenCalledWith('test123', 1500);
      });

      it('should not add price when today\'s price already exists', async () => {
        vi.spyOn(storageManager, 'hasTodaysPrice').mockResolvedValue(true);
        vi.spyOn(storageManager, 'addPricePoint').mockResolvedValue();
        
        const result = await storageManager.addPricePointIfNew('test123', 1500);
        
        expect(result).toBe(false);
        expect(storageManager.addPricePoint).not.toHaveBeenCalled();
      });
    });
  });

  describe('data import/export', () => {
    it('should export data with correct format', async () => {
      const mockProducts = { 'test123': { id: 'test123', title: 'Test' } };
      const mockHistory = { 'test123': [{ price: 1000, timestamp: 1000000 }] };
      
      chrome.storage.local.get
        .mockResolvedValueOnce({ trackedProducts: mockProducts })
        .mockResolvedValueOnce({ priceHistory: mockHistory });
      
      vi.spyOn(Date.prototype, 'toISOString').mockReturnValue('2024-01-01T00:00:00.000Z');
      
      const result = await storageManager.exportData();
      
      expect(result).toEqual({
        version: '1.0.0',
        exportDate: '2024-01-01T00:00:00.000Z',
        products: mockProducts,
        priceHistory: mockHistory
      });
    });

    it('should import valid data successfully', async () => {
      const validData = {
        version: '1.0.0',
        products: { 'test123': { id: 'test123', title: 'Test' } },
        priceHistory: { 'test123': [{ price: 1000, timestamp: 1000000 }] }
      };
      
      const result = await storageManager.importData(JSON.stringify(validData));
      
      expect(result.success).toBe(true);
      expect(result.count).toBe(1);
    });

    it('should reject invalid import data', async () => {
      const invalidData = { invalid: 'data' };
      
      const result = await storageManager.importData(JSON.stringify(invalidData));
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid import format');
    });
  });
});