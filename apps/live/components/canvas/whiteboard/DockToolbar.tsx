'use client';

// One group of the whiteboard dock (docs/specs/023-draw-mode/draw-mode.md "What a whiteboard shows"):
// its own pill (a section of the Palette panel in the Floating layout) and its own toolbar for
// assistive technology, one Tab stop, the arrow keys walking its buttons (the WAI-ARIA toolbar
// pattern). Buttons are fixed-size, so nothing moves under the
// pointer when a tool is picked.

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
import { Tooltip } from '@livediagram/ui';
import { useDockVariant } from './dock-variant';

type Roving = { focusKey: string; setFocusKey: (key: string) => void };
const RovingContext = createContext<Roving>({ focusKey: '', setFocusKey: () => {} });

const NAV_KEYS = ['ArrowLeft', 'ArrowRight', 'Home', 'End'];

// The Palette panel's tile grids: as many columns as the palette's own (docs/specs/023-draw-mode/
// draw-mode.md "What a whiteboard shows"), which ArrowUp / ArrowDown step by.
const PANEL_COLUMNS = 3;

// How a group's buttons draw: icons in the dock, captioned tiles in a panel section, one
// full-width row in the panel's footer.
type ButtonForm = 'icon' | 'tile' | 'row';
const ButtonFormContext = createContext<ButtonForm>('icon');

export function DockToolbar({
  label,
  group,
  footer = false,
  children,
}: {
  label: string;
  // data-dock-group, for the dock's own lookups and the browser checks.
  group: string;
  // In the Palette panel, the panel's footer row rather than a section (Settings).
  footer?: boolean;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [focusKey, setFocusKey] = useState('');
  const variant = useDockVariant();
  const form: ButtonForm = variant === 'dock' ? 'icon' : footer ? 'row' : 'tile';

  // The Tab stop is the last focused button; while there is none (first render, or that button
  // went: a slot re-ranked, a mode switched), it is the group's first button.
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node || node.querySelector('[data-dock-item][tabindex="0"]')) return;
    const first = node.querySelector<HTMLElement>('[data-dock-item]');
    if (first?.dataset.dockItem) setFocusKey(first.dataset.dockItem);
  }, [children, focusKey]);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    // A tile grid also walks by rows.
    const vertical = form === 'tile' && (e.key === 'ArrowUp' || e.key === 'ArrowDown');
    if (!NAV_KEYS.includes(e.key) && !vertical) return;
    const items = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('[data-dock-item]'));
    const at = items.indexOf(document.activeElement as HTMLElement);
    if (at < 0) return;
    e.preventDefault();
    const next = vertical
      ? Math.min(
          items.length - 1,
          Math.max(0, at + (e.key === 'ArrowDown' ? PANEL_COLUMNS : -PANEL_COLUMNS)),
        )
      : e.key === 'Home'
        ? 0
        : e.key === 'End'
          ? items.length - 1
          : (at + (e.key === 'ArrowRight' ? 1 : -1) + items.length) % items.length;
    const target = items[next]!;
    setFocusKey(target.dataset.dockItem ?? '');
    target.focus();
  };

  const bar = (
    <div
      ref={ref}
      role="toolbar"
      aria-label={label}
      aria-orientation={form === 'tile' ? undefined : 'horizontal'}
      data-dock-group={group}
      onKeyDown={onKeyDown}
      className={
        form === 'tile'
          ? // A Palette panel section: the palette's own three-column tile grid.
            'pointer-events-auto relative grid grid-cols-3 gap-1'
          : form === 'row'
            ? // The Palette panel's footer: a rule, then one full-width row.
              'pointer-events-auto relative -mx-2.5 -mb-2.5 flex border-t border-slate-200 px-2.5 py-1.5 dark:border-slate-700'
            : // A pill of the dock, the Toolbar layout strip's twin (its card and padding).
              'pointer-events-auto relative flex shrink-0 animate-pop-in items-center gap-0.5 rounded-xl border border-slate-200 bg-white p-1 shadow-md shadow-slate-900/5 dark:border-slate-700 dark:bg-slate-900 dark:shadow-slate-950/40'
      }
    >
      {children}
    </div>
  );
  return (
    <RovingContext.Provider value={{ focusKey, setFocusKey }}>
      <ButtonFormContext.Provider value={form}>
        {form === 'tile' ? (
          // The palette's small-capitals section heading over the grid; the toolbar keeps its
          // accessible name.
          <div className="flex flex-col gap-1.5">
            <p
              aria-hidden
              className="px-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400"
            >
              {label}
            </p>
            {bar}
          </div>
        ) : (
          bar
        )}
      </ButtonFormContext.Provider>
    </RovingContext.Provider>
  );
}

export type DockButtonProps = {
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
  // The short name a Palette panel tile or row shows under or beside the glyph; the label up to
  // its first comma when absent ("Marker 1, medium" shows "Marker 1").
  caption?: string;
};

// The palette's tile and row looks (palette-controls PatternButton): the chosen one tinted.
const TILE_TONE = {
  on: 'bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-200',
  off: 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white',
};

export const DockButton = forwardRef<HTMLButtonElement, DockButtonProps>(
  function DockButton(o, ref) {
    const { focusKey, setFocusKey } = useContext(RovingContext);
    const form = useContext(ButtonFormContext);
    const caption = o.caption ?? o.label.split(',')[0]!;
    // The panel shows no key letters on its tiles, as the palette's own tiles show none: the key
    // is in the tooltip instead.
    const tip =
      form !== 'icon' && o.shortcut ? `${o.label} \u00b7 ${o.shortcut.toUpperCase()}` : o.label;
    const shape =
      form === 'tile'
        ? `relative flex w-full min-w-0 flex-col items-center gap-1 rounded-md px-1 py-2 transition focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand-500 ${
            o.pressed ? TILE_TONE.on : TILE_TONE.off
          }`
        : form === 'row'
          ? `relative flex w-full items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand-500 ${
              o.pressed ? TILE_TONE.on : TILE_TONE.off
            }`
          : // The Toolbar layout strip's tile size (36px), so the dock is the strip's height.
            `relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-600 transition focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand-500 dark:text-slate-300 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white ${
              o.pressed
                ? 'bg-brand-50 text-brand-700 ring-2 ring-inset ring-brand-500 dark:bg-brand-500/15 dark:text-brand-200'
                : ''
            }`;
    return (
      <Tooltip label={tip}>
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
          {form === 'icon' ? null : (
            <span
              className={
                form === 'tile'
                  ? 'w-full truncate text-center text-[10px] font-medium'
                  : 'text-optical-centre'
              }
            >
              {caption}
            </span>
          )}
          {o.shortcut && form === 'icon' ? (
            // Shown the whole time, as the Toolbar layout's strip does: a tool bar is where people
            // learn the keys. Slate-500 / -400 keep 4.5:1.
            <span
              aria-hidden
              className="pointer-events-none absolute bottom-0.5 right-1 text-[8px] font-medium uppercase leading-none text-slate-500 dark:text-slate-400"
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
  // The Palette panel's grids draw no separators (docs/specs/023-draw-mode/draw-mode.md); its shape
  // slot drag reads rows instead of a separator (useShapeSlotDrag).
  if (useDockVariant() === 'panel') return null;
  return (
    <span
      {...props}
      aria-hidden
      className="mx-0.5 h-6 w-px shrink-0 bg-slate-200 dark:bg-slate-700"
    />
  );
}
