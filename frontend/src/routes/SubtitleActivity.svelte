<script>
  import { onMount } from 'svelte';
  import { bazarr } from '../lib/bazarr.js';
  import { errorMessage } from '../lib/radarr.js';

  let { view } = $props();
  let mode = $state('movie');
  let movieHistory = $state([]);
  let episodeHistory = $state([]);
  let providers = $state([]);
  let health = $state([]);
  let loading = $state(true);
  let error = $state('');

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
    try {
      if (view === 'history') [movieHistory, episodeHistory] = await Promise.all([getAll('/movies/history'), getAll('/episodes/history')]);
      else {
        const [providerResult, healthResult] = await Promise.all([bazarr.get('/providers'), bazarr.get('/system/health')]);
        providers = providerResult.data || [];
        health = healthResult.data || [];
      }
    } catch (cause) { error = errorMessage(cause); }
    finally { loading = false; }
  }
  onMount(load);
  const records = $derived(mode === 'movie' ? movieHistory : episodeHistory);
</script>

<div class="activity">
  <div class="rad-head"><div><h2>{view === 'history' ? 'Subtitle history' : 'Subtitle providers'}</h2><p class="rad-muted">{view === 'history' ? `${movieHistory.length} movie events · ${episodeHistory.length} episode events` : `${providers.length} providers`}</p></div><button class="rad-button" onclick={load} disabled={loading}>Refresh</button></div>
  {#if error}<p class="rad-error" role="alert">{error}</p>{/if}
  {#if view === 'history'}
    <div class="rad-actions"><button class="rad-button" class:primary={mode === 'movie'} onclick={() => mode = 'movie'}>Movies</button><button class="rad-button" class:primary={mode === 'episode'} onclick={() => mode = 'episode'}>Episodes</button></div>
    {#if loading && !records.length}<p class="rad-muted">Loading history…</p>{:else if !records.length}<p class="rad-empty">No subtitle history yet.</p>{:else}<div class="rad-list">{#each records as event, index (index)}<div class="rad-row"><div class="rad-row-main"><strong class="rad-row-title">{mode === 'movie' ? event.title || `Movie ${event.radarrId}` : `${event.seriesTitle || 'Series'} · ${event.episode_number || ''} ${event.episodeTitle || ''}`}</strong><span class="rad-row-meta">{event.description || 'Subtitle event'}</span><span class="rad-row-meta">{event.timestamp || event.parsed_timestamp || '—'} · {event.provider || 'Local'}{event.score ? ` · ${event.score}` : ''}</span></div>{#if event.language?.name}<span class="rad-badge">{event.language.name}</span>{/if}</div>{/each}</div>{/if}
  {:else}
    {#if loading && !providers.length}<p class="rad-muted">Loading providers…</p>{:else if !providers.length}<p class="rad-empty">No subtitle providers configured.</p>{:else}<div class="rad-list">{#each providers as provider (provider.name)}<div class="rad-row"><div class="rad-row-main"><strong class="rad-row-title">{provider.name}</strong><span class="rad-row-meta">{provider.retry && provider.retry !== '-' ? `Retry ${provider.retry}` : 'Ready for searches'}</span></div><span class="rad-badge" class:good={provider.status === 'Good'} class:bad={provider.status !== 'Good'}>{provider.status || 'Unknown'}</span></div>{/each}</div>{/if}
    {#if health.length}<div class="rad-panel"><h3>Health</h3><div class="rad-list">{#each health as issue, index (index)}<div class="rad-row"><div class="rad-row-main"><strong class="rad-row-title">{issue.message || issue.title || 'Bazarr warning'}</strong><span class="rad-row-meta">{issue.type || issue.source || ''}</span></div></div>{/each}</div></div>{/if}
  {/if}
</div>

<style>
  .activity { display: grid; gap: 16px; }
  .activity h2, .activity h3 { color: var(--text); font-size: var(--text-lg); }
  .rad-row-main { flex: 1; }
</style>
