<script>
  import { onMount } from 'svelte';
  import { api } from '../lib/api.js';
  import { errorMessage, formatBytes, formatDate } from '../lib/radarr.js';
  import { episodeCode } from '../lib/sonarr.js';

  let { view } = $props();
  let records = $state([]);
  let totalRecords = $state(0);
  let page = $state(1);
  let weekOffset = $state(0);
  let loading = $state(true);
  let busy = $state(null);
  let error = $state('');
  let notice = $state('');
  const pageSize = 30;
  const pages = $derived(Math.max(1, Math.ceil(totalRecords / pageSize)));

  function weekBounds(offset) {
    const now = new Date();
    const monday = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
    monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7) + offset * 7);
    const end = new Date(monday);
    end.setUTCDate(end.getUTCDate() + 7);
    return { start: monday.toISOString(), end: end.toISOString() };
  }

  async function load() {
    loading = true; error = '';
    try {
      let data;
      if (view === 'wanted') data = await api.proxy.get('sonarr', '/api/v3/wanted/missing', { page, pageSize, includeSeries: true, sortKey: 'airDateUtc', sortDirection: 'descending' });
      else if (view === 'queue') data = await api.proxy.get('sonarr', '/api/v3/queue', { page, pageSize, includeSeries: true, includeEpisode: true });
      else if (view === 'history') data = await api.proxy.get('sonarr', '/api/v3/history', { page, pageSize, includeSeries: true, includeEpisode: true, sortKey: 'date', sortDirection: 'descending' });
      else data = await api.proxy.get('sonarr', '/api/v3/calendar', { ...weekBounds(weekOffset), includeSeries: true, unmonitored: false });
      records = Array.isArray(data) ? data : data.records || [];
      totalRecords = Array.isArray(data) ? data.length : data.totalRecords || 0;
    } catch (cause) { error = errorMessage(cause); records = []; }
    finally { loading = false; }
  }
  onMount(load);

  async function searchEpisode(episode) {
    busy = episode.id; error = ''; notice = '';
    try { await api.proxy.post('sonarr', '/api/v3/command', { name: 'EpisodeSearch', episodeIds: [episode.id] }); notice = `Search started for ${episodeCode(episode)}.`; }
    catch (cause) { error = errorMessage(cause); }
    finally { busy = null; }
  }

  async function removeQueue(item, blocklist) {
    if (!confirm(`${blocklist ? 'Blocklist and remove' : 'Remove'} this download from Sonarr?`)) return;
    busy = item.id; error = ''; notice = '';
    try { await api.proxy.delete('sonarr', `/api/v3/queue/${item.id}`, { removeFromClient: true, blocklist }); await load(); notice = blocklist ? 'Download blocklisted.' : 'Download removed.'; }
    catch (cause) { error = errorMessage(cause); }
    finally { busy = null; }
  }

  function changePage(next) { page = next; load(); }
  function changeWeek(delta) { weekOffset += delta; load(); }
</script>

<div class="activity">
  <div class="rad-head"><div><h2>{view === 'wanted' ? 'Missing episodes' : view === 'queue' ? 'TV downloads' : view === 'calendar' ? 'Upcoming episodes' : 'Episode history'}</h2><p class="rad-muted">{view === 'calendar' ? 'Airing this week' : `${totalRecords} records`}</p></div><div class="rad-actions">{#if view === 'calendar'}<button class="rad-button" onclick={() => changeWeek(-1)}>Previous week</button><button class="rad-button" onclick={() => { weekOffset = 0; load(); }}>This week</button><button class="rad-button" onclick={() => changeWeek(1)}>Next week</button>{/if}<button class="rad-button" onclick={load} disabled={loading}>Refresh</button></div></div>
  {#if error}<p class="rad-error" role="alert">{error}</p>{/if}
  {#if notice}<p class="rad-success" role="status">{notice}</p>{/if}
  {#if loading && !records.length}<p class="rad-muted">Loading…</p>
  {:else if !records.length}<p class="rad-empty">{view === 'queue' ? 'No TV downloads in progress.' : view === 'calendar' ? 'No episodes airing this week.' : view === 'wanted' ? 'No missing episodes.' : 'No history yet.'}</p>
  {:else}<div class="rad-list">{#each records as item (item.id)}<article class="rad-row"><div class="rad-row-main"><strong class="rad-row-title">{item.series?.title || item.seriesTitle || `Series ${item.seriesId || 'unknown'}`} · {item.episode ? episodeCode(item.episode) : item.seasonNumber !== undefined ? episodeCode(item) : ''} {item.episode?.title || item.title || ''}</strong><span class="rad-row-meta">{view === 'queue' ? `${item.status || 'Downloading'} · ${item.timeleft || '—'} left · ${formatBytes(item.sizeleft || item.size)}` : view === 'history' ? `${item.eventType || 'Event'} · ${formatDate(item.date)} · ${item.quality?.quality?.name || ''}` : `${formatDate(item.airDateUtc)} · ${item.monitored === false ? 'Unmonitored' : 'Monitored'}`}</span>{#if view === 'queue' && item.statusMessages?.length}<span class="rad-row-meta">{item.statusMessages.map((message) => message.title).join('; ')}</span>{/if}</div><div class="rad-actions">{#if view === 'wanted'}<button class="rad-button" onclick={() => searchEpisode(item)} disabled={busy === item.id}>Search</button>{:else if view === 'queue'}<button class="rad-button" onclick={() => removeQueue(item, false)} disabled={busy === item.id}>Remove</button><button class="rad-button danger" onclick={() => removeQueue(item, true)} disabled={busy === item.id}>Blocklist</button>{/if}</div></article>{/each}</div>{/if}
  {#if view !== 'calendar' && pages > 1}<div class="rad-actions"><button class="rad-button" onclick={() => changePage(page - 1)} disabled={page <= 1 || loading}>Previous</button><span class="rad-muted">Page {page} of {pages}</span><button class="rad-button" onclick={() => changePage(page + 1)} disabled={page >= pages || loading}>Next</button></div>{/if}
</div>

<style>
  .activity { display: grid; gap: 16px; }
  .activity h2 { color: var(--text); font-size: var(--text-lg); }
  .rad-row-main { flex: 1; }
</style>
