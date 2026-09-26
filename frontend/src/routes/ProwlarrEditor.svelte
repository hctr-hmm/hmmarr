<script>
  import { onMount, untrack } from 'svelte';
  import { api } from '../lib/api.js';
  import { errorMessage } from '../lib/radarr.js';
  import ProwlarrFields from '../lib/ProwlarrFields.svelte';

  let { kind, item = null, profiles = [], tags = [], existingNames = [], onClose, onSaved, onDeleted } = $props();
  const endpoint = $derived(kind === 'indexer' ? '/api/v1/indexer' : '/api/v1/applications');
  let model = $state(untrack(() => item ? JSON.parse(JSON.stringify(item)) : null));
  let templates = $state([]);
  let templateQuery = $state('');
  let dynamicOptions = $state({});
  let loading = $state(untrack(() => !item));
  let busy = $state('');
  let error = $state('');
  let notice = $state('');
  const matches = $derived(templates.map((template, index) => ({ template, index })).filter(({ template }) => `${template.name || template.implementationName || template.implementation} ${template.privacy || ''} ${template.protocol || ''}`.toLowerCase().includes(templateQuery.toLowerCase())).slice(0, 100));

  onMount(async () => {
    if (item) { if (kind === 'indexer') loadUrls(model); return; }
    try { templates = await api.proxy.get('prowlarr', `${endpoint}/schema`); }
    catch (cause) { error = errorMessage(cause); }
    finally { loading = false; }
  });

  async function loadUrls(resource) {
    const field = resource?.fields?.find((entry) => entry.name === 'baseUrl' && entry.selectOptionsProviderAction === 'getUrls');
    if (!field) return;
    try {
      const result = await api.proxy.post('prowlarr', '/api/v1/indexer/action/getUrls', resource);
      const options = result.options || [];
      dynamicOptions = { ...dynamicOptions, baseUrl: options };
      if (!field.value && options.length) changeField('baseUrl', options[0].value);
    } catch { /* A text field remains available if URL choices cannot load. */ }
  }

  function chooseTemplate(index) {
    const template = templates[index];
    if (!template) return;
    const baseName = template.name || template.implementationName || template.implementation;
    let name = baseName;
    for (let suffix = 2; existingNames.some((existing) => existing.toLowerCase() === name.toLowerCase()); suffix++) name = `${baseName} (${suffix})`;
    model = JSON.parse(JSON.stringify({ ...template, id: 0, enable: true, name, tags: [],
      ...(kind === 'indexer' ? { appProfileId: profiles[0]?.id || template.appProfileId || 0 } : { syncLevel: 'addOnly' }) }));
    model.fields = model.fields?.map((field) => field.value === undefined && field.selectOptions?.length ? { ...field, value: field.selectOptions[0].value } : field) || [];
    dynamicOptions = {};
    if (kind === 'indexer') loadUrls(model);
  }

  function changeField(name, value) { model = { ...model, fields: model.fields.map((field) => field.name === name ? { ...field, value } : field) }; }
  function toggleTag(id) { model = { ...model, tags: model.tags?.includes(id) ? model.tags.filter((tag) => tag !== id) : [...(model.tags || []), id] }; }

  async function testConnection() {
    if (!model) return;
    busy = 'test'; error = ''; notice = '';
    try { await api.proxy.post('prowlarr', `${endpoint}/test`, model); notice = 'Connection test passed.'; }
    catch (cause) { error = errorMessage(cause); }
    finally { busy = ''; }
  }

  async function save() {
    if (!model?.name?.trim()) { error = 'Enter a name.'; return; }
    busy = 'save'; error = ''; notice = '';
    try {
      const saved = item
        ? await api.proxy.put('prowlarr', `${endpoint}/${item.id}`, model)
        : await api.proxy.post('prowlarr', endpoint, model);
      onSaved(saved);
    } catch (cause) { error = errorMessage(cause); }
    finally { busy = ''; }
  }

  async function remove() {
    if (!item || !confirm(`Remove ${item.name} from Prowlarr?`)) return;
    busy = 'delete'; error = '';
    try { await api.proxy.delete('prowlarr', `${endpoint}/${item.id}`); onDeleted(item.id); }
    catch (cause) { error = errorMessage(cause); busy = ''; }
  }
</script>

<div class="rad-modal-backdrop" role="presentation" onclick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
  <div class="rad-modal" role="dialog" aria-modal="true" aria-label={`${item ? 'Edit' : 'Add'} ${kind}`}>
    <div class="rad-modal-head"><div><h2>{item ? `Edit ${item.name}` : `Add ${kind}`}</h2><p class="rad-muted">{kind === 'indexer' ? 'Configure the source and its search options.' : 'Connect an app to receive indexers from Prowlarr.'}</p></div><button class="rad-button" onclick={onClose}>Close</button></div>
    {#if error}<p class="rad-error" role="alert">{error}</p>{/if}{#if notice}<p class="rad-success" role="status">{notice}</p>{/if}
    {#if !model}
      <label class="rad-field">Find a {kind}<input class="rad-input" type="search" bind:value={templateQuery} placeholder={kind === 'indexer' ? 'Search hundreds of indexers…' : 'Search apps…'} /></label>
      {#if loading}<p class="rad-muted">Loading available {kind}s…</p>{:else if !matches.length}<p class="rad-empty">No matching templates.</p>{:else}<div class="template-list">{#each matches as { template, index } (index)}<button class="template" onclick={() => chooseTemplate(index)}><strong>{template.name || template.implementationName || template.implementation}</strong><span>{kind === 'indexer' ? `${template.protocol || ''} · ${template.privacy || ''}` : template.implementation}</span></button>{/each}</div>{/if}
    {:else}
      {#if !item}<button class="rad-button back" onclick={() => model = null}>Choose another {kind}</button>{/if}
      <div class="rad-fields"><label class="rad-field">Name<input class="rad-input" bind:value={model.name} /></label>{#if kind === 'indexer'}<label class="rad-field">App profile<select class="rad-select" bind:value={model.appProfileId}>{#each profiles as profile}<option value={profile.id}>{profile.name}</option>{/each}</select></label><label class="rad-field">Priority<input class="rad-input" type="number" min="1" max="50" bind:value={model.priority} /></label>{:else}<label class="rad-field">Sync level<select class="rad-select" bind:value={model.syncLevel}><option value="disabled">Disabled</option><option value="addOnly">Add only</option><option value="fullSync">Full sync</option></select></label>{/if}</div>
      <div class="rad-actions"><label class="rad-check"><input type="checkbox" bind:checked={model.enable} /> Enabled</label>{#if kind === 'indexer'}<label class="rad-check"><input type="checkbox" bind:checked={model.supportsRss} /> RSS</label><label class="rad-check"><input type="checkbox" bind:checked={model.supportsSearch} /> Search</label>{/if}</div>
      {#if tags.length}<div class="rad-field">Tags<div class="rad-actions">{#each tags as tag}<label class="rad-check"><input type="checkbox" checked={model.tags?.includes(tag.id)} onchange={() => toggleTag(tag.id)} /> {tag.label}</label>{/each}</div></div>{/if}
      <ProwlarrFields fields={model.fields || []} {dynamicOptions} onChange={changeField} />
      <div class="rad-actions"><button class="rad-button" onclick={testConnection} disabled={!!busy}>Test connection</button><button class="rad-button primary" onclick={save} disabled={!!busy}>{busy === 'save' ? 'Saving…' : 'Save'}</button>{#if item}<button class="rad-button danger" onclick={remove} disabled={!!busy}>Remove</button>{/if}</div>
    {/if}
  </div>
</div>

<style>
  .template-list { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 8px; max-height: 60dvh; overflow: auto; }
  .template { display: grid; gap: 5px; padding: 12px; border: 1px solid var(--border); border-radius: var(--radius-md); background: var(--surface-2); color: var(--text); text-align: left; }
  .template:hover { border-color: var(--accent); }
  .template span { color: var(--text-muted); font-size: var(--text-xs); text-transform: capitalize; }
  .back { width: fit-content; }
</style>
