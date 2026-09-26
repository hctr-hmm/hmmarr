<script>
  import { onMount } from 'svelte';
  import { api } from '../lib/api.js';
  import { posterUrl, formatDate, errorMessage } from '../lib/radarr.js';

  let mode = $state('missing');
  let monitored = $state(true);
  let records = $state([]);
  let total = $state(0);
  let page = $state(1);
  let selected = $state(new Set());
  let loading = $state(true);
  let busy = $state(false);
  let error = $state('');
  let notice = $state('');
  const pageSize = 50;
  const pages = $derived(Math.max(1, Math.ceil(total / pageSize)));

  async function load() {
    loading = true;
    selected = new Set();
    try {
      const data = await api.proxy.get('radarr', `/api/v3/wanted/${mode}`, { page, pageSize, sortKey: 'title', sortDirection: 'ascending', monitored });
      records = data.records || [];
      total = data.totalRecords || 0;
      error = '';
    } catch (cause) { error = errorMessage(cause); }
    finally { loading = false; }
  }

  onMount(load);
  function changeMode(next) { mode = next; page = 1; load(); }
  function changePage(next) { page = next; load(); }
  function toggle(id) { const next = new Set(selected); if (next.has(id)) next.delete(id); else next.add(id); selected = next; }
  function toggleAll() { selected = selected.size === records.length ? new Set() : new Set(records.map((movie) => movie.id)); }

  async function search(ids) {
    if (!ids.length || !confirm(`Start a Radarr search for ${ids.length} movie${ids.length === 1 ? '' : 's'}?`)) return;
    busy = true; error = ''; notice = '';
    try {
      await api.proxy.post('radarr', '/api/v3/command', { name: 'MoviesSearch', movieIds: ids });
      notice = `Search started for ${ids.length} movie${ids.length === 1 ? '' : 's'}.`;
      selected = new Set();
    } catch (cause) { error = errorMessage(cause); }
    finally { busy = false; }
  }
</script>

<div class="rad-page">
  <header class="rad-head"><div><h1>Wanted movies</h1><p>{total} {mode === 'missing' ? 'missing movies' : 'movies below quality cutoff'}</p></div><div class="rad-actions"><label class="rad-check"><input type="checkbox" bind:checked={monitored} onchange={() => { page = 1; load(); }} /> Monitored only</label><button class="rad-button" onclick={load} disabled={loading}>Refresh</button></div></header>
  {#if error}<p class="rad-error" role="alert">{error}</p>{/if}{#if notice}<p class="rad-success" role="status">{notice}</p>{/if}
  <div class="rad-actions"><button class="rad-button" class:primary={mode === 'missing'} onclick={() => changeMode('missing')}>Missing</button><button class="rad-button" class:primary={mode === 'cutoff'} onclick={() => changeMode('cutoff')}>Below cutoff</button>{#if records.length}<button class="rad-button" onclick={toggleAll}>{selected.size === records.length ? 'Clear selection' : 'Select page'}</button>{/if}{#if selected.size}<button class="rad-button primary" onclick={() => search([...selected])} disabled={busy}>Search selected ({selected.size})</button>{/if}</div>
  {#if loading && !records.length}<p class="rad-muted">Loading wanted movies…</p>{:else if !records.length}<p class="rad-empty">No movies in this list.</p>{:else}<div class="rad-list">{#each records as movie (movie.id)}<article class="rad-row"><label class="item"><input type="checkbox" checked={selected.has(movie.id)} onchange={() => toggle(movie.id)} aria-label={`Select ${movie.title}`} /><span class="small-poster">{#if posterUrl(movie)}<img src={posterUrl(movie, 'small')} alt="" loading="lazy" />{/if}</span><span class="rad-row-main"><strong class="rad-row-title">{movie.title} ({movie.year || '—'})</strong><span class="rad-row-meta">{movie.qualityProfile?.name || movie.movieFile?.quality?.quality?.name || (movie.hasFile ? 'Has file' : 'No file')} · {movie.monitored ? 'Monitored' : 'Unmonitored'} · {formatDate(movie.digitalRelease || movie.physicalRelease || movie.inCinemas)}</span></span></label><button class="rad-button" onclick={() => search([movie.id])} disabled={busy}>Search</button></article>{/each}</div>{/if}
  {#if pages > 1}<div class="rad-actions"><button class="rad-button" onclick={() => changePage(page - 1)} disabled={page <= 1 || loading}>Previous</button><span class="rad-muted">Page {page} of {pages}</span><button class="rad-button" onclick={() => changePage(page + 1)} disabled={page >= pages || loading}>Next</button></div>{/if}
</div>

<style>
  .item { display: flex; align-items: center; gap: 12px; flex: 1; min-width: 0; }
  .item input { accent-color: var(--accent); }
  .small-poster, .small-poster img { width: 36px; height: 54px; object-fit: cover; border-radius: 3px; background: var(--surface-2); }
</style>
