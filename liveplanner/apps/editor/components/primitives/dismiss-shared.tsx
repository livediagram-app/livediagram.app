import { CloseIcon } from '@liveplanner/ui';

// Dismissing a project someone shared with you: the verb, its hover card,
// and its glyph. The editor panel's Shared rows and the Explorer page's
// Shared list both offer it, and had drifted to different words
// ("Remove" vs "Dismiss") and two copies of the X. The project menu's
// own Dismiss row uses the same word.
export const DISMISS_SHARED = {
  title: 'Dismiss',
  description: 'Drop this from your Shared list.',
  ariaLabel: (name: string) => `Dismiss ${name} from Shared`,
};

export function DismissSharedIcon() {
  return <CloseIcon size={11} />;
}
