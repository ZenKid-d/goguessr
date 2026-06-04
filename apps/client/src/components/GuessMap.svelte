<script lang="ts">
  import { onMount } from 'svelte';
  import 'maplibre-gl/dist/maplibre-gl.css';
  import { Map as MaplibreMap, Marker } from 'maplibre-gl';
  import { guessMapStyle } from '$lib/map/style';
  import type { LatLng } from '$lib/game/types';

  interface Props {
    onpick?: (point: LatLng) => void;
  }
  let { onpick }: Props = $props();

  let container: HTMLDivElement;

  onMount(() => {
    const map = new MaplibreMap({
      container,
      style: guessMapStyle(),
      center: [0, 20],
      zoom: 1.3,
      attributionControl: { compact: true },
      dragRotate: false,
      pitchWithRotate: false,
    });
    map.touchZoomRotate.disableRotation();

    let marker: Marker | null = null;
    map.on('click', (e) => {
      if (marker) {
        marker.setLngLat(e.lngLat);
      } else {
        marker = new Marker({ color: '#4ade80' }).setLngLat(e.lngLat).addTo(map);
      }
      onpick?.({ lat: e.lngLat.lat, lng: e.lngLat.lng });
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

<div
  class="guessmap"
  bind:this={container}
  role="application"
  aria-label="Guess map — tap to place your pin"
></div>

<style>
  .guessmap {
    position: absolute;
    inset: 0;
  }
  :global(.maplibregl-ctrl-attrib) {
    font-size: 10px;
  }
</style>
