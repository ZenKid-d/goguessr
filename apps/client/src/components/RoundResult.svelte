<script lang="ts">
  import { onMount } from 'svelte';
  import 'maplibre-gl/dist/maplibre-gl.css';
  import { LngLatBounds, Map as MaplibreMap, Marker } from 'maplibre-gl';
  import { guessMapStyle } from '$lib/map/style';
  import { formatDistanceKm, formatScore } from '$lib/format';
  import type { RoundOutcome } from '$lib/game/types';

  interface Props {
    outcome: RoundOutcome;
  }
  let { outcome }: Props = $props();

  let container: HTMLDivElement;

  onMount(() => {
    const map = new MaplibreMap({
      container,
      style: guessMapStyle(),
      attributionControl: { compact: true },
      interactive: true,
      dragRotate: false,
    });

    map.on('load', () => {
      const { guess, truth, skipped } = outcome;
      new Marker({ color: '#f87171' }).setLngLat([truth.lng, truth.lat]).addTo(map);

      if (skipped) {
        map.jumpTo({ center: [truth.lng, truth.lat], zoom: 3 });
        return;
      }

      new Marker({ color: '#4ade80' }).setLngLat([guess.lng, guess.lat]).addTo(map);
      const line: GeoJSON.Feature<GeoJSON.LineString> = {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates: [
            [guess.lng, guess.lat],
            [truth.lng, truth.lat],
          ],
        },
      };
      map.addSource('guess-line', { type: 'geojson', data: line });
      map.addLayer({
        id: 'guess-line',
        type: 'line',
        source: 'guess-line',
        paint: { 'line-color': '#eef2f8', 'line-width': 2, 'line-dasharray': [2, 2] },
      });

      const bounds = new LngLatBounds();
      bounds.extend([guess.lng, guess.lat]);
      bounds.extend([truth.lng, truth.lat]);
      map.fitBounds(bounds, { padding: 64, maxZoom: 6, duration: 0 });
    });

    const onResize = (): void => {
      map.resize();
    };
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      map.remove();
    };
  });
</script>

<div class="round-result">
  <div class="map" bind:this={container}></div>
  <div class="readout">
    {#if outcome.skipped}
      <p class="label">Round skipped</p>
      <p class="score">0 pts</p>
    {:else}
      <p class="label">{formatDistanceKm(outcome.distanceKm)} away</p>
      <p class="score">+{formatScore(outcome.score)} pts</p>
    {/if}
  </div>
</div>

<style>
  .round-result {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
  }
  .map {
    flex: 1;
    position: relative;
  }
  .readout {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 12px;
    padding: 14px 16px;
    background: var(--bg-elev);
    border-top: 1px solid var(--line);
  }
  .label {
    margin: 0;
    color: var(--fg-muted);
  }
  .score {
    margin: 0;
    font-size: 1.4rem;
    font-weight: 800;
    color: var(--accent);
  }
</style>
