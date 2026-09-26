<script>
  import { onMount } from 'svelte';
  import { api } from '../lib/api.js';
  import { posterUrl, errorMessage } from '../lib/radarr.js';

  const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const TYPES = [ ['inCinemas', 'Cinema'], ['digitalRelease', 'Digital'], ['physicalRelease', 'Physical'] ];
  const key = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  let month = $state(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  let selected = $state(key(new Date()));
  let movies = $state([]);
  let unmonitored = $state(false);
  let loading = $state(true);
  let error = $state('');
  const monthTitle = $derived(month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }));
  const days = $derived.by(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const offset = (first.getDay() + 6) % 7;
    const count = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    return [...Array(offset).fill(null), ...Array.from({ length: count }, (_, index) => key(new Date(month.getFullYear(), month.getMonth(), index + 1)))];
  });
  const events = $derived.by(() => {
    const all = [];
    for (const movie of movies) {
      const seen = new Set();
      for (const [field, label] of TYPES) {
        const day = movie[field]?.slice(0, 10);
        if (day && !seen.has(`${day}:${label}`)) { all.push({ day, label, movie }); seen.add(`${day}:${label}`); }
      }
      if (!seen.size && movie.releaseDate) all.push({ day: movie.releaseDate.slice(0, 10), label: 'Release', movie });
    }
    return all.sort((a, b) => a.day.localeCompare(b.day) || a.movie.title.localeCompare(b.movie.title));
  });
  const selectedEvents = $derived(events.filter((event) => event.day === selected));

  async function load() {
    loading = true;
    try {
      const start = new Date(month.getFullYear(), month.getMonth(), 1).toISOString();
      const end = new Date(month.getFullYear(), month.getMonth() + 1, 1).toISOString();
      movies = await api.proxy.get('radarr', '/api/v3/calendar', { start, end, unmonitored });
      error = '';
    } catch (cause) { error = errorMessage(cause); }
    finally { loading = false; }
  }

  onMount(load);
  function shift(amount) { month = new Date(month.getFullYear(), month.getMonth() + amount, 1); selected = key(month); load(); }
  function today() { month = new Date(new Date().getFullYear(), new Date().getMonth(), 1); selected = key(new Date()); load(); }
</script>

<div class="rad-page">
  <header class="rad-head"><div><h1>Release calendar</h1><p>Radarr’s upcoming and recent movie dates</p></div><div class="rad-actions"><label class="rad-check"><input type="checkbox" bind:checked={unmonitored} onchange={load} /> Include unmonitored</label><button class="rad-button" onclick={load} disabled={loading}>Refresh</button></div></header>
  {#if error}<p class="rad-error" role="alert">{error}</p>{/if}
  <div class="rad-actions"><button class="rad-button" onclick={() => shift(-1)} aria-label="Previous month">‹</button><button class="rad-button" onclick={today}>Today</button><button class="rad-button" onclick={() => shift(1)} aria-label="Next month">›</button><h2 class="month-title">{monthTitle}</h2>{#if loading}<span class="rad-muted">Loading…</span>{/if}</div>
  <div class="calendar" aria-label={monthTitle}>
    {#each WEEKDAYS as weekday}<div class="weekday">{weekday}</div>{/each}
    {#each days as day, index (index)}
      {#if day}<button class="day" class:selected={selected === day} class:today={day === key(new Date())} onclick={() => selected = day}><span class="day-num">{Number(day.slice(-2))}</span>{#each events.filter((event) => event.day === day).slice(0, 2) as event}<span class="event">{event.movie.title} · {event.label}</span>{/each}{#if events.filter((event) => event.day === day).length > 2}<span class="more">+{events.filter((event) => event.day === day).length - 2} more</span>{/if}</button>{:else}<div class="day blank"></div>{/if}
    {/each}
  </div>
  <section class="rad-panel"><h2 class="day-heading">{new Date(`${selected}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</h2>{#if selectedEvents.length === 0}<p class="rad-muted">No movie releases on this day.</p>{:else}<div class="rad-list">{#each selectedEvents as event}<div class="rad-row"><div class="item"><div class="small-poster">{#if posterUrl(event.movie)}<img src={posterUrl(event.movie)} alt="" loading="lazy" />{/if}</div><div class="rad-row-main"><strong class="rad-row-title">{event.movie.title} ({event.movie.year})</strong><span class="rad-row-meta">{event.label} · {event.movie.hasFile ? 'Downloaded' : event.movie.monitored ? 'Monitored' : 'Unmonitored'}</span></div></div></div>{/each}</div>{/if}</section>
</div>

<style>
  .month-title { color: var(--text); font-size: var(--text-lg); margin-left: 8px; }
  .calendar { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); border: 1px solid var(--border-subtle); border-radius: var(--radius-lg); overflow: hidden; background: var(--border); gap: 1px; }
  .weekday { background: var(--surface-2); color: var(--text-muted); text-align: center; padding: 8px; font-size: var(--text-xs); font-weight: 700; }
  .day { min-height: 105px; padding: 7px; border: 0; background: var(--surface); color: var(--text); text-align: left; display: flex; flex-direction: column; gap: 4px; min-width: 0; }
  .day:not(.blank):hover { background: var(--surface-2); }
  .day.selected { box-shadow: inset 0 0 0 2px var(--accent); }
  .day.today .day-num { background: var(--accent); color: var(--bg); border-radius: 50%; }
  .day.blank { opacity: .35; }
  .day-num { width: 24px; height: 24px; display: grid; place-items: center; font-size: var(--text-xs); font-weight: 700; }
  .event { display: block; width: 100%; background: var(--accent-dim); color: var(--accent); border-radius: 3px; padding: 3px 5px; font-size: 10px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
  .more { color: var(--text-muted); font-size: 10px; }
  .day-heading { color: var(--text); font-size: var(--text-lg); margin-bottom: 12px; }
  .item { display: flex; align-items: center; gap: 10px; }
  .small-poster, .small-poster img { width: 36px; height: 54px; object-fit: cover; border-radius: 3px; background: var(--surface-2); }
  @media (max-width: 700px) { .day { min-height: 64px; } .event, .more { display: none; } .day-num { width: 20px; height: 20px; } }
</style>
