<script lang="ts">
  import { formatScore, formatSeconds } from '$lib/format';

  interface Props {
    round: number;
    rounds: number;
    score: number;
    seconds?: number | null;
  }
  let { round, rounds, score, seconds = null }: Props = $props();
</script>

<div class="hud">
  <div class="chip">Round <strong>{round}</strong> / {rounds}</div>
  {#if seconds !== null}
    <div class="chip timer" class:low={seconds <= 10} aria-live="polite">
      {formatSeconds(seconds)}
    </div>
  {/if}
  <div class="chip score">{formatScore(score)} pts</div>
</div>

<style>
  .hud {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    display: flex;
    gap: 8px;
    align-items: center;
    justify-content: space-between;
    padding: 10px 12px;
    pointer-events: none;
    z-index: 5;
  }
  .chip {
    background: rgba(15, 20, 32, 0.82);
    border: 1px solid var(--line);
    border-radius: 999px;
    padding: 7px 12px;
    font-size: 0.9rem;
    backdrop-filter: blur(4px);
  }
  .score {
    margin-left: auto;
  }
  .timer.low {
    color: var(--danger);
    border-color: var(--danger);
    font-variant-numeric: tabular-nums;
  }
</style>
