import { galleryStructure } from '@/lib/template-gallery';

// A knowledgebase structure drawn small (docs/specs/019-marketing/marketing-site.md "Structure" 3): its page tree as
// a sidebar in miniature, each top page a row with a page mark and a bar as long as its title, its subpages indented
// under it. A folded group's tile fans three of these (the shared band's DeferredPreviewFan), so a group shows the
// shape of what it holds, never a picture of a page. Light canvas art, re-lit in dark by the plate it sits on
// (preview-art-tile). Blank Knowledgebase (any id no structure has) is its one page, Start Here.

const W = 72;
const ROW = 6;
const MAX_ROWS = 7;

type Row = { depth: 0 | 1; chars: number };

function rowsOf(kind: string): Row[] {
  const structure = galleryStructure(kind);
  if (!structure) return [{ depth: 0, chars: 'Start Here'.length }];
  const rows: Row[] = [];
  for (const line of structure.outline.lines) {
    rows.push({ depth: 0, chars: line.title.length });
    for (const sub of line.under.slice(0, 2)) rows.push({ depth: 1, chars: sub.length });
  }
  return rows.slice(0, MAX_ROWS);
}

export function StructurePreview({ kind }: { kind: string }) {
  const rows = rowsOf(kind);
  const h = rows.length * ROW + 6;
  return (
    <svg viewBox={`0 0 ${W} ${h}`} width={W} height={h} aria-hidden focusable="false">
      {rows.map((row, i) => {
        const y = 3 + i * ROW;
        const x = 6 + row.depth * 8;
        const bar = Math.min(W - x - 12, 8 + row.chars * 1.6);
        return (
          <g key={i}>
            {row.depth === 1 ? (
              <path
                d={`M${x - 4} ${y - 2}V${y + 2}H${x - 1}`}
                fill="none"
                className="stroke-slate-300"
              />
            ) : null}
            <rect
              x={x}
              y={y}
              width={4}
              height={4}
              rx={1}
              className={row.depth === 0 ? 'fill-brand-500' : 'fill-brand-200'}
            />
            <rect
              x={x + 6}
              y={y + 0.75}
              width={bar}
              height={2.5}
              rx={1.25}
              className={row.depth === 0 ? 'fill-slate-700' : 'fill-slate-400'}
            />
          </g>
        );
      })}
    </svg>
  );
}
