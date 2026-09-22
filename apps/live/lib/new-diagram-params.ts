import { isTemplateKind, type TemplateKind } from '@livediagram/templates';

// The /new query params that skip the wizard (spec/14): `?blank=1` commits
// a blank diagram, `?template=<kind>` (built by the templates package's
// templateCreateHref) commits that template, both with the
// Default theme and the template's default name, and land on the editor.
// One reader for both so the page, its bfcache-restore cleanup and the
// pre-hydration guard agree on what counts.

// The params the bypass reads; the bfcache restore strips exactly these so
// Back from the editor lands on the plain wizard with placement intact.
export const WIZARD_BYPASS_PARAMS = ['blank', 'template'] as const;

// Which template the query asks to commit without the wizard, or null for
// the wizard itself. `blank` wins when both are present (it is the older,
// documented shortcut); an unknown template kind is ignored rather than
// guessed, so a stale marketing link falls back to the wizard, not a 404.
export function wizardBypassKind(search: string): TemplateKind | null {
  const params = new URLSearchParams(search);
  if (params.has('blank')) return 'blank';
  const template = params.get('template');
  return isTemplateKind(template) ? template : null;
}
