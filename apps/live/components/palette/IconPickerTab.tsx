import { ICON_CATEGORIES, ICON_DND_MIME, iconsInCategory, type IconDef } from '@/lib/icons';
import { IconButton } from '@/components/palette/palette-controls';
import { IconPrims } from '@/components/primitives/icon-glyph';
import { PaletteCategoryBrowser } from '@/components/palette/PaletteCategoryBrowser';

type IconPickerTabProps = {
  addIcon: (iconId: string) => void;
  iconQuery: string;
  setIconQuery: (q: string) => void;
  // Every icon matching the query, across all categories. The tab derives its
  // per-category slices itself from ICON_CATEGORIES.
  iconResults: IconDef[];
  // True while the async icon-catalogue chunk (lib/icon-registry.ts) is still
  // in flight — the grid is empty then, so show a loading note instead of the
  // misleading "no icons match" empty state.
  loading?: boolean;
};

// One glyph, drawn small. Clicking adds it at the viewport centre as an 'icon'
// shape tinted by the element stroke; dragging drops it at the pointer, or
// onto a shape to become that shape's inline icon. See spec/09 "Icons".
function IconTile({ icon, onAdd }: { icon: IconDef; onAdd: (id: string) => void }) {
  return (
    <IconButton
      label={`Add ${icon.label}`}
      description="Click to add, or drag onto a shape to set its icon."
      hideTooltip
      hideCaption
      onClick={() => onAdd(icon.id)}
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
  );
}

// The command palette's Icons tab (spec/109): the same drill-in browse the
// Tools tab uses, over the line-art catalogue.
//
// It used to be one flat scroll of 183 glyphs behind a category-filter
// dropdown. The catalogue's own shape — that there IS a People set, a Charts
// set, a Furniture set — was hidden inside a control you had to open to read,
// and the default view was a wall you scrolled. The category tiles put that
// structure on screen; search still cuts across all of it.
//
// "All of it" is the LINE-ART catalogue: the colour emoji that used to sit
// here as an Emoji category are their own palette category now (spec/116), and
// the results this tab is handed are filtered to match.
export function IconPickerTab({
  addIcon,
  iconQuery,
  setIconQuery,
  iconResults,
  loading = false,
}: IconPickerTabProps) {
  // Category artwork = the category's first glyph, mirroring the Tools tab's
  // "a category looks like what it holds".
  const categories = ICON_CATEGORIES.map((cat) => {
    const items = iconsInCategory(cat.id);
    const first = items[0];
    return {
      id: cat.id,
      label: cat.label,
      // No description: "People" and "Arrows" say what they hold, and a
      // tooltip restating the label would just be a delay.
      icon: first ? (
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
          <IconPrims iconId={first.id} />
        </svg>
      ) : null,
      items,
    };
  });
  return (
    <PaletteCategoryBrowser
      root="Icons"
      categories={categories}
      // The parent already searched the whole catalogue for this query, so
      // the results come back rather than being recomputed here.
      search={() => iconResults}
      renderItems={(icons) => (
        // overflow-x-hidden: a vertical scrollbar narrows the row enough that
        // five fixed-width tiles overflow by a few px, and `overflow-y-auto`
        // would otherwise also surface a horizontal scrollbar (CSS resolves
        // the other axis to auto). justify-items-center keeps the slack
        // symmetric so nothing visible clips.
        <div className="grid max-h-72 grid-cols-5 justify-items-center gap-1 overflow-y-auto overflow-x-hidden">
          {icons.map((icon) => (
            <IconTile key={icon.id} icon={icon} onAdd={addIcon} />
          ))}
        </div>
      )}
      query={iconQuery}
      onQueryChange={setIconQuery}
      searchInput={{
        placeholder: 'Search icons',
        ariaLabel: 'Search icons',
        clearAriaLabel: 'Clear icon search',
        clearDescription: 'Clear the icon search query.',
      }}
      telemetry={{ openedType: 'IconGroup', searchedType: 'IconSearch' }}
      emptyMessage={(q) => `No icons match “${q}”.`}
      loading={loading}
      loadingMessage="Loading icons…"
    />
  );
}
