<script>
  import { onMount } from 'svelte';
  import { api } from '../lib/api.js';
  import { formatBytes, formatDate, errorMessage } from '../lib/radarr.js';

  let status = $state(null);
  let health = $state([]);
  let disks = $state([]);
  let loading = $state(true);
  let error = $state('');

  async function load() {
    loading = true;
    try {
      [status, health, disks] = await Promise.all([
        api.proxy.get('radarr', '/api/v3/system/status'),
        api.proxy.get('radarr', '/api/v3/health'),
        api.proxy.get('radarr', '/api/v3/diskspace')
      ]);
      error = '';
    } catch (cause) { error = errorMessage(cause); }
    finally { loading = false; }
  }
  onMount(load);
</script>

<div class="rad-page">
  <header class="rad-head"><div><h1>Radarr system</h1><p>Version, health, and storage</p></div><button class="rad-button" onclick={load} disabled={loading}>Refresh</button></header>
  {#if error}<p class="rad-error" role="alert">{error}</p>{/if}
  {#if loading && !status}<p class="rad-muted">Loading system status…</p>{:else if status}<div class="stats"><div class="rad-panel"><span class="rad-muted">Version</span><strong>{status.version || '—'}</strong><span class="rad-muted">{status.branch || ''}</span></div><div class="rad-panel"><span class="rad-muted">Runtime</span><strong>{status.runtimeName || 'Radarr'}</strong><span class="rad-muted">{status.runtimeVersion || ''}</span></div><div class="rad-panel"><span class="rad-muted">Platform</span><strong>{status.osName || '—'}</strong><span class="rad-muted">{status.isDocker ? 'Docker' : status.osVersion || ''}</span></div><div class="rad-panel"><span class="rad-muted">Started</span><strong>{formatDate(status.startTime)}</strong><span class="rad-muted">Database: {status.databaseType || '—'}</span></div></div>{/if}
  <section class="rad-panel"><h2>Health</h2>{#if health.length === 0}<p class="rad-success">No Radarr health issues reported.</p>{:else}<div class="rad-list">{#each health as item (item.id)}<div class="rad-row"><div class="rad-row-main"><strong class="rad-row-title">{item.source}</strong><span class="rad-row-meta">{item.message}</span></div><span class="rad-badge" class:bad={item.type === 'error'} class:warn={item.type === 'warning'}>{item.type}</span></div>{/each}</div>{/if}</section>
  <section class="rad-panel"><h2>Disk space</h2>{#if disks.length === 0}<p class="rad-muted">No storage volumes reported.</p>{:else}<div class="rad-list">{#each disks as disk (disk.id)}<div class="rad-row"><div class="rad-row-main"><strong class="rad-row-title">{disk.label || disk.path}</strong><span class="rad-row-meta">{disk.path}</span></div><span class="rad-badge">{formatBytes(disk.freeSpace)} free of {formatBytes(disk.totalSpace)}</span></div>{/each}</div>{/if}</section>
</div>

<style>.stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; } .stats .rad-panel { display: grid; gap: 5px; } .stats strong { color: var(--text); font-size: var(--text-lg); } section.rad-panel h2 { color: var(--text); font-size: var(--text-lg); margin-bottom: 12px; }</style>
