// On-brand banner illustrations, one per help category (spec/55). Each is a
// compact SVG scene evoking that area with motifs lifted from the real editor
// (shapes + arrows on a canvas, the palette panel, tab pills, live cursors,
// theme swatches, ...) so the help centre reads as a window into the product.
// Rendered atop CategoryCard. Brand-tinted via Tailwind fill-/stroke- utilities
// so they track the theme; a soft brand gradient backs every scene.
//
// Keyed by the category `slug` (top-level support categories + the nine
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
      {/* A tiny flowchart — one node branching to two — the product at a glance. */}
      <defs>
        <marker
          id="cat-ar-about"
          markerWidth="7"
          markerHeight="7"
          refX="5.5"
          refY="3"
          orient="auto"
        >
          <path d="M0 0 L6 3 L0 6 Z" className="fill-brand-400" />
        </marker>
      </defs>
      <path
        d="M92 60 H150 V34 H188"
        className="stroke-brand-400"
        strokeWidth={3}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        markerEnd="url(#cat-ar-about)"
      />
      <path
        d="M92 60 H150 V86 H188"
        className="stroke-brand-400"
        strokeWidth={3}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        markerEnd="url(#cat-ar-about)"
      />
      <Node x={28} y={42} w={64} h={36} />
      <Node x={192} y={18} w={64} h={34} accent />
      <Node x={192} y={68} w={64} h={34} />
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

  // Troubleshooting: a magnifier inspecting a card, with a check in the lens.
  troubleshooting: (
    <>
      <rect
        x={44}
        y={38}
        width={150}
        height={58}
        rx={10}
        className="fill-white stroke-brand-300"
        strokeWidth={2}
      />
      <path
        d="M62 58 h74 M62 74 h52"
        className="stroke-brand-200"
        strokeWidth={4}
        strokeLinecap="round"
      />
      <circle cx="202" cy="58" r="27" className="fill-white stroke-brand-500" strokeWidth={4} />
      <path d="M222 78 l20 20" className="stroke-brand-500" strokeWidth={6} strokeLinecap="round" />
      <path
        d="M191 58 l8 8 14 -16"
        className="stroke-brand-500"
        strokeWidth={3.5}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
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

  // User Interface: the editor chrome around a muted canvas (a toolbar of
  // tool buttons, a side panel, a row of tab pills, and a zoom control): the
  // panels / toolbar / tab bar / zoom controls the category covers.
  'user-interface': (
    <>
      {/* Editor window frame. */}
      <rect
        x={40}
        y={20}
        width={240}
        height={84}
        rx={10}
        className="fill-white stroke-brand-300"
        strokeWidth={2}
      />
      {/* Toolbar: a row of tool buttons, one active. */}
      {[52, 72, 92, 112, 132].map((x, i) => (
        <rect
          key={x}
          x={x}
          y={30}
          width={14}
          height={14}
          rx={3}
          className={i === 1 ? 'fill-brand-500 stroke-brand-600' : 'fill-brand-50 stroke-brand-300'}
          strokeWidth={1.5}
        />
      ))}
      {/* Muted canvas content (two elements + arrow) so the chrome reads as
          the hero rather than the canvas (which has its own box). */}
      <rect
        x={92}
        y={56}
        width={44}
        height={22}
        rx={5}
        className="fill-white stroke-brand-300"
        strokeWidth={2}
      />
      <path d="M136 67 H164" className="stroke-brand-300" strokeWidth={2.5} strokeLinecap="round" />
      <circle cx="176" cy="67" r="11" className="fill-brand-100 stroke-brand-300" strokeWidth={2} />
      {/* Side panel (quick controls): a header bar over a couple of rows. */}
      <rect
        x={222}
        y={30}
        width={46}
        height={44}
        rx={6}
        className="fill-brand-50 stroke-brand-300"
        strokeWidth={1.5}
      />
      <rect x={228} y={36} width={34} height={6} rx={3} className="fill-brand-300" />
      <rect x={228} y={48} width={34} height={5} rx={2.5} className="fill-brand-200" />
      <rect x={228} y={58} width={26} height={5} rx={2.5} className="fill-brand-200" />
      {/* Tab bar: an active pill and two inactive ones. */}
      <rect x={52} y={82} width={46} height={16} rx={7} className="fill-brand-500" />
      <rect x={60} y={88} width={30} height={4} rx={2} className="fill-white" opacity="0.85" />
      {[104, 150].map((x) => (
        <g key={x}>
          <rect
            x={x}
            y={84}
            width={40}
            height={13}
            rx={6}
            className="fill-brand-50 stroke-brand-200"
            strokeWidth={1.5}
          />
          <rect x={x + 8} y={89} width={24} height={4} rx={2} className="fill-brand-300" />
        </g>
      ))}
      {/* Zoom control: − [zoom] + in a pill. */}
      <rect
        x={208}
        y={82}
        width={60}
        height={16}
        rx={8}
        className="fill-white stroke-brand-300"
        strokeWidth={1.5}
      />
      <path d="M218 90 h8" className="stroke-brand-500" strokeWidth={2.5} strokeLinecap="round" />
      <rect x={232} y={87} width={12} height={6} rx={2} className="fill-brand-200" />
      <path
        d="M254 86 v8 M250 90 h8"
        className="stroke-brand-500"
        strokeWidth={2.5}
        strokeLinecap="round"
      />
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

  // Collaboration: a shared card, three overlapping avatars, and a comment bubble.
  collaboration: (
    <>
      <rect
        x={40}
        y={48}
        width={132}
        height={48}
        rx={8}
        className="fill-white stroke-brand-300"
        strokeWidth={2}
      />
      <path
        d="M56 66 h62 M56 80 h42"
        className="stroke-brand-200"
        strokeWidth={4}
        strokeLinecap="round"
      />
      {/* A comment bubble pointing at the shared card. */}
      <g transform="translate(196 20)">
        <rect width={54} height={34} rx={9} className="fill-brand-600" />
        <path d="M14 34 l0 12 12 -12 Z" className="fill-brand-600" />
        <path
          d="M13 14 h28 M13 23 h17"
          className="stroke-white"
          strokeWidth={3}
          strokeLinecap="round"
        />
      </g>
      {/* Three overlapping collaborators. */}
      <circle cx="210" cy="74" r="17" className="fill-brand-500 stroke-white" strokeWidth={3} />
      <circle cx="238" cy="74" r="17" className="fill-emerald-500 stroke-white" strokeWidth={3} />
      <circle cx="266" cy="74" r="17" className="fill-brand-300 stroke-white" strokeWidth={3} />
    </>
  ),

  // Tools: a magic wand (AI) with a clean star tip + sparkles, beside tidy bars.
  tools: (
    <>
      {[42, 66, 90].map((y, i) => (
        <rect
          key={y}
          x={44}
          y={y}
          width={i === 1 ? 84 : 58}
          height={14}
          rx={4}
          className="fill-white stroke-brand-300"
          strokeWidth={2}
        />
      ))}
      {/* The wand: a rounded diagonal stick rising to a four-point star. */}
      <path
        d="M196 102 L234 56"
        className="stroke-brand-500"
        strokeWidth={8}
        strokeLinecap="round"
      />
      <path
        d="M244 22 l4.5 12 12 4.5 -12 4.5 -4.5 12 -4.5 -12 -12 -4.5 12 -4.5 Z"
        className="fill-brand-500"
      />
      {/* Two small sparkles. */}
      <path
        d="M214 40 l2.5 6 6 2.5 -6 2.5 -2.5 6 -2.5 -6 -6 -2.5 6 -2.5 Z"
        className="fill-brand-300"
      />
      <path d="M278 66 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2 Z" className="fill-brand-300" />
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

  // Supported devices: a monitor, a tablet, and a phone side by side, each
  // showing the same little node-and-arrow diagram, scaled to the screen.
  'supported-devices': (
    <>
      {/* Monitor */}
      <rect
        x={28}
        y={30}
        width={120}
        height={70}
        rx={6}
        className="fill-white stroke-brand-300"
        strokeWidth={2}
      />
      <rect x={80} y={100} width={16} height={10} className="fill-brand-200" />
      <rect x={64} y={108} width={48} height={5} rx={2.5} className="fill-brand-300" />
      <Node x={44} y={46} w={34} h={20} />
      <Node x={104} y={64} w={30} h={18} accent />
      <path d="M78 56 H104" className="stroke-brand-400" strokeWidth={2} />
      {/* Tablet */}
      <rect
        x={170}
        y={34}
        width={70}
        height={86}
        rx={8}
        className="fill-white stroke-brand-300"
        strokeWidth={2}
      />
      <Node x={182} y={50} w={26} h={16} />
      <Node x={206} y={84} w={24} h={16} accent />
      <path d="M195 66 V84" className="stroke-brand-400" strokeWidth={2} />
      {/* Phone */}
      <rect
        x={258}
        y={44}
        width={40}
        height={76}
        rx={8}
        className="fill-white stroke-brand-300"
        strokeWidth={2}
      />
      <Node x={266} y={58} w={24} h={14} />
      <Node x={266} y={86} w={24} h={14} accent />
      <path d="M278 72 V86" className="stroke-brand-400" strokeWidth={2} />
    </>
  ),

  // Activity Panel: a small panel of timestamped change rows beside an
  // undo arrow, evoking the history list and its undo/redo controls.
  'activity-panel': (
    <>
      <rect
        x={90}
        y={26}
        width={140}
        height={68}
        rx={8}
        className="fill-white stroke-brand-300"
        strokeWidth={2}
      />
      {[38, 56, 74].map((y, i) => (
        <g key={y}>
          <circle
            cx={106}
            cy={y + 4}
            r={5}
            className={i === 1 ? 'fill-brand-500' : 'fill-brand-200'}
          />
          <rect
            x={118}
            y={y}
            width={i === 1 ? 92 : 70}
            height={8}
            rx={4}
            className="fill-brand-100"
          />
        </g>
      ))}
      {/* Undo arrow curving back to the panel. */}
      <path
        d="M70 104a22 22 0 0119-30"
        className="stroke-brand-400"
        strokeWidth={3}
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M83 70l8 4-3 8"
        className="stroke-brand-400"
        strokeWidth={3}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
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
