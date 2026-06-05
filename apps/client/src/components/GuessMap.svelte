<script lang="ts">
  // Guess-map selector: Google Maps when a key is configured
  // (VITE_GOOGLE_MAPS_API_KEY), otherwise the free MapLibre/OSM map. Both expose
  // the same `onpick(LatLng)` contract, so callers don't care which renders.
  import { hasGoogleMapsKey } from '$lib/config';
  import type { LatLng } from '$lib/game/types';
  import GuessMapGoogle from './GuessMapGoogle.svelte';
  import GuessMapLibre from './GuessMapLibre.svelte';

  interface Props {
    onpick?: (point: LatLng) => void;
  }
  let { onpick }: Props = $props();
</script>

{#if hasGoogleMapsKey()}
  <GuessMapGoogle {onpick} />
{:else}
  <GuessMapLibre {onpick} />
{/if}
