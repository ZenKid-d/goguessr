<script lang="ts">
  import type { GameMode } from '$lib/net/bindings';

  interface Props {
    value: GameMode;
    onchange: (mode: GameMode) => void;
  }
  let { value, onchange }: Props = $props();

  const modes: { id: GameMode; label: string; hint: string }[] = [
    { id: 'Move', label: 'Move', hint: 'Walk around' },
    { id: 'NoMove', label: 'No Move', hint: 'Pan & zoom' },
    { id: 'NMPZ', label: 'NMPZ', hint: 'Frozen frame' },
  ];
</script>

<div class="seg" role="radiogroup" aria-label="Game mode">
  {#each modes as m (m.id)}
    <button
      type="button"
      role="radio"
      aria-checked={value === m.id}
      class:active={value === m.id}
      onclick={() => onchange(m.id)}
    >
      <strong>{m.label}</strong>
      <small>{m.hint}</small>
    </button>
  {/each}
</div>

<style>
  .seg {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
  }
  button {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    padding: 10px 6px;
    background: var(--bg-elev);
  }
  button.active {
    background: var(--accent);
    color: var(--accent-fg);
    border-color: transparent;
  }
  button small {
    font-size: 0.72rem;
    opacity: 0.8;
  }
</style>
