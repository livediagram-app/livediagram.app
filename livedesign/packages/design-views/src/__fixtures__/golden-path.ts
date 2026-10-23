// Where a golden file lives (docs/specs/024-agents/blueprints/design-views.md "Testing", VW52).
export function golden(name: string): string {
  return new URL(`./golden/${name}`, import.meta.url).pathname;
}
