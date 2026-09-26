<script>
  import { onMount, onDestroy } from 'svelte';
  import { api } from '../lib/api.js';
  import { formatBytes, errorMessage } from '../lib/radarr.js';

  let records = $state([]);
  let total = $state(0);
  let page = $state(1);
  let loading = $state(true);
  let busy = $state(null);
  let error = $state('');
  let timer;
  const pageSize = 50;
  const pages = $derived(Math.max(1, Math.ceil(total / pageSize)));

  async function load(silent = false) {
    if (!silent) loading = true;
    try {
      const data = await api.proxy.get('radarr', '/api/v3/queue', { page, pageSize, includeMovie: true, includeUnknownMovieItems: true });
      records = data.records || [];
      total = data.totalRecords || 0;
      error = '';
    } catch (cause) { error = errorMessage(cause); }
    finally { loading = false; }
  }

  onMount(() => { load(); timer = setInterval(() => load(true), 20_000); });
  onDestroy(() => clearInterval(timer));

  async function changePage(next) { page = next; await load(); }

  async function remove(item, blocklist = false) {
    const action = blocklist ? 'remove and blocklist' : 'remove';
    if (!confirm(`Do you want to ${action} “${item.title}” from the download queue? The download will be removed from its client.`)) return;
    busy = item.id; error = '';
    try {
      await api.proxy.delete('radarr', `/api/v3/queue/${item.id}`, { removeFromClient: true, blocklist });
      await load(true);
    } catch (cause) { error = errorMessage(cause); }
    finally { busy = null; }
  }

  function progress(item) {
    if (!item.size) return 0;
    return Math.max(0, Math.min(100, Math.round((1 - (item.sizeleft || 0) / item.size) * 100)));
  }
</script>

<div class="rad-page">
  <header class="rad-head"><div><h1>Download queue</h1><p>{total} active downloads · updates every 20 seconds</p></div><button class="rad-button" onclick={() => load()} disabled={loading}>Refresh</button></header>
  {#if error}<p class="rad-error" role="alert">{error}</p>{/if}
  {#if loading && records.length === 0}<p class="rad-muted">Loading queue…</p>{:else if records.length === 0}<p class="rad-empty">No downloads are queued.</p>{:else}
    <div class="rad-list">
      {#each records as item (item.id)}
        <article class="rad-row"><div class="rad-row-main"><strong class="rad-row-title">{item.movie?.title || item.title || 'Unknown movie'}</strong><span class="rad-row-meta">{item.title}</span><div class="rad-actions"><span class="rad-badge" class:bad={item.trackedDownloadState === 'importFailed'}>{item.status || 'Queued'}</span><span class="rad-row-meta">{formatBytes(item.size - item.sizeleft)} / {formatBytes(item.size)} · {item.timeleft || 'Time unknown'} · {item.downloadClient || 'Download client'}</span></div>{#if item.statusMessages?.length}<span class="rad-row-meta">{item.statusMessages.map((entry) => entry.messages?.join('; ')).filter(Boolean).join('; ')}</span>{/if}<div class="progress" role="progressbar" aria-label="Download progress" aria-valuenow={progress(item)} aria-valuemin="0" aria-valuemax="100"><span style:width={`${progress(item)}%`}></span></div></div><div class="rad-actions"><button class="rad-button" onclick={() => remove(item)} disabled={busy === item.id}>Remove</button><button class="rad-button danger" onclick={() => remove(item, true)} disabled={busy === item.id}>Blocklist</button></div></article>
      {/each}
    </div>
    {#if pages > 1}<div class="rad-actions"><button class="rad-button" onclick={() => changePage(page - 1)} disabled={page <= 1 || loading}>Previous</button><span class="rad-muted">Page {page} of {pages}</span><button class="rad-button" onclick={() => changePage(page + 1)} disabled={page >= pages || loading}>Next</button></div>{/if}
  {/if}
</div>

<style>
  .rad-row-main { flex: 1; }
  .progress { height: 5px; background: var(--surface-2); border-radius: 999px; overflow: hidden; margin-top: 4px; }
  .progress span { display: block; height: 100%; background: var(--accent); border-radius: inherit; }
</style>
