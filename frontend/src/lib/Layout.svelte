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
    { label: 'Library', ids: ['movies', 'series', 'seerr', 'jellyfin'] },
    { label: 'Services', ids: ['bazarr', 'prowlarr', 'qbittorrent'] }
  ];

  const MOVIE_TOOLS = ['discover', 'collections', 'wanted', 'queue', 'calendar', 'history', 'blocklist'];
  let movieToolsOpen = $state(false);
  $effect(() => { movieToolsOpen = MOVIE_TOOLS.includes($route) || $route === 'movies'; });

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
    <div class="nav-entry">
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
    {#if item.id === 'movies'}
      <button class="expand-button" aria-label="Movie tools" aria-expanded={movieToolsOpen} aria-controls="movie-tools" onclick={() => movieToolsOpen = !movieToolsOpen}>
        <svg class:expanded={movieToolsOpen} viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="m6 4 4 4-4 4"/></svg>
      </button>
    {/if}
    </div>
    {#if item.id === 'movies' && movieToolsOpen}
      <ul class="subnav" id="movie-tools">
        {#each MOVIE_TOOLS as id}
          <li><button class:active={$route === id} aria-current={$route === id ? 'page' : undefined} onclick={() => go(id)}>{NAV.find(item => item.id === id).label}</button></li>
        {/each}
      </ul>
    {/if}
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
              {#each group.ids.map(id => NAV.find(item => item.id === id)) as item (item.id)}
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
  .shell { display: flex; min-height: 100dvh; background: var(--bg); }
  .sidebar { position: sticky; top: 0; height: 100dvh; width: 216px; flex-shrink: 0; display: flex; flex-direction: column; padding: 26px 12px 16px; background: var(--surface); border-right: 1px solid var(--border); z-index: 31; }
  .brand { padding: 0 12px 26px; }
  .brand img { display: block; width: 146px; height: auto; }
  .sidebar-nav { flex: 1; min-height: 0; overflow-y: auto; scrollbar-width: thin; scrollbar-color: var(--border) transparent; }
  .nav-group + .nav-group { margin-top: 24px; }
  .group-heading { padding: 0 12px 9px; color: var(--text-faint); font-size: 11px; font-weight: 550; letter-spacing: .04em; }
  .nav-list, .subnav { list-style: none; display: grid; gap: 3px; }
  .nav-entry { display: flex; align-items: center; position: relative; }
  .nav-item { display: flex; align-items: center; gap: 11px; width: 100%; min-height: 38px; padding: 9px 12px; border: 0; border-radius: 5px; background: none; color: var(--text-muted); font-size: 13px; font-weight: 500; text-align: left; transition: background var(--trans), color var(--trans); }
  .nav-item:hover, .subnav button:hover { color: var(--text); background: var(--surface-2); }
  .nav-item.active { color: var(--text); background: var(--surface-3); }
  .nav-item.active .icon { color: var(--accent); }
  .icon { display: flex; flex-shrink: 0; }
  .icon svg { width: 17px; height: 17px; }
  .expand-button { position: absolute; right: 5px; display: grid; place-items: center; width: 30px; height: 30px; border: 0; border-radius: 4px; color: var(--text-muted); background: transparent; }
  .expand-button:hover { background: var(--surface-3); color: var(--text); }
  .expand-button svg { width: 14px; height: 14px; transition: transform var(--trans); }
  .expand-button svg.expanded { transform: rotate(90deg); }
  .subnav { margin: 6px 0 8px 20px; padding-left: 15px; border-left: 1px solid var(--border); gap: 1px; }
  .subnav button { width: 100%; min-height: 32px; padding: 6px 10px; text-align: left; color: var(--text-muted); background: none; border: 0; border-radius: 4px; font-size: 12px; }
  .subnav button.active { color: var(--accent); background: var(--surface-2); }
  .nav-utility { flex-shrink: 0; margin-top: 20px; padding-top: 16px; border-top: 1px solid var(--border); }
  .sidebar-footer { flex-shrink: 0; display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 12px 12px 0; margin-top: 12px; border-top: 1px solid var(--border); }
  .signed-in { min-width: 0; color: var(--text-faint); font-size: 12px; overflow: hidden; text-overflow: ellipsis; }
  .logout-btn { display: flex; align-items: center; gap: 7px; padding: 6px 0; border: 0; background: none; color: var(--text-muted); font-size: 12px; white-space: nowrap; }
  .logout-btn:hover { color: var(--text); }
  .logout-btn:disabled { opacity: .5; }
  .logout-btn svg { width: 14px; height: 14px; }
  .content { flex: 1; min-width: 0; padding: 36px clamp(24px, 3vw, 48px) 56px; }
  .mobile-header, .menu-backdrop { display: none; }
  @media (max-width: 720px) {
    .shell { display: block; }
    .mobile-header { position: sticky; top: 0; z-index: 32; height: 60px; display: flex; align-items: center; gap: 12px; padding: 0 16px; border-bottom: 1px solid var(--border); background: var(--surface); }
    .mobile-header img { width: 112px; height: auto; }
    .mobile-current { margin-left: auto; color: var(--text-muted); font-size: 12px; }
    .menu-button { display: grid; place-items: center; width: 32px; height: 36px; border: 0; background: none; color: var(--text); }
    .menu-button svg { width: 21px; height: 21px; }
    .sidebar { display: none; position: fixed; top: 60px; bottom: 0; height: calc(100dvh - 60px); width: 240px; padding-top: 20px; }
    .sidebar.open { display: flex; }
    .brand { display: none; }
    .menu-backdrop { display: block; position: fixed; inset: 60px 0 0; z-index: 30; border: 0; background: #0009; }
    .content { padding: 26px 18px 40px; }
  }
</style>
