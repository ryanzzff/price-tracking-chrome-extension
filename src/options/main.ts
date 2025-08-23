import '../app.css';
// import App from './App.svelte';

// For now, just create a simple placeholder
// TODO: Replace with actual Svelte app once we implement the options interface
const app = document.createElement('div');
app.innerHTML = `
  <div class="container mx-auto p-8">
    <h1 class="text-2xl font-bold mb-6">Rakuten Price Tracker - Options</h1>
    <p class="text-gray-600">Options interface coming soon...</p>
  </div>
`;
document.getElementById('app')?.appendChild(app);

export default app;