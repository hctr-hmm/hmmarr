<script>
  import { onMount } from 'svelte';
  import { api } from '../lib/api.js';
  import { seriesPosterUrl } from '../lib/sonarr.js';
  import { formatBytes, errorMessage } from '../lib/radarr.js';
  import AddSeries from './AddSeries.svelte';
  import SeriesDetail from './SeriesDetail.svelte';
  import SeriesActivity from './SeriesActivity.svelte';

  const sections = [
    { id: 'library', label: 'Library' },
    { id: 'wanted', label: 'Wanted' },
    { id: 'queue', label: 'Queue' },
    { id: 'calendar', label: 'Calendar' },
    { id: 'history', label: 'History' },
  ];
  let section = $state('library');
  let series = $state([]);
  let loading = $state(true);
  let error = $state('');
  let query = $state('');
  let filter = $state('all');
  let sort = $state('title');
  let selected = $state(null);
  let adding = $state(false);
  let busyId = $state(null);

  async function loadSeries() {
    loading = true; error = '';
    try { series = await api.proxy.get('sonarr', '/api/v3/series'); }
    catch (cause) { error = `Could not load Sonarr series: ${errorMessage(cause)}`; }
    finally { loading = false; }
  }
  onMount(loadSeries);

  const visible = $derived.by(() => {
    const text = query.trim().toLowerCase();
    const result = series.filter((item) => {
      if (text && !`${item.title} ${item.year || ''}`.toLowerCase().includes(text)) return false;
      if (filter === 'monitored') return item.monitored;
      if (filter === 'unmonitored') return !item.monitored;
      if (filter === 'incomplete') return item.monitored && (item.statistics?.episodeFileCount || 0) < (item.statistics?.episodeCount || 0);
      if (filter === 'complete') return (item.statistics?.episodeCount || 0) > 0 && item.statistics?.episodeFileCount >= item.statistics?.episodeCount;
      return true;
    });
    if (sort === 'added') result.sort((a, b) => (b.added || '').localeCompare(a.added || ''));
    else if (sort === 'year') result.sort((a, b) => (b.year || 0) - (a.year || 0));
    else if (sort === 'progress') result.sort((a, b) => (a.statistics?.percentOfEpisodes || 0) - (b.statistics?.percentOfEpisodes || 0));
    else result.sort((a, b) => (a.sortTitle || a.title).localeCompare(b.sortTitle || b.title, undefined, { numeric: true, sensitivity: 'base' }));
    return result;
  });

  async function toggleMonitored(item) {
    busyId = item.id; error = '';
    try {
      const updated = await api.proxy.put('sonarr', `/api/v3/series/${item.id}`, { ...item, monitored: !item.monitored });
      series = series.map((entry) => entry.id === item.id ? updated : entry);
    } catch (cause) { error = errorMessage(cause); }
    finally { busyId = null; }
  }

  function updated(item) { series = series.map((entry) => entry.id === item.id ? item : entry); }
  function removed(id) { series = series.filter((entry) => entry.id !== id); selected = null; }
</script>

<div class="rad-page">
  <header class="rad-head">
    <div><h1>Series</h1><p>{series.length} series · {series.reduce((sum, item) => sum + (item.statistics?.episodeFileCount || 0), 0)} episode files · {formatBytes(series.reduce((sum, item) => sum + (item.statistics?.sizeOnDisk || 0), 0))}</p></div>
    <div class="rad-actions"><button class="rad-button primary" onclick={() => adding = true}>Add series</button><button class="rad-button" onclick={loadSeries} disabled={loading}>Refresh</button></div>
  </header>

  <div class="rad-actions section-tabs" role="tablist" aria-label="Series sections">
    {#each sections as item}<button class="rad-button" class:primary={section === item.id} role="tab" aria-selected={section === item.id} onclick={() => section = item.id}>{item.label}</button>{/each}
  </div>
  {#if error}<p class="rad-error" role="alert">{error}</p>{/if}

  {#if section === 'library'}
    <div class="rad-toolbar">
      <input class="rad-input search" type="search" bind:value={query} placeholder="Search series…" aria-label="Search series" />
      <select class="rad-select" bind:value={filter} aria-label="Filter series"><option value="all">All</option><option value="monitored">Monitored</option><option value="unmonitored">Unmonitored</option><option value="incomplete">Incomplete</option><option value="complete">Complete</option></select>
      <select class="rad-select" bind:value={sort} aria-label="Sort series"><option value="title">Title A–Z</option><option value="added">Recently added</option><option value="year">Newest</option><option value="progress">Least complete</option></select>
    </div>
    {#if loading && !series.length}<p class="rad-muted">Loading Sonarr library…</p>
    {:else if !visible.length}<p class="rad-empty">{error || (query || filter !== 'all' ? 'No series match these filters.' : 'No series in Sonarr yet.')}</p>
    {:else}<div class="series-grid">
      {#each visible as item (item.id)}
        <article class="series-card">
          <button class="series-cover" onclick={() => selected = item} aria-label={`View ${item.title}`}>
            {#if seriesPosterUrl(item)}<img src={seriesPosterUrl(item)} alt={`${item.title} poster`} loading="lazy" decoding="async" />{:else}<span>{item.title?.slice(0, 1)}</span>{/if}
            <span class="status" class:complete={(item.statistics?.percentOfEpisodes || 0) === 100}>{Math.round(item.statistics?.percentOfEpisodes || 0)}%</span>
          </button>
          <div class="series-info">
            <button class="series-title" onclick={() => selected = item}>{item.title}</button>
            <span class="rad-row-meta">{item.year || '—'} · {item.status || 'Unknown'} · {item.statistics?.episodeFileCount || 0}/{item.statistics?.episodeCount || 0} episodes</span>
            <div class="progress" role="progressbar" aria-label={`${item.title} downloaded episodes`} aria-valuenow={Math.round(item.statistics?.percentOfEpisodes || 0)} aria-valuemin="0" aria-valuemax="100"><span style:width={`${Math.min(100, item.statistics?.percentOfEpisodes || 0)}%`}></span></div>
            <button class="monitor" class:on={item.monitored} onclick={() => toggleMonitored(item)} disabled={busyId === item.id} aria-pressed={item.monitored}>{item.monitored ? '● Monitored' : '○ Unmonitored'}</button>
          </div>
        </article>
      {/each}
    </div>{/if}
  {:else}
    {#key section}<SeriesActivity view={section} />{/key}
  {/if}
</div>

{#if adding}<AddSeries existingIds={new Set(series.map((item) => item.tvdbId))} onClose={() => adding = false} onAdded={() => { adding = false; loadSeries(); }} />{/if}
{#if selected}<SeriesDetail series={selected} onClose={() => selected = null} onUpdated={updated} onDeleted={removed} />{/if}

<style>
  .section-tabs { border-bottom: 1px solid var(--border); padding-bottom: 12px; }
  .search { flex: 1; min-width: 180px; }
  .series-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(172px, 1fr)); gap: 18px; }
  .series-card { min-width: 0; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-md); overflow: hidden; }
  .series-cover { position: relative; display: grid; place-items: center; width: 100%; aspect-ratio: 2 / 3; border: 0; padding: 0; background: var(--surface-2); color: var(--text-faint); font-size: 36px; overflow: hidden; }
  .series-cover img { width: 100%; height: 100%; object-fit: cover; }
  .status { position: absolute; right: 8px; bottom: 8px; padding: 4px 7px; border-radius: 4px; color: var(--text); background: #111c; font-size: var(--text-xs); font-weight: 700; }
  .status.complete { color: var(--green); }
  .series-info { display: grid; gap: 7px; padding: 10px; }
  .series-title { border: 0; padding: 0; background: none; color: var(--text); font-size: var(--text-sm); font-weight: 700; text-align: left; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
  .series-title:hover { color: var(--accent); }
  .progress { height: 4px; background: var(--surface-3); border-radius: 3px; overflow: hidden; }
  .progress span { display: block; height: 100%; background: var(--accent); }
  .monitor { width: fit-content; border: 0; padding: 0; background: none; color: var(--text-muted); font-size: var(--text-xs); }
  .monitor.on { color: var(--green); }
</style>
