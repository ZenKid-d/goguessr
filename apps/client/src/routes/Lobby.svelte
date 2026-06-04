<script lang="ts">
  import { onMount } from 'svelte';
  import { countriesIn, loadPool } from '$lib/pool';
  import type { GameMode, GameSettings } from '$lib/net/bindings';
  import { router } from '$lib/stores/router.svelte';
  import { settings } from '$lib/stores/settings.svelte';
  import { multiplayer as mp } from '$lib/stores/multiplayer.svelte';
  import Banner from '../components/Banner.svelte';
  import ModeSelector from '../components/ModeSelector.svelte';
  import PlayerList from '../components/PlayerList.svelte';
  import Spinner from '../components/Spinner.svelte';

  let joinCode = $state('');
  let countries = $state<string[]>([]);
  let copied = $state(false);

  const difficulties = [
    { label: 'Strict', scale: 1000 },
    { label: 'Normal', scale: 2000 },
    { label: 'Relaxed', scale: 4000 },
  ];
  const timeLimits = [0, 30, 60, 120];

  onMount(async () => {
    try {
      countries = countriesIn(await loadPool());
    } catch {
      countries = [];
    }
  });

  function createRoom(): void {
    mp.create({ ...settings.value });
  }
  function joinRoom(): void {
    mp.join(joinCode);
  }
  function leave(): void {
    mp.leave();
    router.go('menu');
  }

  // Host-only settings edits go through the server and come back as RoomState.
  function patch(p: Partial<GameSettings>): void {
    if (!mp.settings) return;
    mp.updateSettings({ ...mp.settings, ...p });
  }
  function setRounds(delta: number): void {
    if (!mp.settings) return;
    patch({ rounds: Math.min(10, Math.max(1, mp.settings.rounds + delta)) });
  }
  function setMode(mode: GameMode): void {
    patch({ mode });
  }

  async function copyCode(): Promise<void> {
    if (!mp.code) return;
    try {
      await navigator.clipboard.writeText(mp.code);
      copied = true;
      setTimeout(() => (copied = false), 1500);
    } catch {
      copied = false;
    }
  }

  const modeLabel: Record<GameMode, string> = { Move: 'Move', NoMove: 'No Move', NMPZ: 'NMPZ' };
</script>

{#if mp.status === 'connecting'}
  <div class="center"><Spinner label="Connecting…" /></div>
{:else if mp.status === 'connected' && mp.phase === 'Lobby' && mp.settings}
  {@const s = mp.settings}
  <div class="lobby">
    <header>
      <button type="button" class="ghost back" onclick={leave} aria-label="Leave room">←</button>
      <h1>Lobby</h1>
    </header>

    <button type="button" class="code" onclick={copyCode} title="Tap to copy">
      <span class="code-label">Room code</span>
      <span class="code-value">{mp.code}</span>
      <span class="code-hint">{copied ? 'Copied!' : 'Tap to copy & share'}</span>
    </button>

    {#if mp.error}
      <Banner kind="error">{mp.error}</Banner>
    {/if}

    <section>
      <h2>Players ({mp.players.length})</h2>
      <PlayerList players={mp.players} myId={mp.myId} />
    </section>

    <section>
      <h2>Settings</h2>
      {#if mp.isHost}
        <div class="stepper" role="group" aria-label="Rounds">
          <span class="lbl">Rounds</span>
          <button type="button" onclick={() => setRounds(-1)} aria-label="Fewer rounds">−</button>
          <span class="value">{s.rounds}</span>
          <button type="button" onclick={() => setRounds(1)} aria-label="More rounds">+</button>
        </div>

        <ModeSelector value={s.mode} onchange={setMode} />

        <div class="seg" role="radiogroup" aria-label="Difficulty">
          {#each difficulties as d (d.scale)}
            <button
              type="button"
              role="radio"
              aria-checked={s.scale_km === d.scale}
              class:active={s.scale_km === d.scale}
              onclick={() => patch({ scale_km: d.scale })}
            >
              {d.label}
            </button>
          {/each}
        </div>

        <div class="field">
          <label for="mp-time">Time limit per round</label>
          <select
            id="mp-time"
            value={s.time_limit_secs}
            onchange={(e) => patch({ time_limit_secs: Number(e.currentTarget.value) })}
          >
            {#each timeLimits as t (t)}
              <option value={t}>{t === 0 ? 'No limit' : `${t}s`}</option>
            {/each}
          </select>
        </div>

        <div class="field">
          <label for="mp-region">Region</label>
          <select
            id="mp-region"
            value={s.region_filter ?? ''}
            onchange={(e) => patch({ region_filter: e.currentTarget.value || null })}
          >
            <option value="">Anywhere</option>
            {#each countries as c (c)}
              <option value={c}>{c}</option>
            {/each}
          </select>
        </div>
      {:else}
        <div class="summary card">
          <div class="row"><span class="muted">Mode</span><span>{modeLabel[s.mode]}</span></div>
          <div class="row"><span class="muted">Rounds</span><span>{s.rounds}</span></div>
          <div class="row">
            <span class="muted">Time limit</span>
            <span>{s.time_limit_secs === 0 ? 'No limit' : `${s.time_limit_secs}s`}</span>
          </div>
          <div class="row">
            <span class="muted">Region</span><span>{s.region_filter ?? 'Anywhere'}</span>
          </div>
        </div>
      {/if}
    </section>

    <div class="actions">
      {#if mp.isHost}
        <button type="button" class="primary big" onclick={() => mp.start()}>Start game</button>
      {:else}
        <p class="hint">Waiting for the host to start…</p>
      {/if}
    </div>
  </div>
{:else}
  <!-- Entry: create or join -->
  <div class="entry">
    <header>
      <button type="button" class="ghost back" onclick={() => router.go('menu')} aria-label="Back"
        >←</button
      >
      <h1>Multiplayer</h1>
    </header>

    {#if mp.error}
      <Banner kind="error">{mp.error}</Banner>
    {/if}
    {#if mp.status === 'disconnected'}
      <Banner kind="warn">Disconnected from the server.</Banner>
    {/if}

    <div class="field">
      <label for="mp-name">Your name</label>
      <input
        id="mp-name"
        type="text"
        maxlength="20"
        placeholder="e.g. Alex"
        value={mp.name}
        oninput={(e) => mp.setName(e.currentTarget.value)}
      />
    </div>

    <button type="button" class="primary big" onclick={createRoom}>Create a room</button>

    <div class="divider"><span>or join one</span></div>

    <div class="field">
      <label for="mp-code">Room code</label>
      <input
        id="mp-code"
        type="text"
        autocapitalize="characters"
        maxlength="8"
        placeholder="ABC123"
        bind:value={joinCode}
        oninput={(e) => (joinCode = e.currentTarget.value.toUpperCase())}
      />
    </div>
    <button type="button" class="big" disabled={!joinCode.trim()} onclick={joinRoom}>
      Join room
    </button>

    <p class="server">Server: <code>{mp.serverUrl}</code> · change in Settings</p>
  </div>
{/if}

<style>
  .center {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .lobby,
  .entry {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 16px 20px 24px;
    max-width: 480px;
    margin: 0 auto;
    width: 100%;
    overflow-y: auto;
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
    margin-bottom: 8px;
  }
  .code {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    padding: 16px;
    background: var(--bg-elev);
    border: 1px solid var(--line);
    border-radius: var(--radius);
  }
  .code-label {
    font-size: 0.78rem;
    color: var(--fg-muted);
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }
  .code-value {
    font-size: 2.4rem;
    font-weight: 800;
    letter-spacing: 0.18em;
    font-variant-numeric: tabular-nums;
  }
  .code-hint {
    font-size: 0.8rem;
    color: var(--accent);
  }
  section {
    display: flex;
    flex-direction: column;
  }
  .stepper {
    display: flex;
    align-items: center;
    gap: 14px;
    margin-bottom: 10px;
  }
  .stepper .lbl {
    color: var(--fg-muted);
    margin-right: auto;
  }
  .stepper button {
    min-width: var(--tap);
    font-size: 1.3rem;
  }
  .value {
    font-size: 1.3rem;
    font-weight: 700;
    min-width: 2ch;
    text-align: center;
  }
  .seg {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
    margin: 10px 0;
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
    margin-top: 10px;
  }
  .field input,
  .field select {
    width: 100%;
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
    margin-top: auto;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .big {
    min-height: 54px;
    font-size: 1.05rem;
  }
  .hint {
    text-align: center;
    color: var(--fg-muted);
    margin: 0;
  }
  .divider {
    display: flex;
    align-items: center;
    text-align: center;
    color: var(--fg-muted);
    font-size: 0.85rem;
    gap: 10px;
  }
  .divider::before,
  .divider::after {
    content: '';
    flex: 1;
    height: 1px;
    background: var(--line);
  }
  .server {
    text-align: center;
    color: var(--fg-muted);
    font-size: 0.78rem;
    margin-top: auto;
  }
  code {
    background: var(--bg-elev-2);
    padding: 1px 5px;
    border-radius: 5px;
    font-size: 0.85em;
  }
</style>
