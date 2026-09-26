<script>
  import { onMount, untrack } from 'svelte';
  import { bazarr, mediaPosterUrl, subtitleLabel, subtitleParams } from '../lib/bazarr.js';
  import { errorMessage, formatBytes } from '../lib/radarr.js';
  import SubtitleManual from './SubtitleManual.svelte';

  let { kind, item, profiles, onClose } = $props();
  let current = $state(untrack(() => item));
  let episodes = $state([]);
  let selectedEpisode = $state(null);
  let selectedSeason = $state(null);
  let languages = $state([]);
  let profileId = $state(untrack(() => String(item.profileId ?? 'none')));
  let languageCode = $state('en');
  let forced = $state(false);
  let hi = $state(false);
  let uploadFile = $state(null);
  let fileInput = $state(null);
  let manual = $state(false);
  let loading = $state(true);
  let busy = $state('');
  let error = $state('');
  let notice = $state('');
  const mediaId = $derived(kind === 'movie' ? item.radarrId : item.sonarrSeriesId);

  async function load() {
    loading = true; error = '';
    try {
      const result = await bazarr.get(kind === 'movie' ? '/movies' : '/series', { [kind === 'movie' ? 'radarrid[]' : 'seriesid[]']: mediaId });
      current = result.data?.[0] || current;
      profileId = String(current.profileId ?? 'none');
      if (kind === 'series') {
        const episodeResult = await bazarr.get('/episodes', { 'seriesid[]': mediaId });
        episodes = episodeResult.data || [];
        const previousId = selectedEpisode?.sonarrEpisodeId;
        selectedEpisode = episodes.find((episode) => episode.sonarrEpisodeId === previousId) || episodes[0] || null;
        selectedSeason = selectedEpisode?.season ?? null;
        languageCode = selectedEpisode?.missing_subtitles?.[0]?.code2 || selectedEpisode?.subtitles?.[0]?.code2 || 'en';
      } else languageCode = current.missing_subtitles?.[0]?.code2 || current.subtitles?.[0]?.code2 || 'en';
    } catch (cause) { error = errorMessage(cause); }
    finally { loading = false; }
  }

  onMount(async () => {
    await load();
    try { languages = await bazarr.get('/system/languages'); }
    catch { languages = []; }
  });

  const seasons = $derived([...new Set(episodes.map((episode) => episode.season))].sort((a, b) => b - a));
  const shownEpisodes = $derived(episodes.filter((episode) => episode.season === selectedSeason).sort((a, b) => b.episode - a.episode));
  const target = $derived(kind === 'movie' ? current : selectedEpisode);
  const availableLanguages = $derived(languages.filter((language) => language.enabled).length ? languages.filter((language) => language.enabled) : languages);

  function chooseEpisode(episode) {
    selectedEpisode = episode;
    languageCode = episode.missing_subtitles?.[0]?.code2 || episode.subtitles?.[0]?.code2 || 'en';
    notice = ''; error = '';
  }

  async function setProfile() {
    busy = 'profile'; error = ''; notice = '';
    try {
      await bazarr.post(kind === 'movie' ? '/movies' : '/series', { [kind === 'movie' ? 'radarrid' : 'seriesid']: mediaId, profileid: profileId });
      await load(); notice = 'Language profile updated.';
    } catch (cause) { error = errorMessage(cause); }
    finally { busy = ''; }
  }

  async function action(name, label) {
    busy = name; error = ''; notice = '';
    try {
      await bazarr.patch(kind === 'movie' ? '/movies' : '/series', { [kind === 'movie' ? 'radarrid' : 'seriesid']: mediaId, action: name });
      notice = `${label} started in Bazarr.`;
      if (name === 'scan-disk' || name === 'sync') await load();
    } catch (cause) { error = errorMessage(cause); }
    finally { busy = ''; }
  }

  async function searchLanguage(subtitle) {
    busy = `search-${subtitle.code2}`; error = ''; notice = '';
    try {
      await bazarr.patch(kind === 'movie' ? '/movies/subtitles' : '/episodes/subtitles', subtitleParams(kind, target, subtitle));
      notice = `Subtitle search started for ${subtitleLabel(subtitle)}.`;
      await load();
    } catch (cause) { error = errorMessage(cause); }
    finally { busy = ''; }
  }

  async function removeSubtitle(subtitle) {
    if (!subtitle.path || !confirm(`Delete the ${subtitleLabel(subtitle)} subtitle?`)) return;
    busy = `delete-${subtitle.path}`; error = ''; notice = '';
    try {
      await bazarr.delete(kind === 'movie' ? '/movies/subtitles' : '/episodes/subtitles', { ...subtitleParams(kind, target, subtitle), path: subtitle.path });
      await load(); notice = 'Subtitle deleted.';
    } catch (cause) { error = errorMessage(cause); }
    finally { busy = ''; }
  }

  async function upload() {
    if (!uploadFile || !target) return;
    if (uploadFile.size > 10 * 1024 * 1024) { error = 'Subtitle files must be 10 MB or smaller.'; return; }
    busy = 'upload'; error = ''; notice = '';
    try {
      await bazarr.upload(kind === 'movie' ? '/movies/subtitles' : '/episodes/subtitles', {
        ...(kind === 'movie' ? { radarrid: mediaId } : { seriesid: mediaId, episodeid: target.sonarrEpisodeId }),
        language: languageCode, forced: String(forced), hi: String(hi),
      }, uploadFile);
      uploadFile = null;
      if (fileInput) fileInput.value = '';
      await load(); notice = 'Subtitle uploaded.';
    } catch (cause) { error = errorMessage(cause); }
    finally { busy = ''; }
  }

  const manualItem = $derived(kind === 'movie' ? current : selectedEpisode ? { ...selectedEpisode, seriesTitle: current.title, episode_number: `${selectedEpisode.season}x${String(selectedEpisode.episode).padStart(2, '0')}`, episodeTitle: selectedEpisode.title } : null);
</script>

<div class="rad-modal-backdrop" role="presentation" onclick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
  <div class="rad-modal" role="dialog" aria-modal="true" aria-label={`Subtitles for ${current.title}`}>
    <div class="rad-modal-head"><div><h2>{current.title}</h2><p class="rad-muted">{kind === 'movie' ? `Movie · ${current.year || '—'}` : `Series · ${current.year || '—'} · ${episodes.length} episode files`}</p></div><button class="rad-button" onclick={onClose}>Close</button></div>
    {#if error}<p class="rad-error" role="alert">{error}</p>{/if}
    {#if notice}<p class="rad-success" role="status">{notice}</p>{/if}
    <div class="hero">{#if mediaPosterUrl(kind, current)}<img src={mediaPosterUrl(kind, current)} alt="" />{/if}<div><p>{current.overview || 'No overview available.'}</p><div class="rad-actions"><span class="rad-badge">{current.monitored ? 'Monitored' : 'Unmonitored'}</span>{#if kind === 'movie'}<span class="rad-badge">{current.subtitles?.length || 0} subtitles</span>{:else}<span class="rad-badge">{current.episodeMissingCount || 0} episodes missing subtitles</span>{/if}</div></div></div>
    <div class="rad-panel controls"><div class="rad-actions"><label class="rad-field">Language profile<select class="rad-select" bind:value={profileId}><option value="none">None</option>{#each profiles as profile}<option value={String(profile.profileId)}>{profile.name}</option>{/each}</select></label><button class="rad-button primary" onclick={setProfile} disabled={!!busy}>Save profile</button></div><div class="rad-actions"><button class="rad-button" onclick={() => action('scan-disk', 'Disk scan')} disabled={!!busy}>Scan disk</button><button class="rad-button" onclick={() => action('search-missing', 'Missing subtitle search')} disabled={!!busy}>Search missing</button><button class="rad-button" onclick={() => action('sync', 'Library sync')} disabled={!!busy}>Sync library</button></div></div>
    {#if loading}<p class="rad-muted">Loading subtitle details…</p>{/if}
    {#if kind === 'series'}
      <div class="rad-actions season-tabs">{#each seasons as season}<button class="rad-button" class:primary={selectedSeason === season} onclick={() => { selectedSeason = season; chooseEpisode(episodes.find((episode) => episode.season === season)); }}>{season === 0 ? 'Specials' : `Season ${season}`}</button>{/each}</div>
      {#if !shownEpisodes.length}<p class="rad-empty">No episode files in this season.</p>{:else}<div class="episode-list">{#each shownEpisodes as episode (episode.sonarrEpisodeId)}<button class="episode-button" class:active={selectedEpisode?.sonarrEpisodeId === episode.sonarrEpisodeId} onclick={() => chooseEpisode(episode)}><strong>S{String(episode.season).padStart(2, '0')}E{String(episode.episode).padStart(2, '0')} · {episode.title || 'Untitled'}</strong><span>{episode.subtitles?.length || 0} subtitles{episode.missing_subtitles?.length ? ` · ${episode.missing_subtitles.length} missing` : ''}</span></button>{/each}</div>{/if}
    {/if}
    {#if target}<section class="subtitle-section"><div class="rad-head"><div><h3>{kind === 'movie' ? 'Movie subtitles' : `S${String(target.season).padStart(2, '0')}E${String(target.episode).padStart(2, '0')} subtitles`}</h3><p class="rad-muted">{target.subtitles?.length || 0} available · {target.missing_subtitles?.length || 0} missing</p></div><button class="rad-button" onclick={() => manual = true}>Manual search</button></div>
      {#if target.missing_subtitles?.length}<div class="rad-list"><h4>Missing</h4>{#each target.missing_subtitles as subtitle (subtitle.code2 + subtitle.forced + subtitle.hi)}<div class="rad-row"><span class="rad-badge warn">{subtitleLabel(subtitle)}</span><button class="rad-button" onclick={() => searchLanguage(subtitle)} disabled={!!busy}>Search</button></div>{/each}</div>{/if}
      {#if target.subtitles?.length}<div class="rad-list"><h4>Available</h4>{#each target.subtitles as subtitle, index (index)}<div class="rad-row"><div class="rad-row-main"><strong class="rad-row-title">{subtitleLabel(subtitle)}</strong><span class="rad-row-meta">{subtitle.embedded_track_id != null ? 'Embedded track' : formatBytes(subtitle.file_size)}</span></div>{#if subtitle.path}<button class="rad-button danger" onclick={() => removeSubtitle(subtitle)} disabled={!!busy}>Delete</button>{/if}</div>{/each}</div>{:else}<p class="rad-muted">No subtitles available yet.</p>{/if}
      <div class="rad-panel upload"><h4>Upload subtitle file</h4><div class="rad-actions"><input class="rad-input file" type="file" accept=".srt,.ass,.ssa,.vtt,.sub" bind:this={fileInput} onchange={(event) => uploadFile = event.currentTarget.files?.[0] || null} aria-label="Subtitle file" /><select class="rad-select" bind:value={languageCode} aria-label="Subtitle language">{#each availableLanguages as language}<option value={language.code2}>{language.name}</option>{/each}</select><label class="rad-check"><input type="checkbox" bind:checked={forced} /> Forced</label><label class="rad-check"><input type="checkbox" bind:checked={hi} /> HI</label><button class="rad-button primary" onclick={upload} disabled={!!busy || !uploadFile}>Upload</button></div></div>
    </section>{/if}
  </div>
</div>

{#if manual && manualItem}<SubtitleManual kind={kind} item={manualItem} onClose={() => manual = false} onDownloaded={() => { manual = false; notice = 'Subtitle downloaded.'; load(); }} />{/if}

<style>
  .hero { display: flex; gap: 16px; }
  .hero img { width: 120px; height: 180px; object-fit: cover; border-radius: var(--radius-md); flex-shrink: 0; }
  .hero > div { display: grid; align-content: start; gap: 12px; color: var(--text); font-size: var(--text-sm); line-height: 1.5; }
  .controls { display: grid; gap: 14px; }
  .controls .rad-field { min-width: 180px; }
  .season-tabs { overflow-x: auto; flex-wrap: nowrap; }
  .season-tabs .rad-button { white-space: nowrap; }
  .episode-list { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 7px; max-height: 240px; overflow: auto; }
  .episode-button { display: grid; gap: 4px; min-width: 0; padding: 9px; border: 1px solid var(--border); border-radius: var(--radius-md); background: var(--surface-2); color: var(--text); text-align: left; font-size: var(--text-xs); }
  .episode-button.active { border-color: var(--accent); }
  .episode-button span { color: var(--text-muted); }
  .subtitle-section { display: grid; gap: 14px; }
  .subtitle-section h3 { color: var(--text); font-size: var(--text-lg); }
  .subtitle-section h4 { color: var(--text); font-size: var(--text-sm); }
  .subtitle-section .rad-row-main { flex: 1; }
  .upload { display: grid; gap: 12px; }
  .file { min-width: 180px; max-width: 100%; }
  @media (max-width: 600px) { .hero img { width: 80px; height: 120px; } }
</style>
