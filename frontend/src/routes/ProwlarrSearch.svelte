<script>
  import { api } from '../lib/api.js';
  import { errorMessage, formatBytes, formatDate } from '../lib/radarr.js';

  let { indexers = [] } = $props();
  let query = $state('');
  let indexerId = $state('all');
  let category = $state('all');
  let sort = $state('seeders');
  let results = $state([]);
  let offset = $state(0);
  let loading = $state(false);
  let busy = $state('');
  let searched = $state(false);
  let error = $state('');
  let notice = $state('');
  const pageSize = 100;

  const sorted = $derived([...results].sort((a, b) => {
    if (sort === 'newest') return (b.publishDate || '').localeCompare(a.publishDate || '');
    if (sort === 'size') return (b.size || 0) - (a.size || 0);
    if (sort === 'title') return (a.title || '').localeCompare(b.title || '');
    return (b.seeders || 0) - (a.seeders || 0);
  }));

  async function search(more = false) {
    if (!query.trim()) { error = 'Enter a search term.'; return; }
    loading = true; error = ''; notice = '';
    const nextOffset = more ? offset + pageSize : 0;
    try {
      const params = { query: query.trim(), type: 'search', limit: pageSize, offset: nextOffset };
      if (indexerId !== 'all') params.indexerIds = indexerId;
      if (category !== 'all') params.categories = category;
      const found = await api.proxy.get('prowlarr', '/api/v1/search', params);
      results = more ? [...results, ...found] : found;
      offset = nextOffset;
      searched = true;
    } catch (cause) { error = errorMessage(cause); }
    finally { loading = false; }
  }

  async function grab(release) {
    if (!confirm(`Grab ${release.title}? Prowlarr will send it to your download client.`)) return;
    busy = release.guid || release.title; error = ''; notice = '';
    try { await api.proxy.post('prowlarr', '/api/v1/search', release); notice = `${release.title} sent to the download client.`; }
    catch (cause) { error = errorMessage(cause); }
    finally { busy = ''; }
  }
</script>

<div class="search-page">
  <div class="rad-head"><div><h2>Search releases</h2><p class="rad-muted">Search your enabled Prowlarr indexers.</p></div></div>
  <div class="rad-toolbar"><input class="rad-input query" type="search" bind:value={query} onkeydown={(event) => { if (event.key === 'Enter') search(); }} placeholder="Movie, series, or release title…" aria-label="Search releases" /><select class="rad-select" bind:value={indexerId} aria-label="Choose indexer"><option value="all">All indexers</option>{#each indexers.filter((item) => item.enable && item.supportsSearch) as indexer}<option value={String(indexer.id)}>{indexer.name}</option>{/each}</select><select class="rad-select" bind:value={category} aria-label="Choose category"><option value="all">All categories</option><option value="2000">Movies</option><option value="5000">TV</option><option value="3000">Audio</option><option value="7000">Books</option></select><button class="rad-button primary" onclick={() => search()} disabled={loading}>{loading ? 'Searching…' : 'Search'}</button></div>
  {#if error}<p class="rad-error" role="alert">{error}</p>{/if}{#if notice}<p class="rad-success" role="status">{notice}</p>{/if}
  {#if searched}<div class="rad-head"><p class="rad-muted">{results.length} results</p><select class="rad-select" bind:value={sort} aria-label="Sort releases"><option value="seeders">Most seeders</option><option value="newest">Newest</option><option value="size">Largest</option><option value="title">Title</option></select></div>{/if}
  {#if loading && !results.length}<p class="rad-muted">Searching indexers…</p>{:else if searched && !results.length}<p class="rad-empty">No releases found.</p>{:else if results.length}<div class="rad-list">{#each sorted as release, index (index)}<article class="rad-row"><div class="rad-row-main"><strong class="rad-row-title">{release.title}</strong><span class="rad-row-meta">{release.indexer || 'Indexer'} · {release.protocol || 'Release'} · {formatBytes(release.size)} · {formatDate(release.publishDate)}</span><span class="rad-row-meta">{release.seeders ?? '—'} seeders · {release.leechers ?? '—'} leechers · {release.grabs ?? '—'} grabs</span></div><button class="rad-button" onclick={() => grab(release)} disabled={!!busy || !release.downloadUrl && !release.magnetUrl}>Grab</button></article>{/each}</div>{/if}
  {#if searched && results.length >= offset + pageSize}<button class="rad-button more" onclick={() => search(true)} disabled={loading}>Load more</button>{/if}
</div>

<style>
  .search-page { display: grid; gap: 16px; }
  .search-page h2 { color: var(--text); font-size: var(--text-lg); }
  .query { flex: 1; min-width: 200px; }
  .rad-row-main { flex: 1; }
  .more { justify-self: center; }
</style>
