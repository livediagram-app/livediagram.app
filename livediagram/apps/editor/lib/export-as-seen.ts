// A tab as the author sees it, for export (docs/specs/007-editor/editor-modes.md "One look"): the
// tab's own Diagram backdrop resolved for the export's appearance, whoever exports and in
// whichever editor mode, and every stock colour stored by name in its version for that canvas, so
// every export format (the image renderers and the text formats alike) draws what the canvas does.
// The drawing itself is @livediagram/document's tabAsSeen, shared with the export door's previews; this adds the
// viewer's appearance.
import { tabAsSeen as tabAsSeenIn, type Appearance, type Tab } from '@livediagram/document';
import { getResolvedAppearance } from '@livediagram/ui';

export function tabAsSeen(tab: Tab, appearance: Appearance = getResolvedAppearance()): Tab {
  return tabAsSeenIn(tab, appearance);
}
