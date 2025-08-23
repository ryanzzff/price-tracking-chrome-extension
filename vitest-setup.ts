import { vi } from 'vitest';

// Mock Chrome APIs for testing
const mockStorage = {
  local: {
    get: vi.fn(),
    set: vi.fn(),
    remove: vi.fn(),
    clear: vi.fn(),
    getBytesInUse: vi.fn()
  },
  sync: {
    get: vi.fn(),
    set: vi.fn(),
    remove: vi.fn(),
    clear: vi.fn()
  }
};

const mockRuntime = {
  sendMessage: vi.fn(),
  onMessage: {
    addListener: vi.fn(),
    removeListener: vi.fn()
  },
  onInstalled: {
    addListener: vi.fn(),
    removeListener: vi.fn()
  },
  getManifest: vi.fn(() => ({ version: '1.0.0' }))
};

const mockAlarms = {
  create: vi.fn(),
  clear: vi.fn(),
  clearAll: vi.fn(),
  get: vi.fn(),
  getAll: vi.fn(),
  onAlarm: {
    addListener: vi.fn(),
    removeListener: vi.fn()
  }
};

const mockAction = {
  setBadgeText: vi.fn(),
  setBadgeBackgroundColor: vi.fn(),
  setTitle: vi.fn(),
  setIcon: vi.fn()
};

const mockNotifications = {
  create: vi.fn(),
  clear: vi.fn(),
  getAll: vi.fn(),
  onClicked: {
    addListener: vi.fn(),
    removeListener: vi.fn()
  }
};

const mockWebNavigation = {
  onCompleted: {
    addListener: vi.fn(),
    removeListener: vi.fn()
  }
};

const mockTabs = {
  query: vi.fn(),
  get: vi.fn(),
  create: vi.fn(),
  update: vi.fn()
};

// Set up global chrome mock
globalThis.chrome = {
  storage: mockStorage,
  runtime: mockRuntime,
  alarms: mockAlarms,
  action: mockAction,
  notifications: mockNotifications,
  webNavigation: mockWebNavigation,
  tabs: mockTabs
};

// Mock DOM globals for content script testing
globalThis.window = globalThis.window || {};
globalThis.window.location = {
  href: 'https://item.rakuten.co.jp/shop/item/',
  pathname: '/shop/item/',
  hostname: 'item.rakuten.co.jp'
} as Location;

// Mock console methods to reduce noise in tests
globalThis.console.warn = vi.fn();
globalThis.console.error = vi.fn();