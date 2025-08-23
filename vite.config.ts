import tailwindcss from '@tailwindcss/vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vite';
import webExtension from 'vite-plugin-web-extension';

export default defineConfig({
	plugins: [
		tailwindcss(),
		svelte(),
		webExtension({
			manifest: './public/manifest.json',
			watchFilePaths: ['src/**/*', 'public/**/*'],
			additionalInputs: ['src/popup/index.html', 'src/options/index.html']
		})
	],
	build: {
		minify: 'esbuild',
		target: 'chrome88',
		outDir: 'dist',
		sourcemap: true
	},
	test: {
		globals: true,
		environment: 'happy-dom',
		setupFiles: ['./vitest-setup.ts'],
		include: ['src/**/*.{test,spec}.{js,ts}', 'tests/**/*.{test,spec}.{js,ts}'],
		coverage: {
			provider: 'v8',
			reporter: ['text', 'json', 'html'],
			exclude: [
				'node_modules/',
				'dist/',
				'**/*.test.{js,ts}',
				'vite.config.ts'
			]
		}
	}
});
