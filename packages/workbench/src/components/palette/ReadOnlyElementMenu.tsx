'use client';

// The element menu a Participant or a Viewer opens with a right-click, or a long-press on a touch screen
// (docs/specs/008-canvas/element-menu-quick-bar.md "Element menu for Participants and Viewers"): a short list of
// plain verb rows under a header naming the element, holding only what the role may do
// (readOnlyElementMenuItems). The same ContextMenu an Editor's opens in, so it sits beside the element on a desktop
// and is a bottom sheet on a phone. Each row runs and closes the menu.

import type { ReactNode } from 'react';
import { ContextMenu } from './ContextMenu';
import { CommentMenuIcon, CopyIcon, LinkMenuIcon, NoteMenuIcon } from './context-menu-icons';
import { TextIcon } from '../canvas/selection-popover-icons';
import { MenuActionRow, MenuHeader } from '../primitives/PortalMenu';
import type {
  ReadOnlyElementMenuItem,
  ReadOnlyElementMenuKey,
} from '../../lib/read-only-element-menu';

const ICONS: Record<ReadOnlyElementMenuKey, ReactNode> = {
  comment: <CommentMenuIcon />,
  'edit-text': <TextIcon />,
  'open-link': <LinkMenuIcon />,
  note: <NoteMenuIcon />,
  'copy-text': <CopyIcon />,
};

export function ReadOnlyElementMenu({
  position,
  title,
  items,
  onRun,
  onClose,
}: {
  position: { x: number; y: number };
  // The element's kind, as its menu header ("Square", "Sticky Note").
  title: string;
  items: readonly ReadOnlyElementMenuItem[];
  onRun: (key: ReadOnlyElementMenuKey) => void;
  onClose: () => void;
}) {
  return (
    <ContextMenu position={position} label="Element menu" onClose={onClose}>
      <MenuHeader title={title} />
      {items.map((item) => (
        <MenuActionRow
          key={item.key}
          plain
          label={item.label}
          icon={ICONS[item.key]}
          onClick={() => {
            // Close first: a row that opens a popover (comments, a note) anchors to the element, not the menu.
            onClose();
            onRun(item.key);
          }}
        />
      ))}
    </ContextMenu>
  );
}
