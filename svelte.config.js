import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/vite-plugin-svelte').SvelteConfig} */
const config = {
	preprocess: vitePreprocess(),
	compilerOptions: {
		customElement: false
	}
};

export default config;
