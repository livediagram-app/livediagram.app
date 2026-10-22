'use client';

// The Sheet's toolbar (docs/specs/029-sheets/sheet.md "Toolbar"): a category switcher on the left (the palette's own
// dropdown, in its toolbar style), then the chosen category's buttons, each with the shared Tooltip. Buttons that do
// not fit fold from the right into More (⋯), so it never wraps. For someone who may edit, in Plan mode.
import { useLayoutEffect, useRef, useState } from 'react';
import { Tooltip } from '@liveplanner/ui';
import { PaletteDropdown } from '@/components/palette/PaletteDropdown';
import { useIsMobileViewport } from '@/hooks/ui/useIsMobileViewport';
import { useSheetController } from './sheet-controller';
import type { SheetActions } from './useSheetActions';
import { ChevronIcon, SearchIcon } from './sheet-icons';
import { SheetFunctionSearch, type FunctionMatch } from './SheetFunctionSearch';
import { FUNCTION_FAMILY_LABELS } from './SheetFunctionMenu';
import { track } from '@/lib/telemetry';
import { BAND_CARD_PX } from '@/components/plan/band-controls';
import { useSheetToolbarEnd } from './sheet-toolbar-end';
import { SheetToolbarMenu, type ToolbarMenuKind } from './SheetToolbarMenus';
import {
  toolbarCategories,
  type ToolbarButton,
  type ToolbarCategoryId,
} from './sheet-toolbar-categories';

const TOOLBAR_PX = 44;
// A button's square, and its glyph and letters (the shared 16 px glyphs and 13 px letters, drawn larger here).
const BUTTON_PX = 36;
// A word button's rough width per character (a function's name), and its glyph beside the word.
const WORD_CHAR_PX = 8;
const WORD_GLYPH_PX = 22;
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
// Search at the far right: its glyph, its word and a divider before it, kept out of the room the buttons share.
const SEARCH_PX = 112;
// On a phone the row packs tighter so more of the category shows before More: half the gap, slimmer dividers
// (mx-0.5), no menu chevrons, the switcher and the function families their glyph alone (named by the tooltip), and no
// Search (All Functions… still lists every function).
const PHONE_GAP_PX = 4;
const PHONE_SEPARATOR_PX = 9;
// The row's own padding and its divider from the switcher, kept out of the room.
const ROW_INSET_PX = 16;
const PHONE_ROW_INSET_PX = 14;

// The category last picked, for this session: every Sheet opens on it.
let lastCategory: ToolbarCategoryId = 'text';
const rememberCategory = (id: ToolbarCategoryId) => {
  lastCategory = id;
};

const stop = (e: { stopPropagation: () => void }) => e.stopPropagation();
const widthOf = (b: ToolbarButton, labelled = false, phone = false) =>
  (phone ? PHONE_GAP_PX : GAP_PX) +
  (b.separatorBefore ? (phone ? PHONE_SEPARATOR_PX : SEPARATOR_PX) : 0) +
  (b.menu && !b.control && !phone ? CHEVRON_PX : 0) +
  (b.control
    ? (b.controlPx ?? BUTTON_PX)
    : b.text && !phone
      ? Math.max(BUTTON_PX, b.text.length * WORD_CHAR_PX + 16 + (b.icon ? WORD_GLYPH_PX : 0))
      : BUTTON_PX + (labelled && !b.glyphOnly ? b.label.length * LABEL_CHAR_PX + LABEL_GAP_PX : 0));

// Undo and Redo are the canvas's own (the zoom cluster and the keys), never repeated here.
export function SheetToolbar({
  actions,
  inBand = false,
}: {
  actions: SheetActions;
  // In the header band (maximised or filling its tab): a card of its own in the top row, like the menu box.
  inBand?: boolean;
}) {
  const c = useSheetController();
  const end = useSheetToolbarEnd();
  const categories = toolbarCategories(c, actions, actions.activeFormat());
  const [categoryId, setCategoryId] = useState<ToolbarCategoryId>(lastCategory);
  const category = categories.find((k) => k.id === categoryId) ?? categories[0]!;
  // Switched here at least once: a switch cascades the new buttons in; the toolbar's first paint does not.
  const [switched, setSwitched] = useState(false);
  const pick = (id: string) => {
    if (id !== categoryId) setSwitched(true);
    rememberCategory(id as ToolbarCategoryId);
    setCategoryId(id as ToolbarCategoryId);
    setMenu(null);
  };

  // How many buttons fit: measured from the toolbar's width less the switcher's, Search's and, in a header band, the
  // header's own controls at the end (Maximise or Restore, the cog), which must never be clipped.
  const ref = useRef<HTMLDivElement | null>(null);
  const switcher = useRef<HTMLDivElement | null>(null);
  const endRef = useRef<HTMLSpanElement | null>(null);
  const [room, setRoom] = useState(1000);
  const hasEnd = !!end;
  const phone = useIsMobileViewport();
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () =>
      setRoom(
        el.clientWidth -
          (switcher.current?.offsetWidth ?? 0) -
          (endRef.current?.offsetWidth ?? 0) -
          (phone ? PHONE_ROW_INSET_PX : ROW_INSET_PX) -
          (phone ? 0 : SEARCH_PX),
      );
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    if (switcher.current) ro.observe(switcher.current);
    if (endRef.current) ro.observe(endRef.current);
    return () => ro.disconnect();
  }, [hasEnd, phone]);
  // On a phone a wide control with a menu (the colour swatches, Font, Font Size's stepper) is its glyph opening that
  // menu, so the rest of the category still has room beside it.
  const all = phone
    ? category.buttons.map((b) =>
        b.control && b.menu ? { ...b, control: undefined, controlPx: undefined } : b,
      )
    : category.buttons;
  // Labels beside the glyphs when the whole category fits with them (a wide Sheet on a desktop); on a phone, or
  // when they would not all fit, glyphs alone with tooltips, folding into More as needed.
  const labels = !phone && all.reduce((n, b) => n + widthOf(b, true), 0) <= room;
  let used = 0;
  let fits = 0;
  for (let i = 0; i < all.length; i++) {
    const reserve = i < all.length - 1 ? MORE_PX : 0;
    if (used + widthOf(all[i]!, false, phone) + reserve > room) break;
    used += widthOf(all[i]!, false, phone);
    fits++;
  }
  const shown = all.slice(0, fits);
  const folded = all.slice(fits);
  const [menu, setMenu] = useState<{
    kind: ToolbarMenuKind;
    anchor: HTMLElement;
    highlight?: string;
  } | null>(null);
  // Search (docs/specs/029-sheets/sheet.md "Toolbar"): its popover's anchor while open, and the latest function it
  // found, waiting for the Functions category to draw so its family's menu opens on it. Each find is a fresh
  // request; the one whose menu already opened is remembered, so it opens once.
  const [searchAt, setSearchAt] = useState<HTMLElement | null>(null);
  const [found, setFound] = useState<{ match: FunctionMatch } | null>(null);
  const opened = useRef<{ match: FunctionMatch } | null>(null);
  const searchButton = useRef<HTMLButtonElement | null>(null);
  const goTo = (match: FunctionMatch) => {
    track('Sheet', 'Searched', 'Function');
    setSearchAt(null);
    pick('functions');
    setFound({ match });
  };
  useLayoutEffect(() => {
    if (!found || found === opened.current || category.id !== 'functions') return;
    opened.current = found;
    const { match } = found;
    const label = `${FUNCTION_FAMILY_LABELS[match.family]} Functions`;
    // The family's own button, else More when it folded there, else Search itself.
    const anchor =
      ref.current?.querySelector<HTMLElement>(`[aria-label="${label}"]`) ??
      ref.current?.querySelector<HTMLElement>('[aria-label="More"]') ??
      searchButton.current;
    if (anchor) setMenu({ kind: `fn:${match.family}`, anchor, highlight: match.name });
  }, [found, category.id]);

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
              b.run?.(e.currentTarget, e.detail);
              c.focusGrid();
            }
          }}
        >
          {b.text && !phone ? (
            <span className="flex items-center gap-1.5 whitespace-nowrap text-[13px] font-semibold">
              {b.icon ? (
                <span aria-hidden className="flex items-center [&_svg]:size-4">
                  {b.icon}
                </span>
              ) : null}
              {b.text}
            </span>
          ) : (
            <span className="flex items-center [&_svg]:size-5 [&>span]:text-[17px]">{b.icon}</span>
          )}
          {labels && !b.text && !b.glyphOnly ? (
            <span className="ml-1 whitespace-nowrap text-[12px] font-medium">{b.label}</span>
          ) : null}
          {b.menu && !phone ? <ChevronIcon /> : null}
        </button>
      </Tooltip>
    );

  return (
    <div
      ref={ref}
      role="toolbar"
      aria-label="Sheet formatting"
      className={
        inBand
          ? 'flex min-w-0 max-w-full flex-1 items-center gap-0 overflow-hidden p-1'
          : 'flex shrink-0 items-center gap-0 overflow-hidden border-b px-1'
      }
      style={
        inBand
          ? // Straight on the Sheet's header in its ink, no card of its own, as its controls are (band-controls.ts).
            {
              height: `var(--plan-band-card-h, ${BAND_CARD_PX}px)`,
              color: c.palette.text,
            }
          : { height: TOOLBAR_PX, borderColor: c.palette.cardBorder, color: c.palette.text }
      }
      onPointerDown={stop}
      onDoubleClick={stop}
    >
      {/* In a header band the switcher fills the card's height, flush to its inset as the menu box's mode tile is
          (that box is drawn at the toolbar's UI scale, so a fixed 36 px tile here sat short of it, gaps above and
          below). */}
      <div
        ref={switcher}
        className={`flex shrink-0 items-center ${phone ? 'pr-1' : 'pr-1.5'}${
          inBand ? ' self-stretch [&>div>button]:h-full [&>div]:h-full' : ''
        }`}
      >
        <PaletteDropdown
          ariaLabel="Toolbar category"
          value={category.id}
          variant="toolbar"
          iconOnly={phone}
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
        className={`flex items-center ${phone ? 'gap-1 pl-1' : 'gap-2 pl-2'}${switched ? ' lvd-cascade' : ''}`}
        style={{ borderLeft: `1px solid ${c.palette.cardBorder}` }}
      >
        {shown.map((b) => (
          <span key={b.id} className={`flex shrink-0 items-center ${phone ? 'gap-1' : 'gap-2'}`}>
            {b.separatorBefore ? (
              <span
                aria-hidden
                className={`${phone ? 'mx-0.5' : 'mx-1'} h-5 w-px shrink-0`}
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
      {/* Search, not on a phone: its room goes to the category's buttons. */}
      {phone ? null : (
        <>
          <span
            aria-hidden
            className={`${folded.length ? '' : 'ml-auto '}mx-1 h-5 w-px shrink-0`}
            style={{ backgroundColor: c.palette.cardBorder }}
          />
          <Tooltip label="Search for a function">
            <button
              ref={searchButton}
              type="button"
              aria-label="Search"
              aria-haspopup="menu"
              aria-expanded={searchAt !== null}
              className="flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-md px-2 text-[13px] font-semibold transition hover:bg-black/5 dark:hover:bg-white/10"
              onClick={(e) => setSearchAt(e.currentTarget)}
            >
              <span aria-hidden className="flex items-center [&_svg]:size-4">
                <SearchIcon />
              </span>
              Search
            </button>
          </Tooltip>
        </>
      )}
      {end ? (
        // The header's controls, the cog last, after Search (sheet-toolbar-end.ts).
        <span
          ref={endRef}
          data-sheet-toolbar-end
          className="flex shrink-0 items-center gap-1 [&_button]:h-9 [&_button]:w-9"
          onPointerDown={(e) => e.stopPropagation()}
          onDoubleClick={(e) => e.stopPropagation()}
        >
          <span
            aria-hidden
            className="mx-1 h-5 w-px shrink-0"
            style={{ backgroundColor: c.palette.cardBorder }}
          />
          {end}
        </span>
      ) : null}
      {searchAt ? (
        <SheetFunctionSearch
          anchor={searchAt}
          onPick={goTo}
          onClose={() => {
            setSearchAt(null);
            c.focusGrid();
          }}
        />
      ) : null}
      {menu ? (
        <SheetToolbarMenu
          kind={menu.kind}
          anchor={menu.anchor}
          highlight={menu.highlight}
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
