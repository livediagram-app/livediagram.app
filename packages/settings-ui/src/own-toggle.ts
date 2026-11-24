// An editor's Account section writes its shared switches through the editor's own rows (each app's
// docs/specs/007-editor/user-preferences.md "This app or All"). Its own module, so an editor's Settings carries it
// without the Account section's code, which loads only with All.
import type { StoredValue } from '@liveworkspace/settings/catalogue';
import type { SettingsCategory } from './model';

/** An editor's way to change a shared key from the Account section: a switch through its own row for that key when it
 *  has one, so the change is counted and written exactly as its own Settings does it, else `fallback` (and any value
 *  that is no switch's, such as Calls Open In's Space, always). */
export function ownToggleSetter(
  own: readonly SettingsCategory[],
  fallback: (key: string, value: StoredValue) => void,
): (key: string, value: StoredValue) => void {
  return (key, value) => {
    if (typeof value === 'boolean') {
      for (const category of own) {
        const row = category.rows.find((r) => r.key === key);
        if (row?.kind === 'toggle') return row.onChange(value);
      }
    }
    fallback(key, value);
  };
}
