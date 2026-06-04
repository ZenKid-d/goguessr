<script lang="ts">
  import { onMount } from 'svelte';
  import { router } from '$lib/stores/router.svelte';
  import { settings } from '$lib/stores/settings.svelte';
  import { multiplayer as mp } from '$lib/stores/multiplayer.svelte';
  import Menu from './routes/Menu.svelte';
  import Settings from './routes/Settings.svelte';
  import SoloGame from './routes/SoloGame.svelte';
  import Lobby from './routes/Lobby.svelte';
  import MultiGame from './routes/MultiGame.svelte';

  onMount(() => {
    void settings.load();
  });

  // Keep the multiplayer screen in sync with the authoritative room phase:
  // lobby → game when the host starts; game → lobby when we return/leave.
  $effect(() => {
    const ph = mp.phase;
    if (router.current === 'lobby' && (ph === 'Playing' || ph === 'Finished')) {
      router.go('multi');
    } else if (router.current === 'multi' && ph !== 'Playing' && ph !== 'Finished') {
      router.go('lobby');
    }
  });
</script>

{#if router.current === 'menu'}
  <Menu />
{:else if router.current === 'settings'}
  <Settings />
{:else if router.current === 'solo'}
  <SoloGame />
{:else if router.current === 'lobby'}
  <Lobby />
{:else if router.current === 'multi'}
  <MultiGame />
{/if}
