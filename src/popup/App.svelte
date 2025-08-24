<script lang="ts">
  import { onMount } from 'svelte';
  import type { Product } from '../lib/storage-manager.js';
  import { 
    getMessage, 
    getMessageWithCount, 
    initializeI18n, 
    currentLanguage, 
    changeLanguage,
    formatPrice,
    formatDate,
    getAvailabilityMessage,
    type SupportedLanguage,
    SUPPORTED_LANGUAGES
  } from '../lib/i18n.js';
  
  // Component states
  let products: Record<string, Product> = {};
  let loading = true;
  let error = '';
  let activeTab: 'products' | 'settings' = 'products';
  let autoTrack = true;

  // Load tracked products on mount
  onMount(async () => {
    // Initialize i18n first
    await initializeI18n();
    
    try {
      // Load auto-track setting (default to true)
      const settingsResult = await chrome.storage.sync.get(['autoTrack']);
      autoTrack = settingsResult.autoTrack !== undefined ? settingsResult.autoTrack : true;
      
      console.log('Popup: Sending GET_PRODUCTS message');
      const response = await chrome.runtime.sendMessage({ action: 'GET_PRODUCTS' });
      console.log('Popup: Received response:', response);
      
      if (response && response.success) {
        products = response.data || {};
        console.log('Popup: Products loaded:', Object.keys(products).length);
      } else {
        error = (response && response.error) || getMessage('errorOccurred');
        console.error('Popup: Error from background:', error);
      }
    } catch (err) {
      error = chrome.i18n.getMessage('errorOccurred');
      console.error('Popup: Failed to load products:', err);
    } finally {
      loading = false;
    }
  });

  // Get products as array for easier rendering
  $: productList = Object.values(products);
  $: trackedCount = productList.length;

  // These functions are now imported from i18n.js
  // formatPrice and formatDate are available from the import

  // Delete a product
  async function deleteProduct(productId: string): Promise<void> {
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'DELETE_PRODUCT',
        productId
      });
      
      if (response.success) {
        delete products[productId];
        products = { ...products }; // Trigger reactivity
      } else {
        error = response.error || chrome.i18n.getMessage('errorOccurred');
      }
    } catch (err) {
      error = chrome.i18n.getMessage('errorOccurred');
      console.error('Failed to delete product:', err);
    }
  }

  // Open product URL in new tab
  function openProduct(url: string): void {
    chrome.tabs.create({ url });
  }

  // Export data
  async function exportData(): Promise<void> {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'EXPORT_DATA' });
      if (response.success) {
        const dataStr = JSON.stringify(response.data, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `rakuten-price-tracker-${new Date().toISOString().split('T')[0]}.json`;
        link.click();
        
        URL.revokeObjectURL(url);
      } else {
        error = response.error || chrome.i18n.getMessage('errorOccurred');
      }
    } catch (err) {
      error = chrome.i18n.getMessage('errorOccurred');
      console.error('Failed to export data:', err);
    }
  }

  // Handle language change
  async function handleLanguageChange(event: Event): Promise<void> {
    const target = event.target as HTMLSelectElement;
    await changeLanguage(target.value as SupportedLanguage);
  }

  // Handle auto-track setting change
  async function toggleAutoTrack(): Promise<void> {
    try {
      autoTrack = !autoTrack;
      await chrome.storage.sync.set({ autoTrack });
      console.log('Auto-track setting updated:', autoTrack);
    } catch (err) {
      console.error('Failed to update auto-track setting:', err);
      autoTrack = !autoTrack; // Revert on error
    }
  }

  // Reactive message function that updates when currentLanguage changes
  $: getReactiveMessage = (key: string, substitutions?: string | string[]) => {
    // This will re-run when $currentLanguage changes
    $currentLanguage; // Just to make it reactive
    return getMessage(key, substitutions);
  }

  $: getReactiveMessageWithCount = (key: string, count: number) => {
    $currentLanguage; // Just to make it reactive
    return getMessageWithCount(key, count);
  }

  // Import data
  async function importData(): Promise<void> {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      
      try {
        const text = await file.text();
        const response = await chrome.runtime.sendMessage({
          action: 'IMPORT_DATA',
          data: text
        });
        
        if (response.success) {
          // Reload products after import
          const productsResponse = await chrome.runtime.sendMessage({ action: 'GET_PRODUCTS' });
          if (productsResponse.success) {
            products = productsResponse.data;
          }
          alert(chrome.i18n.getMessage('productsImported', [response.count.toString()]));
        } else {
          error = response.error || chrome.i18n.getMessage('errorOccurred');
        }
      } catch (err) {
        error = chrome.i18n.getMessage('errorOccurred');
        console.error('Failed to import data:', err);
      }
    };
    
    input.click();
  }
</script>

<main class="w-96 h-[600px] bg-white flex flex-col">
  <!-- Header -->
  <header class="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-4 flex items-center justify-between">
    <div class="flex items-center gap-2">
      <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
        <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
      </svg>
      <h1 class="text-lg font-semibold">{getReactiveMessage('priceTracker')}</h1>
    </div>
    <div class="text-sm opacity-90">
      {getReactiveMessageWithCount('productCount', trackedCount)}
    </div>
  </header>

  <!-- Tab Navigation -->
  <nav class="flex border-b border-gray-200">
    <button 
      class="flex-1 py-3 px-4 text-sm font-medium {activeTab === 'products' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50' : 'text-gray-500 hover:text-gray-700'}"
      on:click={() => activeTab = 'products'}
    >
      {getReactiveMessage('productsTab')}
    </button>
    <button 
      class="flex-1 py-3 px-4 text-sm font-medium {activeTab === 'settings' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50' : 'text-gray-500 hover:text-gray-700'}"
      on:click={() => activeTab = 'settings'}
    >
      {getReactiveMessage('settingsTab')}
    </button>
  </nav>

  <!-- Content Area -->
  <div class="flex-1 overflow-hidden">
    {#if loading}
      <div class="flex items-center justify-center h-full">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    {:else if error}
      <div class="p-4 bg-red-50 border-l-4 border-red-400 text-red-700">
        <p class="font-medium">{getReactiveMessage('errorOccurred')}</p>
        <p class="text-sm">{error}</p>
      </div>
    {:else if activeTab === 'products'}
      <!-- Products Tab -->
      {#if trackedCount === 0}
        <div class="flex flex-col items-center justify-center h-full text-gray-500 p-8">
          <svg class="w-16 h-16 mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2 2v-5m16 0h-2m-2 0H8m8 0V9a2 2 0 00-2-2H8a2 2 0 00-2 2v4.01"/>
          </svg>
          <p class="text-center mb-2">{getReactiveMessage('noProductsTracked')}</p>
          <p class="text-sm text-center">{getReactiveMessage('trackingInstructions')}</p>
        </div>
      {:else}
        <div class="overflow-y-auto h-full">
          {#each productList as product (product.id)}
            <div class="border-b border-gray-100 p-4 hover:bg-gray-50 transition-colors">
              <div class="flex items-start justify-between gap-3">
                <div class="flex-1 min-w-0">
                  <button 
                    class="font-medium text-gray-900 text-sm line-clamp-2 cursor-pointer hover:text-blue-600 transition-colors text-left w-full"
                    on:click={() => openProduct(product.url)}
                    title={product.title}
                    aria-label="{getReactiveMessage('openProductPage')}: {product.title}"
                  >
                    {product.title}
                  </button>
                  <div class="mt-1 flex items-center gap-4">
                    <span class="text-lg font-bold text-gray-900">
                      {formatPrice(product.price, $currentLanguage)}
                    </span>
                    {#if product.availability && product.availability !== 'unknown'}
                      <span class="text-xs px-2 py-1 rounded-full {
                        product.availability === 'available' ? 'bg-green-100 text-green-800' :
                        product.availability === 'out_of_stock' ? 'bg-red-100 text-red-800' :
                        product.availability === 'backorder' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-gray-100 text-gray-800'
                      }">
                        {getAvailabilityMessage(product.availability)}
                      </span>
                    {/if}
                  </div>
                  {#if product.seller}
                    <div class="mt-1">
                      <span class="text-xs text-blue-600 font-medium">{product.seller}</span>
                    </div>
                  {/if}
                  <p class="text-xs text-gray-500 mt-1">
                    {getReactiveMessage('trackingStartedFrom')} {formatDate(product.createdAt, $currentLanguage)}
                  </p>
                </div>
                <div class="flex flex-col gap-1">
                  <button
                    class="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                    on:click={() => openProduct(product.url)}
                    aria-label="{getReactiveMessage('openProductPage')}"
                  >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
                    </svg>
                  </button>
                  <button
                    class="p-1 text-gray-400 hover:text-red-600 transition-colors"
                    on:click={() => deleteProduct(product.id)}
                    aria-label="{getReactiveMessage('stopTracking')}"
                  >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    {:else}
      <!-- Settings Tab -->
      <div class="p-4 space-y-4 overflow-y-auto h-full">
        <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 class="font-medium text-blue-900 mb-2">{getReactiveMessage('usage')}</h3>
          <p class="text-sm text-blue-800">
            {getReactiveMessage('usageDescription')}
          </p>
        </div>
        
        <div class="border border-gray-200 rounded-lg p-4">
          <h3 class="font-medium text-gray-900 mb-3">{getReactiveMessage('dataManagement')}</h3>
          <div class="space-y-2">
            <button 
              class="w-full px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              on:click={exportData}
            >
              {getReactiveMessage('exportData')}
            </button>
            <button 
              class="w-full px-4 py-2 text-sm border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
              on:click={importData}
            >
              {getReactiveMessage('importData')}
            </button>
          </div>
          <p class="text-xs text-gray-500 mt-2">
            {getReactiveMessage('dataManagementDescription')}
          </p>
        </div>

        <div class="border border-gray-200 rounded-lg p-4">
          <h3 class="font-medium text-gray-900 mb-3">Auto-tracking</h3>
          <div class="flex items-center justify-between">
            <div class="flex-1">
              <label for="autoTrack" class="text-sm font-medium text-gray-700">
                Automatically track products
              </label>
              <p class="text-xs text-gray-500 mt-1">
                Start tracking prices when you visit product pages
              </p>
            </div>
            <button
              id="autoTrack"
              type="button"
              class="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 {autoTrack ? 'bg-blue-600' : 'bg-gray-200'}"
              role="switch"
              aria-checked={autoTrack}
              on:click={toggleAutoTrack}
            >
              <span class="sr-only">Enable auto-tracking</span>
              <span
                aria-hidden="true"
                class="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out {autoTrack ? 'translate-x-5' : 'translate-x-0'}"
              ></span>
            </button>
          </div>
        </div>

        <div class="border border-gray-200 rounded-lg p-4">
          <h3 class="font-medium text-gray-900 mb-3">{getReactiveMessage('language')}</h3>
          <select 
            class="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            bind:value={$currentLanguage}
            on:change={handleLanguageChange}
          >
            {#each Object.entries(SUPPORTED_LANGUAGES) as [code, messageKey]}
              <option value={code}>{getReactiveMessage(messageKey)}</option>
            {/each}
          </select>
        </div>

        <div class="text-xs text-gray-500 text-center pt-4">
          Rakuten Price Tracker v1.0.0
        </div>
      </div>
    {/if}
  </div>
</main>

<style>
  .line-clamp-2 {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
</style>