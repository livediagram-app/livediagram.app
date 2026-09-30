// Pieces of the hero's editor-window mock drawn from the editor's own glyphs
// (@livediagram/ui, @livediagram/icons), so they cannot drift from the editor they depict
// (docs/specs/019-marketing/marketing-site.md): the canvas cluster, the tab bar's toolbelt, and
// the Toolbar panel layout's strip and menu button (docs/specs/007-editor/toolbar-layout.md).
// Everything is at the mock's scale, about five eighths of the editor's.

import { MODE_GLYPHS } from '@livediagram/icons/mode-glyphs';
import { lucideStar } from '@livediagram/icons/lucide';
import {
  ActivityIcon,
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
import { Shape } from './hero-illustration-glyphs';

const CARD =
  'flex h-7 items-center rounded-md border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900';
const CELL = 'flex h-full w-7 items-center justify-center';

// The canvas cluster, bottom right, as CanvasChrome lays it out: tab activity with undo / redo
// inline, Layers, the Tab Look & Feel brush, and the zoom readout. `empty` is a new document's,
// where undo and redo have nothing to do and sit disabled.
export function CanvasCluster({ className, empty }: { className: string; empty: boolean }) {
  const history = empty ? 'text-slate-300 dark:text-slate-600' : '';
  return (
    <div className={`items-center gap-1.5 text-slate-600 dark:text-slate-300 ${className}`}>
      <span className={`${CARD} overflow-hidden`}>
        <span className={CELL}>
          <ActivityIcon size={12} />
        </span>
        <span className={`${CELL} ${history}`}>
          <UndoIcon size={8} />
        </span>
        <span className={`${CELL} ${history} border-l border-slate-100 dark:border-slate-800`}>
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
      <span className={`${CARD} gap-2.5 px-2.5 text-[9px] font-medium`}>
        <span>−</span>
        100%
        <span>+</span>
      </span>
    </div>
  );
}

// The tab bar's right-hand controls, labelled as the editor labels them on a wide window:
// Search, Settings, and the appearance toggle on its default, System.
export function TabBarToolbelt() {
  return (
    <div className="ml-auto hidden items-center gap-3 pr-1 text-[9px] font-medium text-slate-500 sm:flex dark:text-slate-400">
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

// The Toolbar layout's menu button, top left, where the Explorer would float. On a phone it
// rides at the head of the strip instead (the editor's menuInStrip).
export function ToolbarMenuButton() {
  return (
    <span
      className={`${CARD} absolute left-2 top-2 hidden w-7 justify-center text-slate-600 sm:flex dark:text-slate-300`}
    >
      <MenuIcon size={11} />
    </span>
  );
}

// The strip's Favourites, the editor's default go-to tiles in their order. A phone shows fewer.
const STRIP_TILES = ['rect', 'circle', 'diamond', 'text', 'arrow', 'frame', 'note', 'image', 'pen'];
const NARROW_TILES = 5;

function StripDivider() {
  return <span aria-hidden className="mx-0.5 h-4 w-px shrink-0 bg-slate-200 dark:bg-slate-700" />;
}

// The Palette in the Toolbar layout: one strip at the top centre of the canvas. The selection
// mode (Select), the category picker (Favourites), the category's first tiles, and More.
export function ToolbarStrip() {
  const select = MODE_GLYPHS.select!;
  return (
    <div className="pointer-events-none absolute inset-x-0 top-2 flex justify-center">
      <div className="flex items-center gap-0.5 rounded-lg border border-slate-200 bg-white p-0.5 text-slate-600 shadow-md shadow-slate-900/5 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
        <span className="flex h-6 w-5 items-center justify-center sm:hidden">
          <MenuIcon size={10} />
        </span>
        <span className="contents sm:hidden">
          <StripDivider />
        </span>
        <span className="flex h-6 items-center gap-0.5 rounded bg-brand-50 px-1 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300">
          <Glyph size={10} units={select.units}>
            <Prims prims={select.prims} />
          </Glyph>
          <ChevronDownIcon size={7} />
        </span>
        <StripDivider />
        <span className="flex h-6 items-center gap-1 rounded bg-brand-50 px-1.5 text-[9px] font-medium text-brand-600 dark:bg-brand-500/15 dark:text-brand-300">
          <Glyph size={10} units={24}>
            <Prims prims={lucideStar} />
          </Glyph>
          <span className="hidden sm:inline">Favourites</span>
          <ChevronDownIcon size={7} />
        </span>
        <StripDivider />
        {STRIP_TILES.map((kind, i) => (
          <span
            key={kind}
            className={`h-6 w-5 items-center justify-center ${i < NARROW_TILES ? 'flex' : 'hidden sm:flex'}`}
          >
            <Shape kind={kind} />
          </span>
        ))}
        <StripDivider />
        <span className="flex h-6 items-center gap-0.5 rounded bg-brand-50 px-1 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300">
          <EllipsisIcon size={10} />
          <ChevronDownIcon size={7} />
        </span>
      </div>
    </div>
  );
}
