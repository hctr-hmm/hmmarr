<script>
  import { onMount } from 'svelte';
  import { api } from '../lib/api.js';
  import { posterUrl } from '../lib/radarr.js';
  import AddMovie from './AddMovie.svelte';
  import MovieDetail from './MovieDetail.svelte';
  import BulkEdit from './BulkEdit.svelte';

  const FILTER_MODES = [
    { id: 'all', label: 'All' },
    { id: 'downloaded', label: 'Downloaded' },
    { id: 'missing', label: 'Missing' },
    { id: 'monitored', label: 'Monitored' },
    { id: 'unmonitored', label: 'Unmonitored' },
  ];

  const SORT_MODES = [
    { id: 'title', label: 'Title A–Z' },
    { id: 'added', label: 'Recently added' },
    { id: 'year', label: 'Newest' },
    { id: 'size', label: 'Largest' },
  ];

  let movies = $state([]);
  let loading = $state(true);
  let error = $state('');
  let query = $state('');
  let filter = $state('all');
  let sort = $state('title');
  /** movie ids with an in-flight toggle so the switch can spin */
  let toggling = $state(new Set());
  let showAdd = $state(false);
  let selectedMovie = $state(null);
  let actionError = $state('');
  let selectionMode = $state(false);
  let selected = $state(new Set());
  let showBulk = $state(false);

  async function loadMovies() {
    loading = true;
    error = '';
    try {
      movies = await api.proxy.get('radarr', '/api/v3/movie');
    } catch (err) {
      error = err.status === 404
        ? 'Radarr is not configured.'
        : `Could not reach Radarr (${err.message || 'offline'}).`;
      movies = [];
    } finally {
      loading = false;
    }
  }

  onMount(loadMovies);

  const counts = $derived.by(() => {
    const c = { total: movies.length, downloaded: 0, missing: 0, bytes: 0 };
    for (const m of movies) {
      if (m.hasFile) c.downloaded += 1;
      else if (m.monitored) c.missing += 1;
      c.bytes += m.sizeOnDisk || 0;
    }
    return c;
  });

  const visible = $derived.by(() => {
    const q = query.trim().toLowerCase();
    let list = movies.filter((m) => {
      if (q && !`${m.title} ${m.year ?? ''}`.toLowerCase().includes(q)) return false;
      switch (filter) {
        case 'downloaded': return m.hasFile;
        case 'missing': return !m.hasFile && m.monitored;
        case 'monitored': return m.monitored;
        case 'unmonitored': return !m.monitored;
        default: return true;
      }
    });
    const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
    switch (sort) {
      case 'title': list.sort((a, b) => collator.compare(a.sortTitle || a.title, b.sortTitle || b.title)); break;
      case 'added': list.sort((a, b) => (b.added || '').localeCompare(a.added || '')); break;
      case 'year': list.sort((a, b) => (b.year || 0) - (a.year || 0)); break;
      case 'size': list.sort((a, b) => (b.sizeOnDisk || 0) - (a.sizeOnDisk || 0)); break;
    }
    return list;
  });

  async function toggleMonitored(movie) {
    if (toggling.has(movie.id)) return;
    toggling = new Set(toggling).add(movie.id);
    try {
      const updated = await api.proxy.put('radarr', `/api/v3/movie/${movie.id}`, { ...movie, monitored: !movie.monitored });
      movies = movies.map((m) => (m.id === movie.id ? { ...m, ...updated, monitored: updated.monitored } : m));
    } catch (cause) {
      actionError = `Could not update ${movie.title}: ${cause.message || 'request failed'}`;
    } finally {
      const next = new Set(toggling);
      next.delete(movie.id);
      toggling = next;
    }
  }

  function fmtBytes(bytes) {
    if (!bytes) return '0 GB';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let v = bytes, u = 0;
    while (v >= 1024 && u < units.length - 1) { v /= 1024; u++; }
    return `${v.toFixed(v >= 100 || u < 2 ? 0 : 1)} ${units[u]}`;
  }

  function qualityLabel(movie) {
    return movie.movieFile?.quality?.quality?.name ?? null;
  }

  const STATUS_LABEL = {
    tba: 'TBA', announced: 'Announced', inCinemas: 'In cinemas',
    released: 'Released', deleted: 'Deleted',
  };

  function movieAdded() {
    showAdd = false;
    loadMovies();
  }

  function movieUpdated(movie) {
    movies = movies.map((item) => item.id === movie.id ? movie : item);
    selectedMovie = movie;
  }

  function movieDeleted(id) {
    movies = movies.filter((item) => item.id !== id);
    selectedMovie = null;
  }

  function toggleSelected(id) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    selected = next;
  }

  function finishBulkEdit() {
    showBulk = false;
    selectionMode = false;
    selected = new Set();
    loadMovies();
  }
</script>

<div class="page">
  <header class="page-head">
    <div>
      <h1 class="title">Movies</h1>
      <p class="subtitle">
        {#if loading && !movies.length}
          Loading library…
        {:else if error}
          {error}
        {:else}
          {counts.total} movies · {counts.downloaded} downloaded
          {#if counts.missing} · <span class="warn">{counts.missing} missing</span>{/if}
          · {fmtBytes(counts.bytes)}
        {/if}
      </p>
    </div>
    <div class="rad-actions"><button class="rad-button primary" onclick={() => showAdd = true}>Add movie</button><button class="rad-button" onclick={() => { selectionMode = !selectionMode; selected = new Set(); }}>{selectionMode ? 'Cancel selection' : 'Select movies'}</button><button class="refresh-btn" onclick={loadMovies} disabled={loading} aria-label="Refresh library">
      <svg class:spinning={loading} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
      </svg>
      <span>{loading ? 'Refreshing…' : 'Refresh'}</span>
    </button></div>
  </header>

  {#if actionError}<p class="rad-error" role="alert">{actionError} <button class="dismiss" onclick={() => actionError = ''}>Dismiss</button></p>{/if}
  {#if selectionMode}<div class="rad-actions bulk-bar"><span class="rad-muted">{selected.size} selected</span><button class="rad-button" onclick={() => selected = new Set(visible.map((movie) => movie.id))}>Select visible</button><button class="rad-button" onclick={() => selected = new Set()}>Clear</button><button class="rad-button primary" onclick={() => showBulk = true} disabled={!selected.size}>Edit selected</button></div>{/if}

  <div class="toolbar" class:gone={error && !movies.length}>
    <div class="search-wrap">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
      <input
        type="search"
        bind:value={query}
        placeholder="Search title or year…"
        aria-label="Search movies"
      />
    </div>
    <div class="selects">
      <select bind:value={filter} aria-label="Filter">
        {#each FILTER_MODES as m (m.id)}<option value={m.id}>{m.label}</option>{/each}
      </select>
      <select bind:value={sort} aria-label="Sort">
        {#each SORT_MODES as m (m.id)}<option value={m.id}>{m.label}</option>{/each}
      </select>
    </div>
  </div>

  {#if error && !movies.length}
    <div class="empty-state">
      <p class="empty-title">Radarr unavailable</p>
      <p class="empty-hint">{error}</p>
      <button class="retry-btn" onclick={loadMovies}>Try again</button>
    </div>
  {:else if !loading && visible.length === 0}
    <div class="empty-state">
      <p class="empty-title">{query || filter !== 'all' ? 'No matches' : 'No movies yet'}</p>
      <p class="empty-hint">
        {query || filter !== 'all' ? 'Try a different search or filter.' : 'Add movies in Radarr and they will appear here.'}
      </p>
    </div>
  {:else if loading && !movies.length}
    <div class="grid">
      {#each Array(12) as _}
        <div class="card skeleton"><div class="poster"></div><div class="line"></div><div class="line short"></div></div>
      {/each}
    </div>
  {:else}
    <div class="grid" aria-busy={loading}>
      {#each visible as movie (movie.id)}
        <article class="card" class:unmonitored={!movie.monitored}>
          {#if selectionMode}<label class="select-check"><input type="checkbox" checked={selected.has(movie.id)} onchange={() => toggleSelected(movie.id)} aria-label={`Select ${movie.title}`} /></label>{/if}
          <button class="poster-wrap poster-button" onclick={() => selectedMovie = movie} aria-label={`View ${movie.title} details`}>
            {#if posterUrl(movie)}
              <img class="poster" src={posterUrl(movie)} alt="{movie.title} poster" loading="lazy" decoding="async" />
            {:else}
              <div class="poster blank">{movie.title.slice(0, 1)}</div>
            {/if}

            <span class="stat-chip" class:ok={movie.hasFile} class:pending={!movie.hasFile && movie.monitored} class:off={!movie.hasFile && !movie.monitored}>
              {#if movie.hasFile}
                {qualityLabel(movie) ?? 'Downloaded'}
              {:else if movie.monitored}
                {movie.isAvailable ? 'Missing' : (STATUS_LABEL[movie.status] ?? 'Missing')}
              {:else}
                Not monitored
              {/if}
            </span>

            {#if movie.sizeOnDisk}
              <span class="size-chip">{fmtBytes(movie.sizeOnDisk)}</span>
            {/if}
          </button>

          <div class="card-body">
            <h2 class="movie-title" title={movie.title}><button class="title-button" onclick={() => selectedMovie = movie}>{movie.title}</button></h2>
            <div class="movie-meta">
              <span>{movie.year ?? '—'}</span>
              {#if movie.ratings?.tmdb?.value}
                <span class="rating" title="TMDB">{movie.ratings.tmdb.value.toFixed(1)}</span>
              {/if}
              {#if movie.runtime}<span>{movie.runtime} min</span>{/if}
            </div>
          </div>

          <button
            class="mon-toggle"
            class:on={movie.monitored}
            onclick={() => toggleMonitored(movie)}
            disabled={toggling.has(movie.id)}
            aria-pressed={movie.monitored}
            title={movie.monitored ? 'Monitored — click to unmonitor' : 'Unmonitored — click to monitor'}
          >
            <span class="track"><span class="thumb"></span></span>
            <span class="toggle-label">{movie.monitored ? 'Monitored' : 'Monitor'}</span>
          </button>
        </article>
      {/each}
    </div>
  {/if}
</div>

{#if showAdd}<AddMovie existingIds={new Set(movies.map((movie) => movie.tmdbId))} onClose={() => showAdd = false} onAdded={movieAdded} />{/if}
{#if selectedMovie}<MovieDetail movie={selectedMovie} onClose={() => selectedMovie = null} onUpdated={movieUpdated} onDeleted={movieDeleted} />{/if}
{#if showBulk}<BulkEdit movieIds={[...selected]} onClose={() => showBulk = false} onSaved={finishBulkEdit} />{/if}

<style>
  .bulk-bar { padding: 10px 12px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-md); }
  .select-check { position: absolute; z-index: 2; top: 8px; right: 8px; display: grid; place-items: center; width: 28px; height: 28px; background: var(--surface); border-radius: var(--radius-sm); }
  .select-check input { accent-color: var(--accent); width: 17px; height: 17px; }
  .poster-button { width: 100%; padding: 0; border: 0; text-align: left; color: inherit; cursor: pointer; }
  .title-button { border: 0; background: none; padding: 0; color: inherit; font: inherit; text-align: left; }
  .title-button:hover { color: var(--accent); }
  .dismiss { color: inherit; border: 0; background: none; text-decoration: underline; margin-left: 8px; }
  .page {
    max-width: 1200px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
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
  .warn { color: var(--orange); }

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
    transition: color var(--trans), border-color var(--trans);
    flex-shrink: 0;
  }
  .refresh-btn:hover:not(:disabled) { color: var(--accent); border-color: color-mix(in oklch, var(--accent) 40%, transparent); }
  .refresh-btn:disabled { opacity: 0.55; cursor: default; }

  @keyframes spin { to { transform: rotate(360deg); } }
  .spinning { animation: spin 0.8s linear infinite; }

  /* Toolbar */
  .toolbar {
    display: flex;
    gap: var(--space-3);
    flex-wrap: wrap;
  }
  .toolbar.gone { display: none; }

  .search-wrap {
    flex: 1;
    min-width: 200px;
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: 0 var(--space-3);
    background: var(--surface-2);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-md);
    color: var(--text-faint);
    transition: border-color var(--trans), box-shadow var(--trans);
  }
  .search-wrap:focus-within {
    border-color: var(--accent);
    box-shadow: 0 0 0 2px color-mix(in oklch, var(--accent) 20%, transparent);
  }
  .search-wrap input {
    flex: 1;
    background: none;
    border: none;
    outline: none;
    padding: var(--space-2) 0;
    font-size: var(--text-sm);
    color: var(--text);
  }
  .search-wrap input::placeholder { color: var(--text-faint); }
  .search-wrap input::-webkit-search-cancel-button { display: none; }

  .selects { display: flex; gap: var(--space-2); }
  select {
    appearance: none;
    background: var(--surface-2);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-md);
    color: var(--text);
    font-size: var(--text-sm);
    font-weight: 500;
    padding: var(--space-2) var(--space-6) var(--space-2) var(--space-3);
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%235c6773' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right var(--space-2) center;
    cursor: pointer;
  }
  select:hover { border-color: var(--border); }

  /* Grid */
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(158px, 1fr));
    gap: var(--space-4);
  }

  .card {
    position: relative;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    overflow: hidden;
    display: flex;
    flex-direction: column;
    transition: border-color var(--trans), transform var(--trans);
  }
  .card:hover { border-color: var(--border-subtle); }
  .card.unmonitored .poster-wrap { filter: grayscale(0.85) brightness(0.75); }

  .poster-wrap { position: relative; aspect-ratio: 2 / 3; }
  .poster {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
    background: var(--surface-2);
  }
  .poster.blank {
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 3rem;
    font-weight: 700;
    color: var(--text-faint);
    background: var(--surface-2);
  }

  .stat-chip, .size-chip {
    position: absolute;
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.02em;
    padding: 2px var(--space-2);
    border-radius: 999px;
    backdrop-filter: blur(6px);
    -webkit-backdrop-filter: blur(6px);
  }
  .stat-chip { top: var(--space-2); left: var(--space-2); }
  .stat-chip.ok {
    background: color-mix(in oklch, var(--green) 22%, oklch(0 0 0 / 0.55));
    color: var(--green);
  }
  .stat-chip.pending {
    background: color-mix(in oklch, var(--orange) 22%, oklch(0 0 0 / 0.55));
    color: var(--orange);
  }
  .stat-chip.off {
    background: oklch(0 0 0 / 0.55);
    color: var(--text-muted);
  }
  .size-chip {
    bottom: var(--space-2);
    right: var(--space-2);
    background: oklch(0 0 0 / 0.6);
    color: var(--text);
  }

  .card-body {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: var(--space-3) var(--space-3) var(--space-2);
    flex: 1;
  }
  .movie-title {
    font-size: var(--text-sm);
    font-weight: 600;
    color: var(--text);
    line-height: 1.3;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .movie-meta {
    display: flex;
    gap: var(--space-2);
    font-size: var(--text-xs);
    color: var(--text-muted);
  }
  .rating { color: var(--accent); font-weight: 600; }

  /* Monitored toggle */
  .mon-toggle {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    margin: 0 var(--space-3) var(--space-3);
    padding: var(--space-1) 0;
    background: none;
    border: none;
    color: var(--text-faint);
    font-size: var(--text-xs);
    font-weight: 500;
    transition: color var(--trans);
  }
  .mon-toggle:hover:not(:disabled) .toggle-label { color: var(--text); }
  .mon-toggle:disabled { opacity: 0.5; cursor: wait; }

  .track {
    position: relative;
    width: 26px;
    height: 14px;
    border-radius: 999px;
    background: var(--surface-3);
    border: 1px solid var(--border-subtle);
    transition: background var(--trans), border-color var(--trans);
    flex-shrink: 0;
  }
  .thumb {
    position: absolute;
    top: 1px;
    left: 1px;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--text-muted);
    transition: left var(--trans), background var(--trans);
  }
  .mon-toggle.on .track {
    background: var(--accent-dim);
    border-color: color-mix(in oklch, var(--accent) 45%, transparent);
  }
  .mon-toggle.on .thumb { left: 13px; background: var(--accent); }
  .mon-toggle.on .toggle-label { color: var(--accent); }

  /* Empty / error state */
  .empty-state {
    border: 1px dashed var(--border-subtle);
    border-radius: var(--radius-lg);
    background: color-mix(in oklch, var(--surface) 60%, transparent);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-16) var(--space-6);
    text-align: center;
  }
  .empty-title { font-size: var(--text-sm); font-weight: 600; color: var(--text-muted); }
  .empty-hint { font-size: var(--text-xs); color: var(--text-faint); }
  .retry-btn {
    margin-top: var(--space-2);
    padding: var(--space-2) var(--space-4);
    background: var(--accent);
    color: var(--accent-ink);
    font-size: var(--text-sm);
    font-weight: 600;
    border: none;
    border-radius: var(--radius-md);
    transition: background var(--trans);
  }
  .retry-btn:hover { background: var(--accent-hover); }

  /* Skeletons */
  .skeleton .poster { aspect-ratio: 2 / 3; width: 100%; }
  .skeleton .line {
    height: 12px;
    margin: var(--space-3) var(--space-3) 0;
    border-radius: var(--radius-sm);
    background: var(--surface-2);
  }
  .skeleton .line.short { width: 50%; margin-bottom: var(--space-3); }
  .skeleton .poster, .skeleton .line {
    background: linear-gradient(90deg, var(--surface-2) 25%, var(--surface-3) 50%, var(--surface-2) 75%);
    background-size: 200% 100%;
    animation: shimmer 1.4s linear infinite;
  }
  @keyframes shimmer { to { background-position: -200% 0; } }

  @media (max-width: 560px) {
    .grid { grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: var(--space-3); }
    .page-head { flex-direction: column; align-items: stretch; gap: var(--space-3); }
  }
  .page { max-width: 1240px; gap: 22px; }
  .title { font-weight: 650; letter-spacing: -.025em; }
  .subtitle { margin-top: 7px; line-height: 1.5; }
  .refresh-btn { min-height: 40px; padding: 9px 12px; background: var(--surface-2); color: var(--text); font-weight: 650; border-color: var(--border); }
  .toolbar { padding: 12px; border: 1px solid var(--border); border-radius: 14px; background: var(--surface); }
  .search-wrap { min-height: 42px; background: var(--surface-2); color: var(--text-muted); border-color: var(--border); }
  .search-wrap input { min-height: 40px; }
  select { min-height: 42px; border-color: var(--border); background-color: var(--surface-2); }
  .grid { grid-template-columns: repeat(auto-fill, minmax(176px, 1fr)); gap: 18px; }
  .card { border-radius: var(--radius-md); box-shadow: none; }
  .card:hover { transform: none; border-color: var(--border-subtle); box-shadow: none; }
  .poster-wrap { overflow: hidden; }
  .poster { transition: none; }
  .card-body { gap: 5px; padding: 12px 13px 9px; }
  .movie-title { font-weight: 600; }
  .movie-meta { gap: 10px; }
  .mon-toggle { margin: 0 13px 12px; }
  .empty-title { color: var(--text); font-size: var(--text-lg); }
  .empty-hint { color: var(--text-muted); font-size: var(--text-sm); }
  @media (max-width: 560px) { .grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; } .toolbar { padding: 10px; } .selects { flex: 1; } .selects select { min-width: 0; flex: 1; } }
</style>
