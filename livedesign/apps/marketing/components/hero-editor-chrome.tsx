// Pieces of the hero's editor-window mock drawn from the editor's own glyphs
// (@livedesign/ui, @livedesign/icons), so they cannot drift from the editor they depict
// (docs/specs/019-marketing/marketing-site.md): the canvas cluster, the tab bar's toolbelt, the
// Toolbar panel layout's strip and its menu card (docs/specs/007-editor/toolbar-layout.md).
// Everything is at the mock's scale, about five eighths of the editor's.

import { MODE_GLYPHS } from '@livedesign/icons/mode-glyphs';
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
} from '@livedesign/ui';
import { PAGES_BAR } from './hero-pages-bar';

const CARD =
  'flex h-7 items-center rounded-md border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900';
const CELL = 'flex h-full w-7 items-center justify-center';
const SPLIT = 'border-l border-slate-100 dark:border-slate-800';

// The canvas cluster, bottom right, as CanvasChrome lays it out: undo / redo, Layers with the Tab
// Style brush, and the zoom readout.
export function CanvasCluster({ className }: { className: string }) {
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
      <span className={`${CARD} overflow-hidden`}>
        <span className={CELL}>
          <LayersStackIcon size={12} />
        </span>
        <span className={`${CELL} ${SPLIT}`}>
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

// The Toolbar layout's menu card, top left, where the Explorer would float: the menu and the active
// tab's name, as the editor's ToolbarExplorerButton draws them. On a phone the menu rides at the head
// of the strip instead (the editor's menuInStrip).
export function ToolbarMenuButton({ tab }: { tab: string }) {
  return (
    <span
      className={`${CARD} absolute left-2 top-2 z-10 hidden h-8 gap-1 px-1 text-slate-600 sm:flex dark:text-slate-300`}
    >
      <span className="flex h-6 w-6 items-center justify-center">
        <MenuIcon size={11} />
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

function StripDivider() {
  return <span aria-hidden className="mx-0.5 h-4 w-px shrink-0 bg-slate-200 dark:bg-slate-700" />;
}

// The Palette in the Toolbar layout (docs/specs/007-editor/toolbar-layout.md): one strip at the top
// centre of the canvas, Pages' category bar: the selection mode, then the categories (each its glyph
// and one-word name, a hairline between bands; the glyphs alone where the window is narrow), then
// Search. Names show from a window wide enough to clear the menu card, as the editor's bar measures
// (a container query against the window's canvas, @container in hero-editor-window.tsx).
export function ToolbarStrip() {
  const strip =
    'flex items-center gap-0.5 rounded-lg border border-slate-200 bg-white p-0.5 text-slate-600 shadow-md shadow-slate-900/5 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300';
  const select = MODE_GLYPHS.select!;
  return (
    <div className="pointer-events-none absolute inset-x-0 top-2 z-10 flex justify-center">
      <div className={strip}>
        {/* On a phone the menu rides at the strip's start. */}
        <span className="flex h-6 w-5 items-center justify-center sm:hidden">
          <MenuIcon size={10} />
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
        {PAGES_BAR.map((band, b) => (
          <span key={b} className="contents">
            <StripDivider />
            {band.map(({ key, label, Icon: CategoryIcon }) => (
              <span
                key={key}
                className="flex h-6 items-center gap-1 rounded px-1 text-[9px] font-medium [&_svg]:h-3 [&_svg]:w-3"
              >
                <CategoryIcon />
                <span className="text-optical-line hidden @[900px]:inline">{label}</span>
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
