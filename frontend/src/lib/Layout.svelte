<script>
  import { route, navigate, authStatus } from './stores.js';
  import { api } from './api.js';

  let { children } = $props();

  const NAV = [
    { id: 'dashboard', label: 'Dashboard', icon: 'grid' },
    { id: 'movies', label: 'Movies', icon: 'film' },
    { id: 'discover', label: 'Discover', icon: 'search' },
    { id: 'collections', label: 'Collections', icon: 'film' },
    { id: 'wanted', label: 'Wanted', icon: 'download' },
    { id: 'queue', label: 'Queue', icon: 'download' },
    { id: 'calendar', label: 'Calendar', icon: 'calendar' },
    { id: 'history', label: 'History', icon: 'history' },
    { id: 'blocklist', label: 'Blocklist', icon: 'download' },
    { id: 'series', label: 'Series', icon: 'tv' },
    { id: 'bazarr', label: 'Subtitles', icon: 'cc' },
    { id: 'prowlarr', label: 'Indexers', icon: 'search' },
    { id: 'qbittorrent', label: 'Torrents', icon: 'download' },
    { id: 'seerr', label: 'Requests', icon: 'film' },
    { id: 'jellyfin', label: 'Now watching', icon: 'tv' },
    { id: 'system', label: 'System', icon: 'grid' },
    { id: 'users', label: 'Users', icon: 'users' }
  ];

  const NAV_GROUPS = [
    { label: 'Overview', ids: ['dashboard'] },
    { label: 'Library', ids: ['movies', 'series', 'discover', 'collections'] },
    { label: 'Activity', ids: ['wanted', 'queue', 'calendar', 'history', 'blocklist'] },
    { label: 'Services', ids: ['bazarr', 'prowlarr', 'qbittorrent', 'seerr', 'jellyfin'] }
  ];

  let menuOpen = $state(false);
  let loggingOut = $state(false);

  async function logout() {
    if (loggingOut) return;
    loggingOut = true;
    try {
      await api.logout();
    } catch {
      // Cookie may already be gone — proceed to login anyway.
    } finally {
      authStatus.set({ checked: true, authRequired: true, authenticated: false, user: null });
      navigate('login');
    }
  }

  const showLogout = $derived($authStatus.authRequired);

  function go(id) {
    menuOpen = false;
    navigate(id);
  }
</script>

<svelte:window onkeydown={(event) => { if (event.key === 'Escape') menuOpen = false; }} />

{#snippet sidebarItem(item)}
  <li>
    <button
      class="nav-item"
      class:active={$route === item.id}
      aria-current={$route === item.id ? 'page' : undefined}
      onclick={() => go(item.id)}
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
        {:else if item.icon === 'users'}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2"/><path d="M17 5a3 3 0 0 1 0 6M17 14a5 5 0 0 1 4 5v1"/></svg>
        {:else if item.icon === 'cc'}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M9.5 14.5a2.5 2.5 0 0 1 0-5"/><path d="M17 14.5a2.5 2.5 0 0 1 0-5"/></svg>
        {/if}
      </span>
      <span class="label">{item.label}</span>
    </button>
  </li>
{/snippet}

<div class="shell">
  <header class="mobile-header">
    <button class="menu-button" aria-label={menuOpen ? 'Close navigation' : 'Open navigation'} aria-expanded={menuOpen} onclick={() => menuOpen = !menuOpen}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d={menuOpen ? 'M5 5l14 14M19 5L5 19' : 'M4 7h16M4 12h16M4 17h16'}/></svg>
    </button>
    <img src="/hmmarr-logo.svg" alt="hmmarr" width="144" height="37" />
    <span class="mobile-current">{NAV.find((item) => item.id === $route)?.label || 'Dashboard'}</span>
  </header>
  {#if menuOpen}<button class="menu-backdrop" aria-label="Close navigation" onclick={() => menuOpen = false}></button>{/if}
  <aside class="sidebar" class:open={menuOpen}>
    <div class="brand">
      <img src="/hmmarr-logo.svg" alt="hmmarr" width="180" height="46" />
    </div>

    <nav class="sidebar-nav" aria-label="Main navigation">
      {#each NAV_GROUPS as group (group.label)}
        <section class="nav-group" aria-label={group.label}>
          {#if group.label !== 'Overview'}<div class="group-heading">{group.label}</div>{/if}
          <ul class="nav-list">
              {#each NAV.filter((item) => group.ids.includes(item.id)) as item (item.id)}
                {@render sidebarItem(item)}
              {/each}
          </ul>
        </section>
      {/each}

    </nav>

    <nav class="nav-utility" aria-label="Settings navigation">
      <div class="group-heading">Settings</div>
      <ul class="nav-list">
        {@render sidebarItem(NAV.find((item) => item.id === 'system'))}
        {@render sidebarItem(NAV.find((item) => item.id === 'users'))}
      </ul>
    </nav>

    {#if showLogout}
      <div class="sidebar-footer">
        {#if $authStatus.user}<p class="signed-in">{$authStatus.user.username}</p>{/if}
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
  .brand img { display: block; width: 100%; max-width: 168px; height: auto; }

  .sidebar-nav {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: var(--border-subtle) transparent;
  }
  .nav-group { margin-top: var(--space-4); }
  .group-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    min-height: 26px;
    padding: 0 var(--space-3);
    color: var(--text-muted);
    font-size: var(--text-xs);
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .nav-utility {
    flex-shrink: 0;
    padding-top: var(--space-3);
    border-top: 1px solid var(--border);
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
    flex-shrink: 0;
    padding-top: var(--space-2);
  }
  .signed-in { padding: 8px 12px; color: var(--text-muted); font-size: var(--text-xs); overflow-wrap: anywhere; }

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

  @media (max-width: 720px) {
    .sidebar { display: none; }

    .content {
      padding: var(--space-5) var(--space-4) calc(var(--space-16) + var(--space-8));
    }
  }

  .shell { background: var(--bg); }
  .sidebar {
    width: 228px;
    padding: 20px 10px 12px;
    background: var(--surface);
    border-right-color: var(--border);
    z-index: 31;
  }
  .brand { display: grid; padding: 0 10px 19px; margin-bottom: 8px; border-bottom: 1px solid var(--border); }
  .brand img { max-width: 144px; }
  .sidebar-nav { padding: 0 3px; scrollbar-color: var(--border-subtle) transparent; }
  .nav-group { margin: 0 0 9px; }
  .group-heading {
    min-height: auto;
    padding: 12px 11px 6px;
    color: var(--text-faint);
    font-size: 11px;
    font-weight: 550;
    letter-spacing: .01em;
    text-transform: none;
  }
  .nav-list { gap: 2px; }
  .nav-item { position: relative; min-height: 36px; padding: 7px 11px; color: var(--text-muted); font-size: 13px; border-radius: var(--radius-md); }
  .nav-item:hover { background: var(--surface-2); color: var(--text); }
  .nav-item.active { background: var(--surface-2); color: var(--text); font-weight: 600; }
  .nav-item.active::before { content: none; }
  .nav-item.active .icon { color: var(--accent); }
  .icon svg { width: 17px; height: 17px; }
  .nav-utility { padding: 2px 3px 0; border-top-color: var(--border); }
  .sidebar-footer { display: grid; gap: 4px; margin: 10px 3px 0; padding-top: 10px; border-top: 1px solid var(--border); }
  .signed-in { display: block; padding: 5px 8px; color: var(--text-faint); font-size: 12px; }
  .logout-btn { min-height: 34px; padding: 7px 8px; font-size: 12px; }
  .content {
    padding: clamp(24px, 3vw, 42px);
    background: var(--bg);
  }
  .mobile-header, .menu-backdrop { display: none; }

  @media (max-width: 720px) {
    .shell { display: block; }
    .mobile-header { position: sticky; top: 0; z-index: 25; display: flex; align-items: center; gap: 13px; height: 62px; padding: 0 16px; border-bottom: 1px solid var(--border); background: var(--surface); }
    .mobile-header img { width: 122px; height: auto; }
    .mobile-current { min-width: 0; margin-left: auto; color: var(--text-muted); font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .menu-button { display: grid; place-items: center; width: 36px; height: 36px; border: 1px solid var(--border); border-radius: var(--radius-md); background: var(--surface-2); color: var(--text); }
    .menu-button svg { width: 19px; height: 19px; }
    .menu-backdrop { display: block; position: fixed; inset: 0; z-index: 29; width: 100%; border: 0; background: #000000c9; }
    .sidebar { display: flex; position: fixed; top: 0; bottom: 0; left: 0; width: min(290px, 84vw); height: 100dvh; visibility: hidden; transform: translateX(-105%); transition: transform 220ms var(--ease-out), visibility 220ms; box-shadow: 16px 0 48px #0008; }
    .sidebar.open { visibility: visible; transform: translateX(0); }
    .content { padding: 25px 16px 48px; min-height: calc(100dvh - 62px); }
  }
</style>
