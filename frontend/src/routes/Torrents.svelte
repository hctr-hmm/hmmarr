<script>
  import { onMount } from 'svelte';
  import { api } from '../lib/api.js';
  import { formatBytes, errorMessage } from '../lib/radarr.js';

  let torrents = $state([]);
  let categories = $state({});
  let transfer = $state(null);
  let version = $state('');
  let configured = $state(true);
  let loading = $state(true);
  let error = $state('');
  let notice = $state('');
  let busy = $state('');
  let filter = $state('all');
  let category = $state('all');
  let query = $state('');
  let sort = $state('added');
  let selected = $state(null);
  let detailTab = $state('files');
  let details = $state(null);
  let detailLoading = $state(false);
  let link = $state('');
  let addCategory = $state('');
  let addPaused = $state(false);
  let showAdd = $state(false);
  let timer;

  const paused = (item) => /paused|stopped/i.test(item.state || '');
  const active = (item) => (item.dlspeed || 0) > 0 || (item.upspeed || 0) > 0;
  const filtered = $derived(torrents.filter((item) => {
    if (query && !`${item.name} ${item.hash} ${item.tags}`.toLowerCase().includes(query.toLowerCase().trim())) return false;
    if (category !== 'all' && item.category !== category) return false;
    if (filter === 'downloading' && (item.progress >= 1 || paused(item))) return false;
    if (filter === 'completed' && item.progress < 1) return false;
    if (filter === 'paused' && !paused(item)) return false;
    if (filter === 'active' && !active(item)) return false;
    if (filter === 'error' && !/error|missing/i.test(item.state || '')) return false;
    return true;
  }).sort((a, b) => sort === 'name' ? a.name.localeCompare(b.name) : sort === 'progress' ? b.progress - a.progress : sort === 'size' ? b.size - a.size : b.added_on - a.added_on));
  const downloading = $derived(torrents.filter((item) => item.progress < 1 && !paused(item)).length);
  const completed = $derived(torrents.filter((item) => item.progress >= 1).length);

  function speed(value) { return `${formatBytes(value || 0)}/s`; }
  function eta(value) {
    if (!Number.isFinite(value) || value < 0 || value >= 8_640_000) return '—';
    if (value < 3600) return `${Math.ceil(value / 60)}m`;
    if (value < 86400) return `${Math.floor(value / 3600)}h ${Math.floor(value % 3600 / 60)}m`;
    return `${Math.floor(value / 86400)}d ${Math.floor(value % 86400 / 3600)}h`;
  }
  function date(value) { return value ? new Date(value * 1000).toLocaleDateString() : '—'; }

  async function load(silent = false) {
    if (!silent) loading = true;
    try {
      const services = await api.services();
      configured = services.some((service) => service.name === 'qbittorrent');
      if (!configured) { error = ''; return; }
      const [items, categoryData, transferData, appVersion] = await Promise.all([
        api.qbittorrent.get('torrents/info'),
        api.qbittorrent.get('torrents/categories'),
        api.qbittorrent.get('transfer/info'),
        api.qbittorrent.get('app/version'),
      ]);
      torrents = Array.isArray(items) ? items : [];
      categories = categoryData || {};
      transfer = transferData;
      version = String(appVersion || '');
      error = '';
      if (selected) selected = torrents.find((item) => item.hash === selected.hash) || null;
    } catch (cause) { error = errorMessage(cause); }
    finally { loading = false; }
  }

  onMount(() => {
    load();
    timer = setInterval(() => load(true), 15_000);
    return () => clearInterval(timer);
  });

  async function open(item) {
    selected = item;
    detailTab = 'files';
    detailLoading = true;
    details = null;
    try {
      const [properties, files, trackers] = await Promise.all([
        api.qbittorrent.get('torrents/properties', { hash: item.hash }),
        api.qbittorrent.get('torrents/files', { hash: item.hash }),
        api.qbittorrent.get('torrents/trackers', { hash: item.hash }),
      ]);
      details = { properties, files, trackers };
    } catch (cause) { error = errorMessage(cause); }
    finally { detailLoading = false; }
  }

  async function action(item, kind) {
    const title = item.name;
    if (kind === 'delete' && !confirm(`Remove “${title}” from qBittorrent? Downloaded files will be kept.`)) return;
    if (kind === 'deleteFiles' && !confirm(`Remove “${title}” and delete its downloaded files? This cannot be undone.`)) return;
    busy = item.hash;
    error = '';
    notice = '';
    try {
      const route = kind === 'deleteFiles' ? 'delete' : kind;
      const actual = route === 'pause' ? (version.startsWith('v5') || version.startsWith('5') ? 'stop' : 'pause') : route === 'resume' ? (version.startsWith('v5') || version.startsWith('5') ? 'start' : 'resume') : route;
      await api.qbittorrent.post(`torrents/${actual}`, { hashes: item.hash, ...(route === 'delete' ? { deleteFiles: kind === 'deleteFiles' } : {}) });
      notice = `${title}: ${kind === 'deleteFiles' ? 'removed with files' : kind === 'delete' ? 'removed' : kind === 'pause' ? 'paused' : kind === 'resume' ? 'resumed' : kind === 'recheck' ? 'checking' : 'announced'}.`;
      if (route === 'delete') { selected = null; details = null; }
      await load(true);
    } catch (cause) { error = errorMessage(cause); }
    finally { busy = ''; }
  }

  async function setCategory(item, value) {
    busy = item.hash; error = '';
    try {
      await api.qbittorrent.post('torrents/setCategory', { hashes: item.hash, category: value });
      notice = `Category updated for ${item.name}.`;
      await load(true);
    } catch (cause) { error = errorMessage(cause); }
    finally { busy = ''; }
  }

  async function setFilePriority(file, priority) {
    if (!selected) return;
    busy = selected.hash; error = '';
    try {
      await api.qbittorrent.post('torrents/filePrio', { hash: selected.hash, id: file.index, priority });
      details = { ...details, files: await api.qbittorrent.get('torrents/files', { hash: selected.hash }) };
    } catch (cause) { error = errorMessage(cause); }
    finally { busy = ''; }
  }

  async function add(event) {
    event.preventDefault();
    busy = 'add'; error = ''; notice = '';
    try {
      await api.qbittorrent.post('torrents/add', { urls: link.trim(), ...(addCategory ? { category: addCategory } : {}), paused: addPaused });
      link = '';
      showAdd = false;
      notice = 'Torrent link sent to qBittorrent.';
      await load(true);
    } catch (cause) { error = errorMessage(cause); }
    finally { busy = ''; }
  }
</script>

<div class="rad-page">
  <header class="rad-head"><div><h1>Torrents</h1><p>qBittorrent{version ? ` ${version}` : ''} · updates every 15 seconds</p></div><div class="rad-actions"><button class="rad-button primary" onclick={() => showAdd = !showAdd} disabled={!configured}>Add link</button><button class="rad-button" onclick={() => load()} disabled={loading}>Refresh</button></div></header>

  {#if error}<p class="rad-error" role="alert">{error}</p>{/if}
  {#if notice}<p class="rad-success" role="status">{notice}</p>{/if}
  {#if !configured}<p class="rad-empty">qBittorrent is not connected. Add its Web UI address and credentials to Hmmarr’s configuration.</p>{:else}
    {#if showAdd}
      <form class="rad-panel add-form" onsubmit={add}>
        <h2>Add a torrent link</h2>
        <label class="rad-field">Magnet or torrent URL<input class="rad-input" type="text" bind:value={link} placeholder="magnet:?xt=… or https://…/file.torrent" required /></label>
        <div class="rad-actions"><label class="rad-field">Category<select class="rad-select" bind:value={addCategory}><option value="">No category</option>{#each Object.keys(categories) as name}<option value={name}>{name}</option>{/each}</select></label><label class="check"><input type="checkbox" bind:checked={addPaused} /> Start paused</label></div>
        <div class="rad-actions"><button class="rad-button primary" type="submit" disabled={!!busy}>{busy === 'add' ? 'Adding…' : 'Add torrent'}</button><button class="rad-button" type="button" onclick={() => showAdd = false}>Cancel</button></div>
      </form>
    {/if}

    <div class="stats">
      <div class="rad-panel stat"><strong>{torrents.length}</strong><span>Total</span></div>
      <div class="rad-panel stat"><strong>{downloading}</strong><span>Downloading</span></div>
      <div class="rad-panel stat"><strong>{completed}</strong><span>Completed</span></div>
      <div class="rad-panel stat"><strong>↓ {speed(transfer?.dl_info_speed)}</strong><span>Download</span></div>
      <div class="rad-panel stat"><strong>↑ {speed(transfer?.up_info_speed)}</strong><span>Upload</span></div>
    </div>

    <div class="rad-toolbar filters"><input class="rad-input search" type="search" bind:value={query} placeholder="Search torrents…" aria-label="Search torrents" /><select class="rad-select" bind:value={filter} aria-label="Filter torrents"><option value="all">All states</option><option value="downloading">Downloading</option><option value="completed">Completed</option><option value="paused">Paused</option><option value="active">Active</option><option value="error">Errors</option></select><select class="rad-select" bind:value={category} aria-label="Filter category"><option value="all">All categories</option>{#each Object.keys(categories) as name}<option value={name}>{name}</option>{/each}</select><select class="rad-select" bind:value={sort} aria-label="Sort torrents"><option value="added">Newest</option><option value="name">Name</option><option value="progress">Progress</option><option value="size">Size</option></select></div>
    {#if loading && !torrents.length}<p class="rad-muted">Loading torrents…</p>{:else if !filtered.length}<p class="rad-empty">{torrents.length ? 'No torrents match these filters.' : 'No torrents yet.'}</p>{:else}
      <div class="rad-list">
        {#each filtered as item (item.hash)}
          <article class="rad-row torrent-row"><div class="rad-row-main"><button class="torrent-title" onclick={() => open(item)}>{item.name}</button><div class="rad-row-meta">{item.category || 'No category'} · {item.state} · {formatBytes(item.size)} · added {date(item.added_on)}</div><div class="progress" role="progressbar" aria-label={'Progress for ' + item.name} aria-valuenow={Math.round(item.progress * 100)} aria-valuemin="0" aria-valuemax="100"><span style:width={`${Math.round(item.progress * 100)}%`}></span></div><div class="rad-row-meta">{Math.round(item.progress * 100)}% · ↓ {speed(item.dlspeed)} · ↑ {speed(item.upspeed)} · ETA {eta(item.eta)} · {item.num_seeds || 0} seeds</div></div><div class="rad-actions"><button class="rad-button" onclick={() => action(item, paused(item) ? 'resume' : 'pause')} disabled={!!busy}>{paused(item) ? 'Resume' : 'Pause'}</button><button class="rad-button" onclick={() => open(item)}>Details</button></div></article>
        {/each}
      </div>
    {/if}

    {#if selected}
      <section class="rad-panel detail"><div class="rad-head"><div><h2>{selected.name}</h2><p>{selected.hash}</p></div><button class="rad-button" onclick={() => selected = null}>Close</button></div><div class="rad-actions"><button class="rad-button" onclick={() => action(selected, paused(selected) ? 'resume' : 'pause')} disabled={!!busy}>{paused(selected) ? 'Resume' : 'Pause'}</button><button class="rad-button" onclick={() => action(selected, 'recheck')} disabled={!!busy}>Recheck</button><button class="rad-button" onclick={() => action(selected, 'reannounce')} disabled={!!busy}>Reannounce</button><button class="rad-button danger" onclick={() => action(selected, 'delete')} disabled={!!busy}>Remove</button><button class="rad-button danger" onclick={() => action(selected, 'deleteFiles')} disabled={!!busy}>Remove with files</button></div><label class="rad-field">Category<select class="rad-select" value={selected.category || ''} onchange={(event) => setCategory(selected, event.currentTarget.value)} disabled={!!busy}><option value="">No category</option>{#each Object.keys(categories) as name}<option value={name}>{name}</option>{/each}</select></label><div class="rad-actions" role="tablist" aria-label="Torrent details">{#each ['files', 'trackers', 'information'] as tab}<button class="rad-button" class:primary={detailTab === tab} role="tab" aria-selected={detailTab === tab} onclick={() => detailTab = tab}>{tab[0].toUpperCase() + tab.slice(1)}</button>{/each}</div>
        {#if detailLoading}<p class="rad-muted">Loading details…</p>{:else if details}
          {#if detailTab === 'files'}<div class="rad-list">{#each details.files || [] as file (file.index)}<div class="rad-row"><div class="rad-row-main"><strong class="rad-row-title">{file.name}</strong><span class="rad-row-meta">{formatBytes(file.size)} · {Math.round(file.progress * 100)}%</span></div><select class="rad-select" value={file.priority} aria-label={'Priority for ' + file.name} onchange={(event) => setFilePriority(file, event.currentTarget.value)} disabled={!!busy}><option value="0">Skip</option><option value="1">Normal</option><option value="6">High</option><option value="7">Maximum</option></select></div>{/each}</div>
          {:else if detailTab === 'trackers'}<div class="rad-list">{#each details.trackers || [] as tracker, index (tracker.url + index)}<div class="rad-row"><div class="rad-row-main"><strong class="rad-row-title">{tracker.url}</strong><span class="rad-row-meta">{tracker.msg || tracker.status} · {tracker.num_seeds || 0} seeds · {tracker.num_peers || 0} peers</span></div></div>{/each}</div>
          {:else}<div class="info-grid"><div><span>Save path</span><strong>{details.properties?.save_path || selected.save_path || '—'}</strong></div><div><span>Size</span><strong>{formatBytes(selected.size)}</strong></div><div><span>Downloaded</span><strong>{formatBytes(details.properties?.total_downloaded)}</strong></div><div><span>Uploaded</span><strong>{formatBytes(details.properties?.total_uploaded)}</strong></div><div><span>Ratio</span><strong>{Number(selected.ratio || 0).toFixed(2)}</strong></div><div><span>Added</span><strong>{date(selected.added_on)}</strong></div></div>{/if}
        {/if}
      </section>
    {/if}
  {/if}
</div>

<style>
  .stats { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 10px; }
  .stat { display: grid; gap: 4px; padding: 14px; }
  .stat strong { color: var(--text); font-size: var(--text-lg); white-space: nowrap; }
  .stat span { color: var(--text-muted); font-size: var(--text-xs); }
  .filters { display: flex; flex-wrap: wrap; gap: 8px; }
  .filters .search { flex: 1; min-width: 190px; }
  .torrent-row { align-items: center; }
  .torrent-title { border: 0; background: none; color: var(--text); font-size: var(--text-sm); font-weight: 700; text-align: left; overflow-wrap: anywhere; }
  .torrent-title:hover { color: var(--accent); }
  .progress { height: 5px; margin: 10px 0 8px; border-radius: 9px; background: var(--surface-2); overflow: hidden; }
  .progress span { display: block; height: 100%; background: var(--accent); }
  .detail, .add-form { display: grid; gap: 16px; }
  .detail h2, .add-form h2 { color: var(--text); font-size: var(--text-lg); overflow-wrap: anywhere; }
  .detail .rad-head p { color: var(--text-muted); font-size: var(--text-xs); overflow-wrap: anywhere; }
  .check { display: flex; align-items: center; gap: 8px; color: var(--text); }
  .info-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 14px; }
  .info-grid div { display: grid; gap: 3px; min-width: 0; }
  .info-grid span { color: var(--text-muted); font-size: var(--text-xs); }
  .info-grid strong { color: var(--text); font-size: var(--text-sm); overflow-wrap: anywhere; }
  @media (max-width: 900px) { .stats { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
  @media (max-width: 580px) { .stats { grid-template-columns: repeat(2, minmax(0, 1fr)); } .torrent-row { display: grid; } }
</style>
