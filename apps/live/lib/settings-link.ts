// The Settings deep link, `?settings=<category>&section=<section>`
// (docs/specs/007-editor/user-preferences.md): it opens Settings on load and stays
// in the URL while Settings is open, so a page left for another site and
// reached again with Back reopens it. These read it and take it away on close.

export type SettingsLink = { category: string; section: string | null };

export function readSettingsLink(search: string): SettingsLink | null {
  const params = new URLSearchParams(search);
  const category = params.get('settings');
  return category ? { category, section: params.get('section') } : null;
}

// Settings closed: the URL no longer names it.
export function dropSettingsLink(): void {
  const url = new URL(window.location.href);
  if (!url.searchParams.has('settings') && !url.searchParams.has('section')) return;
  url.searchParams.delete('settings');
  url.searchParams.delete('section');
  window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
}
