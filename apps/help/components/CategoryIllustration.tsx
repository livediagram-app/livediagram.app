// On-brand banner illustrations, one per help category (spec/55). Each is a
// compact SVG scene evoking that area with motifs lifted from the real editor
// (shapes + arrows on a canvas, the palette panel, tab pills, live cursors,
// theme swatches, ...) so the help centre reads as a window into the product.
// Rendered atop CategoryCard. Brand-tinted via Tailwind fill-/stroke- utilities
// so they track the theme; a soft brand gradient backs every scene.
//
// Keyed by the category `slug` (top-level support categories + the seven
// feature categories). An unknown slug falls back to the generic canvas scene.

// The scene fits (meet) within a short banner whose brand wash lives on the
// CategoryCard container, so the motifs scale down rather than crop.
const VIEWBOX = '0 0 320 120';

// --- Reusable motif bits -----------------------------------------------------

// A small white "element" card with a brand border, like a shape on the canvas.
function Node({
  x,
  y,
  w = 56,
  h = 34,
  rx = 6,
  accent = false,
}: {
  x: number;
  y: number;
  w?: number;
  h?: number;
  rx?: number;
  accent?: boolean;
}) {
  return (
    <rect
      x={x}
      y={y}
      width={w}
      height={h}
      rx={rx}
      className={accent ? 'fill-brand-500 stroke-brand-600' : 'fill-white stroke-brand-300'}
      strokeWidth={2}
    />
  );
}

// A live-collab cursor with a coloured name tag.
function Cursor({ x, y, className }: { x: number; y: number; className: string }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <path d="M0 0 L0 16 L4.5 12 L7 18 L10 16.5 L7.5 10.5 L13 10 Z" className={className} />
    </g>
  );
}

// --- Per-category scenes -----------------------------------------------------

const SCENES: Record<string, React.ReactNode> = {
  // About: a tiny flow — two nodes joined by an arrow — the product in one glance.
  about: (
    <>
      <Node x={36} y={44} />
      <Node x={172} y={44} accent />
      <path
        d="M96 61 H168"
        className="stroke-brand-400"
        strokeWidth={3}
        strokeLinecap="round"
        markerEnd="url(#cat-arrow)"
      />
      <defs>
        <marker id="cat-arrow" markerWidth="7" markerHeight="7" refX="5" refY="3" orient="auto">
          <path d="M0 0 L6 3 L0 6 Z" className="fill-brand-400" />
        </marker>
      </defs>
      <circle cx="250" cy="38" r="14" className="fill-white stroke-brand-300" strokeWidth={2} />
      <path
        d="M250 35 v8 M250 31 h0.01"
        className="stroke-brand-500"
        strokeWidth={2.5}
        strokeLinecap="round"
      />
    </>
  ),

  // Getting started: a square being drawn with a draw cursor + the "+" affordance.
  'getting-started': (
    <>
      <rect
        x={70}
        y={36}
        width={90}
        height={48}
        rx={6}
        className="fill-white stroke-brand-400"
        strokeWidth={2}
        strokeDasharray="6 5"
      />
      <circle cx="160" cy="84" r="9" className="fill-brand-500" />
      <path
        d="M160 80 v8 M156 84 h8"
        className="stroke-white"
        strokeWidth={2}
        strokeLinecap="round"
      />
      <Cursor x={186} y={58} className="fill-brand-600" />
      <path d="M214 40 l5 11 11 5 -11 5 -5 11 -5 -11 -11 -5 11 -5 Z" className="fill-brand-300" />
    </>
  ),

  // Tips & tricks: a lightbulb + keyboard keys (shortcuts).
  'tips-and-tricks': (
    <>
      {/* Lightbulb: round glass + a screw base + idea rays. */}
      <circle cx="104" cy="50" r="22" className="fill-white stroke-brand-400" strokeWidth={2.5} />
      <rect
        x={95}
        y={70}
        width={18}
        height={10}
        rx={2}
        className="fill-white stroke-brand-400"
        strokeWidth={2.5}
      />
      <path d="M98 84 h12" className="stroke-brand-400" strokeWidth={2.5} strokeLinecap="round" />
      <path d="M97 50 a7 7 0 0 1 14 0" className="stroke-brand-500" strokeWidth={2.5} fill="none" />
      {[
        [104, 18, 104, 26],
        [128, 28, 134, 22],
        [80, 28, 74, 22],
        [136, 50, 144, 50],
      ].map(([x1, y1, x2, y2], i) => (
        <path
          key={i}
          d={`M${x1} ${y1} L${x2} ${y2}`}
          className="stroke-brand-300"
          strokeWidth={2.5}
          strokeLinecap="round"
        />
      ))}
      {/* Shortcut keys. */}
      {[176, 210, 244].map((x) => (
        <rect
          key={x}
          x={x}
          y={64}
          width={28}
          height={28}
          rx={6}
          className="fill-white stroke-brand-300"
          strokeWidth={2}
        />
      ))}
      <path
        d="M186 78 h8 M220 78 h8 M254 78 h8"
        className="stroke-brand-400"
        strokeWidth={3}
        strokeLinecap="round"
      />
    </>
  ),

  // Account & data: an avatar syncing across two devices.
  'account-and-data': (
    <>
      <rect
        x={40}
        y={40}
        width={70}
        height={46}
        rx={5}
        className="fill-white stroke-brand-300"
        strokeWidth={2}
      />
      <rect
        x={210}
        y={46}
        width={36}
        height={54}
        rx={6}
        className="fill-white stroke-brand-300"
        strokeWidth={2}
      />
      <circle cx="75" cy="58" r="8" className="fill-brand-500" />
      <path
        d="M64 80 a11 11 0 0 1 22 0"
        className="fill-brand-100 stroke-brand-400"
        strokeWidth={1.5}
      />
      <path
        d="M126 54 a30 18 0 0 1 70 0"
        className="stroke-brand-400"
        strokeWidth={3}
        fill="none"
        markerEnd="url(#cat-arrow2)"
      />
      <path
        d="M196 74 a30 18 0 0 1 -70 0"
        className="stroke-brand-300"
        strokeWidth={3}
        fill="none"
        markerEnd="url(#cat-arrow2b)"
      />
      <defs>
        <marker id="cat-arrow2" markerWidth="7" markerHeight="7" refX="5" refY="3" orient="auto">
          <path d="M0 0 L6 3 L0 6 Z" className="fill-brand-400" />
        </marker>
        <marker id="cat-arrow2b" markerWidth="7" markerHeight="7" refX="5" refY="3" orient="auto">
          <path d="M0 0 L6 3 L0 6 Z" className="fill-brand-300" />
        </marker>
      </defs>
    </>
  ),

  // Privacy & security: a shield with a check.
  'privacy-and-security': (
    <>
      <path
        d="M160 28 l34 12 v22 c0 24 -16 38 -34 44 c-18 -6 -34 -20 -34 -44 v-22 Z"
        className="fill-white stroke-brand-400"
        strokeWidth={2.5}
      />
      <path
        d="M146 60 l10 11 20 -22"
        className="stroke-brand-500"
        strokeWidth={4}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </>
  ),

  // Self-hosting: a stack of server / worker units + code brackets.
  'self-hosting': (
    <>
      {[40, 64, 88].map((y) => (
        <g key={y}>
          <rect
            x={96}
            y={y}
            width={128}
            height={18}
            rx={4}
            className="fill-white stroke-brand-300"
            strokeWidth={2}
          />
          <circle cx="108" cy={y + 9} r="3" className="fill-brand-500" />
          <path
            d={`M120 ${y + 9} h70`}
            className="stroke-brand-200"
            strokeWidth={3}
            strokeLinecap="round"
          />
        </g>
      ))}
      <path
        d="M70 48 l-12 14 12 14"
        className="stroke-brand-400"
        strokeWidth={3}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M250 48 l12 14 -12 14"
        className="stroke-brand-400"
        strokeWidth={3}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  ),

  // Troubleshooting: a wrench over a node, fixing it.
  troubleshooting: (
    <>
      <rect
        x={60}
        y={42}
        width={120}
        height={50}
        rx={8}
        className="fill-white stroke-brand-300"
        strokeWidth={2}
      />
      <path
        d="M74 60 h40 M74 72 h64"
        className="stroke-brand-200"
        strokeWidth={3}
        strokeLinecap="round"
      />
      <g transform="translate(196 40) rotate(40)">
        <path
          d="M14 0 a14 14 0 0 0 -18 16 l-10 26 a6 6 0 0 0 8 8 l26 -10 a14 14 0 0 0 16 -18 l-9 9 -10 -3 -3 -10 Z"
          className="fill-brand-500 stroke-brand-600"
          strokeWidth={1.5}
        />
      </g>
    </>
  ),

  // Contact: an envelope with a chat bubble.
  contact: (
    <>
      <rect
        x={70}
        y={42}
        width={120}
        height={72}
        rx={8}
        className="fill-white stroke-brand-300"
        strokeWidth={2}
      />
      <path
        d="M70 50 l60 40 60 -40"
        className="stroke-brand-400"
        strokeWidth={2.5}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <g transform="translate(196 30)">
        <rect width={64} height={44} rx={10} className="fill-brand-500" />
        <path d="M16 44 l0 12 12 -12 Z" className="fill-brand-500" />
        <circle cx="20" cy="22" r="3.5" className="fill-white" />
        <circle cx="32" cy="22" r="3.5" className="fill-white" />
        <circle cx="44" cy="22" r="3.5" className="fill-white" />
      </g>
    </>
  ),

  // Explorer: a folder tree / file list.
  explorer: (
    <>
      <rect
        x={48}
        y={28}
        width={224}
        height={64}
        rx={8}
        className="fill-white stroke-brand-300"
        strokeWidth={2}
      />
      <path d="M66 44 h12 l3 4 h14 v3 h-29 Z" className="fill-brand-500" />
      <path d="M70 60 h10 l2.5 3 h11 v3 H70 Z" className="fill-brand-300" />
      <path d="M70 76 h10 l2.5 3 h11 v3 H70 Z" className="fill-brand-300" />
      <path
        d="M112 51 h140 M112 67 h120 M112 83 h132"
        className="stroke-brand-200"
        strokeWidth={4}
        strokeLinecap="round"
      />
    </>
  ),

  // Palette: the floating tool palette with shape tiles.
  palette: (
    <>
      <rect
        x={108}
        y={20}
        width={104}
        height={84}
        rx={10}
        className="fill-white stroke-brand-300"
        strokeWidth={2}
      />
      <rect x={120} y={30} width={80} height={12} rx={4} className="fill-brand-100" />
      <rect
        x={122}
        y={50}
        width={22}
        height={22}
        rx={5}
        className="fill-brand-50 stroke-brand-400"
        strokeWidth={1.5}
      />
      <rect
        x={127}
        y={55}
        width={12}
        height={12}
        rx={2}
        className="stroke-brand-500"
        strokeWidth={2}
        fill="none"
      />
      <rect
        x={149}
        y={50}
        width={22}
        height={22}
        rx={5}
        className="fill-brand-50 stroke-brand-400"
        strokeWidth={1.5}
      />
      <circle cx="160" cy="61" r="6" className="stroke-brand-500" strokeWidth={2} fill="none" />
      <rect
        x={176}
        y={50}
        width={22}
        height={22}
        rx={5}
        className="fill-brand-50 stroke-brand-400"
        strokeWidth={1.5}
      />
      <path
        d="M187 52 l9 9 -9 9 -9 -9 Z"
        className="stroke-brand-500"
        strokeWidth={2}
        fill="none"
        strokeLinejoin="round"
      />
      <rect x={122} y={78} width={76} height={16} rx={5} className="fill-brand-500" />
    </>
  ),

  // Canvas: two shapes joined by an arrow, with a selection box — the editor.
  canvas: (
    <>
      <rect
        x={44}
        y={42}
        width={58}
        height={36}
        rx={7}
        className="fill-white stroke-brand-400"
        strokeWidth={2}
      />
      <circle cx="232" cy="60" r="22" className="fill-brand-500" />
      <path
        d="M104 60 H206"
        className="stroke-brand-400"
        strokeWidth={3}
        strokeLinecap="round"
        markerEnd="url(#cat-arrowc)"
      />
      <defs>
        <marker id="cat-arrowc" markerWidth="8" markerHeight="8" refX="5" refY="3" orient="auto">
          <path d="M0 0 L6 3 L0 6 Z" className="fill-brand-400" />
        </marker>
      </defs>
      <rect
        x={38}
        y={36}
        width={70}
        height={48}
        rx={3}
        className="fill-none stroke-brand-500"
        strokeWidth={1.5}
        strokeDasharray="4 3"
      />
      {(
        [
          [38, 36],
          [108, 36],
          [38, 84],
          [108, 84],
        ] as [number, number][]
      ).map(([cx, cy]) => (
        <rect
          key={`${cx}-${cy}`}
          x={cx - 3}
          y={cy - 3}
          width={6}
          height={6}
          className="fill-white stroke-brand-500"
          strokeWidth={1.5}
        />
      ))}
    </>
  ),

  // Tabs: a row of tab pills, one active.
  tabs: (
    <>
      <rect
        x={40}
        y={40}
        width={240}
        height={48}
        rx={8}
        className="fill-white stroke-brand-300"
        strokeWidth={2}
      />
      <rect x={52} y={34} width={70} height={26} rx={7} className="fill-brand-500" />
      <rect x={62} y={44} width={42} height={6} rx={3} className="fill-white" opacity="0.85" />
      {[130, 196].map((x) => (
        <g key={x}>
          <rect
            x={x}
            y={38}
            width={62}
            height={22}
            rx={7}
            className="fill-brand-50 stroke-brand-200"
            strokeWidth={1.5}
          />
          <rect x={x + 10} y={47} width={36} height={5} rx={2.5} className="fill-brand-300" />
        </g>
      ))}
      <path d="M52 74 h180" className="stroke-brand-200" strokeWidth={3} strokeLinecap="round" />
    </>
  ),

  // Customisation: theme swatches + a recolour brush.
  customisation: (
    <>
      {[
        ['fill-brand-500', 96],
        ['fill-brand-300', 130],
        ['fill-emerald-400', 164],
        ['fill-amber-400', 198],
      ].map(([cls, x]) => (
        <circle
          key={x as number}
          cx={x as number}
          cy={50}
          r="15"
          className={`${cls} stroke-white`}
          strokeWidth={3}
        />
      ))}
      <rect
        x={96}
        y={78}
        width={120}
        height={14}
        rx={7}
        className="fill-white stroke-brand-300"
        strokeWidth={2}
      />
      <rect x={96} y={78} width={64} height={14} rx={7} className="fill-brand-400" />
      <circle cx="160" cy="85" r="9" className="fill-white stroke-brand-500" strokeWidth={2.5} />
    </>
  ),

  // Collaboration: live cursors + a comment bubble over a shared node.
  collaboration: (
    <>
      <rect
        x={86}
        y={46}
        width={120}
        height={44}
        rx={8}
        className="fill-white stroke-brand-300"
        strokeWidth={2}
      />
      <path
        d="M100 62 h70 M100 76 h50"
        className="stroke-brand-200"
        strokeWidth={3}
        strokeLinecap="round"
      />
      <Cursor x={74} y={36} className="fill-brand-600" />
      <rect x={84} y={30} width={34} height={13} rx={6} className="fill-brand-600" />
      <Cursor x={196} y={70} className="fill-emerald-500" />
      <rect x={206} y={84} width={34} height={13} rx={6} className="fill-emerald-500" />
      <g transform="translate(214 24)">
        <rect width={48} height={32} rx={8} className="fill-brand-500" />
        <path d="M12 32 l0 10 10 -10 Z" className="fill-brand-500" />
        <path
          d="M12 13 h24 M12 21 h16"
          className="stroke-white"
          strokeWidth={3}
          strokeLinecap="round"
        />
      </g>
    </>
  ),

  // Tools: an AI wand with sparkles + an align/cleanup motif.
  tools: (
    <>
      {[44, 70, 96].map((y, i) => (
        <rect
          key={y}
          x={48}
          y={y}
          width={i === 1 ? 70 : 50}
          height={16}
          rx={4}
          className="fill-white stroke-brand-300"
          strokeWidth={2}
        />
      ))}
      <path d="M40 38 v74" className="stroke-brand-400" strokeWidth={2} strokeDasharray="4 4" />
      <g transform="translate(196 34)">
        <path d="M0 64 L48 16" className="stroke-brand-500" strokeWidth={7} strokeLinecap="round" />
        <rect
          x={-4}
          y={58}
          width={16}
          height={12}
          rx={3}
          transform="rotate(-45 4 64)"
          className="fill-brand-600"
        />
      </g>
      {(
        [
          [250, 30],
          [272, 52],
          [238, 60],
        ] as [number, number][]
      ).map(([x, y]) => (
        <path
          key={`${x}-${y}`}
          d={`M${x} ${y - 7} l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2 Z`}
          className="fill-brand-300"
        />
      ))}
    </>
  ),
  // Search panel: a search field with a magnifier, over a dropdown of result
  // rows (the top one highlighted, the way Enter picks the first match).
  'search-panel': (
    <>
      <rect
        x={68}
        y={20}
        width={184}
        height={28}
        rx={14}
        className="fill-white stroke-brand-400"
        strokeWidth={2}
      />
      <g className="stroke-brand-600" strokeWidth={3} fill="none" strokeLinecap="round">
        <circle cx={88} cy={34} r={7} />
        <path d="M93 39 l6 6" />
      </g>
      <rect x={106} y={31} width={64} height={6} rx={3} className="fill-brand-200" />
      {[60, 82, 104].map((y, i) => (
        <g key={y}>
          <rect
            x={68}
            y={y}
            width={184}
            height={16}
            rx={4}
            className={i === 0 ? 'fill-brand-500 stroke-brand-600' : 'fill-white stroke-brand-300'}
            strokeWidth={2}
          />
          <circle cx={80} cy={y + 8} r={3} className={i === 0 ? 'fill-white' : 'fill-brand-300'} />
          <rect
            x={90}
            y={y + 5}
            width={i === 0 ? 96 : 72}
            height={6}
            rx={3}
            className={i === 0 ? 'fill-white' : 'fill-brand-200'}
            opacity={i === 0 ? 0.85 : 1}
          />
        </g>
      ))}
    </>
  ),
};

export function CategoryIllustration({ slug }: { slug: string }) {
  const scene = SCENES[slug] ?? SCENES.canvas;
  return (
    <svg
      viewBox={VIEWBOX}
      className="h-full w-full"
      preserveAspectRatio="xMidYMid meet"
      aria-hidden
    >
      {scene}
    </svg>
  );
}
