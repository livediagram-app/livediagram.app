import {
  TECH_ICON_DND_MIME,
  TECH_PROVIDERS,
  searchTechIcons,
  type TechIconDef,
} from '@/lib/tech-icons';
import { IconButton } from '@/components/palette/palette-controls';
import { TechIconArt } from '@/components/primitives/tech-icon-glyph';
import { PaletteCategoryBrowser } from '@/components/palette/PaletteCategoryBrowser';

type TechPickerTabProps = {
  addTechIcon: (iconId: string) => void;
  techQuery: string;
  setTechQuery: (q: string) => void;
  // Every brand mark matching the query, across all providers. The tab
  // derives its per-provider slices itself.
  techResults: TechIconDef[];
  // True while the async icon-catalogue chunk (lib/icon-registry.ts) is still
  // in flight — the grid is empty then, so show a loading note instead of the
  // misleading "no matches" empty state.
  loading?: boolean;
};

// The command palette's Technology tab (spec/41, spec/109): brand / tech marks
// browsed by provider, using the same drill-in navigation as Tools and Icons.
// Clicking one drops it as a fixed-colour tech-icon shape; each is also
// drag-droppable.
export function TechPickerTab({
  addTechIcon,
  techQuery,
  setTechQuery,
  techResults,
  loading = false,
}: TechPickerTabProps) {
  // A provider is a category. Its artwork is its first mark, so the tile
  // carries the brand's own colours rather than a generic glyph.
  const categories = TECH_PROVIDERS.map((provider) => {
    const items = searchTechIcons('', provider.id);
    const first = items[0];
    return {
      id: provider.id,
      label: provider.label,
      // No description: "AWS" and "Azure" are the whole answer.
      icon: first ? (
        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
          <TechIconArt iconId={first.id} />
        </svg>
      ) : null,
      items,
    };
  });
  return (
    <PaletteCategoryBrowser
      root="Tech"
      categories={categories}
      // The parent already searched every provider for this query.
      search={() => techResults}
      renderItems={(icons) => (
        // Three per row (two fewer than the line-art Icons grid) so each tile
        // is big enough to read the brand glyph + caption — the brand glyphs
        // aren't self-explanatory the way a labelled line icon's shape is, so
        // the name sits beneath each one.
        <div className="grid max-h-72 grid-cols-3 justify-items-stretch gap-1 overflow-y-auto overflow-x-hidden">
          {icons.map((icon) => (
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
        </div>
      )}
      query={techQuery}
      onQueryChange={setTechQuery}
      searchInput={{
        placeholder: 'Search tech',
        ariaLabel: 'Search technology icons',
        clearAriaLabel: 'Clear technology search',
        clearDescription: 'Clear the technology search query.',
      }}
      telemetry={{ openedType: 'TechGroup', searchedType: 'TechSearch' }}
      emptyMessage={(q) => `No technology icons match “${q}”.`}
      loading={loading}
      loadingMessage="Loading icons…"
    />
  );
}
