<script>
  import { onMount, untrack } from 'svelte';
  import { api } from '../lib/api.js';
  import { errorMessage, formatBytes, formatDate } from '../lib/radarr.js';
  import { episodeCode, seriesPosterUrl } from '../lib/sonarr.js';

  let { series, onClose, onUpdated, onDeleted } = $props();
  let current = $state(untrack(() => series));
  let episodes = $state([]);
  let profiles = $state([]);
  let roots = $state([]);
  let tags = $state([]);
  let profileId = $state(untrack(() => String(series.qualityProfileId || '')));
  let rootFolderPath = $state(untrack(() => series.rootFolderPath || ''));
  let monitored = $state(untrack(() => Boolean(series.monitored)));
  let monitorNewItems = $state(untrack(() => series.monitorNewItems || 'all'));
  let seasonFolder = $state(untrack(() => Boolean(series.seasonFolder)));
  let selectedTags = $state(untrack(() => [...(series.tags || [])]));
  let selectedSeason = $state(1);
  let tab = $state('episodes');
  let deleteFiles = $state(false);
  let error = $state('');
  let notice = $state('');
  let busy = $state('');
  let releases = $state(null);
  let manualEpisode = $state(null);

  onMount(async () => {
    try {
      const [fresh, foundEpisodes, foundProfiles, foundRoots, foundTags] = await Promise.all([
        api.proxy.get('sonarr', `/api/v3/series/${series.id}`),
        api.proxy.get('sonarr', '/api/v3/episode', { seriesId: series.id, includeEpisodeFile: true }),
        api.proxy.get('sonarr', '/api/v3/qualityprofile'),
        api.proxy.get('sonarr', '/api/v3/rootfolder'),
        api.proxy.get('sonarr', '/api/v3/tag'),
      ]);
      current = fresh; episodes = foundEpisodes; profiles = foundProfiles; roots = foundRoots; tags = foundTags;
      profileId = String(fresh.qualityProfileId || ''); rootFolderPath = fresh.rootFolderPath || '';
      monitored = Boolean(fresh.monitored); monitorNewItems = fresh.monitorNewItems || 'all';
      seasonFolder = Boolean(fresh.seasonFolder); selectedTags = [...(fresh.tags || [])];
      selectedSeason = fresh.seasons?.find((item) => item.seasonNumber > 0)?.seasonNumber ?? fresh.seasons?.[0]?.seasonNumber ?? 1;
    } catch (cause) { error = errorMessage(cause); }
  });

  const shownEpisodes = $derived(episodes.filter((item) => item.seasonNumber === selectedSeason).sort((a, b) => b.episodeNumber - a.episodeNumber));
  const selectedSeasonRecord = $derived(current.seasons?.find((item) => item.seasonNumber === selectedSeason));

  async function reload() {
    const [fresh, foundEpisodes] = await Promise.all([
      api.proxy.get('sonarr', `/api/v3/series/${current.id}`),
      api.proxy.get('sonarr', '/api/v3/episode', { seriesId: current.id, includeEpisodeFile: true }),
    ]);
    current = fresh; episodes = foundEpisodes; onUpdated(fresh);
  }

  async function saveSettings() {
    busy = 'save'; error = ''; notice = '';
    try {
      const moving = rootFolderPath !== current.rootFolderPath;
      if (moving && !confirm(`Move ${current.title} to ${rootFolderPath}? Sonarr will move its files.`)) return;
      const folder = current.path?.split('/').filter(Boolean).at(-1) || `${current.title} (${current.year})`;
      const updated = await api.proxy.put('sonarr', `/api/v3/series/${current.id}`, {
        ...current, qualityProfileId: Number(profileId), rootFolderPath, monitored, monitorNewItems, seasonFolder, tags: selectedTags,
        ...(moving ? { path: `${rootFolderPath.replace(/\/$/, '')}/${folder}` } : {}),
      }, moving ? { moveFiles: true } : undefined);
      current = updated; onUpdated(updated); notice = moving ? 'Saved. Sonarr is moving the series files.' : 'Series updated.';
    } catch (cause) { error = errorMessage(cause); }
    finally { busy = ''; }
  }

  async function toggleSeason(season) {
    busy = `season-${season.seasonNumber}`; error = '';
    try {
      const updated = await api.proxy.put('sonarr', `/api/v3/series/${current.id}`, {
        ...current, seasons: current.seasons.map((item) => item.seasonNumber === season.seasonNumber ? { ...item, monitored: !item.monitored } : item),
      });
      current = updated; onUpdated(updated);
      episodes = await api.proxy.get('sonarr', '/api/v3/episode', { seriesId: current.id, includeEpisodeFile: true });
    } catch (cause) { error = errorMessage(cause); }
    finally { busy = ''; }
  }

  async function toggleEpisode(episode) {
    busy = `episode-${episode.id}`; error = '';
    try {
      const updated = await api.proxy.put('sonarr', `/api/v3/episode/${episode.id}`, { ...episode, monitored: !episode.monitored });
      episodes = episodes.map((item) => item.id === episode.id ? updated : item);
    } catch (cause) { error = errorMessage(cause); }
    finally { busy = ''; }
  }

  async function command(name, payload, label) {
    busy = name; error = ''; notice = '';
    try { await api.proxy.post('sonarr', '/api/v3/command', { name, ...payload }); notice = `${label} started in Sonarr.`; }
    catch (cause) { error = errorMessage(cause); }
    finally { busy = ''; }
  }

  async function manualSearch(episode) {
    manualEpisode = episode; releases = null; busy = 'releases'; error = '';
    try { releases = await api.proxy.get('sonarr', '/api/v3/release', { episodeId: episode.id }); }
    catch (cause) { error = errorMessage(cause); releases = []; }
    finally { busy = ''; }
  }

  async function grab(release) {
    if (!confirm(`Grab ${release.title}? Sonarr will send it to your download client.`)) return;
    busy = 'grab'; error = '';
    try { await api.proxy.post('sonarr', '/api/v3/release', release); notice = 'Release sent to the download client.'; }
    catch (cause) { error = errorMessage(cause); }
    finally { busy = ''; }
  }

  async function removeFile(episode) {
    if (!episode.episodeFileId || !confirm(`Delete the file for ${episodeCode(episode)}? The episode will remain in Sonarr.`)) return;
    busy = 'file'; error = '';
    try { await api.proxy.delete('sonarr', `/api/v3/episodefile/${episode.episodeFileId}`); await reload(); notice = 'Episode file deleted.'; }
    catch (cause) { error = errorMessage(cause); }
    finally { busy = ''; }
  }

  async function removeSeries() {
    if (!confirm(`Remove ${current.title} from Sonarr${deleteFiles ? ' and delete its files' : ''}? This cannot be undone.`)) return;
    busy = 'delete'; error = '';
    try { await api.proxy.delete('sonarr', `/api/v3/series/${current.id}`, { deleteFiles }); onDeleted(current.id); }
    catch (cause) { error = errorMessage(cause); busy = ''; }
  }

  function toggleTag(id) { selectedTags = selectedTags.includes(id) ? selectedTags.filter((item) => item !== id) : [...selectedTags, id]; }
</script>

<div class="rad-modal-backdrop" role="presentation" onclick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
  <div class="rad-modal" role="dialog" aria-modal="true" aria-label={`Series details for ${current.title}`}>
    <div class="rad-modal-head"><div><h2>{current.title} <span class="rad-muted">({current.year || '—'})</span></h2><p class="rad-muted">{current.network || current.seriesType || 'Series'} · {current.status || 'Unknown'} · {current.statistics?.episodeFileCount || 0}/{current.statistics?.episodeCount || 0} episodes</p></div><button class="rad-button" onclick={onClose}>Close</button></div>
    {#if error}<p class="rad-error" role="alert">{error}</p>{/if}
    {#if notice}<p class="rad-success" role="status">{notice}</p>{/if}
    <div class="hero">{#if seriesPosterUrl(current)}<img src={seriesPosterUrl(current)} alt={`${current.title} poster`} />{/if}<div><p>{current.overview || 'No overview available.'}</p><div class="rad-actions"><span class="rad-badge">{current.seasons?.length || 0} seasons</span><span class="rad-badge">{formatBytes(current.statistics?.sizeOnDisk)}</span><span class="rad-badge">{current.runtime || 0} min episodes</span></div><p class="rad-muted">First aired: {formatDate(current.firstAired)}</p></div></div>
    <div class="rad-actions" role="tablist" aria-label="Series details"><button class="rad-button" class:primary={tab === 'episodes'} role="tab" aria-selected={tab === 'episodes'} onclick={() => tab = 'episodes'}>Episodes</button><button class="rad-button" class:primary={tab === 'settings'} role="tab" aria-selected={tab === 'settings'} onclick={() => tab = 'settings'}>Settings</button></div>

    {#if tab === 'episodes'}
      <div class="rad-actions season-tabs">{#each current.seasons || [] as season (season.seasonNumber)}<button class="rad-button" class:primary={selectedSeason === season.seasonNumber} onclick={() => { selectedSeason = season.seasonNumber; manualEpisode = null; }}><span>{season.seasonNumber === 0 ? 'Specials' : `Season ${season.seasonNumber}`}</span> <small>{season.statistics?.episodeFileCount || 0}/{season.statistics?.episodeCount || 0}</small></button>{/each}</div>
      {#if selectedSeasonRecord}<div class="rad-actions"><span class="rad-muted">{selectedSeasonRecord.statistics?.episodeFileCount || 0} of {selectedSeasonRecord.statistics?.episodeCount || 0} episodes downloaded</span><button class="rad-button" onclick={() => toggleSeason(selectedSeasonRecord)} disabled={!!busy}>{selectedSeasonRecord.monitored ? 'Unmonitor season' : 'Monitor season'}</button><button class="rad-button" onclick={() => command('SeasonSearch', { seriesId: current.id, seasonNumber: selectedSeason }, 'Season search')} disabled={!!busy}>Search season</button></div>{/if}
      {#if !shownEpisodes.length}<p class="rad-empty">No episodes in this season.</p>{:else}<div class="rad-list">{#each shownEpisodes as episode (episode.id)}<div class="rad-row episode-row"><div class="rad-row-main"><strong class="rad-row-title">{episodeCode(episode)} · {episode.title || 'TBA'}</strong><span class="rad-row-meta">{formatDate(episode.airDateUtc)} · {episode.hasFile ? episode.episodeFile?.quality?.quality?.name || 'Downloaded' : 'Missing'}{episode.hasFile && episode.episodeFile?.size ? ` · ${formatBytes(episode.episodeFile.size)}` : ''}</span></div><div class="rad-actions"><button class="rad-button" onclick={() => toggleEpisode(episode)} disabled={!!busy}>{episode.monitored ? 'Monitored' : 'Unmonitored'}</button><button class="rad-button" onclick={() => command('EpisodeSearch', { episodeIds: [episode.id] }, 'Episode search')} disabled={!!busy}>Search</button><button class="rad-button" onclick={() => manualSearch(episode)} disabled={!!busy}>Manual</button>{#if episode.episodeFileId}<button class="rad-button danger" onclick={() => removeFile(episode)} disabled={!!busy}>Delete file</button>{/if}</div></div>{/each}</div>{/if}
      {#if manualEpisode}<div class="rad-panel releases"><div class="rad-head"><h3>Releases for {episodeCode(manualEpisode)}</h3><button class="rad-button" onclick={() => manualEpisode = null}>Close</button></div>{#if releases === null}<p class="rad-muted">Searching indexers…</p>{:else if !releases.length}<p class="rad-muted">No releases found.</p>{:else}<div class="rad-list">{#each releases as release (release.guid)}<div class="rad-row"><div class="rad-row-main"><strong class="rad-row-title">{release.title}</strong><span class="rad-row-meta">{release.indexer} · {release.quality?.quality?.name || 'Unknown quality'} · {formatBytes(release.size)}{release.rejections?.length ? ` · ${release.rejections.join('; ')}` : ''}</span></div><button class="rad-button" onclick={() => grab(release)} disabled={!!busy || release.downloadAllowed === false}>Grab</button></div>{/each}</div>{/if}</div>{/if}
    {:else}
      <div class="rad-fields"><label class="rad-field">Quality profile<select class="rad-select" bind:value={profileId}>{#each profiles as profile}<option value={String(profile.id)}>{profile.name}</option>{/each}</select></label><label class="rad-field">Root folder<select class="rad-select" bind:value={rootFolderPath}>{#each roots as root}<option value={root.path}>{root.path}</option>{/each}</select></label><label class="rad-field">New seasons<select class="rad-select" bind:value={monitorNewItems}><option value="all">Monitor automatically</option><option value="none">Do not monitor</option></select></label></div>
      <div class="rad-actions"><label class="rad-check"><input type="checkbox" bind:checked={monitored} /> Monitor series</label><label class="rad-check"><input type="checkbox" bind:checked={seasonFolder} /> Use season folders</label></div>
      {#if tags.length}<div class="rad-field">Tags<div class="rad-actions">{#each tags as tag}<label class="rad-check"><input type="checkbox" checked={selectedTags.includes(tag.id)} onchange={() => toggleTag(tag.id)} /> {tag.label}</label>{/each}</div></div>{/if}
      <div class="rad-actions"><button class="rad-button primary" onclick={saveSettings} disabled={!!busy}>Save changes</button><button class="rad-button" onclick={() => command('SeriesSearch', { seriesId: current.id }, 'Series search')} disabled={!!busy}>Search series</button><button class="rad-button" onclick={() => command('RefreshSeries', { seriesId: current.id }, 'Metadata refresh')} disabled={!!busy}>Refresh metadata</button><button class="rad-button" onclick={() => command('RescanSeries', { seriesId: current.id }, 'Disk scan')} disabled={!!busy}>Scan files</button></div>
      <div class="rad-panel danger-zone"><h3>Remove series</h3><label class="rad-check"><input type="checkbox" bind:checked={deleteFiles} /> Delete files from disk</label><button class="rad-button danger" onclick={removeSeries} disabled={!!busy}>Remove from Sonarr</button></div>
    {/if}
  </div>
</div>

<style>
  .hero { display: flex; gap: 18px; }
  .hero img { width: 130px; height: 195px; object-fit: cover; border-radius: var(--radius-md); flex-shrink: 0; }
  .hero > div { display: grid; align-content: start; gap: 12px; color: var(--text); font-size: var(--text-sm); line-height: 1.5; }
  .season-tabs { overflow-x: auto; flex-wrap: nowrap; }
  .season-tabs .rad-button { white-space: nowrap; }
  .season-tabs small { opacity: .7; margin-left: 4px; }
  .episode-row { min-width: 0; }
  .episode-row .rad-actions { justify-content: flex-end; }
  .releases { display: grid; gap: 12px; }
  .releases h3, .danger-zone h3 { color: var(--text); font-size: var(--text-sm); }
  .danger-zone { display: grid; gap: 12px; border-color: color-mix(in oklch, var(--red) 25%, var(--border)); }
  .danger-zone .rad-button { width: fit-content; }
  @media (max-width: 600px) { .hero img { width: 90px; height: 135px; } .episode-row .rad-actions { justify-content: flex-start; } }
</style>
