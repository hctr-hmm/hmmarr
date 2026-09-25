<script lang="ts">
  import { onMount } from 'svelte';
  import { servicesStore } from '$lib/stores/services.svelte';
  import { radarr, sonarr, type RadarrMovie, type SonarrSeries, ApiError } from '$api/client';
  import ServiceHealthCard from '$lib/components/ServiceHealthCard.svelte';
  import StatCard from '$lib/components/StatCard.svelte';
  import PosterCard from '$lib/components/PosterCard.svelte';
  import ErrorBanner from '$lib/components/ErrorBanner.svelte';
  import Spinner from '$lib/components/Spinner.svelte';
  import { formatBytes, formatDate } from '$lib/utils';

  // ── Service map for health cards
  const SERVICE_META: Record<string, { href: string; accentVar: string }> = {
    radarr:   { href: '/radarr',   accentVar: '--color-radarr'   },
    sonarr:   { href: '/sonarr',   accentVar: '--color-sonarr'   },
    bazarr:   { href: '/bazarr',   accentVar: '--color-bazarr'   },
    prowlarr: { href: '/prowlarr', accentVar: '--color-prowlarr' },
  };

  // ── Radarr data
  let movies      = $state<RadarrMovie[]>([]);
  let moviesError = $state('');
  let moviesLoading = $state(false);

  // ── Sonarr data
  let series      = $state<SonarrSeries[]>([]);
  let seriesError = $state('');
  let seriesLoading = $state(false);

  // ── Derived Radarr stats
  const radarrConfigured = $derived(servicesStore.list.some(s => s.name === 'radarr'));
  const sonarrConfigured = $derived(servicesStore.list.some(s => s.name === 'sonarr'));

  const movieStats = $derived({
    total:     movies.length,
    downloaded: movies.filter(m => m.hasFile).length,
    missing:   movies.filter(m => !m.hasFile && m.monitored).length,
    unmonitored: movies.filter(m => !m.monitored).length,
  });

  const recentMovies = $derived(
    [...movies]
      .filter(m => m.hasFile)
      .sort((a, b) => {
        const da = a.digitalRelease ?? a.physicalRelease ?? '';
        const db = b.digitalRelease ?? b.physicalRelease ?? '';
        return db.localeCompare(da);
      })
      .slice(0, 12)
  );

  const upcomingMovies = $derived(
    [...movies]
      .filter(m => !m.hasFile && m.monitored && (m.digitalRelease || m.inCinemas))
      .sort((a, b) => {
        const da = a.digitalRelease ?? a.inCinemas ?? '';
        const db = b.digitalRelease ?? b.inCinemas ?? '';
        return da.localeCompare(db);
      })
      .slice(0, 6)
  );

  // ── Derived Sonarr stats
  const seriesStats = $derived({
    total:      series.length,
    continuing: series.filter(s => s.status === 'continuing').length,
    ended:      series.filter(s => s.status === 'ended').length,
    monitored:  series.filter(s => s.monitored).length,
  });

  const recentSeries = $derived(
    [...series]
      .filter(s => s.previousAiring)
      .sort((a, b) => (b.previousAiring ?? '').localeCompare(a.previousAiring ?? ''))
      .slice(0, 12)
  );

  const airingSoon = $derived(
    [...series]
      .filter(s => s.nextAiring)
      .sort((a, b) => (a.nextAiring ?? '').localeCompare(b.nextAiring ?? ''))
      .slice(0, 6)
  );

  async function loadRadarr() {
    if (!radarrConfigured) return;
    moviesLoading = true;
    moviesError = '';
    try {
      movies = await radarr.movies();
    } catch (e) {
      moviesError = e instanceof ApiError ? e.message : 'Failed to load movies';
    } finally {
      moviesLoading = false;
    }
  }

  async function loadSonarr() {
    if (!sonarrConfigured) return;
    seriesLoading = true;
    seriesError = '';
    try {
      series = await sonarr.series();
    } catch (e) {
      seriesError = e instanceof ApiError ? e.message : 'Failed to load series';
    } finally {
      seriesLoading = false;
    }
  }

  onMount(async () => {
    if (servicesStore.list.length === 0) await servicesStore.fetchList();
    await Promise.all([loadRadarr(), loadSonarr()]);
  });
</script>

<svelte:head><title>Overview — hmmarr</title></svelte:head>

<div class="page">
  <!-- Header -->
  <header class="page-header">
    <h1>Overview</h1>
    <p class="page-sub">Service status and library summary</p>
  </header>

  <!-- Service health grid -->
  <section class="section">
    <h2 class="section-title">Services</h2>
    {#if servicesStore.list.length === 0 && servicesStore.loading}
      <div class="loading-row"><Spinner /><span>Loading services…</span></div>
    {:else if servicesStore.list.length === 0}
      <p class="empty-hint">No services configured. Check your backend <code>.env</code>.</p>
    {:else}
      <div class="health-grid">
        {#each servicesStore.list as svc}
          {@const meta = SERVICE_META[svc.name]}
          {#if meta}
            <ServiceHealthCard
              service={svc}
              status={servicesStore.statuses[svc.name]}
              accentVar={meta.accentVar}
              href={meta.href}
            />
          {/if}
        {/each}
      </div>
    {/if}
  </section>

  <!-- Radarr section -->
  {#if radarrConfigured}
    <section class="section">
      <div class="section-header">
        <h2 class="section-title" style="color:var(--color-radarr)">Radarr</h2>
        <a href="/radarr" class="section-link">All movies &rarr;</a>
      </div>

      {#if moviesLoading}
        <div class="loading-row"><Spinner color="var(--color-radarr)" /><span>Loading movies…</span></div>
      {:else if moviesError}
        <ErrorBanner message={moviesError} retry={loadRadarr} />
      {:else}
        <!-- Stats row -->
        <div class="stats-grid">
          <StatCard label="Total" value={movieStats.total} accentVar="--color-radarr" />
          <StatCard label="Downloaded" value={movieStats.downloaded}
            sub={`${movies.length ? Math.round(movieStats.downloaded / movies.length * 100) : 0}%`} />
          <StatCard label="Missing" value={movieStats.missing} />
          <StatCard label="Unmonitored" value={movieStats.unmonitored} />
        </div>

        <!-- Recent movies -->
        {#if recentMovies.length > 0}
          <div class="subsection">
            <h3 class="subsection-title">Recently added</h3>
            <div class="poster-grid">
              {#each recentMovies as movie (movie.id)}
                <PosterCard
                  title={movie.title}
                  year={movie.year}
                  images={movie.images}
                  hasFile={movie.hasFile}
                  statusText={movie.status}
                  accentVar="--color-radarr"
                />
              {/each}
            </div>
          </div>
        {/if}

        <!-- Upcoming -->
        {#if upcomingMovies.length > 0}
          <div class="subsection">
            <h3 class="subsection-title">Upcoming</h3>
            <div class="upcoming-list">
              {#each upcomingMovies as movie (movie.id)}
                <div class="upcoming-item">
                  <div class="upcoming-poster">
                    {#if movie.images?.find(i => i.coverType === 'poster')?.remoteUrl}
                      <img
                        src={movie.images.find(i => i.coverType === 'poster')?.remoteUrl}
                        alt="{movie.title}"
                        loading="lazy"
                        decoding="async"
                      />
                    {:else}
                      <div class="upcoming-poster-fallback"></div>
                    {/if}
                  </div>
                  <div class="upcoming-info">
                    <div class="upcoming-title">{movie.title}</div>
                    <div class="upcoming-meta">
                      {#if movie.year}<span>{movie.year}</span>{/if}
                      {#if movie.inCinemas}
                        <span>Cinemas {formatDate(movie.inCinemas, { month: 'short', day: 'numeric' })}</span>
                      {/if}
                      {#if movie.digitalRelease}
                        <span class="release-date">Digital {formatDate(movie.digitalRelease, { month: 'short', day: 'numeric' })}</span>
                      {/if}
                    </div>
                  </div>
                </div>
              {/each}
            </div>
          </div>
        {/if}
      {/if}
    </section>
  {/if}

  <!-- Sonarr section -->
  {#if sonarrConfigured}
    <section class="section">
      <div class="section-header">
        <h2 class="section-title" style="color:var(--color-sonarr)">Sonarr</h2>
        <a href="/sonarr" class="section-link">All series &rarr;</a>
      </div>

      {#if seriesLoading}
        <div class="loading-row"><Spinner color="var(--color-sonarr)" /><span>Loading series…</span></div>
      {:else if seriesError}
        <ErrorBanner message={seriesError} retry={loadSonarr} />
      {:else}
        <!-- Stats row -->
        <div class="stats-grid">
          <StatCard label="Total" value={seriesStats.total} accentVar="--color-sonarr" />
          <StatCard label="Continuing" value={seriesStats.continuing} />
          <StatCard label="Ended" value={seriesStats.ended} />
          <StatCard label="Monitored" value={seriesStats.monitored} />
        </div>

        <!-- Airing soon -->
        {#if airingSoon.length > 0}
          <div class="subsection">
            <h3 class="subsection-title">Airing soon</h3>
            <div class="upcoming-list">
              {#each airingSoon as show (show.id)}
                {@const progress = show.episodeFileCount !== undefined && show.episodeCount
                  ? Math.round(show.episodeFileCount / show.episodeCount * 100)
                  : null}
                <div class="upcoming-item">
                  <div class="upcoming-poster">
                    {#if show.images?.find(i => i.coverType === 'poster')?.remoteUrl}
                      <img
                        src={show.images.find(i => i.coverType === 'poster')?.remoteUrl}
                        alt={show.title}
                        loading="lazy"
                        decoding="async"
                      />
                    {:else}
                      <div class="upcoming-poster-fallback"></div>
                    {/if}
                  </div>
                  <div class="upcoming-info">
                    <div class="upcoming-title">{show.title}</div>
                    <div class="upcoming-meta">
                      <span style="color:var(--color-sonarr)">
                        {formatDate(show.nextAiring, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                      </span>
                      {#if show.network}<span>{show.network}</span>{/if}
                    </div>
                    {#if progress !== null}
                      <div class="progress-bar-wrap" title="{show.episodeFileCount}/{show.episodeCount} episodes">
                        <div class="progress-bar">
                          <div class="progress-fill" style="width:{progress}%"></div>
                        </div>
                        <span class="progress-label">{progress}%</span>
                      </div>
                    {/if}
                  </div>
                </div>
              {/each}
            </div>
          </div>
        {/if}

        <!-- Recently aired -->
        {#if recentSeries.length > 0}
          <div class="subsection">
            <h3 class="subsection-title">Recently aired</h3>
            <div class="poster-grid">
              {#each recentSeries as show (show.id)}
                <PosterCard
                  title={show.title}
                  year={show.year}
                  images={show.images}
                  statusText={show.status}
                  accentVar="--color-sonarr"
                />
              {/each}
            </div>
          </div>
        {/if}
      {/if}
    </section>
  {/if}
</div>

<style>
  .page {
    padding: var(--space-8) var(--space-8);
    display: flex;
    flex-direction: column;
    gap: var(--space-10);
    max-width: var(--content-lg);
  }

  .page-header h1 {
    font-size: var(--text-xl);
    font-weight: 700;
    letter-spacing: -0.03em;
    color: var(--color-text);
  }
  .page-sub {
    font-size: var(--text-sm);
    color: var(--color-text-muted);
    margin-top: var(--space-1);
    max-width: none;
  }

  .section {
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
  }

  .section-header {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--space-4);
  }

  .section-title {
    font-size: var(--text-base);
    font-weight: 600;
    letter-spacing: -0.01em;
  }

  .section-link {
    font-size: var(--text-xs);
    color: var(--color-text-muted);
    transition: color var(--t);
  }
  .section-link:hover { color: var(--color-text); }

  /* Health grid */
  .health-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: var(--space-3);
  }

  /* Stats grid */
  .stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    gap: var(--space-3);
  }

  /* Poster grid */
  .poster-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
    gap: var(--space-3);
  }

  /* Subsection */
  .subsection {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }
  .subsection-title {
    font-size: var(--text-xs);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    color: var(--color-text-muted);
  }

  /* Upcoming list */
  .upcoming-list {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
    gap: var(--space-3);
  }
  .upcoming-item {
    display: flex;
    gap: var(--space-3);
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    padding: var(--space-3);
    align-items: flex-start;
  }
  .upcoming-poster {
    width: 44px;
    flex-shrink: 0;
    aspect-ratio: 2/3;
    border-radius: var(--radius-sm);
    overflow: hidden;
    background: var(--color-surface-3);
  }
  .upcoming-poster img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .upcoming-poster-fallback {
    width: 100%;
    height: 100%;
    background: var(--color-surface-hover);
  }
  .upcoming-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    min-width: 0;
  }
  .upcoming-title {
    font-size: var(--text-sm);
    font-weight: 500;
    color: var(--color-text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .upcoming-meta {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    font-size: var(--text-xs);
    color: var(--color-text-muted);
  }
  .release-date { color: var(--color-radarr); }

  /* Episode progress bar */
  .progress-bar-wrap {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    margin-top: var(--space-1);
  }
  .progress-bar {
    flex: 1;
    height: 3px;
    background: var(--color-surface-hover);
    border-radius: var(--radius-full);
    overflow: hidden;
  }
  .progress-fill {
    height: 100%;
    background: var(--color-sonarr);
    border-radius: var(--radius-full);
    transition: width var(--t-slow);
  }
  .progress-label {
    font-size: var(--text-xs);
    color: var(--color-text-faint);
    font-variant-numeric: tabular-nums;
    min-width: 28px;
    text-align: right;
  }

  /* Loading/empty states */
  .loading-row {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    color: var(--color-text-muted);
    font-size: var(--text-sm);
    padding: var(--space-4) 0;
  }
  .empty-hint {
    font-size: var(--text-sm);
    color: var(--color-text-muted);
    max-width: none;
  }
  .empty-hint code {
    font-family: var(--font-mono);
    font-size: 0.9em;
    background: var(--color-surface-2);
    padding: 1px 5px;
    border-radius: var(--radius-sm);
  }

  /* Responsive */
  @media (max-width: 768px) {
    .page { padding: var(--space-5) var(--space-4); gap: var(--space-8); }
    .poster-grid { grid-template-columns: repeat(auto-fill, minmax(90px, 1fr)); }
    .upcoming-list { grid-template-columns: 1fr; }
  }
</style>
