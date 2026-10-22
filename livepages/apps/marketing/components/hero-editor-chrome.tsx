// Pieces of the hero's editor-window mock drawn from the editor's own glyphs
// (@livepages/ui, @livepages/icons), so they cannot drift from the editor they depict
// (docs/specs/019-marketing/marketing-site.md): the canvas cluster, the tab bar's toolbelt, the
// Toolbar panel layout's strip and its menu card (docs/specs/007-editor/toolbar-layout.md); a Plan
// tab's own bar is in hero-plan-bars.tsx.
// Everything is at the mock's scale, about five eighths of the editor's.

import { MODE_GLYPHS } from '@livepages/icons/mode-glyphs';
import {
  lucideCircleCheck,
  lucidePlus,
  lucideSearch,
  lucideSettings,
  lucideTimer,
  lucideTrash2,
} from '@livepages/icons/lucide';
import {
  AppearanceIcon,
  ChevronDownIcon,
  Glyph,
  LayersStackIcon,
  MenuIcon,
  Prims,
  RedoIcon,
  SearchIcon,
  SettingsIcon,
  ThemeLookIcon,
  UndoIcon,
} from '@livepages/ui';
import { DRAW_DOCK, HERO_MODE, MODE_BAR, type HeroMode, type Tile } from './hero-mode-palette';
import { PlanTabBar, type PlanTab } from './hero-plan-bars';

const CARD =
  'flex h-7 items-center rounded-md border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900';
const CELL = 'flex h-full w-7 items-center justify-center';
const SPLIT = 'border-l border-slate-100 dark:border-slate-800';

function Lucide({
  prims,
  size = 11,
}: {
  prims: Parameters<typeof Prims>[0]['prims'];
  size?: number;
}) {
  return (
    <Glyph size={size} units={24}>
      <Prims prims={prims} />
    </Glyph>
  );
}

// The extra group a mode adds to the cluster, as CanvasChrome lays it out: Workshop's session
// tools (timer and votes) and a Plan board's own (delete, add, find, cards).
const MODE_GROUP: Partial<Record<HeroMode, Parameters<typeof Prims>[0]['prims'][]>> = {
  workshop: [lucideTimer, lucideCircleCheck],
  plan: [lucideTrash2, lucidePlus, lucideSearch],
};

// The canvas cluster, bottom right, as CanvasChrome lays it out: undo / redo, the mode's own group,
// Layers with the Tab Style brush, and the zoom readout.
export function CanvasCluster({ className, mode }: { className: string; mode: HeroMode }) {
  const group = MODE_GROUP[mode];
  return (
    <div className={`items-center gap-1.5 text-slate-600 dark:text-slate-300 ${className}`}>
      <span className={`${CARD} overflow-hidden`}>
        <span className={CELL}>
          <UndoIcon size={8} />
        </span>
        <span className={`${CELL} ${SPLIT} text-slate-300 dark:text-slate-600`}>
          <RedoIcon size={8} />
        </span>
      </span>
      {group ? (
        <span className={`${CARD} overflow-hidden`}>
          {group.map((prims, i) => (
            <span key={i} className={`${CELL} ${i ? SPLIT : ''}`}>
              <Lucide prims={prims} size={10} />
            </span>
          ))}
        </span>
      ) : null}
      <span className={`${CARD} overflow-hidden`}>
        {mode === 'plan' ? null : (
          <span className={CELL}>
            <LayersStackIcon size={12} />
          </span>
        )}
        <span className={`${CELL} ${mode === 'plan' ? '' : SPLIT}`}>
          <ThemeLookIcon size={12} />
        </span>
      </span>
      {/* Each piece of the readout centres its cap band, not its line box, as the window's
          other labels do (docs/specs/004-interface-design/optical-alignment.md). */}
      <span className={`${CARD} gap-2.5 px-2.5 text-[9px] font-medium`}>
        <span className="text-optical-line">−</span>
        <span className="text-optical-line">100%</span>
        <span className="text-optical-line">+</span>
      </span>
    </div>
  );
}

// The tab bar's right-hand controls, labelled as the editor labels them on a wide window:
// Search, Settings, and the appearance toggle on its default, System. Shown by the window's width
// (the window/ container in hero-editor-window.tsx), not the viewport's: in a narrower window the
// tabs ran into it.
export function TabBarToolbelt() {
  return (
    <div className="ml-auto hidden items-center gap-3 pr-1 text-[9px] font-medium text-slate-500 @min-[620px]/window:flex dark:text-slate-400">
      <span className="flex items-center gap-1">
        <SearchIcon size={9} />
        Search
      </span>
      <span className="flex items-center gap-1">
        <SettingsIcon size={10} />
        Settings
      </span>
      <span className="flex items-center gap-1">
        <AppearanceIcon setting="system" size={9} />
        System
      </span>
    </div>
  );
}

// The Toolbar layout's menu card, top left, where the Explorer would float: the menu, the mode
// switch (the mode's glyph on its brand tint, with a chevron) and the active tab's name, as the
// editor's ToolbarExplorerButton draws them. On a phone the menu rides at the head of the strip
// instead (the editor's menuInStrip).
export function ToolbarMenuButton({ mode, tab }: { mode: HeroMode; tab: string }) {
  const { Icon } = HERO_MODE[mode];
  return (
    <span
      className={`${CARD} absolute left-2 top-2 z-10 hidden h-8 gap-1 px-1 text-slate-600 sm:flex dark:text-slate-300`}
    >
      <span className="flex h-6 w-6 items-center justify-center">
        <MenuIcon size={11} />
      </span>
      <span className="flex h-6 items-center gap-0.5 rounded bg-brand-50 px-1.5 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
        <Icon size={11} />
        <ChevronDownIcon size={7} />
      </span>
      {/* The tab's name, where the canvas is wide enough that it clears the strip. */}
      <span className="hidden items-center @[720px]:flex">
        <span aria-hidden className="mx-0.5 h-4 w-px bg-slate-200 dark:bg-slate-700" />
        <span className="text-optical-line px-1.5 text-[10px] font-medium text-slate-700 dark:text-slate-200">
          {tab}
        </span>
      </span>
    </span>
  );
}

// The strip shows the mode's first tiles; a narrow window fewer. Measured against the window's
// canvas (a container query, @container in hero-editor-window.tsx), not the viewport: a landing
// beat's window is narrower than the hero's at the same screen width, and the full strip there ran
// into the menu button beside it.
const NARROW_TILES = 4;

function StripDivider() {
  return <span aria-hidden className="mx-0.5 h-4 w-px shrink-0 bg-slate-200 dark:bg-slate-700" />;
}

// A tile with the shortcut that picks it, small under its glyph, as the editor's palette marks
// every tile that has one.
function StripTile({ tile, index }: { tile: Tile; index: number }) {
  return (
    <span
      className={`relative h-6 w-6 shrink-0 items-center justify-center rounded ${
        index < NARROW_TILES ? 'flex' : 'hidden @[600px]:flex'
      } ${tile.active ? 'bg-brand-50 text-brand-700 ring-1 ring-brand-300 dark:bg-brand-500/15 dark:text-brand-300 dark:ring-brand-500/40' : ''}`}
    >
      {tile.glyph}
      {tile.hint ? (
        <span className="absolute -bottom-[1px] -right-[1px] text-[5px] font-medium leading-none text-slate-400 dark:text-slate-500">
          {tile.hint}
        </span>
      ) : null}
    </span>
  );
}

// From which window width each bar shows its names (literal classes, so Tailwind sees them).
const NAMED_FROM: Partial<Record<HeroMode, string>> = {
  diagram: 'hidden @[640px]:inline',
  workshop: 'hidden @[780px]:inline',
  pages: 'hidden @[900px]:inline',
};

// The Palette in the Toolbar layout (docs/specs/007-editor/toolbar-layout.md): one strip at the top
// centre of the canvas. In Diagram, Workshop and Pages it is the category bar: the selection
// mode, then the mode's categories (each its glyph and one-word name, a hairline between bands; the
// glyphs alone where the window is narrow), then Search. Draw shows its dock instead, its drawing
// tools split from its shapes and its settings in a card of its own. A Plan tab brings its own bar
// (hero-plan-bars.tsx): a board's, a Sheet's toolbar or a Form's status bar.
export function ToolbarStrip({ mode, planTab = 'board' }: { mode: HeroMode; planTab?: PlanTab }) {
  const { Icon } = HERO_MODE[mode];
  const pill =
    'flex h-6 items-center gap-1 rounded bg-brand-50 px-1.5 text-[9px] font-medium text-brand-700 dark:bg-brand-500/15 dark:text-brand-300';
  const strip =
    'flex items-center gap-0.5 rounded-lg border border-slate-200 bg-white p-0.5 text-slate-600 shadow-md shadow-slate-900/5 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300';
  // On a phone the menu rides at the strip's start, the mode switch joined to it.
  const phoneMenu = (
    <>
      <span className="flex h-6 w-5 items-center justify-center sm:hidden">
        <MenuIcon size={10} />
      </span>
      <span className={`${pill} sm:hidden`}>
        <Icon size={10} />
        <ChevronDownIcon size={7} />
      </span>
    </>
  );
  // A Plan tab's bar is for a wide window; on a phone the strip carries only the menu and mode.
  if (mode === 'plan')
    return (
      <>
        <PlanTabBar tab={planTab} />
        <div className="pointer-events-none absolute inset-x-0 top-2 z-10 flex justify-center sm:hidden">
          <div className={strip}>{phoneMenu}</div>
        </div>
      </>
    );
  const select = MODE_GLYPHS.select!;
  const bands = MODE_BAR[mode];
  if (bands) {
    // Names fit or go, as the editor's bar measures: each bar's names need a window wide enough to clear
    // the menu card, the longer bars a wider one; narrower, the glyphs alone.
    const named = NAMED_FROM[mode] ?? 'hidden';
    return (
      <div className="pointer-events-none absolute inset-x-0 top-2 z-10 flex justify-center">
        <div className={strip}>
          {phoneMenu}
          <span className="contents sm:hidden">
            <StripDivider />
          </span>
          <span className="flex h-6 items-center gap-0.5 px-1">
            <Glyph size={10} units={select.units}>
              <Prims prims={select.prims} />
            </Glyph>
            <ChevronDownIcon size={7} />
          </span>
          {bands.map((band, b) => (
            <span key={b} className="contents">
              <StripDivider />
              {band.map(({ key, label, Icon: CategoryIcon }) => (
                <span
                  key={key}
                  className="flex h-6 items-center gap-1 rounded px-1 text-[9px] font-medium [&_svg]:h-3 [&_svg]:w-3"
                >
                  <CategoryIcon />
                  <span className={`text-optical-line ${named}`}>{label}</span>
                </span>
              ))}
            </span>
          ))}
          <StripDivider />
          <span className="flex h-6 w-6 items-center justify-center rounded">
            <SearchIcon size={10} />
          </span>
        </div>
      </div>
    );
  }
  // Draw: the dock.
  return (
    <div className="pointer-events-none absolute inset-x-0 top-2 z-10 flex justify-center gap-1.5">
      <div className={strip}>
        {phoneMenu}
        <span className="contents sm:hidden">
          <StripDivider />
        </span>
        {DRAW_DOCK.map((t, i) => (
          <span key={t.key} className="contents">
            {t.group && i > 0 ? (
              // The group's divider shows only where its tiles do.
              <span className={i < NARROW_TILES ? 'contents' : 'hidden @[600px]:contents'}>
                <StripDivider />
              </span>
            ) : null}
            <StripTile tile={t} index={i} />
          </span>
        ))}
      </div>
      <div className={`${strip} hidden @[600px]:flex`}>
        <span className="flex h-6 w-6 items-center justify-center">
          <Lucide prims={lucideSettings} size={11} />
        </span>
      </div>
    </div>
  );
}
