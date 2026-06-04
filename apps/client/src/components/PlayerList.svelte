<script lang="ts">
  import type { Player } from '$lib/net/bindings';

  interface Props {
    players: Player[];
    myId: string | null;
    /** When provided, shows a "guessed" check next to players who have answered. */
    guessedIds?: string[];
  }
  let { players, myId, guessedIds }: Props = $props();
</script>

<ul class="players" aria-label="Players">
  {#each players as p (p.id)}
    <li class:offline={!p.connected}>
      <span class="name">
        {p.name}
        {#if p.id === myId}<span class="you">(you)</span>{/if}
      </span>
      <span class="tags">
        {#if p.is_host}<span class="badge host" title="Host">👑 host</span>{/if}
        {#if !p.connected}<span class="badge out">left</span>{/if}
        {#if guessedIds}
          {#if guessedIds.includes(p.id)}
            <span class="badge ok" aria-label="Guessed">✓</span>
          {:else if p.connected}
            <span class="badge wait" aria-label="Still guessing">…</span>
          {/if}
        {/if}
      </span>
    </li>
  {/each}
</ul>

<style>
  .players {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  li {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding: 12px 14px;
    background: var(--bg-elev);
    border: 1px solid var(--line);
    border-radius: var(--radius);
  }
  li.offline {
    opacity: 0.5;
  }
  .name {
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .you {
    color: var(--fg-muted);
    font-weight: 400;
    margin-left: 4px;
  }
  .tags {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
  }
  .badge {
    font-size: 0.78rem;
    padding: 2px 7px;
    border-radius: 999px;
    background: var(--bg-elev-2);
    color: var(--fg-muted);
  }
  .badge.host {
    color: var(--warn);
  }
  .badge.ok {
    background: color-mix(in srgb, var(--accent) 24%, var(--bg-elev-2));
    color: var(--accent);
    font-weight: 700;
  }
  .badge.out {
    color: var(--danger);
  }
</style>
