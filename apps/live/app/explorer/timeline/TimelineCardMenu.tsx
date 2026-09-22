'use client';

// The ⋯ menu on a Timeline card (spec/138 §2.8, §2.9).
//
// Three shapes behind one trigger. A card about a diagram the Explorer
// has loaded gets the same `DiagramActionsMenu` a Recent card uses, and
// a card about a folder the Explorer has loaded gets the same
// `FolderActionsMenu` a folder card uses — so whatever the Explorer
// offers the thing, Timeline offers it too — each with "Remove from
// Timeline" added. Every other card gets a menu built from `items`:
// whatever the Explorer can do with that kind of thing (open the
// tokens page and revoke this token; open the team, edit it, leave it;
// accept or decline this invite; edit or delete this theme), with
// "Remove from Timeline" among them and the destructive verbs last
// under their own separator, the way the diagram menu keeps Delete.
// An entry with no verbs of its own still gets the one it always has.
//
// Controlled, not self-owned: the card's right-click has to open the
// same menu, and that handler lives on the card root rather than on
// this trigger, so the slot hooks hold "which card's menu is open" and
// both paths flip it.

import { useRef, type ReactNode } from 'react';
import { EllipsisTriggerButton } from '@/components/primitives/EllipsisTriggerButton';
import {
  MenuActionRow,
  MenuGroupSeparator,
  MenuHeader,
  PortalMenu,
} from '@/components/primitives/PortalMenu';
import { DiagramActionsMenu } from '../diagram-row-shared';
import { FolderActionsMenu } from '../folder-actions-menu';
import { CloseIcon } from '../icons';
import type { PaneDiagram } from '../views';

export type TimelineDiagramMenuHandlers = {
  ownerId: string | null;
  onStartRename: () => void;
  onDuplicate: () => void;
  onMove: (anchor: HTMLElement | null) => void;
  onDelete: () => void;
  onDismiss?: () => void;
  favourite?: boolean;
  onToggleFavourite?: () => void;
  recentExcluded?: boolean;
  onToggleRecentExclusion?: () => void;
  onShowHistory?: () => void;
  onShare?: () => void;
};

// The folder verbs, built against the menu's own trigger: Change
// Folder anchors its picker to whatever opened the menu.
export type TimelineFolderMenuHandlers = (anchor: HTMLElement | null) => {
  onRename: () => void;
  onNewSubfolder: () => void;
  onMove: () => void;
  onDelete: () => void;
};

// One row of an entity menu. `danger` rows render last, red, under
// their own separator.
export type TimelineMenuItem = {
  label: string;
  icon: ReactNode;
  onClick: () => void;
  danger?: boolean;
};

type Shared = {
  /** What the menu is about: the card's subject, for the header. */
  subject: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Take this card off the reader's feed (spec/138 §2.9). */
  onRemove: () => void;
};

type Shape =
  | {
      diagram: PaneDiagram;
      handlers: TimelineDiagramMenuHandlers;
      folder?: undefined;
      items?: undefined;
    }
  | {
      folder: { id: string; name: string };
      folderHandlers: TimelineFolderMenuHandlers;
      diagram?: undefined;
      items?: undefined;
    }
  | { items?: TimelineMenuItem[]; diagram?: undefined; folder?: undefined };

export function TimelineCardMenu(props: Shared & Shape) {
  const { subject, open, onOpenChange, onRemove } = props;
  const ref = useRef<HTMLButtonElement>(null);
  const close = () => onOpenChange(false);
  const then = (fn: () => void) => () => {
    fn();
    close();
  };
  return (
    <>
      <EllipsisTriggerButton
        ref={ref}
        tuck
        label={`Menu for ${subject}`}
        expanded={open}
        onClick={() => onOpenChange(!open)}
      />
      {!open ? null : props.diagram ? (
        <DiagramActionsMenu
          diagram={props.diagram}
          anchor={ref.current}
          onClose={close}
          onRemoveFromTimeline={onRemove}
          {...props.handlers}
        />
      ) : props.folder ? (
        <FolderActionsMenu
          folder={props.folder}
          anchor={ref.current}
          onClose={close}
          onRemoveFromTimeline={onRemove}
          {...props.folderHandlers(ref.current)}
        />
      ) : (
        <EntityMenu
          subject={subject}
          anchor={ref.current}
          items={props.items ?? []}
          onRemove={then(onRemove)}
          onClose={close}
          then={then}
        />
      )}
    </>
  );
}

function EntityMenu({
  subject,
  anchor,
  items,
  onRemove,
  onClose,
  then,
}: {
  subject: string;
  anchor: HTMLElement | null;
  items: TimelineMenuItem[];
  onRemove: () => void;
  onClose: () => void;
  then: (fn: () => void) => () => void;
}) {
  const plain = items.filter((i) => !i.danger);
  const danger = items.filter((i) => i.danger);
  return (
    <PortalMenu anchor={anchor} placement="below" onClose={onClose}>
      <MenuHeader title={subject} />
      {plain.map((item) => (
        <MenuActionRow
          key={item.label}
          plain
          icon={item.icon}
          label={item.label}
          onClick={then(item.onClick)}
        />
      ))}
      {plain.length > 0 ? <MenuGroupSeparator /> : null}
      <MenuActionRow plain icon={<CloseIcon />} label="Remove from Timeline" onClick={onRemove} />
      {danger.length > 0 ? <MenuGroupSeparator /> : null}
      {danger.map((item) => (
        <MenuActionRow
          key={item.label}
          plain
          danger
          icon={item.icon}
          label={item.label}
          onClick={then(item.onClick)}
        />
      ))}
    </PortalMenu>
  );
}
