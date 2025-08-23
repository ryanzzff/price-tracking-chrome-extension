import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BackgroundService } from '../../src/background/background-service.js';

describe('BackgroundService', () => {
  let service: BackgroundService;
  let mockStorageManager: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock storage manager
    mockStorageManager = {
      addProduct: vi.fn(),
      getAllProducts: vi.fn(),
      getProduct: vi.fn(),
      updateProduct: vi.fn(),
      deleteProduct: vi.fn(),
      getPriceHistory: vi.fn(),
      exportData: vi.fn(),
      importData: vi.fn(),
      addPricePointIfNew: vi.fn()
    };

    // Reset Chrome API mocks - type assertion for mock functions
    (chrome.runtime.onMessage.addListener as any).mockClear();
    (chrome.webNavigation.onCompleted.addListener as any).mockClear();

    service = new BackgroundService();
    // Inject mock storage manager
    (service as any).storage = mockStorageManager;
  });

  describe('constructor', () => {
    it('should initialize with storage manager and set up event listeners', () => {
      expect(chrome.runtime.onMessage.addListener).toHaveBeenCalled();
      expect(chrome.webNavigation.onCompleted.addListener).toHaveBeenCalled();
    });
  });


  describe('handleMessage', () => {
    const mockSender = {};
    const mockSendResponse = vi.fn();

    beforeEach(() => {
      mockSendResponse.mockClear();
    });

    it('should handle TRACK_PRODUCT action', async () => {
      const productData = { title: 'Test Product', price: 1000, url: 'test-url', shopId: 'shop', itemCode: 'item' };
      const result = { id: 'test123', isNew: true };
      mockStorageManager.addProduct.mockResolvedValue(result);

      const promise = service.handleMessage(
        { action: 'TRACK_PRODUCT', data: productData },
        mockSender,
        mockSendResponse
      );

      await promise;

      expect(mockStorageManager.addProduct).toHaveBeenCalledWith(productData);
      expect(mockSendResponse).toHaveBeenCalledWith({ success: true, data: result });
    });

    it('should handle GET_PRODUCTS action', async () => {
      const products = { 'test123': { id: 'test123', title: 'Test' } };
      mockStorageManager.getAllProducts.mockResolvedValue(products);

      await service.handleMessage(
        { action: 'GET_PRODUCTS' },
        mockSender,
        mockSendResponse
      );

      expect(mockStorageManager.getAllProducts).toHaveBeenCalled();
      expect(mockSendResponse).toHaveBeenCalledWith({ success: true, data: products });
    });

    it('should handle UPDATE_PRODUCT action', async () => {
      const updates = { price: 1500 };
      const updatedProduct = { id: 'test123', price: 1500 };
      mockStorageManager.updateProduct.mockResolvedValue(updatedProduct);

      await service.handleMessage(
        { action: 'UPDATE_PRODUCT', productId: 'test123', updates },
        mockSender,
        mockSendResponse
      );

      expect(mockStorageManager.updateProduct).toHaveBeenCalledWith('test123', updates);
      expect(mockSendResponse).toHaveBeenCalledWith({ success: true, data: updatedProduct });
    });

    it('should handle DELETE_PRODUCT action', async () => {
      mockStorageManager.deleteProduct.mockResolvedValue(undefined);

      await service.handleMessage(
        { action: 'DELETE_PRODUCT', productId: 'test123' },
        mockSender,
        mockSendResponse
      );

      expect(mockStorageManager.deleteProduct).toHaveBeenCalledWith('test123');
      expect(mockSendResponse).toHaveBeenCalledWith({ success: true });
    });

    it('should handle GET_PRICE_HISTORY action', async () => {
      const history = [{ price: 1000, timestamp: 123456789 }];
      mockStorageManager.getPriceHistory.mockResolvedValue(history);

      await service.handleMessage(
        { action: 'GET_PRICE_HISTORY', productId: 'test123' },
        mockSender,
        mockSendResponse
      );

      expect(mockStorageManager.getPriceHistory).toHaveBeenCalledWith('test123');
      expect(mockSendResponse).toHaveBeenCalledWith({ success: true, data: history });
    });

    it('should handle EXPORT_DATA action', async () => {
      const exportData = { version: '1.0.0', products: {}, priceHistory: {} };
      mockStorageManager.exportData.mockResolvedValue(exportData);

      await service.handleMessage(
        { action: 'EXPORT_DATA' },
        mockSender,
        mockSendResponse
      );

      expect(mockStorageManager.exportData).toHaveBeenCalled();
      expect(mockSendResponse).toHaveBeenCalledWith({ success: true, data: exportData });
    });

    it('should handle IMPORT_DATA action', async () => {
      const importResult = { success: true, count: 5 };
      mockStorageManager.importData.mockResolvedValue(importResult);

      await service.handleMessage(
        { action: 'IMPORT_DATA', data: 'json-data' },
        mockSender,
        mockSendResponse
      );

      expect(mockStorageManager.importData).toHaveBeenCalledWith('json-data');
      expect(mockSendResponse).toHaveBeenCalledWith(importResult);
    });

    it('should handle CHECK_AND_STORE_PRICE action', async () => {
      mockStorageManager.addPricePointIfNew.mockResolvedValue(true);

      await service.handleMessage(
        { action: 'CHECK_AND_STORE_PRICE', productId: 'test123', price: 1500 } as any,
        mockSender,
        mockSendResponse
      );

      expect(mockStorageManager.addPricePointIfNew).toHaveBeenCalledWith('test123', 1500);
      expect(mockSendResponse).toHaveBeenCalledWith({ success: true, priceAdded: true });
    });

    it('should handle unknown action', async () => {
      await service.handleMessage(
        { action: 'UNKNOWN_ACTION' },
        mockSender,
        mockSendResponse
      );

      expect(mockSendResponse).toHaveBeenCalledWith({ success: false, error: 'Unknown action' });
    });

    it('should handle errors gracefully', async () => {
      mockStorageManager.getAllProducts.mockRejectedValue(new Error('Storage error'));

      await service.handleMessage(
        { action: 'GET_PRODUCTS' },
        mockSender,
        mockSendResponse
      );

      expect(mockSendResponse).toHaveBeenCalledWith({ success: false, error: 'Storage error' });
    });
  });


  describe('extractProductId', () => {
    it('should extract product ID from Rakuten URL', () => {
      const url = 'https://item.rakuten.co.jp/shop123/item456/';
      const result = service.extractProductId(url);
      expect(result).toBe('shop123_item456');
    });

    it('should return null for invalid URL', () => {
      const url = 'https://example.com/invalid';
      const result = service.extractProductId(url);
      expect(result).toBeNull();
    });
  });

  describe('handleNavigation', () => {
    beforeEach(() => {
      vi.spyOn(service, 'extractProductId').mockReturnValue('shop123_item456');
      mockStorageManager.getProduct.mockResolvedValue({ id: 'shop123_item456', title: 'Test Product' });
    });

    it('should set badge for tracked product on Rakuten', async () => {
      const navigationDetails = {
        frameId: 0,
        url: 'https://item.rakuten.co.jp/shop123/item456/',
        tabId: 123
      };

      await service.handleNavigation(navigationDetails);

      expect(chrome.action.setBadgeText).toHaveBeenCalledWith({
        text: '★',
        tabId: 123
      });
      expect(chrome.action.setBadgeBackgroundColor).toHaveBeenCalledWith({
        color: '#10b981',
        tabId: 123
      });
    });

    it('should not set badge for non-Rakuten URLs', async () => {
      const navigationDetails = {
        frameId: 0,
        url: 'https://example.com/page',
        tabId: 123
      };

      await service.handleNavigation(navigationDetails);

      expect(chrome.action.setBadgeText).not.toHaveBeenCalled();
    });

    it('should not set badge for sub-frames', async () => {
      const navigationDetails = {
        frameId: 1,
        url: 'https://item.rakuten.co.jp/shop123/item456/',
        tabId: 123
      };

      await service.handleNavigation(navigationDetails);

      expect(chrome.action.setBadgeText).not.toHaveBeenCalled();
    });

    it('should not set badge for untracked products', async () => {
      mockStorageManager.getProduct.mockResolvedValue(null);

      const navigationDetails = {
        frameId: 0,
        url: 'https://item.rakuten.co.jp/shop123/item456/',
        tabId: 123
      };

      await service.handleNavigation(navigationDetails);

      expect(chrome.action.setBadgeText).not.toHaveBeenCalled();
    });
  });




});