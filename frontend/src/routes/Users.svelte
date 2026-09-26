<script>
  import { onMount } from 'svelte';
  import { api } from '../lib/api.js';
  import { authStatus } from '../lib/stores.js';
  import { formatDate, errorMessage } from '../lib/radarr.js';

  let users = $state([]);
  let loading = $state(false);
  let busy = $state('');
  let accountError = $state('');
  let accountNotice = $state('');
  let adminError = $state('');
  let adminNotice = $state('');
  let currentPassword = $state('');
  let newPassword = $state('');
  let confirmPassword = $state('');
  let newUsername = $state('');
  let userPassword = $state('');
  let resetTarget = $state('');
  let resetPassword = $state('');
  let resetConfirm = $state('');

  const isAdmin = $derived(Boolean($authStatus.user?.isAdmin));

  function messageFor(cause) {
    const code = cause?.data?.error;
    if (code === 'username_taken') return 'That username is already in use.';
    if (code === 'incorrect_current_password') return 'Current password is incorrect.';
    if (code === 'password_must_be_12_to_256_characters') return 'Use a password between 12 and 256 characters.';
    if (code === 'username_must_be_3_to_32_letters_numbers_dots_dashes_or_underscores') return 'Use 3–32 letters, numbers, dots, dashes, or underscores for the username.';
    return errorMessage(cause);
  }

  async function loadUsers() {
    if (!isAdmin) return;
    loading = true;
    adminError = '';
    try { users = await api.admin.listUsers(); }
    catch (cause) { adminError = messageFor(cause); }
    finally { loading = false; }
  }

  onMount(loadUsers);

  async function changeOwnPassword(event) {
    event.preventDefault();
    accountError = '';
    accountNotice = '';
    if (newPassword.length < 12) { accountError = 'Use at least 12 characters for the new password.'; return; }
    if (newPassword !== confirmPassword) { accountError = 'The new passwords do not match.'; return; }
    busy = 'account';
    try {
      await api.changePassword(currentPassword, newPassword);
      currentPassword = '';
      newPassword = '';
      confirmPassword = '';
      accountNotice = 'Password changed. Other sessions for this account were signed out.';
    } catch (cause) { accountError = messageFor(cause); }
    finally { busy = ''; }
  }

  async function addUser(event) {
    event.preventDefault();
    adminError = '';
    adminNotice = '';
    const username = newUsername.trim();
    if (!/^[A-Za-z0-9._-]{3,32}$/.test(username)) {
      adminError = 'Use 3–32 letters, numbers, dots, dashes, or underscores for the username.';
      return;
    }
    if (userPassword.length < 12) { adminError = 'Use at least 12 characters for the password.'; return; }
    busy = 'create';
    try {
      await api.admin.createUser(username, userPassword);
      newUsername = '';
      userPassword = '';
      adminNotice = 'Account created for ' + username + '.';
      await loadUsers();
    } catch (cause) { adminError = messageFor(cause); }
    finally { busy = ''; }
  }

  async function saveReset(event) {
    event.preventDefault();
    adminError = '';
    adminNotice = '';
    if (resetPassword.length < 12) { adminError = 'Use at least 12 characters for the new password.'; return; }
    if (resetPassword !== resetConfirm) { adminError = 'The new passwords do not match.'; return; }
    busy = 'reset';
    try {
      await api.admin.resetPassword(resetTarget, resetPassword);
      adminNotice = 'Password reset for ' + resetTarget + '. Their other sessions were signed out.';
      resetTarget = '';
      resetPassword = '';
      resetConfirm = '';
    } catch (cause) { adminError = messageFor(cause); }
    finally { busy = ''; }
  }

  async function removeUser(username) {
    if (!window.confirm('Remove ' + username + '? They will be signed out and will no longer be able to log in.')) return;
    busy = 'delete-' + username;
    adminError = '';
    adminNotice = '';
    try {
      await api.admin.deleteUser(username);
      users = users.filter((user) => user.username !== username);
      adminNotice = 'Account removed for ' + username + '.';
    } catch (cause) { adminError = messageFor(cause); }
    finally { busy = ''; }
  }
</script>

<div class="rad-page">
  <header class="rad-head">
    <div><h1>Users</h1><p>Accounts and sign-in</p></div>
    {#if isAdmin}<button class="rad-button" onclick={loadUsers} disabled={loading}>Refresh</button>{/if}
  </header>

  <section class="rad-panel account-panel">
    <div>
      <h2>My account</h2>
      <p class="rad-muted">Signed in as <strong>{$authStatus.user?.username || '—'}</strong> · {isAdmin ? 'Administrator' : 'User'}</p>
    </div>
    <form class="form" onsubmit={changeOwnPassword}>
      <h3>Change password</h3>
      {#if accountError}<p class="rad-error" role="alert">{accountError}</p>{/if}
      {#if accountNotice}<p class="rad-success" role="status">{accountNotice}</p>{/if}
      <div class="fields">
        <label class="rad-field">Current password<input class="rad-input" type="password" bind:value={currentPassword} autocomplete="current-password" required disabled={busy === 'account'} /></label>
        <label class="rad-field">New password<input class="rad-input" type="password" bind:value={newPassword} autocomplete="new-password" minlength="12" required disabled={busy === 'account'} /></label>
        <label class="rad-field">Confirm new password<input class="rad-input" type="password" bind:value={confirmPassword} autocomplete="new-password" minlength="12" required disabled={busy === 'account'} /></label>
      </div>
      <p class="rad-muted">Use at least 12 characters. Changing your password signs out your other sessions.</p>
      <button class="rad-button primary" type="submit" disabled={!!busy}>{busy === 'account' ? 'Saving…' : 'Change password'}</button>
    </form>
  </section>

  {#if isAdmin}
    <section class="rad-panel admin-panel">
      <div>
        <h2>Manage users</h2>
        <p class="rad-muted">Create separate accounts for people who use Hmmarr.</p>
      </div>
      {#if adminError}<p class="rad-error" role="alert">{adminError}</p>{/if}
      {#if adminNotice}<p class="rad-success" role="status">{adminNotice}</p>{/if}

      <form class="form" onsubmit={addUser}>
        <h3>Add user</h3>
        <div class="fields">
          <label class="rad-field">Username<input class="rad-input" type="text" bind:value={newUsername} autocomplete="off" minlength="3" maxlength="32" pattern="[A-Za-z0-9._-]+" required disabled={!!busy} /></label>
          <label class="rad-field">Password<input class="rad-input" type="password" bind:value={userPassword} autocomplete="new-password" minlength="12" required disabled={!!busy} /></label>
        </div>
        <p class="rad-muted">New users can manage media. Only administrators can manage accounts.</p>
        <button class="rad-button primary" type="submit" disabled={!!busy}>{busy === 'create' ? 'Creating…' : 'Add user'}</button>
      </form>

      <div class="list-head"><h3>Accounts</h3><span class="rad-muted">{users.length} users</span></div>
      {#if loading && users.length === 0}
        <p class="rad-muted">Loading accounts…</p>
      {:else if users.length === 0}
        <p class="rad-empty">No accounts found.</p>
      {:else}
        <div class="rad-list">
          {#each users as user (user.id)}
            <div class="rad-row user-row">
              <div class="rad-row-main">
                <strong class="rad-row-title">{user.username}{user.id === $authStatus.user?.id ? ' · You' : ''}</strong>
                <span class="rad-row-meta">{user.is_admin ? 'Administrator' : 'User'} · Added {formatDate(user.created_at)}</span>
              </div>
              {#if !user.is_admin}
                <div class="rad-actions">
                  <button class="rad-button" onclick={() => { resetTarget = user.username; resetPassword = ''; resetConfirm = ''; adminError = ''; }} disabled={!!busy}>Reset password</button>
                  <button class="rad-button danger" onclick={() => removeUser(user.username)} disabled={!!busy}>{busy === 'delete-' + user.username ? 'Removing…' : 'Remove'}</button>
                </div>
              {/if}
            </div>
          {/each}
        </div>
      {/if}

      {#if resetTarget}
        <form class="form reset-form" onsubmit={saveReset}>
          <div class="rad-head"><h3>Reset password for {resetTarget}</h3><button class="rad-button" type="button" onclick={() => resetTarget = ''}>Cancel</button></div>
          <div class="fields">
            <label class="rad-field">New password<input class="rad-input" type="password" bind:value={resetPassword} autocomplete="new-password" minlength="12" required disabled={!!busy} /></label>
            <label class="rad-field">Confirm password<input class="rad-input" type="password" bind:value={resetConfirm} autocomplete="new-password" minlength="12" required disabled={!!busy} /></label>
          </div>
          <p class="rad-muted">This signs out the user’s existing sessions.</p>
          <button class="rad-button primary" type="submit" disabled={!!busy}>{busy === 'reset' ? 'Saving…' : 'Save new password'}</button>
        </form>
      {/if}
    </section>
  {/if}
</div>

<style>
  .account-panel, .admin-panel, .form { display: grid; gap: 16px; }
  h2 { color: var(--text); font-size: var(--text-lg); }
  h3 { color: var(--text); font-size: var(--text-sm); font-weight: 700; }
  .account-panel strong { color: var(--text); }
  .fields { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 12px; }
  .form > .rad-button { justify-self: start; }
  .list-head { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; }
  .user-row .rad-actions { flex-shrink: 0; }
  .reset-form { padding: 16px; border: 1px solid var(--border-subtle); border-radius: var(--radius-md); background: var(--surface-2); }
  @media (max-width: 600px) { .user-row .rad-actions { width: 100%; } }
</style>
