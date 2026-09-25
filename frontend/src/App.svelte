<script>
  import { onMount } from 'svelte';
  import { route, authStatus, navigate } from './lib/stores.js';
  import { api } from './lib/api.js';
  import Layout from './lib/Layout.svelte';
  import ComingSoon from './lib/ComingSoon.svelte';
  import Login from './routes/Login.svelte';
  import Dashboard from './routes/Dashboard.svelte';

  const ROUTES = {
    dashboard: { component: Dashboard, title: '' },
    movies:    { component: ComingSoon, title: 'Movies' },
    series:    { component: ComingSoon, title: 'Series' },
    queue:     { component: ComingSoon, title: 'Queue' },
    calendar:  { component: ComingSoon, title: 'Calendar' },
    prowlarr:  { component: ComingSoon, title: 'Indexers' },
    bazarr:    { component: ComingSoon, title: 'Subtitles' },
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
      authStatus.set({ checked: true, authRequired: true, authenticated: false });
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
    <span class="wordmark">hmmarr</span>
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
    --bg:             #0d1017;
    --surface:        #131721;
    --surface-2:      #1a2031;
    --surface-3:      #1e2432;
    --border:         #1e2432;
    --border-subtle:  #252d3d;
    --text:           #bfbdb6;
    --text-muted:     #5c6773;
    --text-faint:     #3d4554;
    --accent:         #e6b450;
    --accent-dim:     color-mix(in oklch, #e6b450 20%, #131721);
    --blue:           #39bae6;
    --green:          #7fd962;
    --red:            #f07178;
    --orange:         #ff8f40;
    --purple:         #d2a6ff;
    --radius-sm:      4px;
    --radius-md:      6px;
    --radius-lg:      10px;
    --space-1: 4px; --space-2: 8px; --space-3: 12px; --space-4: 16px;
    --space-5: 20px; --space-6: 24px; --space-8: 32px; --space-10: 40px;
    --space-12: 48px; --space-16: 64px;
    --font-body: 'Satoshi', system-ui, sans-serif;
    --text-xs:   clamp(0.75rem, 0.7rem + 0.2vw, 0.8125rem);
    --text-sm:   clamp(0.8125rem, 0.78rem + 0.25vw, 0.9375rem);
    --text-base: clamp(0.9375rem, 0.9rem + 0.2vw, 1rem);
    --text-lg:   clamp(1rem, 0.95rem + 0.35vw, 1.25rem);
    --text-xl:   clamp(1.25rem, 1.1rem + 0.8vw, 1.75rem);
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
  :global(body) { min-height: 100dvh; }
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
  .wordmark {
    font-size: var(--text-xl);
    font-weight: 700;
    letter-spacing: -0.02em;
    color: var(--accent);
  }
</style>
