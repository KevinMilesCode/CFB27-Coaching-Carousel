const ICON_BASE = '../../node_modules/lucide-static/icons';

export function icon(name) {
  return `${ICON_BASE}/${name}.svg`;
}

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function setOptions(select, options, selectedValue, allLabel) {
  select.innerHTML = [
    `<option value="">${escapeHtml(allLabel)}</option>`,
    ...options.map(
      (option) =>
        `<option value="${escapeHtml(option.value)}" ${option.value === selectedValue ? 'selected' : ''}>${escapeHtml(
          option.label
        )}</option>`
    )
  ].join('');
}

export function compareText(a, b) {
  return String(a || '').localeCompare(String(b || ''), undefined, {
    numeric: true,
    sensitivity: 'base'
  });
}
