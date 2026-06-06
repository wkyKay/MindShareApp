export function formatDateTimeMinute(value?: string | null) {
  if (!value) return '';
  return value.replace('T', ' ').replace(/\.\d+Z?$/, '').replace(/Z$/, '').slice(0, 16);
}

export function sameMinute(a?: string | null, b?: string | null) {
  return formatDateTimeMinute(a) === formatDateTimeMinute(b);
}
