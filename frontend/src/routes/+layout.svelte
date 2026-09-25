<script lang="ts">
  import '../app.css';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { authStore } from '$lib/stores/auth.svelte';
  import { servicesStore } from '$lib/stores/services.svelte';
  import Sidebar from '$lib/components/Sidebar.svelte';
  import { ApiError } from '$api/client';

  const PUBLIC_ROUTES = ['/login'];

  onMount(async () => {
    await authStore.check();
    const onPublic = PUBLIC_ROUTES.includes($page.url.pathname);

    if (!authStore.authenticated && authStore.authRequired) {
      if (!onPublic) goto('/login');
      return;
    }
    if (authStore.authenticated && onPublic) {
      goto('/');
      return;
    }
    if (authStore.authenticated || !authStore.authRequired) {
      await servicesStore.fetchList();
      servicesStore.startPolling(30_000);
    }
  });

  $effect(() => {
    if (!authStore.loading && !authStore.authenticated && authStore.authRequired) {
      const onPublic = PUBLIC_ROUTES.includes($page.url.pathname);
      if (!onPublic) goto('/login');
    }
  });

  const isPublic = $derived(PUBLIC_ROUTES.includes($page.url.pathname));
</script>

{#if authStore.loading}
  <div class="splash">
    <div class="splash-logo">hmmarr</div>
    <div class="splash-spinner"></div>
  </div>
{:else if isPublic}
  <slot />
{:else if authStore.authenticated || !authStore.authRequired}
  <div class="app-shell">
    <Sidebar />
    <main class="app-main">
      <slot />
    </main>
  </div>
{/if}

<style>
  .splash {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100dvh;
    gap: var(--space-4);
    color: var(--color-text-muted);
  }
  .splash-logo {
    font-size: var(--text-xl);
    font-weight: 700;
    letter-spacing: -0.04em;
    color: var(--color-text);
  }
  .splash-spinner {
    width: 20px;
    height: 20px;
    border: 2px solid var(--color-border-strong);
    border-top-color: var(--color-primary);
    border-radius: var(--radius-full);
    animation: spin 0.7s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  .app-shell {
    display: flex;
    height: 100dvh;
    overflow: hidden;
  }
  .app-main {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
  }
</style>
