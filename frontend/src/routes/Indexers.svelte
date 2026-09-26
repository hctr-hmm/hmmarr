<script>
  import { onMount } from 'svelte';
  import { api } from '../lib/api.js';
  import { errorMessage } from '../lib/radarr.js';
  import ProwlarrEditor from './ProwlarrEditor.svelte';
  import ProwlarrSearch from './ProwlarrSearch.svelte';
  import ProwlarrActivity from './ProwlarrActivity.svelte';

  const tabs = [
    { id: 'indexers', label: 'Indexers' },
    { id: 'search', label: 'Search' },
    { id: 'activity', label: 'Activity' },
    { id: 'apps', label: 'Apps' },
  ];
  let tab = $state('indexers');
  let indexers = $state([]);
  let statuses = $state([]);
  let stats = $state([]);
  let apps = $state([]);
  let profiles = $state([]);
  let tags = $state([]);
  let loading = $state(true);
  let error = $state('');
  let notice = $state('');
  let query = $state('');
  let filter = $state('all');
  let busy = $state('');
  let editor = $state(null);

  async function load() {
    loading = true; error = '';
    try {
      const [indexerData, statusData, statsData, appData, profileData, tagData] = await Promise.all([
        api.proxy.get('prowlarr', '/api/v1/indexer'),
        api.proxy.get('prowlarr', '/api/v1/indexerstatus'),
        api.proxy.get('prowlarr', '/api/v1/indexerstats'),
        api.proxy.get('prowlarr', '/api/v1/applications'),
        api.proxy.get('prowlarr', '/api/v1/appprofile'),
        api.proxy.get('prowlarr', '/api/v1/tag'),
      ]);
      indexers = indexerData; statuses = statusData; stats = statsData.indexers || [];
      apps = appData; profiles = profileData; tags = tagData;
    } catch (cause) { error = `Could not load Prowlarr: ${errorMessage(cause)}`; }
    finally { loading = false; }
  }
  onMount(load);

  const visible = $derived(indexers.filter((item) => {
    if (query && !`${item.name} ${item.definitionName || ''}`.toLowerCase().includes(query.trim().toLowerCase())) return false;
    if (filter === 'enabled') return item.enable;
    if (filter === 'disabled') return !item.enable;
    if (filter === 'issues') return statuses.some((status) => status.indexerId === item.id);
    if (filter === 'torrent' || filter === 'usenet') return item.protocol === filter;
    return true;
  }).sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })));
  const enabledCount = $derived(indexers.filter((item) => item.enable).length);

  async function toggle(item) {
    busy = `indexer-${item.id}`; error = ''; notice = '';
    try {
      const updated = await api.proxy.put('prowlarr', `/api/v1/indexer/${item.id}`, { ...item, enable: !item.enable });
      indexers = indexers.map((entry) => entry.id === item.id ? updated : entry);
      notice = `${item.name} ${updated.enable ? 'enabled' : 'disabled'}.`;
    } catch (cause) { error = errorMessage(cause); }
    finally { busy = ''; }
  }

  async function test(kind, item) {
    busy = `${kind}-${item.id}`; error = ''; notice = '';
    try {
      await api.proxy.post('prowlarr', kind === 'indexer' ? '/api/v1/indexer/test' : '/api/v1/applications/test', item);
      notice = `${item.name} connection passed.`;
    } catch (cause) { error = errorMessage(cause); }
    finally { busy = ''; }
  }

  async function syncApps() {
    busy = 'sync'; error = ''; notice = '';
    try { await api.proxy.post('prowlarr', '/api/v1/command', { name: 'ApplicationIndexerSync' }); notice = 'App indexer sync started.'; }
    catch (cause) { error = errorMessage(cause); }
    finally { busy = ''; }
  }

  function closeEditor() { editor = null; load(); }
</script>

<div class="rad-page">
  <header class="rad-head"><div><h1>Indexers</h1><p>{indexers.length} indexers · {enabledCount} enabled · {statuses.length} with recent failures · {apps.length} linked apps</p></div><div class="rad-actions"><button class="rad-button primary" onclick={() => editor = { kind: 'indexer', item: null }}>Add indexer</button><button class="rad-button" onclick={load} disabled={loading}>Refresh</button></div></header>
  <div class="rad-actions tabs" role="tablist" aria-label="Prowlarr sections">{#each tabs as section}<button class="rad-button" class:primary={tab === section.id} role="tab" aria-selected={tab === section.id} onclick={() => tab = section.id}>{section.label}</button>{/each}</div>
  {#if error}<p class="rad-error" role="alert">{error}</p>{/if}{#if notice}<p class="rad-success" role="status">{notice}</p>{/if}

  {#if tab === 'indexers'}
    <div class="rad-toolbar"><input class="rad-input search" type="search" bind:value={query} placeholder="Search indexers…" aria-label="Search indexers" /><select class="rad-select" bind:value={filter} aria-label="Filter indexers"><option value="all">All</option><option value="enabled">Enabled</option><option value="disabled">Disabled</option><option value="issues">Recent failures</option><option value="torrent">Torrents</option><option value="usenet">Usenet</option></select></div>
    {#if loading && !indexers.length}<p class="rad-muted">Loading indexers…</p>{:else if !visible.length}<p class="rad-empty">{query || filter !== 'all' ? 'No indexers match.' : 'No indexers configured yet.'}</p>{:else}<div class="indexer-grid">{#each visible as item (item.id)}{@const status = statuses.find((entry) => entry.indexerId === item.id)}{@const stat = stats.find((entry) => entry.indexerId === item.id)}<article class="rad-panel indexer-card"><div class="card-head"><div><h2>{item.name}</h2><p class="rad-muted">{item.protocol || 'Indexer'} · {item.privacy || 'Unknown'} · priority {item.priority ?? '—'}</p></div><span class="rad-badge" class:good={item.enable && !status} class:warn={item.enable && !!status}>{!item.enable ? 'Disabled' : status ? 'Recent failure' : 'Enabled'}</span></div><div class="stat-line"><span>{stat?.numberOfQueries || 0} searches</span><span>{stat?.numberOfGrabs || 0} grabs</span><span>{stat?.averageResponseTime || 0} ms average</span></div><div class="rad-actions"><button class="rad-button" onclick={() => toggle(item)} disabled={!!busy}>{item.enable ? 'Disable' : 'Enable'}</button><button class="rad-button" onclick={() => test('indexer', item)} disabled={!!busy}>Test</button><button class="rad-button" onclick={() => editor = { kind: 'indexer', item }}>Edit</button></div></article>{/each}</div>{/if}
  {:else if tab === 'search'}<ProwlarrSearch {indexers} />
  {:else if tab === 'activity'}<ProwlarrActivity {indexers} {stats} />
  {:else}
    <div class="rad-head"><div><h2 class="section-title">Connected apps</h2><p class="rad-muted">Prowlarr can keep your media apps’ indexers in sync.</p></div><div class="rad-actions"><button class="rad-button primary" onclick={() => editor = { kind: 'application', item: null }}>Add app</button><button class="rad-button" onclick={syncApps} disabled={!!busy}>Sync indexers</button></div></div>
    {#if !apps.length}<p class="rad-empty">No apps connected to Prowlarr.</p>{:else}<div class="rad-list">{#each apps as app (app.id)}<article class="rad-row"><div class="rad-row-main"><strong class="rad-row-title">{app.name}</strong><span class="rad-row-meta">{app.implementation} · {app.syncLevel || 'Unknown sync'} · {app.enable ? 'Enabled' : 'Disabled'}</span></div><div class="rad-actions"><button class="rad-button" onclick={() => test('application', app)} disabled={!!busy}>Test</button><button class="rad-button" onclick={() => editor = { kind: 'application', item: app }}>Edit</button></div></article>{/each}</div>{/if}
  {/if}
</div>

{#if editor}<ProwlarrEditor kind={editor.kind} item={editor.item} {profiles} {tags} existingNames={(editor.kind === 'indexer' ? indexers : apps).map((entry) => entry.name)} onClose={() => editor = null} onSaved={closeEditor} onDeleted={closeEditor} />{/if}

<style>
  .tabs { border-bottom: 1px solid var(--border); padding-bottom: 12px; }
  .search { flex: 1; min-width: 180px; }
  .section-title { color: var(--text); font-size: var(--text-lg); }
  .indexer-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 12px; }
  .indexer-card { display: grid; gap: 14px; }
  .card-head { display: flex; justify-content: space-between; align-items: start; gap: 10px; }
  .card-head h2 { color: var(--text); font-size: var(--text-base); }
  .card-head p { text-transform: capitalize; }
  .stat-line { display: flex; flex-wrap: wrap; gap: 8px; color: var(--text-muted); font-size: var(--text-xs); }
  .stat-line span { padding: 4px 6px; background: var(--surface-2); border-radius: 4px; }
  .rad-row-main { flex: 1; }
</style>
