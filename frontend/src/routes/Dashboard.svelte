<script>
  import { onMount } from 'svelte';
  import { api } from '../lib/api.js';
  import { serviceHealth, navigate } from '../lib/stores.js';
  import { errorMessage } from '../lib/radarr.js';

  const SERVICES = [
    { name: 'radarr', label: 'Radarr', route: 'movies' },
    { name: 'sonarr', label: 'Sonarr', route: 'series' },
    { name: 'bazarr', label: 'Bazarr', route: 'bazarr' },
    { name: 'prowlarr', label: 'Prowlarr', route: 'prowlarr' },
    { name: 'qbittorrent', label: 'qBittorrent', route: 'qbittorrent' }
  ];

  let health = $derived($serviceHealth);
  let details = $state({});
  let refreshing = $state(false);
  let loaded = $state(false);
  let lastUpdated = $state(null);
  let pageError = $state('');

  const onlineCount = $derived(SERVICES.filter((service) => health[service.name]?.online).length);
  const alerts = $derived(SERVICES.flatMap((service) => {
    const status = health[service.name];
    if (status && !status.online && !status.unconfigured && !status.loading) {
      return [{ service: service.label, type: 'error', message: status.error || 'Service is offline.' }];
    }
    if (!status?.online) return [];
    return (details[service.name]?.health || []).map((issue) => ({
      service: service.label,
      type: issue.type || 'warning',
      message: issue.message || issue.title || issue.source || 'Health warning'
    }));
  }));
  const upcoming = $derived(
    SERVICES.flatMap((service) => details[service.name]?.upcoming || [])
      .sort((a, b) => a.time - b.time)
      .slice(0, 6)
  );
  const calendarUnavailable = $derived(['radarr', 'sonarr'].some((name) => health[name]?.online && details[name] && !details[name].calendarLoaded));

  function count(value) {
    return typeof value === 'number' ? value : null;
  }

  function withinWeek(value) {
    const time = Date.parse(value);
    return Number.isFinite(time) && time >= Date.now() - 86_400_000 && time < Date.now() + 8 * 86_400_000 ? time : null;
  }

  function calendarRange() {
    const start = new Date();
    const end = new Date(start.getTime() + 8 * 86_400_000);
    return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
  }

  function queries(name) {
    const range = calendarRange();
    if (name === 'radarr') return {
      library: ['/api/v3/movie'],
      missing: ['/api/v3/wanted/missing', { page: 1, pageSize: 1 }],
      queue: ['/api/v3/queue', { page: 1, pageSize: 1 }],
      calendar: ['/api/v3/calendar', range],
      health: ['/api/v3/health']
    };
    if (name === 'sonarr') return {
      library: ['/api/v3/series'],
      missing: ['/api/v3/wanted/missing', { page: 1, pageSize: 1 }],
      queue: ['/api/v3/queue', { page: 1, pageSize: 1 }],
      calendar: ['/api/v3/calendar', range],
      health: ['/api/v3/health']
    };
    if (name === 'bazarr') return {
      movies: ['/api/movies/wanted', { start: 0, length: 1 }],
      episodes: ['/api/episodes/wanted', { start: 0, length: 1 }],
      health: ['/api/system/health'],
      providers: ['/api/providers']
    };
    if (name === 'qbittorrent') return {
      torrents: ['/api/qbittorrent/torrents/info'],
      transfer: ['/api/qbittorrent/transfer/info']
    };
    return {
      indexers: ['/api/v1/indexer'],
      failing: ['/api/v1/indexerstatus'],
      health: ['/api/v1/health']
    };
  }

  function summarize(name, data, partial) {
    const healthResponse = data.health?.data ?? data.health;
    const issues = name === 'qbittorrent' ? [] : Array.isArray(healthResponse) ? [...healthResponse] : [{ type: 'warning', message: 'Health information could not be loaded.' }];
    const providerList = data.providers?.data;
    if (name === 'bazarr' && Array.isArray(providerList)) {
      for (const provider of providerList.filter((item) => item.status !== 'Good')) {
        issues.push({ type: 'warning', message: 'Subtitle provider ' + provider.name + ': ' + (provider.status || 'unknown status') });
      }
    }
    const metrics = [];
    const events = [];

    if (name === 'radarr' || name === 'sonarr') {
      const library = Array.isArray(data.library) ? data.library : null;
      metrics.push(
        { label: name === 'radarr' ? 'Movies' : 'Series', value: library?.length ?? null, route: name === 'radarr' ? 'movies' : 'series' },
        { label: name === 'radarr' ? 'Missing movies' : 'Missing episodes', value: count(data.missing?.totalRecords), route: name === 'radarr' ? 'wanted' : 'series', section: name === 'sonarr' ? 'wanted' : null },
        { label: 'In queue', value: count(data.queue?.totalRecords), route: name === 'radarr' ? 'queue' : 'series', section: name === 'sonarr' ? 'queue' : null }
      );
      if (name === 'radarr' && Array.isArray(data.calendar)) {
        for (const movie of data.calendar) {
          for (const [field, label] of [['digitalRelease', 'Digital'], ['physicalRelease', 'Physical'], ['inCinemas', 'Cinema']]) {
            const time = withinWeek(movie[field]);
            if (time) events.push({ time, title: movie.title, detail: label + ' release', route: 'calendar', service: 'Radarr' });
          }
        }
      }
      if (name === 'sonarr' && Array.isArray(data.calendar)) {
        const titles = new Map((library || []).map((series) => [series.id, series.title]));
        for (const episode of data.calendar) {
          const time = withinWeek(episode.airDateUtc || episode.airDate);
          if (!time) continue;
          const number = 'S' + String(episode.seasonNumber ?? 0).padStart(2, '0') + 'E' + String(episode.episodeNumber ?? 0).padStart(2, '0');
          events.push({
            time,
            title: titles.get(episode.seriesId) || 'Series ' + episode.seriesId,
            detail: number + (episode.title && episode.title !== 'TBA' ? ' · ' + episode.title : ''),
            route: 'series',
            section: 'calendar',
            service: 'Sonarr'
          });
        }
      }
    } else if (name === 'bazarr') {
      metrics.push(
        { label: 'Movies need subs', value: count(data.movies?.total), route: 'bazarr', section: { tab: 'wanted', mode: 'movie' } },
        { label: 'Episodes need subs', value: count(data.episodes?.total), route: 'bazarr', section: { tab: 'wanted', mode: 'episode' } },
        { label: 'Provider issues', value: Array.isArray(providerList) ? providerList.filter((provider) => provider.status !== 'Good').length : null, route: 'bazarr', section: 'providers' }
      );
    } else if (name === 'qbittorrent') {
      const torrents = Array.isArray(data.torrents) ? data.torrents : null;
      metrics.push(
        { label: 'Torrents', value: torrents?.length ?? null, route: 'qbittorrent' },
        { label: 'Downloading', value: torrents?.filter((item) => item.progress < 1 && !/paused|stopped/i.test(item.state || '')).length ?? null, route: 'qbittorrent' },
        { label: 'Completed', value: torrents?.filter((item) => item.progress >= 1).length ?? null, route: 'qbittorrent' }
      );
    } else {
      const indexers = Array.isArray(data.indexers) ? data.indexers : null;
      metrics.push(
        { label: 'Indexers', value: indexers?.length ?? null, route: 'prowlarr' },
        { label: 'Enabled', value: indexers?.filter((indexer) => indexer.enable).length ?? null, route: 'prowlarr', section: { tab: 'indexers', filter: 'enabled' } },
        { label: 'Failing', value: Array.isArray(data.failing) ? data.failing.length : null, route: 'prowlarr', section: { tab: 'indexers', filter: 'issues' } }
      );
    }

    return { metrics, health: issues, upcoming: events, partial, calendarLoaded: Array.isArray(data.calendar) };
  }

  async function loadDetails(name) {
    const entries = Object.entries(queries(name));
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    try {
      const results = await Promise.allSettled(entries.map(([, [path, params]]) => name === 'qbittorrent' ? api.get(path) : api.proxy.get(name, path, params, controller.signal)));
      const data = {};
      entries.forEach(([key], index) => {
        data[key] = results[index].status === 'fulfilled' ? results[index].value : null;
      });
      return summarize(name, data, results.some((result) => result.status === 'rejected'));
    } finally {
      clearTimeout(timeout);
    }
  }

  async function refresh() {
    if (refreshing) return;
    refreshing = true;
    pageError = '';
    try {
      const configured = new Set((await api.services()).map((service) => service.name));
      await Promise.all(SERVICES.map(async (service) => {
        const name = service.name;
        if (!configured.has(name)) {
          serviceHealth.update((state) => ({ ...state, [name]: { name, label: service.label, unconfigured: true, online: false, loading: false } }));
          details = { ...details, [name]: null };
          return;
        }
        serviceHealth.update((state) => ({ ...state, [name]: { ...state[name], name, label: service.label, loading: true, unconfigured: false } }));
        try {
          const status = await api.serviceStatus(name);
          serviceHealth.update((state) => ({ ...state, [name]: { ...status, loading: false, unconfigured: false } }));
          if (status.online) {
            const serviceDetails = await loadDetails(name);
            details = { ...details, [name]: serviceDetails };
          } else {
            details = { ...details, [name]: null };
          }
        } catch (cause) {
          serviceHealth.update((state) => ({
            ...state,
            [name]: { ...(cause?.data || {}), name, label: service.label, online: false, unconfigured: false, loading: false, error: cause?.data?.error || errorMessage(cause) }
          }));
          details = { ...details, [name]: null };
        }
      }));
    } catch (cause) {
      pageError = errorMessage(cause);
    } finally {
      refreshing = false;
      loaded = true;
      lastUpdated = new Date();
    }
  }

  function formatTime(value) {
    return value.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function formatDay(value) {
    return new Date(value).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
  }

  onMount(() => {
    refresh();
    const timer = setInterval(refresh, 120_000);
    return () => clearInterval(timer);
  });
</script>

<div class="page">
  <header class="page-head">
    <div>
      <h1 class="title">Dashboard</h1>
      <p class="subtitle">
        {#if loaded}
          {onlineCount} of {SERVICES.length} services online
          {#if lastUpdated}<span> · Updated {formatTime(lastUpdated)}</span>{/if}
        {:else}
          Checking your services…
        {/if}
      </p>
    </div>
    <button class="refresh-btn" onclick={refresh} disabled={refreshing}>
      <svg class:spinning={refreshing} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <polyline points="23 4 23 10 17 10"/>
        <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
      </svg>
      {refreshing ? 'Refreshing…' : 'Refresh'}
    </button>
  </header>

  {#if pageError}<p class="error" role="alert">{pageError}</p>{/if}

  <section class="section" aria-labelledby="services-heading">
    <div class="section-head"><h2 id="services-heading">Your services</h2><span>Live library and activity totals</span></div>
    <div class="grid">
      {#each SERVICES as service (service.name)}
        {@const status = health[service.name]}
        {@const data = details[service.name]}
        <article class="card" class:unconfigured={status?.unconfigured}>
          <div class="card-head">
            <h3>{service.label}</h3>
            <span class="state" class:good={status?.online && !status.loading} class:bad={status && !status.online && !status.unconfigured && !status.loading}>
              <span class="dot" aria-hidden="true"></span>
              {!status || status.loading ? 'Checking' : status.unconfigured ? 'Not configured' : status.online ? 'Online' : 'Offline'}
            </span>
          </div>
          {#if status?.unconfigured}
            <p class="card-note">Connect {service.label} to see its activity.</p>
          {:else if status && !status.loading && !status.online}
            <p class="card-note error-text">{status.error || 'Could not reach this service.'}</p>
          {:else if pageError}
            <p class="card-note">Service information is unavailable.</p>
          {:else if !status || !data}
            <p class="card-note">Loading details…</p>
          {:else}
            <div class="metrics">
              {#each data.metrics as metric (metric.label)}
                <button class="metric" onclick={() => navigate(metric.route, metric.section)} title={'Open ' + metric.label}>
                  <strong>{metric.value ?? '—'}</strong><span>{metric.label}</span>
                </button>
              {/each}
            </div>
            {#if data.partial}<p class="card-note">Some details could not be loaded.</p>{/if}
          {/if}
          <div class="card-foot">
            <span>{status?.version ? 'v' + status.version : ''}</span>
            <button onclick={() => navigate(service.route)}>Open {service.label} <span aria-hidden="true">→</span></button>
          </div>
        </article>
      {/each}
    </div>
  </section>

  <div class="lower-grid">
    <section class="panel" aria-labelledby="attention-heading">
      <div class="panel-head">
        <div><h2 id="attention-heading">Needs attention</h2><p>Health warnings from your services</p></div>
        <button onclick={() => navigate('system')}>System <span aria-hidden="true">→</span></button>
      </div>
      {#if pageError}
        <p class="empty">Health information is unavailable.</p>
      {:else if !loaded && alerts.length === 0}
        <p class="empty">Checking health…</p>
      {:else if alerts.length === 0}
        <p class="empty">No health warnings reported.</p>
      {:else}
        <div class="list">
          {#each alerts.slice(0, 6) as issue, index (issue.service + '-' + index)}
            <div class="list-row">
              <span class="issue-dot" class:critical={issue.type === 'error'} aria-hidden="true"></span>
              <div><strong>{issue.service}</strong><p>{issue.message}</p></div>
            </div>
          {/each}
          {#if alerts.length > 6}<p class="more">{alerts.length - 6} more warnings in System</p>{/if}
        </div>
      {/if}
    </section>

    <section class="panel" aria-labelledby="upcoming-heading">
      <div class="panel-head">
        <div><h2 id="upcoming-heading">Coming up</h2><p>Releases and episodes in the next week</p></div>
        <button onclick={() => navigate('calendar')}>Movie calendar <span aria-hidden="true">→</span></button>
      </div>
      {#if pageError}
        <p class="empty">Calendar information is unavailable.</p>
      {:else if !loaded && upcoming.length === 0}
        <p class="empty">Checking the calendar…</p>
      {:else if upcoming.length === 0}
        <p class="empty">{calendarUnavailable ? 'Some calendars could not be loaded.' : 'Nothing scheduled in the next week.'}</p>
      {:else}
        <div class="list">
          {#each upcoming as event, index (event.service + '-' + event.title + '-' + index)}
            <button class="event-row" onclick={() => navigate(event.route, event.section)}>
              <span class="event-date">{formatDay(event.time)}</span>
              <span class="event-info"><strong>{event.title}</strong><span>{event.service} · {event.detail}</span></span>
              <span aria-hidden="true">→</span>
            </button>
          {/each}
        </div>
        {#if calendarUnavailable}<p class="more">Some calendars could not be loaded.</p>{/if}
      {/if}
    </section>
  </div>
</div>

<style>
  .page { max-width: 1120px; margin: 0 auto; display: grid; gap: var(--space-8); }
  .page-head, .section-head, .card-head, .card-foot, .panel-head { display: flex; justify-content: space-between; align-items: flex-start; gap: var(--space-3); }
  .title { color: var(--text); font-size: var(--text-xl); font-weight: 700; letter-spacing: -0.02em; }
  .subtitle, .section-head span, .panel-head p { color: var(--text-muted); font-size: var(--text-sm); }
  .subtitle { margin-top: var(--space-1); }
  .refresh-btn { display: inline-flex; align-items: center; gap: 8px; flex-shrink: 0; padding: 8px 12px; border: 1px solid var(--border-subtle); border-radius: var(--radius-md); background: var(--surface); color: var(--text); font-size: var(--text-sm); }
  .refresh-btn:hover:not(:disabled), .card-foot button:hover, .panel-head button:hover { color: var(--accent); }
  .refresh-btn:disabled { opacity: .55; cursor: wait; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .spinning { animation: spin .8s linear infinite; }
  .error { padding: 10px 12px; border: 1px solid var(--red); border-radius: var(--radius-md); color: var(--red); font-size: var(--text-sm); }
  .section { display: grid; gap: var(--space-4); }
  .section-head { align-items: baseline; }
  .section-head h2, .panel-head h2 { color: var(--text); font-size: var(--text-lg); font-weight: 700; }
  .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--space-4); }
  .card, .panel { min-width: 0; padding: var(--space-5); border: 1px solid var(--border); border-radius: var(--radius-lg); background: var(--surface); }
  .card { display: flex; flex-direction: column; gap: var(--space-4); }
  .card.unconfigured { opacity: .65; }
  .card-head { align-items: center; }
  .card-head h3 { color: var(--text); font-size: var(--text-base); font-weight: 700; }
  .state { display: inline-flex; align-items: center; gap: 6px; color: var(--text-muted); font-size: var(--text-xs); white-space: nowrap; }
  .state.good { color: var(--green); }
  .state.bad { color: var(--red); }
  .dot { width: 7px; height: 7px; border-radius: 50%; background: currentColor; }
  .metrics { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
  .metric { display: grid; gap: 5px; min-width: 0; padding: 10px; border: 1px solid var(--border-subtle); border-radius: var(--radius-md); background: var(--surface-2); color: var(--text); text-align: left; }
  .metric:hover { border-color: var(--accent); }
  .metric strong { font-size: var(--text-xl); line-height: 1.1; }
  .metric span { color: var(--text-muted); font-size: var(--text-xs); line-height: 1.3; }
  .card-note { color: var(--text-muted); font-size: var(--text-sm); min-height: 42px; }
  .error-text { color: var(--red); overflow-wrap: anywhere; }
  .card-foot { align-items: center; margin-top: auto; padding-top: 12px; border-top: 1px solid var(--border); color: var(--text-faint); font-size: var(--text-xs); }
  .card-foot button, .panel-head button { border: 0; background: none; color: var(--text-muted); font-size: var(--text-sm); font-weight: 600; white-space: nowrap; }
  .lower-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--space-4); }
  .panel { display: grid; align-content: start; gap: var(--space-4); }
  .panel-head p { margin-top: 3px; }
  .empty { padding: var(--space-5) 0; color: var(--text-muted); font-size: var(--text-sm); }
  .list { display: grid; }
  .list-row, .event-row { display: flex; align-items: flex-start; gap: 10px; padding: 11px 0; border-top: 1px solid var(--border); }
  .list-row:first-child, .event-row:first-child { border-top: 0; }
  .list-row div, .event-info { min-width: 0; flex: 1; }
  .list-row strong, .event-info strong { color: var(--text); font-size: var(--text-sm); font-weight: 650; }
  .list-row p, .event-info span { display: block; margin-top: 3px; color: var(--text-muted); font-size: var(--text-xs); line-height: 1.45; overflow-wrap: anywhere; }
  .issue-dot { width: 7px; height: 7px; margin-top: 7px; flex-shrink: 0; border-radius: 50%; background: var(--orange); }
  .issue-dot.critical { background: var(--red); }
  .more { padding-top: 8px; color: var(--text-muted); font-size: var(--text-xs); }
  .event-row { width: 100%; align-items: center; background: none; border-right: 0; border-bottom: 0; border-left: 0; color: var(--text-muted); text-align: left; }
  .event-row:hover strong { color: var(--accent); }
  .event-date { flex: 0 0 78px; color: var(--accent); font-size: var(--text-xs); font-weight: 700; }
  @media (max-width: 860px) { .grid, .lower-grid { grid-template-columns: 1fr; } }
  @media (max-width: 470px) { .page-head, .section-head { flex-direction: column; align-items: flex-start; } .metrics { gap: 5px; } .metric { padding: 8px; } .event-date { flex-basis: 66px; } }
</style>
