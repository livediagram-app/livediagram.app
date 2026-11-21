// Bring Everything With You: three ways in (a Markdown folder, a Notion export, a Confluence export), the
// knowledgebase they become, and three ways out (Markdown, PDF, Word).
import { Cube, LIME } from '../iso-cube';
import { ArtPanel, Board, Card, INK, Label, T, at } from './kit';

type Tile = { title: string; detail: string; glyph: 'folder' | 'archive' | 'file'; tag?: string };

// What the Import dialog takes. Notion and Confluence are named in words under a generic glyph, never a logo.
const SOURCES: readonly Tile[] = [
  { title: 'Markdown Folder', detail: 'A folder or a .zip', glyph: 'folder' },
  { title: 'Notion', detail: 'Its Markdown export', glyph: 'archive' },
  { title: 'Confluence', detail: "A space's HTML export", glyph: 'archive' },
];
// What Export writes.
const FORMATS: readonly Tile[] = [
  { title: 'Markdown', detail: 'Links kept relative', glyph: 'file', tag: 'MD' },
  { title: 'PDF', detail: 'Paginated for print', glyph: 'file', tag: 'PDF' },
  { title: 'Word', detail: 'An editable .docx', glyph: 'file', tag: 'DOC' },
];

const TILE = { w: 168, h: 62 };
const TILE_TOPS = [52, 159, 266];
const TINT = 'fill-brand-100 dark:fill-brand-900';
const LINE = 'fill-none stroke-brand-700 dark:stroke-brand-300';

function Glyph({ x, y, tile }: { x: number; y: number; tile: Tile }) {
  return (
    <>
      <rect x={x} y={y} width={34} height={34} rx={9} className={TINT} />
      {tile.glyph === 'folder' ? (
        <path
          d={`M${x + 8} ${y + 12} h7 l3 3 h8 v9 h-18 z`}
          strokeWidth={1.6}
          strokeLinejoin="round"
          className={LINE}
        />
      ) : tile.glyph === 'archive' ? (
        <path
          d={`M${x + 9} ${y + 9} h16 v16 h-16 z M${x + 17} ${y + 9} v3 M${x + 17} ${y + 14} v3 M${x + 17} ${y + 19} v3`}
          strokeWidth={1.6}
          strokeLinejoin="round"
          strokeLinecap="round"
          className={LINE}
        />
      ) : (
        <text
          x={x + 17}
          y={y + 21}
          fontSize={9.5}
          fontWeight={800}
          textAnchor="middle"
          className="fill-brand-800 dark:fill-brand-200"
        >
          {tile.tag}
        </text>
      )}
    </>
  );
}

function Tiles({ x, tiles }: { x: number; tiles: readonly Tile[] }) {
  return (
    <>
      {tiles.map((tile, i) => {
        const y = TILE_TOPS[i]!;
        return (
          <Card key={tile.title} x={x} y={y} w={TILE.w} h={TILE.h}>
            <Glyph x={x + 12} y={y + 14} tile={tile} />
            <T x={x + 56} y={y + 28} size={12} weight={700}>
              {tile.title}
            </T>
            <T x={x + 56} y={y + 44} size={9.5} tone="quiet">
              {tile.detail}
            </T>
          </Card>
        );
      })}
    </>
  );
}

// A dashed line whose dashes run from one end to the other (the kit's fa-flow loop).
function Flow({ d }: { d: string }) {
  return (
    <path
      d={d}
      strokeWidth={2}
      strokeLinecap="round"
      className="fa-flow fill-none stroke-brand-600 dark:stroke-brand-400"
    />
  );
}

export function ImportExportArt() {
  return (
    <ArtPanel>
      <Board>
        <Label x={14} y={36}>
          IMPORT
        </Label>
        <Label x={338} y={36}>
          EXPORT
        </Label>

        {/* In from the left, out to the right, each line meeting the knowledgebase at its middle. */}
        {TILE_TOPS.map((top) => (
          <g key={top} className="kb-in" style={at(0.3 + TILE_TOPS.indexOf(top) * 0.3)}>
            <Flow d={`M${14 + TILE.w + 5} ${top + 31} C 198 ${top + 31}, 190 197, 204 197`} />
            <Flow d={`M316 197 C 330 197, 322 ${top + 31}, 333 ${top + 31}`} />
          </g>
        ))}

        <Tiles x={14} tiles={SOURCES} />
        <Tiles x={338} tiles={FORMATS} />

        {/* The knowledgebase they land in: reviewed before anything is imported. */}
        <Card x={204} y={104} w={112} h={186}>
          <Cube cx={260} cy={176} half={30} height={36} shades={LIME}>
            <g
              transform="matrix(1 0.5 0 1 230 140)"
              strokeWidth={3.5}
              strokeLinecap="round"
              className="stroke-white/90"
            >
              <path d="M7 11 H23 M7 20 H23 M7 29 H16" fill="none" />
            </g>
            <g
              transform="matrix(1 -0.5 0 1 260 155)"
              strokeWidth={4}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="stroke-brand-200"
            >
              <path d="M7 19 L13 26 L23 12" fill="none" />
            </g>
          </Cube>
          <T x={260} y={222} size={11} weight={700} anchor="middle">
            Knowledgebase
          </T>
          <T x={260} y={242} size={10.5} tone="quiet" anchor="middle">
            320 pages
          </T>
          <T x={260} y={257} size={10.5} tone="quiet" anchor="middle">
            41 pictures
          </T>
          <path d="M224 270 h72" strokeWidth={1.25} className={INK} opacity={0.15} />
        </Card>
      </Board>
    </ArtPanel>
  );
}
