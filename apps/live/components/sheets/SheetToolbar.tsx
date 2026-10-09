'use client';

// The Sheet's toolbar (docs/specs/029-sheets/sheet.md "Toolbar"): a category switcher on the left (the palette's own
// dropdown, in its toolbar style), then the chosen category's buttons, each with the shared Tooltip. Buttons that do
// not fit fold from the right into More (⋯), so it never wraps. For someone who may edit, in Plan mode.
import { useLayoutEffect, useRef, useState } from 'react';
import { Tooltip } from '@livediagram/ui';
import { PaletteDropdown } from '@/components/palette/PaletteDropdown';
import { useIsMobileViewport } from '@/hooks/ui/useIsMobileViewport';
import { useSheetController } from './sheet-controller';
import type { SheetActions } from './useSheetActions';
import { ChevronIcon } from './sheet-icons';
import { SheetToolbarMenu, type ToolbarMenuKind } from './SheetToolbarMenus';
import {
  toolbarCategories,
  type ToolbarButton,
  type ToolbarCategoryId,
} from './sheet-toolbar-categories';

export const TOOLBAR_PX = 44;
// A button's square, and its glyph and letters (the shared 16 px glyphs and 13 px letters, drawn larger here).
const BUTTON_PX = 36;
// A word button's rough width per character (a function's name).
const WORD_CHAR_PX = 8;
// The space between two buttons (the toolbar breathes rather than packing them).
const GAP_PX = 8;
// Room kept for More when some buttons fold.
const MORE_PX = 42;
// A label beside a glyph: its rough width per character, and the gap before it.
const LABEL_CHAR_PX = 7;
const LABEL_GAP_PX = 10;
// A group divider: 1 px, its margins (mx-1) and the gap it adds as one more item in the row.
const SEPARATOR_PX = 17;
// A menu button's chevron: 10 px and the gap before it.
const CHEVRON_PX = 12;

// The category last picked, for this session: every Sheet opens on it.
let lastCategory: ToolbarCategoryId = 'text';

const stop = (e: { stopPropagation: () => void }) => e.stopPropagation();
const widthOf = (b: ToolbarButton, labelled = false) =>
  GAP_PX +
  (b.separatorBefore ? SEPARATOR_PX : 0) +
  (b.menu && !b.control ? CHEVRON_PX : 0) +
  (b.control
    ? (b.controlPx ?? BUTTON_PX)
    : b.text
      ? Math.max(BUTTON_PX, b.text.length * WORD_CHAR_PX + 16)
      : BUTTON_PX + (labelled && !b.glyphOnly ? b.label.length * LABEL_CHAR_PX + LABEL_GAP_PX : 0));

// Undo and Redo are the canvas's own (the zoom cluster and the keys), never repeated here.
export function SheetToolbar({ actions }: { actions: SheetActions }) {
  const c = useSheetController();
  const categories = toolbarCategories(c, actions, actions.activeFormat());
  const [categoryId, setCategoryId] = useState<ToolbarCategoryId>(lastCategory);
  const category = categories.find((k) => k.id === categoryId) ?? categories[0]!;
  // Switched here at least once: a switch cascades the new buttons in; the toolbar's first paint does not.
  const [switched, setSwitched] = useState(false);
  const pick = (id: string) => {
    if (id !== categoryId) setSwitched(true);
    lastCategory = id as ToolbarCategoryId;
    setCategoryId(lastCategory);
    setMenu(null);
  };

  // How many buttons fit: measured from the toolbar's width less the switcher's.
  const ref = useRef<HTMLDivElement | null>(null);
  const switcher = useRef<HTMLDivElement | null>(null);
  const [room, setRoom] = useState(1000);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setRoom(el.clientWidth - (switcher.current?.offsetWidth ?? 0) - 16);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    if (switcher.current) ro.observe(switcher.current);
    return () => ro.disconnect();
  }, []);
  const all = category.buttons;
  // Labels beside the glyphs when the whole category fits with them (a wide Sheet on a desktop); on a phone, or
  // when they would not all fit, glyphs alone with tooltips, folding into More as needed.
  const phone = useIsMobileViewport();
  const labels = !phone && all.reduce((n, b) => n + widthOf(b, true), 0) <= room;
  let used = 0;
  let fits = 0;
  for (let i = 0; i < all.length; i++) {
    const reserve = i < all.length - 1 ? MORE_PX : 0;
    if (used + widthOf(all[i]!) + reserve > room) break;
    used += widthOf(all[i]!);
    fits++;
  }
  const shown = all.slice(0, fits);
  const folded = all.slice(fits);
  const [menu, setMenu] = useState<{ kind: ToolbarMenuKind; anchor: HTMLElement } | null>(null);

  const button = (b: ToolbarButton) =>
    b.control ? (
      <span key={b.id} className="flex items-center" onPointerDown={stop}>
        {b.control((anchor) => (b.menu ? setMenu({ kind: b.menu, anchor }) : undefined))}
      </span>
    ) : (
      // A label that shows needs no tooltip repeating it.
      <Tooltip key={b.id} label={labels && !b.text && !b.glyphOnly ? '' : b.label}>
        <button
          type="button"
          aria-label={b.label}
          aria-pressed={b.pressed === undefined ? undefined : b.pressed}
          aria-haspopup={b.menu ? 'menu' : undefined}
          aria-expanded={b.menu ? menu?.kind === b.menu : undefined}
          className="flex h-9 min-w-9 cursor-pointer items-center justify-center gap-0.5 rounded-md px-1.5 transition hover:bg-black/5 dark:hover:bg-white/10"
          style={
            b.pressed ? { backgroundColor: c.palette.column, color: c.palette.focus } : undefined
          }
          onClick={(e) => {
            if (b.menu) setMenu({ kind: b.menu, anchor: e.currentTarget });
            else {
              b.run?.();
              c.focusGrid();
            }
          }}
        >
          {b.text ? (
            <span className="whitespace-nowrap text-[13px] font-semibold">{b.text}</span>
          ) : (
            <span className="flex items-center [&_svg]:size-5 [&>span]:text-[17px]">{b.icon}</span>
          )}
          {labels && !b.text && !b.glyphOnly ? (
            <span className="ml-1 whitespace-nowrap text-[12px] font-medium">{b.label}</span>
          ) : null}
          {b.menu ? <ChevronIcon /> : null}
        </button>
      </Tooltip>
    );

  return (
    <div
      ref={ref}
      role="toolbar"
      aria-label="Sheet formatting"
      className="flex shrink-0 items-center gap-0 overflow-hidden border-b px-1"
      style={{ height: TOOLBAR_PX, borderColor: c.palette.cardBorder, color: c.palette.text }}
      onPointerDown={stop}
      onDoubleClick={stop}
    >
      <div ref={switcher} className="flex shrink-0 items-center pr-1.5">
        <PaletteDropdown
          ariaLabel="Toolbar category"
          hoverCardTitle="Toolbar Category"
          hoverCardDescription="Pick which tools show: Text, Cells, Numbers, Data, Charts or Functions."
          value={category.id}
          variant="toolbar"
          // On a desktop a resting mouse opens it: the categories are the toolbar's own tabs.
          openOnHover
          autoHeight
          grid
          menuClassName=""
          onChange={pick}
          options={categories.map((k) => ({ id: k.id, label: k.label, icon: k.icon }))}
        />
      </div>
      {/* Keyed by category: a switch mounts the new buttons, which cascade in (lvd-cascade, still under reduced
          motion); each is wrapped so it can move (a tooltip's wrapper is display: contents). */}
      <div
        key={category.id}
        className={`flex items-center gap-2 pl-2${switched ? ' lvd-cascade' : ''}`}
        style={{ borderLeft: `1px solid ${c.palette.cardBorder}` }}
      >
        {shown.map((b) => (
          <span key={b.id} className="flex shrink-0 items-center gap-2">
            {b.separatorBefore ? (
              <span
                aria-hidden
                className="mx-1 h-5 w-px shrink-0"
                style={{ backgroundColor: c.palette.cardBorder }}
              />
            ) : null}
            {button(b)}
          </span>
        ))}
      </div>
      {folded.length ? (
        <Tooltip label="More">
          <button
            type="button"
            aria-label="More"
            aria-haspopup="menu"
            className="ml-auto flex h-9 w-9 cursor-pointer items-center justify-center rounded-md text-xl leading-none hover:bg-black/5 dark:hover:bg-white/10"
            onClick={(e) => setMenu({ kind: 'more', anchor: e.currentTarget })}
          >
            ⋯
          </button>
        </Tooltip>
      ) : null}
      {menu ? (
        <SheetToolbarMenu
          kind={menu.kind}
          anchor={menu.anchor}
          actions={actions}
          folded={folded.map((b) => ({ label: b.label, icon: b.icon, run: b.run, menu: b.menu }))}
          onOpen={(kind, anchor) => setMenu({ kind, anchor })}
          onClose={() => {
            setMenu(null);
            c.focusGrid();
          }}
        />
      ) : null}
    </div>
  );
}
