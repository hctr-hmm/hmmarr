<script lang="ts">
  let {
    label,
    value,
    sub,
    accentVar
  }: { label: string; value: string | number; sub?: string; accentVar?: string } = $props();
</script>

<div class="stat" style={accentVar ? `--accent:var(${accentVar})` : ''}>
  <div class="stat-value">{value}</div>
  <div class="stat-label">{label}</div>
  {#if sub}<div class="stat-sub">{sub}</div>{/if}
</div>

<style>
  .stat {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    padding: var(--space-4) var(--space-5);
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
  }
  .stat-value {
    font-size: var(--text-xl);
    font-weight: 700;
    letter-spacing: -0.03em;
    color: var(--accent, var(--color-text));
    font-variant-numeric: tabular-nums;
    line-height: 1;
  }
  .stat-label {
    font-size: var(--text-xs);
    color: var(--color-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    font-weight: 500;
  }
  .stat-sub {
    font-size: var(--text-xs);
    color: var(--color-text-faint);
  }
</style>
