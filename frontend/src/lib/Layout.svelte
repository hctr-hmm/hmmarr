<script>
  import { route, navigate, authStatus } from './stores.js';
  import { api } from './api.js';

  let { children } = $props();

  const NAV = [
    { id: 'dashboard', label: 'Dashboard', icon: 'grid' },
    { id: 'movies',    label: 'Movies',    icon: 'film' },
    { id: 'discover',  label: 'Discover',  icon: 'search' },
    { id: 'wanted',    label: 'Wanted',    icon: 'download' },
    { id: 'collections', label: 'Collections', icon: 'film' },
    { id: 'series',    label: 'Series',    icon: 'tv' },
    { id: 'queue',     label: 'Queue',     icon: 'download' },
    { id: 'calendar',  label: 'Calendar',  icon: 'calendar' },
    { id: 'history',   label: 'History',   icon: 'history' },
    { id: 'blocklist', label: 'Blocklist', icon: 'download' },
    { id: 'system',    label: 'System',    icon: 'grid' },
    { id: 'prowlarr',  label: 'Indexers',  icon: 'search' },
    { id: 'bazarr',    label: 'Subtitles', icon: 'cc' },
  ];

  let loggingOut = $state(false);

  async function logout() {
    if (loggingOut) return;
    loggingOut = true;
    try {
      await api.logout();
    } catch {
      // Cookie may already be gone — proceed to login anyway.
    } finally {
      authStatus.set({ checked: true, authRequired: true, authenticated: false });
      navigate('login');
    }
  }

  const showLogout = $derived($authStatus.authRequired);
</script>

<div class="shell">
  <aside class="sidebar">
    <div class="brand">
      <svg width="24" height="24" viewBox="0 0 36 36" fill="none" aria-hidden="true">
        <rect x="4" y="6" width="4" height="24" rx="1.5" fill="#e6b450"/>
        <rect x="28" y="6" width="4" height="24" rx="1.5" fill="#e6b450"/>
        <rect x="4" y="16" width="28" height="4" rx="1.5" fill="#e6b450"/>
        <rect x="14" y="6" width="3" height="10" rx="1" fill="#39bae6" opacity="0.7"/>
      </svg>
      <span class="wordmark">hmmarr</span>
    </div>

    <nav aria-label="Main navigation">
      <ul class="nav-list">
        {#each NAV as item (item.id)}
          <li>
            <button
              class="nav-item"
              class:active={$route === item.id}
              aria-current={$route === item.id ? 'page' : undefined}
              onclick={() => navigate(item.id)}
            >
              <span class="icon" aria-hidden="true">
                {#if item.icon === 'grid'}
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>
                {:else if item.icon === 'film'}
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="18" rx="2"/><line x1="7" y1="3" x2="7" y2="21"/><line x1="17" y1="3" x2="17" y2="21"/><line x1="2" y1="9" x2="7" y2="9"/><line x1="2" y1="15" x2="7" y2="15"/><line x1="17" y1="9" x2="22" y2="9"/><line x1="17" y1="15" x2="22" y2="15"/></svg>
                {:else if item.icon === 'tv'}
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><polyline points="17 2 12 7 7 2"/></svg>
                {:else if item.icon === 'download'}
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                {:else if item.icon === 'calendar'}
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                {:else if item.icon === 'history'}
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l3 2"/></svg>
                {:else if item.icon === 'search'}
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                {:else if item.icon === 'cc'}
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M9.5 14.5a2.5 2.5 0 0 1 0-5"/><path d="M17 14.5a2.5 2.5 0 0 1 0-5"/></svg>
                {/if}
              </span>
              <span class="label">{item.label}</span>
            </button>
          </li>
        {/each}
      </ul>
    </nav>

    {#if showLogout}
      <div class="sidebar-footer">
        <button class="logout-btn" onclick={logout} disabled={loggingOut}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          <span class="label">{loggingOut ? 'Signing out…' : 'Sign out'}</span>
        </button>
      </div>
    {/if}
  </aside>

  <main class="content">
    {@render children()}
  </main>

  <!-- Mobile bottom tab bar -->
  <nav class="tabbar" aria-label="Main navigation">
    <ul>
      {#each NAV as item (item.id)}
        <li>
          <button
            class="tab"
            class:active={$route === item.id}
            aria-current={$route === item.id ? 'page' : undefined}
            aria-label={item.label}
            onclick={() => navigate(item.id)}
          >
            <span class="icon" aria-hidden="true">
              {#if item.icon === 'grid'}
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>
              {:else if item.icon === 'film'}
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="18" rx="2"/><line x1="7" y1="3" x2="7" y2="21"/><line x1="17" y1="3" x2="17" y2="21"/><line x1="2" y1="9" x2="7" y2="9"/><line x1="2" y1="15" x2="7" y2="15"/><line x1="17" y1="9" x2="22" y2="9"/><line x1="17" y1="15" x2="22" y2="15"/></svg>
              {:else if item.icon === 'tv'}
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><polyline points="17 2 12 7 7 2"/></svg>
              {:else if item.icon === 'download'}
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              {:else if item.icon === 'calendar'}
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              {:else if item.icon === 'history'}
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l3 2"/></svg>
              {:else if item.icon === 'search'}
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              {:else if item.icon === 'cc'}
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M9.5 14.5a2.5 2.5 0 0 1 0-5"/><path d="M17 14.5a2.5 2.5 0 0 1 0-5"/></svg>
              {/if}
            </span>
            <span class="tab-label">{item.label}</span>
          </button>
        </li>
      {/each}
    </ul>
  </nav>
</div>

<style>
  .shell {
    display: flex;
    min-height: 100dvh;
    background: var(--bg);
  }

  /* ---- Sidebar ---- */
  .sidebar {
    position: sticky;
    top: 0;
    height: 100dvh;
    width: 220px;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    background: var(--surface);
    border-right: 1px solid var(--border);
    padding: var(--space-5) var(--space-3);
  }

  .brand {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: 0 var(--space-2) var(--space-5);
    border-bottom: 1px solid var(--border);
    margin-bottom: var(--space-4);
  }
  .wordmark {
    font-size: var(--text-lg);
    font-weight: 700;
    letter-spacing: -0.03em;
    color: var(--text);
  }

  .nav-list {
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .nav-item {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    width: 100%;
    padding: var(--space-2) var(--space-3);
    background: none;
    border: none;
    border-radius: var(--radius-md);
    color: var(--text-muted);
    font-size: var(--text-sm);
    font-weight: 500;
    text-align: left;
    transition: color var(--trans), background var(--trans);
  }
  .nav-item:hover {
    color: var(--text);
    background: color-mix(in oklch, var(--text) 5%, transparent);
  }
  .nav-item.active {
    color: var(--accent);
    background: var(--accent-dim);
  }

  .icon {
    display: flex;
    align-items: center;
    flex-shrink: 0;
  }
  .icon svg {
    width: 17px;
    height: 17px;
  }

  .sidebar-footer {
    margin-top: auto;
    padding-top: var(--space-4);
    border-top: 1px solid var(--border);
  }

  .logout-btn {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    width: 100%;
    padding: var(--space-2) var(--space-3);
    background: none;
    border: none;
    border-radius: var(--radius-md);
    color: var(--text-muted);
    font-size: var(--text-sm);
    font-weight: 500;
    transition: color var(--trans), background var(--trans);
  }
  .logout-btn:hover:not(:disabled) {
    color: var(--red);
    background: color-mix(in oklch, var(--red) 10%, transparent);
  }
  .logout-btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .logout-btn svg {
    width: 17px;
    height: 17px;
    flex-shrink: 0;
  }

  /* ---- Content ---- */
  .content {
    flex: 1;
    min-width: 0;
    padding: var(--space-8);
  }

  /* ---- Mobile tab bar ---- */
  .tabbar {
    display: none;
  }

  @media (max-width: 720px) {
    .sidebar { display: none; }

    .content {
      padding: var(--space-5) var(--space-4) calc(var(--space-16) + var(--space-8));
    }

    .tabbar {
      display: block;
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      z-index: 20;
      background: color-mix(in oklch, var(--surface) 92%, transparent);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border-top: 1px solid var(--border);
      padding-bottom: env(safe-area-inset-bottom, 0);
    }
    .tabbar ul {
      list-style: none;
      display: flex;
      overflow-x: auto;
      align-items: stretch;
    }
    .tabbar li { flex: 0 0 68px; min-width: 0; }
    .tab {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 3px;
      width: 100%;
      padding: var(--space-2) 0 var(--space-2);
      background: none;
      border: none;
      color: var(--text-faint);
      transition: color var(--trans);
    }
    .tab.active { color: var(--accent); }
    .tab .icon svg { width: 19px; height: 19px; }
    .tab-label {
      font-size: 9px;
      font-weight: 500;
      letter-spacing: 0.01em;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 100%;
      white-space: nowrap;
    }
  }
</style>
