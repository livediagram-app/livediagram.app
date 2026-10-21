'use client';

// One group of the whiteboard dock (docs/specs/023-draw-mode/draw-mode.md "What a whiteboard shows"):
// a run of the dock's one card, between hairlines, and its own toolbar for assistive technology, one
// Tab stop, the arrow keys walking its buttons (the WAI-ARIA toolbar pattern). Buttons are
// fixed-size, so nothing moves under the pointer when a tool is picked. The card, the tiles and the
// pressed look are the Toolbar layout strip's, so Draw's tools read as the other modes' palette.

import {
  createContext,
  forwardRef,
  useContext,
  useLayoutEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { Tooltip } from '@liveplanner/ui';
import { PHONE_TOOLBAR_ITEMS } from '@/components/chrome/phone-toolbar-items';
import { TOOLBAR_CONTROL_REST, TOOLBAR_DIVIDER } from '@/components/chrome/toolbar-surface';

type Roving = { focusKey: string; setFocusKey: (key: string) => void };
const RovingContext = createContext<Roving>({ focusKey: '', setFocusKey: () => {} });

const NAV_KEYS = ['ArrowLeft', 'ArrowRight', 'Home', 'End'];

// A tool in hand or a toggle on: the Toolbar layout strip's active tile (PaletteIconButton). Its ring is inset: a
// centred dock can land on a half pixel, where an outer ring's left edge went under the tile's own background.
const DOCK_PRESSED =
  'bg-brand-100 text-brand-700 ring-1 ring-inset ring-brand-300 dark:bg-brand-500/20 dark:text-brand-200 dark:ring-brand-500/50';

export function DockToolbar({
  label,
  group,
  children,
}: {
  label: string;
  // data-dock-group, for the dock's own lookups and the browser checks.
  group: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [focusKey, setFocusKey] = useState('');

  // The Tab stop is the last focused button; while there is none (first render, or that button
  // went: a slot re-ranked, a mode switched), it is the group's first button.
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node || node.querySelector('[data-dock-item][tabindex="0"]')) return;
    const first = node.querySelector<HTMLElement>('[data-dock-item]');
    if (first?.dataset.dockItem) setFocusKey(first.dataset.dockItem);
  }, [children, focusKey]);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!NAV_KEYS.includes(e.key)) return;
    const items = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('[data-dock-item]'));
    const at = items.indexOf(document.activeElement as HTMLElement);
    if (at < 0) return;
    e.preventDefault();
    const next =
      e.key === 'Home'
        ? 0
        : e.key === 'End'
          ? items.length - 1
          : (at + (e.key === 'ArrowRight' ? 1 : -1) + items.length) % items.length;
    const target = items[next]!;
    setFocusKey(target.dataset.dockItem ?? '');
    target.focus();
  };

  return (
    <RovingContext.Provider value={{ focusKey, setFocusKey }}>
      <div
        ref={ref}
        role="toolbar"
        aria-label={label}
        aria-orientation="horizontal"
        data-dock-group={group}
        // The Draw tour's anchors (docs/specs/023-draw-mode/draw-tour.md): dock-drawing, dock-shapes, dock-settings.
        data-tour-id={`dock-${group}`}
        onKeyDown={onKeyDown}
        // A run of the dock's card (DockBody draws the card and the hairlines between groups), its items 44px-tall
        // tap areas on a touch screen.
        className={`relative flex shrink-0 items-center gap-0.5 ${PHONE_TOOLBAR_ITEMS}`}
      >
        {children}
      </div>
    </RovingContext.Provider>
  );
}

type DockButtonProps = {
  itemKey: string;
  label: string;
  icon: ReactNode;
  onPress: (el: HTMLElement) => void;
  // A tool in hand or a toggle on.
  pressed?: boolean;
  // An opener: aria-expanded / aria-controls for its flyout.
  controls?: { id: string; expanded: boolean };
  // The key that picks this tool (docs/specs/023-draw-mode/draw-mode.md "Keyboard shortcuts").
  shortcut?: string;
  // A right-click (or the context-menu key) on the button.
  onContext?: (el: HTMLElement) => void;
  // Pointer hover in and out (a mouse or a pen, never a finger).
  onHoverEnter?: (el: HTMLElement) => void;
  onHoverLeave?: () => void;
  // Extra attributes for a slot (its drag, its menu keys, its data).
  extra?: ButtonHTMLAttributes<HTMLButtonElement> & Record<`data-${string}`, string | undefined>;
  className?: string;
};

export const DockButton = forwardRef<HTMLButtonElement, DockButtonProps>(
  function DockButton(o, ref) {
    const { focusKey, setFocusKey } = useContext(RovingContext);
    // The Toolbar layout strip's tile (36px, its corners and its pressed look: PaletteIconButton's
    // active tone), so the dock is the strip's height and a tool in hand reads the same in every mode.
    const shape = `relative flex h-9 w-9 shrink-0 items-center justify-center rounded-md transition focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand-500 ${
      o.pressed ? DOCK_PRESSED : TOOLBAR_CONTROL_REST
    }`;
    return (
      <Tooltip label={o.label}>
        <button
          ref={ref}
          type="button"
          {...o.extra}
          data-dock-item={o.itemKey}
          aria-label={o.label}
          aria-pressed={o.pressed}
          aria-keyshortcuts={o.shortcut}
          aria-expanded={o.controls?.expanded}
          aria-controls={o.controls?.id}
          aria-haspopup={o.controls ? 'true' : undefined}
          tabIndex={focusKey === o.itemKey ? 0 : -1}
          onFocus={() => setFocusKey(o.itemKey)}
          onClick={(e) => o.onPress(e.currentTarget)}
          onContextMenu={
            o.onContext
              ? (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  o.onContext!(e.currentTarget);
                }
              : undefined
          }
          onPointerEnter={
            o.onHoverEnter
              ? (e) => (e.pointerType !== 'touch' ? o.onHoverEnter!(e.currentTarget) : undefined)
              : undefined
          }
          onPointerLeave={
            o.onHoverLeave
              ? (e) => (e.pointerType !== 'touch' ? o.onHoverLeave!() : undefined)
              : undefined
          }
          className={`${shape} ${o.className ?? ''}`}
        >
          {o.icon}
          {o.shortcut ? (
            // Shown the whole time, as the Toolbar layout's strip does: a tool bar is where people
            // learn the keys. Slate-500 / -400 keep 4.5:1.
            <span
              aria-hidden
              className="pointer-events-none absolute bottom-0.5 right-1 text-[8px] font-medium uppercase leading-none text-slate-500 pointer-coarse:hidden dark:text-slate-400"
            >
              {o.shortcut}
            </span>
          ) : null}
        </button>
      </Tooltip>
    );
  },
);

export function DockDivider(props: Record<`data-${string}`, string>) {
  return <span {...props} aria-hidden className={TOOLBAR_DIVIDER} />;
}
