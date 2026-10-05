'use client';

// A marker's colour picker (docs/specs/023-draw-mode/draw-mode.md "The colour picker"), top to
// bottom: the eight stock colours in one row (Ink first, the default), each in its version for the
// board it is shown on; Your colours, the custom ones, newest first; and + at the end of that row,
// which opens the custom picker in place. Arrow keys move through a row; Enter picks. A custom
// colour's menu (right-click, long-press, Shift+F10 or the context-menu key) removes it from Your
// colours.

import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { TrashIcon, Tooltip } from '@livediagram/ui';
import {
  PEN_COLOUR_NAMES,
  penColourCss,
  type Appearance,
  type PenColour,
} from '@livediagram/document';
import { colourLabel } from '@/lib/whiteboard-prefs';
import { useSwatchRowKeys } from '@/hooks/canvas/useSwatchRowKeys';
import { useLongPress } from '@/hooks/ui/useLongPress';
import { MenuActionRow, PortalMenu } from '@/components/primitives/PortalMenu';
import { CustomColourEditor } from './CustomColourEditor';
import { FlyoutHeading } from './WhiteboardFlyout';

// The stock colours: the ink (null), then the seven named ones.
const STOCK: readonly (PenColour | null)[] = [null, ...PEN_COLOUR_NAMES];

export function ColourPicker({
  value,
  board,
  ink,
  yours,
  onPick,
  onRemove,
}: {
  // The colour in force: null is the ink.
  value: PenColour | null;
  board: Appearance;
  // The board's ink for this appearance.
  ink: string;
  // Your colours: custom hexes, newest first.
  yours: readonly string[];
  onPick: (colour: PenColour | null) => void;
  // Removes a custom colour from Your colours.
  onRemove: (hex: string) => void;
}) {
  const [custom, setCustom] = useState(false);
  const stock = useSwatchRowKeys(STOCK.length);
  const row = useSwatchRowKeys(yours.length + 1);
  // Each row's Tab stop: the colour in force, else its first.
  const stockStop = Math.max(0, STOCK.indexOf(value));
  const yoursStop = Math.max(0, yours.indexOf(value ?? ''));
  const customStart = value !== null && !STOCK.includes(value) ? value : undefined;
  // The custom colour whose menu is open, and its swatch.
  const [menu, setMenu] = useState<{ hex: string; anchor: HTMLElement } | null>(null);
  // After a removal, once Your colours no longer hold it, the focus goes to the swatch that took
  // its place (or +).
  const refocus = useRef<{ hex: string; at: number } | null>(null);
  useEffect(() => {
    const pending = refocus.current;
    if (pending === null || yours.includes(pending.hex)) return;
    refocus.current = null;
    row.focus(pending.at);
  }, [yours, row]);
  return (
    // As wide as the widest row (eight of Your colours and +), so the flyout never resizes.
    <div className="flex w-[248px] flex-col gap-3" data-colour-picker="">
      <div role="group" aria-label="Colours">
        <FlyoutHeading className="mb-1.5">Colours</FlyoutHeading>
        <div className="flex gap-1" data-testid="stock-colours">
          {STOCK.map((colour, i) => (
            <Swatch
              key={colour ?? 'ink'}
              buttonRef={stock.ref(i)}
              label={colourLabel(colour)}
              colour={penColourCss(colour, board, ink)}
              selected={value === colour}
              tabbable={i === stockStop}
              onPick={() => onPick(colour)}
              onKeyDown={(e) => stock.onKeyDown(e, i)}
            />
          ))}
        </div>
      </div>
      <div role="group" aria-label="Your colours">
        <FlyoutHeading className="mb-1.5">Your colours</FlyoutHeading>
        <div className="flex gap-1" data-testid="your-colours">
          {yours.map((hex, i) => (
            <YourColour key={hex} onMenu={(anchor) => setMenu({ hex, anchor })}>
              {(menuProps) => (
                <Swatch
                  buttonRef={row.ref(i)}
                  label={colourLabel(hex)}
                  colour={hex}
                  selected={value === hex}
                  tabbable={i === yoursStop}
                  onPick={() => onPick(hex)}
                  onKeyDown={(e) => {
                    menuProps.onKeyDown(e);
                    if (!e.defaultPrevented) row.onKeyDown(e, i);
                  }}
                  onContextMenu={menuProps.onContextMenu}
                  onPointerDown={menuProps.onPointerDown}
                />
              )}
            </YourColour>
          ))}
          <Tooltip label="Add a custom colour">
            <button
              ref={row.ref(yours.length)}
              type="button"
              aria-label="Add a custom colour"
              aria-expanded={custom}
              tabIndex={yours.length === 0 ? 0 : -1}
              onClick={() => setCustom((open) => !open)}
              onKeyDown={(e) => row.onKeyDown(e, yours.length)}
              className="flex h-6 w-6 items-center justify-center rounded-md border border-dashed border-slate-400 text-base leading-none text-slate-600 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:border-slate-500 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <span aria-hidden>+</span>
            </button>
          </Tooltip>
        </div>
        {menu ? (
          <PortalMenu
            anchor={menu.anchor}
            placement="below"
            label={`${colourLabel(menu.hex)} menu`}
            onClose={() => setMenu(null)}
          >
            <RemoveMenu
              onRemove={() => {
                refocus.current = { hex: menu.hex, at: yours.indexOf(menu.hex) };
                setMenu(null);
                onRemove(menu.hex);
              }}
            />
          </PortalMenu>
        ) : null}
        {custom ? (
          <CustomColourEditor
            start={customStart}
            onUse={(hex) => {
              setCustom(false);
              onPick(hex);
            }}
          />
        ) : null}
      </div>
    </div>
  );
}

type MenuProps = {
  onKeyDown: (e: KeyboardEvent<HTMLButtonElement>) => void;
  onContextMenu: (e: React.MouseEvent<HTMLButtonElement>) => void;
  onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => void;
};

// A custom colour's menu triggers: right-click, a long-press on touch, Shift+F10 and the
// context-menu key.
function YourColour({
  onMenu,
  children,
}: {
  onMenu: (anchor: HTMLElement) => void;
  children: (props: MenuProps) => ReactNode;
}) {
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const longPress = useLongPress(() => {
    if (target) onMenu(target);
  });
  return children({
    onKeyDown: (e) => {
      if (!((e.key === 'F10' && e.shiftKey) || e.key === 'ContextMenu')) return;
      e.preventDefault();
      e.stopPropagation();
      onMenu(e.currentTarget);
    },
    onContextMenu: (e) => {
      e.preventDefault();
      e.stopPropagation();
      onMenu(e.currentTarget);
    },
    onPointerDown: (e) => {
      setTarget(e.currentTarget);
      longPress.onPointerDown(e);
    },
  });
}

// The menu's one action. It lives outside the flyout's DOM (a portal), so it is marked as the
// flyout's own (data-flyout-child). The PortalMenu around it moves focus in, keeps Escape to itself
// and gives focus back to the swatch (docs/specs/004-interface-design/menus.md).
function RemoveMenu({ onRemove }: { onRemove: () => void }) {
  return (
    <div data-flyout-child="">
      <MenuActionRow plain danger label="Remove" icon={<TrashIcon />} onClick={onRemove} />
    </div>
  );
}

function Swatch({
  buttonRef,
  label,
  colour,
  selected,
  tabbable,
  onPick,
  onKeyDown,
  onContextMenu,
  onPointerDown,
}: {
  buttonRef: (node: HTMLButtonElement | null) => void;
  label: string;
  colour: string;
  selected: boolean;
  tabbable: boolean;
  onPick: () => void;
  onKeyDown: (e: KeyboardEvent<HTMLButtonElement>) => void;
  onContextMenu?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  onPointerDown?: (e: React.PointerEvent<HTMLButtonElement>) => void;
}) {
  return (
    <Tooltip label={label}>
      <button
        ref={buttonRef}
        type="button"
        aria-label={label}
        aria-pressed={selected}
        tabIndex={tabbable ? 0 : -1}
        onClick={onPick}
        onKeyDown={onKeyDown}
        onContextMenu={onContextMenu}
        onPointerDown={onPointerDown}
        className="group flex h-6 w-6 items-center justify-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
      >
        <span
          aria-hidden
          style={{ backgroundColor: colour }}
          className={`block h-5 w-5 rounded-[5px] border border-black/15 transition dark:border-white/20 ${
            selected
              ? 'ring-2 ring-brand-500 ring-offset-1 dark:ring-brand-300 dark:ring-offset-slate-900'
              : 'group-hover:scale-110'
          }`}
        />
      </button>
    </Tooltip>
  );
}
