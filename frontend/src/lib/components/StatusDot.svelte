<script lang="ts">
  let {
    online,
    loading = false,
    size = 8
  }: { online: boolean; loading?: boolean; size?: number } = $props();
</script>

<span
  class="dot"
  class:online
  class:loading
  style="--sz:{size}px"
  title={loading ? 'Checking…' : online ? 'Online' : 'Offline'}
></span>

<style>
  .dot {
    display: inline-block;
    width: var(--sz);
    height: var(--sz);
    border-radius: var(--radius-full);
    background: var(--color-error);
    flex-shrink: 0;
    transition: background var(--t);
  }
  .dot.online  { background: var(--color-success); }
  .dot.loading {
    background: var(--color-text-faint);
    animation: pulse 1.2s ease-in-out infinite;
  }
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50%       { opacity: 0.35; }
  }
</style>
