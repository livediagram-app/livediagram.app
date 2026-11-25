'use client';

// The selection menu (liveworkspace/docs/specs/004-index/send-to-plan.md "The selection menu", Work Tracker 1462):
// Cut, Copy and Paste, then Send to Plan and Send to Diagram, for the words picked in an article's writing. Drawn by
// the editor's SendToPlanHost from the one open request (selection-menu-store), on the shared PortalMenu: at the
// pointer for a right-click, under the words from the keyboard, docked to the screen's edge on a touch screen.
import { useEffect, useSyncExternalStore } from 'react';
import { lucideClipboardPaste, lucideCopy, lucideScissors } from '@liveworkspace/icons/lucide';
import { lucideGlyph } from '@liveworkspace/ui';
import { keyLabel } from '../../lib/key-label';
import { MenuActionRow, MenuGroupSeparator, PortalMenu } from '../primitives/PortalMenu';
import { SendToPlanMenuIcon } from '../send-to-plan/send-menu-item';
import { SendToDiagramIcon } from '../send-to-diagram/SendToDiagramIcon';
import { canReadClipboard } from './selection-clipboard';
import {
  closeSelectionMenu,
  currentSelectionMenu,
  onSelectionMenuChange,
  SELECTION_MENU_ATTR,
  type SelectionMenuRequest,
} from './selection-menu-store';

const CutIcon = lucideGlyph(lucideScissors, 16);
const CopyIcon = lucideGlyph(lucideCopy, 16);
const PasteIcon = lucideGlyph(lucideClipboardPaste, 16);

// A row's shortcut, as this computer spells it (⌘C, Ctrl+C), quiet at the row's right edge.
function Keys({ k }: { k: string }) {
  return (
    <span className="text-xs tabular-nums text-slate-500 dark:text-slate-400">{keyLabel(k)}</span>
  );
}

/** The open selection menu, if any: mounted once, by SendToPlanHost. */
export function SelectionMenuHost() {
  // The server draws none: nothing opens it before the page is live.
  const request = useSyncExternalStore(
    onSelectionMenuChange,
    currentSelectionMenu,
    currentSelectionMenu,
  );
  if (!request) return null;
  // Docked, it follows the words as the handles move: the same menu, moved, rather than drawn again.
  return <SelectionMenu key={request.docked ? 'docked' : request.id} request={request} />;
}

export function SelectionMenu({ request }: { request: SelectionMenuRequest }) {
  const { actions, docked } = request;
  const close = () => closeSelectionMenu(request.id);
  const then = (fn: () => void) => () => {
    close();
    fn();
  };
  // Escape closes it wherever focus is: while editing, the caret stays in the writing rather than in the menu.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeSelectionMenu(request.id);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [request.id]);
  // A touch screen has no keys to show.
  const keys = (k: string) => (docked ? undefined : <Keys k={k} />);
  return (
    <PortalMenu
      anchor={request.anchor}
      point={request.at}
      placement={request.placement}
      onClose={close}
      label="Selection"
      landmark="Selection actions"
      // Docked, focus stays put: moving it could clear the words a touch picked.
      initialFocus={docked ? 'none' : 'first'}
    >
      <div {...{ [SELECTION_MENU_ATTR]: '' }} className="contents">
        {actions.cut ? (
          <MenuActionRow
            plain
            label="Cut"
            icon={<CutIcon />}
            aside={keys('Mod-x')}
            onClick={then(actions.cut)}
          />
        ) : null}
        <MenuActionRow
          plain
          label="Copy"
          icon={<CopyIcon />}
          aside={keys('Mod-c')}
          onClick={then(actions.copy)}
        />
        {actions.paste ? (
          <MenuActionRow
            plain
            label="Paste"
            icon={<PasteIcon />}
            aside={keys('Mod-v')}
            disabled={!canReadClipboard()}
            onClick={then(actions.paste)}
          />
        ) : null}
        <MenuGroupSeparator />
        <MenuActionRow
          plain
          label="Send to Plan"
          icon={<SendToPlanMenuIcon />}
          onClick={then(actions.sendToPlan)}
        />
        {actions.sendToDiagram ? (
          <MenuActionRow
            plain
            label="Send to Diagram"
            icon={<SendToDiagramIcon />}
            onClick={then(actions.sendToDiagram)}
          />
        ) : null}
      </div>
    </PortalMenu>
  );
}
