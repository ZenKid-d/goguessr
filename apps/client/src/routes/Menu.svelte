<script lang="ts">
  import { onMount } from 'svelte';
  import { hasMapillaryToken } from '$lib/config';
  import { formatScore } from '$lib/format';
  import { getStorage } from '$lib/storage';
  import { router } from '$lib/stores/router.svelte';
  import { settings } from '$lib/stores/settings.svelte';
  import { solo } from '$lib/stores/solo.svelte';
  import Banner from '../components/Banner.svelte';

  let best = $state<number | null>(null);

  onMount(async () => {
    best = await getStorage().bestScore();
  });

  async function playSolo(): Promise<void> {
    const ok = await solo.start(settings.value);
    if (ok) router.go('solo');
  }

  const modeLabel: Record<string, string> = { Move: 'Move', NoMove: 'No Move', NMPZ: 'NMPZ' };
</script>

<div class="menu">
  <header>
    <h1>GeoGuess</h1>
    <p class="tagline">Guess where in the world you are.</p>
  </header>

  {#if !hasMapillaryToken()}
    <Banner kind="warn">
      No Mapillary token set — panoramas won't load. Add <code>VITE_MAPILLARY_ACCESS_TOKEN</code> to
      <code>.env</code> (see the README).
    </Banner>
  {/if}

  {#if solo.error}
    <Banner kind="error">{solo.error}</Banner>
  {/if}

  <div class="card">
    <div class="row">
      <span class="muted">Mode</span><span>{modeLabel[settings.value.mode]}</span>
    </div>
    <div class="row"><span class="muted">Rounds</span><span>{settings.value.rounds}</span></div>
    <div class="row">
      <span class="muted">Region</span><span>{settings.value.region_filter ?? 'Anywhere'}</span>
    </div>
    {#if best !== null}
      <div class="row"><span class="muted">Best</span><span>{formatScore(best)} pts</span></div>
    {/if}
  </div>

  <div class="actions">
    <button type="button" class="primary big" onclick={playSolo} disabled={solo.loading}>
      {solo.loading ? 'Loading…' : 'Play solo'}
    </button>
    <button type="button" onclick={() => router.go('lobby')}>Multiplayer</button>
    <button type="button" onclick={() => router.go('settings')}>Settings</button>
  </div>

  <footer>Imagery © Mapillary contributors · Map © OpenStreetMap contributors</footer>
</div>

<style>
  .menu {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 24px 20px;
    max-width: 480px;
    margin: 0 auto;
    width: 100%;
  }
  header {
    text-align: center;
    margin-top: 8vh;
  }
  h1 {
    font-size: 2.6rem;
    letter-spacing: -0.02em;
  }
  .tagline {
    color: var(--fg-muted);
    margin: 0;
  }
  .card {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 14px 16px;
    background: var(--bg-elev);
    border: 1px solid var(--line);
    border-radius: var(--radius);
  }
  .row {
    display: flex;
    justify-content: space-between;
  }
  .muted {
    color: var(--fg-muted);
  }
  .actions {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .big {
    min-height: 56px;
    font-size: 1.1rem;
  }
  code {
    background: var(--bg-elev-2);
    padding: 1px 5px;
    border-radius: 5px;
    font-size: 0.85em;
  }
  footer {
    margin-top: auto;
    text-align: center;
    color: var(--fg-muted);
    font-size: 0.78rem;
  }
</style>
