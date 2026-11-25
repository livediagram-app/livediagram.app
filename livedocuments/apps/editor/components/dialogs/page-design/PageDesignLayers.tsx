'use client';

// Page Design's home (docs/specs/011-theme/canvas-and-theme-dialog.md "Page Design", Layers): the page drawn as two
// layers, top to bottom as the page draws them (its Design over its Background), each a row that opens its own
// picker in place; then Quick Picks, a background and a design made from the tab's theme, set in one press.
import { memo, useEffect, useMemo, useState, type ReactNode } from 'react';
import { PagedCarousel } from '@liveworkspace/workbench/components/primitives/PagedCarousel';
import {
  PAGE_DESIGN_BY_ID,
  PAGE_DESIGN_FAMILIES,
  designsOfFamily,
  type PageBackground,
  type PageDesign,
  type PageDesignId,
  type PageFill,
} from '@livedocuments/document';
import { lucideChevronRight } from '@liveworkspace/icons/lucide';
import { lucideGlyph } from '@livedocuments/ui';
import { Switch } from '@liveworkspace/ui';
import { newPageBackgroundLabel } from '@/lib/new-page-background';
import { fillCss, themeBackgroundPresets, type ThemeBackgroundPreset } from '@/lib/page-paint';
import { getTheme } from '@/lib/themes';
import { PAGE_MOTION_CATALOGUE } from '@/lib/page-motion';
import { DesignTileImage } from './DesignTile';
import type { TileLook } from './DesignGrid';
import type { DesignTileInput } from './design-tile-svg';
import { rollMashup } from '@/lib/look-mashup';
import type { TabLook } from '@/lib/tab-looks';
import { tabStyleFontLabel } from '@liveworkspace/workbench/components/dialogs/tab-style/tab-style-fonts';
import { FINISH_LABELS } from '@liveworkspace/workbench/components/palette/FinishSection';

const Chevron = lucideGlyph(lucideChevronRight, 14);

export type PageLayer = 'design' | 'background';

export const ROW =
  'group grid w-full cursor-pointer grid-cols-[64px_minmax(0,1fr)_auto] items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-500 dark:hover:bg-slate-800/60';
export const THUMB =
  'relative aspect-video w-16 overflow-hidden rounded-md ring-1 ring-slate-200 dark:ring-slate-700';
// A row as a card of its own, two to a row: a smaller picture on a phone.
export const CELL =
  'group grid w-full min-w-0 cursor-pointer grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-2.5 rounded-xl border border-slate-200 px-2.5 py-2.5 text-left transition-colors hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 sm:grid-cols-[56px_minmax(0,1fr)_auto] dark:border-slate-700 dark:hover:border-slate-600 dark:hover:bg-slate-800/60';
export const CELL_THUMB =
  'relative aspect-video w-11 overflow-hidden rounded-md ring-1 ring-slate-200 sm:w-14 dark:ring-slate-700';
export const KICK =
  'block text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400';

/** The two rows: Design, then Background. */
export function LayerRows({
  look,
  worn,
  background,
  themeId,
  onOpen,
  extra,
  after,
}: {
  look: TileLook;
  worn: PageDesign | undefined;
  background: PageBackground | undefined;
  themeId: string;
  onOpen: (layer: PageLayer) => void;
  // Rows after the two layers, as they are drawn (Tab Style's Colours, Text and Finish).
  extra?: readonly {
    key: string;
    label: string;
    value: string;
    icon: ReactNode;
    onOpen: () => void;
    // A tab-wide setting while Affect All Pages is off: shown, but not offered.
    disabled?: boolean;
  }[];
  // A last card after them (Fine Tune, right of Finish).
  after?: ReactNode;
}) {
  const presets = useMemo(() => themeBackgroundPresets(getTheme(themeId)), [themeId]);
  const fill = background?.fill;
  return (
    <div className="px-3">
      <div
        // Two to a row (owner, 2026-11-25), each its own card.
        data-tour-id="tab-style-cards"
        className="grid grid-cols-2 gap-2"
        data-page-design-layers=""
      >
        <button
          type="button"
          className={CELL}
          onClick={() => onOpen('design')}
          // Named as the other cards are: its kind, then what the page wears.
          aria-label={`Design: ${designName(worn, background)}`}
          data-page-layer="design"
        >
          <span className={`${CELL_THUMB} bg-white dark:bg-slate-900`}>
            {worn ? <LayerDesign design={worn} look={{ ...look, background: undefined }} /> : null}
          </span>
          <span className="min-w-0">
            <span className={KICK}>Design</span>
            <span className="block truncate text-[13px] font-semibold text-slate-900 dark:text-slate-100">
              {designName(worn, background)}
            </span>
          </span>
          <Chevron className="text-slate-400 transition-transform group-hover:translate-x-0.5" />
        </button>
        <button
          type="button"
          className={CELL}
          onClick={() => onOpen('background')}
          aria-label={`Background: ${backgroundName(background, presets)}`}
          data-page-layer="background"
        >
          <span
            className={`${CELL_THUMB} ${fill ? '' : 'bg-white dark:bg-slate-900'}`}
            style={fill ? { background: fillCss(fill) } : undefined}
          />
          <span className="min-w-0">
            <span className={KICK}>Background</span>
            <span className="block truncate text-[13px] font-semibold text-slate-900 dark:text-slate-100">
              {backgroundName(background, presets)}
            </span>
          </span>
          <Chevron className="text-slate-400 transition-transform group-hover:translate-x-0.5" />
        </button>
        {extra?.map((row) => (
          <button
            key={row.key}
            type="button"
            className={`${CELL} disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:border-slate-200 disabled:hover:bg-transparent dark:disabled:hover:border-slate-700`}
            onClick={row.onOpen}
            disabled={row.disabled}
            aria-label={`${row.label}: ${row.value}`}
            data-page-layer={row.key}
          >
            <span
              className={`${CELL_THUMB} flex items-center justify-center bg-slate-50 text-slate-500 dark:bg-slate-800/60 dark:text-slate-300`}
            >
              {row.icon}
            </span>
            <span className="min-w-0">
              <span className={KICK}>{row.label}</span>
              <span className="block truncate text-[13px] font-semibold text-slate-900 dark:text-slate-100">
                {row.value}
              </span>
            </span>
            <Chevron className="text-slate-400 transition-transform group-hover:translate-x-0.5" />
          </button>
        ))}
        {after}
      </div>
      {/* Why the tab's cards are off: they set every page (said on the screen, not in a hover, which a disabled
          button never gets). */}
      {extra?.some((row) => row.disabled) ? (
        <p className="mt-2 px-1 text-[11px] text-slate-500 dark:text-slate-400">
          Colours, Text and Finish set every page: turn on Affect All Pages to change them.
        </p>
      ) : null}
    </div>
  );
}

/** Affect All Pages: on, a pick reaches every page; off, the page someone is on alone. `useAll` while that page has a
 *  design of its own, which clears it. A row of the screen's foot, under Fine Tune. */
export function AllPagesRow({
  allPages,
}: {
  allPages: { on: boolean; onChange: (on: boolean) => void; useAll?: () => void };
}) {
  return (
    <div
      // A press anywhere on the row flips the switch (coversRow).
      className="relative grid cursor-pointer grid-cols-[64px_minmax(0,1fr)_auto] items-center gap-3 px-3 py-2.5 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/60"
      data-page-design-all-pages=""
      data-tour-id="tab-style-reach"
    >
      <span className={`${THUMB} bg-slate-50 dark:bg-slate-800/60`}>
        <PagesReach all={allPages.on} />
      </span>
      <span className="min-w-0">
        <span
          id="page-design-all-pages"
          className="block text-[13px] font-semibold text-slate-900 dark:text-slate-100"
        >
          Affect All Pages
        </span>
        <span className="block text-[11px] text-slate-500 dark:text-slate-400">
          {allPages.on ? 'Every page, and every new one.' : 'Only the page you are on.'}
        </span>
      </span>
      <span className="flex items-center gap-1">
        {allPages.useAll ? (
          <button
            type="button"
            onClick={allPages.useAll}
            className="relative z-[1] shrink-0 cursor-pointer rounded-md px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            data-page-design-use-tab=""
          >
            Use All Pages’ Design
          </button>
        ) : null}
        <Switch
          checked={allPages.on}
          onChange={allPages.onChange}
          labelledBy="page-design-all-pages"
          coversRow
        />
      </span>
    </div>
  );
}

/** Copy to All Tabs: this tab's style (design, background, colours, text and finish) onto every other tab of the
 *  document, a locked tab keeping its own. A row of the screen's foot under Affect All Pages, drawn as it is, with a
 *  Copy button where the switch is; the picture's tabs take the style as it copies. */
export function AllTabsRow({
  allTabs,
}: {
  allTabs: { tabCount: number; applying: boolean; onApply: () => void };
}) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 2400);
    return () => clearTimeout(t);
  }, [copied]);
  if (allTabs.tabCount < 2) return null;
  const others = allTabs.tabCount - 1;
  return (
    <div
      className="grid grid-cols-[64px_minmax(0,1fr)_auto] items-center gap-3 px-3 py-2.5"
      data-page-design-all-tabs=""
    >
      <span className={`${THUMB} bg-slate-50 dark:bg-slate-800/60`}>
        <TabsReach copied={copied || allTabs.applying} />
      </span>
      <span className="min-w-0">
        <span
          id="page-design-all-tabs"
          className="block text-[13px] font-semibold text-slate-900 dark:text-slate-100"
        >
          Copy to All Tabs
        </span>
        <span className="block text-[11px] text-slate-500 dark:text-slate-400">
          {copied
            ? `Copied to ${others === 1 ? 'the other tab' : `${others} tabs`}.`
            : `This style on the other ${others === 1 ? 'tab' : `${others} tabs`}. Locked tabs keep theirs.`}
        </span>
      </span>
      <button
        type="button"
        disabled={allTabs.applying}
        aria-describedby="page-design-all-tabs"
        onClick={() => {
          allTabs.onApply();
          setCopied(true);
        }}
        className="shrink-0 cursor-pointer rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-medium text-slate-700 transition-colors hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 disabled:cursor-default disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-brand-400/60 dark:hover:bg-brand-500/20 dark:hover:text-brand-100"
        data-page-design-copy-tabs=""
      >
        {allTabs.applying ? 'Copying…' : copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  );
}

// Copy to All Tabs' picture: a row of three tabs over a page; the first wears the style, the other two take it as it
// copies (eased; none under reduced motion).
function TabsReach({ copied }: { copied: boolean }) {
  const tab = (x: number, on: boolean, key: string) => (
    <g key={key}>
      <path
        d={`M${x} 14 v-6 a2 2 0 0 1 2 -2 h12 a2 2 0 0 1 2 2 v6`}
        className="fill-white stroke-slate-300 dark:fill-slate-900 dark:stroke-slate-600"
        strokeWidth="1"
      />
      <path
        d={`M${x} 14 v-6 a2 2 0 0 1 2 -2 h12 a2 2 0 0 1 2 2 v6z`}
        fill="url(#pdt-wash)"
        className="transition-opacity duration-200 motion-reduce:transition-none"
        opacity={on ? 1 : 0}
      />
    </g>
  );
  return (
    <svg viewBox="0 0 64 36" className="absolute inset-0 h-full w-full" aria-hidden="true">
      <defs>
        <linearGradient id="pdt-wash" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" style={{ stopColor: 'var(--color-brand-200)' }} />
          <stop offset="1" style={{ stopColor: 'var(--color-brand-500)' }} />
        </linearGradient>
      </defs>
      {tab(8, true, 'a')}
      {tab(25, copied, 'b')}
      {tab(42, copied, 'c')}
      <rect
        x="6"
        y="14"
        width="52"
        height="18"
        rx="2.5"
        className="fill-white stroke-slate-300 dark:fill-slate-900 dark:stroke-slate-600"
        strokeWidth="1"
      />
      <rect x="11" y="19" width="20" height="2.5" rx="1.25" fill="url(#pdt-wash)" />
      <rect
        x="11"
        y="24.5"
        width="32"
        height="2"
        rx="1"
        className="fill-slate-200 dark:fill-slate-700"
      />
    </svg>
  );
}

// Affect All Pages' picture: three pages fanned, each wearing the pick while it is on; off, the front page alone
// wears it and the two behind fade to bare outlines. Each change eases (no motion under reduced motion).
function PagesReach({ all }: { all: boolean }) {
  const back = (x: number, y: number) => (
    <g>
      <rect
        x={x}
        y={y}
        width="30"
        height="20"
        rx="2.5"
        className="fill-white stroke-slate-300 dark:fill-slate-900 dark:stroke-slate-600"
        strokeWidth="1"
      />
      <rect
        x={x}
        y={y}
        width="30"
        height="20"
        rx="2.5"
        fill="url(#pdr-wash)"
        className="transition-opacity duration-200 motion-reduce:transition-none"
        opacity={all ? 1 : 0}
      />
    </g>
  );
  return (
    <svg viewBox="0 0 64 36" className="absolute inset-0 h-full w-full" aria-hidden="true">
      <defs>
        <linearGradient id="pdr-wash" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" style={{ stopColor: 'var(--color-brand-200)' }} />
          <stop offset="1" style={{ stopColor: 'var(--color-brand-500)' }} />
        </linearGradient>
      </defs>
      {back(26, 4)}
      {back(19, 8)}
      <rect x="12" y="12" width="30" height="20" rx="2.5" fill="url(#pdr-wash)" />
      <circle cx="35" cy="18" r="3.2" fill="white" opacity="0.7" />
      <path
        d="M12 27 q8 -5 15 -1 t15 -2 v5.5 a2.5 2.5 0 0 1 -2.5 2.5 h-25 a2.5 2.5 0 0 1 -2.5 -2.5z"
        fill="white"
        opacity="0.45"
      />
    </svg>
  );
}

const LayerDesign = memo(function LayerDesign({
  design,
  look,
}: {
  design: PageDesign;
  look: TileLook;
}) {
  const input = useMemo(
    () => ({
      design,
      theme: look.theme,
      paperDark: look.paperDark,
      background: undefined,
      font: look.font,
      idPrefix: 'pdl-',
    }),
    [design, look.theme, look.paperDark, look.font],
  );
  return <DesignTileImage input={input} />;
});

// The Design row's value: the design worn, a moving background (Design's Moving chip) after it, or None.
function designName(worn: PageDesign | undefined, background: PageBackground | undefined): string {
  const fill = background?.fill;
  const motion =
    fill?.kind === 'gradient' && fill.motion
      ? PAGE_MOTION_CATALOGUE.find((m) => m.id === fill.motion)?.label
      : undefined;
  const design = worn ? PAGE_DESIGN_BY_ID[worn.id].label : undefined;
  if (design && motion) return `${design} · ${motion}`;
  return design ?? (motion ? `${motion} (moving)` : 'None');
}

function backgroundName(
  background: PageBackground | undefined,
  presets: readonly ThemeBackgroundPreset[],
): string {
  const label = newPageBackgroundLabel(background ?? {}, presets);
  // "Theme dawn" reads as a name: "Theme Dawn".
  return label.replace(/^Theme (\w)/, (_, c: string) => `Theme ${c.toUpperCase()}`);
}

// How many Quick Picks are rolled: four pages of the carousel's six (owner, 2026-11-25).
const QUICK_COUNT = 24;

/** A Quick Pick: a whole style at once, the tab's look (colours, text, finish) with a design and a background. */
export type QuickPick = { fill: PageFill; design: PageDesignId; look: TabLook };

type Quick = QuickPick & { label: string; line: string; input: DesignTileInput };

// A fresh roll: each pick a random look (rollMashup), a design no other pick wears, and one of that look's theme
// gradients, named for its colours and design ("Ocean Waves") with its type and finish under.
function rollQuick(paperDark: boolean): Quick[] {
  const designs = PAGE_DESIGN_FAMILIES.flatMap((f) => designsOfFamily(f.id));
  const shuffled = [...designs].sort(() => Math.random() - 0.5).slice(0, QUICK_COUNT);
  let previous: TabLook | undefined;
  return shuffled.map((d) => {
    const look = rollMashup({ previous });
    previous = look;
    const theme = getTheme(look.theme);
    const presets = themeBackgroundPresets(theme);
    const fill = presets[Math.floor(Math.random() * presets.length)]!.fill;
    return {
      fill,
      design: d.id,
      look,
      label: `${theme.label} ${d.label}`,
      line: `${tabStyleFontLabel(look.font ?? null)}, ${FINISH_LABELS[look.finish]}`,
      input: {
        design: { id: d.id },
        theme,
        paperDark,
        background: { fill },
        font: look.font,
        idPrefix: `pdq-${d.id}-`,
      },
    };
  });
}

// The opening Keep Theme is on for, if any.
let keptTheme: string | null = null;

// The roll of the dialog's current opening: fresh each time it opens, kept while its screens come and go.
let rolled: { openId: string; picks: Quick[] } | null = null;
function rollFor(openId: string | undefined, paperDark: boolean): Quick[] {
  if (openId && rolled?.openId === openId) return rolled.picks;
  const picks = rollQuick(paperDark);
  if (openId) rolled = { openId, picks };
  return picks;
}

/** Quick Picks: whole styles (design, background, colours, text, finish) rolled fresh each time the dialog opens,
 *  six at a time over four pages; Shuffle rolls again. The pick worn now is ticked. */
export function QuickPicks({
  look,
  worn,
  fill,
  themeId,
  openId,
  pageOnly = false,
  onPick,
}: {
  look: TileLook;
  worn: PageDesignId | undefined;
  fill: PageFill | undefined;
  themeId: string;
  openId?: string;
  // Affect All Pages off: a pick dresses this page alone, so each shows its design and a background in the tab's own
  // colours and type (the tab's look is not changed).
  pageOnly?: boolean;
  onPick: (pick: QuickPick) => void;
}) {
  const [base, setRoll] = useState(() => rollFor(openId, look.paperDark));
  const presets = useMemo(() => themeBackgroundPresets(getTheme(themeId)), [themeId]);
  // Keep Theme (owner, 2026-11-25): off as the dialog opens, kept while its screens come and go.
  const [keepTheme, setKeepThemeState] = useState(() => !!openId && keptTheme === openId);
  const setKeepTheme = (on: boolean) => {
    keptTheme = on ? (openId ?? null) : null;
    setKeepThemeState(on);
  };
  const roll = useMemo<Quick[]>(
    () =>
      pageOnly
        ? base.map((q, i) => {
            const fill = presets[i % presets.length]!.fill;
            return {
              ...q,
              fill,
              label: PAGE_DESIGN_BY_ID[q.design].label,
              line: 'This page',
              input: { ...q.input, theme: look.theme, font: look.font, background: { fill } },
            };
          })
        : keepTheme
          ? // Keep Theme: each pick's type, finish and design, in the tab's theme and its gradients.
            base.map((q, i) => {
              const fill = presets[i % presets.length]!.fill;
              return {
                ...q,
                fill,
                look: { ...q.look, theme: themeId },
                label: `${getTheme(themeId).label} ${PAGE_DESIGN_BY_ID[q.design].label}`,
                input: { ...q.input, theme: look.theme, background: { fill } },
              };
            })
          : base,
    [pageOnly, keepTheme, base, presets, themeId, look.theme, look.font],
  );
  const [seq, setSeq] = useState(0);
  return (
    <section
      aria-label="Quick Picks"
      data-tour-id="tab-style-quick-picks"
      className="flex flex-col gap-2 px-2"
    >
      <PagedCarousel
        key={seq}
        items={roll}
        perPage={6}
        label="Quick Picks"
        heading={
          <h3 className="px-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Quick Picks
          </h3>
        }
        controls={
          // Keep Theme sits straight left of Shuffle, one row centred with it (owner, 2026-11-25, Work Tracker 1477);
          // not while Affect All Pages is off, which keeps the theme already, and Shuffle keeps its place then.
          <span className="flex items-center gap-1.5" data-page-design-quick-controls="">
            {pageOnly ? null : (
              <label
                className="flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md py-1 pl-1 text-[11px] font-medium text-slate-600 dark:text-slate-300"
                data-page-design-keep-theme=""
              >
                <span id="quick-keep-theme">Keep Theme</span>
                <Switch
                  checked={keepTheme}
                  onChange={setKeepTheme}
                  labelledBy="quick-keep-theme"
                  size="sm"
                />
              </label>
            )}
            <button
              type="button"
              onClick={() => {
                const picks = rollQuick(look.paperDark);
                if (openId) rolled = { openId, picks };
                setRoll(picks);
                setSeq((n) => n + 1);
              }}
              className="cursor-pointer whitespace-nowrap rounded-md px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              data-page-design-quick-shuffle=""
            >
              Shuffle
            </button>
          </span>
        }
        gridClass="grid grid-cols-3 gap-1.5"
        renderItem={(p) => {
          const on =
            worn === p.design && (pageOnly || themeId === p.look.theme) && sameFill(fill, p.fill);
          return (
            <button
              key={p.design}
              type="button"
              aria-pressed={on}
              aria-label={`${p.label}: ${p.line}`}
              onClick={() => onPick({ fill: p.fill, design: p.design, look: p.look })}
              className="group relative flex cursor-pointer flex-col gap-0.5 rounded-lg p-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
              data-page-design-quick={p.design}
            >
              <span
                className={`relative mb-0.5 aspect-[16/10] w-full overflow-hidden rounded-md transition-shadow ${on ? 'ring-2 ring-brand-500 dark:ring-brand-400' : 'ring-1 ring-slate-200 group-hover:ring-slate-300 dark:ring-slate-700 dark:group-hover:ring-slate-500'}`}
              >
                <DesignTileImage input={p.input} />
              </span>
              <span className="truncate px-0.5 text-[11px] font-medium text-slate-700 dark:text-slate-200">
                {p.label}
              </span>
              <span className="truncate px-0.5 text-[10px] text-slate-500 dark:text-slate-400">
                {p.line}
              </span>
            </button>
          );
        }}
      />
    </section>
  );
}

function sameFill(a: PageFill | undefined, b: PageFill): boolean {
  return (
    a?.kind === 'gradient' &&
    b.kind === 'gradient' &&
    a.from === b.from &&
    a.to === b.to &&
    !a.motion
  );
}
