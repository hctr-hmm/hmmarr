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
    { name: 'qbittorrent', label: 'qBittorrent', route: 'qbittorrent' },
    { name: 'seerr', label: 'Seerr', route: 'seerr' },
    { name: 'jellyfin', label: 'Jellyfin', route: 'jellyfin' }
  ];

  /** @type {Record<string, any>} */
  let health = $derived($serviceHealth);
  /** @type {Record<string, any>} */
  let details = $state({});
  let refreshing = $state(false);
  let loaded = $state(false);
  let lastUpdated = $state(null);
  let pageError = $state('');

  const onlineCount = $derived(SERVICES.filter((service) => health[service.name]?.online).length);
  const libraryTotal = $derived((details.radarr?.metrics?.[0]?.value || 0) + (details.sonarr?.metrics?.[0]?.value || 0));
  const queuedTotal = $derived((details.radarr?.metrics?.[2]?.value || 0) + (details.sonarr?.metrics?.[2]?.value || 0));
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
    if (name === 'seerr') return {
      counts: ['/api/v1/request/count']
    };
    if (name === 'jellyfin') return {
      sessions: ['/api/jellyfin/now-watching']
    };
    return {
      indexers: ['/api/v1/indexer'],
      failing: ['/api/v1/indexerstatus'],
      health: ['/api/v1/health']
    };
  }

  function summarize(name, data, partial) {
    const healthResponse = data.health?.data ?? data.health;
    const issues = ['qbittorrent', 'seerr', 'jellyfin'].includes(name) ? [] : Array.isArray(healthResponse) ? [...healthResponse] : [{ type: 'warning', message: 'Health information could not be loaded.' }];
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
    } else if (name === 'seerr') {
      const counts = data.counts;
      metrics.push(
        { label: 'Requests', value: count(counts?.total), route: 'seerr', section: { tab: 'requests', filter: 'all' } },
        { label: 'Pending', value: count(counts?.pending), route: 'seerr', section: { tab: 'requests', filter: 'pending' } },
        { label: 'Approved', value: count(counts?.approved), route: 'seerr', section: { tab: 'requests', filter: 'approved' } }
      );
    } else if (name === 'jellyfin') {
      const sessions = Array.isArray(data.sessions) ? data.sessions : null;
      metrics.push(
        { label: 'Watching', value: sessions?.length ?? null, route: 'jellyfin' },
        { label: 'Playing', value: sessions?.filter((session) => !session.paused).length ?? null, route: 'jellyfin' },
        { label: 'Paused', value: sessions?.filter((session) => session.paused).length ?? null, route: 'jellyfin' }
      );
    } else {
      const indexers = Array.isArray(data.indexers) ? data.indexers : null;
      metrics.push(
        { label: 'Indexers', value: indexers?.length ?? null, route: 'prowlarr' },
        { label: 'Enabled', value: indexers?.filter((indexer) => indexer.enable).length ?? null, route: 'prowlarr', section: { tab: 'indexers', filter: 'enabled' } },
        { label: 'Failing', value: Array.isArray(data.failing) ? data.failing.length : null, route: 'prowlarr', section: { tab: 'indexers', filter: 'issues' } }
      );
    }

    return { metrics, health: issues, upcoming: events, partial, calendarLoaded: Array.isArray(data.calendar), sessions: name === 'jellyfin' && Array.isArray(data.sessions) ? data.sessions : [] };
  }

  async function loadDetails(name) {
    const entries = Object.entries(queries(name));
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    try {
      const results = await Promise.allSettled(entries.map(([, [path, params]]) => ['qbittorrent', 'jellyfin'].includes(name) ? api.get(path) : api.proxy.get(name, path, params, controller.signal)));
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

  <div class="overview-line" aria-label="Library summary">
    <span><strong>{loaded ? libraryTotal : '—'}</strong> movies &amp; series</span>
    <span><strong>{loaded ? queuedTotal : '—'}</strong> in queue</span>
    <span><strong>{loaded ? alerts.length : '—'}</strong> issues</span>
  </div>

  <div class="dashboard-layout">
  <div class="dashboard-main">
  <section class="section" aria-labelledby="services-heading">
    <div class="section-head"><h2 id="services-heading">Services</h2><span>Live counts from connected apps</span></div>
    <div class="service-list">
      {#each SERVICES as service (service.name)}
        {@const status = health[service.name]}
        {@const data = details[service.name]}
        <article class="service-row" class:unconfigured={status?.unconfigured}>
          <div class="service-name"><h3>{service.label}</h3><span>{status?.version ? 'v' + status.version : ' '}</span></div>
          <div class="state" class:good={status?.online && !status.loading} class:bad={status && !status.online && !status.unconfigured && !status.loading}>
              <span class="dot" aria-hidden="true"></span>
              {!status || status.loading ? 'Checking' : status.unconfigured ? 'Not configured' : status.online ? 'Online' : 'Offline'}
          </div>
          {#if status?.unconfigured}
            <p class="service-message">Add its connection details to see activity.</p>
          {:else if status && !status.loading && !status.online}
            <p class="service-message error-text">{status.error || 'Could not reach this service.'}</p>
          {:else if pageError}
            <p class="service-message">Service information is unavailable.</p>
          {:else if !status || !data}
            <p class="service-message">Loading details…</p>
          {:else}
            <div class="metrics">
              {#each data.metrics as metric (metric.label)}
                <button class="metric" onclick={() => navigate(metric.route, metric.section)} title={'Open ' + metric.label}>
                  <strong>{metric.value ?? '—'}</strong> <span>{metric.label}</span>
                </button>
              {/each}
            </div>
          {/if}
          <button class="service-open" onclick={() => navigate(service.route)} aria-label={'Open ' + service.label}>View <span aria-hidden="true">→</span></button>
          {#if data?.partial}<p class="service-partial">Some details could not be loaded.</p>{/if}
        </article>
      {/each}
    </div>
  </section>

  {#if !health.jellyfin?.unconfigured}
  <section class="panel now-watching" aria-labelledby="watching-heading">
    <div class="panel-head"><div><h2 id="watching-heading">Now watching</h2><p>Current playback on Jellyfin</p></div><button onclick={() => navigate('jellyfin')}>Open Jellyfin <span aria-hidden="true">→</span></button></div>
    {#if health.jellyfin?.unconfigured}<p class="empty">Connect Jellyfin to see current playback.</p>
    {:else if health.jellyfin && !health.jellyfin.online && !health.jellyfin.loading}<p class="empty">Jellyfin is unavailable.</p>
    {:else if !details.jellyfin}<p class="empty">Checking current playback…</p>
    {:else if !details.jellyfin.sessions.length}<p class="empty">Nobody is watching right now.</p>
    {:else}<div class="watch-list">{#each details.jellyfin.sessions.slice(0, 4) as session, index (session.userName + index)}<div class="watch-row"><div><strong>{session.item.name}</strong><span>{session.userName} · {session.item.seriesName || session.item.type || 'Video'} · {session.paused ? 'Paused' : 'Playing'}</span></div><span>{session.durationSeconds ? Math.round(session.positionSeconds / session.durationSeconds * 100) : 0}%</span></div>{/each}</div>{/if}
  </section>
  {/if}

  </div>
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
</div>

<style>
  .page { width: min(100%, 1240px); margin: 0 auto; display: grid; gap: 28px; }
  .page-head, .section-head, .panel-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
  .title { line-height: 1.2; color: var(--text); font-size: var(--text-xl); font-weight: 650; letter-spacing: -.03em; }
  .subtitle { margin-top: 6px; color: var(--text-muted); font-size: var(--text-sm); }
  .refresh-btn { display: inline-flex; align-items: center; gap: 7px; min-height: 36px; padding: 7px 12px; border: 1px solid var(--border); border-radius: var(--radius-md); background: var(--surface); color: var(--text); font-size: 13px; line-height: 20px; }
  .refresh-btn:hover:not(:disabled), .panel-head button:hover, .service-open:hover { color: var(--text); border-color: var(--border-subtle); }
  .refresh-btn:disabled { opacity: .6; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .spinning { animation: spin .8s linear infinite; }
  .error { padding: 12px; border-left: 2px solid var(--red); color: var(--red); font-size: var(--text-sm); }
  .overview-line { display: flex; flex-wrap: wrap; gap: 14px 0; padding: 0 0 24px; border-bottom: 1px solid var(--border); }
  .overview-line span { display: inline-flex; align-items: baseline; gap: 6px; padding: 0 22px; border-left: 1px solid var(--border); color: var(--text-muted); font-size: var(--text-sm); }
  .overview-line span:first-child { padding-left: 0; border-left: 0; }
  .overview-line strong { color: var(--text); font-size: 21px; font-weight: 650; font-variant-numeric: tabular-nums; }
  .dashboard-layout { display: grid; grid-template-columns: minmax(0, 1fr) 280px; gap: 28px; align-items: start; }
  .dashboard-main { display: grid; min-width: 0; gap: 28px; }
  .section { display: grid; gap: 14px; }
  .section-head { align-items: baseline; }
  .section-head h2, .panel-head h2 { color: var(--text); font-size: 15px; font-weight: 650; letter-spacing: -.02em; }
  .section-head span, .panel-head p { color: var(--text-muted); font-size: 12px; }
  .panel-head p { margin-top: 4px; }
  .service-list { border: 1px solid var(--border); border-radius: var(--radius-lg); background: var(--surface); overflow: hidden; }
  .service-row:last-child { border-bottom: 0; }
  .service-row { display: grid; grid-template-columns: 105px 65px minmax(0, 1fr) 40px; align-items: center; gap: 12px; min-height: 80px; padding: 14px 18px; border-bottom: 1px solid var(--border); }
  .service-row.unconfigured { opacity: .7; }
  .service-name { display: grid; gap: 4px; min-width: 0; }
  .service-name h3 { color: var(--text); font-size: 14px; font-weight: 650; }
  .service-name span { color: var(--text-faint); font-size: 11px; white-space: nowrap; }
  .state { display: inline-flex; align-items: center; gap: 7px; color: var(--text-muted); font-size: 12px; line-height: 1.4; }
  .state.good { color: var(--green); }
  .state.bad { color: var(--red); }
  .dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
  .metrics { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
  .metric { min-width: 0; padding: 5px 0; border: 0; background: none; color: var(--text); text-align: left; white-space: nowrap; }
  .metric:hover strong, .metric:hover span { color: var(--accent); }
  .metric strong { font-size: 17px; font-weight: 600; font-variant-numeric: tabular-nums; }
  .metric span { display: block; margin-top: 4px; white-space: normal; color: var(--text-muted); font-size: 11px; }
  .service-message { min-width: 0; color: var(--text-muted); font-size: 12px; overflow-wrap: anywhere; }
  .error-text { color: var(--red); }
  .service-open, .panel-head button { padding: 4px 0; border: 0; background: none; color: var(--text-muted); font-size: 12px; text-align: right; white-space: nowrap; }
  .service-open span, .panel-head button span { margin-left: 2px; }
  .service-partial { grid-column: 3 / 4; margin-top: -10px; color: var(--orange); font-size: 11px; }
  .panel { display: grid; align-content: start; gap: 13px; min-width: 0; padding-top: 17px; border-top: 1px solid var(--border); }
  .lower-grid { display: grid; gap: 28px; }
  .lower-grid .panel { padding-top: 0; border-top: 0; }
  .lower-grid .panel-head { flex-wrap: wrap; gap: 6px; }
  .lower-grid .panel-head p { line-height: 1.5; }
  .lower-grid .panel-head button { text-align: left; }
  .lower-grid .list, .lower-grid .empty { border-top: 1px solid var(--border); }
  .empty { padding: 15px 0; color: var(--text-muted); font-size: var(--text-sm); }
  .list { display: grid; }
  .list-row, .event-row, .watch-row { display: flex; align-items: flex-start; gap: 10px; padding: 12px 0; border-top: 1px solid var(--border); }
  .list-row:first-child, .event-row:first-child, .watch-row:first-child { border-top: 0; }
  .list-row div, .event-info { min-width: 0; flex: 1; }
  .list-row strong, .event-info strong, .watch-row strong { color: var(--text); font-size: 13px; font-weight: 600; }
  .list-row p, .event-info span, .watch-row span { display: block; margin-top: 3px; color: var(--text-muted); font-size: 12px; line-height: 1.45; overflow-wrap: anywhere; }
  .issue-dot { width: 6px; height: 6px; margin-top: 6px; flex-shrink: 0; border-radius: 50%; background: var(--orange); }
  .issue-dot.critical { background: var(--red); }
  .more { padding-top: 9px; color: var(--text-muted); font-size: 12px; }
  .watch-list { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); column-gap: 28px; }
  .watch-row { align-items: center; justify-content: space-between; min-width: 0; }
  .watch-row > div { min-width: 0; }
  .watch-row > span { margin: 0; font-variant-numeric: tabular-nums; }
  .event-row { width: 100%; align-items: center; border-right: 0; border-bottom: 0; border-left: 0; background: none; color: var(--text-muted); text-align: left; }
  .event-row:hover strong { color: var(--accent); }
  .event-date { flex: 0 0 78px; color: var(--text-muted); font-size: 12px; font-weight: 600; }
  @media (max-width: 1250px) {
    .dashboard-layout { grid-template-columns: 1fr; }
    .lower-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .service-row { grid-template-columns: 120px 85px minmax(0, 1fr) 40px; }
  }
  @media (max-width: 850px) {
    .service-row { grid-template-columns: 95px 65px minmax(0, 1fr) 36px; gap: 10px; padding: 12px; }
    .metric strong { font-size: 15px; }
    .lower-grid, .watch-list { grid-template-columns: 1fr; }
    .section-head span { display: none; }
  }
  @media (max-width: 550px) {
    .page { gap: 24px; }
    .service-row { grid-template-columns: minmax(0, 1fr) auto; gap: 12px; padding: 16px; }
    .service-name { grid-column: 1; }
    .state { grid-column: 2; justify-self: end; }
    .metrics, .service-message { grid-column: 1 / -1; grid-row: 2; }
    .service-open { grid-column: 2; grid-row: 3; justify-self: end; }
    .service-partial { grid-column: 1 / -1; margin-top: 0; }
    .overview-line span { padding: 0 12px; font-size: 11px; }
    .overview-line strong { font-size: 18px; }
  }
</style>
