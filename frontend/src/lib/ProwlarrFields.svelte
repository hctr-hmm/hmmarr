<script>
  let { fields = [], dynamicOptions = {}, onChange } = $props();

  function setValue(field, value) { onChange(field.name, value); }
  function toggleOption(field, option) {
    const values = Array.isArray(field.value) ? field.value : [];
    setValue(field, values.some((value) => String(value) === String(option.value))
      ? values.filter((value) => String(value) !== String(option.value))
      : [...values, option.value]);
  }
</script>

<div class="fields">
  {#each fields.filter((field) => field.label) as field (field.name)}
    {@const options = dynamicOptions[field.name] || field.selectOptions || []}
    {#if field.type === 'info'}
      <p class="rad-muted info">{field.helpText || field.value || field.label}</p>
    {:else if field.type === 'cardigannCaptcha'}
      <p class="rad-error">{field.label} requires a captcha. Complete this field in Prowlarr.</p>
    {:else if field.type === 'checkbox'}
      <label class="rad-check"><input type="checkbox" checked={Boolean(field.value)} onchange={(event) => setValue(field, event.currentTarget.checked)} /> {field.label}</label>
    {:else if field.type === 'select' && Array.isArray(field.value) && options.length}
      <div class="rad-field"><span>{field.label}</span><div class="choices">{#each options as option}<label class="rad-check"><input type="checkbox" checked={field.value.some((value) => String(value) === String(option.value))} onchange={() => toggleOption(field, option)} /> {option.name}</label>{/each}</div>{#if field.helpText}<small>{field.helpText}</small>{/if}</div>
    {:else if field.type === 'select' && options.length}
      <label class="rad-field">{field.label}<select class="rad-select" value={String(field.value ?? options[0].value)} onchange={(event) => setValue(field, options.find((option) => String(option.value) === event.currentTarget.value)?.value)}>{#each options as option}<option value={String(option.value)}>{option.name}</option>{/each}</select>{#if field.helpText}<small>{field.helpText}</small>{/if}</label>
    {:else}
      <label class="rad-field">{field.label}<input class="rad-input" type={field.type === 'password' || /key|pass|secret|cookie|token/i.test(field.name) ? 'password' : field.type === 'number' ? 'number' : 'text'} value={field.value ?? ''} oninput={(event) => setValue(field, field.type === 'number' ? (event.currentTarget.value === '' ? null : Number(event.currentTarget.value)) : event.currentTarget.value)} />{#if field.helpText}<small>{field.helpText}</small>{/if}</label>
    {/if}
  {/each}
</div>

<style>
  .fields { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 14px; }
  .fields > .rad-check, .fields > .info, .fields > .rad-error { grid-column: 1 / -1; }
  .choices { display: grid; gap: 5px; max-height: 150px; overflow: auto; padding: 8px; border: 1px solid var(--border); border-radius: var(--radius-md); }
  .rad-field small { color: var(--text-faint); font-weight: 400; line-height: 1.4; }
  .info { line-height: 1.4; }
</style>
