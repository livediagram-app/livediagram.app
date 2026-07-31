import { ICON_DND_MIME, type IconDef } from '@/lib/icons';
import { STICKER_CATEGORIES, stickersInCategory } from '@/lib/stickers';
import { IconButton } from '@/components/palette/palette-controls';
import { IconPrims } from '@/components/primitives/icon-glyph';
import { PaletteCategoryBrowser } from '@/components/palette/PaletteCategoryBrowser';

// Stickers draw bigger than the Icons tab's 18px glyphs (spec/113): a line-art
// icon is a shape you read from its outline and survives being small, while a
// sticker is a tiny illustration — 😌 against 😔 at 18px is a guess. 24px in a
// 4-column grid, against the icon grid's 18px in 5.
const STICKER_GLYPH_PX = 24;

function StickerGlyph({ iconId, size }: { iconId: string; size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <IconPrims iconId={iconId} />
    </svg>
  );
}

// One sticker. Same add / drag behaviour as an icon tile, because a sticker IS
// an icon (spec/113): click drops it on the canvas, dragging it onto a shape
// makes it that shape's inline glyph — which is what a status sticker wants.
//
// Unlike the icon grid this keeps its tooltip: "Pleading face" vs "Weary face"
// is exactly the thing 190 small pictures can't tell you on their own.
function StickerTile({ sticker, onAdd }: { sticker: IconDef; onAdd: (id: string) => void }) {
  return (
    <IconButton
      label={sticker.label}
      description="Click to add, or drag onto a shape to set its icon."
      hideCaption
      onClick={() => onAdd(sticker.id)}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData(ICON_DND_MIME, sticker.id);
        e.dataTransfer.effectAllowed = 'copy';
      }}
    >
      <StickerGlyph iconId={sticker.id} size={STICKER_GLYPH_PX} />
    </IconButton>
  );
}

// The palette's Stickers category (spec/113): the drill-in browse every
// catalogue tab uses (spec/109), over the colour-emoji half of the icon
// catalogue. Ten groups — Reactions, Feelings, Status, Direction, Celebrate,
// Decorate, Meeting, Work, People, Fun — with search across all of them.
export function StickerPickerTab({
  addSticker,
  stickerQuery,
  setStickerQuery,
  stickerResults,
  loading = false,
}: {
  addSticker: (iconId: string) => void;
  stickerQuery: string;
  setStickerQuery: (q: string) => void;
  // Every sticker matching the query, across all groups. The tab derives its
  // per-group slices itself from STICKER_CATEGORIES.
  stickerResults: IconDef[];
  // True while the async icon-catalogue chunk is still in flight — the grid is
  // empty then, so show a loading note rather than a false "no matches".
  loading?: boolean;
}) {
  // Group artwork = the group's first sticker, the same "a category looks like
  // what it holds" rule the Icons and Tools tabs follow. Drawn a shade smaller
  // than a tile glyph so the label under it stays the loudest thing in a
  // category tile.
  const categories = STICKER_CATEGORIES.map((cat) => {
    const items = stickersInCategory(cat.id);
    const first = items[0];
    return {
      id: cat.id,
      label: cat.label,
      icon: first ? <StickerGlyph iconId={first.id} size={20} /> : null,
      items,
    };
  });
  return (
    <PaletteCategoryBrowser
      root="Stickers"
      categories={categories}
      // The parent already searched every sticker for this query, so results
      // come back rather than being recomputed here.
      search={() => stickerResults}
      renderItems={(stickers) => (
        // Four across rather than the icon grid's five: the tiles are wider
        // because the glyphs are. overflow-x-hidden for the same reason as the
        // icon grid — a vertical scrollbar would otherwise surface a
        // horizontal one too.
        <div className="grid max-h-72 grid-cols-4 justify-items-center gap-1 overflow-y-auto overflow-x-hidden">
          {stickers.map((sticker) => (
            <StickerTile key={sticker.id} sticker={sticker} onAdd={addSticker} />
          ))}
        </div>
      )}
      query={stickerQuery}
      onQueryChange={setStickerQuery}
      searchInput={{
        placeholder: 'Search stickers',
        ariaLabel: 'Search stickers',
        clearAriaLabel: 'Clear sticker search',
        clearDescription: 'Clear the sticker search query.',
      }}
      telemetry={{ openedType: 'StickerGroup', searchedType: 'StickerSearch' }}
      emptyMessage={(q) => `No stickers match “${q}”.`}
      loading={loading}
      loadingMessage="Loading stickers…"
    />
  );
}
