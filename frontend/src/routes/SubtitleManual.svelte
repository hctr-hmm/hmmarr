<script>
  import { onMount } from 'svelte';
  import { bazarr } from '../lib/bazarr.js';
  import { errorMessage } from '../lib/radarr.js';

  let { kind, item, onClose, onDownloaded } = $props();
  let results = $state([]);
  let loading = $state(true);
  let busy = $state('');
  let error = $state('');
  let originalFormat = $state(false);
  const id = $derived(kind === 'movie' ? item.radarrId : item.sonarrEpisodeId);

  async function search() {
    loading = true; error = '';
    try {
      const result = await bazarr.get(kind === 'movie' ? '/providers/movies' : '/providers/episodes', { [kind === 'movie' ? 'radarrid' : 'episodeid']: id });
      results = result.data || [];
    } catch (cause) { error = errorMessage(cause); }
    finally { loading = false; }
  }
  onMount(search);

  async function download(candidate) {
    if (!confirm(`Download ${candidate.language} subtitles from ${candidate.provider}?`)) return;
    busy = candidate.subtitle; error = '';
    try {
      await bazarr.post(kind === 'movie' ? '/providers/movies' : '/providers/episodes', {
        ...(kind === 'movie' ? { radarrid: item.radarrId } : { seriesid: item.sonarrSeriesId, episodeid: item.sonarrEpisodeId }),
        hi: String(candidate.hearing_impaired || 'False'),
        forced: String(candidate.forced || 'False'),
        original_format: String(originalFormat),
        provider: candidate.provider,
        subtitle: candidate.subtitle,
      });
      onDownloaded();
    } catch (cause) { error = errorMessage(cause); }
    finally { busy = ''; }
  }
</script>

<div class="rad-modal-backdrop manual-backdrop" role="presentation" onclick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
  <div class="rad-modal manual-modal" role="dialog" aria-modal="true" aria-label={`Manual subtitle search for ${kind === 'movie' ? item.title : item.episodeTitle || item.title}`}>
    <div class="rad-modal-head"><div><h2>Manual subtitle search</h2><p class="rad-muted">{kind === 'movie' ? item.title : `${item.seriesTitle || 'Series'} · ${item.episode_number || ''} ${item.episodeTitle || item.title || ''}`}</p></div><button class="rad-button" onclick={onClose}>Close</button></div>
    <div class="rad-actions"><label class="rad-check"><input type="checkbox" bind:checked={originalFormat} /> Keep original subtitle format</label><button class="rad-button" onclick={search} disabled={loading}>Search again</button></div>
    {#if error}<p class="rad-error" role="alert">{error}</p>{/if}
    {#if loading}<p class="rad-muted">Searching providers…</p>{:else if !results.length}<p class="rad-empty">No subtitles found.</p>{:else}<div class="rad-list">{#each results as candidate, index (index)}<div class="rad-row"><div class="rad-row-main"><strong class="rad-row-title">{candidate.language || 'Unknown language'} · {candidate.provider}</strong><span class="rad-row-meta">Score {candidate.score ?? '—'} · {candidate.release_info?.join(', ') || 'No release details'}{candidate.forced === 'True' ? ' · Forced' : ''}{candidate.hearing_impaired === 'True' ? ' · HI' : ''}</span>{#if candidate.dont_matches?.length}<span class="rad-row-meta">Differences: {candidate.dont_matches.join(', ')}</span>{/if}</div><button class="rad-button" onclick={() => download(candidate)} disabled={!!busy}>Download</button></div>{/each}</div>{/if}
  </div>
</div>

<style>
  .manual-backdrop { z-index: 60; }
  .manual-modal { width: min(100%, 800px); }
  .rad-row-main { flex: 1; }
</style>
