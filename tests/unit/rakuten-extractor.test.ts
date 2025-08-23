import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RakutenProductExtractor } from '../../src/content/rakuten-extractor.js';

// Mock DOM elements for testing
const createMockElement = (content: string, properties: Record<string, any> = {}) => {
  return {
    textContent: content,
    innerText: content,
    innerHTML: content,
    ...properties
  };
};

describe('RakutenProductExtractor', () => {
  let extractor: RakutenProductExtractor;
  let mockDocument: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock document.querySelector and querySelectorAll
    mockDocument = {
      querySelector: vi.fn(),
      querySelectorAll: vi.fn(() => []),
      createElement: vi.fn(),
      head: { appendChild: vi.fn() },
      body: { appendChild: vi.fn() }
    };
    
    // Set up global document mock
    globalThis.document = mockDocument;
    
    // Mock window.location
    globalThis.window.location = {
      href: 'https://item.rakuten.co.jp/shop123/item456/',
      pathname: '/shop123/item456/',
      hostname: 'item.rakuten.co.jp'
    } as Location;

    // Mock chrome.storage.sync.get
    chrome.storage.sync.get.mockResolvedValue({ trackingEnabled: true });
    
    extractor = new RakutenProductExtractor();
  });

  describe('constructor', () => {
    it('should initialize with default properties', () => {
      expect(extractor.productData).toBeNull();
      expect(extractor.trackingEnabled).toBe(true);
    });
  });

  describe('isProductPage', () => {
    it('should return true for valid Rakuten product URL with product title', () => {
      globalThis.window.location.href = 'https://item.rakuten.co.jp/shop123/item456/';
      mockDocument.querySelector.mockReturnValue(createMockElement('Test Product'));
      
      const result = extractor.isProductPage();
      expect(result).toBe(true);
    });

    it('should return false for non-Rakuten URL', () => {
      globalThis.window.location.href = 'https://example.com/product';
      
      const result = extractor.isProductPage();
      expect(result).toBe(false);
    });

    it('should return false for Rakuten URL without product title element', () => {
      globalThis.window.location.href = 'https://item.rakuten.co.jp/shop123/item456/';
      mockDocument.querySelector.mockReturnValue(null);
      
      const result = extractor.isProductPage();
      expect(result).toBe(false);
    });

    it('should return true for URL with query parameters', () => {
      globalThis.window.location.href = 'https://item.rakuten.co.jp/shop123/item456/?param=value';
      mockDocument.querySelector.mockReturnValue(createMockElement('Test Product'));
      
      const result = extractor.isProductPage();
      expect(result).toBe(true);
    });
  });

  describe('getProductTitle', () => {
    it('should extract title from .item_name selector', () => {
      mockDocument.querySelector
        .mockReturnValueOnce(createMockElement('  Amazing Product Title  '))
        .mockReturnValue(null);
      
      const result = extractor.getProductTitle();
      expect(result).toBe('Amazing Product Title');
      expect(mockDocument.querySelector).toHaveBeenCalledWith('.item_name');
    });

    it('should try multiple selectors until finding one', () => {
      mockDocument.querySelector
        .mockReturnValueOnce(null) // .item_name
        .mockReturnValueOnce(null) // .item-name
        .mockReturnValueOnce(createMockElement('Product from h1.item_name'));
      
      const result = extractor.getProductTitle();
      expect(result).toBe('Product from h1.item_name');
      expect(mockDocument.querySelector).toHaveBeenCalledTimes(3);
    });

    it('should return null if no title found', () => {
      mockDocument.querySelector.mockReturnValue(null);
      
      const result = extractor.getProductTitle();
      expect(result).toBeNull();
    });
  });

  describe('getProductPrice', () => {
    it('should extract price in yen format (¥1,234)', () => {
      mockDocument.querySelector
        .mockReturnValueOnce(createMockElement('¥1,234'))
        .mockReturnValue(null);
      
      const result = extractor.getProductPrice();
      expect(result).toBe(1234);
    });

    it('should extract price in Japanese format (1,234円)', () => {
      mockDocument.querySelector
        .mockReturnValueOnce(createMockElement('1,234円'))
        .mockReturnValue(null);
      
      const result = extractor.getProductPrice();
      expect(result).toBe(1234);
    });

    it('should handle price without commas', () => {
      mockDocument.querySelector
        .mockReturnValueOnce(createMockElement('500円'))
        .mockReturnValue(null);
      
      const result = extractor.getProductPrice();
      expect(result).toBe(500);
    });

    it('should handle complex price text', () => {
      mockDocument.querySelector
        .mockReturnValueOnce(createMockElement('価格: ¥12,345 (税込)'))
        .mockReturnValue(null);
      
      const result = extractor.getProductPrice();
      expect(result).toBe(12345);
    });

    it('should try multiple selectors', () => {
      mockDocument.querySelector
        .mockReturnValueOnce(null) // .price
        .mockReturnValueOnce(createMockElement('¥2,500'));
      
      const result = extractor.getProductPrice();
      expect(result).toBe(2500);
      expect(mockDocument.querySelector).toHaveBeenCalledWith('.item_price');
    });

    it('should return null if no price found', () => {
      mockDocument.querySelector.mockReturnValue(null);
      
      const result = extractor.getProductPrice();
      expect(result).toBeNull();
    });
  });

  describe('getAvailability', () => {
    it('should detect available status in Japanese', () => {
      mockDocument.querySelectorAll.mockReturnValue([
        createMockElement('在庫あり - 即日発送')
      ]);
      
      const result = extractor.getAvailability();
      expect(result).toBe('available');
    });

    it('should detect out of stock status', () => {
      mockDocument.querySelectorAll.mockReturnValue([
        createMockElement('在庫切れ')
      ]);
      
      const result = extractor.getAvailability();
      expect(result).toBe('out_of_stock');
    });

    it('should detect backorder status', () => {
      mockDocument.querySelectorAll.mockReturnValue([
        createMockElement('お取り寄せ商品')
      ]);
      
      const result = extractor.getAvailability();
      expect(result).toBe('backorder');
    });

    it('should return unknown for unrecognized status', () => {
      mockDocument.querySelectorAll.mockReturnValue([
        createMockElement('不明なステータス')
      ]);
      
      const result = extractor.getAvailability();
      expect(result).toBe('unknown');
    });

    it('should return unknown when no stock elements found', () => {
      mockDocument.querySelectorAll.mockReturnValue([]);
      
      const result = extractor.getAvailability();
      expect(result).toBe('unknown');
    });
  });

  describe('extractShopId', () => {
    it('should extract shop ID from URL', () => {
      globalThis.window.location.pathname = '/testshop/itemcode123/';
      
      const result = extractor.extractShopId();
      expect(result).toBe('testshop');
    });

    it('should return null for invalid URL format', () => {
      globalThis.window.location.pathname = '/invalid/';
      
      const result = extractor.extractShopId();
      expect(result).toBeNull();
    });
  });

  describe('extractItemCode', () => {
    it('should extract item code from URL', () => {
      globalThis.window.location.pathname = '/testshop/itemcode123/';
      
      const result = extractor.extractItemCode();
      expect(result).toBe('itemcode123');
    });

    it('should return null for invalid URL format', () => {
      globalThis.window.location.pathname = '/invalid/';
      
      const result = extractor.extractItemCode();
      expect(result).toBeNull();
    });
  });

  describe('extractProductData', () => {
    beforeEach(() => {
      // Mock all the individual extraction methods
      vi.spyOn(extractor, 'extractShopId').mockReturnValue('testshop');
      vi.spyOn(extractor, 'extractItemCode').mockReturnValue('testitem');
      vi.spyOn(extractor, 'getProductTitle').mockReturnValue('Test Product');
      vi.spyOn(extractor, 'getProductPrice').mockReturnValue(1500);
      vi.spyOn(extractor, 'getAvailability').mockReturnValue('available');
      vi.spyOn(Date, 'now').mockReturnValue(1234567890);
    });

    it('should extract complete product data', () => {
      globalThis.window.location.href = 'https://item.rakuten.co.jp/testshop/testitem/';
      
      const result = extractor.extractProductData();
      
      expect(result).toEqual({
        url: 'https://item.rakuten.co.jp/testshop/testitem/',
        shopId: 'testshop',
        itemCode: 'testitem',
        title: 'Test Product',
        price: 1500,
        availability: 'available',
        timestamp: 1234567890
      });
      
      expect(extractor.productData).toEqual(result);
    });

    it('should store product data in instance property', () => {
      extractor.extractProductData();
      expect(extractor.productData).not.toBeNull();
    });
  });

  describe('trackProduct', () => {
    const mockProductData = {
      url: 'https://item.rakuten.co.jp/shop/item/',
      title: 'Test Product',
      price: 1000,
      shopId: 'shop',
      itemCode: 'item'
    };

    beforeEach(() => {
      extractor.productData = mockProductData;
      chrome.runtime.sendMessage.mockResolvedValue({ success: true });
    });

    it('should send product data to background script', async () => {
      await extractor.trackProduct();
      
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
        action: 'TRACK_PRODUCT',
        data: mockProductData
      });
    });

    it('should return early if no product data', async () => {
      extractor.productData = null;
      
      await extractor.trackProduct();
      
      expect(chrome.runtime.sendMessage).not.toHaveBeenCalled();
    });

    it('should handle successful response', async () => {
      chrome.runtime.sendMessage.mockResolvedValue({ success: true });
      vi.spyOn(extractor, 'updateButtonState').mockImplementation(() => {});
      vi.spyOn(extractor, 'showStatus').mockImplementation(() => {});
      
      await extractor.trackProduct();
      
      expect(extractor.updateButtonState).toHaveBeenCalledWith('tracking');
      expect(extractor.showStatus).toHaveBeenCalledWith('商品の追跡を開始しました', 'success');
    });

    it('should handle errors gracefully', async () => {
      chrome.runtime.sendMessage.mockRejectedValue(new Error('Connection failed'));
      vi.spyOn(extractor, 'showStatus').mockImplementation(() => {});
      vi.spyOn(console, 'error').mockImplementation(() => {});
      
      await extractor.trackProduct();
      
      expect(extractor.showStatus).toHaveBeenCalledWith('エラーが発生しました', 'error');
      expect(console.error).toHaveBeenCalledWith('Failed to track product:', expect.any(Error));
    });
  });

  describe('init', () => {
    beforeEach(() => {
      vi.spyOn(extractor, 'isProductPage').mockReturnValue(true);
      vi.spyOn(extractor, 'extractProductData').mockImplementation(() => {});
      vi.spyOn(extractor, 'injectTrackingUI').mockImplementation(() => {});
      vi.spyOn(extractor, 'checkAndStoreTodaysPrice').mockImplementation(async () => {});
    });

    it('should initialize when tracking is enabled and on product page', async () => {
      chrome.storage.sync.get.mockResolvedValue({ trackingEnabled: true });
      
      await extractor.init();
      
      expect(extractor.trackingEnabled).toBe(true);
      expect(extractor.extractProductData).toHaveBeenCalled();
      expect(extractor.injectTrackingUI).toHaveBeenCalled();
      expect(extractor.checkAndStoreTodaysPrice).toHaveBeenCalled();
    });

    it('should not initialize when tracking is disabled', async () => {
      chrome.storage.sync.get.mockResolvedValue({ trackingEnabled: false });
      
      await extractor.init();
      
      expect(extractor.trackingEnabled).toBe(false);
      expect(extractor.extractProductData).not.toHaveBeenCalled();
    });

    it('should not initialize when not on product page', async () => {
      chrome.storage.sync.get.mockResolvedValue({ trackingEnabled: true });
      vi.spyOn(extractor, 'isProductPage').mockReturnValue(false);
      
      await extractor.init();
      
      expect(extractor.extractProductData).not.toHaveBeenCalled();
    });
  });

  describe('checkAndStoreTodaysPrice', () => {
    beforeEach(() => {
      extractor.productData = {
        url: 'https://item.rakuten.co.jp/shop123/item456/',
        title: 'Test Product',
        price: 1500,
        shopId: 'shop123',
        itemCode: 'item456',
        availability: 'available',
        timestamp: Date.now()
      };
    });

    it('should send price check message when product data exists', async () => {
      chrome.runtime.sendMessage.mockResolvedValue({ success: true, priceAdded: true });
      vi.spyOn(console, 'log').mockImplementation(() => {});
      
      await extractor.checkAndStoreTodaysPrice();
      
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
        action: 'CHECK_AND_STORE_PRICE',
        productId: 'shop123_item456',
        price: 1500
      });
    });

    it('should log when price is added', async () => {
      chrome.runtime.sendMessage.mockResolvedValue({ success: true, priceAdded: true });
      vi.spyOn(console, 'log').mockImplementation(() => {});
      
      await extractor.checkAndStoreTodaysPrice();
      
      expect(console.log).toHaveBeenCalledWith('Today\'s price stored for product:', 'Test Product');
    });

    it('should not log when price already exists', async () => {
      chrome.runtime.sendMessage.mockResolvedValue({ success: true, priceAdded: false });
      vi.spyOn(console, 'log').mockImplementation(() => {});
      
      await extractor.checkAndStoreTodaysPrice();
      
      expect(console.log).not.toHaveBeenCalled();
    });

    it('should return early when no product data', async () => {
      extractor.productData = null;
      
      await extractor.checkAndStoreTodaysPrice();
      
      expect(chrome.runtime.sendMessage).not.toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      chrome.runtime.sendMessage.mockRejectedValue(new Error('Connection failed'));
      vi.spyOn(console, 'error').mockImplementation(() => {});
      
      await extractor.checkAndStoreTodaysPrice();
      
      expect(console.error).toHaveBeenCalledWith('Failed to check and store price:', expect.any(Error));
    });
  });

  describe('generateProductId', () => {
    it('should generate ID from Rakuten URL', () => {
      const result = extractor['generateProductId']('https://item.rakuten.co.jp/shop123/item456/');
      expect(result).toBe('shop123_item456');
    });

    it('should fallback to base64 for non-Rakuten URLs', () => {
      const result = extractor['generateProductId']('https://example.com/product');
      expect(result).toHaveLength(16);
      expect(result).toMatch(/^[a-zA-Z0-9]+$/);
    });
  });
});