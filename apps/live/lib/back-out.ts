// Where Escape takes someone backing out of the New Document wizard
// (docs/specs/007-editor/new-document-route.md "Escape backs out"): back to the page of ours that
// opened it, as the browser's Back would, or home when there is none to go back to.
export type BackOutTarget = 'back' | 'home';

export function backOutTarget(input: {
  referrer: string;
  origin: string;
  historyLength: number;
}): BackOutTarget {
  if (input.historyLength < 2 || !input.referrer) return 'home';
  let from: URL;
  try {
    from = new URL(input.referrer);
  } catch {
    return 'home';
  }
  if (from.origin !== input.origin) return 'home';
  // Back to the wizard itself would only reopen it.
  if (from.pathname.replace(/\/$/, '') === '/new') return 'home';
  return 'back';
}
