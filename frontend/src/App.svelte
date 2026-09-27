<script>
  import { onMount } from 'svelte';
  import { route, authStatus, navigate } from './lib/stores.js';
  import { api } from './lib/api.js';
  import Layout from './lib/Layout.svelte';
  import Login from './routes/Login.svelte';
  import Dashboard from './routes/Dashboard.svelte';
  import Movies from './routes/Movies.svelte';
  import Queue from './routes/Queue.svelte';
  import Calendar from './routes/Calendar.svelte';
  import History from './routes/History.svelte';
  import Wanted from './routes/Wanted.svelte';
  import Collections from './routes/Collections.svelte';
  import Discover from './routes/Discover.svelte';
  import Blocklist from './routes/Blocklist.svelte';
  import System from './routes/System.svelte';
  import Users from './routes/Users.svelte';
  import Series from './routes/Series.svelte';
  import Subtitles from './routes/Subtitles.svelte';
  import Indexers from './routes/Indexers.svelte';
  import Torrents from './routes/Torrents.svelte';
  import Seerr from './routes/Seerr.svelte';
  import NowWatching from './routes/NowWatching.svelte';

  const ROUTES = {
    dashboard: { component: Dashboard, title: '' },
    movies:    { component: Movies, title: '' },
    wanted:    { component: Wanted, title: '' },
    collections: { component: Collections, title: '' },
    discover:  { component: Discover, title: '' },
    series:    { component: Series, title: '' },
    queue:     { component: Queue, title: '' },
    calendar:  { component: Calendar, title: '' },
    history:   { component: History, title: '' },
    blocklist: { component: Blocklist, title: '' },
    system:    { component: System, title: '' },
    users:     { component: Users, title: '' },
    prowlarr:  { component: Indexers, title: '' },
    qbittorrent: { component: Torrents, title: '' },
    seerr:    { component: Seerr, title: '' },
    jellyfin: { component: NowWatching, title: '' },
    bazarr:    { component: Subtitles, title: '' },
  };

  // Bootstrap: check auth status on load
  onMount(async () => {
    try {
      const status = await api.authStatus();
      authStatus.set({ checked: true, ...status });
      if (!status.authRequired || status.authenticated) {
        navigate('dashboard');
      } else {
        navigate('login');
      }
    } catch {
      authStatus.set({ checked: true, authRequired: true, authenticated: false, user: null });
      navigate('login');
    }
  });

  const current = $derived(ROUTES[$route] ?? ROUTES.dashboard);
</script>

<svelte:head>
  <meta name="color-scheme" content="dark" />
</svelte:head>

{#if !$authStatus.checked}
  <!-- Splash while checking auth -->
  <div class="splash">
    <img src="/hmmarr-logo.svg" alt="hmmarr" width="220" height="56" />
  </div>
{:else if $route === 'login'}
  <Login />
{:else}
  <Layout>
    <current.component title={current.title} />
  </Layout>
{/if}

<style>
  :global(*, *::before, *::after) { box-sizing: border-box; margin: 0; padding: 0; }
  :global(:root) {
    --bg:             #09090b;
    --surface:        #111113;
    --surface-2:      #19191c;
    --surface-3:      #232327;
    --border:         #29292e;
    --border-subtle:  #3b3b43;
    --text:           #e4e4e7;
    --text-muted:     #a1a1aa;
    --text-faint:     #8b8b94;
    --accent:         #b7c7e8;
    --accent-hover:   #cbd8f0;
    --accent-ink:     #0b101a;
    --accent-dim:     #202737;
    --blue:           #93b5de;
    --green:          #8bbf9f;
    --red:            #e4939a;
    --orange:         #cfa67e;
    --purple:         #b3a1d1;
    --radius-sm:      3px;
    --radius-md:      5px;
    --radius-lg:      8px;
    --space-1: 4px; --space-2: 8px; --space-3: 12px; --space-4: 16px;
    --space-5: 20px; --space-6: 24px; --space-8: 32px; --space-10: 40px;
    --space-12: 48px; --space-16: 64px;
    --font-body: Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    --text-xs:   0.78rem;
    --text-sm:   0.9rem;
    --text-base: 1rem;
    --text-lg:   1.25rem;
    --text-xl:   clamp(1.65rem, 1.4rem + 1vw, 2rem);
    --ease-out:  cubic-bezier(0.16, 1, 0.3, 1);
    --trans: 160ms var(--ease-out);
  }
  :global(html) {
    background: var(--bg);
    color: var(--text);
    font-family: var(--font-body);
    font-size: var(--text-base);
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    text-rendering: optimizeLegibility;
  }
  :global(body) { min-height: 100dvh; background: var(--bg); }
  :global(button), :global(input), :global(select), :global(textarea) { font: inherit; }
  :global(button), :global(a), :global(input), :global(select), :global(textarea) { -webkit-tap-highlight-color: transparent; }
  :global(button:disabled) { cursor: not-allowed; }
  :global(::-webkit-scrollbar) { width: 9px; height: 9px; }
  :global(::-webkit-scrollbar-thumb) { background: var(--border-subtle); border: 2px solid var(--bg); border-radius: 99px; }
  :global(button) { cursor: pointer; font-family: inherit; }
  :global(input) { font-family: inherit; }
  :global(:focus-visible) {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
    border-radius: var(--radius-sm);
  }
  :global(::selection) { background: color-mix(in oklch, var(--accent) 30%, transparent); }
  @media (prefers-reduced-motion: reduce) {
    :global(*, *::before, *::after) {
      animation-duration: 0.01ms !important;
      transition-duration: 0.01ms !important;
    }
  }

  .splash {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 100dvh;
    gap: var(--space-4);
  }
  .splash img { display: block; width: min(220px, 80vw); height: auto; }
</style>
