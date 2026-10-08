// Pieces of the hero's editor-window mock drawn from the editor's own glyphs
// (@livediagram/ui, @livediagram/icons), so they cannot drift from the editor they depict
// (docs/specs/019-marketing/marketing-site.md): the canvas cluster, the tab bar's toolbelt, and
// the Toolbar panel layout's strip and menu button (docs/specs/007-editor/toolbar-layout.md).
// Everything is at the mock's scale, about five eighths of the editor's.

import { MODE_GLYPHS } from '@livediagram/icons/mode-glyphs';
import { lucideStar, lucideStickyNote } from '@livediagram/icons/lucide';
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
import { HERO_MODE, MODE_TILES, type HeroMode } from './hero-mode-palette';

const CARD =
  'flex h-7 items-center rounded-md border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900';
const CELL = 'flex h-full w-7 items-center justify-center';

// The canvas cluster, bottom right, as CanvasChrome lays it out: undo / redo, Layers, the Tab Look &
// Feel brush, and the zoom readout.
export function CanvasCluster({ className }: { className: string }) {
  return (
    <div className={`items-center gap-1.5 text-slate-600 dark:text-slate-300 ${className}`}>
      <span className={`${CARD} overflow-hidden`}>
        <span className={CELL}>
          <UndoIcon size={8} />
        </span>
        <span className={`${CELL} border-l border-slate-100 dark:border-slate-800`}>
          <RedoIcon size={8} />
        </span>
      </span>
      <span className={CARD}>
        <span className={CELL}>
          <LayersStackIcon size={12} />
        </span>
      </span>
      <span className={CARD}>
        <span className={CELL}>
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

// The Toolbar layout's menu button, top left, where the Explorer would float, with the editor
// mode switch joined to it (the mode's glyph and name). On a phone it rides at the head of the
// strip instead (the editor's menuInStrip), the mode as its glyph alone.
export function ToolbarMenuButton({ mode }: { mode: HeroMode }) {
  const { label, Icon } = HERO_MODE[mode];
  return (
    <span
      className={`${CARD} absolute left-2 top-2 hidden overflow-hidden text-slate-600 sm:flex dark:text-slate-300`}
    >
      <span className={CELL}>
        <MenuIcon size={11} />
      </span>
      <span className="optical-edges flex h-full items-center gap-1 border-l border-slate-100 bg-brand-50 px-2 text-[9px] font-medium text-brand-700 dark:border-slate-800 dark:bg-brand-500/15 dark:text-brand-200">
        <Icon size={10} />
        <span className="text-optical-line">{label}</span>
        <ChevronDownIcon size={7} />
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

// The Palette in the Toolbar layout: one strip at the top centre of the canvas. The selection
// mode (Select), the category picker (Popular; Draw
// has its tools instead), the mode's tiles (the tool in hand marked), and More.
export function ToolbarStrip({ mode }: { mode: HeroMode }) {
  const select = MODE_GLYPHS.select!;
  const { Icon } = HERO_MODE[mode];
  const pill =
    'flex h-6 items-center gap-1 rounded bg-brand-50 px-1.5 text-[9px] font-medium text-brand-600 dark:bg-brand-500/15 dark:text-brand-300';
  return (
    <div className="pointer-events-none absolute inset-x-0 top-2 z-10 flex justify-center">
      <div className="flex items-center gap-0.5 rounded-lg border border-slate-200 bg-white p-0.5 text-slate-600 shadow-md shadow-slate-900/5 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
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
        <span className="flex h-6 items-center gap-0.5 px-1">
          <Glyph size={10} units={select.units}>
            <Prims prims={select.prims} />
          </Glyph>
          <ChevronDownIcon size={7} />
        </span>
        {mode === 'draw' ? null : (
          <>
            <StripDivider />
            <span className="flex h-6 items-center gap-1 px-1.5 text-[9px] font-medium">
              <Glyph size={10} units={24}>
                {/* Plan has no Popular: its strip opens on Cards. */}
                <Prims prims={mode === 'plan' ? lucideStickyNote : lucideStar} />
              </Glyph>
              <span className="hidden sm:text-optical-line">
                {mode === 'plan' ? 'Cards' : 'Popular'}
              </span>
              <ChevronDownIcon size={7} />
            </span>
          </>
        )}
        <StripDivider />
        {MODE_TILES[mode].map((t, i) => (
          <span
            key={t.key}
            className={`h-6 w-6 items-center justify-center rounded ${
              i < NARROW_TILES ? 'flex' : 'hidden @[600px]:flex'
            } ${t.active ? 'bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300' : ''}`}
          >
            {t.glyph}
          </span>
        ))}
        <StripDivider />
        <span className="flex h-6 items-center gap-0.5 px-1">
          <EllipsisIcon size={10} />
          <ChevronDownIcon size={7} />
        </span>
      </div>
    </div>
  );
}
