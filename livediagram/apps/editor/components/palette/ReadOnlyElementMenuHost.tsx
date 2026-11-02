'use client';

// The element menu for a Participant or a Viewer (docs/specs/008-canvas/element-menu-quick-bar.md "Element menu for
// Participants and Viewers"): a right-click or a long-press on an element opens it with only what the session's
// role may do. The rows are decided in @liveworkspace/workbench (readOnlyElementMenuItems) for every editor alike;
// this host reads the session's `can` and runs each row with the editor's own handlers.

import {
  elementKindLabel,
  elementSupportsText,
  isBoxed,
  type ElementLink,
} from '@livediagram/document';
import { ReadOnlyElementMenu } from '@liveworkspace/workbench/components/palette/ReadOnlyElementMenu';
import {
  copyElementText,
  readOnlyElementMenuFacts,
  readOnlyElementMenuItems,
} from '@liveworkspace/workbench/lib/read-only-element-menu';
import { useEditorContext } from '@/app/document/[id]/EditorContext';

export function ReadOnlyElementMenuHost() {
  const {
    contextMenu,
    closeContextMenu,
    activeTab,
    can,
    embedMode,
    lockedByOther,
    openComments,
    openNote,
    followLink,
    beginEdit,
  } = useEditorContext();
  if (contextMenu?.mode !== 'element') return null;
  const target = activeTab.elements.find((el) => el.id === contextMenu.elementId);
  if (!target) return null;
  const facts = readOnlyElementMenuFacts(target, {
    takePart: can.takePart,
    // Comment badges are off for a reader of an embed, and so are its comments rows.
    commentsShown: !embedMode,
    // Arrows take no comment, link or note.
    attachments: isBoxed(target),
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
          case 'comment':
            return openComments(target.id);
          case 'edit-text':
            return beginEdit(target.id);
          case 'open-link':
            // Offered only on an element with a link (readOnlyElementMenuFacts).
            return followLink((target as { link?: ElementLink }).link as ElementLink);
          case 'note':
            return openNote(target.id);
          case 'copy-text':
            return void copyElementText(facts.text);
        }
      }}
    />
  );
}
