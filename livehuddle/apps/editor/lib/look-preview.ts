// A look's card preview (docs/specs/011-theme/canvas-and-theme-dialog.md "Looks"): a tiny Space drawn in the look
// (theme colours, finish, font, canvas colour and floor) by the tab exporter, so the card shows exactly what the tab
// will. The scene is a slice of floor with a small room on it (walls, a door, a desk and its chair, a plant) and a
// sticky note beside it. Several cards share one page, so the exporter's fixed pattern id is made unique per look.
import {
  createShape,
  createSticky,
  roomWithDoorPiece,
  type Element,
  type ShapeElement,
  type ShapeKind,
  type Tab,
} from '@livehuddle/document';
import { getResolvedAppearance } from '@livehuddle/ui';
import { renderTabToSvg } from '@/lib/export-tab';
import { withLookApplied, type TabLook } from '@/lib/tab-looks';

const EXPORT_PATTERN_ID = 'lvd-export-bg';
const ID = 'look-preview-';

/** A piece at (x, y), `w` wide with its drawing's proportion kept (the office drawings are aspect locked). */
function piece(kind: ShapeKind, x: number, y: number, w: number): ShapeElement {
  const base = createShape(kind, x, y);
  return {
    ...base,
    id: `${ID}${kind}`,
    width: w,
    height: Math.round((w * base.height) / base.width),
  };
}

// A multi-colour theme colours each loose piece as its own branch, in drawing order, so the room takes the palette's
// first colour, the door its second and the desk its third: a multi-colour card shows the palette's run rather than
// the trunk neutral. The sticky keeps its own yellow, as a sticky
// does under every theme. A single-colour or per-shape theme paints every piece alike.
//
// Fixed ids and sizes, so the Sketch wobble is the same every time and every card lays out alike.
function scene(): Element[] {
  const { room, door } = roomWithDoorPiece({
    ...createShape('room', 0, 0),
    id: `${ID}room`,
    width: 250,
    height: 180,
    label: 'Huddle',
    roomDoor: 'e',
  });
  const note = {
    ...createSticky(290, 96),
    id: `${ID}sticky`,
    width: 128,
    height: 80,
    label: 'Stand-up at ten',
    textSize: 'md',
  } as Element;
  return [
    room,
    ...(door ? [{ ...door, id: `${ID}door` }] : []),
    piece('desk', 40, 38, 116),
    piece('plant', 184, 30, 44),
    note,
  ];
}

// Built once per look and half, so reopening the dialog (or a card asking for its paper and its markup) never draws a
// card twice. Keyed by the look object, so a rolled Mashup's entry goes with it.
type Built = { tab?: Tab; svg?: string };
const built = { light: new WeakMap<TabLook, Built>(), dark: new WeakMap<TabLook, Built>() };

function entry(look: TabLook): Built {
  const cache = built[getResolvedAppearance()];
  let hit = cache.get(look);
  if (!hit) cache.set(look, (hit = {}));
  return hit;
}

/** The tiny Space with the look applied, as a tab of its own. */
export function lookPreviewTab(look: TabLook): Tab {
  const hit = entry(look);
  hit.tab ??= withLookApplied({ id: `look-${look.id}`, name: look.label, elements: scene() }, look);
  return hit.tab;
}

// The card is wider or narrower than the scene on different screens, and the SVG letterboxes it (it keeps its
// proportion, centred). The canvas colour and the floor bleed this far past the scene on every side (a share of its
// size), so the letterbox shows floor, never a bare band. The view closes in by INSET of the exporter's padding, so
// the scene fills more of a card only 80 px tall.
const BLEED = 1;
const INSET = 12;

/** The canvas colour and floor rects, which the exporter sizes to the scene's viewBox, stretched past it by BLEED,
 *  and the view closed in by INSET. */
function bleedBackdrop(svg: string): string {
  const box = /viewBox="([-\d.]+) ([-\d.]+) ([-\d.]+) ([-\d.]+)"/.exec(svg);
  if (!box) return svg;
  const [, x, y, w, h] = box as unknown as [string, string, string, string, string];
  const [bx, by] = [Number(w) * BLEED, Number(h) * BLEED];
  const r = (n: number) => String(Math.round(n));
  const [vw, vh] = [r(Number(w) - 2 * INSET), r(Number(h) - 2 * INSET)];
  return svg
    .split(`x="${x}" y="${y}" width="${w}" height="${h}"`)
    .join(
      `x="${r(Number(x) - bx)}" y="${r(Number(y) - by)}" width="${r(Number(w) + 2 * bx)}" height="${r(Number(h) + 2 * by)}"`,
    )
    .replace(
      /^<svg([^>]*?) width="[-\d.]+" height="[-\d.]+" viewBox="[^"]+"/,
      `<svg$1 width="${vw}" height="${vh}" viewBox="${r(Number(x) + INSET)} ${r(Number(y) + INSET)} ${vw} ${vh}"`,
    );
}

/** The look's card preview as SVG markup, its ids scoped to the look. */
export function lookPreviewSvg(look: TabLook): string {
  const hit = entry(look);
  hit.svg ??= bleedBackdrop(renderTabToSvg(lookPreviewTab(look)))
    .split(EXPORT_PATTERN_ID)
    .join(`lvd-look-${look.id}-bg`);
  return hit.svg;
}
