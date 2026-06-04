<script lang="ts">
  import { lastOutcome, roundNumber } from '$lib/game';
  import type { LatLng } from '$lib/game/types';
  import { getStorage } from '$lib/storage';
  import { router } from '$lib/stores/router.svelte';
  import { solo } from '$lib/stores/solo.svelte';
  import GameHud from '../components/GameHud.svelte';
  import GuessMap from '../components/GuessMap.svelte';
  import PanoramaView from '../components/PanoramaView.svelte';
  import RoundResult from '../components/RoundResult.svelte';
  import Spinner from '../components/Spinner.svelte';
  import Standings from '../components/Standings.svelte';

  let view = $state<'pano' | 'map'>('pano');
  let mapOpened = $state(false);
  let picked = $state<LatLng | null>(null);
  let panoError = $state<string | null>(null);
  let retryKey = $state(0);
  let remaining = $state<number | null>(null);
  let best = $state<number | null>(null);

  const session = $derived(solo.session);
  const spec = $derived(
    session && session.phase !== 'finished' ? session.rounds[session.currentRound] : null,
  );
  const isLastRound = $derived(
    session ? session.currentRound + 1 >= session.settings.rounds : false,
  );

  // Reset per-round UI whenever the active round index changes.
  let trackedRound = -1;
  $effect(() => {
    if (!session) return;
    if (session.currentRound !== trackedRound) {
      trackedRound = session.currentRound;
      view = 'pano';
      mapOpened = false;
      picked = null;
      panoError = null;
    }
  });

  // Optional per-round countdown.
  $effect(() => {
    if (!session || session.phase !== 'guessing') {
      remaining = null;
      return;
    }
    const limit = session.settings.time_limit_secs;
    if (limit <= 0) {
      remaining = null;
      return;
    }
    const startedAt = Date.now();
    remaining = limit;
    const id = setInterval(() => {
      const left = limit - Math.floor((Date.now() - startedAt) / 1000);
      remaining = Math.max(0, left);
      if (left <= 0) {
        clearInterval(id);
        if (picked) solo.guess(picked);
        else solo.skip();
      }
    }, 250);
    return () => clearInterval(id);
  });

  // Load the personal best once the game ends (for the "new best" badge).
  $effect(() => {
    if (session?.phase === 'finished') {
      void getStorage()
        .bestScore()
        .then((b) => (best = b));
    }
  });

  function openMap(): void {
    mapOpened = true;
    view = 'map';
  }
  function confirmGuess(): void {
    if (picked) solo.guess(picked);
  }
  function retry(): void {
    panoError = null;
    retryKey += 1;
  }
  function playAgain(): void {
    if (!session) return;
    const current = session.settings;
    void solo.start(current).then((ok) => {
      if (!ok) router.go('menu');
    });
  }
  function toMenu(): void {
    solo.clear();
    router.go('menu');
  }
</script>

{#if !session}
  <div class="center"><Spinner label="Preparing…" /></div>
{:else if session.phase === 'finished'}
  <Standings {session} {best} onPlayAgain={playAgain} onMenu={toMenu} />
{:else}
  <div class="game">
    <GameHud
      round={roundNumber(session)}
      rounds={session.settings.rounds}
      score={session.totalScore}
      seconds={remaining}
    />

    {#if session.phase === 'guessing'}
      <!-- Panorama layer (kept mounted; hidden under the map when guessing) -->
      <div class="layer">
        {#if spec}
          {#key retryKey}
            <PanoramaView
              imageId={spec.imageId}
              mode={session.settings.mode}
              onready={() => (panoError = null)}
              onerror={(m) => (panoError = m)}
            />
          {/key}
        {/if}
        {#if view === 'pano'}
          <div class="dock">
            {#if panoError}
              <div class="row">
                <button type="button" onclick={retry}>Retry</button>
                <button type="button" class="ghost" onclick={() => solo.skip()}>Skip round</button>
              </div>
            {:else}
              <button type="button" class="primary big" onclick={openMap}>Make a guess</button>
            {/if}
          </div>
        {/if}
      </div>

      <!-- Guess map layer (mounted once opened, shown on top when active) -->
      {#if mapOpened}
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
    {:else if session.phase === 'result'}
      {@const outcome = lastOutcome(session)}
      {#if outcome}
        <div class="layer">
          <RoundResult {outcome} />
        </div>
      {/if}
      <div class="dock">
        <button type="button" class="primary big" onclick={() => solo.advance()}>
          {isLastRound ? 'See results' : 'Next round'}
        </button>
      </div>
    {/if}
  </div>
{/if}

<style>
  .center {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
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
  .dock {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    padding: 14px 16px calc(14px + env(safe-area-inset-bottom));
    z-index: 4;
    background: linear-gradient(to top, rgba(8, 12, 20, 0.92), rgba(8, 12, 20, 0));
  }
  .dock .row,
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
</style>
