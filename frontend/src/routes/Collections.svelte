<script>
  import { onMount } from 'svelte';
  import { api } from '../lib/api.js';
  import { errorMessage } from '../lib/radarr.js';

  let collections = $state([]);
  let profiles = $state([]);
  let roots = $state([]);
  let query = $state('');
  let selected = $state(null);
  let loading = $state(true);
  let busy = $state(false);
  let error = $state('');
  let notice = $state('');
  let monitored = $state(false);
  let searchOnAdd = $state(false);
  let profileId = $state('');
  let rootFolderPath = $state('');
  let minimumAvailability = $state('released');
  const visible = $derived(collections.filter((item) => item.title.toLowerCase().includes(query.toLowerCase())).sort((a, b) => a.sortTitle?.localeCompare(b.sortTitle) || a.title.localeCompare(b.title)));

  async function load() {
    loading = true;
    try {
      [collections, profiles, roots] = await Promise.all([
        api.proxy.get('radarr', '/api/v3/collection'),
        api.proxy.get('radarr', '/api/v3/qualityprofile'),
        api.proxy.get('radarr', '/api/v3/rootfolder')
      ]);
      error = '';
    } catch (cause) { error = errorMessage(cause); }
    finally { loading = false; }
  }

  onMount(load);
  function open(item) {
    selected = item;
    monitored = Boolean(item.monitored);
    searchOnAdd = Boolean(item.searchOnAdd);
    profileId = String(item.qualityProfileId || profiles[0]?.id || '');
    rootFolderPath = item.rootFolderPath || roots[0]?.path || '';
    minimumAvailability = item.minimumAvailability || 'released';
    notice = '';
  }

  async function save() {
    if (!selected) return;
    busy = true; error = ''; notice = '';
    try {
      const updated = await api.proxy.put('radarr', `/api/v3/collection/${selected.id}`, {
        ...selected, monitored, searchOnAdd, qualityProfileId: Number(profileId), rootFolderPath, minimumAvailability
      });
      collections = collections.map((item) => item.id === selected.id ? updated : item);
      selected = updated;
      notice = 'Collection updated.';
    } catch (cause) { error = errorMessage(cause); }
    finally { busy = false; }
  }
</script>

<div class="rad-page">
  <header class="rad-head"><div><h1>Collections</h1><p>{collections.length} movie collections</p></div><div class="rad-actions"><input class="rad-input" type="search" bind:value={query} placeholder="Filter collections" aria-label="Filter collections" /><button class="rad-button" onclick={load} disabled={loading}>Refresh</button></div></header>
  {#if error && !selected}<p class="rad-error" role="alert">{error}</p>{/if}
  {#if loading && !collections.length}<p class="rad-muted">Loading collections…</p>{:else if !visible.length}<p class="rad-empty">No collections found.</p>{:else}<div class="rad-list">{#each visible as item (item.id)}<article class="rad-row"><div class="rad-row-main"><strong class="rad-row-title">{item.title}</strong><span class="rad-row-meta">{item.movies?.length || 0} movies · {item.missingMovies || 0} missing from library</span></div><div class="rad-actions"><span class="rad-badge" class:good={item.monitored}>{item.monitored ? 'Monitored' : 'Unmonitored'}</span><button class="rad-button" onclick={() => open(item)}>Manage</button></div></article>{/each}</div>{/if}
</div>

{#if selected}<div class="rad-modal-backdrop" role="presentation" onclick={(event) => { if (event.target === event.currentTarget) selected = null; }}><div class="rad-modal collection-modal" role="dialog" aria-modal="true" aria-label={`Manage ${selected.title}`}><div class="rad-modal-head"><div><h2>{selected.title}</h2><p class="rad-muted">{selected.movies?.length || 0} movies in collection</p></div><button class="rad-button" onclick={() => selected = null}>Close</button></div>{#if error}<p class="rad-error" role="alert">{error}</p>{/if}{#if notice}<p class="rad-success" role="status">{notice}</p>{/if}<p class="rad-muted">{selected.overview || 'No description available.'}</p><div class="rad-fields"><label class="rad-field">Root folder<select class="rad-select" bind:value={rootFolderPath}>{#each roots as root}<option value={root.path}>{root.path}</option>{/each}</select></label><label class="rad-field">Quality profile<select class="rad-select" bind:value={profileId}>{#each profiles as profile}<option value={String(profile.id)}>{profile.name}</option>{/each}</select></label><label class="rad-field">Minimum availability<select class="rad-select" bind:value={minimumAvailability}><option value="announced">Announced</option><option value="inCinemas">In cinemas</option><option value="released">Released</option></select></label></div><div class="rad-actions"><label class="rad-check"><input type="checkbox" bind:checked={monitored} /> Monitor collection</label><label class="rad-check"><input type="checkbox" bind:checked={searchOnAdd} /> Search new movies when added</label></div><button class="rad-button primary" onclick={save} disabled={busy || !rootFolderPath || !profileId}>{busy ? 'Saving…' : 'Save collection'}</button><div class="rad-panel"><h3>Movies</h3><div class="movie-list">{#each selected.movies || [] as movie}<span>{movie.title}</span>{/each}</div></div></div></div>{/if}

<style>.collection-modal { max-width: 660px; } .rad-panel h3 { color: var(--text); margin-bottom: 8px; font-size: var(--text-sm); } .movie-list { display: flex; flex-wrap: wrap; gap: 6px; } .movie-list span { background: var(--surface-2); color: var(--text-muted); padding: 4px 7px; border-radius: var(--radius-sm); font-size: var(--text-xs); }</style>
