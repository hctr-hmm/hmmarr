<script lang="ts">
  let { size = 18, color = 'var(--color-text-muted)' }: { size?: number; color?: string } = $props();
</script>

<span class="spinner" style="--sz:{size}px; --c:{color}" role="status" aria-label="Loading"></span>

<style>
  .spinner {
    display: inline-block;
    width: var(--sz);
    height: var(--sz);
    border: 2px solid color-mix(in oklch, var(--c) 20%, transparent);
    border-top-color: var(--c);
    border-radius: var(--radius-full);
    animation: spin 0.65s linear infinite;
    flex-shrink: 0;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
</style>
