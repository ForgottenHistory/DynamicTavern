import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { socketPlugin } from './src/lib/server/vite-plugin-socket';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit(), socketPlugin()]
});
