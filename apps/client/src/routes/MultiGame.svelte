<script lang="ts">
  import type { LatLng } from '$lib/game/types';
  import { router } from '$lib/stores/router.svelte';
  import { settings } from '$lib/stores/settings.svelte';
  import { multiplayer as mp } from '$lib/stores/multiplayer.svelte';
  import Banner from '../components/Banner.svelte';
  import GameHud from '../components/GameHud.svelte';
  import GuessMap from '../components/GuessMap.svelte';
  import MultiRoundResult from '../components/MultiRoundResult.svelte';
  import MultiStandings from '../components/MultiStandings.svelte';
  import PanoramaView from '../components/PanoramaView.svelte';
  import PlayerList from '../components/PlayerList.svelte';
  import Spinner from '../components/Spinner.svelte';

  let view = $state<'pano' | 'map'>('pano');
  let mapOpened = $state(false);
  let picked = $state<LatLng | null>(null);
  let panoError = $state<string | null>(null);
  let retryKey = $state(0);
  let remaining = $state<number | null>(null);

  const totalRounds = $derived(mp.settings?.rounds ?? mp.round);
  const isLastRound = $derived(mp.round >= totalRounds);
  const connectedCount = $derived(mp.players.filter((p) => p.connected).length);

  // Reset per-round UI when the active round changes.
  let trackedRound = -1;
  $effect(() => {
    if (mp.round !== trackedRound) {
      trackedRound = mp.round;
      view = 'pano';
      mapOpened = false;
      picked = null;
      panoError = null;
    }
  });

  // Countdown from the server-provided deadline; auto-submit a placed pin at 0.
  $effect(() => {
    const dl = mp.deadline;
    if (mp.roundPhase !== 'guessing' || dl === null) {
      remaining = null;
      return;
    }
    const tick = (): void => {
      const left = Math.max(0, Math.ceil((dl - Date.now()) / 1000));
      remaining = left;
      if (left <= 0) {
        clearInterval(id);
        if (picked) mp.submit(picked);
      }
    };
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  });

  function openMap(): void {
    mapOpened = true;
    view = 'map';
  }
  function confirmGuess(): void {
    if (picked) mp.submit(picked);
  }
  function retry(): void {
    panoError = null;
    retryKey += 1;
  }
  function toMenu(): void {
    mp.leave();
    router.go('menu');
  }
  function newRoom(): void {
    const s = mp.settings ? { ...mp.settings } : { ...settings.value };
    mp.leave();
    mp.create(s);
  }
</script>

{#if mp.status === 'disconnected'}
  <div class="center pad">
    <Banner kind="error">Connection to the server was lost — you're out of this game.</Banner>
    <button type="button" class="primary big" onclick={toMenu}>Back to menu</button>
  </div>
{:else if mp.phase === 'Finished' && mp.standings}
  <MultiStandings
    standings={mp.standings}
    myId={mp.myId}
    isHost={mp.isHost}
    onNewRoom={newRoom}
    onMenu={toMenu}
  />
{:else if mp.phase === 'Playing'}
  <div class="game">
    <GameHud round={mp.round} rounds={totalRounds} score={mp.myTotal} seconds={remaining} />

    {#if mp.roundPhase === 'guessing' || mp.roundPhase === 'waiting'}
      <!-- Panorama layer stays mounted across guessing → waiting. -->
      <div class="layer">
        {#if mp.imageId}
          {#key retryKey}
            <PanoramaView
              imageId={mp.imageId}
              mode={mp.settings?.mode ?? 'Move'}
              onready={() => (panoError = null)}
              onerror={(m) => (panoError = m)}
            />
          {/key}
        {/if}

        {#if mp.roundPhase === 'guessing' && view === 'pano'}
          <div class="dock">
            {#if panoError}
              <div class="row">
                <button type="button" onclick={retry}>Retry</button>
                <button type="button" class="primary" onclick={openMap}>Guess anyway</button>
              </div>
            {:else}
              <button type="button" class="primary big" onclick={openMap}>Make a guess</button>
            {/if}
          </div>
        {/if}
      </div>

      {#if mp.roundPhase === 'guessing' && mapOpened}
        <div class="layer map" class:shown={view === 'map'}>
          <GuessMap onpick={(p) => (picked = p)} />
          <div class="dock row">
            <button type="button" class="ghost" onclick={() => (view = 'pano')}>Look again</button>
            <button type="button" class="primary big" disabled={!picked} onclick={confirmGuess}>
              {picked ? 'Confirm guess' : 'Tap the map'}
            </button>
          </div>
        </div>
      {/if}

      {#if mp.roundPhase === 'waiting'}
        <div class="layer waiting">
          <div class="waiting-card">
            <h2>Guess locked in</h2>
            <p class="count">
              {mp.guessed.length} / {connectedCount} answered
            </p>
            <PlayerList players={mp.players} myId={mp.myId} guessedIds={mp.guessed} />
            <p class="hint">Waiting for everyone to guess…</p>
          </div>
        </div>
      {/if}
    {:else if mp.roundPhase === 'result' && mp.lastResult}
      <div class="layer">
        <MultiRoundResult result={mp.lastResult} players={mp.players} myId={mp.myId} />
      </div>
      <div class="dock">
        <p class="next">{isLastRound ? 'Final results coming up…' : 'Next round starting…'}</p>
      </div>
    {/if}
  </div>
{:else}
  <div class="center"><Spinner label="Connecting…" /></div>
{/if}

<style>
  .center {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
  }
  .pad {
    padding: 24px;
  }
  .game {
    flex: 1;
    position: relative;
    overflow: hidden;
  }
  .layer {
    position: absolute;
    inset: 0;
  }
  .layer.map {
    display: none;
    z-index: 3;
  }
  .layer.map.shown {
    display: block;
  }
  .layer.waiting {
    z-index: 4;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
    background: rgba(8, 12, 20, 0.92);
    overflow-y: auto;
  }
  .waiting-card {
    width: 100%;
    max-width: 420px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    text-align: center;
  }
  .waiting-card .count {
    font-size: 1.4rem;
    font-weight: 700;
    margin: 0;
  }
  .dock {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    padding: 14px 16px calc(14px + env(safe-area-inset-bottom));
    z-index: 5;
    background: linear-gradient(to top, rgba(8, 12, 20, 0.92), rgba(8, 12, 20, 0));
  }
  .row {
    display: flex;
    gap: 10px;
  }
  .row > .primary {
    flex: 1;
  }
  .big {
    width: 100%;
    min-height: 54px;
    font-size: 1.05rem;
  }
  .row .big {
    width: auto;
  }
  .hint {
    color: var(--fg-muted);
    margin: 0;
  }
  .next {
    text-align: center;
    color: var(--fg-muted);
    margin: 0;
    font-weight: 600;
  }
</style>
