/// <reference types="svelte" />
/// <reference types="vite/client" />

// Side-effect CSS imports from packages (mapillary-js, maplibre-gl, app.css).
declare module '*.css';

interface ImportMetaEnv {
  readonly VITE_MAPILLARY_ACCESS_TOKEN?: string;
  readonly VITE_DEFAULT_SERVER_URL?: string;
  readonly VITE_MAPTILER_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
