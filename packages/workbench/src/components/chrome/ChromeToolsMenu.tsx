'use client';

// The footer's Tools popover (liveworkspace/docs/specs/004-index/footer-tools-menu.md; blueprint FM1 to FM4): one
// button, left of Search in every editor's ChromeControls, opening a popover of the tools that work on the whole item
// (Automations, Suggest, Snapshots, History) where each used to be a button of its own. It wears the dialog hero
// header (the tools hung on a pegboard), then one row per tool: its glyph on a plate in the hero's tokens, its name,
// one line on what it does, its count, a chevron. Drawn only while it holds a tool; its rows are worked out from state
// each tool already holds, so opening it fetches nothing. A row opens its tool inside the popover (ToolsView, "Opening a
// tool inside Tools"; blueprint FM6), the back bar leading back to the list; Search and Version History close it.

import {
  useCallback,
  useEffect,
  useEffectEvent,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import {
  DialogCloseButton,
  Glyph,
  closeDialogSlot,
  openDialogSlot,
  setDialogSlotNode,
  useDialogSlot,
} from '@liveworkspace/ui';
import { HERO_TOKEN_STYLE, HeroDialogHeader } from '@liveworkspace/ui/dialog-hero';
import { toolsHeroArt } from '@liveworkspace/ui/dialog-hero-art/tools';
import { CHROME_BTN, CHROME_BTN_LABELLED, ChromeLabel } from './chrome-button';
import { PopoverOrSheet } from '../primitives/PopoverOrSheet';
import {
  TOOLS_REQUEST_TTL_MS,
  takeToolsView,
  type ToolsViewRequest,
  useToolsDoorItems,
  useToolsViewRequest,
} from './tools-door';
import { ToolsView } from './ToolsView';
import { AnimatedHeightBox } from '../primitives/AnimatedHeightBox';

/** The popover's sections, in the order they show; a section with no tool in it is left out. */
export const TOOL_GROUPS = [
  { id: 'find', title: 'Find' },
  { id: 'automate', title: 'Automate' },
  { id: 'collaborate', title: 'Collaborate' },
  { id: 'versions', title: 'Versioning' },
] as const;
export type ChromeToolsGroup = (typeof TOOL_GROUPS)[number]['id'];

/** What a tool's own view is handed: back to the list, Tools closed, and whether it is a phone's drawer. */
export type ToolViewContext = { back: () => void; close: () => void; sheet: boolean };

export type ChromeToolsItem = {
  id: string;
  group: ChromeToolsGroup;
  label: string;
  // The one line under its name: short enough for one line at 480px, truncated past it.
  description: string;
  icon: ReactNode;
  /** Handed the Tools button, for a tool that opens a panel beside it (Suggest). */
  onSelect: (anchor: HTMLElement | null) => void;
  /** `onSelect` opens a dialog, which renders inside Tools in place of a modal (the dialog slot). */
  inPlace?: boolean;
  // A tool used alongside the canvas (livediagram's Slide Deck: picking elements for a slide): a press outside leaves
  // Tools open, and only its close button or Escape shuts it (owner, 2026-11-17).
  keepOpen?: boolean;
  /** The tool's own view, drawn inside Tools (pressing the row calls this, not `onSelect`). */
  view?: (ctx: ToolViewContext) => ReactNode;
  /** What it needs before it works, as badges beside its name in order: "Sign In" for a tool that needs an account,
   *  "Sync Plan" (the app's own noun) for one that needs the item saved to the server. A press opens that tool's gate. */
  badges?: readonly string[];
  /** A mark at the row's end (Automations' on-count, Suggest's waiting count). */
  aside?: ReactNode;
  /** Wants seeing with the popover shut: a dot on the button (amber for a paused rule, the brand's for suggestions
   *  waiting), and `attentionLabel` in its name. */
  attention?: 'amber' | 'brand';
  attentionLabel?: string;
};

// Wide enough for the header's line to sit clear of its art, which stands 108px in from the right edge. The list and
// every tool inside it share it.
export const TOOLS_WIDTH_PX = 480;
// How long a tool's dialog may take to arrive (its code loading) before Tools gives up and goes back to the list.
export const TOOL_ARRIVAL_MS = 10_000;
// A press in these (a dialog or menu a tool opened, drawn outside the popover) is not a press outside it.
const TOOL_SURFACES =
  '[data-dialog-backdrop], [data-anchored-popover], [role="menu"], [role="listbox"]';

// Escape is left alone while a modal dialog is open (one a tool opened over Tools),
// or focus is in a part of a tool that takes Escape itself (a row's in-place confirm, `data-keeps-escape`).
const modalOpen = () =>
  !!document.querySelector('[data-dialog-panel]') ||
  !!document.activeElement?.closest('[data-keeps-escape]');

// The tools glyph: a toolbox, its handle and its lid's line.
export function ToolsGlyph({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="2" y="5" width="12" height="8.5" rx="1.5" />
      <path d="M6 5V3.6c0-.4.3-.6.6-.6h2.8c.3 0 .6.2.6.6V5" />
      <path d="M2 8.5h12M7 8.5v1.2h2V8.5" />
    </svg>
  );
}

// A tool's row: its glyph on a plate in the hero's tokens, its name and line, then its count or a chevron that steps
// right under the pointer. The plate deepens and the row takes the band's paper, so the list reads as the header's.
const ROW =
  'group relative flex w-full cursor-pointer items-center gap-3 rounded-xl px-2.5 py-2.5 text-left outline-none transition-colors duration-micro hover:bg-[var(--hero-paper)] focus-visible:bg-[var(--hero-paper)] focus-visible:ring-2 focus-visible:ring-brand-400/50 motion-reduce:transition-none';
const PLATE =
  'flex size-10 shrink-0 items-center justify-center rounded-[11px] bg-[var(--hero-soft)] text-[var(--hero-accent)] shadow-[inset_0_0_0_1px_var(--hero-faint)] transition-colors duration-micro group-hover:bg-[var(--hero-wash)] group-hover:shadow-[inset_0_0_0_1px_var(--hero-line)] group-focus-visible:bg-[var(--hero-wash)] [&_svg]:size-[18px]';

// What a tool needs first (Sign In, Sync Plan): a quiet pill beside its name, in the row's own ink.
const BADGE =
  'shrink-0 whitespace-nowrap rounded-full bg-slate-100 px-1.5 py-px text-[10px] font-semibold leading-4 text-slate-600 ring-1 ring-inset ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700';

function Chevron() {
  return (
    <Glyph
      size={14}
      weight={1.75}
      className="shrink-0 text-slate-500 transition-transform duration-micro group-hover:translate-x-0.5 group-hover:text-[var(--hero-accent)] motion-reduce:transition-none dark:text-slate-400"
    >
      <path d="m6 3.5 4.5 4.5L6 12.5" />
    </Glyph>
  );
}

export function ChromeToolsMenu({
  items,
  labelled = false,
}: {
  items: ReadonlyArray<ChromeToolsItem | null>;
  labelled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  // The button, held in state (not a ref) so the popover opens from it in render.
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);
  // The tool open inside the popover, and the dialog slot it waits on (a tool that opens a dialog).
  const [view, setView] = useState<{ id: string; slot: number | null } | null>(null);
  // The row to put focus back on once the list is drawn again.
  const [returnTo, setReturnTo] = useState<string | null>(null);
  // What the live region last said ("Snapshots" on the way in, "Tools" on the way out).
  const [said, setSaid] = useState('');
  // The close was pressed while a tool's dialog was open: once it lets go, Tools closes too.
  const closing = useRef(false);
  const grid = useRef<HTMLDivElement>(null);
  // The list's height as it last showed, so a tool opened from it starts at least that tall: going into a tool only
  // ever grows Tools, never shrinks it (owner, 2026-11-17); the tools' footers keep their buttons at the bottom.
  const [listPx, setListPx] = useState<number | null>(null);
  const titleId = useId();
  const door = useToolsDoorItems();
  const shown = [...items, ...door].filter((i): i is ChromeToolsItem => i !== null);
  const active = view ? (shown.find((i) => i.id === view.id) ?? null) : null;
  const slot = useDialogSlot();
  const ours = view?.slot != null && slot?.seq === view.slot ? slot : null;
  const claimed = ours?.claimed ?? null;

  // How the view on screen arrived: a fade as Tools opens, then forward into a tool and back out to the list.
  const [nav, setNav] = useState<'fade' | 'forward' | 'back'>('fade');
  const toList = useCallback(() => {
    if (view?.slot != null) closeDialogSlot(view.slot);
    setNav('back');
    closing.current = false;
    setView(null);
    setReturnTo(view?.id ?? null);
    setSaid('Tools');
  }, [view]);
  const finish = useCallback(() => {
    if (view?.slot != null) closeDialogSlot(view.slot);
    closing.current = false;
    setView(null);
    setOpen(false);
  }, [view]);
  // Back: through the tool's dialog's own close where it has one (it may ask about unsaved work first).
  const back = () => {
    closing.current = false;
    if (claimed) claimed.close();
    else toList();
  };
  const closeAll = () => {
    if (claimed) {
      closing.current = true;
      claimed.close();
      return;
    }
    finish();
  };
  // Each opening starts on the fade (set as it renders, not in an effect, so the first frame already has it).
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setNav('fade');
  }
  // The room under the band: the popover's own ceiling less the band, past which a view scrolls.
  const [bodyMax, setBodyMax] = useState<number | null>(null);
  // Measured from the list as it shows: the room under the band (bodyMax).
  const measureList = useCallback((node: HTMLDivElement | null) => {
    if (!node) return;
    const ceiling = parseFloat(getComputedStyle(node).maxHeight);
    const band = node.querySelector<HTMLElement>('[data-dialog-hero]')?.offsetHeight ?? 0;
    setBodyMax(Number.isFinite(ceiling) ? Math.max(0, Math.round(ceiling - band)) : null);
  }, []);
  // The corner close, and a tool closing Tools (a walkthrough starting): focus back on the button.
  const shut = () => {
    closeAll();
    if (!claimed) anchor?.focus({ preventScroll: true });
  };
  const openTool = (item: ChromeToolsItem, at: HTMLElement | null) => {
    setReturnTo(null);
    setNav('forward');
    if (item.view) setView({ id: item.id, slot: null });
    else {
      setView({ id: item.id, slot: openDialogSlot() });
      item.onSelect(at);
    }
    setSaid(item.label);
  };
  // The tool's dialog closed itself (its Cancel, Done or Escape): back to the list, or out, after the close.
  const released = !!ours?.released && !ours.held;
  const leaving = !!ours?.leaving;
  // Measured while the list shows (it changes as rows come and go), kept while a tool is open.
  const listShowing = !view;
  useEffect(() => {
    const node = grid.current;
    if (!listShowing || !node || typeof ResizeObserver === 'undefined') return;
    const measure = () => {
      if (node.offsetHeight > 0) setListPx(node.offsetHeight);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    measure();
    return () => observer.disconnect();
  }, [listShowing, open]);
  useEffect(() => {
    if (!released) return;
    if (closing.current || leaving) {
      finish();
      anchor?.focus({ preventScroll: true });
    } else toList();
  }, [released, leaving, finish, toList, anchor]);
  // A tool's dialog that never arrives (its code failed to load) hands the list back.
  const waiting = view?.slot != null && !claimed;
  useEffect(() => {
    if (!waiting) return;
    const timer = setTimeout(toList, TOOL_ARRIVAL_MS);
    return () => clearTimeout(timer);
  }, [waiting, toList]);
  // The row went while its tool was open (Clear Example Content once cleared): back to the list, adjusted as it
  // renders (its slot closes with the slot effect below).
  if (view && !active) {
    setView(null);
    setSaid('Tools');
  }
  // Back on the list: focus on the row that was open.
  useEffect(() => {
    if (view || !returnTo) return;
    grid.current
      ?.querySelector<HTMLElement>(`[data-tools-item="${CSS.escape(returnTo)}"]`)
      ?.focus({ preventScroll: true });
  }, [view, returnTo]);
  // Tools going (the editor leaving) lets go of its slot.
  const slotNow = view?.slot ?? null;
  useEffect(() => {
    if (slotNow === null) return;
    return () => closeDialogSlot(slotNow);
  }, [slotNow]);
  // Asked open at a tool from elsewhere (back from signing in, FM7): opened once Tools lists it.
  const asked = useToolsViewRequest();
  const askedItem = asked ? shown.find((i) => i.id === asked.id && (i.inPlace || i.view)) : null;
  const openAsked = useEffectEvent(
    (ask: ToolsViewRequest, item: ChromeToolsItem, at: HTMLElement) => {
      takeToolsView(ask);
      setOpen(true);
      openTool(item, at);
    },
  );
  useEffect(() => {
    if (!asked) return;
    if (Date.now() - asked.at > TOOLS_REQUEST_TTL_MS) {
      takeToolsView(asked);
      return;
    }
    if (!askedItem || !anchor) return;
    // Opened as the ask's own callback, after this commit, as a press on its row would be.
    let live = true;
    queueMicrotask(() => {
      if (live) openAsked(asked, askedItem, anchor);
    });
    return () => {
      live = false;
    };
  }, [asked, askedItem, anchor]);
  const slotRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (slotNow !== null) setDialogSlotNode(slotNow, node);
    },
    [slotNow],
  );

  if (shown.length === 0) return null;
  const attention = shown.filter((i) => i.attention);
  const name = [
    'Tools',
    ...attention.flatMap((i) => (i.attentionLabel ? [i.attentionLabel] : [])),
  ].join(', ');
  // Amber outranks the brand: a paused rule is a fault, suggestions waiting are only news.
  const dot = attention.some((i) => i.attention === 'amber') ? 'amber' : 'brand';
  // Up and down walk the rows, Home and End go to the ends.
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const cards = [
      ...(grid.current?.querySelectorAll<HTMLButtonElement>('[data-tools-item]') ?? []),
    ];
    const at = cards.indexOf(document.activeElement as HTMLButtonElement);
    if (at < 0) return;
    const step = e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : 0;
    const to = e.key === 'Home' ? 0 : e.key === 'End' ? cards.length - 1 : at + step;
    if ((step === 0 && e.key !== 'Home' && e.key !== 'End') || to < 0 || to >= cards.length) return;
    e.preventDefault();
    cards[to]?.focus();
  };
  // One width for the list and every tool inside it, so stepping in and out never moves the popover's sides.
  const width = TOOLS_WIDTH_PX;
  // Escape steps back a level (the tool's dialog asked first), then closes from the list.
  const onEscape = () => {
    if (!view) return false;
    if (claimed) claimed.escape();
    else toList();
    return true;
  };
  return (
    <>
      <button
        ref={setAnchor}
        type="button"
        onClick={() => (open ? closeAll() : setOpen(true))}
        aria-label={name}
        aria-haspopup="dialog"
        aria-expanded={open}
        data-tools-button=""
        className={`${labelled ? `${CHROME_BTN} ${CHROME_BTN_LABELLED}` : CHROME_BTN} ${
          open ? 'bg-slate-200 text-slate-900 dark:bg-slate-800 dark:text-white' : ''
        }`}
      >
        <ToolsGlyph />
        <ChromeLabel show={labelled}>Tools</ChromeLabel>
        {attention.length ? (
          <span
            aria-hidden
            data-tools-attention={dot}
            className={`absolute right-1 top-1 size-2 rounded-full ring-2 ring-white dark:ring-slate-900 ${
              dot === 'amber' ? 'bg-amber-500' : 'bg-brand-500'
            }`}
          />
        ) : null}
      </button>
      {open && anchor ? (
        <PopoverOrSheet
          anchor={anchor}
          name={active ? `Tools, ${active.label}` : 'Tools'}
          width={width}
          onClose={closeAll}
          levels={
            view
              ? {
                  onEscape,
                  passEscape: modalOpen,
                  layer: 'modal',
                  // Every press is "within" for a keep-open tool.
                  keepOpenWithin: active?.keepOpen ? '*' : TOOL_SURFACES,
                }
              : undefined
          }
        >
          {(sheet) => (
            <div
              ref={view ? undefined : measureList}
              data-tools-popover=""
              // Never under 300 px, list or tool (owner, 2026-11-17), unless the screen is shorter.
              className="relative flex max-h-[inherit] min-h-[min(500px,calc(100dvh-2rem))] flex-1 flex-col [border-radius:inherit] [color-scheme:light] dark:[color-scheme:dark]"
              style={HERO_TOKEN_STYLE}
            >
              <p aria-live="polite" data-tools-live="" className="sr-only">
                {said}
              </p>
              {/* The band heads every view of Tools, the list and each tool (above its breadcrumb), so moving between
              them never changes the popover's top. */}
              <HeroDialogHeader
                art={toolsHeroArt}
                titleId={titleId}
                title="Tools"
                subtitle="Powerful tools to enhance your experience."
                // The title and its line stop short of the art in the bottom right (96px, 12px in) and the close above it.
                className="sm:pr-[7.5rem]"
                // A phone's drawer: the band runs up under its grab handle.
                underHandle={sheet}
              />
              {/* Going into a tool slides it in from the right, as a phone opens a menu; back slides the list in from the
              left. The height eases between them (never under the list's floor), and scrolls past the room there is. */}
              <AnimatedHeightBox
                viewKey={view && active ? `${view.id}:${view.slot ?? 'view'}` : 'list'}
                enter={nav}
                maxPx={bodyMax ?? undefined}
                // A tool loading in steps never shrinks and grows back (owner, 2026-11-17, asked three times).
                settle
                // A phone's drawer fills what it is dragged to (owner, 2026-11-17), the tool growing with it.
                fill={sheet}
                className={`flex min-h-0 flex-col ${sheet ? 'flex-1' : ''}`}
              >
                {view && active ? (
                  <ToolsView
                    key={`${view.id}:${view.slot ?? 'view'}`}
                    id={view.id}
                    label={active.label}
                    onBack={back}
                    sheet={sheet}
                    tall={claimed?.size === '3xl'}
                    floorPx={listPx}
                    waiting={waiting}
                    slotRef={view.slot != null ? slotRef : undefined}
                  >
                    {active.view?.({ back: toList, close: shut, sheet })}
                  </ToolsView>
                ) : (
                  <>
                    <div
                      ref={grid}
                      onKeyDown={onKeyDown}
                      // Group headings read as sections, so the list ends on more room than a plain menu; a drawer scrolls it.
                      className={`flex flex-col gap-2 px-2 pb-3.5 pt-2 ${sheet ? 'min-h-0 overflow-y-auto overscroll-contain' : ''}`}
                    >
                      {TOOL_GROUPS.map((g) => {
                        const items = shown.filter((i) => i.group === g.id);
                        if (!items.length) return null;
                        const headingId = `${titleId}-${g.id}`;
                        return (
                          <div
                            key={g.id}
                            role="group"
                            aria-labelledby={headingId}
                            data-tools-group={g.id}
                          >
                            <h3
                              id={headingId}
                              className="px-2.5 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400"
                            >
                              {g.title}
                            </h3>
                            <div className="flex flex-col gap-0.5">
                              {items.map((item) => (
                                <button
                                  key={item.id}
                                  type="button"
                                  data-tools-item={item.id}
                                  className={ROW}
                                  onClick={() => {
                                    if (item.inPlace || item.view) {
                                      openTool(item, anchor);
                                      return;
                                    }
                                    setOpen(false);
                                    item.onSelect(anchor);
                                  }}
                                >
                                  <span aria-hidden className={PLATE}>
                                    {item.icon}
                                  </span>
                                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                                    <span className="flex min-w-0 items-center gap-2">
                                      <span className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                                        {item.label}
                                      </span>
                                      {item.badges?.map((badge) => (
                                        <span key={badge} data-tools-badge="" className={BADGE}>
                                          {badge}
                                        </span>
                                      ))}
                                    </span>
                                    <span className="truncate text-xs leading-snug text-slate-500 dark:text-slate-400">
                                      {item.description}
                                    </span>
                                  </span>
                                  {item.aside ? (
                                    <span className="flex shrink-0 items-center">{item.aside}</span>
                                  ) : null}
                                  <Chevron />
                                </button>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </AnimatedHeightBox>
              {/* The close in the top right corner, as a popover's is, not centred down the band's row: on the list and
              on a tool alike, the band staying above the breadcrumb. Last in the DOM, so opening focuses the first
              tool (or the back bar), not the close. */}
              <div className="absolute right-3 top-3">
                <DialogCloseButton compact onClick={shut} />
              </div>
            </div>
          )}
        </PopoverOrSheet>
      ) : null}
    </>
  );
}
