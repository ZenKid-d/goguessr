import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/vite-plugin-svelte').Options} */
export default {
  preprocess: vitePreprocess(),
  compilerOptions: {
    // Enforce Svelte 5 runes mode project-wide (no legacy reactivity).
    runes: true,
  },
};
