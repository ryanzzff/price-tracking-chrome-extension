# Rakuten Price Tracker Chrome Extension

A Chrome extension that passively tracks product prices on Rakuten (楽天市場) by storing one price point per day when you visit product pages. Built with Svelte 5, TypeScript, TailwindCSS v4, and comprehensive test coverage.

## 🎯 Features

- **Passive Price Tracking**: Automatically stores daily price data when visiting Rakuten product pages
- **Japanese UI**: Full Japanese language support with proper currency and date formatting
- **Product Management**: View tracked products, delete tracking, open product pages
- **Data Export/Import**: Backup and restore your tracking data
- **Browser Badge**: Shows ⭐ badge when viewing tracked products
- **Test Coverage**: 79 tests covering all functionality

## 🛠 Development Setup

### Prerequisites
- Node.js 18+ 
- Chrome browser for testing

### Installation

```sh
# Clone or download the project
npm install

# Run tests
npm test

# Build the extension
npm run build
```

## 🚀 Loading the Extension in Chrome

### Step 1: Build the Extension
```sh
npm run build
```
This creates a `dist/` folder with the built extension.

### Step 2: Enable Developer Mode
1. Open Chrome and go to `chrome://extensions/`
2. Toggle on **"Developer mode"** in the top right corner

### Step 3: Load the Extension
1. Click **"Load unpacked"** button
2. Select the `dist/` folder from this project
3. The extension should now appear in your extensions list

### Step 4: Pin the Extension (Optional)
1. Click the puzzle piece icon in Chrome's toolbar
2. Click the pin icon next to "Rakuten Price Tracker"
3. The extension icon will appear in your toolbar

## 📱 How to Use

### Tracking Products

1. **Visit a Rakuten Product Page**
   - Go to any product page on `item.rakuten.co.jp`
   - Example: `https://item.rakuten.co.jp/shop123/item456/`

2. **Track the Product**
   - A blue floating "価格を追跡" (Track Price) button appears
   - Click it to start tracking the product
   - The button turns green showing "追跡中" (Tracking)

3. **Daily Price Recording**
   - The extension automatically stores today's price (once per day)
   - No background monitoring - only when you visit the page

### Managing Tracked Products

1. **Open the Popup**
   - Click the extension icon in Chrome's toolbar
   - Or click the ⭐ badge that appears on tracked product pages

2. **View Your Products**
   - See all tracked products in Japanese
   - View current prices in ¥ format
   - Check stock status (在庫あり/在庫切れ/お取り寄せ)
   - See when tracking started

3. **Product Actions**
   - Click product title to open the product page
   - Click 🗑 icon to stop tracking
   - Click 🔗 icon to open product page

### Data Management

1. **Export Your Data**
   - Go to Settings tab (設定)
   - Click "データをエクスポート" (Export Data)
   - Downloads a JSON file with timestamp

2. **Import Data**
   - Click "データをインポート" (Import Data)
   - Select your exported JSON file
   - All products and price history are restored

## 🧪 Testing

```sh
# Run all tests
npm test

# Watch mode during development
npm run test:watch
```

Test coverage includes:
- **Storage Manager**: 22 tests for data persistence and daily price logic
- **Rakuten Extractor**: 39 tests for product data extraction
- **Background Service**: 17 tests for message handling and navigation

## 🏗 Architecture

- **Content Script** (`src/content/`): Extracts product data and injects tracking UI
- **Background Service** (`src/background/`): Handles message routing and badge management  
- **Storage Manager** (`src/lib/`): Data persistence with caching and daily price limits
- **Popup Interface** (`src/popup/`): Svelte 5 UI for managing tracked products

## 🔧 Technical Details

- **Manifest V3** Chrome extension
- **Passive tracking**: No background alarms or periodic checks
- **Daily limit**: Maximum one price point stored per product per day
- **Data retention**: Price history kept for 365 days
- **Japanese locale**: Proper ¥ formatting and Japanese dates
- **Accessibility**: Full ARIA support and keyboard navigation

## 📄 File Structure

```
src/
├── background/          # Service worker and background logic
├── content/            # Content script for Rakuten pages
├── lib/               # Storage manager and utilities  
├── popup/             # Svelte popup interface
└── options/           # Extension options page (placeholder)

tests/unit/            # Comprehensive test suite
docs/                  # Implementation documentation
```

## 🐛 Troubleshooting

### Extension Not Loading
- Make sure you built with `npm run build`
- Check `chrome://extensions/` for error messages
- Reload the extension after code changes

### Tracking Button Not Appearing
- Ensure you're on a valid Rakuten product page (`item.rakuten.co.jp`)
- Check the page has product title elements
- Try refreshing the page

### Data Not Saving
- Check extension permissions in `chrome://extensions/`
- Look for errors in Chrome DevTools console
- Verify storage permissions are granted

## 🤝 Contributing

This project uses Test-Driven Development (TDD):
1. Write tests first (Red)
2. Implement minimal code to pass (Green) 
3. Refactor while keeping tests passing
4. All code changes must maintain 100% test coverage

## 📝 License

MIT License - see LICENSE file for details.
