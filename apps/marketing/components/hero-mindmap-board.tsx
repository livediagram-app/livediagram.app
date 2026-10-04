import type { CSSProperties } from 'react';

// The hero's Mind Map window (docs/specs/019-marketing/marketing-site.md "Hero"): a launch plan
// grown from the centre in Diagram mode's mind map (docs/specs/009-elements/mind-node.md). The
// centre lands, four colour-coded branches grow out on tapered curves (Marketing, Product, Support,
// Events), and ideas sprout from each, written on an underline as a mind map draws its leaves; a
// key chip shows the Tab and Enter presses that add them, a teammate fills the Events branch at the
// same time, and a rocket sticker lands on the centre. Each piece arrives at its own --d delay
// (hero-mode-animations.css).

const FONT = 'ui-sans-serif, system-ui, sans-serif';
const CENTRE = { x: 300, y: 140 };
// On a phone the map is drawn tall: the centre in the middle, two branches above it and two below,
// each branch's ideas stacked away from the centre.
const PORTRAIT_CENTRE = { x: 180, y: 206 };
const PORTRAIT_AT: Record<string, { x: number; y: number }> = {
  Marketing: { x: 92, y: 104 },
  Product: { x: 268, y: 104 },
  Support: { x: 268, y: 308 },
  Events: { x: 92, y: 308 },
};

const at = (d: number, extra?: Record<string, string | number>) =>
  ({ '--d': `${d}s`, ...extra }) as CSSProperties;

type Leaf = { text: string; d: number };
type Branch = {
  label: string;
  color: string;
  tint: string;
  // The branch node's centre, and which side its ideas grow on.
  x: number;
  y: number;
  side: 'left' | 'right';
  d: number;
  leaves: Leaf[];
};

const BRANCHES: Branch[] = [
  {
    label: 'Marketing',
    color: '#ec4899',
    tint: '#fce7f3',
    x: 168,
    y: 44,
    side: 'left',
    d: 0.9,
    leaves: [
      { text: 'Teaser video', d: 3.0 },
      { text: 'Press kit', d: 3.5 },
      { text: 'Newsletter', d: 4.0 },
    ],
  },
  {
    label: 'Product',
    color: '#8b5cf6',
    tint: '#ede9fe',
    x: 432,
    y: 44,
    side: 'right',
    d: 1.4,
    leaves: [
      { text: 'Beta invites', d: 5.9 },
      { text: 'Pricing page', d: 6.4 },
      { text: 'Changelog', d: 6.9 },
    ],
  },
  {
    label: 'Support',
    color: '#10b981',
    tint: '#d1fae5',
    x: 432,
    y: 236,
    side: 'right',
    d: 1.9,
    leaves: [
      { text: 'Help centre', d: 7.6 },
      { text: 'Live chat', d: 8.1 },
    ],
  },
  {
    label: 'Events',
    color: '#f59e0b',
    tint: '#fef3c7',
    x: 168,
    y: 236,
    side: 'left',
    d: 2.4,
    leaves: [
      { text: 'Launch party', d: 4.7 },
      { text: 'Webinar', d: 5.3 },
    ],
  },
];

// A branch from the centre: a curve out, drawn thick at the centre and thinning toward the
// branch, as a mind map draws its main branches (two strokes, the thick one shorter).
function trunk(b: Branch, portrait: boolean) {
  if (portrait) {
    const c = PORTRAIT_CENTRE;
    const up = b.y < c.y;
    const sx = c.x + (b.x < c.x ? -30 : 30);
    const sy = c.y + (up ? -24 : 24);
    const ey = b.y + (up ? 16 : -16);
    const my = (sy + ey) / 2;
    return `M${sx} ${sy} C${sx} ${my}, ${b.x} ${my}, ${b.x} ${ey}`;
  }
  const sx = CENTRE.x + (b.x < CENTRE.x ? -58 : 58);
  const ex = b.x + (b.x < CENTRE.x ? 46 : -46);
  const mx = (sx + ex) / 2;
  return `M${sx} ${CENTRE.y} C${mx} ${CENTRE.y}, ${mx} ${b.y}, ${ex} ${b.y}`;
}

// Where a branch's ideas sit: stacked beside it, spread evenly round its centre line.
function leafY(b: Branch, i: number) {
  const step = 38;
  return b.y + (i - (b.leaves.length - 1) / 2) * step;
}

function LeafNode({
  b,
  leaf,
  i,
  portrait,
}: {
  b: Branch;
  leaf: Leaf;
  i: number;
  portrait: boolean;
}) {
  if (portrait) return <PortraitLeaf b={b} leaf={leaf} i={i} />;
  const y = leafY(b, i);
  const fromX = b.x + (b.side === 'left' ? -46 : 46);
  const lineStart = b.side === 'left' ? fromX - 26 : fromX + 26;
  const width = leaf.text.length * 6.4 + 8;
  const lineEnd = b.side === 'left' ? lineStart - width : lineStart + width;
  const mx = (fromX + lineStart) / 2;
  return (
    <g>
      <path
        className="hm-draw"
        style={at(leaf.d, { '--dur': '0.35s', '--len': 60 })}
        d={`M${fromX} ${b.y} C${mx} ${b.y}, ${mx} ${y + 4}, ${lineStart} ${y + 4}`}
        fill="none"
        stroke={b.color}
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        className="hm-draw"
        style={at(leaf.d + 0.25, { '--dur': '0.3s', '--len': width })}
        d={`M${lineStart} ${y + 4} L${lineEnd} ${y + 4}`}
        stroke={b.color}
        strokeWidth="2"
        strokeLinecap="round"
      />
      <text
        className="hm-type fill-(--art-text)"
        style={at(leaf.d + 0.3, { '--steps': leaf.text.length })}
        x={b.side === 'left' ? lineStart - 4 : lineStart + 4}
        y={y}
        textAnchor={b.side === 'left' ? 'end' : 'start'}
        fontFamily={FONT}
        fontSize="11.5"
        fontWeight="600"
      >
        {leaf.text}
      </text>
    </g>
  );
}

// A phone's leaf: stacked above a top branch or below a bottom one, written on an underline. Its line
// leaves the branch sideways and runs up (or down) just left of the stack, so it never crosses a word.
function PortraitLeaf({ b, leaf, i }: { b: Branch; leaf: Leaf; i: number }) {
  const up = b.y < PORTRAIT_CENTRE.y;
  const y = up ? b.y - 44 - i * 30 : b.y + 42 + i * 30;
  const edgeY = b.y + (up ? -16 : 16);
  const width = leaf.text.length * 6.4 + 8;
  const start = b.x - 44;
  return (
    <g>
      <path
        className="hm-draw"
        style={at(leaf.d, { '--dur': '0.35s', '--len': 80 })}
        d={`M${b.x - 30} ${edgeY} C${start - 8} ${edgeY}, ${start - 8} ${y + 4}, ${start} ${y + 4}`}
        fill="none"
        stroke={b.color}
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        className="hm-draw"
        style={at(leaf.d + 0.25, { '--dur': '0.3s', '--len': width })}
        d={`M${start} ${y + 4} L${start + width} ${y + 4}`}
        stroke={b.color}
        strokeWidth="2"
        strokeLinecap="round"
      />
      <text
        className="hm-type fill-(--art-text)"
        style={at(leaf.d + 0.3, { '--steps': leaf.text.length })}
        x={start + 4}
        y={y}
        fontFamily={FONT}
        fontSize="11.5"
        fontWeight="600"
      >
        {leaf.text}
      </text>
    </g>
  );
}

// A key press, shown as a keycap with what it does, at the canvas's foot.
function KeyPress({
  d,
  cap,
  does,
  portrait,
}: {
  d: number;
  cap: string;
  does: string;
  portrait: boolean;
}) {
  return (
    <g className="hm-press" style={at(d)} transform={portrait ? 'translate(-120 154)' : undefined}>
      <rect
        x="226"
        y="300"
        width="148"
        height="26"
        rx="8"
        className="fill-white stroke-slate-200 dark:fill-slate-900 dark:stroke-slate-700"
      />
      <rect
        x="234"
        y="305"
        width="38"
        height="16"
        rx="4"
        className="fill-slate-100 stroke-slate-300 dark:fill-slate-800 dark:stroke-slate-600"
      />
      <text
        x="253"
        y="316.5"
        textAnchor="middle"
        fontFamily={FONT}
        fontSize="9"
        fontWeight="700"
        className="fill-slate-700 dark:fill-slate-200"
      >
        {cap}
      </text>
      <text
        x="280"
        y="317"
        fontFamily={FONT}
        fontSize="9.5"
        fontWeight="600"
        className="fill-slate-500 dark:fill-slate-400"
      >
        {does}
      </text>
    </g>
  );
}

export function MindMapBoard({ portrait = false }: { portrait?: boolean }) {
  const centre = portrait ? PORTRAIT_CENTRE : CENTRE;
  const branches = portrait ? BRANCHES.map((b) => ({ ...b, ...PORTRAIT_AT[b.label]! })) : BRANCHES;
  return (
    <>
      {/* Branches out from the centre, each thick at its root. */}
      {branches.map((b) => (
        <g key={b.label}>
          <path
            className="hm-draw"
            style={at(b.d - 0.15, { '--dur': '0.45s', '--len': 220 })}
            d={trunk(b, portrait)}
            fill="none"
            stroke={b.color}
            strokeWidth="3"
            strokeLinecap="round"
          />
          <path
            className="hm-draw"
            style={at(b.d - 0.15, { '--dur': '0.3s', '--len': 220, '--to': 150 })}
            d={trunk(b, portrait)}
            fill="none"
            stroke={b.color}
            strokeWidth="7"
            strokeLinecap="round"
          />
        </g>
      ))}

      {/* The centre. */}
      <g className="hm-pop" style={at(0.2)}>
        <rect x={centre.x - 62} y={centre.y - 24} width="124" height="48" rx="24" fill="#0ea5e9" />
      </g>
      <text
        className="hm-type"
        style={at(0.35, { '--steps': 11 })}
        x={centre.x}
        y={centre.y + 5}
        textAnchor="middle"
        fontFamily={FONT}
        fontSize="14"
        fontWeight="800"
        fill="white"
      >
        Launch plan
      </text>

      {/* The branch nodes, in their colours. */}
      {branches.map((b) => (
        <g key={b.label}>
          <g className="hm-pop" style={at(b.d)}>
            <rect
              x={b.x - 46}
              y={b.y - 16}
              width="92"
              height="32"
              rx="16"
              fill={b.tint}
              stroke={b.color}
              strokeWidth="2"
            />
          </g>
          <text
            className="hm-type"
            style={at(b.d + 0.1, { '--steps': b.label.length })}
            x={b.x}
            y={b.y + 4.5}
            textAnchor="middle"
            fontFamily={FONT}
            fontSize="12"
            fontWeight="700"
            fill="#1e293b"
          >
            {b.label}
          </text>
          {b.leaves.map((leaf, i) => (
            <LeafNode key={leaf.text} b={b} leaf={leaf} i={i} portrait={portrait} />
          ))}
        </g>
      ))}

      {/* The keys that grew it: Tab adds a child idea, Enter a sibling. */}
      <KeyPress d={2.85} cap="Tab" does="Add an idea" portrait={portrait} />
      <KeyPress d={3.35} cap="Enter" does="And another" portrait={portrait} />
      <KeyPress d={3.85} cap="Enter" does="And another" portrait={portrait} />
      <KeyPress d={5.75} cap="Tab" does="Add an idea" portrait={portrait} />
      <KeyPress d={7.45} cap="Tab" does="Add an idea" portrait={portrait} />

      {/* A rocket on the centre, for the launch. */}
      <g className="hm-pop" style={at(8.9)}>
        <circle cx={centre.x + 56} cy={centre.y - 22} r="14" fill="white" stroke="#e2e8f0" />
        <text x={centre.x + 56} y={centre.y - 17} textAnchor="middle" fontSize="15">
          🚀
        </text>
      </g>

      {/* The teammate filling in Events. */}
      <g
        className="hm-cursor"
        style={at(
          4.4,
          portrait
            ? { '--sx': '330px', '--sy': '470px', '--cx': '128px', '--cy': '362px' }
            : { '--sx': '330px', '--sy': '330px', '--cx': '112px', '--cy': '262px' },
        )}
        aria-hidden
      >
        <path
          d="M0 0 L12 7 L7 8 L9.5 12.5 L7.5 13.5 L5 9 L1.5 12.5 Z"
          fill="#ec4899"
          stroke="white"
          strokeWidth="1"
        />
        <rect x="10" y="12" width="20" height="12" rx="3" fill="#ec4899" />
        <text
          x="20"
          y="21"
          textAnchor="middle"
          fontFamily={FONT}
          fontSize="7.5"
          fontWeight="700"
          fill="white"
        >
          JR
        </text>
      </g>
    </>
  );
}
