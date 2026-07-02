import { TECH_ICON_DND_MIME, type TechIconDef, type TechProvider } from '@/lib/tech-icons';
import { IconButton } from '@/components/palette/palette-controls';
import { PaletteDropdown } from '@/components/palette/PaletteDropdown';
import { TechIconArt } from '@/components/primitives/tech-icon-glyph';
import { Tooltip } from '@/components/primitives/Tooltip';

type TechPickerTabProps = {
  addTechIcon: (iconId: string) => void;
  techQuery: string;
  setTechQuery: (q: string) => void;
  techProvider: TechProvider | 'all';
  setTechProvider: (p: TechProvider | 'all') => void;
  techFilters: { id: string; label: string }[];
  techResults: TechIconDef[];
  // True while the async icon-catalogue chunk (lib/icon-registry.ts) is still
  // in flight — the grid is empty then, so show a loading note instead of the
  // misleading "no matches" empty state.
  loading?: boolean;
};

// The command palette's Technology tab: a searchable, provider-filtered
// catalogue of brand / tech icons (spec/41). Clicking one drops it as a
// fixed-colour tech-icon shape; each is also drag-droppable. Split out of
// CommandPalette.
export function TechPickerTab({
  addTechIcon,
  techQuery,
  setTechQuery,
  techProvider,
  setTechProvider,
  techFilters,
  techResults,
  loading = false,
}: TechPickerTabProps) {
  return (
    <>
      {/* Searchable catalogue of brand icons. Clicking one drops it
                    at the viewport centre as a standalone 'icon' shape with
                    fixed brand colours; dragging drops it at the pointer. See
                    spec/41. */}
      {/* Filter dropdown sits LEFT of the search (flex-row-reverse) so
                    it doesn't stack under the category picker at the top-right. */}
      <div className="relative mb-2 flex flex-row-reverse items-center gap-1.5">
        <div className="relative flex-1">
          <input
            type="text"
            value={techQuery}
            onChange={(e) => setTechQuery(e.target.value)}
            placeholder="Search technology"
            aria-label="Search technology icons"
            className="w-full rounded-md border border-slate-200 bg-white py-1 pl-2 pr-7 text-xs text-slate-700 placeholder:text-slate-400 focus:border-brand-400 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          />
          {techQuery ? (
            <Tooltip title="Clear search" description="Clear the technology search query.">
              <button
                type="button"
                onClick={() => setTechQuery('')}
                aria-label="Clear technology search"
                className="absolute right-1 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-200"
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 12 12"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  aria-hidden
                >
                  <path d="M3 3 L9 9 M9 3 L3 9" />
                </svg>
              </button>
            </Tooltip>
          ) : null}
        </div>
        {/* Provider filter: narrow to AWS / Azure / Generic; "All"
                      clears it. Combines with the search box. */}
        <div className="shrink-0">
          <PaletteDropdown
            ariaLabel="Filter technology icons by provider"
            value={techProvider}
            onChange={(id) => setTechProvider(id as TechProvider | 'all')}
            align="left"
            accent={techProvider !== 'all'}
            options={techFilters}
            triggerLeading={
              <svg
                width="12"
                height="12"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
                className="shrink-0"
              >
                <path d="M2 4h12M4.5 8h7M7 12h2" />
              </svg>
            }
          />
        </div>
      </div>
      {/* Three per row (two fewer than the line-art Icons grid) so
                    each tile is big enough to read the brand glyph + caption —
                    the brand glyphs aren't self-explanatory the way a labelled
                    line icon's shape is, so the name sits beneath each one. */}
      <div className="grid max-h-72 grid-cols-3 justify-items-stretch gap-1 overflow-y-auto overflow-x-hidden">
        {techResults.map((icon) => (
          <IconButton
            key={icon.id}
            label={`Add ${icon.label}`}
            caption={icon.short ?? icon.label}
            description="Click to add, or drag onto the canvas."
            hideTooltip
            onClick={() => addTechIcon(icon.id)}
            noTint
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData(TECH_ICON_DND_MIME, icon.id);
              e.dataTransfer.effectAllowed = 'copy';
            }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden>
              <TechIconArt iconId={icon.id} />
            </svg>
          </IconButton>
        ))}
        {techResults.length === 0 ? (
          <p className="col-span-4 px-1 py-2 text-center text-[11px] text-slate-400">
            {/* While the catalogue chunk is loading, an empty grid means
                "data not here yet", not "your search found nothing". */}
            {loading ? 'Loading icons…' : `No technology icons match “${techQuery}”.`}
          </p>
        ) : null}
      </div>
    </>
  );
}
