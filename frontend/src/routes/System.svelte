<script>
  import { onMount } from 'svelte';
  import { api } from '../lib/api.js';
  import { formatBytes, formatDate, errorMessage } from '../lib/radarr.js';

  const SERVICES = [
    { name: 'radarr', label: 'Radarr', base: '/api/v3', diskSpace: true },
    { name: 'sonarr', label: 'Sonarr', base: '/api/v3', diskSpace: true },
    { name: 'bazarr', label: 'Bazarr', base: '/api', diskSpace: false },
    { name: 'prowlarr', label: 'Prowlarr', base: '/api/v1', diskSpace: false },
    { name: 'qbittorrent', label: 'qBittorrent', base: '/api/v2', diskSpace: false },
    { name: 'seerr', label: 'Seerr', base: '/api/v1', diskSpace: false },
    { name: 'jellyfin', label: 'Jellyfin', base: '/', diskSpace: false }
  ];

  let serviceData = $state({});
  let loading = $state(true);
  let error = $state('');

  function statusFields(name, response) {
    const status = response?.data ?? response;
    if (name === 'bazarr') return [
      ['Version', status.bazarr_version],
      ['Package', status.package_version],
      ['Platform', status.operating_system],
      ['Runtime', status.python_version ? 'Python ' + status.python_version : null],
      ['Database', status.database_engine],
      ['Started', status.start_time ? formatDate(status.start_time * 1000) : null],
      ['Timezone', status.timezone],
      ['CPU cores', status.cpu_cores]
    ];
    return [
      ['Version', status.version],
      ['Branch', status.branch],
      ['Runtime', [status.runtimeName, status.runtimeVersion].filter(Boolean).join(' ')],
      ['Platform', [status.osName, status.osVersion].filter(Boolean).join(' ')],
      ['Docker', status.isDocker ? 'Yes' : 'No'],
      ['Started', formatDate(status.startTime)],
      ['Database', [status.databaseType, status.databaseVersion].filter(Boolean).join(' ')]
    ];
  }

  async function loadService(service, configured) {
    if (!configured) return { unconfigured: true };

    if (service.name === 'jellyfin') {
      try {
        const [status, sessions] = await Promise.all([
          api.serviceStatus('jellyfin'),
          api.get('/api/jellyfin/now-watching')
        ]);
        return { fields: [
          ['Version', status.version || '—'],
          ['Current viewers', sessions.length],
          ['Playing', sessions.filter((session) => !session.paused).length],
          ['Paused', sessions.filter((session) => session.paused).length]
        ], health: [], healthError: '', disks: [], diskError: '' };
      } catch (cause) { return { offline: true, error: errorMessage(cause) }; }
    }

    if (service.name === 'seerr') {
      try {
        const [status, counts] = await Promise.all([
          api.proxy.get('seerr', '/api/v1/status'),
          api.proxy.get('seerr', '/api/v1/request/count')
        ]);
        return { fields: [
          ['Version', status.version || status.commitTag || '—'],
          ['Requests', counts.total ?? 0],
          ['Pending', counts.pending ?? 0],
          ['Approved', counts.approved ?? 0],
          ['Available', counts.available ?? 0]
        ], health: [], healthError: '', disks: [], diskError: '' };
      } catch (cause) { return { offline: true, error: errorMessage(cause) }; }
    }

    if (service.name === 'qbittorrent') {
      try {
        const [version, apiVersion, transfer] = await Promise.all([
          api.qbittorrent.get('app/version'),
          api.qbittorrent.get('app/webapiVersion'),
          api.qbittorrent.get('transfer/info')
        ]);
        return { fields: [
          ['Version', version], ['Web API', apiVersion],
          ['Connection', transfer.connection_status],
          ['Download speed', formatBytes(transfer.dl_info_speed) + '/s'],
          ['Upload speed', formatBytes(transfer.up_info_speed) + '/s'],
          ['Downloaded this session', formatBytes(transfer.dl_info_data)],
          ['Uploaded this session', formatBytes(transfer.up_info_data)]
        ], health: [], healthError: '', disks: [], diskError: '' };
      } catch (cause) { return { offline: true, error: errorMessage(cause) }; }
    }

    let status;
    try {
      status = await api.proxy.get(service.name, service.base + '/system/status');
    } catch (cause) {
      return { offline: true, error: errorMessage(cause) };
    }

    const [healthResult, disksResult] = await Promise.allSettled([
      api.proxy.get(service.name, service.base + (service.name === 'bazarr' ? '/system/health' : '/health')),
      service.diskSpace ? api.proxy.get(service.name, service.base + '/diskspace') : Promise.resolve(null)
    ]);

    const healthResponse = healthResult.status === 'fulfilled' ? healthResult.value : null;
    const health = healthResponse?.data ?? healthResponse;
    return {
      fields: statusFields(service.name, status).filter(([, value]) => value !== null && value !== undefined && value !== ''),
      health: Array.isArray(health) ? health : [],
      healthError: healthResult.status === 'rejected' ? errorMessage(healthResult.reason) : '',
      disks: disksResult.status === 'fulfilled' ? disksResult.value : [],
      diskError: disksResult.status === 'rejected' ? errorMessage(disksResult.reason) : ''
    };
  }

  async function load() {
    loading = true;
    error = '';
    try {
      const configured = new Set((await api.services()).map((service) => service.name));
      await Promise.all(SERVICES.map(async (service) => {
        const result = await loadService(service, configured.has(service.name));
        serviceData = { ...serviceData, [service.name]: result };
      }));
    } catch (cause) {
      error = errorMessage(cause);
    } finally {
      loading = false;
    }
  }

  onMount(load);
</script>

<div class="rad-page">
  <header class="rad-head">
    <div><h1>System</h1><p>Status, health, and available storage for all services</p></div>
    <button class="rad-button" onclick={load} disabled={loading}>{loading ? 'Refreshing…' : 'Refresh'}</button>
  </header>

  {#if error}<p class="rad-error" role="alert">{error}</p>{/if}

  <div class="services">
    {#each SERVICES as service (service.name)}
      {@const data = serviceData[service.name]}
      <section class="rad-panel service" aria-label={service.label + ' system'}>
        <div class="service-head">
          <h2>{service.label}</h2>
          {#if !data}<span class="rad-badge" class:bad={error}>{error ? 'Unavailable' : 'Loading'}</span>
          {:else if data.unconfigured}<span class="rad-badge">Not configured</span>
          {:else if data.offline}<span class="rad-badge bad">Offline</span>
          {:else}<span class="rad-badge good">Online</span>{/if}
        </div>

        {#if !data}
          <p class="rad-muted">{error ? 'System information is unavailable.' : 'Loading system information…'}</p>
        {:else if data.unconfigured}
          <p class="rad-muted">Connect {service.label} to see its system information.</p>
        {:else if data.offline}
          <p class="rad-error" role="alert">{data.error}</p>
        {:else}
          <div class="details">
            {#each data.fields as [label, value] (label)}
              <div class="detail"><span class="rad-muted">{label}</span><strong>{value}</strong></div>
            {/each}
          </div>

          <div class="service-section">
            <h3>Health</h3>
            {#if data.healthError}
              <p class="rad-error" role="alert">Could not load health: {data.healthError}</p>
            {:else if data.health.length === 0}
              <p class="rad-success">{['qbittorrent', 'seerr', 'jellyfin'].includes(service.name) ? 'Connection details are shown above.' : 'No health issues reported.'}</p>
            {:else}
              <div class="rad-list">
                {#each data.health as item, index (item.source + '-' + index)}
                  <div class="rad-row">
                    <div class="rad-row-main"><strong class="rad-row-title">{item.source || 'Health issue'}</strong><span class="rad-row-meta">{item.message}</span></div>
                    <span class="rad-badge" class:bad={item.type === 'error'} class:warn={item.type === 'warning'}>{item.type || 'notice'}</span>
                  </div>
                {/each}
              </div>
            {/if}
          </div>

          <div class="service-section">
            <h3>Disk space</h3>
            {#if !service.diskSpace}
              <p class="rad-muted">Disk space is not reported by {service.label}.</p>
            {:else if data.diskError}
              <p class="rad-error" role="alert">Could not load disk space: {data.diskError}</p>
            {:else if !Array.isArray(data.disks) || data.disks.length === 0}
              <p class="rad-muted">No storage volumes reported.</p>
            {:else}
              <div class="rad-list">
                {#each data.disks as disk, index (disk.path + '-' + index)}
                  <div class="rad-row">
                    <div class="rad-row-main"><strong class="rad-row-title">{disk.label || disk.path}</strong><span class="rad-row-meta">{disk.path}</span></div>
                    <span class="rad-badge">{formatBytes(disk.freeSpace)} free of {formatBytes(disk.totalSpace)}</span>
                  </div>
                {/each}
              </div>
            {/if}
          </div>
        {/if}
      </section>
    {/each}
  </div>
</div>

<style>
  .services, .service { display: grid; gap: 16px; }
  .service-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
  .service-head h2 { color: var(--text); font-size: var(--text-lg); }
  .details { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 10px; }
  .detail { display: grid; gap: 4px; min-width: 0; padding: 12px; border: 1px solid var(--border); border-radius: var(--radius-md); background: var(--surface-2); }
  .detail strong { color: var(--text); font-size: var(--text-sm); overflow-wrap: anywhere; }
  .service-section { display: grid; gap: 10px; }
  .service-section h3 { color: var(--text); font-size: var(--text-sm); font-weight: 700; }
</style>
