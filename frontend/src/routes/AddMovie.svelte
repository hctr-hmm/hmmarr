<script>
  import { onMount, onDestroy, untrack } from 'svelte';
  import { api } from '../lib/api.js';
  import { posterUrl, errorMessage } from '../lib/radarr.js';

  let { existingIds = new Set(), initialMovie = null, onClose, onAdded } = $props();
  let term = $state('');
  let results = $state([]);
  let selected = $state(untrack(() => initialMovie));
  let roots = $state([]);
  let profiles = $state([]);
  let rootFolderPath = $state('');
  let qualityProfileId = $state('');
  let minimumAvailability = $state('released');
  let monitored = $state(true);
  let searchForMovie = $state(true);
  let loading = $state(false);
  let saving = $state(false);
  let error = $state('');
  let timer;
  let requestNumber = 0;

  onMount(async () => {
    try {
      [roots, profiles] = await Promise.all([
        api.proxy.get('radarr', '/api/v3/rootfolder'),
        api.proxy.get('radarr', '/api/v3/qualityprofile')
      ]);
      rootFolderPath = roots.find((root) => root.accessible)?.path || roots[0]?.path || '';
      qualityProfileId = String(profiles[0]?.id || '');
    } catch (cause) { error = `Could not load Radarr settings: ${errorMessage(cause)}`; }
  });
  onDestroy(() => clearTimeout(timer));

  async function lookup() {
    const value = term.trim();
    if (value.length < 2) { results = []; return; }
    const current = ++requestNumber;
    loading = true;
    error = '';
    try {
      const found = await api.proxy.get('radarr', '/api/v3/movie/lookup', { term: value });
      if (current === requestNumber) results = found;
    } catch (cause) { if (current === requestNumber) error = errorMessage(cause); }
    finally { if (current === requestNumber) loading = false; }
  }

  function scheduleLookup() {
    clearTimeout(timer);
    timer = setTimeout(lookup, 350);
  }

  function choose(movie) {
    selected = movie;
    minimumAvailability = movie.minimumAvailability || 'released';
    error = '';
  }

  async function addMovie() {
    if (!selected || !rootFolderPath || !qualityProfileId) { error = 'Choose a root folder and quality profile.'; return; }
    saving = true;
    error = '';
    try {
      const added = await api.proxy.post('radarr', '/api/v3/movie', {
        ...selected,
        id: 0,
        rootFolderPath,
        qualityProfileId: Number(qualityProfileId),
        minimumAvailability,
        monitored,
        addOptions: { searchForMovie }
      });
      onAdded(added);
    } catch (cause) { error = errorMessage(cause); }
    finally { saving = false; }
  }
</script>

<div class="rad-modal-backdrop" role="presentation" onclick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
  <div class="rad-modal" role="dialog" aria-modal="true" aria-label="Add movie">
    <div class="rad-modal-head">
      <div><h2>Add movie</h2><p class="rad-muted">Search Radarr’s movie database, then choose how to add it.</p></div>
      <button class="rad-button" onclick={onClose} aria-label="Close">Close</button>
    </div>
    {#if error}<p class="rad-error" role="alert">{error}</p>{/if}
    {#if selected}
      <div class="picked">
        {#if posterUrl(selected)}<img src={posterUrl(selected)} alt="" />{/if}
        <div><h3>{selected.title} <span class="rad-muted">({selected.year})</span></h3><p>{selected.overview || 'No overview available.'}</p></div>
      </div>
      <div class="rad-fields">
        <label class="rad-field">Root folder
          <select class="rad-select" bind:value={rootFolderPath}>
            {#each roots as root}<option value={root.path}>{root.path}{root.accessible ? '' : ' (unavailable)'}</option>{/each}
          </select>
        </label>
        <label class="rad-field">Quality profile
          <select class="rad-select" bind:value={qualityProfileId}>
            {#each profiles as profile}<option value={String(profile.id)}>{profile.name}</option>{/each}
          </select>
        </label>
        <label class="rad-field">Minimum availability
          <select class="rad-select" bind:value={minimumAvailability}>
            <option value="announced">Announced</option><option value="inCinemas">In cinemas</option>
            <option value="released">Released</option>
          </select>
        </label>
      </div>
      <div class="rad-actions">
        <label class="rad-check"><input type="checkbox" bind:checked={monitored} /> Monitor movie</label>
        <label class="rad-check"><input type="checkbox" bind:checked={searchForMovie} /> Search after adding</label>
      </div>
      <div class="rad-actions"><button class="rad-button primary" onclick={addMovie} disabled={saving || !rootFolderPath || !qualityProfileId}>{saving ? 'Adding…' : 'Add to Radarr'}</button><button class="rad-button" onclick={() => selected = null}>Back to results</button></div>
    {:else}
      <div class="rad-toolbar"><input class="rad-input search" type="search" bind:value={term} oninput={scheduleLookup} onkeydown={(event) => { if (event.key === 'Enter') { clearTimeout(timer); lookup(); } }} placeholder="Title, IMDb ID, or TMDB ID" aria-label="Search for a movie" /><button class="rad-button" onclick={lookup} disabled={loading}>Search</button></div>
      {#if loading}<p class="rad-muted">Searching…</p>{/if}
      {#if !loading && term.trim().length >= 2 && results.length === 0}<p class="rad-empty">No movies found.</p>{/if}
      <div class="results">
        {#each results as movie (movie.tmdbId)}
          <div class="result">
            {#if posterUrl(movie)}<img src={posterUrl(movie, 'small')} alt="" loading="lazy" />{:else}<span class="placeholder">{movie.title?.slice(0, 1)}</span>{/if}
            <div class="rad-row-main"><strong class="rad-row-title">{movie.title} ({movie.year || '—'})</strong><span class="rad-row-meta">{movie.overview || 'No overview available.'}</span></div>
            {#if existingIds.has(movie.tmdbId) || movie.id > 0}<span class="rad-badge good">In library</span>{:else}<button class="rad-button" onclick={() => choose(movie)}>Select</button>{/if}
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>

<style>
  .search { flex: 1; min-width: 200px; }
  .results { display: grid; gap: 8px; max-height: 54dvh; overflow: auto; }
  .result { display: flex; align-items: center; gap: 12px; border: 1px solid var(--border); border-radius: var(--radius-md); padding: 8px; min-width: 0; }
  .result img, .placeholder { width: 48px; height: 72px; object-fit: cover; border-radius: 3px; flex-shrink: 0; background: var(--surface-2); }
  .placeholder { display: grid; place-items: center; color: var(--text-faint); font-size: 22px; }
  .result .rad-row-main { flex: 1; }
  .result .rad-row-meta { display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  .picked { display: flex; gap: 16px; }
  .picked img { width: 100px; height: 150px; object-fit: cover; border-radius: var(--radius-md); flex-shrink: 0; }
  .picked h3 { color: var(--text); font-size: var(--text-lg); }
  .picked p { color: var(--text-muted); font-size: var(--text-sm); margin-top: 8px; line-height: 1.5; max-height: 150px; overflow: auto; }
</style>
