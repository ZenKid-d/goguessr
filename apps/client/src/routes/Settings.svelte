<script lang="ts">
  import { onMount } from 'svelte';
  import { countriesIn, loadPool } from '$lib/pool';
  import { router } from '$lib/stores/router.svelte';
  import { settings } from '$lib/stores/settings.svelte';
  import type { GameMode } from '$lib/net/bindings';
  import ModeSelector from '../components/ModeSelector.svelte';

  let countries = $state<string[]>([]);

  onMount(async () => {
    try {
      countries = countriesIn(await loadPool());
    } catch {
      countries = [];
    }
  });

  const difficulties = [
    { label: 'Strict', scale: 1000 },
    { label: 'Normal', scale: 2000 },
    { label: 'Relaxed', scale: 4000 },
  ];
  const timeLimits = [0, 30, 60, 120];

  function setRounds(delta: number): void {
    const next = Math.min(10, Math.max(1, settings.value.rounds + delta));
    settings.patch({ rounds: next });
  }
  function setMode(mode: GameMode): void {
    settings.patch({ mode });
  }
  function setScale(scale_km: number): void {
    settings.patch({ scale_km });
  }
  function setTime(event: Event): void {
    settings.patch({ time_limit_secs: Number((event.target as HTMLSelectElement).value) });
  }
  function setRegion(event: Event): void {
    const v = (event.target as HTMLSelectElement).value;
    settings.patch({ region_filter: v === '' ? null : v });
  }
</script>

<div class="settings">
  <header>
    <button type="button" class="ghost back" onclick={() => router.go('menu')} aria-label="Back">
      ←
    </button>
    <h1>Settings</h1>
  </header>

  <section>
    <h2 id="rounds-label">Rounds</h2>
    <div class="stepper" role="group" aria-labelledby="rounds-label">
      <button type="button" onclick={() => setRounds(-1)} aria-label="Fewer rounds">−</button>
      <span class="value">{settings.value.rounds}</span>
      <button type="button" onclick={() => setRounds(1)} aria-label="More rounds">+</button>
    </div>
  </section>

  <section>
    <h2>Movement</h2>
    <ModeSelector value={settings.value.mode} onchange={setMode} />
  </section>

  <section>
    <h2 id="diff-label">Difficulty</h2>
    <div class="seg" role="radiogroup" aria-labelledby="diff-label">
      {#each difficulties as d (d.scale)}
        <button
          type="button"
          role="radio"
          aria-checked={settings.value.scale_km === d.scale}
          class:active={settings.value.scale_km === d.scale}
          onclick={() => setScale(d.scale)}
        >
          {d.label}
        </button>
      {/each}
    </div>
  </section>

  <section class="field">
    <label for="time">Time limit per round</label>
    <select id="time" value={settings.value.time_limit_secs} onchange={setTime}>
      {#each timeLimits as t (t)}
        <option value={t}>{t === 0 ? 'No limit' : `${t}s`}</option>
      {/each}
    </select>
  </section>

  <section class="field">
    <label for="region">Region</label>
    <select id="region" value={settings.value.region_filter ?? ''} onchange={setRegion}>
      <option value="">Anywhere</option>
      {#each countries as c (c)}
        <option value={c}>{c}</option>
      {/each}
    </select>
  </section>

  <button type="button" class="primary done" onclick={() => router.go('menu')}>Done</button>
</div>

<style>
  .settings {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 18px;
    padding: 16px 20px 24px;
    max-width: 480px;
    margin: 0 auto;
    width: 100%;
  }
  header {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .back {
    min-width: var(--tap);
    padding: 0;
    font-size: 1.3rem;
  }
  h2 {
    font-size: 0.95rem;
    color: var(--fg-muted);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .stepper {
    display: flex;
    align-items: center;
    gap: 16px;
  }
  .stepper button {
    min-width: var(--tap);
    font-size: 1.4rem;
  }
  .value {
    font-size: 1.5rem;
    font-weight: 700;
    min-width: 2ch;
    text-align: center;
  }
  .seg {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
  }
  .seg button.active {
    background: var(--accent);
    color: var(--accent-fg);
    border-color: transparent;
  }
  .field {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .field select {
    width: 100%;
  }
  .done {
    margin-top: auto;
    min-height: 52px;
  }
</style>
