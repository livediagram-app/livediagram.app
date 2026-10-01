// A decoded board to a board scene (docs/specs/020-import-export/whiteboard-import.md "Mapping"):
// every element to scene items back to front, colours light-reference, nothing silent.
import type {
  BoardScene,
  SceneAsset,
  SceneColour,
  SceneItem,
  SceneNote,
  SceneText,
} from '@/lib/board-scene/scene';
import { appearanceOf, lineColour } from './colours';
import type { WbBoard, WbElement, WbText } from './elements';
import { inkToScene, type InkNotes } from './ink-scene';

// Ink-to-shape polygons have no stored width; Whiteboard draws them with its default pen.
export const POLYGON_WIDTH_PX = 4;

export const RULES = {
  rainbow: 'Rainbow ink drawn in pink',
  galaxy: 'Galaxy ink drawn in violet',
  tables: 'Tables became rectangles',
  invisible: "Strokes drawn in the board's own colour were left out",
  unreadable: "Pen strokes that couldn't be read were skipped",
  unsupported: 'Unsupported Whiteboard items were skipped',
  missingImages: 'Images missing from the export were skipped',
} as const;

export type BoardImage = { bytes: Uint8Array; mimeType: string };

export type SceneInput = {
  board: WbBoard;
  title?: string;
  sourceId?: string;
  /** Image object ids by the image node they fill (the replay's `imageObjects`). */
  imageObjects: ReadonlyMap<string, string>;
  /** The export's image files, by object id. */
  images: ReadonlyMap<string, BoardImage>;
};

/** The board as a scene. Pure: images arrive already read. */
export function boardToScene(input: SceneInput): BoardScene {
  const { board } = input;
  const appearance = appearanceOf(board.background);
  const inkNotes: InkNotes = { invisible: 0, unreadable: 0, rainbow: 0, galaxy: 0 };
  const ctx = {
    appearance,
    ...(board.background ? { background: board.background } : {}),
    notes: inkNotes,
  };
  const counts = { tables: 0, unsupported: 0, missingImages: 0 };
  const items: SceneItem[] = [];
  const assets = new Map<string, SceneAsset>();

  // Lines need the board's ink rule; boxes are seen against their own fill and keep theirs.
  const line = (c: SceneColour | undefined): SceneColour | 'ink' => {
    const resolved = lineColour(c ?? { hex: '#000000' }, appearance, board.background);
    return resolved === 'skip' ? 'ink' : resolved;
  };
  const text = (t: WbText, scale: number, centred: boolean): SceneText => ({
    text: t.text,
    fontPx: t.fontPx * scale,
    family: 'sans',
    colour: centred ? t.colour : line(t.colour),
    ...(centred ? { alignX: 'center' as const, alignY: 'middle' as const } : {}),
    ...(t.bold ? { bold: true } : {}),
  });
  const rotation = (deg: number) => (deg ? { rotationDeg: deg } : {});

  const add = (el: WbElement, key: string) => {
    switch (el.kind) {
      case 'ink':
        items.push(...inkToScene(el, key, ctx));
        return;
      case 'shape':
        items.push({
          key,
          kind: 'shape',
          shape: 'rectangle',
          x: el.x,
          y: el.y,
          width: el.width * el.scale,
          height: el.height * el.scale,
          stroke: el.border
            ? {
                colour: el.border,
                widthPx: el.borderWidth * el.scale,
                ...(el.dashed ? { dash: 'dashed' as const } : {}),
              }
            : null,
          ...(el.fill ? { fill: el.fill } : {}),
          ...(el.text ? { label: text(el.text, el.scale, true) } : {}),
          ...rotation(el.rotationDeg),
        });
        return;
      case 'sticky':
        items.push({
          key,
          kind: 'sticky',
          x: el.x,
          y: el.y,
          width: el.width * el.scale,
          height: el.height * el.scale,
          fill: el.fill,
          ...(el.text ? { text: text(el.text, el.scale, true) } : {}),
          ...rotation(el.rotationDeg),
        });
        return;
      case 'text': {
        const t = text(el.text, el.scale, false);
        const lines = el.text.text.split('\n');
        const longest = Math.max(...lines.map((l) => l.length));
        items.push({
          key,
          kind: 'text',
          x: el.x,
          y: el.y,
          // Without a fixed size the box hugs its text; this estimate is the landing's start.
          width: el.width ? el.width * el.scale : Math.max(1, longest * t.fontPx * 0.55),
          height: el.height ? el.height * el.scale : lines.length * t.fontPx * 1.25,
          autoWidth: !el.width,
          text: t,
          ...rotation(el.rotationDeg),
        });
        return;
      }
      case 'image': {
        const objectId = el.imageNodeId ? input.imageObjects.get(el.imageNodeId) : undefined;
        const image = objectId ? input.images.get(objectId) : undefined;
        if (!objectId || !image) {
          counts.missingImages++;
          return;
        }
        if (!assets.has(objectId))
          assets.set(objectId, {
            key: objectId,
            source: { kind: 'bytes', bytes: image.bytes, mimeType: image.mimeType },
          });
        items.push({
          key,
          kind: 'image',
          x: el.x,
          y: el.y,
          width: el.width * el.scale,
          height: el.height * el.scale,
          asset: objectId,
          ...rotation(el.rotationDeg),
        });
        return;
      }
      case 'polygon':
        if (el.corners.length < 2) {
          counts.unsupported++;
          return;
        }
        items.push({
          key,
          kind: 'polyline',
          points: el.corners.map((c) => ({ x: el.cx + c.x, y: el.cy + c.y })),
          closed: true,
          stroke: { colour: line(el.colour), widthPx: POLYGON_WIDTH_PX },
        });
        return;
      case 'line':
        items.push({
          key,
          kind: 'polyline',
          points: [el.from, el.to].map((p) => ({
            x: el.x + p.x * el.scale,
            y: el.y + p.y * el.scale,
          })),
          stroke: {
            colour: line(el.colour),
            widthPx: el.width * el.scale,
            ...(el.dashed ? { dash: 'dashed' as const } : {}),
          },
          ...(el.heads.start || el.heads.end
            ? {
                heads: {
                  ...(el.heads.start ? { start: 'arrow' as const } : {}),
                  ...(el.heads.end ? { end: 'arrow' as const } : {}),
                },
              }
            : {}),
        });
        return;
      case 'table': {
        counts.tables++;
        let top = el.y;
        el.rows.forEach((row, r) => {
          let left = el.x;
          el.columns.forEach((width, c) => {
            const cellKey = `${key}-${r}-${c}`;
            items.push({
              key: cellKey,
              kind: 'shape',
              shape: 'rectangle',
              x: left,
              y: top,
              width,
              height: row.height,
              stroke: { colour: el.colour ?? { hex: '#000000' }, widthPx: 2 },
            });
            (row.cells[c] ?? []).forEach((ink, i) =>
              items.push(
                ...inkToScene({ ...ink, x: left + ink.x, y: top + ink.y }, `${cellKey}-${i}`, ctx),
              ),
            );
            left += width;
          });
          top += row.height;
        });
        return;
      }
      case 'unknown':
        counts.unsupported++;
    }
  };
  board.elements.forEach((el, i) => add(el, `e${i}`));

  const notes: SceneNote[] = [];
  const note = (rule: string, count: number, kind: 'degraded' | 'skipped') => {
    if (count > 0) notes.push({ rule, count, kind });
  };
  note(RULES.rainbow, inkNotes.rainbow, 'degraded');
  note(RULES.galaxy, inkNotes.galaxy, 'degraded');
  note(RULES.tables, counts.tables, 'degraded');
  note(RULES.invisible, inkNotes.invisible, 'skipped');
  note(RULES.unreadable, inkNotes.unreadable, 'skipped');
  note(RULES.unsupported, counts.unsupported, 'skipped');
  note(RULES.missingImages, counts.missingImages, 'skipped');

  return {
    source: 'microsoft-whiteboard',
    ...(input.title ? { title: input.title } : {}),
    ...(input.sourceId ? { sourceId: input.sourceId } : {}),
    authoredOn: appearance,
    background: {
      appearance,
      pattern: board.pattern,
      ...(board.background ? { colour: board.background } : {}),
    },
    items,
    assets: [...assets.values()],
    notes,
  };
}
