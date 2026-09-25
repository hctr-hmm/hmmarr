<script lang="ts">
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { authStore } from '$lib/stores/auth.svelte';
  import { servicesStore } from '$lib/stores/services.svelte';
  import StatusDot from './StatusDot.svelte';

  type NavItem = {
    href: string;
    label: string;
    service?: string;
    icon: string;
    accentVar?: string;
  };

  const nav: NavItem[] = [
    { href: '/',         label: 'Overview',  icon: 'M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z' },
    { href: '/radarr',   label: 'Radarr',    service: 'radarr',   accentVar: '--color-radarr',   icon: 'M7 4v16M17 4v16M3 8h4m10 0h4M3 16h4m10 0h4M7 8h10v8H7z' },
    { href: '/sonarr',   label: 'Sonarr',    service: 'sonarr',   accentVar: '--color-sonarr',   icon: 'M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z' },
    { href: '/bazarr',   label: 'Bazarr',    service: 'bazarr',   accentVar: '--color-bazarr',   icon: 'M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z' },
    { href: '/prowlarr', label: 'Prowlarr',  service: 'prowlarr', accentVar: '--color-prowlarr', icon: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z' },
  ];

  let theme = $state<'dark' | 'light'>(
    typeof document !== 'undefined' && document.documentElement.dataset.theme === 'light' ? 'light' : 'dark'
  );

  function toggleTheme() {
    theme = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = theme;
  }

  async function logout() {
    await authStore.logout();
    goto('/login');
  }

  function isActive(href: string) {
    if (href === '/') return $page.url.pathname === '/';
    return $page.url.pathname.startsWith(href);
  }
</script>

<aside class="sidebar">
  <!-- Logo -->
  <div class="logo">
    <svg viewBox="0 0 32 32" width="26" height="26" fill="none" aria-hidden="true">
      <!-- hmmarr: stylised 'h' mark -->
      <rect x="4" y="4" width="11" height="24" rx="2" fill="currentColor" opacity="0.15"/>
      <rect x="4" y="4" width="4" height="24" rx="2" fill="currentColor"/>
      <rect x="4" y="14" width="11" height="4" rx="1.5" fill="currentColor"/>
      <rect x="11" y="14" width="4" height="14" rx="2" fill="currentColor"/>
      <rect x="18" y="4" width="10" height="10" rx="2" fill="currentColor" opacity="0.5"/>
      <rect x="20" y="16" width="8" height="12" rx="2" fill="currentColor" opacity="0.7"/>
    </svg>
    <span class="logo-text">hmmarr</span>
  </div>

  <!-- Nav -->
  <nav class="nav">
    {#each nav as item}
      {@const status = item.service ? servicesStore.statuses[item.service as keyof typeof servicesStore.statuses] : undefined}
      {@const configured = !item.service || servicesStore.list.some(s => s.name === item.service)}
      <a
        href={item.href}
        class="nav-item"
        class:active={isActive(item.href)}
        class:unconfigured={!configured}
        style={item.accentVar ? `--accent:var(${item.accentVar})` : ''}
        title={!configured ? `${item.label} not configured` : item.label}
      >
        <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" width="18" height="18">
          <path d={item.icon} stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <span class="nav-label">{item.label}</span>
        {#if item.service && configured}
          <StatusDot
            online={status?.online ?? false}
            loading={status?.loading ?? true}
            size={6}
          />
        {/if}
      </a>
    {/each}
  </nav>

  <div class="sidebar-footer">
    <!-- Theme toggle -->
    <button class="icon-btn" onclick={toggleTheme} aria-label="Toggle theme">
      {#if theme === 'dark'}
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="5"/>
          <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" stroke-linecap="round"/>
        </svg>
      {:else}
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      {/if}
    </button>

    {#if authStore.authRequired}
      <button class="icon-btn" onclick={logout} aria-label="Log out">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
    {/if}
  </div>
</aside>

<style>
  .sidebar {
    width: 200px;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    background: var(--color-surface);
    border-right: 1px solid var(--color-border);
    padding: var(--space-4) var(--space-3);
    gap: var(--space-4);
  }

  .logo {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-1) var(--space-2);
    color: var(--color-text);
  }
  .logo-text {
    font-size: var(--text-sm);
    font-weight: 700;
    letter-spacing: -0.03em;
  }

  .nav {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .nav-item {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-2) var(--space-3);
    border-radius: var(--radius-md);
    font-size: var(--text-sm);
    color: var(--color-text-muted);
    transition: background var(--t), color var(--t);
    position: relative;
  }
  .nav-item:hover:not(.unconfigured) {
    background: var(--color-surface-hover);
    color: var(--color-text);
  }
  .nav-item.active {
    background: var(--color-surface-3);
    color: var(--color-text);
  }
  .nav-item.active .nav-icon {
    color: var(--accent, var(--color-primary));
  }
  .nav-item.unconfigured {
    opacity: 0.35;
    cursor: not-allowed;
    pointer-events: none;
  }

  .nav-label { flex: 1; }

  .nav-icon {
    flex-shrink: 0;
    transition: color var(--t);
  }

  .sidebar-footer {
    display: flex;
    gap: var(--space-2);
    padding: var(--space-1) var(--space-1);
  }

  .icon-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border-radius: var(--radius-md);
    color: var(--color-text-muted);
    transition: background var(--t), color var(--t);
  }
  .icon-btn:hover {
    background: var(--color-surface-hover);
    color: var(--color-text);
  }

  @media (max-width: 640px) {
    .sidebar {
      width: 56px;
      padding: var(--space-3) var(--space-2);
    }
    .logo-text, .nav-label { display: none; }
    .logo { justify-content: center; }
    .nav-item { justify-content: center; padding: var(--space-2); }
    .sidebar-footer { flex-direction: column; align-items: center; }
  }
</style>
