// Select All's reach (the canvas's Cmd/Ctrl+A): every element a press could reach, less those on
// hidden or locked layers (docs/specs/006-document/layers.md) and those another participant holds
// (docs/specs/007-editor/editor-app.md "Concurrent-selection lock"), as a marquee leaves them out.
import type { Tab } from '@livediagram/document';

export function selectAllIds(
  tab: Pick<Tab, 'elements'>,
  inert: ReadonlySet<string>,
  lockedByOther: (id: string) => boolean = () => false,
): Set<string> {
  return new Set(
    tab.elements.map((el) => el.id).filter((id) => !inert.has(id) && !lockedByOther(id)),
  );
}
