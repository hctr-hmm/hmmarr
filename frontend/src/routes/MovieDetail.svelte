<script>
  import { onMount, untrack } from 'svelte';
  import { api } from '../lib/api.js';
  import { posterUrl, formatBytes, formatDate, errorMessage } from '../lib/radarr.js';

  let { movie, onClose, onUpdated, onDeleted } = $props();
  let current = $state(untrack(() => movie));
  let profiles = $state([]);
  let roots = $state([]);
  let tags = $state([]);
  let profileId = $state(untrack(() => String(movie.qualityProfileId || '')));
  let rootFolderPath = $state(untrack(() => movie.rootFolderPath || ''));
  let minimumAvailability = $state(untrack(() => movie.minimumAvailability || 'released'));
  let monitored = $state(untrack(() => Boolean(movie.monitored)));
  let selectedTags = $state(untrack(() => [...(movie.tags || [])]));
  let deleteFiles = $state(false);
  let addImportExclusion = $state(false);
  let busy = $state('');
  let error = $state('');
  let notice = $state('');
  let releases = $state(null);
  let history = $state(null);
  let tab = $state('details');

  onMount(async () => {
    try {
      const [fresh, availableProfiles, availableRoots, availableTags] = await Promise.all([
        api.proxy.get('radarr', `/api/v3/movie/${movie.id}`),
        api.proxy.get('radarr', '/api/v3/qualityprofile'),
        api.proxy.get('radarr', '/api/v3/rootfolder'),
        api.proxy.get('radarr', '/api/v3/tag')
      ]);
      current = fresh;
      profiles = availableProfiles;
      roots = availableRoots;
      tags = availableTags;
      profileId = String(fresh.qualityProfileId || '');
      rootFolderPath = fresh.rootFolderPath || '';
      minimumAvailability = fresh.minimumAvailability || 'released';
      monitored = Boolean(fresh.monitored);
      selectedTags = [...(fresh.tags || [])];
    } catch (cause) { error = errorMessage(cause); }
  });

  async function save() {
    busy = 'save'; error = ''; notice = '';
    try {
      const moving = rootFolderPath !== current.rootFolderPath;
      if (moving && !confirm(`Move ${current.title} to ${rootFolderPath}? Radarr will move its files.`)) { busy = ''; return; }
      const folder = current.folderName || current.path?.split('/').filter(Boolean).at(-1) || `${current.title} (${current.year})`;
      const updated = await api.proxy.put('radarr', `/api/v3/movie/${current.id}`, {
        ...current,
        qualityProfileId: Number(profileId), rootFolderPath, minimumAvailability, monitored, tags: selectedTags,
        ...(moving ? { path: `${rootFolderPath.replace(/\/$/, '')}/${folder}` } : {})
      }, moving ? { moveFiles: true } : undefined);
      current = updated;
      onUpdated(updated);
      notice = moving ? 'Saved. Radarr is moving the movie files.' : 'Movie updated.';
    } catch (cause) { error = errorMessage(cause); }
    finally { busy = ''; }
  }

  async function command(name, label) {
    busy = name; error = ''; notice = '';
    try {
      await api.proxy.post('radarr', '/api/v3/command', { name, movieIds: [current.id] });
      notice = `${label} started in Radarr.`;
    } catch (cause) { error = errorMessage(cause); }
    finally { busy = ''; }
  }

  async function removeMovie() {
    const suffix = deleteFiles ? ' and delete its files' : '';
    if (!confirm(`Remove ${current.title} from Radarr${suffix}? This cannot be undone.`)) return;
    busy = 'delete'; error = '';
    try {
      await api.proxy.delete('radarr', `/api/v3/movie/${current.id}`, { deleteFiles, addImportExclusion });
      onDeleted(current.id);
    } catch (cause) { error = errorMessage(cause); busy = ''; }
  }

  async function removeFile() {
    const file = current.movieFile;
    if (!file || !confirm(`Delete the movie file for ${current.title}? The movie will remain in Radarr.`)) return;
    busy = 'file'; error = '';
    try {
      await api.proxy.delete('radarr', `/api/v3/moviefile/${file.id}`);
      current = await api.proxy.get('radarr', `/api/v3/movie/${current.id}`);
      onUpdated(current);
      notice = 'Movie file deleted.';
    } catch (cause) { error = errorMessage(cause); }
    finally { busy = ''; }
  }

  async function selectTab(next) {
    tab = next; error = '';
    if (next === 'releases' && releases === null) {
      busy = 'releases';
      try { releases = await api.proxy.get('radarr', '/api/v3/release', { movieId: current.id }); }
      catch (cause) { error = errorMessage(cause); releases = []; }
      finally { busy = ''; }
    }
    if (next === 'history' && history === null) {
      busy = 'history';
      try { history = await api.proxy.get('radarr', '/api/v3/history/movie', { movieId: current.id }); }
      catch (cause) { error = errorMessage(cause); history = []; }
      finally { busy = ''; }
    }
  }

  async function grab(release) {
    if (!confirm(`Grab ${release.title}? Radarr will send it to your download client.`)) return;
    busy = `grab-${release.guid}`; error = ''; notice = '';
    try { await api.proxy.post('radarr', '/api/v3/release', release); notice = 'Release sent to the download client.'; }
    catch (cause) { error = errorMessage(cause); }
    finally { busy = ''; }
  }

  function toggleTag(id) {
    selectedTags = selectedTags.includes(id) ? selectedTags.filter((tag) => tag !== id) : [...selectedTags, id];
  }
</script>

<div class="rad-modal-backdrop" role="presentation" onclick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
  <div class="rad-modal" role="dialog" aria-modal="true" aria-label={`Movie details for ${current.title}`}>
    <div class="rad-modal-head"><div><h2>{current.title} <span class="rad-muted">({current.year})</span></h2><p class="rad-muted">{current.genres?.join(' · ') || current.studio || 'Movie details'}</p></div><button class="rad-button" onclick={onClose}>Close</button></div>
    {#if error}<p class="rad-error" role="alert">{error}</p>{/if}
    {#if notice}<p class="rad-success" role="status">{notice}</p>{/if}
    <div class="rad-actions" role="tablist" aria-label="Movie sections">
      <button class="rad-button" class:primary={tab === 'details'} role="tab" aria-selected={tab === 'details'} onclick={() => selectTab('details')}>Details</button>
      <button class="rad-button" class:primary={tab === 'releases'} role="tab" aria-selected={tab === 'releases'} onclick={() => selectTab('releases')}>Manual search</button>
      <button class="rad-button" class:primary={tab === 'history'} role="tab" aria-selected={tab === 'history'} onclick={() => selectTab('history')}>History</button>
    </div>
    {#if tab === 'details'}
      <div class="hero">
        {#if posterUrl(current)}<img src={posterUrl(current, 'full')} alt={`${current.title} poster`} />{/if}
        <div class="hero-text"><p>{current.overview || 'No overview available.'}</p><div class="rad-actions"><span class="rad-badge" class:good={current.hasFile} class:warn={!current.hasFile}>{current.hasFile ? 'Downloaded' : current.isAvailable ? 'Missing' : current.status}</span><span class="rad-badge">{current.runtime || 0} min</span><span class="rad-badge">{formatBytes(current.sizeOnDisk)}</span></div><p class="rad-muted">Released: {formatDate(current.digitalRelease || current.physicalRelease || current.inCinemas)}</p></div>
      </div>
      <div class="rad-fields">
        <label class="rad-field">Quality profile<select class="rad-select" bind:value={profileId}>{#each profiles as profile}<option value={String(profile.id)}>{profile.name}</option>{/each}</select></label>
        <label class="rad-field">Root folder<select class="rad-select" bind:value={rootFolderPath}>{#each roots as root}<option value={root.path}>{root.path}</option>{/each}</select></label>
        <label class="rad-field">Minimum availability<select class="rad-select" bind:value={minimumAvailability}><option value="announced">Announced</option><option value="inCinemas">In cinemas</option><option value="released">Released</option></select></label>
      </div>
      <label class="rad-check"><input type="checkbox" bind:checked={monitored} /> Monitored</label>
      {#if tags.length}<div class="rad-field">Tags<div class="rad-actions">{#each tags as tag}<label class="rad-check"><input type="checkbox" checked={selectedTags.includes(tag.id)} onchange={() => toggleTag(tag.id)} /> {tag.label}</label>{/each}</div></div>{/if}
      <div class="rad-actions"><button class="rad-button primary" onclick={save} disabled={!!busy}>Save changes</button><button class="rad-button" onclick={() => command('MoviesSearch', 'Search')} disabled={!!busy}>Search now</button><button class="rad-button" onclick={() => command('RefreshMovie', 'Refresh')} disabled={!!busy}>Refresh metadata</button><button class="rad-button" onclick={() => command('RenameMovie', 'Rename')} disabled={!!busy || !current.hasFile}>Rename files</button></div>
      {#if current.movieFile}<div class="rad-panel"><h3>Movie file</h3><p class="rad-muted">{current.movieFile.relativePath || current.movieFile.path || 'File'} · {formatBytes(current.movieFile.size)} · {current.movieFile.quality?.quality?.name || 'Unknown quality'}</p><button class="rad-button danger" onclick={removeFile} disabled={!!busy}>Delete movie file</button></div>{/if}
      <div class="rad-panel danger-zone"><h3>Remove movie</h3><div class="rad-actions"><label class="rad-check"><input type="checkbox" bind:checked={deleteFiles} /> Delete files from disk</label><label class="rad-check"><input type="checkbox" bind:checked={addImportExclusion} /> Prevent automatic re-add</label></div><button class="rad-button danger" onclick={removeMovie} disabled={!!busy}>Remove from Radarr</button></div>
    {:else if tab === 'releases'}
      {#if busy === 'releases'}<p class="rad-muted">Searching indexers…</p>{:else if !releases?.length}<p class="rad-empty">No releases found.</p>{:else}<div class="rad-list">{#each releases as release (release.guid)}<div class="rad-row"><div class="rad-row-main"><strong class="rad-row-title">{release.title}</strong><span class="rad-row-meta">{release.indexer} · {release.quality?.quality?.name || 'Unknown quality'} · {formatBytes(release.size)} · {release.seeders ?? '—'} seeders</span>{#if release.rejections?.length}<span class="rad-row-meta">{release.rejections.join('; ')}</span>{/if}</div><button class="rad-button" onclick={() => grab(release)} disabled={!!busy || release.downloadAllowed === false}>Grab</button></div>{/each}</div>{/if}
    {:else}
      {#if busy === 'history'}<p class="rad-muted">Loading history…</p>{:else if !history?.length}<p class="rad-empty">No history for this movie.</p>{:else}<div class="rad-list">{#each history.slice(0, 50) as item (item.id)}<div class="rad-row"><div class="rad-row-main"><strong class="rad-row-title">{item.eventType}</strong><span class="rad-row-meta">{item.sourceTitle || current.title} · {formatDate(item.date)} · {item.quality?.quality?.name || ''}</span></div></div>{/each}</div>{/if}
    {/if}
  </div>
</div>

<style>
  .hero { display: flex; gap: 18px; }
  .hero img { width: 130px; max-height: 195px; object-fit: cover; border-radius: var(--radius-md); flex-shrink: 0; }
  .hero-text { display: grid; align-content: start; gap: 12px; color: var(--text); font-size: var(--text-sm); line-height: 1.5; }
  .rad-panel h3 { font-size: var(--text-sm); color: var(--text); margin-bottom: 8px; }
  .rad-panel .rad-button { margin-top: 10px; }
  .danger-zone { border-color: color-mix(in oklch, var(--red) 25%, var(--border)); }
  @media (max-width: 600px) { .hero img { width: 90px; max-height: 135px; } }
</style>
