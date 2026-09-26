<script>
  import { onMount, onDestroy } from 'svelte';
  import { api } from '../lib/api.js';
  import { errorMessage } from '../lib/radarr.js';
  import { seriesPosterUrl } from '../lib/sonarr.js';

  let { existingIds = new Set(), onClose, onAdded } = $props();
  let term = $state('');
  let results = $state([]);
  let selected = $state(null);
  let profiles = $state([]);
  let roots = $state([]);
  let qualityProfileId = $state('');
  let rootFolderPath = $state('');
  let monitor = $state('all');
  let monitorNewItems = $state('all');
  let seasonFolder = $state(true);
  let searchAfterAdd = $state(true);
  let loading = $state(false);
  let saving = $state(false);
  let error = $state('');
  let timer;
  let requestNumber = 0;

  onMount(async () => {
    try {
      [profiles, roots] = await Promise.all([
        api.proxy.get('sonarr', '/api/v3/qualityprofile'),
        api.proxy.get('sonarr', '/api/v3/rootfolder'),
      ]);
      qualityProfileId = String(profiles[0]?.id || '');
      rootFolderPath = roots.find((root) => root.accessible)?.path || roots[0]?.path || '';
    } catch (cause) { error = `Could not load Sonarr settings: ${errorMessage(cause)}`; }
  });
  onDestroy(() => clearTimeout(timer));

  async function lookup() {
    const value = term.trim();
    if (value.length < 2) { results = []; return; }
    const current = ++requestNumber;
    loading = true; error = '';
    try {
      const found = await api.proxy.get('sonarr', '/api/v3/series/lookup', { term: value });
      if (current === requestNumber) results = found;
    } catch (cause) { if (current === requestNumber) error = errorMessage(cause); }
    finally { if (current === requestNumber) loading = false; }
  }

  function scheduleLookup() { clearTimeout(timer); timer = setTimeout(lookup, 400); }

  async function addSeries() {
    if (!selected || !rootFolderPath || !qualityProfileId) { error = 'Choose a root folder and quality profile.'; return; }
    saving = true; error = '';
    try {
      const added = await api.proxy.post('sonarr', '/api/v3/series', {
        ...selected,
        id: 0,
        rootFolderPath,
        qualityProfileId: Number(qualityProfileId),
        monitored: monitor !== 'none',
        monitorNewItems,
        seasonFolder,
        addOptions: { monitor, searchForMissingEpisodes: searchAfterAdd },
      });
      onAdded(added);
    } catch (cause) { error = errorMessage(cause); }
    finally { saving = false; }
  }
</script>

<div class="rad-modal-backdrop" role="presentation" onclick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
  <div class="rad-modal" role="dialog" aria-modal="true" aria-label="Add series">
    <div class="rad-modal-head"><div><h2>Add series</h2><p class="rad-muted">Find a show and choose how Sonarr should monitor it.</p></div><button class="rad-button" onclick={onClose}>Close</button></div>
    {#if error}<p class="rad-error" role="alert">{error}</p>{/if}
    {#if selected}
      <div class="picked">
        {#if seriesPosterUrl(selected)}<img src={seriesPosterUrl(selected)} alt="" />{/if}
        <div><h3>{selected.title} <span class="rad-muted">({selected.year || '—'})</span></h3><p>{selected.overview || 'No overview available.'}</p></div>
      </div>
      <div class="rad-fields">
        <label class="rad-field">Root folder<select class="rad-select" bind:value={rootFolderPath}>{#each roots as root}<option value={root.path}>{root.path}{root.accessible ? '' : ' (unavailable)'}</option>{/each}</select></label>
        <label class="rad-field">Quality profile<select class="rad-select" bind:value={qualityProfileId}>{#each profiles as profile}<option value={String(profile.id)}>{profile.name}</option>{/each}</select></label>
        <label class="rad-field">Monitor episodes<select class="rad-select" bind:value={monitor}><option value="all">All episodes</option><option value="future">Future episodes</option><option value="missing">Missing episodes</option><option value="none">None</option></select></label>
        <label class="rad-field">New seasons<select class="rad-select" bind:value={monitorNewItems}><option value="all">Monitor automatically</option><option value="none">Do not monitor</option></select></label>
      </div>
      <div class="rad-actions"><label class="rad-check"><input type="checkbox" bind:checked={seasonFolder} /> Use season folders</label><label class="rad-check"><input type="checkbox" bind:checked={searchAfterAdd} /> Search after adding</label></div>
      <div class="rad-actions"><button class="rad-button primary" onclick={addSeries} disabled={saving || !rootFolderPath || !qualityProfileId}>{saving ? 'Adding…' : 'Add to Sonarr'}</button><button class="rad-button" onclick={() => selected = null}>Back to results</button></div>
    {:else}
      <div class="rad-toolbar"><input class="rad-input search" type="search" bind:value={term} oninput={scheduleLookup} onkeydown={(event) => { if (event.key === 'Enter') { clearTimeout(timer); lookup(); } }} placeholder="Series title or TVDB ID" aria-label="Search for a series" /><button class="rad-button" onclick={lookup} disabled={loading}>Search</button></div>
      {#if loading}<p class="rad-muted">Searching…</p>{:else if term.trim().length >= 2 && !results.length}<p class="rad-empty">No series found.</p>{/if}
      <div class="results">{#each results as item (item.tvdbId)}<div class="result">
        {#if seriesPosterUrl(item)}<img src={seriesPosterUrl(item)} alt="" loading="lazy" />{:else}<span class="placeholder">{item.title?.slice(0, 1)}</span>{/if}
        <div class="rad-row-main"><strong class="rad-row-title">{item.title} ({item.year || '—'})</strong><span class="rad-row-meta">{item.network || item.seriesType || 'Series'} · {item.overview || 'No overview available.'}</span></div>
        {#if existingIds.has(item.tvdbId) || item.id > 0}<span class="rad-badge good">In library</span>{:else}<button class="rad-button" onclick={() => selected = item}>Select</button>{/if}
      </div>{/each}</div>
    {/if}
  </div>
</div>

<style>
  .search { flex: 1; min-width: 180px; }
  .picked { display: flex; gap: 16px; }
  .picked img { width: 100px; height: 150px; object-fit: cover; border-radius: var(--radius-md); flex-shrink: 0; }
  .picked h3 { color: var(--text); }
  .picked p { color: var(--text-muted); font-size: var(--text-sm); line-height: 1.5; margin-top: 8px; }
  .results { display: grid; gap: 8px; max-height: 55dvh; overflow: auto; }
  .result { display: flex; align-items: center; gap: 12px; border: 1px solid var(--border); border-radius: var(--radius-md); padding: 8px; min-width: 0; }
  .result img, .placeholder { width: 48px; height: 72px; object-fit: cover; border-radius: 3px; flex-shrink: 0; background: var(--surface-2); }
  .placeholder { display: grid; place-items: center; color: var(--text-faint); font-size: 22px; }
  .result .rad-row-main { flex: 1; }
  .result .rad-row-meta { display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
</style>
