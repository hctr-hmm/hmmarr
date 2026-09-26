<script>
  import { onMount } from 'svelte';
  import { errorMessage } from '../lib/radarr.js';
  import { bazarr, mediaPosterUrl, subtitleLabel } from '../lib/bazarr.js';
  import SubtitleDetail from './SubtitleDetail.svelte';
  import SubtitleWanted from './SubtitleWanted.svelte';
  import SubtitleActivity from './SubtitleActivity.svelte';

  const tabs = [
    { id: 'movies', label: 'Movies' },
    { id: 'series', label: 'Series' },
    { id: 'wanted', label: 'Wanted' },
    { id: 'history', label: 'History' },
    { id: 'providers', label: 'Providers' },
  ];
  let tab = $state('movies');
  let movies = $state([]);
  let series = $state([]);
  let profiles = $state([]);
  let loading = $state(true);
  let error = $state('');
  let notice = $state('');
  let query = $state('');
  let missingOnly = $state(false);
  let selected = $state(null);
  let busyId = $state(null);

  async function getAll(path) {
    const entries = [];
    for (let start = 0; ; start += 250) {
      const result = await bazarr.get(path, { start, length: 250 });
      entries.push(...(result.data || []));
      if (!result.data?.length || entries.length >= result.total) return entries;
    }
  }

  async function loadLibrary() {
    loading = true; error = '';
    try {
      [movies, series, profiles] = await Promise.all([
        getAll('/movies'), getAll('/series'), bazarr.get('/system/languages/profiles'),
      ]);
    } catch (cause) { error = `Could not load Bazarr: ${errorMessage(cause)}`; }
    finally { loading = false; }
  }
  onMount(loadLibrary);

  const items = $derived(tab === 'movies' ? movies : series);
  const visible = $derived(items.filter((item) => {
    const text = query.trim().toLowerCase();
    if (text && !`${item.title} ${item.year || ''}`.toLowerCase().includes(text)) return false;
    return !missingOnly || (tab === 'movies' ? item.missing_subtitles?.length : item.episodeMissingCount);
  }).sort((a, b) => a.title.localeCompare(b.title, undefined, { numeric: true, sensitivity: 'base' })));
  const movieMissing = $derived(movies.filter((item) => item.missing_subtitles?.length).length);
  const episodeMissing = $derived(series.reduce((sum, item) => sum + (item.episodeMissingCount || 0), 0));

  async function assignProfile(kind, item, value) {
    const id = kind === 'movie' ? item.radarrId : item.sonarrSeriesId;
    busyId = `${kind}-${id}`; error = ''; notice = '';
    try {
      await bazarr.post(kind === 'movie' ? '/movies' : '/series', { [kind === 'movie' ? 'radarrid' : 'seriesid']: id, profileid: value });
      const update = (entry) => (kind === 'movie' ? entry.radarrId : entry.sonarrSeriesId) === id ? { ...entry, profileId: value === 'none' ? null : Number(value) } : entry;
      if (kind === 'movie') movies = movies.map(update); else series = series.map(update);
      notice = `Language profile updated for ${item.title}.`;
    } catch (cause) { error = errorMessage(cause); }
    finally { busyId = null; }
  }

  async function searchMissing(kind, item) {
    const id = kind === 'movie' ? item.radarrId : item.sonarrSeriesId;
    busyId = `${kind}-${id}`; error = ''; notice = '';
    try {
      await bazarr.patch(kind === 'movie' ? '/movies' : '/series', { [kind === 'movie' ? 'radarrid' : 'seriesid']: id, action: 'search-missing' });
      notice = `Subtitle search started for ${item.title}.`;
    } catch (cause) { error = errorMessage(cause); }
    finally { busyId = null; }
  }

  function closeDetail() { selected = null; loadLibrary(); }
</script>

<div class="rad-page">
  <header class="rad-head"><div><h1>Subtitles</h1><p>{movies.length} movies · {series.length} series · {movieMissing} movies and {episodeMissing} episodes need subtitles</p></div><button class="rad-button" onclick={loadLibrary} disabled={loading}>Refresh</button></header>
  <div class="rad-actions tabs" role="tablist" aria-label="Subtitle sections">{#each tabs as section}<button class="rad-button" class:primary={tab === section.id} role="tab" aria-selected={tab === section.id} onclick={() => { tab = section.id; query = ''; missingOnly = false; }}>{section.label}</button>{/each}</div>
  {#if error}<p class="rad-error" role="alert">{error}</p>{/if}
  {#if notice}<p class="rad-success" role="status">{notice}</p>{/if}
  {#if tab === 'movies' || tab === 'series'}
    <div class="rad-toolbar"><input class="rad-input search" type="search" bind:value={query} placeholder={`Search ${tab}…`} aria-label={`Search ${tab}`} /><label class="rad-check"><input type="checkbox" bind:checked={missingOnly} /> Missing only</label></div>
    {#if loading && !items.length}<p class="rad-muted">Loading Bazarr library…</p>
    {:else if !visible.length}<p class="rad-empty">{query || missingOnly ? 'No matches.' : 'No media synced to Bazarr yet.'}</p>
    {:else}<div class="rad-list">{#each visible as item (tab === 'movies' ? item.radarrId : item.sonarrSeriesId)}{@const kind = tab === 'movies' ? 'movie' : 'series'}{@const id = kind === 'movie' ? item.radarrId : item.sonarrSeriesId}<article class="rad-row media-row">
      <button class="cover" onclick={() => selected = { kind, item }} aria-label={`View subtitles for ${item.title}`}>{#if mediaPosterUrl(kind, item)}<img src={mediaPosterUrl(kind, item)} alt="" loading="lazy" />{:else}<span>{item.title?.slice(0, 1)}</span>{/if}</button>
      <div class="rad-row-main"><button class="item-title" onclick={() => selected = { kind, item }}>{item.title} ({item.year || '—'})</button><span class="rad-row-meta">{kind === 'movie' ? `${item.subtitles?.length || 0} subtitles` : `${item.episodeFileCount || 0} episode files`} · {item.monitored ? 'Monitored' : 'Unmonitored'}</span><div class="language-tags">{#if kind === 'movie'}{#each (item.missing_subtitles || []).slice(0, 4) as sub}<span class="rad-badge warn">Missing {subtitleLabel(sub)}</span>{/each}{:else if item.episodeMissingCount}<span class="rad-badge warn">{item.episodeMissingCount} episodes missing subtitles</span>{/if}</div></div>
      <div class="row-actions"><label class="rad-field">Language profile<select class="rad-select" value={String(item.profileId ?? 'none')} onchange={(event) => assignProfile(kind, item, event.currentTarget.value)} disabled={busyId === `${kind}-${id}`}><option value="none">None</option>{#each profiles as profile}<option value={String(profile.profileId)}>{profile.name}</option>{/each}</select></label><div class="rad-actions"><button class="rad-button" onclick={() => selected = { kind, item }}>Details</button><button class="rad-button" onclick={() => searchMissing(kind, item)} disabled={busyId === `${kind}-${id}`}>Search missing</button></div></div>
    </article>{/each}</div>{/if}
  {:else if tab === 'wanted'}<SubtitleWanted />
  {:else}<SubtitleActivity view={tab} />{/if}
</div>

{#if selected}<SubtitleDetail kind={selected.kind} item={selected.item} profiles={profiles} onClose={closeDetail} />{/if}

<style>
  .tabs { border-bottom: 1px solid var(--border); padding-bottom: 12px; }
  .search { flex: 1; min-width: 180px; }
  .media-row { min-width: 0; }
  .cover { display: grid; place-items: center; width: 62px; height: 93px; flex-shrink: 0; border: 0; border-radius: 4px; background: var(--surface-2); color: var(--text-faint); overflow: hidden; }
  .cover img { width: 100%; height: 100%; object-fit: cover; }
  .item-title { border: 0; background: none; color: var(--text); text-align: left; font-size: var(--text-sm); font-weight: 700; }
  .item-title:hover { color: var(--accent); }
  .language-tags { display: flex; flex-wrap: wrap; gap: 5px; }
  .row-actions { display: flex; align-items: end; gap: 10px; flex-wrap: wrap; }
  .row-actions .rad-select { min-width: 130px; }
  @media (max-width: 720px) { .row-actions { width: 100%; } }
</style>
