'use client';

// The element menu for a Participant or a Viewer (docs/specs/008-canvas/element-menu-quick-bar.md "Element menu for
// Participants and Viewers"): a right-click or a long-press on an element opens it with only what the session's
// role may do. The rows are decided in @liveworkspace/workbench (readOnlyElementMenuItems) for every editor alike;
// this host reads the session's `can` and runs each row with the editor's own handlers. livehuddle offers no
// comments, links or notes (docs/specs/002-project-scope/not-in-livehuddle.md "Comments, actions, links and notes"),
// so no element takes attachments here: the rows are Edit Text and Copy Text.

import { elementKindLabel, elementSupportsText } from '@livehuddle/document';
import { ReadOnlyElementMenu } from '@liveworkspace/workbench/components/palette/ReadOnlyElementMenu';
import {
  copyElementText,
  readOnlyElementMenuFacts,
  readOnlyElementMenuItems,
} from '@liveworkspace/workbench/lib/read-only-element-menu';
import { useEditorContext } from '@/app/document/[id]/EditorContext';

export function ReadOnlyElementMenuHost() {
  const { contextMenu, closeContextMenu, activeTab, can, lockedByOther, beginEdit } =
    useEditorContext();
  if (contextMenu?.mode !== 'element') return null;
  const target = activeTab.elements.find((el) => el.id === contextMenu.elementId);
  if (!target) return null;
  const facts = readOnlyElementMenuFacts(target, {
    takePart: can.takePart,
    commentsShown: false,
    attachments: false,
    writeText: can.writeText(target) && elementSupportsText(target) && !lockedByOther(target.id),
  });
  const items = readOnlyElementMenuItems(facts);
  // Nothing this role may do here: the right-click only selected it.
  if (items.length === 0) return null;
  return (
    <ReadOnlyElementMenu
      key={target.id}
      position={{ x: contextMenu.x, y: contextMenu.y }}
      title={elementKindLabel(target)}
      items={items}
      onClose={closeContextMenu}
      onRun={(key) => {
        switch (key) {
          case 'edit-text':
            return beginEdit(target.id);
          case 'copy-text':
            return void copyElementText(facts.text);
        }
      }}
    />
  );
}
