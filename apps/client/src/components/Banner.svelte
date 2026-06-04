<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    kind?: 'info' | 'warn' | 'error';
    children: Snippet;
  }
  let { kind = 'info', children }: Props = $props();
</script>

<div class="banner {kind}" role={kind === 'error' ? 'alert' : 'status'}>
  {@render children()}
</div>

<style>
  .banner {
    border: 1px solid var(--line);
    border-radius: var(--radius);
    padding: 12px 14px;
    font-size: 0.95rem;
    line-height: 1.35;
  }
  .info {
    background: var(--bg-elev);
  }
  .warn {
    background: color-mix(in srgb, var(--warn) 16%, var(--bg-elev));
    border-color: color-mix(in srgb, var(--warn) 45%, var(--line));
  }
  .error {
    background: color-mix(in srgb, var(--danger) 16%, var(--bg-elev));
    border-color: color-mix(in srgb, var(--danger) 45%, var(--line));
  }
</style>
