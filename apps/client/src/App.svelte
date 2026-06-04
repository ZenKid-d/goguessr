<script lang="ts">
  import { onMount } from 'svelte';
  import { router } from '$lib/stores/router.svelte';
  import { settings } from '$lib/stores/settings.svelte';
  import Menu from './routes/Menu.svelte';
  import Settings from './routes/Settings.svelte';
  import SoloGame from './routes/SoloGame.svelte';

  onMount(() => {
    void settings.load();
  });
</script>

{#if router.current === 'menu'}
  <Menu />
{:else if router.current === 'settings'}
  <Settings />
{:else if router.current === 'solo'}
  <SoloGame />
{/if}
