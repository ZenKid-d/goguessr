<script lang="ts">
  import { onMount } from 'svelte';
  import { GOOGLE_MAPS_API_KEY } from '$lib/config';
  import { loadGoogleMaps } from '$lib/map/google';
  import type { LatLng } from '$lib/game/types';
  import Spinner from './Spinner.svelte';

  interface Props {
    onpick?: (point: LatLng) => void;
  }
  let { onpick }: Props = $props();

  let container: HTMLDivElement;
  let status = $state<'loading' | 'ready' | 'error'>('loading');
  let errorMsg = $state('');

  onMount(() => {
    let disposed = false;
    let map: google.maps.Map | null = null;
    let marker: google.maps.Marker | null = null;
    const onResize = (): void => {
      if (map) google.maps.event.trigger(map, 'resize');
    };

    void (async () => {
      try {
        await loadGoogleMaps(GOOGLE_MAPS_API_KEY);
        if (disposed) return;
        map = new google.maps.Map(container, {
          center: { lat: 20, lng: 0 },
          zoom: 2,
          minZoom: 1,
          // One-finger pan/zoom on touch; no Google "use two fingers" gate.
          gestureHandling: 'greedy',
          disableDefaultUI: true,
          zoomControl: true,
          clickableIcons: false,
          keyboardShortcuts: false,
        });
        // Classic Marker is deprecated but needs no cloud-configured mapId, which
        // keeps setup to a single API key. Fine for a hobby guess pin.
        map.addListener('click', (e: google.maps.MapMouseEvent) => {
          const ll = e.latLng;
          if (!ll) return;
          if (marker) {
            marker.setPosition(ll);
          } else {
            marker = new google.maps.Marker({ position: ll, map });
          }
          onpick?.({ lat: ll.lat(), lng: ll.lng() });
        });
        window.addEventListener('resize', onResize);
        status = 'ready';
      } catch (e) {
        if (disposed) return;
        status = 'error';
        errorMsg = e instanceof Error ? e.message : 'Failed to load Google Maps.';
      }
    })();

    return () => {
      disposed = true;
      window.removeEventListener('resize', onResize);
      if (marker) marker.setMap(null);
      if (map) google.maps.event.clearInstanceListeners(map);
      map = null;
      marker = null;
    };
  });
</script>

<div class="wrap">
  <div
    class="gmap"
    bind:this={container}
    role="application"
    aria-label="Guess map — tap to place your pin"
  ></div>

  {#if status !== 'ready'}
    <div class="overlay" class:error={status === 'error'}>
      {#if status === 'loading'}
        <Spinner label="Loading map…" />
      {:else}
        <p class="msg">{errorMsg}</p>
        <p class="hint">
          Check VITE_GOOGLE_MAPS_API_KEY (billing-enabled), or remove it to use OSM.
        </p>
      {/if}
    </div>
  {/if}
</div>

<style>
  .wrap {
    position: absolute;
    inset: 0;
  }
  .gmap {
    position: absolute;
    inset: 0;
    background: #0b1020;
  }
  .overlay {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 24px;
    text-align: center;
    background: rgba(8, 12, 20, 0.86);
  }
  .overlay.error .msg {
    color: var(--danger);
    font-weight: 600;
    margin: 0;
  }
  .hint {
    color: var(--fg-muted);
    font-size: 0.9rem;
    margin: 0;
  }
</style>
