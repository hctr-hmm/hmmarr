<script>
  import { onMount } from 'svelte';
  import { api } from '../lib/api.js';
  import { formatDate, errorMessage } from '../lib/radarr.js';

  const EVENT_LABELS = { grabbed: 'Grabbed', downloadFolderImported: 'Imported', downloadFailed: 'Download failed', movieFileDeleted: 'File deleted', movieFolderImported: 'Folder imported', movieFileRenamed: 'File renamed', downloadIgnored: 'Ignored' };
  let records = $state([]);
  let total = $state(0);
  let page = $state(1);
  let eventType = $state('');
  let loading = $state(true);
  let error = $state('');
  const pageSize = 50;
  const pages = $derived(Math.max(1, Math.ceil(total / pageSize)));

  async function load() {
    loading = true;
    try {
      const params = { page, pageSize, sortKey: 'date', sortDirection: 'descending', includeMovie: true };
      if (eventType) params.eventType = eventType;
      const data = await api.proxy.get('radarr', '/api/v3/history', params);
      records = data.records || [];
      total = data.totalRecords || 0;
      error = '';
    } catch (cause) { error = errorMessage(cause); }
    finally { loading = false; }
  }

  onMount(load);
  function changeFilter() { page = 1; load(); }
  function changePage(next) { page = next; load(); }
</script>

<div class="rad-page">
  <header class="rad-head"><div><h1>History</h1><p>{total} Radarr events</p></div><div class="rad-actions"><select class="rad-select" bind:value={eventType} onchange={changeFilter} aria-label="Event type"><option value="">All events</option>{#each Object.entries(EVENT_LABELS) as [value, label]}<option {value}>{label}</option>{/each}</select><button class="rad-button" onclick={load} disabled={loading}>Refresh</button></div></header>
  {#if error}<p class="rad-error" role="alert">{error}</p>{/if}
  {#if loading && records.length === 0}<p class="rad-muted">Loading history…</p>{:else if records.length === 0}<p class="rad-empty">No history for this selection.</p>{:else}
    <div class="rad-list">{#each records as item (item.id)}<article class="rad-row"><div class="rad-row-main"><strong class="rad-row-title">{item.movie?.title || item.sourceTitle || 'Unknown movie'}</strong><span class="rad-row-meta">{item.sourceTitle}</span><span class="rad-row-meta">{formatDate(item.date)} · {item.quality?.quality?.name || 'Unknown quality'}</span></div><span class="rad-badge" class:bad={item.eventType === 'downloadFailed'} class:good={item.eventType === 'downloadFolderImported'}>{EVENT_LABELS[item.eventType] || item.eventType}</span></article>{/each}</div>
    {#if pages > 1}<div class="rad-actions"><button class="rad-button" onclick={() => changePage(page - 1)} disabled={page <= 1 || loading}>Previous</button><span class="rad-muted">Page {page} of {pages}</span><button class="rad-button" onclick={() => changePage(page + 1)} disabled={page >= pages || loading}>Next</button></div>{/if}
  {/if}
</div>
