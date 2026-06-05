// Centralised, typed access to build-time configuration (Vite env).

/** Mapillary client access token (`MLY|...`). Required by the viewer + builder. */
export const MAPILLARY_TOKEN = (import.meta.env.VITE_MAPILLARY_ACCESS_TOKEN ?? '').trim();

/** Default multiplayer server URL; overridable in-app (Settings → Server). */
export const DEFAULT_SERVER_URL = (
  import.meta.env.VITE_DEFAULT_SERVER_URL ?? 'ws://127.0.0.1:8787/ws'
).trim();

/** Optional MapTiler key for labelled vector tiles (else free OSM raster). */
export const MAPTILER_KEY = (import.meta.env.VITE_MAPTILER_KEY ?? '').trim();

/**
 * Optional Google Maps JS API key for the guess map. When set, the guess map
 * uses Google Maps; otherwise it falls back to the free MapLibre/OSM map.
 * NOTE: Google Maps requires a billing-enabled key (not free like MapLibre).
 */
export const GOOGLE_MAPS_API_KEY = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? '').trim();

export function hasMapillaryToken(): boolean {
  return MAPILLARY_TOKEN.length > 0;
}

export function hasGoogleMapsKey(): boolean {
  return GOOGLE_MAPS_API_KEY.length > 0;
}
