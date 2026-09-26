<script>
  import { onMount } from 'svelte';
  import { api } from '../lib/api.js';
  import { authStatus, navigationSection } from '../lib/stores.js';
  import { errorMessage, formatDate } from '../lib/radarr.js';

  const initialSection = $navigationSection;
  let tab = $state(initialSection?.tab || 'discover');
  let discoverMode = $state('trending');
  let searchText = $state('');
  let query = $state('');
  let discoverPage = $state(1);
  let discoverData = $state({ results: [], totalPages: 1 });
  let requestFilter = $state(initialSection?.filter || 'all');
  let requestPage = $state(1);
  let requestData = $state({ results: [], pageInfo: { pages: 1, results: 0 } });
  let requestDetails = $state({});
  let counts = $state(null);
  let selected = $state(null);
  let selectedType = $state('movie');
  let selectedSeasons = $state([]);
  let loading = $state(false);
  let detailLoading = $state(false);
  let configured = $state(true);
  let busy = $state('');
  let error = $state('');
  let notice = $state('');
  const isAdmin = $derived(Boolean($authStatus.user?.isAdmin));

  const poster = (item) => item?.posterPath ? `https://image.tmdb.org/t/p/w780${item.posterPath}` : null;
  const title = (item) => item?.title || item?.name || `Title #${item?.id || item?.tmdbId || '—'}`;
  const year = (item) => (item?.releaseDate || item?.firstAirDate || '').slice(0, 4);
  const mediaStatus = (status) => ({ 1: 'Unknown', 2: 'Pending', 3: 'Processing', 4: 'Partly available', 5: 'Available', 6: 'Removed' })[status] || 'Not requested';
  const requestStatus = (status) => ({ 1: 'Pending', 2: 'Approved', 3: 'Declined' })[status] || 'Unknown';
  const mediaType = (item) => item?.mediaType === 'tv' || item?.firstAirDate ? 'tv' : 'movie';

  async function checkConfigured() {
    configured = (await api.services()).some((service) => service.name === 'seerr');
    return configured;
  }

  async function loadCounts() {
    try { counts = await api.proxy.get('seerr', '/api/v1/request/count'); }
    catch { counts = null; }
  }

  async function loadDiscover() {
    loading = true; error = '';
    try {
      if (!await checkConfigured()) return;
      const path = query ? '/api/v1/search' : discoverMode === 'trending' ? '/api/v1/discover/trending' : `/api/v1/discover/${discoverMode}`;
      const params = query ? { query, page: discoverPage } : { page: discoverPage };
      discoverData = await api.proxy.get('seerr', path, params);
    } catch (cause) { error = errorMessage(cause); }
    finally { loading = false; }
  }

  async function loadRequests() {
    loading = true; error = '';
    try {
      if (!await checkConfigured()) return;
      requestData = await api.proxy.get('seerr', '/api/v1/request', { take: 20, skip: (requestPage - 1) * 20, filter: requestFilter, sort: 'added', sortDirection: 'desc' });
      await loadCounts();
      const items = requestData.results || [];
      const titles = {};
      await Promise.all(items.map(async (item) => {
        const id = item.media?.tmdbId;
        if (!id) return;
        const type = item.media?.mediaType === 'tv' ? 'tv' : 'movie';
        try { titles[item.id] = await api.proxy.get('seerr', `/api/v1/${type}/${id}`); }
        catch { /* Keep the request visible when metadata is unavailable. */ }
      }));
      requestDetails = titles;
    } catch (cause) { error = errorMessage(cause); }
    finally { loading = false; }
  }

  onMount(() => {
    if (tab === 'requests') loadRequests();
    else loadDiscover();
    loadCounts();
  });

  function changeTab(next) {
    tab = next; error = ''; notice = '';
    if (next === 'requests') loadRequests();
    else loadDiscover();
  }

  function search(event) {
    event.preventDefault();
    query = searchText.trim();
    discoverPage = 1;
    loadDiscover();
  }

  function changeMode(next) {
    discoverMode = next; query = ''; searchText = ''; discoverPage = 1;
    loadDiscover();
  }

  async function openMedia(item, type = mediaType(item)) {
    selectedType = type;
    selected = null;
    selectedSeasons = [];
    detailLoading = true; error = '';
    try {
      selected = await api.proxy.get('seerr', `/api/v1/${type}/${item.id || item.tmdbId}`);
      selectedSeasons = (selected.seasons || []).filter((season) => season.seasonNumber > 0).map((season) => season.seasonNumber);
    } catch (cause) { error = errorMessage(cause); }
    finally { detailLoading = false; }
  }

  function toggleSeason(number) {
    selectedSeasons = selectedSeasons.includes(number) ? selectedSeasons.filter((season) => season !== number) : [...selectedSeasons, number].sort((a, b) => a - b);
  }

  async function requestMedia() {
    if (!selected) return;
    if (selectedType === 'tv' && !selectedSeasons.length) { error = 'Select at least one season.'; return; }
    busy = 'request'; error = ''; notice = '';
    try {
      await api.post('/api/seerr/request', { mediaType: selectedType, mediaId: selected.id, ...(selectedType === 'tv' ? { seasons: selectedSeasons } : {}) });
      notice = `${title(selected)} requested.`;
      selected = await api.proxy.get('seerr', `/api/v1/${selectedType}/${selected.id}`);
      await loadCounts();
    } catch (cause) { error = errorMessage(cause); }
    finally { busy = ''; }
  }

  async function manageRequest(item, action) {
    if (action === 'delete' && !confirm('Remove this request from Seerr?')) return;
    busy = String(item.id); error = ''; notice = '';
    try {
      if (action === 'delete') await api.proxy.delete('seerr', `/api/v1/request/${item.id}`);
      else await api.proxy.post('seerr', `/api/v1/request/${item.id}/${action}`);
      notice = `Request ${action === 'approve' ? 'approved' : action === 'decline' ? 'declined' : action === 'retry' ? 'retried' : 'removed'}.`;
      await loadRequests();
    } catch (cause) { error = errorMessage(cause); }
    finally { busy = ''; }
  }
</script>

<div class="rad-page">
  <header class="rad-head"><div><h1>Requests</h1><p>Discover movies and series with Seerr</p></div><button class="rad-button" onclick={() => tab === 'requests' ? loadRequests() : loadDiscover()} disabled={loading}>Refresh</button></header>

  <div class="summary">
    <div class="rad-panel metric"><strong>{counts?.total ?? '—'}</strong><span>Total requests</span></div>
    <div class="rad-panel metric"><strong>{counts?.pending ?? '—'}</strong><span>Pending</span></div>
    <div class="rad-panel metric"><strong>{counts?.approved ?? '—'}</strong><span>Approved</span></div>
    <div class="rad-panel metric"><strong>{counts?.available ?? '—'}</strong><span>Available</span></div>
  </div>

  <div class="rad-actions tabs" role="tablist" aria-label="Seerr sections"><button class="rad-button" class:primary={tab === 'discover'} role="tab" aria-selected={tab === 'discover'} onclick={() => changeTab('discover')}>Discover</button><button class="rad-button" class:primary={tab === 'requests'} role="tab" aria-selected={tab === 'requests'} onclick={() => changeTab('requests')}>Requests</button></div>
  {#if error}<p class="rad-error" role="alert">{error}</p>{/if}
  {#if notice}<p class="rad-success" role="status">{notice}</p>{/if}

  {#if !configured}
    <p class="rad-empty">Seerr is not connected. Add its API key to Hmmarr’s configuration.</p>
  {:else if tab === 'discover'}
    <form class="rad-toolbar search-form" onsubmit={search}><input class="rad-input" type="search" bind:value={searchText} placeholder="Search movies and series…" aria-label="Search Seerr" /><button class="rad-button primary" type="submit">Search</button>{#if query}<button class="rad-button" type="button" onclick={() => changeMode(discoverMode)}>Clear</button>{/if}</form>
    {#if !query}<div class="rad-actions"><button class="rad-button" class:primary={discoverMode === 'trending'} onclick={() => changeMode('trending')}>Trending</button><button class="rad-button" class:primary={discoverMode === 'movies'} onclick={() => changeMode('movies')}>Movies</button><button class="rad-button" class:primary={discoverMode === 'tv'} onclick={() => changeMode('tv')}>Series</button></div>{/if}
    {#if loading && !discoverData.results?.length}<p class="rad-muted">Loading titles…</p>{:else if !discoverData.results?.length}<p class="rad-empty">No titles found.</p>{:else}
      <div class="media-grid">{#each discoverData.results as item (item.mediaType + '-' + item.id)}{#if item.mediaType !== 'person'}<button class="media-card" onclick={() => openMedia(item)}><div class="poster">{#if poster(item)}<img src={poster(item)} alt="" loading="lazy" />{:else}<span>No poster</span>{/if}</div><strong>{title(item)}</strong><span>{mediaType(item) === 'tv' ? 'Series' : 'Movie'}{year(item) ? ` · ${year(item)}` : ''}</span><small>{mediaStatus(item.mediaInfo?.status)}</small></button>{/if}{/each}</div>
      <div class="rad-actions page-controls"><button class="rad-button" onclick={() => { discoverPage--; loadDiscover(); }} disabled={discoverPage <= 1 || loading}>Previous</button><span class="rad-muted">Page {discoverPage} of {discoverData.totalPages || 1}</span><button class="rad-button" onclick={() => { discoverPage++; loadDiscover(); }} disabled={discoverPage >= (discoverData.totalPages || 1) || loading}>Next</button></div>
    {/if}
  {:else}
    <div class="rad-toolbar filters"><select class="rad-select" bind:value={requestFilter} onchange={() => { requestPage = 1; loadRequests(); }} aria-label="Filter requests"><option value="all">All requests</option><option value="pending">Pending</option><option value="approved">Approved</option><option value="processing">Processing</option><option value="available">Available</option><option value="failed">Failed</option><option value="completed">Completed</option></select><span class="rad-muted">{requestData.pageInfo?.results ?? requestData.results?.length ?? 0} requests</span></div>
    {#if loading && !requestData.results?.length}<p class="rad-muted">Loading requests…</p>{:else if !requestData.results?.length}<p class="rad-empty">No requests in this view.</p>{:else}
      <div class="rad-list">{#each requestData.results as item (item.id)}{@const metadata = requestDetails[item.id]}<article class="rad-row request-row"><div class="rad-row-main"><button class="request-title" onclick={() => openMedia({ id: item.media?.tmdbId }, item.media?.mediaType === 'tv' ? 'tv' : 'movie')}>{metadata ? title(metadata) : `${item.media?.mediaType === 'tv' ? 'Series' : 'Movie'} #${item.media?.tmdbId || '—'}`}</button><span class="rad-row-meta">{requestStatus(item.status)} · {mediaStatus(item.media?.status)} · requested by {item.requestedBy?.displayName || item.requestedBy?.username || item.requestedBy?.email || 'Unknown'} · {formatDate(item.createdAt)}</span></div>{#if isAdmin}<div class="rad-actions">{#if item.status === 1}<button class="rad-button" onclick={() => manageRequest(item, 'approve')} disabled={!!busy}>Approve</button><button class="rad-button" onclick={() => manageRequest(item, 'decline')} disabled={!!busy}>Decline</button>{/if}{#if requestFilter === 'failed'}<button class="rad-button" onclick={() => manageRequest(item, 'retry')} disabled={!!busy}>Retry</button>{/if}<button class="rad-button danger" onclick={() => manageRequest(item, 'delete')} disabled={!!busy}>Remove</button></div>{/if}</article>{/each}</div>
      <div class="rad-actions page-controls"><button class="rad-button" onclick={() => { requestPage--; loadRequests(); }} disabled={requestPage <= 1 || loading}>Previous</button><span class="rad-muted">Page {requestPage} of {requestData.pageInfo?.pages || 1}</span><button class="rad-button" onclick={() => { requestPage++; loadRequests(); }} disabled={requestPage >= (requestData.pageInfo?.pages || 1) || loading}>Next</button></div>
    {/if}
  {/if}

  {#if detailLoading}<p class="rad-muted">Loading title details…</p>{/if}
  {#if selected}<section class="rad-panel detail"><div class="rad-head"><div><h2>{title(selected)}{year(selected) ? ` (${year(selected)})` : ''}</h2><p>{selectedType === 'tv' ? 'Series' : 'Movie'} · {mediaStatus(selected.mediaInfo?.status)} · {Number(selected.voteAverage || 0).toFixed(1)} / 10</p></div><button class="rad-button" onclick={() => selected = null}>Close</button></div><div class="detail-body">{#if poster(selected)}<img src={poster(selected)} alt="" />{/if}<div><p>{selected.overview || 'No description available.'}</p>{#if selectedType === 'tv' && (selected.seasons || []).length}<div class="season-picker"><strong>Seasons to request</strong><div class="rad-actions">{#each selected.seasons.filter((season) => season.seasonNumber > 0) as season (season.seasonNumber)}<label class="season"><input type="checkbox" checked={selectedSeasons.includes(season.seasonNumber)} onchange={() => toggleSeason(season.seasonNumber)} /> Season {season.seasonNumber}</label>{/each}</div></div>{/if}<div class="rad-actions">{#if selected.mediaInfo?.status === 5}<span class="rad-badge good">Already available</span>{:else if selected.mediaInfo?.status === 2 || selected.mediaInfo?.status === 3}<span class="rad-badge">Already requested</span>{:else}<button class="rad-button primary" onclick={requestMedia} disabled={!!busy || (selectedType === 'tv' && !selectedSeasons.length)}>{busy === 'request' ? 'Requesting…' : `Request ${selectedType === 'tv' ? 'series' : 'movie'}`}</button>{/if}</div></div></div></section>{/if}
</div>

<style>
  .summary { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; }
  .metric { display: grid; gap: 4px; padding: 14px; }
  .metric strong { color: var(--text); font-size: var(--text-lg); }
  .metric span { color: var(--text-muted); font-size: var(--text-xs); }
  .search-form { display: flex; gap: 8px; }
  .search-form input { flex: 1; min-width: 0; }
  .media-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(135px, 1fr)); gap: 16px; }
  .media-card { display: grid; align-content: start; gap: 5px; min-width: 0; border: 0; background: none; color: var(--text); text-align: left; }
  .media-card:hover strong, .request-title:hover { color: var(--accent); }
  .poster { aspect-ratio: 2 / 3; border-radius: var(--radius-md); overflow: hidden; background: var(--surface-2); display: grid; place-items: center; color: var(--text-muted); }
  .poster img { width: 100%; height: 100%; object-fit: cover; }
  .media-card strong { font-size: var(--text-sm); line-height: 1.35; }
  .media-card span, .media-card small { color: var(--text-muted); font-size: var(--text-xs); }
  .page-controls { justify-content: center; align-items: center; }
  .filters { display: flex; align-items: center; gap: 10px; }
  .request-row { align-items: center; }
  .request-title { border: 0; background: none; color: var(--text); font-weight: 700; font-size: var(--text-sm); text-align: left; }
  .detail { display: grid; gap: 18px; }
  .detail h2 { color: var(--text); font-size: var(--text-lg); }
  .detail .rad-head p { color: var(--text-muted); }
  .detail-body { display: flex; gap: 20px; align-items: flex-start; }
  .detail-body > img { width: 165px; aspect-ratio: 2 / 3; object-fit: cover; border-radius: var(--radius-md); flex-shrink: 0; }
  .detail-body > div { display: grid; gap: 18px; }
  .detail-body p { color: var(--text); line-height: 1.5; }
  .season-picker { display: grid; gap: 10px; }
  .season-picker > strong { color: var(--text); }
  .season { display: inline-flex; gap: 6px; align-items: center; padding: 7px 10px; background: var(--surface-2); border-radius: var(--radius-sm); color: var(--text); font-size: var(--text-sm); }
  @media (max-width: 580px) { .summary { grid-template-columns: repeat(2, minmax(0, 1fr)); } .request-row, .detail-body { display: grid; } .detail-body > img { width: 135px; } }
</style>
