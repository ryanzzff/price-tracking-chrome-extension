<script lang="ts">
  import { onMount } from 'svelte';
  import type { Product } from '../lib/storage-manager.js';
  
  // Component states
  let products: Record<string, Product> = {};
  let loading = true;
  let error = '';
  let activeTab: 'products' | 'settings' = 'products';

  // Load tracked products on mount
  onMount(async () => {
    try {
      console.log('Popup: Sending GET_PRODUCTS message');
      const response = await chrome.runtime.sendMessage({ action: 'GET_PRODUCTS' });
      console.log('Popup: Received response:', response);
      
      if (response && response.success) {
        products = response.data || {};
        console.log('Popup: Products loaded:', Object.keys(products).length);
      } else {
        error = (response && response.error) || 'Failed to load products';
        console.error('Popup: Error from background:', error);
      }
    } catch (err) {
      error = 'Failed to communicate with extension';
      console.error('Popup: Failed to load products:', err);
    } finally {
      loading = false;
    }
  });

  // Get products as array for easier rendering
  $: productList = Object.values(products);
  $: trackedCount = productList.length;

  // Format price in Japanese yen
  function formatPrice(price: number): string {
    return new Intl.NumberFormat('ja-JP', {
      style: 'currency',
      currency: 'JPY'
    }).format(price);
  }

  // Format date in Japanese locale
  function formatDate(timestamp: number): string {
    return new Intl.DateTimeFormat('ja-JP', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(timestamp));
  }

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
        error = response.error || 'Failed to delete product';
      }
    } catch (err) {
      error = 'Failed to delete product';
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
        error = response.error || 'Failed to export data';
      }
    } catch (err) {
      error = 'Failed to export data';
      console.error('Failed to export data:', err);
    }
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
          alert(`${response.count}個の商品をインポートしました`);
        } else {
          error = response.error || 'Failed to import data';
        }
      } catch (err) {
        error = 'Failed to import data';
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
      <h1 class="text-lg font-semibold">価格トラッカー</h1>
    </div>
    <div class="text-sm opacity-90">
      {trackedCount}個の商品
    </div>
  </header>

  <!-- Tab Navigation -->
  <nav class="flex border-b border-gray-200">
    <button 
      class="flex-1 py-3 px-4 text-sm font-medium {activeTab === 'products' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50' : 'text-gray-500 hover:text-gray-700'}"
      on:click={() => activeTab = 'products'}
    >
      商品一覧
    </button>
    <button 
      class="flex-1 py-3 px-4 text-sm font-medium {activeTab === 'settings' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50' : 'text-gray-500 hover:text-gray-700'}"
      on:click={() => activeTab = 'settings'}
    >
      設定
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
        <p class="font-medium">エラーが発生しました</p>
        <p class="text-sm">{error}</p>
      </div>
    {:else if activeTab === 'products'}
      <!-- Products Tab -->
      {#if trackedCount === 0}
        <div class="flex flex-col items-center justify-center h-full text-gray-500 p-8">
          <svg class="w-16 h-16 mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2 2v-5m16 0h-2m-2 0H8m8 0V9a2 2 0 00-2-2H8a2 2 0 00-2 2v4.01"/>
          </svg>
          <p class="text-center mb-2">まだ商品を追跡していません</p>
          <p class="text-sm text-center">楽天の商品ページで「価格を追跡」ボタンを押してください</p>
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
                    aria-label="商品ページを開く: {product.title}"
                  >
                    {product.title}
                  </button>
                  <div class="mt-1 flex items-center gap-4">
                    <span class="text-lg font-bold text-gray-900">
                      {formatPrice(product.price)}
                    </span>
                    {#if product.availability}
                      <span class="text-xs px-2 py-1 rounded-full {
                        product.availability === 'available' ? 'bg-green-100 text-green-800' :
                        product.availability === 'out_of_stock' ? 'bg-red-100 text-red-800' :
                        product.availability === 'backorder' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-gray-100 text-gray-800'
                      }">
                        {product.availability === 'available' ? '在庫あり' :
                         product.availability === 'out_of_stock' ? '在庫切れ' :
                         product.availability === 'backorder' ? 'お取り寄せ' :
                         '不明'}
                      </span>
                    {/if}
                  </div>
                  <p class="text-xs text-gray-500 mt-1">
                    追跡開始: {formatDate(product.createdAt)}
                  </p>
                </div>
                <div class="flex flex-col gap-1">
                  <button
                    class="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                    on:click={() => openProduct(product.url)}
                    aria-label="商品ページを開く"
                  >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
                    </svg>
                  </button>
                  <button
                    class="p-1 text-gray-400 hover:text-red-600 transition-colors"
                    on:click={() => deleteProduct(product.id)}
                    aria-label="追跡を停止"
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
      <div class="p-4 space-y-4">
        <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 class="font-medium text-blue-900 mb-2">使用方法</h3>
          <p class="text-sm text-blue-800">
            楽天の商品ページで「価格を追跡」ボタンを押すと、その商品の価格を毎日記録します。価格の履歴はここで確認できます。
          </p>
        </div>
        
        <div class="border border-gray-200 rounded-lg p-4">
          <h3 class="font-medium text-gray-900 mb-3">データ管理</h3>
          <div class="space-y-2">
            <button 
              class="w-full px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              on:click={exportData}
            >
              データをエクスポート
            </button>
            <button 
              class="w-full px-4 py-2 text-sm border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
              on:click={importData}
            >
              データをインポート
            </button>
          </div>
          <p class="text-xs text-gray-500 mt-2">
            追跡中の商品データと価格履歴を保存・復元できます
          </p>
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