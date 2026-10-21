// `[preview] <event> key=value ...`, one line per decision or deletion
// (docs/specs/016-platform/blueprints/pr-previews.md "Observability").
export function logLine(event: string, fields: Record<string, string | number | boolean>): string {
  const pairs = Object.entries(fields).map(([k, v]) => `${k}=${v}`);
  return ['[preview]', event, ...pairs].join(' ');
}
