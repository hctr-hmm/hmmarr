<script>
  import { onMount } from 'svelte';
  import { bazarr, subtitleLabel, subtitleParams } from '../lib/bazarr.js';
  import { errorMessage } from '../lib/radarr.js';
  import SubtitleManual from './SubtitleManual.svelte';

  let mode = $state('movie');
  let movies = $state([]);
  let episodes = $state([]);
  let loading = $state(true);
  let busy = $state('');
  let error = $state('');
  let notice = $state('');
  let query = $state('');
  let manual = $state(null);

  async function getAll(path) {
    const entries = [];
    for (let start = 0; ; start += 250) {
      const result = await bazarr.get(path, { start, length: 250 });
      entries.push(...(result.data || []));
      if (!result.data?.length || entries.length >= result.total) return entries;
    }
  }

  async function load() {
    loading = true; error = '';
    try { [movies, episodes] = await Promise.all([getAll('/movies/wanted'), getAll('/episodes/wanted')]); }
    catch (cause) { error = errorMessage(cause); }
    finally { loading = false; }
  }
  onMount(load);

  const visible = $derived((mode === 'movie' ? movies : episodes).filter((item) => `${item.title || item.seriesTitle} ${item.episodeTitle || ''}`.toLowerCase().includes(query.trim().toLowerCase())));

  async function download(item, subtitle) {
    const kind = mode;
    busy = `${kind}-${kind === 'movie' ? item.radarrId : item.sonarrEpisodeId}-${subtitle.code2}`;
    error = ''; notice = '';
    try {
      await bazarr.patch(kind === 'movie' ? '/movies/subtitles' : '/episodes/subtitles', subtitleParams(kind, item, subtitle));
      notice = `Subtitle search started for ${subtitleLabel(subtitle)}.`;
      await load();
    } catch (cause) { error = errorMessage(cause); }
    finally { busy = ''; }
  }
</script>

<div class="wanted">
  <div class="rad-head"><div><h2>Missing subtitles</h2><p class="rad-muted">{movies.length} movies · {episodes.length} episodes</p></div><button class="rad-button" onclick={load} disabled={loading}>Refresh</button></div>
  <div class="rad-toolbar"><div class="rad-actions"><button class="rad-button" class:primary={mode === 'movie'} onclick={() => mode = 'movie'}>Movies</button><button class="rad-button" class:primary={mode === 'episode'} onclick={() => mode = 'episode'}>Episodes</button></div><input class="rad-input search" type="search" bind:value={query} placeholder="Filter missing subtitles…" aria-label="Filter missing subtitles" /></div>
  {#if error}<p class="rad-error" role="alert">{error}</p>{/if}
  {#if notice}<p class="rad-success" role="status">{notice}</p>{/if}
  {#if loading && !visible.length}<p class="rad-muted">Loading missing subtitles…</p>{:else if !visible.length}<p class="rad-empty">No missing subtitles in this list.</p>{:else}<div class="rad-list">{#each visible as item (mode === 'movie' ? item.radarrId : item.sonarrEpisodeId)}<article class="rad-row"><div class="rad-row-main"><strong class="rad-row-title">{mode === 'movie' ? item.title : `${item.seriesTitle} · ${item.episode_number} ${item.episodeTitle || ''}`}</strong><span class="rad-row-meta">Missing: {(item.missing_subtitles || []).map(subtitleLabel).join(', ') || 'Unknown language'}</span></div><div class="rad-actions">{#each item.missing_subtitles || [] as subtitle (subtitle.code2 + subtitle.forced + subtitle.hi)}<button class="rad-button" onclick={() => download(item, subtitle)} disabled={!!busy}>Search {subtitle.name || subtitle.code2}</button>{/each}<button class="rad-button" onclick={() => manual = { kind: mode, item }}>Manual</button></div></article>{/each}</div>{/if}
</div>

{#if manual}<SubtitleManual kind={manual.kind} item={manual.item} onClose={() => manual = null} onDownloaded={() => { manual = null; notice = 'Subtitle downloaded.'; load(); }} />{/if}

<style>
  .wanted { display: grid; gap: 16px; }
  .wanted h2 { color: var(--text); font-size: var(--text-lg); }
  .search { flex: 1; min-width: 180px; }
  .rad-row-main { flex: 1; }
</style>
