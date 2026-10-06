'use client';

import { useId, useState } from 'react';
import { editorModeLabel, type EditorMode, type Element } from '@livediagram/document';
import { HoverCard, SearchIcon } from '@livediagram/ui';
import type { PendingDraw } from '@/lib/draw-mode';
import { track } from '@/lib/telemetry';
import { ChevronIcon } from '@/components/primitives/ChevronIcon';
import { SearchInput } from '@/components/primitives/SearchInput';
import { TOOLBAR_TRIGGER_TONE } from './PaletteDropdown';
import { PaletteTileGrid, tileHandler, type PaletteTileActions } from './PaletteTileGrid';
import type { PaletteTileDef } from './palette-tile-defs';
import { searchElementTiles } from './palette-tile-search';
import { searchCatalogueTiles } from './palette-catalogue-search';
import { useIconCatalogs } from '@/hooks/ui/useIconCatalogs';
import { markerTiles } from './palette-marker-tiles';
import { loadWhiteboardPrefs } from '@/lib/whiteboard-prefs';
import { useCanvasSurface } from '@/components/canvas/CanvasSurfaceContext';

// The Toolbar strip's Search (docs/specs/007-editor/toolbar-layout.md "Search: every element type"):
// a button at the strip's far right, and the body of the popover it opens. The popover's card,
// placement and dismissal are the strip's (ToolbarStripPopover); the match is palette-tile-search.

/** Marks the button and the popover, for the popover's outside-press check. */
export const TOOLBAR_SEARCH_SELECTOR = '[data-toolbar-search], [data-toolbar-search-button]';

export function ToolbarSearchButton({
  open,
  onToggle,
}: {
  open: boolean;
  onToggle: (button: HTMLElement) => void;
}) {
  const button = (
    <button
      type="button"
      data-toolbar-search-button=""
      aria-label="Search elements"
      aria-keyshortcuts="S"
      aria-expanded={open}
      onClick={(e) => onToggle(e.currentTarget)}
      // A square the size of a tile, not side padding: a phone's strip trims its pickers' px-2
      // (PHONE_TOOLBAR_ITEMS), which squeezed this icon-only button to 24px beside 36px tiles.
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md transition ${
        open
          ? 'bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-100'
          : TOOLBAR_TRIGGER_TONE
      }`}
    >
      <SearchIcon />
    </button>
  );
  // No hover card while open: it would sit over the popover it names.
  if (open) return button;
  return (
    <HoverCard
      title="Search Elements"
      description="Find any element by name, from every category and every mode. Shortcut: S."
    >
      {button}
    </HoverCard>
  );
}

export function ToolbarSearchPanel({
  mode,
  actions,
  pendingDraw,
  planCardTiles,
  tabElements,
}: {
  mode: EditorMode;
  // The tab's elements: before anything is typed, the panel lists the element types on it.
  tabElements: readonly Element[];
  actions: PaletteTileActions;
  pendingDraw: PendingDraw | null | undefined;
  // Plan's Cards, from the document's item types (as on the strip).
  planCardTiles?: readonly PaletteTileDef[];
}) {
  // Mounted only while the popover is open, so both reset each time it opens.
  const [query, setQuery] = useState('');
  const [othersOpen, setOthersOpen] = useState(false);
  const othersId = useId();
  // Draw mode's markers as this browser last set them, read once per opening.
  const [pens] = useState(loadWhiteboardPrefs);
  const surface = useCanvasSurface();
  // Icons, Stickers and Technology load as a chunk of their own: re-rendered when it lands.
  useIconCatalogs();
  const elements = searchElementTiles({
    query,
    mode,
    hasImage: actions.hasImage,
    planCardTiles,
    tabElements,
    drawTiles: markerTiles(pens, surface),
  });
  const catalogues = searchCatalogueTiles({ query, mode, tabElements });
  // Element types first, then the catalogue entries, in each section.
  const here = [...elements.here, ...catalogues.here];
  const elsewhere = [...elements.elsewhere, ...catalogues.elsewhere];
  const browsing = !query.trim();
  const modeName = editorModeLabel(mode);

  // Enter uses the best match: this mode's first, else the open accordion's first.
  const best = here[0] ?? (othersOpen ? elsewhere[0] : undefined);
  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter' || !best) return;
    e.preventDefault();
    tileHandler(best, actions)();
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center">
        <SearchInput
          value={query}
          onChange={setQuery}
          onKeyDown={onKeyDown}
          placeholder="Search elements"
          ariaLabel="Search elements"
          clearAriaLabel="Clear the element search"
          clearDescription="Clear the search over every element."
        />
      </div>
      {browsing && here.length > 0 ? (
        <div className="px-1 text-[10px] text-slate-500 dark:text-slate-400">On This Tab</div>
      ) : null}
      {here.length > 0 ? (
        <PaletteTileGrid tiles={here} actions={actions} pendingDraw={pendingDraw} />
      ) : (
        <p className="px-1 py-2 text-center text-[11px] text-slate-500 dark:text-slate-400">
          {browsing
            ? elsewhere.length > 0
              ? `Only elements from other modes are on this tab so far. Type to find any element.`
              : 'Nothing on this tab yet. Type to find any element.'
            : elsewhere.length > 0
              ? `No ${modeName} elements match. Other modes have ${elsewhere.length} below.`
              : 'No elements match'}
        </p>
      )}
      {elsewhere.length > 0 ? (
        <div className="flex flex-col border-t border-slate-100 pt-2 dark:border-slate-800">
          <button
            type="button"
            aria-expanded={othersOpen}
            aria-controls={othersId}
            onClick={() => {
              if (!othersOpen) track('UI', 'Opened', 'ToolbarSearchOtherModes');
              setOthersOpen(!othersOpen);
            }}
            className={`flex w-full items-center gap-2 rounded-lg border px-2 py-1.5 text-left transition ${
              othersOpen
                ? 'border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/60'
                : 'border-transparent hover:border-slate-200 hover:bg-slate-50 dark:hover:border-slate-700 dark:hover:bg-slate-800/60'
            }`}
          >
            <span className="min-w-0 flex-1">
              <span className="flex min-w-0 items-center gap-1.5">
                <span className="truncate text-[11px] font-semibold text-slate-700 dark:text-slate-200">
                  Not in {modeName} Mode
                </span>
                <span className="inline-flex h-[12.6px] shrink-0 items-center rounded-full bg-slate-100 px-1.5 text-[9px] font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                  <span className="text-optical-centre">{elsewhere.length}</span>
                </span>
              </span>
              <span className="line-clamp-2 text-[10px] leading-snug text-slate-500 dark:text-slate-400">
                Elements other modes offer. Any of them works here too.
              </span>
            </span>
            <span className="shrink-0 text-slate-400">
              <ChevronIcon open={othersOpen} />
            </span>
          </button>
          {othersOpen ? (
            <div id={othersId} className="mt-1.5">
              <PaletteTileGrid tiles={elsewhere} actions={actions} pendingDraw={pendingDraw} />
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
