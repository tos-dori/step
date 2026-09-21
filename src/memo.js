export const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
function circled(label) {
  if (/[a-z]/.test(label)) return String.fromCharCode(0x24d0 + label.charCodeAt(0) - 97);
  if (/[A-Z]/.test(label)) return String.fromCharCode(0x24b6 + label.charCodeAt(0) - 65);
  return label === '0' ? '⓪' : String.fromCharCode(0x2460 + Number(label) - 1);
}
export function renderMemo(value, interactive = true) {
  let html = '', cursor = 0;
  for (const match of String(value).matchAll(/[○●]([A-Za-z0-9]?)/g)) {
    html += escape(value.slice(cursor, match.index));
    const done = match[0][0] === '●', label = match[1];
    const symbol = label ? circled(label) : done ? '✓' : '○';
    html += interactive ? `<button type="button" class="memo-token ${done ? 'is-done' : ''}" data-action="memo-check" data-index="${match.index}" aria-label="메모 체크${label ? ' ' + label : ''}" aria-pressed="${done}">${symbol}</button>` : symbol;
    cursor = match.index + match[0].length;
  }
  return html + escape(value.slice(cursor));
}
export function toggleToken(value, index) {
  if (!['○', '●'].includes(value[index])) return value;
  return value.slice(0, index) + (value[index] === '○' ? '●' : '○') + value.slice(index + 1);
}
