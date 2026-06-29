import { type ReactNode } from 'react';

/* ───────────────────────────── Sketches ──────────────────────────────
 * Small abstract motifs per use case, built from the same brand-blue
 * shape/arrow vocabulary as the rest of the site. Drawn into a 200x120
 * viewBox and scaled by the container, so the same sketch reads at both
 * featured and thumbnail sizes. */

export type SketchKind =
  | 'flowchart'
  | 'architecture'
  | 'mindmap'
  | 'orgchart'
  | 'kanban'
  | 'retro'
  | 'wireframe'
  | 'journey'
  | 'timeline'
  | 'fishbone'
  | 'moodboard'
  | 'swot'
  | 'matrix'
  | 'gantt'
  | 'venn'
  | 'erd'
  | 'sequence';

const FILL = '#1e3a5f';
const STROKE = '#38bdf8';
const SOFT = '#0ea5e9';

export function Sketch({ kind, featured = false }: { kind: SketchKind; featured?: boolean }) {
  return (
    <svg
      viewBox="0 0 200 120"
      className={featured ? 'h-full max-h-44 w-full' : 'h-full w-full'}
      preserveAspectRatio="xMidYMid meet"
      aria-hidden
    >
      <g fill={FILL} stroke={STROKE} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round">
        {SKETCHES[kind]}
      </g>
    </svg>
  );
}

const SKETCHES: Record<SketchKind, ReactNode> = {
  flowchart: (
    <>
      <rect x="78" y="8" width="44" height="20" rx="10" />
      <rect x="78" y="50" width="44" height="20" rx="3" />
      <polygon points="100,82 124,100 100,118 76,100" />
      <path d="M100 28 L100 50 M94 44 L100 50 L106 44" fill="none" />
      <path d="M100 70 L100 82 M94 76 L100 82 L106 76" fill="none" />
    </>
  ),
  architecture: (
    <>
      <rect x="12" y="46" width="40" height="24" rx="3" />
      <rect x="80" y="14" width="40" height="24" rx="3" />
      <rect x="80" y="78" width="40" height="24" rx="3" />
      <rect x="148" y="46" width="40" height="24" rx="3" />
      <path d="M52 58 L80 30 M52 58 L80 86 M120 26 L148 54 M120 90 L148 62" fill="none" />
    </>
  ),
  mindmap: (
    <>
      <circle cx="100" cy="60" r="16" />
      <circle cx="36" cy="24" r="10" />
      <circle cx="36" cy="96" r="10" />
      <circle cx="164" cy="28" r="10" />
      <circle cx="166" cy="92" r="10" />
      <path d="M86 52 L46 30 M86 68 L46 90 M114 52 L154 32 M114 68 L156 86" fill="none" />
    </>
  ),
  orgchart: (
    <>
      <rect x="78" y="8" width="44" height="20" rx="3" />
      <rect x="28" y="64" width="44" height="20" rx="3" />
      <rect x="128" y="64" width="44" height="20" rx="3" />
      <path d="M100 28 L100 46 M50 46 L150 46 M50 46 L50 64 M150 46 L150 64" fill="none" />
    </>
  ),
  kanban: (
    <>
      <rect x="10" y="10" width="52" height="100" rx="4" fill={FILL} stroke={STROKE} />
      <rect x="74" y="10" width="52" height="100" rx="4" fill={FILL} stroke={STROKE} />
      <rect x="138" y="10" width="52" height="100" rx="4" fill={FILL} stroke={STROKE} />
      <g fill={SOFT} stroke="none">
        <rect x="16" y="20" width="40" height="14" rx="2" />
        <rect x="16" y="40" width="40" height="14" rx="2" />
        <rect x="80" y="20" width="40" height="14" rx="2" />
        <rect x="144" y="20" width="40" height="14" rx="2" />
        <rect x="144" y="40" width="40" height="14" rx="2" />
        <rect x="144" y="60" width="40" height="14" rx="2" />
      </g>
    </>
  ),
  retro: (
    <>
      <line x1="100" y1="8" x2="100" y2="112" stroke={STROKE} />
      <g fill={SOFT} stroke="none">
        <rect x="14" y="16" width="32" height="26" rx="3" />
        <rect x="54" y="22" width="32" height="26" rx="3" />
        <rect x="116" y="16" width="32" height="26" rx="3" />
        <rect x="156" y="28" width="30" height="26" rx="3" />
        <rect x="20" y="64" width="32" height="26" rx="3" />
        <rect x="120" y="70" width="32" height="26" rx="3" />
      </g>
    </>
  ),
  wireframe: (
    <>
      <rect x="14" y="14" width="96" height="92" rx="4" />
      <line x1="14" y1="30" x2="110" y2="30" stroke={STROKE} />
      <g fill={SOFT} stroke="none">
        <rect x="22" y="40" width="34" height="24" rx="2" />
        <rect x="62" y="40" width="40" height="24" rx="2" />
        <rect x="22" y="72" width="80" height="22" rx="2" />
      </g>
      <rect x="130" y="20" width="44" height="80" rx="7" />
      <g fill={SOFT} stroke="none">
        <rect x="138" y="30" width="28" height="6" rx="2" />
        <rect x="138" y="42" width="28" height="16" rx="2" />
        <rect x="138" y="64" width="28" height="16" rx="2" />
      </g>
    </>
  ),
  journey: (
    <>
      <path
        d="M14 88 L60 52 L106 70 L152 30 L188 48"
        fill="none"
        stroke={STROKE}
        strokeWidth="2.5"
      />
      <g fill={FILL} stroke={STROKE}>
        <circle cx="14" cy="88" r="7" />
        <circle cx="60" cy="52" r="7" />
        <circle cx="106" cy="70" r="7" />
        <circle cx="152" cy="30" r="7" />
        <circle cx="188" cy="48" r="7" />
      </g>
      <line x1="8" y1="104" x2="194" y2="104" stroke={SOFT} strokeWidth="1.5" />
    </>
  ),
  timeline: (
    <>
      <line x1="12" y1="60" x2="188" y2="60" stroke={STROKE} strokeWidth="2.5" />
      <g fill={FILL} stroke={STROKE}>
        <circle cx="34" cy="60" r="7" />
        <circle cx="84" cy="60" r="7" />
        <circle cx="134" cy="60" r="7" />
        <circle cx="180" cy="60" r="7" />
      </g>
      <g fill={SOFT} stroke="none">
        <rect x="20" y="24" width="28" height="14" rx="2" />
        <rect x="70" y="82" width="28" height="14" rx="2" />
        <rect x="120" y="24" width="28" height="14" rx="2" />
        <rect x="166" y="82" width="28" height="14" rx="2" />
      </g>
    </>
  ),
  fishbone: (
    <>
      <line x1="10" y1="60" x2="170" y2="60" stroke={STROKE} strokeWidth="2.5" />
      <polygon points="170,52 190,60 170,68" fill={FILL} stroke={STROKE} />
      <path
        d="M50 60 L36 26 M50 60 L36 94 M110 60 L96 26 M110 60 L96 94"
        fill="none"
        stroke={SOFT}
      />
      <g fill={FILL} stroke={STROKE}>
        <circle cx="34" cy="24" r="5" />
        <circle cx="34" cy="96" r="5" />
        <circle cx="94" cy="24" r="5" />
        <circle cx="94" cy="96" r="5" />
      </g>
    </>
  ),
  swot: (
    <>
      <rect x="14" y="12" width="80" height="44" rx="4" />
      <rect x="106" y="12" width="80" height="44" rx="4" />
      <rect x="14" y="64" width="80" height="44" rx="4" />
      <rect x="106" y="64" width="80" height="44" rx="4" />
      <g fill={SOFT} stroke="none">
        <rect x="22" y="20" width="34" height="8" rx="2" />
        <rect x="114" y="20" width="34" height="8" rx="2" />
        <rect x="22" y="72" width="34" height="8" rx="2" />
        <rect x="114" y="72" width="34" height="8" rx="2" />
      </g>
    </>
  ),
  matrix: (
    <>
      <rect x="20" y="10" width="160" height="100" rx="4" />
      <line x1="100" y1="10" x2="100" y2="110" stroke={SOFT} />
      <line x1="20" y1="60" x2="180" y2="60" stroke={SOFT} />
      <g fill={STROKE} stroke="none">
        <circle cx="58" cy="36" r="6" />
        <circle cx="140" cy="30" r="6" />
        <circle cx="150" cy="52" r="6" />
        <circle cx="52" cy="86" r="6" />
        <circle cx="130" cy="84" r="6" />
      </g>
    </>
  ),
  gantt: (
    <>
      <line x1="12" y1="8" x2="12" y2="112" stroke={STROKE} strokeWidth="1.5" />
      <g fill={SOFT} stroke="none">
        <rect x="20" y="18" width="58" height="14" rx="3" />
        <rect x="50" y="40" width="70" height="14" rx="3" />
        <rect x="92" y="62" width="58" height="14" rx="3" />
        <rect x="120" y="84" width="60" height="14" rx="3" />
      </g>
    </>
  ),
  venn: (
    <>
      <circle cx="80" cy="46" r="34" fill={SOFT} opacity="0.3" />
      <circle cx="120" cy="46" r="34" fill={SOFT} opacity="0.3" />
      <circle cx="100" cy="80" r="34" fill={SOFT} opacity="0.3" />
    </>
  ),
  erd: (
    <>
      <rect x="14" y="20" width="52" height="52" rx="3" />
      <line x1="14" y1="34" x2="66" y2="34" stroke={STROKE} />
      <rect x="120" y="46" width="52" height="52" rx="3" />
      <line x1="120" y1="60" x2="172" y2="60" stroke={STROKE} />
      <path d="M66 52 L120 66" fill="none" stroke={SOFT} />
      <g fill={SOFT} stroke="none">
        <rect x="20" y="44" width="40" height="6" rx="2" />
        <rect x="20" y="56" width="40" height="6" rx="2" />
        <rect x="126" y="70" width="40" height="6" rx="2" />
        <rect x="126" y="82" width="40" height="6" rx="2" />
      </g>
    </>
  ),
  sequence: (
    <>
      <rect x="24" y="8" width="36" height="18" rx="3" />
      <rect x="140" y="8" width="36" height="18" rx="3" />
      <line x1="42" y1="26" x2="42" y2="112" stroke={SOFT} strokeDasharray="4 3" />
      <line x1="158" y1="26" x2="158" y2="112" stroke={SOFT} strokeDasharray="4 3" />
      <path d="M42 46 L158 46 M150 40 L158 46 L150 52" fill="none" stroke={STROKE} />
      <path d="M158 74 L42 74 M50 68 L42 74 L50 80" fill="none" stroke={STROKE} />
      <path d="M42 98 L158 98 M150 92 L158 98 L150 104" fill="none" stroke={STROKE} />
    </>
  ),
  moodboard: <MoodBoardSketch />,
};

// Mood board: a grid of image tiles collaborators fill in, some already
// uploaded (pastel photos), some still empty drop-zones (dashed + an
// image-placeholder glyph). Echoes the real mood-board template.
function MoodBoardSketch() {
  const tiles = [
    { x: 12, y: 12, sky: '#e0f2fe', hill: '#7dd3fc' },
    { x: 73, y: 12, sky: '#fce7f3', hill: '#f9a8d4' },
    { x: 134, y: 12, empty: true },
    { x: 12, y: 64, empty: true },
    { x: 73, y: 64, sky: '#ede9fe', hill: '#c4b5fd' },
    { x: 134, y: 64, sky: '#dcfce7', hill: '#86efac' },
  ];
  return (
    <>
      <rect x="3" y="3" width="194" height="114" rx="6" fill="none" stroke={SOFT} opacity="0.35" />
      {tiles.map((t, i) =>
        t.empty ? (
          <g key={i}>
            <rect
              x={t.x}
              y={t.y}
              width="54"
              height="44"
              rx="3"
              fill={FILL}
              stroke={SOFT}
              strokeWidth="1.3"
              strokeDasharray="4 3"
            />
            <g stroke={SOFT} strokeWidth="1.3" fill="none">
              <rect x={t.x + 19} y={t.y + 14} width="16" height="13" rx="2" />
              <circle cx={t.x + 23} cy={t.y + 19} r="1.5" />
              <path
                d={`M${t.x + 19} ${t.y + 27} L${t.x + 25} ${t.y + 21} L${t.x + 29} ${t.y + 24} L${t.x + 35} ${t.y + 18}`}
              />
            </g>
          </g>
        ) : (
          <g key={i}>
            <rect
              x={t.x}
              y={t.y}
              width="54"
              height="44"
              rx="3"
              fill={t.sky}
              stroke={STROKE}
              strokeWidth="1.3"
            />
            <circle cx={t.x + 13} cy={t.y + 14} r="4.5" fill="#fcd34d" stroke="none" />
            <path
              d={`M${t.x + 1} ${t.y + 44} L${t.x + 16} ${t.y + 27} L${t.x + 28} ${t.y + 38} L${t.x + 40} ${t.y + 28} L${t.x + 53} ${t.y + 44} Z`}
              fill={t.hill}
              stroke="none"
            />
          </g>
        ),
      )}
    </>
  );
}
