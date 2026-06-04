<script lang="ts">
  import { formatScore } from '$lib/format';
  import type { Standing } from '$lib/net/bindings';

  interface Props {
    standings: Standing[];
    myId: string | null;
    isHost: boolean;
    onNewRoom: () => void;
    onMenu: () => void;
  }
  let { standings, myId, isHost, onNewRoom, onMenu }: Props = $props();

  const medals = ['🥇', '🥈', '🥉'];
</script>

<div class="standings">
  <header>
    <h1>Final standings</h1>
  </header>

  <ol class="board">
    {#each standings as s, i (s.player_id)}
      <li class:me={s.player_id === myId} class:top={i === 0}>
        <span class="rank">{medals[i] ?? i + 1}</span>
        <span class="who">
          {s.name}{#if s.player_id === myId}<span class="you"> (you)</span>{/if}
        </span>
        <span class="pts">{formatScore(s.total_score)}</span>
      </li>
    {/each}
  </ol>

  <div class="actions">
    {#if isHost}
      <button type="button" class="primary" onclick={onNewRoom}>New room (same settings)</button>
    {:else}
      <p class="hint">Ask the host to start a new room to play again.</p>
    {/if}
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
  .board {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
    overflow-y: auto;
  }
  .board li {
    display: grid;
    grid-template-columns: 40px 1fr auto;
    gap: 12px;
    align-items: center;
    padding: 14px;
    background: var(--bg-elev);
    border: 1px solid var(--line);
    border-radius: var(--radius);
  }
  .board li.top {
    border-color: color-mix(in srgb, var(--warn) 50%, var(--line));
  }
  .board li.me {
    background: color-mix(in srgb, var(--accent) 12%, var(--bg-elev));
  }
  .rank {
    font-size: 1.2rem;
    text-align: center;
  }
  .who {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-weight: 600;
  }
  .you {
    color: var(--fg-muted);
    font-weight: 400;
  }
  .pts {
    font-weight: 800;
    font-size: 1.2rem;
    color: var(--accent);
  }
  .actions {
    margin-top: auto;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .hint {
    text-align: center;
    color: var(--fg-muted);
    margin: 0;
  }
</style>
