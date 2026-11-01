'use client';

// A Contents row's page actions (each product's docs/specs/007-editor/pages-mode.md "Contents",
// "A page's actions"): what a page's ⋯ menu holds, the one menu a whole list shares, and the
// row's tools down its left (grip, Delete, ⋯). livedocuments and livedesign lay their rows out
// themselves and hand these the page's verbs.
import { Fragment, useCallback, useRef, useState, type PointerEvent, type ReactNode } from 'react';
import {
  lucideArrowDown,
  lucideArrowUp,
  lucideCopy,
  lucideLock,
  lucideLockOpen,
  lucideSettings,
  lucideTrash2,
} from '@liveworkspace/icons/lucide';
import { lucideGlyph, Tooltip } from '@liveworkspace/ui';
import { useLongPress } from '../../hooks/ui/useLongPress';
import { EllipsisTriggerButton } from '../primitives/EllipsisTriggerButton';
import {
  MenuActionRow,
  MenuGroupSeparator,
  MenuHeader,
  PortalMenu,
} from '../primitives/PortalMenu';

const SettingsIcon = lucideGlyph(lucideSettings, 14);
const CopyIcon = lucideGlyph(lucideCopy, 14);
const UpIcon = lucideGlyph(lucideArrowUp, 14);
const DownIcon = lucideGlyph(lucideArrowDown, 14);
const LockIcon = lucideGlyph(lucideLock, 14);
const UnlockIcon = lucideGlyph(lucideLockOpen, 14);
const DeleteIcon = lucideGlyph(lucideTrash2, 14);

export type PageRowAction = { key: string; label: string; icon: ReactNode; run: () => void };

// A page's verbs as its menu shows them: groups parted by a separator, then Delete last.
export type PageRowModel = { groups: PageRowAction[][]; remove?: () => void };

/** A page's menu from its verbs, each left out where the page cannot take it. `extra` is the
 *  product's own group (livedocuments' place in the slide deck), after Page Settings. */
export function pageRowModel(verbs: {
  settings?: () => void;
  extra?: PageRowAction[];
  duplicate?: () => void;
  moveUp?: () => void;
  moveDown?: () => void;
  locked: boolean;
  toggleLock: () => void;
  remove?: () => void;
}): PageRowModel {
  const page: PageRowAction[] = [];
  if (verbs.duplicate)
    page.push({ key: 'duplicate', label: 'Duplicate', icon: <CopyIcon />, run: verbs.duplicate });
  if (verbs.moveUp)
    page.push({ key: 'move-up', label: 'Move Up', icon: <UpIcon />, run: verbs.moveUp });
  if (verbs.moveDown)
    page.push({ key: 'move-down', label: 'Move Down', icon: <DownIcon />, run: verbs.moveDown });
  page.push({
    key: 'lock',
    label: verbs.locked ? 'Unlock' : 'Lock',
    icon: verbs.locked ? <UnlockIcon /> : <LockIcon />,
    run: verbs.toggleLock,
  });
  const groups = [
    verbs.settings
      ? [{ key: 'settings', label: 'Page Settings', icon: <SettingsIcon />, run: verbs.settings }]
      : [],
    verbs.extra ?? [],
    page,
  ].filter((g) => g.length > 0);
  return { groups, ...(verbs.remove ? { remove: verbs.remove } : {}) };
}

// After a long press opens the menu, the click the lift makes is swallowed, wherever it lands (the
// row, or the menu now under the finger), for this long after the finger leaves the glass.
export const LIFT_CLICK_MS = 400;

// Swallows the one click a lifting finger makes once its long press has claimed the press.
function swallowLiftClick() {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const done = () => {
    clearTimeout(timer);
    window.removeEventListener('click', swallow, true);
    window.removeEventListener('pointerup', lifted, true);
  };
  const swallow = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    done();
  };
  const lifted = () => {
    timer = setTimeout(done, LIFT_CLICK_MS);
  };
  window.addEventListener('click', swallow, true);
  window.addEventListener('pointerup', lifted, true);
}

// A row's grip carries this: a finger held on it is starting a drag, never a long press for the menu.
export const PAGE_ROW_GRIP_ATTR = 'data-contents-grip';

/** The one ⋯ menu a Contents list shares: which page's is open and where it hangs, each row's ⋯
 *  as its anchor, and the row's own ways in (a right-click, a finger's long press). */
export function usePageRowMenu() {
  const [open, setOpen] = useState<{ id: string; anchor: HTMLElement } | null>(null);
  const triggers = useRef(new Map<string, HTMLElement>());
  // The row a finger is pressing.
  const pressed = useRef('');
  const openAt = useCallback((id: string) => {
    const anchor = triggers.current.get(id);
    if (anchor) setOpen({ id, anchor });
  }, []);
  const longPress = useLongPress(() => {
    swallowLiftClick();
    openAt(pressed.current);
  });
  const close = useCallback(() => setOpen(null), []);
  return {
    openId: open?.id,
    anchor: open?.anchor ?? null,
    close,
    registerTrigger: (id: string, el: HTMLElement | null) => {
      if (el) triggers.current.set(id, el);
      else triggers.current.delete(id);
    },
    toggle: (id: string) => {
      if (open?.id === id) setOpen(null);
      else openAt(id);
    },
    rowProps: (id: string) => ({
      onContextMenu: (e: { preventDefault: () => void; stopPropagation: () => void }) => {
        e.preventDefault();
        e.stopPropagation();
        openAt(id);
      },
      onPointerDown: (e: PointerEvent) => {
        if ((e.target as Element | null)?.closest?.(`[${PAGE_ROW_GRIP_ATTR}]`)) return;
        pressed.current = id;
        longPress.onPointerDown(e);
      },
    }),
  };
}

export type PageRowMenuState = ReturnType<typeof usePageRowMenu>;

// The menu itself: a header naming the page, its groups, Delete last under its own separator (in
// the menu's own tones: docs/specs/004-interface-design/destructive-actions.md).
export function PageRowMenu({
  title,
  model,
  anchor,
  onClose,
}: {
  title: string;
  model: PageRowModel;
  anchor: HTMLElement | null;
  onClose: () => void;
}) {
  const then = (fn: () => void) => () => {
    onClose();
    fn();
  };
  return (
    // Portalled, but its events still bubble through React to the list: none of its presses, keys
    // or clicks are a row's (no glide, no drag, no row-to-row arrows).
    <span
      onPointerDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <PortalMenu anchor={anchor} placement="below-start" onClose={onClose}>
        <MenuHeader title={title} />
        {model.groups.map((group, i) => (
          <Fragment key={group[0]!.key}>
            {i > 0 ? <MenuGroupSeparator /> : null}
            {group.map((action) => (
              <MenuActionRow
                key={action.key}
                plain
                icon={action.icon}
                label={action.label}
                onClick={then(action.run)}
              />
            ))}
          </Fragment>
        ))}
        {model.remove ? (
          <>
            <MenuGroupSeparator />
            <MenuActionRow
              plain
              icon={<DeleteIcon />}
              label="Delete"
              onClick={then(model.remove)}
            />
          </>
        ) : null}
      </PortalMenu>
    </span>
  );
}

// A row's ⋯ (Tooltip "More Actions"): the page's menu, anchored here. Its presses are its own (no
// glide, no drag).
export function PageRowMenuButton({
  id,
  name,
  menu,
  reveal = false,
}: {
  id: string;
  name: string;
  menu: PageRowMenuState;
  // Hidden under a fine pointer until the row is hovered or focused (EllipsisTriggerButton).
  reveal?: boolean;
}) {
  return (
    <Tooltip label="More Actions">
      <EllipsisTriggerButton
        ref={(el) => menu.registerTrigger(id, el)}
        size="md"
        reveal={reveal}
        expanded={menu.openId === id}
        label={`More Actions for ${name}`}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          menu.toggle(id);
        }}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (menu.openId !== id && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
            e.preventDefault();
            menu.toggle(id);
          }
        }}
      />
    </Tooltip>
  );
}

// The sidebar row's tools, stacked down its left under the page's number: the grip, Delete and
// ⋯, each a glyph with its Tooltip, spaced 44 px apart under a coarse pointer so each keeps its
// tap area. Shown while the row is hovered or focused, when `shown` (the page here, or a finger),
// and while its menu is open.
export function PageRowStack({
  id,
  name,
  menu,
  remove,
  grip,
  shown,
}: {
  id: string;
  name: string;
  menu: PageRowMenuState;
  remove?: () => void;
  grip: ReactNode;
  shown: boolean;
}) {
  const open = menu.openId === id;
  return (
    <span
      data-page-row-stack=""
      className={`relative z-10 flex flex-col items-center gap-0.5 transition-opacity duration-micro pointer-coarse:gap-5 ${
        shown || open ? '' : 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100'
      }`}
    >
      {grip}
      {remove ? (
        <Tooltip label="Delete">
          <button
            type="button"
            aria-label={`Delete ${name}`}
            data-page-action="delete"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              remove();
            }}
            onKeyDown={(e) => e.stopPropagation()}
            className="relative flex h-6 w-6 touch-target items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-900/5 hover:text-slate-700 focus-visible:outline-2 focus-visible:outline-brand-600 dark:hover:bg-white/10 dark:hover:text-slate-100"
          >
            <DeleteIcon />
          </button>
        </Tooltip>
      ) : null}
      <PageRowMenuButton id={id} name={name} menu={menu} />
    </span>
  );
}
