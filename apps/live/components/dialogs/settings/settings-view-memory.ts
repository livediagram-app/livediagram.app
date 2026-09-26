// Where the Settings dialog was left: the category open and the scroll anchor
// in its pane (docs/specs/007-editor/user-preferences.md, "It reopens where
// you left it"). Device-local and never synced: where you were in a dialog
// belongs to this screen, not to the account.

export const SETTINGS_VIEW_STORAGE_KEY = 'livediagram:settings-view:v1';

// The topmost visible row, and how far its top sat from the pane's top edge
// (negative when partly scrolled past). Survives a reflow, unlike scrollTop.
export type SettingsScrollAnchor = { rowKey: string; offset: number };

// `categoryId: null` is a phone closed on its root list.
export type SettingsView = { categoryId: string | null; anchor: SettingsScrollAnchor | null };

export function parseSettingsView(raw: string | null): SettingsView | null {
  if (raw === null) return null;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch (error) {
    console.warn('[settings-view] ignoring unparsable stored view', error);
    return null;
  }
  if (!isSettingsView(value)) {
    console.warn('[settings-view] ignoring malformed stored view', value);
    return null;
  }
  return { categoryId: value.categoryId, anchor: value.anchor };
}

export function readSettingsView(): SettingsView | null {
  try {
    return parseSettingsView(localStorage.getItem(SETTINGS_VIEW_STORAGE_KEY));
  } catch (error) {
    console.warn('[settings-view] could not read the stored view', error);
    return null;
  }
}

export function writeSettingsView(view: SettingsView): void {
  try {
    localStorage.setItem(SETTINGS_VIEW_STORAGE_KEY, JSON.stringify(view));
  } catch (error) {
    console.warn('[settings-view] could not store the view', error);
  }
}

function isSettingsView(value: unknown): value is SettingsView {
  if (typeof value !== 'object' || value === null) return false;
  const { categoryId, anchor } = value as Record<string, unknown>;
  if (categoryId !== null && typeof categoryId !== 'string') return false;
  if (anchor === null) return true;
  if (typeof anchor !== 'object' || anchor === undefined) return false;
  const { rowKey, offset } = anchor as Record<string, unknown>;
  return typeof rowKey === 'string' && typeof offset === 'number' && Number.isFinite(offset);
}
