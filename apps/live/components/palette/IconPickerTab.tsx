import { ICON_DND_MIME, type IconDef } from '@/lib/icons';
import { IconButton } from '@/components/palette/palette-controls';
import { IconPrims } from '@/components/primitives/icon-glyph';
import { PaletteDropdown } from '@/components/palette/PaletteDropdown';
import { PaletteSearchInput } from '@/components/palette/PaletteSearchInput';

type IconPickerTabProps = {
  addIcon: (iconId: string) => void;
  iconQuery: string;
  setIconQuery: (q: string) => void;
  iconCategory: string;
  setIconCategory: (c: string) => void;
  iconFilters: { id: string; label: string }[];
  iconResults: IconDef[];
  // True while the async icon-catalogue chunk (lib/icon-registry.ts) is still
  // in flight — the grid is empty then, so show a loading note instead of the
  // misleading "no icons match" empty state.
  loading?: boolean;
};

// The command palette's Icons tab: a searchable, category-filtered catalogue
// of single-colour glyphs. Clicking one drops it at the viewport centre as an
// 'icon' shape tinted by the element stroke; each is also drag-droppable.
// Split out of CommandPalette.
export function IconPickerTab({
  addIcon,
  iconQuery,
  setIconQuery,
  iconCategory,
  setIconCategory,
  iconFilters,
  iconResults,
  loading = false,
}: IconPickerTabProps) {
  return (
    <>
      {/* Searchable catalogue of single-colour glyphs. Clicking one
            drops it at the viewport centre as an 'icon' shape tinted
            by the element's stroke colour. See spec/09 "Icons". */}
      {/* Filter dropdown sits LEFT of the search (flex-row-reverse) so
                    it doesn't stack under the category picker at the top-right. */}
      <div className="relative mb-2 flex flex-row-reverse items-center gap-1.5">
        <PaletteSearchInput
          value={iconQuery}
          onChange={setIconQuery}
          placeholder="Search icons"
          ariaLabel="Search icons"
          clearAriaLabel="Clear icon search"
          clearDescription="Clear the icon search query."
        />
        {/* Category filter dropdown (replaces the chip row): pick one
                      category to narrow the grid; "All" clears it. */}
        <div className="shrink-0">
          <PaletteDropdown
            ariaLabel="Filter icons by category"
            value={iconCategory}
            onChange={setIconCategory}
            align="left"
            accent={iconCategory !== 'all'}
            options={iconFilters}
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
      {/* overflow-x-hidden: a vertical scrollbar narrows the row
                    enough that six fixed-width tiles overflow by a few px,
                    and `overflow-y-auto` would otherwise also surface a
                    horizontal scrollbar (CSS resolves the other axis to
                    auto). justify-items-center keeps the slack symmetric so
                    nothing visible clips. */}
      <div className="grid max-h-72 grid-cols-5 justify-items-center gap-1 overflow-y-auto overflow-x-hidden">
        {iconResults.map((icon) => (
          <IconButton
            key={icon.id}
            label={`Add ${icon.label}`}
            description={`Click to add, or drag onto a shape to set its icon.`}
            hideTooltip
            hideCaption
            onClick={() => addIcon(icon.id)}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData(ICON_DND_MIME, icon.id);
              e.dataTransfer.effectAllowed = 'copy';
            }}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <IconPrims iconId={icon.id} />
            </svg>
          </IconButton>
        ))}
        {iconResults.length === 0 ? (
          <p className="col-span-6 px-1 py-2 text-center text-[11px] text-slate-400">
            {/* While the catalogue chunk is loading, an empty grid means
                "data not here yet", not "your search found nothing". */}
            {loading ? 'Loading icons…' : `No icons match “${iconQuery}”.`}
          </p>
        ) : null}
      </div>
    </>
  );
}
