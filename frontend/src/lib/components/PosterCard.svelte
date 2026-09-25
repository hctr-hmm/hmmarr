<script lang="ts">
  import { getPoster } from '$lib/utils';

  let {
    title,
    year,
    images = [],
    hasFile,
    monitored,
    statusText,
    href,
    accentVar = '--color-primary'
  }: {
    title: string;
    year?: number;
    images?: Array<{ coverType: string; remoteUrl?: string; url?: string }>;
    hasFile?: boolean;
    monitored?: boolean;
    statusText?: string;
    href?: string;
    accentVar?: string;
  } = $props();

  const poster = $derived(getPoster(images));
  let imgError = $state(false);
</script>

<div class="card" style={`--accent:var(${accentVar})`}>
  <div class="poster">
    {#if poster && !imgError}
      <img
        src={poster}
        alt="{title} poster"
        loading="lazy"
        decoding="async"
        onerror={() => { imgError = true; }}
      />
    {:else}
      <div class="poster-fallback" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.5">
          <rect x="3" y="3" width="18" height="18" rx="2"/>
          <circle cx="8.5" cy="8.5" r="1.5"/>
          <path d="M21 15l-5-5L5 21"/>
        </svg>
      </div>
    {/if}
    <!-- file status chip -->
    {#if hasFile !== undefined}
      <span class="chip" class:has-file={hasFile} class:missing={!hasFile}>
        {hasFile ? '✓' : '✕'}
      </span>
    {/if}
  </div>

  <div class="info">
    <div class="title" title={title}>{title}</div>
    <div class="meta">
      {#if year}<span>{year}</span>{/if}
      {#if statusText}<span class="status-text">{statusText}</span>{/if}
    </div>
  </div>
</div>

<style>
  .card {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    background: none;
  }

  .poster {
    position: relative;
    aspect-ratio: 2/3;
    background: var(--color-surface-3);
    border-radius: var(--radius-md);
    overflow: hidden;
    border: 1px solid var(--color-border);
  }
  .poster img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: transform var(--t-slow);
  }
  .card:hover .poster img { transform: scale(1.03); }

  .poster-fallback {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--color-text-faint);
  }

  .chip {
    position: absolute;
    bottom: var(--space-2);
    right: var(--space-2);
    width: 20px;
    height: 20px;
    border-radius: var(--radius-full);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 10px;
    font-weight: 700;
    line-height: 1;
  }
  .chip.has-file  { background: var(--color-success); color: #000; }
  .chip.missing   { background: var(--color-surface-hover); color: var(--color-text-faint); }

  .info { padding: 0 var(--space-1); }

  .title {
    font-size: var(--text-sm);
    font-weight: 500;
    color: var(--color-text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
  }

  .meta {
    display: flex;
    gap: var(--space-2);
    font-size: var(--text-xs);
    color: var(--color-text-muted);
    flex-wrap: wrap;
  }

  .status-text {
    color: var(--color-text-faint);
    text-transform: capitalize;
  }
</style>
