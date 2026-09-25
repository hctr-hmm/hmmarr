<script lang="ts">
  import { goto } from '$app/navigation';
  import { authStore } from '$lib/stores/auth.svelte';
  import { servicesStore } from '$lib/stores/services.svelte';
  import Spinner from '$lib/components/Spinner.svelte';

  let token = $state('');
  let error = $state('');
  let submitting = $state(false);

  async function submit(e: SubmitEvent) {
    e.preventDefault();
    if (!token.trim()) return;
    submitting = true;
    error = '';
    const ok = await authStore.login(token.trim());
    if (ok) {
      await servicesStore.fetchList();
      servicesStore.startPolling(30_000);
      goto('/');
    } else {
      error = authStore.error ?? 'Invalid token';
      token = '';
      submitting = false;
    }
  }
</script>

<svelte:head><title>Login — hmmarr</title></svelte:head>

<div class="page">
  <div class="card">
    <div class="brand">
      <svg viewBox="0 0 32 32" width="36" height="36" fill="none" aria-hidden="true">
        <rect x="4" y="4" width="11" height="24" rx="2" fill="currentColor" opacity="0.15"/>
        <rect x="4" y="4" width="4" height="24" rx="2" fill="currentColor"/>
        <rect x="4" y="14" width="11" height="4" rx="1.5" fill="currentColor"/>
        <rect x="11" y="14" width="4" height="14" rx="2" fill="currentColor"/>
        <rect x="18" y="4" width="10" height="10" rx="2" fill="currentColor" opacity="0.5"/>
        <rect x="20" y="16" width="8" height="12" rx="2" fill="currentColor" opacity="0.7"/>
      </svg>
      <h1>hmmarr</h1>
    </div>
    <p class="subtitle">Enter your access token to continue</p>

    <form onsubmit={submit}>
      <div class="field">
        <label for="token">Token</label>
        <input
          id="token"
          type="password"
          bind:value={token}
          placeholder="paste token here"
          autocomplete="current-password"
          disabled={submitting}
          autofocus
        />
      </div>
      {#if error}
        <p class="error-msg" role="alert">{error}</p>
      {/if}
      <button type="submit" class="btn-primary" disabled={submitting || !token.trim()}>
        {#if submitting}
          <Spinner size={14} color="currentColor" />
          Signing in…
        {:else}
          Sign in
        {/if}
      </button>
    </form>
  </div>
</div>

<style>
  .page {
    min-height: 100dvh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--space-4);
  }

  .card {
    width: 100%;
    max-width: 360px;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-xl);
    padding: var(--space-8);
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    box-shadow: var(--shadow-lg);
  }

  .brand {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    color: var(--color-text);
  }
  h1 {
    font-size: var(--text-xl);
    font-weight: 700;
    letter-spacing: -0.04em;
  }

  .subtitle {
    font-size: var(--text-sm);
    color: var(--color-text-muted);
    max-width: none;
  }

  form {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  label {
    font-size: var(--text-xs);
    font-weight: 500;
    color: var(--color-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }
  input {
    padding: var(--space-3) var(--space-4);
    background: var(--color-surface-2);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    font-size: var(--text-sm);
    color: var(--color-text);
    transition: border-color var(--t), box-shadow var(--t);
    width: 100%;
  }
  input:focus {
    outline: none;
    border-color: var(--color-primary);
    box-shadow: 0 0 0 3px color-mix(in oklch, var(--color-primary) 18%, transparent);
  }
  input:disabled { opacity: 0.6; }

  .error-msg {
    font-size: var(--text-sm);
    color: var(--color-error);
    max-width: none;
  }

  .btn-primary {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    padding: var(--space-3) var(--space-4);
    background: var(--color-primary);
    color: var(--color-text-inverse);
    border-radius: var(--radius-md);
    font-size: var(--text-sm);
    font-weight: 600;
    transition: background var(--t), opacity var(--t);
    width: 100%;
  }
  .btn-primary:hover:not(:disabled) { background: var(--color-primary-hover); }
  .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
</style>
