// Lazy, single-shot loader for the Google Maps JavaScript API. The script is
// injected once (memoised); callers `await loadGoogleMaps(key)` and then use the
// global `google.maps` namespace. Requires a billing-enabled Maps JS API key.

let loaderPromise: Promise<void> | null = null;

declare global {
  interface Window {
    __onGoogleMapsReady?: () => void;
  }
}

/** Load the Google Maps JS API once. Rejects if the script fails to load. */
export function loadGoogleMaps(apiKey: string): Promise<void> {
  if (loaderPromise) return loaderPromise;

  loaderPromise = new Promise<void>((resolve, reject) => {
    const params = new URLSearchParams({
      key: apiKey,
      v: 'weekly',
      loading: 'async',
      callback: '__onGoogleMapsReady',
    });
    window.__onGoogleMapsReady = () => resolve();

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`;
    script.async = true;
    script.onerror = () => {
      loaderPromise = null; // allow a later retry
      reject(new Error('Could not load Google Maps (check the API key and network).'));
    };
    document.head.appendChild(script);
  });

  return loaderPromise;
}
