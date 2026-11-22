import { BLANK_EMBLEM, GROUP_TONES, Prims, STRUCTURE_EMBLEMS } from '@liveknowledge/ui';
import { galleryStructure, type GalleryStructure } from '@/lib/template-gallery';

// A knowledgebase structure drawn small (docs/specs/019-marketing/marketing-site.md "Structure" 3): the window its
// card draws (StructureArt, docs/specs/030-knowledgebase/describe-to-set-up.md "A card's picture") at the size of a
// fanned card, with no words: its page tree as bars, the first page with subpages chosen and opened, and that page
// with a cover in its group's colour and its emblem for its icon. A folded group's tile fans three of these (the
// shared band's DeferredPreviewFan), so a group shows its colour and what its structures are about. Light canvas
// art, re-lit in dark by the plate it sits on (preview-art-tile), which keeps its hues. Blank Knowledgebase (any id
// no structure has) is its one page, Start Here, with no cover and a plus for its icon.

const W = 80;
const H = 52;
const SIDE = 26;
const ROW = 6.5;
const MAX_ROWS = 6;
const SLATE = '#475569';

type Row = { depth: 0 | 1; chars: number; chosen: boolean };

function rowsOf(pages: GalleryStructure['pages']): Row[] {
  const open = Math.max(
    0,
    pages.findIndex((p) => p.pages.length > 0),
  );
  const rows: Row[] = [];
  pages.forEach((page, i) => {
    rows.push({ depth: 0, chars: page.title.length, chosen: i === open });
    if (i === open)
      for (const sub of page.pages.slice(0, 2))
        rows.push({ depth: 1, chars: sub.title.length, chosen: false });
  });
  return rows.slice(0, MAX_ROWS);
}

export function StructurePreview({ kind }: { kind: string }) {
  const structure = galleryStructure(kind);
  const tone = structure ? GROUP_TONES[structure.group] : undefined;
  const rows: Row[] = structure
    ? rowsOf(structure.pages)
    : [{ depth: 0, chars: 'Start Here'.length, chosen: true }];
  const ink = tone?.[600] ?? SLATE;
  const grad = `structure-preview-${kind}`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} aria-hidden focusable="false">
      {/* The tree, its chosen row tinted. */}
      <rect width={SIDE} height={H} className="fill-slate-50" />
      <path d={`M${SIDE} 0V${H}`} className="stroke-slate-200" strokeWidth={0.5} />
      {rows.map((row, i) => {
        const y = 4 + i * ROW;
        const x = 3 + row.depth * 4;
        return (
          <g key={i}>
            {row.chosen ? (
              <rect
                x={1.5}
                y={y - 1.25}
                width={SIDE - 3}
                height={5}
                rx={1.25}
                fill={tone?.[100] ?? '#e2e8f0'}
              />
            ) : null}
            <rect
              x={x}
              y={y}
              width={Math.min(SIDE - x - 3, 4 + row.chars * 0.75)}
              height={2.5}
              rx={1.25}
              fill={row.chosen ? ink : '#94a3b8'}
            />
          </g>
        );
      })}
      {/* The chosen page: its cover (none yet on a blank one), its emblem over the cover's foot, its title and
          writing. */}
      {tone ? (
        <>
          <linearGradient id={grad} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={tone[300]} />
            <stop offset="1" stopColor={tone[600]} />
          </linearGradient>
          <rect x={SIDE + 0.25} width={W - SIDE} height={14} fill={`url(#${grad})`} />
        </>
      ) : (
        <path
          d={`M${SIDE} 14H${W}`}
          className="stroke-slate-300"
          strokeWidth={0.5}
          strokeDasharray="1.5 1.5"
        />
      )}
      <rect
        x={SIDE + 4}
        y={8.5}
        width={11}
        height={11}
        rx={3}
        className="fill-white stroke-slate-200"
        strokeWidth={0.5}
      />
      <g
        transform={`translate(${SIDE + 5.5} 10) scale(${8 / 24})`}
        fill="none"
        stroke={ink}
        strokeWidth={2.25}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <Prims prims={(structure && STRUCTURE_EMBLEMS[kind]) || BLANK_EMBLEM} />
      </g>
      <rect x={SIDE + 4} y={24} width={26} height={3.5} rx={1.75} className="fill-slate-700" />
      {structure ? (
        <>
          <rect x={SIDE + 4} y={31} width={18} height={2.5} rx={1.25} fill={ink} />
          <rect
            x={SIDE + 4}
            y={37}
            width={W - SIDE - 9}
            height={2.5}
            rx={1.25}
            className="fill-slate-200"
          />
          <rect
            x={SIDE + 4}
            y={42}
            width={W - SIDE - 16}
            height={2.5}
            rx={1.25}
            className="fill-slate-200"
          />
        </>
      ) : null}
    </svg>
  );
}
