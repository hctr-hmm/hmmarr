<script>
  import { onMount, onDestroy } from 'svelte';
  import { api } from '../lib/api.js';
  import { serviceHealth } from '../lib/stores.js';

  const SERVICES = ['radarr', 'sonarr', 'bazarr', 'prowlarr'];

  let health = $derived($serviceHealth);
  let refreshing = $state(false);
  let loaded = $state(false);
  let lastUpdated = $state(null);
  let timer = null;

  const onlineCount = $derived(
    SERVICES.filter((n) => health[n]?.online).length
  );

  async function checkAll() {
    refreshing = true;
    // Kick off all probes in parallel; each updates the store as it resolves.
    await Promise.allSettled(
      SERVICES.map(async (name) => {
        // Mark as loading without clobbering the "never checked" state on first run
        serviceHealth.update((h) => ({ ...h, [name]: { ...h[name], name, loading: true } }));
        try {
          const result = await api.serviceStatus(name);
          serviceHealth.update((h) => ({ ...h, [name]: { ...result, loading: false } }));
        } catch (err) {
          // Backend returns 502 with a body when the probe fails, so err.data
          // usually holds { online: false, error, latencyMs }.
          serviceHealth.update((h) => ({
            ...h,
            [name]: { ...(err?.data ?? {}), name, online: false, error: err?.data?.error || 'unreachable', loading: false }
          }));
        }
      })
    );
    refreshing = false;
    loaded = true;
    lastUpdated = new Date();
  }

  onMount(async () => {
    // Confirm which services are configured so unconfigured ones show distinctly
    try {
      const list = await api.services();
      const configured = new Set(list.map((s) => s.name));
      serviceHealth.update((h) => {
        const next = { ...h };
        for (const name of SERVICES) {
          if (!configured.has(name)) next[name] = { name, unconfigured: true, online: false, loading: false };
        }
        return next;
      });
    } catch {
      // Fall through — still try status probes below.
    }
    checkAll();
    timer = setInterval(checkAll, 60_000);
  });

  onDestroy(() => timer && clearInterval(timer));

  function fmtTime(d) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }
</script>

<div class="page">
  <header class="page-head">
    <div>
      <h1 class="title">Dashboard</h1>
      <p class="subtitle">
        {#if loaded}
          {onlineCount} of {SERVICES.length} services online
          {#if lastUpdated}<span class="updated"> · updated {fmtTime(lastUpdated)}</span>{/if}
        {:else}
          Checking services…
        {/if}
      </p>
    </div>
    <button class="refresh-btn" onclick={checkAll} disabled={refreshing} aria-label="Refresh service status">
      <svg
        class:spinning={refreshing}
        width="15" height="15" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
        aria-hidden="true"
      >
        <polyline points="23 4 23 10 17 10"/>
        <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
      </svg>
      <span>{refreshing ? 'Refreshing…' : 'Refresh'}</span>
    </button>
  </header>

  <div class="grid">
    {#each SERVICES as name (name)}
      {@const s = health[name]}
      <div class="card" class:unconfigured={s?.unconfigured}>
        <div class="card-head">
          <span class="svc-name">{s?.label ?? name}</span>
          <span
            class="dot"
            class:pulsing={!s || s.loading}
            class:ok={s && !s.loading && s.online}
            class:bad={s && !s.loading && !s.online && !s.unconfigured}
            class:off={s?.unconfigured}
            aria-hidden="true"
          ></span>
        </div>

        <div class="card-body">
          {#if !s || s.loading}
            <p class="status-line muted">Checking…</p>
          {:else if s.unconfigured}
            <p class="status-line faint">Not configured</p>
            <p class="hint">Set {name.toUpperCase()}_URL and {name.toUpperCase()}_API_KEY</p>
          {:else if s.online}
            <p class="status-line ok-text">Online</p>
            <div class="meta">
              {#if s.version}<span class="chip">v{s.version}</span>{/if}
              {#if s.appName && s.appName !== s.label}<span class="chip faint-chip">{s.appName}</span>{/if}
              {#if typeof s.latencyMs === 'number'}<span class="chip">{s.latencyMs} ms</span>{/if}
            </div>
          {:else}
            <p class="status-line bad-text">Offline</p>
            <div class="meta">
              {#if s.error}<span class="chip bad-chip">{s.error}</span>{/if}
              {#if typeof s.latencyMs === 'number'}<span class="chip">{s.latencyMs} ms</span>{/if}
            </div>
          {/if}
        </div>
      </div>
    {/each}
  </div>
</div>

<style>
  .page {
    max-width: 960px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: var(--space-6);
  }

  .page-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--space-4);
  }
  .title {
    font-size: var(--text-xl);
    font-weight: 700;
    letter-spacing: -0.02em;
    color: var(--text);
  }
  .subtitle {
    margin-top: var(--space-1);
    font-size: var(--text-sm);
    color: var(--text-muted);
  }
  .updated { color: var(--text-faint); }

  .refresh-btn {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-3);
    background: var(--surface);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-md);
    color: var(--text-muted);
    font-size: var(--text-sm);
    font-weight: 500;
    transition: color var(--trans), border-color var(--trans), background var(--trans);
    flex-shrink: 0;
  }
  .refresh-btn:hover:not(:disabled) {
    color: var(--accent);
    border-color: color-mix(in oklch, var(--accent) 40%, transparent);
  }
  .refresh-btn:disabled { opacity: 0.55; cursor: default; }

  @keyframes spin { to { transform: rotate(360deg); } }
  .spinning { animation: spin 0.8s linear infinite; }

  .grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: var(--space-4);
  }

  .card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    padding: var(--space-4);
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    transition: border-color var(--trans);
  }
  .card:hover { border-color: var(--border-subtle); }
  .card.unconfigured { opacity: 0.6; }

  .card-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
  }
  .svc-name {
    font-size: var(--text-sm);
    font-weight: 600;
    color: var(--text);
    letter-spacing: 0.01em;
  }

  .dot {
    width: 9px;
    height: 9px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .dot.ok { background: var(--green); box-shadow: 0 0 8px color-mix(in oklch, var(--green) 60%, transparent); }
  .dot.bad { background: var(--red); box-shadow: 0 0 8px color-mix(in oklch, var(--red) 50%, transparent); }
  .dot.off { background: var(--text-faint); }
  .dot.pulsing {
    background: var(--text-muted);
    animation: pulse 1.2s ease-in-out infinite;
  }
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.25; }
  }

  .card-body {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    min-height: 52px;
  }
  .status-line { font-size: var(--text-sm); font-weight: 500; }
  .status-line.muted { color: var(--text-muted); }
  .status-line.ok-text { color: var(--green); }
  .status-line.bad-text { color: var(--red); }
  .status-line.faint { color: var(--text-faint); }

  .hint {
    font-size: var(--text-xs);
    color: var(--text-faint);
    line-height: 1.4;
  }

  .meta {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-1);
  }
  .chip {
    font-size: var(--text-xs);
    color: var(--text-muted);
    background: var(--surface-2);
    border: 1px solid var(--border-subtle);
    padding: 1px var(--space-2);
    border-radius: 999px;
    white-space: nowrap;
  }
  .bad-chip {
    color: var(--red);
    border-color: color-mix(in oklch, var(--red) 30%, transparent);
    background: color-mix(in oklch, var(--red) 8%, transparent);
  }
  .faint-chip { color: var(--text-faint); }

  @media (max-width: 1100px) {
    .grid { grid-template-columns: repeat(2, 1fr); }
  }
  @media (max-width: 460px) {
    .grid { grid-template-columns: 1fr; }
    .page-head { flex-direction: column; align-items: stretch; }
  }
</style>
