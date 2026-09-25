<script>
  let { title = '' } = $props();
</script>

<div class="page">
  <header class="page-head">
    <h1 class="title">{title}</h1>
    <p class="subtitle">This view hasn't been built yet.</p>
  </header>

  <div class="empty">
    <div class="empty-inner">
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
      </svg>
      <p class="empty-text">Work in progress</p>
      <p class="empty-hint">Head back to the Dashboard in the meantime.</p>
    </div>
  </div>
</div>

<style>
  .page {
    max-width: 960px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: var(--space-6);
  }
  .title {
    font-size: var(--text-xl);
    font-weight: 700;
    letter-spacing: -0.02em;
    color: var(--text);
  }
  .subtitle {
    margin-top: var(--space-1);
    font-size: var(--text-sm);
    color: var(--text-muted);
  }
  .empty {
    border: 1px dashed var(--border-subtle);
    border-radius: var(--radius-lg);
    background: color-mix(in oklch, var(--surface) 60%, transparent);
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 320px;
  }
  .empty-inner {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-2);
    color: var(--text-faint);
    text-align: center;
    padding: var(--space-6);
  }
  .empty-text { font-size: var(--text-sm); font-weight: 600; color: var(--text-muted); }
  .empty-hint { font-size: var(--text-xs); color: var(--text-faint); }
</style>
