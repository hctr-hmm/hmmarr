<script lang="ts">
  let { message, retry }: { message: string; retry?: () => void } = $props();
</script>

<div class="banner" role="alert">
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <circle cx="12" cy="12" r="10"/>
    <line x1="12" y1="8" x2="12" y2="12"/>
    <line x1="12" y1="16" x2="12.01" y2="16"/>
  </svg>
  <span>{message}</span>
  {#if retry}
    <button class="retry" onclick={retry}>Retry</button>
  {/if}
</div>

<style>
  .banner {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-3) var(--space-4);
    background: var(--color-error-dim);
    border: 1px solid color-mix(in oklch, var(--color-error) 30%, transparent);
    border-radius: var(--radius-md);
    color: var(--color-error);
    font-size: var(--text-sm);
  }
  .banner span { flex: 1; }
  .retry {
    padding: var(--space-1) var(--space-3);
    border-radius: var(--radius-sm);
    background: color-mix(in oklch, var(--color-error) 12%, transparent);
    color: var(--color-error);
    font-size: var(--text-xs);
    font-weight: 500;
    transition: background var(--t);
  }
  .retry:hover { background: color-mix(in oklch, var(--color-error) 22%, transparent); }
</style>
