<script>
  import { onMount } from 'svelte';
  import { api } from '../lib/api.js';
  import { formatDate, errorMessage } from '../lib/radarr.js';

  let records = $state([]);
  let total = $state(0);
  let page = $state(1);
  let loading = $state(true);
  let busy = $state(null);
  let error = $state('');
  const pageSize = 50;
  const pages = $derived(Math.max(1, Math.ceil(total / pageSize)));

  async function load() {
    loading = true;
    try {
      const data = await api.proxy.get('radarr', '/api/v3/blocklist', { page, pageSize, sortKey: 'date', sortDirection: 'descending' });
      records = data.records || [];
      total = data.totalRecords || 0;
      error = '';
    } catch (cause) { error = errorMessage(cause); }
    finally { loading = false; }
  }

  onMount(load);
  function changePage(next) { page = next; load(); }
  async function remove(item) {
    if (!confirm(`Remove “${item.sourceTitle}” from the blocklist? Radarr may grab this release again.`)) return;
    busy = item.id; error = '';
    try { await api.proxy.delete('radarr', `/api/v3/blocklist/${item.id}`); await load(); }
    catch (cause) { error = errorMessage(cause); }
    finally { busy = null; }
  }
</script>

<div class="rad-page">
  <header class="rad-head"><div><h1>Blocklist</h1><p>{total} blocked releases</p></div><button class="rad-button" onclick={load} disabled={loading}>Refresh</button></header>
  {#if error}<p class="rad-error" role="alert">{error}</p>{/if}
  {#if loading && records.length === 0}<p class="rad-muted">Loading blocklist…</p>{:else if !records.length}<p class="rad-empty">No blocked releases.</p>{:else}<div class="rad-list">{#each records as item (item.id)}<article class="rad-row"><div class="rad-row-main"><strong class="rad-row-title">{item.movie?.title || item.sourceTitle}</strong><span class="rad-row-meta">{item.sourceTitle}</span><span class="rad-row-meta">{formatDate(item.date)} · {item.indexer || 'Unknown indexer'} · {item.quality?.quality?.name || 'Unknown quality'}</span>{#if item.message}<span class="rad-row-meta">{item.message}</span>{/if}</div><button class="rad-button" onclick={() => remove(item)} disabled={busy === item.id}>Unblock</button></article>{/each}</div>{/if}
  {#if pages > 1}<div class="rad-actions"><button class="rad-button" onclick={() => changePage(page - 1)} disabled={page <= 1 || loading}>Previous</button><span class="rad-muted">Page {page} of {pages}</span><button class="rad-button" onclick={() => changePage(page + 1)} disabled={page >= pages || loading}>Next</button></div>{/if}
</div>
