<script>
  import { onMount } from 'svelte';
  import { api } from '../lib/api.js';
  import { errorMessage } from '../lib/radarr.js';

  let sessions = $state([]);
  let configured = $state(true);
  let loading = $state(true);
  let error = $state('');
  let lastUpdated = $state(null);
  let timer;

  const playing = $derived(sessions.filter((session) => !session.paused).length);
  const paused = $derived(sessions.filter((session) => session.paused).length);
  const image = (session) => session.item.imageItemId ? `/api/jellyfin/images/${session.item.imageItemId}` : null;
  const progress = (session) => session.durationSeconds > 0 ? Math.min(100, Math.max(0, Math.round(session.positionSeconds / session.durationSeconds * 100))) : 0;
  const clock = (seconds) => {
    const value = Math.max(0, Math.floor(seconds || 0));
    return `${Math.floor(value / 3600) ? `${Math.floor(value / 3600)}:` : ''}${String(Math.floor(value % 3600 / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
  };
  const subtitle = (item) => item.type === 'Episode' ? [item.seriesName, item.seasonName, item.episodeIndex == null ? '' : `Episode ${item.episodeIndex}`].filter(Boolean).join(' · ') : item.type || 'Video';

  async function load() {
    loading = true;
    try {
      configured = (await api.services()).some((service) => service.name === 'jellyfin');
      if (!configured) { sessions = []; error = ''; return; }
      sessions = await api.get('/api/jellyfin/now-watching');
      lastUpdated = new Date();
      error = '';
    } catch (cause) { error = errorMessage(cause); }
    finally { loading = false; }
  }

  onMount(() => {
    load();
    timer = setInterval(load, 10_000);
    return () => clearInterval(timer);
  });
</script>

<div class="rad-page">
  <header class="rad-head"><div><h1>Now watching</h1><p>Live playback from Jellyfin · updates every 10 seconds{lastUpdated ? ` · Updated ${lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}</p></div><button class="rad-button" onclick={load} disabled={loading}>Refresh</button></header>

  {#if error}<p class="rad-error" role="alert">{error}</p>{/if}
  {#if !configured}<p class="rad-empty">Jellyfin is not connected. Add a Jellyfin API key to Hmmarr’s configuration.</p>{:else}
    <div class="stats"><div class="rad-panel stat"><strong>{sessions.length}</strong><span>Watching</span></div><div class="rad-panel stat"><strong>{playing}</strong><span>Playing</span></div><div class="rad-panel stat"><strong>{paused}</strong><span>Paused</span></div></div>
    {#if loading && !sessions.length}<p class="rad-muted">Checking current playback…</p>{:else if !sessions.length}<p class="rad-empty">Nobody is watching right now.</p>{:else}
      <div class="watch-grid">{#each sessions as session, index (session.userName + '-' + session.client + '-' + index)}<article class="rad-panel watch-card"><div class="art">{#if image(session)}<img src={image(session)} alt="" loading="lazy" />{:else}<span>No artwork</span>{/if}</div><div class="watch-content"><div class="watch-head"><div><h2>{session.item.name}</h2><p>{subtitle(session.item)}</p></div><span class="rad-badge" class:good={!session.paused}>{session.paused ? 'Paused' : 'Playing'}</span></div><div class="viewer"><strong>{session.userName}</strong><span>{session.deviceName || session.client}{session.deviceName && session.client ? ` · ${session.client}` : ''}</span></div><div class="timeline"><div class="progress" role="progressbar" aria-label={'Progress for ' + session.item.name} aria-valuenow={progress(session)} aria-valuemin="0" aria-valuemax="100"><span style:width={`${progress(session)}%`}></span></div><span>{clock(session.positionSeconds)} / {session.durationSeconds ? clock(session.durationSeconds) : '—'} · {progress(session)}%</span></div><div class="method">{session.playMethod || 'Playback method unknown'}{session.transcoding ? ` · Transcoding${session.videoCodec ? ` ${session.videoCodec}` : ''}` : ''}</div></div></article>{/each}</div>
    {/if}
  {/if}
</div>

<style>
  .stats { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
  .stat { display: grid; gap: 4px; padding: 14px; }
  .stat strong { color: var(--text); font-size: var(--text-lg); }
  .stat span { color: var(--text-muted); font-size: var(--text-xs); }
  .watch-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
  .watch-card { display: flex; gap: 16px; min-width: 0; }
  .art { width: 112px; aspect-ratio: 2 / 3; flex-shrink: 0; border-radius: var(--radius-md); background: var(--surface-2); overflow: hidden; display: grid; place-items: center; color: var(--text-muted); font-size: var(--text-xs); text-align: center; }
  .art img { width: 100%; height: 100%; object-fit: cover; }
  .watch-content { display: grid; align-content: space-between; gap: 12px; min-width: 0; flex: 1; }
  .watch-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; }
  .watch-head h2 { color: var(--text); font-size: var(--text-base); overflow-wrap: anywhere; }
  .watch-head p, .viewer span, .timeline > span, .method { color: var(--text-muted); font-size: var(--text-xs); }
  .viewer { display: grid; gap: 3px; }
  .viewer strong { color: var(--text); font-size: var(--text-sm); }
  .timeline { display: grid; gap: 5px; }
  .progress { height: 5px; border-radius: 8px; overflow: hidden; background: var(--surface-2); }
  .progress span { display: block; height: 100%; background: var(--accent); }
  @media (max-width: 940px) { .watch-grid { grid-template-columns: 1fr; } }
  @media (max-width: 480px) { .art { width: 86px; } .watch-head { display: grid; } }
</style>
