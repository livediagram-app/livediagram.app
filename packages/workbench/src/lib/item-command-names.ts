// The Search & Commands names of the verbs every editor offers on its whole item
// (liveworkspace/docs/specs/022-interface-design/action-parity.md "The rule"): Share, Rename and Delete, each with
// the app's own word for its item ("Share Canvas", "Delete Plan"). Each editor's lib/editor-commands.ts names its
// commands from here, so the words cannot drift between apps.
import { APP_ITEMS, type AppName } from '@liveworkspace/sites';

export type ItemCommandNames = { share: string; rename: string; delete: string };

export function itemCommandNames(app: AppName): ItemCommandNames {
  const noun = APP_ITEMS[app].noun;
  return { share: `Share ${noun}`, rename: `Rename ${noun}`, delete: `Delete ${noun}` };
}
