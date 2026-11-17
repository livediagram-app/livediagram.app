'use client';

// The footer's Tools popover (liveworkspace/docs/specs/004-index/footer-tools-menu.md; blueprint FM1 to FM4): one
// button, left of Search in every editor's ChromeControls, opening a popover of the tools that work on the whole item
// (Automations, Suggest, Snapshots, History) where each used to be a button of its own. It wears the dialog hero
// header (the tools hung on a pegboard), then one row per tool: its glyph on a plate in the hero's tokens, its name,
// one line on what it does, its count, a chevron. Drawn only while it holds a tool; its rows are worked out from state
// each tool already holds, so opening it fetches nothing.

import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { DialogCloseButton, Glyph } from '@liveworkspace/ui';
import { HERO_TOKEN_STYLE, HeroDialogHeader } from '@liveworkspace/ui/dialog-hero';
import { toolsHeroArt } from '@liveworkspace/ui/dialog-hero-art/tools';
import { CHROME_BTN, CHROME_BTN_LABELLED, ChromeLabel } from './chrome-button';
import { PopoverOrSheet } from '../primitives/PopoverOrSheet';
import { useToolsDoorItems } from './tools-door';

/** The popover's sections, in the order they show; a section with no tool in it is left out. */
export const TOOL_GROUPS = [
  { id: 'find', title: 'Find' },
  { id: 'automate', title: 'Automate' },
  { id: 'collaborate', title: 'Collaborate' },
  { id: 'versions', title: 'Versioning' },
] as const;
export type ChromeToolsGroup = (typeof TOOL_GROUPS)[number]['id'];

export type ChromeToolsItem = {
  id: string;
  group: ChromeToolsGroup;
  label: string;
  // The one line under its name: short enough for one line at 480px, truncated past it.
  description: string;
  icon: ReactNode;
  /** Handed the Tools button, for a tool that opens a panel beside it (Suggest). */
  onSelect: (anchor: HTMLElement | null) => void;
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

// Wide enough for the header's line to sit clear of its art, which stands 108px in from the right edge.
const WIDTH_PX = 480;

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
  const grid = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const door = useToolsDoorItems();
  const shown = [...items, ...door].filter((i): i is ChromeToolsItem => i !== null);
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
  return (
    <>
      <button
        ref={setAnchor}
        type="button"
        onClick={() => setOpen((o) => !o)}
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
          name="Tools"
          width={WIDTH_PX}
          onClose={() => setOpen(false)}
        >
          {(sheet) => (
            <div
              data-tools-popover=""
              className="relative flex min-h-0 flex-col [border-radius:inherit] [color-scheme:light] dark:[color-scheme:dark]"
              style={HERO_TOKEN_STYLE}
            >
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
              {/* The close in the top right corner, as a popover's is, not centred down the band's row. Last in the DOM, so
              opening focuses the first tool, not the close. */}
              <div className="absolute right-3 top-3">
                <DialogCloseButton
                  compact
                  onClick={() => {
                    setOpen(false);
                    anchor.focus();
                  }}
                />
              </div>
            </div>
          )}
        </PopoverOrSheet>
      ) : null}
    </>
  );
}
