<script>
  import { onMount } from 'svelte';
  import { api } from '../lib/api.js';
  import { errorMessage, formatDate } from '../lib/radarr.js';

  let { indexers = [], stats = [] } = $props();
  let section = $state('history');
  let records = $state([]);
  let totalRecords = $state(0);
  let page = $state(1);
  let indexerId = $state('all');
  let onlyFailed = $state(false);
  let health = $state([]);
  let loading = $state(true);
  let busy = $state(false);
  let error = $state('');
  let notice = $state('');
  const pageSize = 30;
  const pages = $derived(Math.max(1, Math.ceil(totalRecords / pageSize)));
  const sortedStats = $derived([...stats].sort((a, b) => (b.numberOfQueries || 0) - (a.numberOfQueries || 0)));

  async function loadHistory() {
    loading = true; error = '';
    try {
      const params = { page, pageSize, sortKey: 'date', sortDirection: 'descending' };
      if (indexerId !== 'all') params.indexerIds = indexerId;
      if (onlyFailed) params.successful = false;
      const result = await api.proxy.get('prowlarr', '/api/v1/history', params);
      records = result.records || [];
      totalRecords = result.totalRecords || 0;
    } catch (cause) { error = errorMessage(cause); records = []; }
    finally { loading = false; }
  }

  async function loadHealth() {
    try { health = await api.proxy.get('prowlarr', '/api/v1/health'); }
    catch (cause) { error = errorMessage(cause); }
  }
  onMount(() => { loadHistory(); loadHealth(); });

  function changeFilter() { page = 1; loadHistory(); }
  function changePage(next) { page = next; loadHistory(); }

  async function testAll() {
    busy = true; error = ''; notice = '';
    try { await api.proxy.post('prowlarr', '/api/v1/indexer/testall'); notice = 'Indexer tests started.'; }
    catch (cause) { error = errorMessage(cause); }
    finally { busy = false; }
  }

  function indexerName(id) { return indexers.find((item) => item.id === id)?.name || `Indexer ${id}`; }
</script>

<div class="activity">
  <div class="rad-head"><div><h2>Prowlarr activity</h2><p class="rad-muted">Searches, grabs, indexer performance, and health.</p></div><div class="rad-actions"><button class="rad-button" onclick={testAll} disabled={busy}>Test all indexers</button><button class="rad-button" onclick={() => { loadHistory(); loadHealth(); }} disabled={loading}>Refresh</button></div></div>
  <div class="rad-actions" role="tablist" aria-label="Activity sections"><button class="rad-button" class:primary={section === 'history'} role="tab" aria-selected={section === 'history'} onclick={() => section = 'history'}>History</button><button class="rad-button" class:primary={section === 'stats'} role="tab" aria-selected={section === 'stats'} onclick={() => section = 'stats'}>Statistics</button><button class="rad-button" class:primary={section === 'health'} role="tab" aria-selected={section === 'health'} onclick={() => section = 'health'}>Health</button></div>
  {#if error}<p class="rad-error" role="alert">{error}</p>{/if}{#if notice}<p class="rad-success" role="status">{notice}</p>{/if}
  {#if section === 'history'}
    <div class="rad-toolbar"><select class="rad-select" bind:value={indexerId} onchange={changeFilter} aria-label="Filter history by indexer"><option value="all">All indexers</option>{#each indexers as item}<option value={String(item.id)}>{item.name}</option>{/each}</select><label class="rad-check"><input type="checkbox" bind:checked={onlyFailed} onchange={changeFilter} /> Failed only</label><span class="rad-muted">{totalRecords} events</span></div>
    {#if loading && !records.length}<p class="rad-muted">Loading activity…</p>{:else if !records.length}<p class="rad-empty">No matching events.</p>{:else}<div class="rad-list">{#each records as event (event.id)}<div class="rad-row"><div class="rad-row-main"><strong class="rad-row-title">{indexerName(event.indexerId)} · {event.eventType || 'Event'}</strong><span class="rad-row-meta">{formatDate(event.date)} · {event.data?.source || 'Prowlarr'}{event.data?.query ? ` · ${event.data.query}` : ''}</span><span class="rad-row-meta">{event.data?.queryResults ? `${event.data.queryResults} results · ` : ''}{event.data?.elapsedTime ? `${event.data.elapsedTime} ms` : ''}</span></div><span class="rad-badge" class:good={event.successful} class:bad={!event.successful}>{event.successful ? 'Success' : 'Failed'}</span></div>{/each}</div>{/if}
    {#if pages > 1}<div class="rad-actions"><button class="rad-button" onclick={() => changePage(page - 1)} disabled={page <= 1 || loading}>Previous</button><span class="rad-muted">Page {page} of {pages}</span><button class="rad-button" onclick={() => changePage(page + 1)} disabled={page >= pages || loading}>Next</button></div>{/if}
  {:else if section === 'stats'}
    {#if !sortedStats.length}<p class="rad-empty">No indexer statistics yet.</p>{:else}<div class="rad-list">{#each sortedStats as stat (stat.indexerId)}<div class="rad-row"><div class="rad-row-main"><strong class="rad-row-title">{stat.indexerName || indexerName(stat.indexerId)}</strong><span class="rad-row-meta">{stat.numberOfQueries || 0} searches · {stat.numberOfRssQueries || 0} RSS checks · {stat.numberOfGrabs || 0} grabs</span><span class="rad-row-meta">{(stat.numberOfFailedQueries || 0) + (stat.numberOfFailedRssQueries || 0)} failed requests · {stat.averageResponseTime || 0} ms average</span></div></div>{/each}</div>{/if}
  {:else}
    {#if !health.length}<p class="rad-success">No Prowlarr health issues reported.</p>{:else}<div class="rad-list">{#each health as issue, index (index)}<div class="rad-row"><div class="rad-row-main"><strong class="rad-row-title">{issue.message || 'Health issue'}</strong><span class="rad-row-meta">{issue.source || 'Prowlarr'} · {issue.type || 'Notice'}</span></div></div>{/each}</div>{/if}
  {/if}
</div>

<style>
  .activity { display: grid; gap: 16px; }
  .activity h2 { color: var(--text); font-size: var(--text-lg); }
  .rad-row-main { flex: 1; }
</style>
