<script>
  import { onMount } from 'svelte';
  import { api } from '../lib/api.js';
  import { errorMessage } from '../lib/radarr.js';

  let { movieIds, onClose, onSaved } = $props();
  let action = $state('monitored');
  let monitored = $state(true);
  let profileId = $state('');
  let rootFolderPath = $state('');
  let minimumAvailability = $state('released');
  let tagId = $state('');
  let applyTags = $state('add');
  let deleteFiles = $state(false);
  let addImportExclusion = $state(false);
  let profiles = $state([]);
  let roots = $state([]);
  let tags = $state([]);
  let busy = $state(false);
  let error = $state('');

  onMount(async () => {
    try {
      [profiles, roots, tags] = await Promise.all([
        api.proxy.get('radarr', '/api/v3/qualityprofile'),
        api.proxy.get('radarr', '/api/v3/rootfolder'),
        api.proxy.get('radarr', '/api/v3/tag')
      ]);
      profileId = String(profiles[0]?.id || '');
      rootFolderPath = roots.find((root) => root.accessible)?.path || roots[0]?.path || '';
      tagId = String(tags[0]?.id || '');
    } catch (cause) { error = errorMessage(cause); }
  });

  async function apply() {
    if (!movieIds.length) return;
    const payload = { movieIds };
    switch (action) {
      case 'monitored': payload.monitored = monitored; break;
      case 'quality': if (!profileId) return; payload.qualityProfileId = Number(profileId); break;
      case 'availability': payload.minimumAvailability = minimumAvailability; break;
      case 'root': if (!rootFolderPath) return; payload.rootFolderPath = rootFolderPath; payload.moveFiles = true; break;
      case 'tags': if (!tagId) return; payload.tags = [Number(tagId)]; payload.applyTags = applyTags; break;
      case 'delete': payload.deleteFiles = deleteFiles; payload.addImportExclusion = addImportExclusion; break;
    }
    const description = action === 'delete' ? `Delete ${movieIds.length} movies from Radarr${deleteFiles ? ' and remove their files from disk' : ''}? This cannot be undone.` : action === 'root' ? `Move ${movieIds.length} movies and their files to ${rootFolderPath}?` : `Apply this change to ${movieIds.length} movies?`;
    if (!confirm(description)) return;
    busy = true; error = '';
    try {
      if (action === 'delete') await api.proxy.delete('radarr', '/api/v3/movie/editor', undefined, payload);
      else await api.proxy.put('radarr', '/api/v3/movie/editor', payload);
      onSaved();
    } catch (cause) { error = errorMessage(cause); }
    finally { busy = false; }
  }
</script>

<div class="rad-modal-backdrop" role="presentation" onclick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
  <div class="rad-modal bulk" role="dialog" aria-modal="true" aria-label="Edit selected movies">
    <div class="rad-modal-head"><div><h2>Edit {movieIds.length} movies</h2><p class="rad-muted">Choose one change to apply to the selected movies.</p></div><button class="rad-button" onclick={onClose}>Close</button></div>
    {#if error}<p class="rad-error" role="alert">{error}</p>{/if}
    <label class="rad-field">Action<select class="rad-select" bind:value={action}><option value="monitored">Monitoring</option><option value="quality">Quality profile</option><option value="availability">Minimum availability</option><option value="root">Move to root folder</option><option value="tags">Tags</option><option value="delete">Remove movies</option></select></label>
    {#if action === 'monitored'}<label class="rad-check"><input type="checkbox" bind:checked={monitored} /> Monitor selected movies</label>
    {:else if action === 'quality'}<label class="rad-field">Quality profile<select class="rad-select" bind:value={profileId}>{#each profiles as profile}<option value={String(profile.id)}>{profile.name}</option>{/each}</select></label>
    {:else if action === 'availability'}<label class="rad-field">Minimum availability<select class="rad-select" bind:value={minimumAvailability}><option value="announced">Announced</option><option value="inCinemas">In cinemas</option><option value="released">Released</option></select></label>
    {:else if action === 'root'}<label class="rad-field">New root folder<select class="rad-select" bind:value={rootFolderPath}>{#each roots as root}<option value={root.path}>{root.path}</option>{/each}</select></label><p class="rad-muted">Radarr will move existing movie files.</p>
    {:else if action === 'tags'}<div class="rad-fields"><label class="rad-field">Tag<select class="rad-select" bind:value={tagId}>{#each tags as tag}<option value={String(tag.id)}>{tag.label}</option>{/each}</select></label><label class="rad-field">How to apply<select class="rad-select" bind:value={applyTags}><option value="add">Add</option><option value="remove">Remove</option><option value="replace">Replace all tags</option></select></label></div>
    {:else}<div class="rad-panel"><p class="rad-muted">Removing movies from Radarr can leave files on disk unless you choose to delete them.</p><label class="rad-check"><input type="checkbox" bind:checked={deleteFiles} /> Delete files from disk</label><label class="rad-check"><input type="checkbox" bind:checked={addImportExclusion} /> Prevent automatic re-add</label></div>{/if}
    <div class="rad-actions"><button class="rad-button" class:danger={action === 'delete'} class:primary={action !== 'delete'} onclick={apply} disabled={busy || (action === 'tags' && !tagId)}>{busy ? 'Applying…' : action === 'delete' ? 'Remove movies' : 'Apply changes'}</button></div>
  </div>
</div>

<style>.bulk { max-width: 520px; } .rad-panel { display: grid; gap: 10px; }</style>
