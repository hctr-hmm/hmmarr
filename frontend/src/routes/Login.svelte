<script>
  import { api } from '../lib/api.js';
  import { authStatus, navigate } from '../lib/stores.js';

  let username = $state('');
  let password = $state('');
  let loading  = $state(false);
  let error    = $state('');
  let revealed = $state(false);

  async function submit(e) {
    e.preventDefault();
    if (!username.trim()) { error = 'Enter your username.'; return; }
    if (!password)        { error = 'Enter your password.'; return; }
    error   = '';
    loading = true;
    try {
      await api.login(username.trim(), password);
      authStatus.update((s) => ({ ...s, authenticated: true }));
      navigate('dashboard');
    } catch (err) {
      error    = err.status === 401 ? 'Incorrect username or password.' : 'Could not reach the server.';
      password = '';
    } finally {
      loading = false;
    }
  }
</script>

<div class="page">
  <div class="card">
    <!-- Logo -->
    <div class="brand">
      <svg width="36" height="36" viewBox="0 0 36 36" fill="none" aria-hidden="true">
        <rect x="4"  y="6"  width="4" height="24" rx="1.5" fill="#e6b450"/>
        <rect x="28" y="6"  width="4" height="24" rx="1.5" fill="#e6b450"/>
        <rect x="4"  y="16" width="28" height="4" rx="1.5" fill="#e6b450"/>
        <rect x="14" y="6"  width="3" height="10" rx="1"   fill="#39bae6" opacity="0.7"/>
      </svg>
      <span class="wordmark">hmmarr</span>
    </div>

    <h1 class="title">Sign in</h1>
    <p class="subtitle">Enter your credentials to continue.</p>

    <form onsubmit={submit} novalidate>
      <!-- Username -->
      <div class="field">
        <label for="username">Username</label>
        <input
          id="username"
          type="text"
          bind:value={username}
          placeholder="username"
          autocomplete="username"
          spellcheck="false"
          autocapitalize="none"
          disabled={loading}
        />
      </div>

      <!-- Password -->
      <div class="field">
        <label for="password">Password</label>
        <div class="input-wrap" class:error-ring={error}>
          <input
            id="password"
            type={revealed ? 'text' : 'password'}
            bind:value={password}
            placeholder="••••••••"
            autocomplete="current-password"
            disabled={loading}
          />
          <button
            type="button"
            class="reveal-btn"
            onclick={() => (revealed = !revealed)}
            aria-label={revealed ? 'Hide password' : 'Show password'}
          >
            {#if revealed}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                <line x1="1" y1="1" x2="23" y2="23"/>
              </svg>
            {:else}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
            {/if}
          </button>
        </div>
        {#if error}
          <p class="error-msg" role="alert">{error}</p>
        {/if}
      </div>

      <button type="submit" class="submit-btn" disabled={loading}>
        {#if loading}
          <span class="spinner" aria-hidden="true"></span>
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
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 100dvh;
    padding: var(--space-6);
    background: var(--bg);
    background-image:
      radial-gradient(ellipse 60% 40% at 20% 80%, color-mix(in oklch, var(--blue) 5%, transparent), transparent),
      radial-gradient(ellipse 40% 30% at 80% 20%, color-mix(in oklch, var(--accent) 4%, transparent), transparent);
  }

  .card {
    width: 100%;
    max-width: 380px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    padding: var(--space-8);
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
    box-shadow:
      0 0 0 1px color-mix(in oklch, var(--text) 4%, transparent),
      0 8px 32px oklch(0 0 0 / 0.5),
      0 2px 8px oklch(0 0 0 / 0.3);
  }

  .brand { display: flex; align-items: center; gap: var(--space-3); }
  .wordmark { font-size: var(--text-xl); font-weight: 700; letter-spacing: -0.03em; color: var(--text); }

  .title    { font-size: var(--text-lg); font-weight: 600; color: var(--text); letter-spacing: -0.01em; margin-top: calc(-1 * var(--space-2)); }
  .subtitle { font-size: var(--text-sm); color: var(--text-muted); margin-top: calc(-1 * var(--space-3)); }

  form { display: flex; flex-direction: column; gap: var(--space-4); }

  .field { display: flex; flex-direction: column; gap: var(--space-2); }
  .field label {
    font-size: var(--text-xs);
    font-weight: 500;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  /* Standalone username input (no reveal button) */
  .field > input {
    width: 100%;
    background: var(--surface-2);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-md);
    padding: var(--space-3);
    font-size: var(--text-sm);
    color: var(--text);
    transition: border-color var(--trans), box-shadow var(--trans);
    outline: none;
  }
  .field > input::placeholder { color: var(--text-faint); }
  .field > input:focus {
    border-color: var(--accent);
    box-shadow: 0 0 0 2px color-mix(in oklch, var(--accent) 20%, transparent);
  }
  .field > input:disabled { opacity: 0.5; cursor: not-allowed; }

  /* Password input with reveal button */
  .input-wrap { position: relative; display: flex; align-items: center; }
  .input-wrap input {
    width: 100%;
    background: var(--surface-2);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-md);
    padding: var(--space-3) var(--space-10) var(--space-3) var(--space-3);
    font-size: var(--text-sm);
    color: var(--text);
    transition: border-color var(--trans), box-shadow var(--trans);
    outline: none;
  }
  .input-wrap input::placeholder { color: var(--text-faint); }
  .input-wrap input:focus {
    border-color: var(--accent);
    box-shadow: 0 0 0 2px color-mix(in oklch, var(--accent) 20%, transparent);
  }
  .input-wrap input:disabled { opacity: 0.5; cursor: not-allowed; }
  .input-wrap.error-ring input {
    border-color: var(--red);
    box-shadow: 0 0 0 2px color-mix(in oklch, var(--red) 20%, transparent);
  }

  .reveal-btn {
    position: absolute;
    right: var(--space-3);
    background: none;
    border: none;
    padding: var(--space-1);
    color: var(--text-muted);
    display: flex;
    align-items: center;
    border-radius: var(--radius-sm);
    transition: color var(--trans);
  }
  .reveal-btn:hover { color: var(--text); }

  .error-msg {
    font-size: var(--text-xs);
    color: var(--red);
    display: flex;
    align-items: center;
    gap: var(--space-1);
  }
  .error-msg::before { content: '×'; font-size: 1.1em; font-weight: 700; }

  .submit-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    width: 100%;
    padding: var(--space-3) var(--space-4);
    background: var(--accent);
    color: #0d1017;
    font-size: var(--text-sm);
    font-weight: 600;
    border: none;
    border-radius: var(--radius-md);
    transition: background var(--trans), opacity var(--trans), transform 100ms var(--ease-out);
    letter-spacing: 0.01em;
  }
  .submit-btn:hover:not(:disabled)  { background: color-mix(in oklch, var(--accent) 85%, white); }
  .submit-btn:active:not(:disabled) { transform: scale(0.985); }
  .submit-btn:disabled { opacity: 0.5; cursor: not-allowed; }

  @keyframes spin { to { transform: rotate(360deg); } }
  .spinner {
    display: inline-block;
    width: 14px; height: 14px;
    border: 2px solid color-mix(in oklch, #0d1017 40%, transparent);
    border-top-color: #0d1017;
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
    flex-shrink: 0;
  }
</style>
