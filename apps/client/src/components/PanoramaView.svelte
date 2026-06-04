<script lang="ts">
  import { onMount } from 'svelte';
  import 'mapillary-js/dist/mapillary.css';
  import type { Viewer } from 'mapillary-js';
  import type { GameMode } from '$lib/net/bindings';
  import { MAPILLARY_TOKEN, hasMapillaryToken } from '$lib/config';
  import { applyMode } from '$lib/mapillary/panorama';
  import Spinner from './Spinner.svelte';

  interface Props {
    imageId: string;
    mode: GameMode;
    onready?: () => void;
    onerror?: (message: string) => void;
  }
  let { imageId, mode, onready, onerror }: Props = $props();

  let container: HTMLDivElement;
  let viewer = $state<Viewer | null>(null);
  let status = $state<'loading' | 'ready' | 'error'>('loading');
  let errorMsg = $state('');
  let lastMoved = '';

  function fail(message: string): void {
    status = 'error';
    errorMsg = message;
    onerror?.(message);
  }

  onMount(() => {
    let disposed = false;
    const onResize = (): void => viewer?.resize();

    void (async () => {
      if (!hasMapillaryToken()) {
        fail('No Mapillary token configured (set VITE_MAPILLARY_ACCESS_TOKEN in .env).');
        return;
      }
      try {
        const { Viewer } = await import('mapillary-js');
        if (disposed) return;
        const instance = new Viewer({
          container,
          accessToken: MAPILLARY_TOKEN,
          component: { cover: false },
        });
        applyMode(instance, mode);
        window.addEventListener('resize', onResize);
        viewer = instance;
      } catch (e) {
        fail(e instanceof Error ? e.message : 'Failed to initialise the panorama viewer.');
      }
    })();

    return () => {
      disposed = true;
      window.removeEventListener('resize', onResize);
      viewer?.remove();
      viewer = null;
    };
  });

  // Load (or switch to) the image whenever it changes and the viewer is ready.
  $effect(() => {
    const id = imageId;
    const v = viewer;
    if (!v || id === lastMoved) return;
    lastMoved = id;
    status = 'loading';
    v.moveTo(id)
      .then(() => {
        status = 'ready';
        onready?.();
      })
      .catch(() => fail('This panorama could not be loaded.'));
  });

  // Re-apply the component layout if the mode changes.
  $effect(() => {
    const m = mode;
    if (viewer) applyMode(viewer, m);
  });
</script>

<div class="pano">
  <div
    class="canvas"
    bind:this={container}
    role="application"
    aria-label="Street-level panorama"
  ></div>

  {#if status !== 'ready'}
    <div class="overlay" class:error={status === 'error'}>
      {#if status === 'loading'}
        <Spinner label="Loading panorama…" />
      {:else}
        <p class="msg">{errorMsg}</p>
        <p class="hint">Try “Skip round” if it keeps failing.</p>
      {/if}
    </div>
  {/if}
</div>

<style>
  .pano {
    position: absolute;
    inset: 0;
    background: #000;
  }
  .canvas {
    position: absolute;
    inset: 0;
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
