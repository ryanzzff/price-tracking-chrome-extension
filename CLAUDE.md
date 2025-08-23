# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Chrome extension for tracking product prices on Rakuten (item.rakuten.co.jp) built with:
- **Build Tool**: Vite with `vite-plugin-web-extension`
- **Frontend Framework**: Svelte 4 
- **Styling**: TailwindCSS
- **Charting**: LayerChart with D3 scales
- **Extension Type**: Manifest V3

## Architecture

The extension follows a standard Chrome extension structure:
- `src/popup/` - Svelte-based popup interface with price visualization
- `src/background/` - Service worker for periodic price monitoring 
- `src/content/` - Content scripts for Rakuten product data extraction
- `src/lib/` - Shared utilities (storage manager, price checker, notifications)

### Key Components

**Content Script** (`src/content/content-script.js`):
- Extracts product data from Rakuten pages using Japanese-specific selectors
- Handles Japanese price formats (¥1,234 and 1,234円)
- Detects availability status in Japanese (在庫あり, 売り切れ, etc.)
- Injects floating action button for manual tracking

**Storage Manager** (`src/lib/storage-manager.js`):
- Uses chrome.storage.local for product data (up to 10MB)
- Uses chrome.storage.sync for user preferences
- Implements LRU caching and automatic data cleanup
- Supports data import/export functionality

**Background Service Worker** (`src/background/service-worker.js`):
- Periodic price checking using Chrome Alarms API
- Batch processing to handle multiple products efficiently
- Price change notifications and alerts
- Badge updates for tracked products

## Development Commands

Based on the README implementation guide:

```bash
# Development (with HMR for popup/options)
npm run dev

# Production build
npm run build

# Preview build
npm run preview
```

## Extension Structure

```
src/
├── popup/
│   ├── index.html
│   ├── Popup.svelte
│   └── components/
│       ├── PriceChart.svelte
│       └── Settings.svelte
├── background/
│   └── service-worker.js
├── content/
│   ├── content-script.js
│   └── styles.css
└── lib/
    ├── storage-manager.js
    ├── price-checker.js
    └── notification-manager.js
```

## Rakuten-Specific Implementation

- **URL Pattern**: `/item.rakuten.co.jp/[shop-id]/[item-code]/`
- **Price Selectors**: `.price`, `.item_price`, `.price-value`, `[itemprop="price"]`
- **Product Name Selectors**: `.item_name`, `.item-name`, `h1.item_name`
- **Japanese Text Handling**: Properly parses Japanese availability indicators

## Data Management

- **Product Storage**: chrome.storage.local with automatic cleanup after 365 days
- **Price History**: Compressed storage with delta encoding for performance
- **Settings Sync**: chrome.storage.sync for cross-device preference synchronization

## Development Notes

- Content scripts require manual extension reload during development
- Popup and options pages support HMR via Vite
- Extension targets Chrome 88+ (ES2020)
- Uses Japanese UI text for better user experience
- Implements batch processing for performance with large datasets

## Extension Permissions

- `storage` - Data persistence
- `tabs` - Tab management and badges
- `webNavigation` - Page navigation detection
- `notifications` - Price alerts
- `alarms` - Periodic price checking
- `host_permissions` - Limited to `https://item.rakuten.co.jp/*`