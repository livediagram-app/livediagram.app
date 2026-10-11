// Pieces of the hero's editor-window mock drawn from the editor's own glyphs
// (@livediagram/ui, @livediagram/icons), so they cannot drift from the editor they depict
// (docs/specs/019-marketing/marketing-site.md): the canvas cluster, the tab bar's toolbelt, the
// Toolbar panel layout's strip and its menu card (docs/specs/007-editor/toolbar-layout.md), and a
// Plan board's own bar, which stands where the strip would on a board that fills its tab.
// Everything is at the mock's scale, about five eighths of the editor's.

import { MODE_GLYPHS } from '@livediagram/icons/mode-glyphs';
import {
  lucideChartColumn,
  lucideCircleCheck,
  lucidePlus,
  lucideSearch,
  lucideSettings,
  lucideSparkles,
  lucideTimer,
  lucideTrash2,
} from '@livediagram/icons/lucide';
import {
  AppearanceIcon,
  ChevronDownIcon,
  EllipsisIcon,
  Glyph,
  LayersStackIcon,
  MenuIcon,
  Prims,
  RedoIcon,
  SearchIcon,
  SettingsIcon,
  ThemeBrushIcon,
  UndoIcon,
} from '@livediagram/ui';
import { HERO_MODE, MODE_TILES, type HeroMode, type Tile } from './hero-mode-palette';

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

// The extra group a mode adds to the cluster, as CanvasChrome lays it out: Facilitate's session
// tools (timer, votes, poll) and a Plan board's own (delete, add, find, cards).
const MODE_GROUP: Partial<Record<HeroMode, Parameters<typeof Prims>[0]['prims'][]>> = {
  facilitate: [lucideTimer, lucideCircleCheck, lucideChartColumn],
  plan: [lucideTrash2, lucidePlus, lucideSearch],
};

// The canvas cluster, bottom right, as CanvasChrome lays it out: undo / redo, the mode's own group,
// Layers with the Tab Look & Feel brush, and the zoom readout.
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
          <ThemeBrushIcon size={12} />
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
      <span className="flex h-6 items-center gap-0.5 rounded bg-brand-50 px-1.5 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300">
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
      } ${tile.active ? 'bg-brand-50 text-brand-600 ring-1 ring-brand-300 dark:bg-brand-500/15 dark:text-brand-300 dark:ring-brand-500/40' : ''}`}
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

// The Palette in the Toolbar layout: one strip at the top centre of the canvas. The selection
// mode (Select), the category picker (Popular, its sparkles; Draw has its dock instead), the
// mode's tiles (the tool in hand marked), More, and the palette's search. Draw's dock splits
// its drawing tools from its shapes and carries its settings in a card of its own.
export function ToolbarStrip({ mode }: { mode: HeroMode }) {
  const { Icon } = HERO_MODE[mode];
  const pill =
    'flex h-6 items-center gap-1 rounded bg-brand-50 px-1.5 text-[9px] font-medium text-brand-600 dark:bg-brand-500/15 dark:text-brand-300';
  const strip =
    'flex items-center gap-0.5 rounded-lg border border-slate-200 bg-white p-0.5 text-slate-600 shadow-md shadow-slate-900/5 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300';
  // A Plan board's bar is for a wide window; on a phone the strip carries only the menu and mode.
  if (mode === 'plan')
    return (
      <>
        <PlanBoardBar />
        <div className="pointer-events-none absolute inset-x-0 top-2 z-10 flex justify-center sm:hidden">
          <div className={strip}>
            <span className="flex h-6 w-5 items-center justify-center">
              <MenuIcon size={10} />
            </span>
            <span className={pill}>
              <Icon size={10} />
              <ChevronDownIcon size={7} />
            </span>
          </div>
        </div>
      </>
    );
  const select = MODE_GLYPHS.select!;
  const tiles = MODE_TILES[mode];
  const draw = mode === 'draw';
  return (
    <div className="pointer-events-none absolute inset-x-0 top-2 z-10 flex justify-center gap-1.5">
      <div className={strip}>
        <span className="flex h-6 w-5 items-center justify-center sm:hidden">
          <MenuIcon size={10} />
        </span>
        {/* On a phone the menu rides here, the mode switch joined to it. */}
        <span className={`${pill} sm:hidden`}>
          <Icon size={10} />
          <ChevronDownIcon size={7} />
        </span>
        <span className="contents sm:hidden">
          <StripDivider />
        </span>
        {draw ? null : (
          <>
            <span className="flex h-6 items-center gap-0.5 px-1">
              <Glyph size={10} units={select.units}>
                <Prims prims={select.prims} />
              </Glyph>
              <ChevronDownIcon size={7} />
            </span>
            <span className={`${pill} max-sm:hidden`}>
              <Lucide prims={lucideSparkles} size={10} />
              <span className="text-optical-line">Popular</span>
              <ChevronDownIcon size={7} />
            </span>
            <StripDivider />
          </>
        )}
        {tiles.map((t, i) => (
          <span key={t.key} className="contents">
            {draw && t.group && i > 0 ? (
              // The group's divider shows only where its tiles do.
              <span className={i < NARROW_TILES ? 'contents' : 'hidden @[600px]:contents'}>
                <StripDivider />
              </span>
            ) : null}
            <StripTile tile={t} index={i} />
          </span>
        ))}
        {draw ? null : (
          <>
            <StripDivider />
            <span className="flex h-6 items-center gap-0.5 px-1">
              <EllipsisIcon size={10} />
              <ChevronDownIcon size={7} />
            </span>
            <span className="hidden h-6 w-6 items-center justify-center rounded bg-brand-50 text-brand-600 @[600px]:flex dark:bg-brand-500/15 dark:text-brand-300">
              <SearchIcon size={10} />
            </span>
          </>
        )}
      </div>
      {draw ? (
        <div className={`${strip} hidden @[600px]:flex`}>
          <span className="flex h-6 w-6 items-center justify-center">
            <Lucide prims={lucideSettings} size={11} />
          </span>
        </div>
      ) : null}
    </div>
  );
}

// A Plan board fills its tab, so its own bar stands at the top right where the strip would be:
// how much is done, whether every column is within its WIP limit, the card filter, add, and the
// board's settings (docs/specs/026-plan/plan-board.md).
function PlanBoardBar() {
  const chip =
    'flex h-6 items-center gap-1 rounded-md border border-slate-200 bg-white px-1.5 text-[9px] font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300';
  return (
    <div className="pointer-events-none absolute right-2 top-2 z-10 hidden items-center gap-1 rounded-lg border border-slate-200 bg-white/90 p-0.5 shadow-sm sm:flex dark:border-slate-700 dark:bg-slate-900/90">
      <span className={chip}>
        {/* The done ring: a third of the way round. */}
        <Glyph size={10} units={10} weight={1.6}>
          <circle cx="5" cy="5" r="4" className="stroke-slate-200 dark:stroke-slate-700" />
          <circle
            cx="5"
            cy="5"
            r="4"
            stroke="#10b981"
            strokeDasharray="8.3 25.1"
            transform="rotate(-90 5 5)"
          />
        </Glyph>
        <span className="text-optical-line font-semibold text-slate-800 dark:text-slate-100">
          33%
        </span>
        <span className="text-optical-line">done · 4/12</span>
      </span>
      <span className={`${chip} text-emerald-700 dark:text-emerald-300`}>
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        <span className="text-optical-line">Within WIP</span>
      </span>
      <span className={`${chip} hidden w-24 text-slate-400 @[600px]:flex`}>
        <SearchIcon size={8} />
        <span className="text-optical-line">Filter cards</span>
      </span>
      <span className={`${chip} w-6 justify-center border-dashed px-0`}>
        <Lucide prims={lucidePlus} size={10} />
      </span>
      <span className="flex h-6 w-6 items-center justify-center text-slate-500">
        <Lucide prims={lucideSettings} size={11} />
      </span>
    </div>
  );
}
