<script lang="ts">
  import type { ServiceInfo, ServiceStatus } from '$api/client';
  import StatusDot from './StatusDot.svelte';
  import Spinner from './Spinner.svelte';

  let {
    service,
    status,
    accentVar,
    href
  }: {
    service: ServiceInfo;
    status?: ServiceStatus & { loading?: boolean };
    accentVar: string;
    href: string;
  } = $props();

  const accent = `var(${accentVar})`;
  const accentDim = `var(${accentVar}-dim)`;
</script>

<a {href} class="card" style="--accent:{accent};--accent-dim:{accentDim}">
  <div class="card-header">
    <div class="service-label">{service.label}</div>
    {#if status?.loading}
      <Spinner size={12} color="var(--color-text-faint)" />
    {:else}
      <StatusDot online={status?.online ?? false} size={8} />
    {/if}
  </div>

  <div class="card-body">
    {#if status?.online}
      <div class="status-line online">Online</div>
      {#if status.version}
        <div class="version">v{status.version}</div>
      {/if}
      {#if status.latencyMs !== undefined}
        <div class="latency">{status.latencyMs}ms</div>
      {/if}
    {:else if status?.loading}
      <div class="status-line loading">Checking…</div>
    {:else if status}
      <div class="status-line offline">{status.error ?? 'Offline'}</div>
    {:else}
      <div class="status-line loading">Waiting…</div>
    {/if}
  </div>

  <div class="card-footer">
    <span class="api-version">API {service.apiVersion}</span>
    <svg class="arrow" viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5">
      <path d="M3 8h10M9 4l4 4-4 4" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  </div>
</a>

<style>
  .card {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    padding: var(--space-5);
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    transition: background var(--t), border-color var(--t), transform var(--t), box-shadow var(--t);
    position: relative;
    overflow: hidden;
  }
  .card::before {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(135deg, var(--accent-dim) 0%, transparent 60%);
    opacity: 0;
    transition: opacity var(--t-slow);
    pointer-events: none;
  }
  .card:hover {
    border-color: color-mix(in oklch, var(--accent) 35%, var(--color-border));
    box-shadow: var(--shadow-md);
    transform: translateY(-1px);
  }
  .card:hover::before { opacity: 1; }

  .card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .service-label {
    font-size: var(--text-sm);
    font-weight: 600;
    color: var(--accent);
    letter-spacing: -0.01em;
  }

  .card-body {
    display: flex;
    align-items: baseline;
    gap: var(--space-3);
    flex-wrap: wrap;
  }

  .status-line {
    font-size: var(--text-base);
    font-weight: 500;
  }
  .status-line.online  { color: var(--color-success); }
  .status-line.offline { color: var(--color-error); }
  .status-line.loading { color: var(--color-text-faint); }

  .version, .latency {
    font-size: var(--text-xs);
    color: var(--color-text-muted);
    font-variant-numeric: tabular-nums;
  }

  .card-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: auto;
  }
  .api-version {
    font-size: var(--text-xs);
    color: var(--color-text-faint);
    font-variant-numeric: tabular-nums;
  }
  .arrow {
    color: var(--color-text-faint);
    transition: color var(--t), transform var(--t);
  }
  .card:hover .arrow {
    color: var(--accent);
    transform: translateX(2px);
  }
</style>
