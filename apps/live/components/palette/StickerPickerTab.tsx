import type { StickerDef } from '@livediagram/icons';
import { STICKER_CATEGORIES, STICKER_DND_MIME, stickersInCategory } from '@/lib/stickers';
import { StickerArt } from '@/components/canvas/StickerView';
import { PaletteCategoryBrowser } from '@/components/palette/PaletteCategoryBrowser';
import { Tooltip } from '@/components/primitives/Tooltip';

// One sticker in the picker, drawn as the sticker it actually is — plate,
// shadow and all — rather than as a glyph on a palette button (spec/116). The
// tile IS the artwork, so what you click is exactly what lands.
//
// Deliberately not IconButton: that draws a themed, tinted, captioned tile,
// and every one of those treatments is wrong for a sticker. It keeps a
// tooltip, though — 220 small pictures can't tell you "Pleading face" from
// "Weary face" on their own.
function StickerTile({ sticker, onAdd }: { sticker: StickerDef; onAdd: (id: string) => void }) {
  // A badge pill takes two of the four columns: at one column's width its word
  // would be unreadable. The span lives on THIS wrapper, not on the button —
  // Tooltip wraps its child, so the button is a grandchild of the grid and a
  // col-span on it would do nothing.
  const wide = sticker.kind === 'badge';
  return (
    <div className={wide ? 'col-span-2 w-full' : ''}>
      <Tooltip title={sticker.label} description="Click to add, or drag it onto the canvas.">
        <button
          type="button"
          aria-label={sticker.label}
          onClick={() => onAdd(sticker.id)}
          draggable
          onDragStart={(e) => {
            e.dataTransfer.setData(STICKER_DND_MIME, sticker.id);
            e.dataTransfer.effectAllowed = 'copy';
          }}
          className={`flex items-center justify-center rounded-lg p-0.5 transition hover:bg-slate-100 dark:hover:bg-slate-800 ${
            wide ? 'h-11 w-full' : 'h-11 w-11'
          }`}
        >
          <StickerArt def={sticker} className="h-full w-full overflow-visible" />
        </button>
      </Tooltip>
    </div>
  );
}

// The palette's Stickers category (spec/116): the drill-in browse every
// catalogue tab uses (spec/109), over the sticker catalogue. Eleven groups —
// Badges first, then Reactions, Feelings, Status, Direction, Celebrate,
// Decorate, Meeting, Work, People, Fun — with search across all of them.
export function StickerPickerTab({
  addSticker,
  stickerQuery,
  setStickerQuery,
  stickerResults,
  loading = false,
}: {
  addSticker: (stickerId: string) => void;
  stickerQuery: string;
  setStickerQuery: (q: string) => void;
  // Every sticker matching the query, across all groups. The tab derives its
  // per-group slices itself from STICKER_CATEGORIES.
  stickerResults: StickerDef[];
  // True while the async catalogue chunk is still in flight — the grid is
  // empty then, so show a loading note rather than a false "no matches".
  loading?: boolean;
}) {
  // Group artwork = the group's first sticker, the same "a category looks like
  // what it holds" rule the Icons and Tools tabs follow.
  const categories = STICKER_CATEGORIES.map((cat) => {
    const items = stickersInCategory(cat.id);
    const first = items[0];
    return {
      id: cat.id,
      label: cat.label,
      icon: first ? (
        <StickerArt def={first} className="h-[22px] w-[22px] overflow-visible" />
      ) : null,
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
        // Four columns, with a badge spanning two of them — a word pill at
        // one column's width would be unreadable, and a separate grid per
        // flavour would break the "search shows you everything at once" rule.
        <div className="grid max-h-72 grid-cols-4 items-center justify-items-center gap-1 overflow-y-auto overflow-x-hidden">
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
