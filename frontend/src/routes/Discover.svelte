<script>
  import { onMount } from 'svelte';
  import { api } from '../lib/api.js';
  import { posterUrl, errorMessage } from '../lib/radarr.js';
  import AddMovie from './AddMovie.svelte';

  let movies = $state([]);
  let query = $state('');
  let filter = $state('all');
  let selected = $state(null);
  let loading = $state(true);
  let error = $state('');
  const visible = $derived(movies.filter((movie) => {
    if (movie.isExisting || movie.isExcluded) return false;
    if (filter !== 'all' && !movie[filter]) return false;
    return `${movie.title} ${movie.year || ''}`.toLowerCase().includes(query.toLowerCase());
  }));

  async function load() {
    loading = true;
    try {
      movies = await api.proxy.get('radarr', '/api/v3/importlist/movie', { includeRecommendations: true, includeTrending: true, includePopular: true });
      error = '';
    } catch (cause) { error = errorMessage(cause); }
    finally { loading = false; }
  }

  onMount(load);
  function added() {
    movies = movies.map((movie) => movie.tmdbId === selected?.tmdbId ? { ...movie, isExisting: true } : movie);
    selected = null;
  }
</script>

<div class="rad-page">
  <header class="rad-head"><div><h1>Discover movies</h1><p>Recommendations and import list suggestions from Radarr</p></div><div class="rad-actions"><input class="rad-input" type="search" bind:value={query} placeholder="Filter movies" aria-label="Filter discovered movies" /><button class="rad-button" onclick={load} disabled={loading}>Refresh</button></div></header>
  {#if error}<p class="rad-error" role="alert">{error}</p>{/if}
  <div class="rad-actions"><button class="rad-button" class:primary={filter === 'all'} onclick={() => filter = 'all'}>All</button><button class="rad-button" class:primary={filter === 'isRecommendation'} onclick={() => filter = 'isRecommendation'}>Recommended</button><button class="rad-button" class:primary={filter === 'isTrending'} onclick={() => filter = 'isTrending'}>Trending</button><button class="rad-button" class:primary={filter === 'isPopular'} onclick={() => filter = 'isPopular'}>Popular</button><span class="rad-muted">{visible.length} movies</span></div>
  {#if loading && movies.length === 0}<p class="rad-muted">Loading suggestions…</p>{:else if !visible.length}<p class="rad-empty">No suggestions match this filter.</p>{:else}<div class="discover-grid">{#each visible as movie (movie.tmdbId)}<article class="discover-card"><div class="cover">{#if posterUrl(movie)}<img src={posterUrl(movie)} alt={`${movie.title} poster`} loading="lazy" />{:else}<span>{movie.title?.slice(0, 1)}</span>{/if}</div><div class="info"><strong>{movie.title}</strong><span>{movie.year || '—'} · {movie.genres?.slice(0, 2).join(', ') || 'Movie'}</span><button class="rad-button primary" onclick={() => selected = movie}>Add movie</button></div></article>{/each}</div>{/if}
</div>

{#if selected}<AddMovie initialMovie={selected} existingIds={new Set(movies.filter((movie) => movie.isExisting).map((movie) => movie.tmdbId))} onClose={() => selected = null} onAdded={added} />{/if}

<style>
  .discover-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(165px, 1fr)); gap: 14px; }
  .discover-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg); overflow: hidden; display: flex; flex-direction: column; }
  .cover { aspect-ratio: 2 / 3; background: var(--surface-2); display: grid; place-items: center; color: var(--text-faint); font-size: 36px; }
  .cover img { width: 100%; height: 100%; object-fit: cover; }
  .info { display: grid; gap: 7px; padding: 12px; flex: 1; align-content: start; }
  .info strong { color: var(--text); font-size: var(--text-sm); line-height: 1.3; }
  .info span { color: var(--text-muted); font-size: var(--text-xs); }
  .info button { margin-top: auto; }
</style>
