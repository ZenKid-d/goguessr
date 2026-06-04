<script lang="ts">
  interface Props {
    label?: string;
  }
  let { label }: Props = $props();
</script>

<div class="spinner" role="status" aria-live="polite">
  <div class="ring" aria-hidden="true"></div>
  {#if label}<span>{label}</span>{/if}
</div>

<style>
  .spinner {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    color: var(--fg-muted);
  }
  .ring {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    border: 4px solid var(--line);
    border-top-color: var(--accent);
    animation: spin 0.8s linear infinite;
  }
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
