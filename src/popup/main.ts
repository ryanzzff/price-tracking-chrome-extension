import './app.css';
// import App from './App.svelte';

// For now, just create a simple placeholder
// TODO: Replace with actual Svelte app once we implement the popup interface
const app = document.createElement('div');
app.innerHTML = `
  <div class="p-4">
    <h1 class="text-xl font-bold mb-4">Rakuten Price Tracker</h1>
    <p class="text-gray-600">Popup interface coming soon...</p>
  </div>
`;
document.getElementById('app')?.appendChild(app);

export default app;