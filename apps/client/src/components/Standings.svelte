<script lang="ts">
  import { formatDistanceKm, formatScore } from '$lib/format';
  import { maxScoreForGame } from '$lib/game';
  import type { SoloSessionState } from '$lib/game/types';

  interface Props {
    session: SoloSessionState;
    best: number | null;
    onPlayAgain: () => void;
    onMenu: () => void;
  }
  let { session, best, onPlayAgain, onMenu }: Props = $props();

  const max = $derived(maxScoreForGame(session.settings.rounds));
  const newBest = $derived(best !== null && session.totalScore >= best && session.totalScore > 0);
</script>

<div class="standings">
  <header>
    <h1>Game over</h1>
    <p class="total">
      <strong>{formatScore(session.totalScore)}</strong>
      <span>/ {formatScore(max)}</span>
    </p>
    {#if newBest}<p class="best">🏆 New personal best!</p>{/if}
  </header>

  <ol class="rounds">
    {#each session.outcomes as outcome, i (i)}
      <li>
        <span class="n">{i + 1}</span>
        <span class="place">{session.rounds[i]?.country ?? 'Unknown'}</span>
        <span class="dist"
          >{outcome.skipped ? 'skipped' : formatDistanceKm(outcome.distanceKm)}</span
        >
        <span class="pts">{formatScore(outcome.score)}</span>
      </li>
    {/each}
  </ol>

  <div class="actions">
    <button type="button" class="primary" onclick={onPlayAgain}>Play again</button>
    <button type="button" class="ghost" onclick={onMenu}>Main menu</button>
  </div>
</div>

<style>
  .standings {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 20px;
    max-width: 560px;
    margin: 0 auto;
    width: 100%;
  }
  header {
    text-align: center;
  }
  .total strong {
    font-size: 2.6rem;
    color: var(--accent);
  }
  .total span {
    color: var(--fg-muted);
  }
  .best {
    color: var(--warn);
    font-weight: 700;
  }
  .rounds {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
    overflow-y: auto;
  }
  .rounds li {
    display: grid;
    grid-template-columns: 28px 1fr auto auto;
    gap: 10px;
    align-items: center;
    padding: 12px;
    background: var(--bg-elev);
    border: 1px solid var(--line);
    border-radius: var(--radius);
  }
  .n {
    color: var(--fg-muted);
    text-align: center;
  }
  .dist {
    color: var(--fg-muted);
    font-size: 0.9rem;
  }
  .pts {
    font-weight: 700;
    min-width: 64px;
    text-align: right;
  }
  .actions {
    margin-top: auto;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
</style>
