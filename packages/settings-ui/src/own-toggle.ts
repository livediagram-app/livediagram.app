// An editor's Account section writes its shared switches through the editor's own rows (each app's
// docs/specs/007-editor/user-preferences.md "This app or All"). Its own module, so an editor's Settings carries it
// without the Account section's code, which loads only with All.
import type { SettingsCategory } from './model';

/** An editor's way to change a shared key from the Account section: through its own row for that key when it has
 *  one, so the change is counted and written exactly as its own Settings does it, else `fallback`. */
export function ownToggleSetter(
  own: readonly SettingsCategory[],
  fallback: (key: string, value: boolean) => void,
): (key: string, value: boolean) => void {
  return (key, value) => {
    for (const category of own) {
      const row = category.rows.find((r) => r.key === key);
      if (row?.kind === 'toggle') return row.onChange(value);
    }
    fallback(key, value);
  };
}
