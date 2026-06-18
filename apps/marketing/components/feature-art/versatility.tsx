// Feature illustrations — versatility + AI / rotation / layout scenes.
// Split from FeatureArt.tsx; see ./shared for Frame + color constants.
import { BLUE_FILL, BLUE_STROKE, Frame, PINK, SKY } from './shared';

/* ──────────────── Section: versatility (shapes / notes / borders /
 * backdrops). Breadth-of-canvas cards, same vocabulary + shared fa-*
 * timing as the rest. */

// The shape library: ten core shapes plus the five device frames, a
// brand-highlight cycling across the palette like the real Shapes /
// Devices accordions.
export function ShapesArt() {
  const glyphs = [
    'square',
    'circle',
    'diamond',
    'hexagon',
    'browser',
    'phone',
    'tablet',
    'cylinder',
  ];
  return (
    <Frame>
      <div className="flex h-full flex-col justify-center gap-1.5 px-3">
        <p className="text-[8px] font-semibold uppercase tracking-wider text-slate-500">
          Shapes · Devices
        </p>
        <div className="grid grid-cols-4 gap-1.5">
          {glyphs.map((g, i) => (
            <span
              key={g}
              className="relative flex h-7 items-center justify-center rounded border border-slate-200 bg-white text-slate-500"
            >
              <span
                className="fa-hl pointer-events-none absolute inset-0 rounded ring-2 ring-brand-500"
                style={{ animationDelay: `${i * 0.7}s` }}
              />
              <ShapeGlyph kind={g} />
            </span>
          ))}
        </div>
      </div>
    </Frame>
  );
}

function ShapeGlyph({ kind }: { kind: string }) {
  const c = {
    width: 15,
    height: 15,
    viewBox: '0 0 16 16',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.4,
    'aria-hidden': true,
  } as const;
  switch (kind) {
    case 'square':
      return (
        <svg {...c}>
          <rect x="3" y="3" width="10" height="10" rx="2" />
        </svg>
      );
    case 'circle':
      return (
        <svg {...c}>
          <circle cx="8" cy="8" r="5" />
        </svg>
      );
    case 'diamond':
      return (
        <svg {...c}>
          <polygon points="8,3 13,8 8,13 3,8" strokeLinejoin="round" />
        </svg>
      );
    case 'hexagon':
      return (
        <svg {...c}>
          <polygon points="4,3 11,3 14,8 11,13 4,13 1,8" strokeLinejoin="round" />
        </svg>
      );
    case 'cylinder':
      return (
        <svg {...c}>
          <path d="M3 5 L3 12 A5 1.5 0 0 0 13 12 L13 5" strokeLinejoin="round" />
          <ellipse cx="8" cy="5" rx="5" ry="1.5" />
        </svg>
      );
    case 'browser':
      return (
        <svg {...c}>
          <rect x="2" y="3" width="12" height="10" rx="1.5" />
          <line x1="2" y1="6" x2="14" y2="6" />
          <circle cx="4" cy="4.5" r="0.5" fill="currentColor" />
          <circle cx="5.8" cy="4.5" r="0.5" fill="currentColor" />
        </svg>
      );
    case 'phone':
      return (
        <svg {...c}>
          <rect x="5" y="2" width="6" height="12" rx="1.5" />
          <line x1="7" y1="3.4" x2="9" y2="3.4" />
        </svg>
      );
    case 'tablet':
      return (
        <svg {...c}>
          <rect x="3.5" y="2.5" width="9" height="11" rx="1.5" />
          <circle cx="8" cy="12" r="0.5" fill="currentColor" />
        </svg>
      );
  }
  return null;
}

// Per-element notes: a note pinned to a shape, its card fading in like the
// real NotePopover.
export function NotesArt() {
  return (
    <Frame canvas>
      <svg viewBox="0 0 220 96" className="absolute inset-0 h-full w-full">
        <rect
          x="22"
          y="36"
          width="64"
          height="32"
          rx="6"
          fill={BLUE_FILL}
          stroke={BLUE_STROKE}
          strokeWidth="2"
        />
      </svg>
      {/* note badge on the element */}
      <span className="absolute left-[34%] top-6 flex h-5 w-5 items-center justify-center rounded-full bg-amber-400 text-white shadow">
        <span className="fa-pulse absolute inset-0 rounded-full bg-amber-400" />
        <span className="relative">
          <NoteIcon />
        </span>
      </span>
      {/* note card */}
      <div className="fa-fade absolute right-2 top-3 w-[52%] rounded-md border border-amber-200 bg-amber-50 p-1.5 shadow-md">
        <div className="flex items-center gap-1 text-[7px] font-semibold text-amber-700">
          <NoteIcon /> Note
        </div>
        <div className="mt-1 h-1.5 w-full rounded bg-amber-200/80" />
        <div className="mt-0.5 h-1.5 w-3/4 rounded bg-amber-200/80" />
      </div>
    </Frame>
  );
}

function NoteIcon() {
  return (
    <svg
      width="8"
      height="8"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
    >
      <path d="M3 2.5 H13 V13.5 H3 Z" strokeLinejoin="round" />
      <path d="M5.5 6 H10.5 M5.5 9 H9" strokeLinecap="round" />
    </svg>
  );
}

// Border styling: three shapes showing solid / dashed / dotted strokes with
// increasing corner radius, the brand highlight cycling between them.
export function BorderStyleArt() {
  const variants = [
    { dash: undefined as string | undefined, rx: 4 },
    { dash: '6 4', rx: 14 },
    { dash: '0.5 4', rx: 22 },
  ];
  return (
    <Frame canvas>
      <svg viewBox="0 0 220 96" className="absolute inset-0 h-full w-full">
        {variants.map((v, i) => {
          const x = 18 + i * 68;
          return (
            <g key={i}>
              <rect
                x={x}
                y="32"
                width="52"
                height="32"
                rx={v.rx}
                fill={BLUE_FILL}
                stroke={BLUE_STROKE}
                strokeWidth="2.5"
                strokeDasharray={v.dash}
                strokeLinecap="round"
              />
              <rect
                className="fa-hl"
                x={x - 4}
                y="28"
                width="60"
                height="40"
                rx={v.rx + 4}
                fill="none"
                stroke={SKY}
                strokeWidth="1.5"
                style={{ animationDelay: `${i * 2}s` }}
              />
            </g>
          );
        })}
      </svg>
      <span className="absolute bottom-1.5 right-2 rounded bg-white/90 px-1.5 py-0.5 text-[8px] font-medium text-slate-500 shadow-sm">
        solid · dashed · dotted
      </span>
    </Frame>
  );
}

// Arrows: the three line styles (straight / curved / angled) stacked, with the
// draggable middle handle shown on the curve (control point) and the elbow
// (bend vertex). The two handles pulse to read as "grab and drag me"; straight
// has none (nothing to bend). Mirrors the editor's arrow handle flow (spec/09).
export function ArrowsArt() {
  return (
    <Frame canvas>
      <svg viewBox="0 0 220 96" className="absolute inset-0 h-full w-full">
        <defs>
          <marker
            id="li-arrowhead"
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="5"
            markerHeight="5"
            orient="auto-start-reverse"
          >
            <path d="M0 0 L10 5 L0 10 z" fill={BLUE_STROKE} />
          </marker>
        </defs>
        {/* straight */}
        <line
          x1="24"
          y1="20"
          x2="150"
          y2="20"
          stroke={BLUE_STROKE}
          strokeWidth="2.5"
          strokeLinecap="round"
          markerEnd="url(#li-arrowhead)"
        />
        {/* curved, with a draggable control knob at the apex */}
        <path
          d="M24 50 Q 87 30, 150 50"
          fill="none"
          stroke={BLUE_STROKE}
          strokeWidth="2.5"
          strokeLinecap="round"
          markerEnd="url(#li-arrowhead)"
        />
        <circle
          className="fa-pulse"
          cx="87"
          cy="40"
          r="6"
          fill="none"
          stroke={SKY}
          strokeWidth="2"
        />
        <circle cx="87" cy="40" r="3.5" fill="#fff" stroke={SKY} strokeWidth="1.5" />
        {/* angled, with a draggable elbow knob at the bend */}
        <path
          d="M24 80 L96 80 L96 66 L150 66"
          fill="none"
          stroke={BLUE_STROKE}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          markerEnd="url(#li-arrowhead)"
        />
        <circle
          className="fa-pulse"
          cx="96"
          cy="80"
          r="6"
          fill="none"
          stroke={SKY}
          strokeWidth="2"
          style={{ animationDelay: '1s' }}
        />
        <circle cx="96" cy="80" r="3.5" fill="#fff" stroke={SKY} strokeWidth="1.5" />
        {/* style labels */}
        <text x="166" y="23" fontSize="8" fontWeight="500" fill="#94a3b8">
          straight
        </text>
        <text x="166" y="53" fontSize="8" fontWeight="500" fill="#94a3b8">
          curved
        </text>
        <text x="166" y="69" fontSize="8" fontWeight="500" fill="#94a3b8">
          angled
        </text>
      </svg>
      <span className="absolute bottom-1.5 left-2 rounded bg-white/90 px-1.5 py-0.5 text-[8px] font-medium text-slate-500 shadow-sm">
        drag to bend
      </span>
    </Frame>
  );
}

// Pencil (freehand) + shape recognition: a hand-drawn wobbly stroke draws on
// the left (fa-draw), an arrow points right, and the recognised clean shape
// fades in on the right (fa-fade), under a pulsing magic-wand chip. Mirrors the
// pencil ModeBanner's recognise toggle that mints a real primitive (spec/09).
export function PencilArt() {
  return (
    <Frame canvas>
      <svg viewBox="0 0 220 96" className="absolute inset-0 h-full w-full">
        {/* hand-drawn, wobbly rectangle outline being sketched */}
        <path
          className="fa-draw"
          d="M22 34 C 40 30, 64 31, 78 33 C 80 44, 79 56, 77 64 C 58 66, 38 65, 23 63 C 21 52, 21 43, 22 34 Z"
          fill="none"
          stroke={BLUE_STROKE}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* transition arrow */}
        <path
          d="M96 49 H120 M115 44 L121 49 L115 54"
          fill="none"
          stroke="#94a3b8"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* recognised clean shape */}
        <rect
          className="fa-fade"
          x="138"
          y="32"
          width="58"
          height="34"
          rx="6"
          fill={BLUE_FILL}
          stroke={BLUE_STROKE}
          strokeWidth="2.5"
        />
      </svg>
      {/* magic-wand recognise chip */}
      <span className="fa-pulse absolute right-2 top-2 flex items-center gap-1 rounded bg-white/90 px-1.5 py-0.5 text-[8px] font-medium text-brand-600 shadow-sm">
        <WandIcon /> recognise
      </span>
      <span className="absolute bottom-1.5 left-2 flex items-center gap-1 rounded bg-white/90 px-1.5 py-0.5 text-[8px] font-medium text-slate-500 shadow-sm">
        <PencilGlyph /> freehand
      </span>
    </Frame>
  );
}

function WandIcon() {
  return (
    <svg
      width="9"
      height="9"
      viewBox="0 0 16 16"
      fill="none"
      stroke={BLUE_STROKE}
      strokeWidth="1.5"
    >
      <path d="M3 13 L11 5" strokeLinecap="round" />
      <path
        d="M12 2 l0.7 1.8 L14.5 4.5 l-1.8 0.7 L12 7 l-0.7-1.8 L9.5 4.5 l1.8-0.7 Z"
        fill={BLUE_STROKE}
        stroke="none"
      />
    </svg>
  );
}

function PencilGlyph() {
  return (
    <svg width="9" height="9" viewBox="0 0 16 16" fill="none" stroke="#64748b" strokeWidth="1.5">
      <path d="M11 2.5 L13.5 5 L5 13.5 L2.5 13.5 L2.5 11 Z" strokeLinejoin="round" />
    </svg>
  );
}

// Alignment guides: as you drag a shape, faint dashed lines light up along
// the edges and centres it shares with its neighbours, so it snaps into line
// on a busy canvas (spec/09). Here the dragged (ringed) shape shares a left
// edge with the shape above it (the vertical guide) and a top edge with the
// shape to its right (the horizontal guide); both guides pulse like the real
// overlay.
export function AlignmentGuidesArt() {
  return (
    <Frame canvas>
      <svg viewBox="0 0 220 96" className="absolute inset-0 h-full w-full">
        {/* neighbour above — shares a left edge with the dragged shape */}
        <rect
          x="58"
          y="12"
          width="52"
          height="22"
          rx="5"
          fill={BLUE_FILL}
          stroke={BLUE_STROKE}
          strokeWidth="2"
        />
        {/* neighbour to the right — shares a top edge with the dragged shape */}
        <rect
          x="150"
          y="54"
          width="44"
          height="22"
          rx="5"
          fill={BLUE_FILL}
          stroke={BLUE_STROKE}
          strokeWidth="2"
        />
        {/* selection ring on the shape being dragged into line */}
        <rect
          x="54"
          y="50"
          width="60"
          height="30"
          rx="2"
          fill="none"
          stroke={SKY}
          strokeWidth="1.5"
        />
        <rect
          x="58"
          y="54"
          width="52"
          height="22"
          rx="5"
          fill={BLUE_FILL}
          stroke={BLUE_STROKE}
          strokeWidth="2"
        />
        {/* vertical guide — the two stacked shapes' left edges line up */}
        <line
          className="fa-pulse"
          x1="58"
          y1="6"
          x2="58"
          y2="86"
          stroke={SKY}
          strokeWidth="1.3"
          strokeDasharray="4 3"
        />
        {/* horizontal guide — the dragged shape + right neighbour share a top edge */}
        <line
          className="fa-pulse"
          x1="44"
          y1="54"
          x2="200"
          y2="54"
          stroke={SKY}
          strokeWidth="1.3"
          strokeDasharray="4 3"
          style={{ animationDelay: '0.5s' }}
        />
      </svg>
      <span className="absolute bottom-1.5 right-2 rounded bg-white/90 px-1.5 py-0.5 text-[8px] font-medium text-slate-500 shadow-sm">
        snaps into line
      </span>
    </Frame>
  );
}

// Canvas backdrop: four background patterns in a picker, the brand highlight
// cycling to say "swap the canvas backdrop".
export function CanvasBackdropArt() {
  const pats: { key: string; bg: string; size: string }[] = [
    {
      key: 'grid',
      bg: 'linear-gradient(#cbd5e1 1px, transparent 1px), linear-gradient(90deg, #cbd5e1 1px, transparent 1px)',
      size: '9px 9px',
    },
    {
      key: 'lines',
      bg: 'repeating-linear-gradient(0deg, #cbd5e1 0 1px, transparent 1px 9px)',
      size: 'auto',
    },
    {
      key: 'crosshatch',
      bg: 'repeating-linear-gradient(45deg, #cbd5e1 0 1px, transparent 1px 8px), repeating-linear-gradient(-45deg, #cbd5e1 0 1px, transparent 1px 8px)',
      size: 'auto',
    },
    {
      key: 'dots',
      bg: 'radial-gradient(#cbd5e1 1.2px, transparent 1.2px)',
      size: '9px 9px',
    },
  ];
  return (
    <Frame>
      <div className="flex h-full items-center justify-center gap-2 px-3">
        {pats.map((p, i) => (
          <div
            key={p.key}
            className="relative h-16 w-1/4 overflow-hidden rounded border border-slate-200 bg-white"
          >
            <span
              className="absolute inset-0"
              style={{ backgroundImage: p.bg, backgroundSize: p.size }}
            />
            <span
              className="fa-hl pointer-events-none absolute inset-0 rounded ring-2 ring-brand-500"
              style={{ animationDelay: `${i * 1.5}s` }}
            />
          </div>
        ))}
      </div>
    </Frame>
  );
}

/* ──────────────── Section: AI / rotation / layout (newest) ──────────────
 * The latest editor surfaces. Same vocabulary + shared fa-* timing as
 * everything above, plus the one fa-rotate keyframe for the rotate card. */

// Optional AI assistant: the floating panel (Build / Ask / Review / Clean
// tabs + a prompt) sits over the canvas while freshly generated shapes pop in
// on the left, mirroring the editor's AI Assistant panel (spec/25).
export function AiAssistArt() {
  const tabs = ['Build', 'Ask', 'Review', 'Clean'];
  return (
    <Frame canvas>
      <svg viewBox="0 0 220 96" className="absolute inset-0 h-full w-full">
        {/* shapes the assistant just generated, popping in */}
        <g className="fa-pop" style={{ animationDelay: '0.5s' }}>
          <rect
            x="18"
            y="20"
            width="46"
            height="20"
            rx="5"
            fill={BLUE_FILL}
            stroke={BLUE_STROKE}
            strokeWidth="2"
          />
        </g>
        <line
          className="fa-draw"
          x1="41"
          y1="40"
          x2="50"
          y2="56"
          stroke={BLUE_STROKE}
          strokeWidth="2"
          strokeLinecap="round"
          style={{ animationDelay: '1s' }}
        />
        <g className="fa-pop" style={{ animationDelay: '1.2s' }}>
          <rect
            x="32"
            y="56"
            width="46"
            height="20"
            rx="5"
            fill={BLUE_FILL}
            stroke={BLUE_STROKE}
            strokeWidth="2"
          />
        </g>
      </svg>
      {/* floating assistant panel */}
      <div className="fa-fade absolute right-2 top-2.5 w-[54%] rounded-md border border-slate-200 bg-white p-1.5 shadow-md">
        <div className="flex items-center gap-1 border-b border-slate-100 pb-1">
          <SparkleIcon />
          <span className="text-[8px] font-semibold text-slate-700">Assistant</span>
        </div>
        <div className="mt-1 flex gap-0.5">
          {tabs.map((t, i) => (
            <span
              key={t}
              className={
                'rounded px-1 py-0.5 text-[6.5px] font-medium ' +
                (i === 0 ? 'bg-brand-100 text-brand-700' : 'text-slate-400')
              }
            >
              {t}
            </span>
          ))}
        </div>
        <div className="mt-1 flex items-center gap-1 rounded border border-slate-200 bg-slate-50 px-1 py-0.5">
          <span className="min-w-0 flex-1 truncate text-[7px] text-slate-500">
            Draw a login flow…
          </span>
          <span className="fa-pulse flex h-3.5 w-3.5 items-center justify-center rounded bg-brand-500 text-white">
            <SparkleIcon light />
          </span>
        </div>
      </div>
    </Frame>
  );
}

function SparkleIcon({ light = false }: { light?: boolean }) {
  return (
    <svg width="9" height="9" viewBox="0 0 16 16" fill={light ? '#fff' : BLUE_STROKE} aria-hidden>
      <path d="M8 1 l1.4 4.2 L13.6 6.6 l-4.2 1.4 L8 12.2 l-1.4 -4.2 L2.4 6.6 l4.2 -1.4 Z" />
      <path d="M13 9.5 l0.55 1.65 L15.2 11.7 l-1.65 0.55 L13 13.9 l-0.55 -1.65 L10.8 11.7 l1.65 -0.55 Z" />
    </svg>
  );
}

// Shape rotation: a selected shape with a rotate handle on a stem above it,
// rocking to the 15° snap angle and back. Resize handles are hidden while
// rotating, matching the editor (snaps to 15°, Shift for free) (spec/09).
export function RotateArt() {
  return (
    <Frame canvas>
      <svg viewBox="0 0 220 96" className="absolute inset-0 h-full w-full">
        <g
          className="fa-rotate"
          style={{ transformBox: 'view-box', transformOrigin: '110px 50px' }}
        >
          {/* selection ring */}
          <rect
            x="74"
            y="30"
            width="72"
            height="40"
            rx="2"
            fill="none"
            stroke={SKY}
            strokeWidth="1.5"
          />
          {/* the shape itself */}
          <rect
            x="78"
            y="34"
            width="64"
            height="32"
            rx="6"
            fill={BLUE_FILL}
            stroke={BLUE_STROKE}
            strokeWidth="2"
          />
          {/* stem + rotate handle */}
          <line x1="110" y1="30" x2="110" y2="17" stroke={SKY} strokeWidth="1.5" />
          <circle cx="110" cy="14" r="4" fill="#fff" stroke={SKY} strokeWidth="1.8" />
          <path
            d="M108.4 14 a1.6 1.6 0 1 1 0.5 1.15"
            fill="none"
            stroke={SKY}
            strokeWidth="1"
            strokeLinecap="round"
          />
        </g>
      </svg>
      <span className="absolute bottom-1.5 right-2 rounded bg-white/90 px-1.5 py-0.5 text-[8px] font-medium text-slate-500 shadow-sm">
        snaps to 15°
      </span>
    </Frame>
  );
}

// Minimal panel layout: the editor chrome crossfades between the standard
// floating panels and the compact dock + popover layout, with the toggle —
// pick how you want to work (always on for mobile) (spec/09, spec/20).
export function MinimalPanelArt() {
  return (
    <Frame canvas>
      {/* standard — floating panels docked on the sides */}
      <div className="fa-on absolute inset-0">
        <div className="absolute bottom-7 left-2 top-2 flex w-7 flex-col items-center gap-1 rounded-md border border-slate-200 bg-white py-1.5 shadow-sm">
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className="h-3 w-3 rounded bg-slate-200" />
          ))}
        </div>
        <div className="absolute bottom-7 right-2 top-2 w-12 space-y-1 rounded-md border border-slate-200 bg-white p-1.5 shadow-sm">
          <div className="h-1.5 w-full rounded bg-slate-300" />
          <div className="h-1.5 w-3/4 rounded bg-slate-200" />
          <div className="h-1.5 w-full rounded bg-slate-200" />
        </div>
        <span className="absolute bottom-1.5 left-2 rounded bg-white/90 px-1.5 py-0.5 text-[7px] font-medium text-slate-500 shadow-sm">
          standard panels
        </span>
      </div>
      {/* minimal — compact dock + popover */}
      <div className="fa-off absolute inset-0">
        <div className="absolute bottom-7 left-1/2 w-[46%] -translate-x-1/2 space-y-1 rounded-md border border-slate-200 bg-white p-1.5 shadow-md">
          <div className="h-1.5 w-3/4 rounded bg-slate-300" />
          <div className="h-1.5 w-full rounded bg-slate-200" />
        </div>
        <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2 py-1 shadow-sm">
          {[0, 1, 2, 3, 4].map((i) => (
            <span key={i} className="h-2.5 w-2.5 rounded-full bg-slate-200" />
          ))}
        </div>
        <span className="absolute left-2 top-2 rounded bg-white/90 px-1.5 py-0.5 text-[7px] font-medium text-slate-500 shadow-sm">
          compact dock
        </span>
      </div>
      {/* toggle (synced with the crossfade above) */}
      <span className="absolute right-2 top-2 inline-flex h-4 w-8 items-center rounded-full bg-slate-200 shadow-sm">
        <span className="fa-off absolute inset-0 rounded-full bg-brand-500" />
        <span className="fa-knob relative z-10 ml-0.5 h-3 w-3 rounded-full bg-white shadow" />
      </span>
    </Frame>
  );
}

// Zen / focus mode (spec/26): crossfade from a chrome-heavy editor
// (header bar + side panels) to a clean canvas with just the zoom dock.
// The centre shape sits outside the crossfade so the chrome melts away
// around the content that stays.
export function ZenModeArt() {
  return (
    <Frame canvas>
      {/* full chrome */}
      <div className="fa-on absolute inset-0">
        <div className="absolute inset-x-0 top-0 flex h-4 items-center gap-1 border-b border-slate-200 bg-white/90 px-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
          <span className="h-1.5 w-10 rounded bg-slate-200" />
          <span className="ml-auto h-1.5 w-4 rounded bg-slate-200" />
        </div>
        <div className="absolute bottom-2 left-2 top-6 flex w-6 flex-col items-center gap-1 rounded-md border border-slate-200 bg-white py-1 shadow-sm">
          {[0, 1, 2].map((i) => (
            <span key={i} className="h-2.5 w-2.5 rounded bg-slate-200" />
          ))}
        </div>
        <div className="absolute bottom-2 right-2 top-6 w-10 space-y-1 rounded-md border border-slate-200 bg-white p-1 shadow-sm">
          <div className="h-1.5 w-full rounded bg-slate-300" />
          <div className="h-1.5 w-3/4 rounded bg-slate-200" />
        </div>
        <span className="absolute left-2 top-1 text-[7px] font-medium text-slate-400">
          full editor
        </span>
      </div>
      {/* zen — content + just the zoom dock (with its exit control) */}
      <div className="fa-off absolute inset-0">
        <span className="absolute bottom-1.5 right-2 flex items-center gap-1 rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[7px] font-medium text-slate-500 shadow-sm">
          100%
          <svg
            width="7"
            height="7"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M2 6h4V2" />
            <path d="M14 6h-4V2" />
            <path d="M14 10h-4v4" />
            <path d="M2 10h4v4" />
          </svg>
        </span>
        <span className="absolute left-2 top-2 rounded bg-white/90 px-1.5 py-0.5 text-[7px] font-medium text-slate-500 shadow-sm">
          zen mode
        </span>
      </div>
      {/* the content you focus on — stays put while the chrome fades */}
      <div
        className="absolute left-1/2 top-1/2 h-7 w-12 -translate-x-1/2 -translate-y-1/2 rounded-md border-2"
        style={{ borderColor: BLUE_STROKE, backgroundColor: BLUE_FILL }}
      />
    </Frame>
  );
}

// Fonts: the same word in four distinct typeface styles, the brand
// highlight cycling through to read as "pick a font". Uses generic
// system stacks (sans / serif / mono / cursive) so the card conveys the
// variety without depending on the real Google Fonts loading here.
export function FontsArt() {
  const fonts = [
    { label: 'Inter', family: 'ui-sans-serif, system-ui, sans-serif' },
    { label: 'Lora', family: 'Georgia, ui-serif, serif' },
    { label: 'Roboto Mono', family: 'ui-monospace, SFMono-Regular, monospace' },
    { label: 'Caveat', family: '"Segoe Script", "Comic Sans MS", ui-rounded, cursive' },
  ];
  return (
    <Frame>
      <div className="flex h-full flex-col justify-center gap-1.5 px-3">
        <p className="text-[8px] font-semibold uppercase tracking-wider text-slate-500">Fonts</p>
        {fonts.map((f, i) => (
          <span
            key={f.label}
            className="relative flex items-center justify-between rounded border border-slate-200 bg-white px-2 py-1"
          >
            <span
              className="fa-hl pointer-events-none absolute inset-0 rounded ring-2 ring-brand-500"
              style={{ animationDelay: `${i * 0.7}s` }}
            />
            <span
              className="text-[13px] leading-none text-slate-800"
              style={{ fontFamily: f.family }}
            >
              Diagram
            </span>
            <span className="text-[8px] text-slate-400">{f.label}</span>
          </span>
        ))}
      </div>
    </Frame>
  );
}

// Markdown import: a heading + nested-bullet outline on the left turns
// into a small node-link tree on the right, with an arrow between. Mirrors
// what the importer does (outline → themed tree).
export function MarkdownImportArt() {
  return (
    <Frame canvas>
      {/* left: a markdown outline */}
      <div className="absolute bottom-3 left-2 top-3 w-[40%] rounded-md border border-slate-200 bg-white p-1.5 shadow-sm">
        <div className="flex items-center gap-1">
          <span className="rounded-sm bg-slate-200 px-1 text-[6px] font-semibold text-slate-500">
            md
          </span>
        </div>
        <div className="mt-1.5 space-y-1.5">
          <div className="h-1.5 w-4/5 rounded bg-slate-400" />
          <div className="ml-2 h-1.5 w-3/5 rounded bg-slate-200" />
          <div className="ml-4 h-1.5 w-1/2 rounded bg-slate-100" />
          <div className="ml-2 h-1.5 w-3/5 rounded bg-slate-200" />
        </div>
      </div>
      {/* arrow */}
      <svg viewBox="0 0 220 96" className="absolute inset-0 h-full w-full">
        <line x1="96" y1="48" x2="120" y2="48" stroke="rgb(100 116 139)" strokeWidth="2" />
        <polygon points="120,48 113,44 113,52" fill="rgb(100 116 139)" />
        {/* right: a tiny tree (root + two children) */}
        <line x1="150" y1="48" x2="178" y2="28" stroke={BLUE_STROKE} strokeWidth="1.5" />
        <line x1="150" y1="48" x2="178" y2="68" stroke={BLUE_STROKE} strokeWidth="1.5" />
        <rect
          x="132"
          y="40"
          width="22"
          height="16"
          rx="3"
          fill={BLUE_FILL}
          stroke={BLUE_STROKE}
          strokeWidth="1.5"
        />
        <rect
          x="176"
          y="20"
          width="22"
          height="16"
          rx="3"
          fill="white"
          stroke={BLUE_STROKE}
          strokeWidth="1.25"
        />
        <rect
          x="176"
          y="60"
          width="22"
          height="16"
          rx="3"
          fill="white"
          stroke={BLUE_STROKE}
          strokeWidth="1.25"
        />
      </svg>
    </Frame>
  );
}

// Editable table element: a coloured header row over body cells, with one
// cell ringed as if mid-edit (the real table opens a cell on double-click)
// and the header tinted to show the per-table header colours.
export function TablesArt() {
  const headers = ['Item', 'Owner', 'Status'];
  const rows = [
    ['API', 'Sam', 'Done'],
    ['UI', 'Lee', 'WIP'],
  ];
  return (
    <Frame canvas>
      <div className="flex h-full items-center justify-center">
        <div className="overflow-hidden rounded-[3px] border border-slate-300 bg-white shadow-sm">
          <div className="flex">
            {headers.map((h) => (
              <div
                key={h}
                className="w-[50px] border-r border-sky-600/40 bg-sky-500 px-2 py-1 text-[7px] font-semibold text-white last:border-r-0"
              >
                {h}
              </div>
            ))}
          </div>
          {rows.map((row, ri) => (
            <div key={ri} className="flex border-t border-slate-200">
              {row.map((cell, ci) => (
                <div
                  key={ci}
                  className="relative w-[50px] border-r border-slate-200 px-2 py-1 text-[7px] text-slate-600 last:border-r-0"
                >
                  {cell}
                  {ri === 1 && ci === 1 && (
                    <span className="fa-hl pointer-events-none absolute inset-0 rounded-[2px] ring-2 ring-brand-500" />
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </Frame>
  );
}

// The icon library: a curated set of single-colour glyphs, a brand
// highlight cycling across them like the real Icons picker.
export function IconsArt() {
  const icons = ['server', 'database', 'cloud', 'user', 'gear', 'lock', 'bolt', 'globe'];
  return (
    <Frame>
      <div className="flex h-full flex-col justify-center gap-1.5 px-3">
        <p className="text-[8px] font-semibold uppercase tracking-wider text-slate-500">Icons</p>
        <div className="grid grid-cols-4 gap-1.5">
          {icons.map((g, i) => (
            <span
              key={g}
              className="relative flex h-7 items-center justify-center rounded border border-slate-200 bg-white text-brand-600"
            >
              <span
                className="fa-hl pointer-events-none absolute inset-0 rounded ring-2 ring-brand-500"
                style={{ animationDelay: `${i * 0.7}s` }}
              />
              <IconGlyph kind={g} />
            </span>
          ))}
        </div>
      </div>
    </Frame>
  );
}

function IconGlyph({ kind }: { kind: string }) {
  const c = {
    width: 15,
    height: 15,
    viewBox: '0 0 16 16',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.3,
    'aria-hidden': true,
  } as const;
  switch (kind) {
    case 'server':
      return (
        <svg {...c}>
          <rect x="2.5" y="2.5" width="11" height="4.5" rx="1" />
          <rect x="2.5" y="9" width="11" height="4.5" rx="1" />
          <line x1="4.5" y1="4.7" x2="4.5" y2="4.8" strokeLinecap="round" strokeWidth="1.6" />
          <line x1="4.5" y1="11.2" x2="4.5" y2="11.3" strokeLinecap="round" strokeWidth="1.6" />
        </svg>
      );
    case 'database':
      return (
        <svg {...c}>
          <ellipse cx="8" cy="4" rx="5" ry="1.8" />
          <path d="M3 4 v8 a5 1.8 0 0 0 10 0 V4" strokeLinejoin="round" />
          <path d="M3 8 a5 1.8 0 0 0 10 0" />
        </svg>
      );
    case 'cloud':
      return (
        <svg {...c}>
          <path
            d="M5 12 a3 3 0 0 1 0.3 -6 a3.5 3.5 0 0 1 6.6 1 a2.5 2.5 0 0 1 -0.4 5 Z"
            strokeLinejoin="round"
          />
        </svg>
      );
    case 'user':
      return (
        <svg {...c}>
          <circle cx="8" cy="5.5" r="2.5" />
          <path d="M3.5 13 a4.5 4.5 0 0 1 9 0" strokeLinecap="round" />
        </svg>
      );
    case 'gear':
      return (
        <svg {...c}>
          <circle cx="8" cy="8" r="2.2" />
          <path
            d="M8 2 v1.6 M8 12.4 V14 M2 8 h1.6 M12.4 8 H14 M3.8 3.8 l1.1 1.1 M11.1 11.1 l1.1 1.1 M12.2 3.8 l-1.1 1.1 M4.9 11.1 l-1.1 1.1"
            strokeLinecap="round"
          />
        </svg>
      );
    case 'lock':
      return (
        <svg {...c}>
          <rect x="3.5" y="7" width="9" height="6.5" rx="1.2" />
          <path d="M5.5 7 V5 a2.5 2.5 0 0 1 5 0 v2" />
        </svg>
      );
    case 'bolt':
      return (
        <svg {...c}>
          <polygon points="9,2 4,9 7.5,9 7,14 12,7 8.5,7" strokeLinejoin="round" />
        </svg>
      );
    case 'globe':
      return (
        <svg {...c}>
          <circle cx="8" cy="8" r="5.5" />
          <ellipse cx="8" cy="8" rx="2.4" ry="5.5" />
          <line x1="2.5" y1="8" x2="13.5" y2="8" />
        </svg>
      );
  }
  return null;
}

// Rich text in labels: inline bold / italic / colour runs plus the
// miniature B / I / U toolbar from the edit-text controls.
export function RichTextArt() {
  const tools = [
    { k: 'B', weight: 700, italic: false, underline: false },
    { k: 'I', weight: 500, italic: true, underline: false },
    { k: 'U', weight: 500, italic: false, underline: true },
  ];
  return (
    <Frame>
      <div className="flex h-full flex-col justify-center gap-2 px-3">
        <div className="flex w-max items-center gap-0.5 rounded-md border border-slate-200 bg-white px-1 py-0.5 shadow-sm">
          {tools.map((t, i) => (
            <span
              key={t.k}
              className="relative flex h-4 w-4 items-center justify-center rounded text-[9px] text-slate-700"
              style={{
                fontWeight: t.weight,
                fontStyle: t.italic ? 'italic' : 'normal',
                textDecoration: t.underline ? 'underline' : 'none',
              }}
            >
              {t.k}
              {i === 0 && (
                <span className="fa-hl pointer-events-none absolute inset-0 rounded ring-2 ring-brand-500" />
              )}
            </span>
          ))}
        </div>
        <p className="text-[10px] leading-relaxed text-slate-700">
          A <span className="font-bold text-slate-900">bold</span> claim, an{' '}
          <span className="italic">italic</span> aside, and a{' '}
          <span className="font-semibold" style={{ color: PINK }}>
            splash
          </span>{' '}
          of colour.
        </p>
      </div>
    </Frame>
  );
}

// Link card: paste a URL and it unfurls into a bookmark with a preview
// image, favicon, title and host.
export function LinkCardArt() {
  return (
    <Frame canvas>
      <div className="flex h-full items-center justify-center">
        <div className="fa-pop w-[122px] overflow-hidden rounded-[4px] border border-slate-300 bg-white shadow-sm">
          <div className="h-8 bg-gradient-to-br from-sky-200 to-brand-300" />
          <div className="flex items-center gap-1.5 px-2 py-1.5">
            <span className="h-4 w-4 shrink-0 rounded-[2px] bg-brand-500" />
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-[8px] font-semibold text-slate-800">
                Design review
              </span>
              <span className="truncate text-[7px] text-slate-400">livediagram.app</span>
            </span>
          </div>
        </div>
      </div>
    </Frame>
  );
}

// Technology icons: full-colour cloud + brand tiles (AWS, Azure,
// Cloudflare, Firebase, plus a vendor-neutral set) for architecture
// diagrams, a brand highlight cycling across them like the real
// Technology picker.
export function TechIconsArt() {
  const tiles = [
    { label: 'AWS', bg: '#ff9900' },
    { label: 'Azure', bg: '#0078d4' },
    { label: 'CF', bg: '#f38020' },
    { label: 'Fire', bg: '#ffa000' },
    { label: 'K8s', bg: '#326ce5' },
    { label: 'Docker', bg: '#2496ed' },
  ];
  return (
    <Frame>
      <div className="flex h-full flex-col justify-center gap-1.5 px-3">
        <p className="text-[8px] font-semibold uppercase tracking-wider text-slate-500">
          Technology
        </p>
        <div className="grid grid-cols-3 gap-1.5">
          {tiles.map((t, i) => (
            <span
              key={t.label}
              className="relative flex h-7 items-center justify-center rounded text-[8px] font-bold text-white shadow-sm"
              style={{ backgroundColor: t.bg }}
            >
              {t.label}
              <span
                className="fa-hl pointer-events-none absolute inset-0 rounded ring-2 ring-brand-500"
                style={{ animationDelay: `${i * 0.6}s` }}
              />
            </span>
          ))}
        </div>
      </div>
    </Frame>
  );
}

// Ready-made components (spec/09): drop-in composites (Banner, Stat row, Hero,
// Header, Callout, Process) assembled from primitives, themed and fully
// editable. Shown as a Banner over a Stat row, dropping in.
export function ComponentsArt() {
  const stats = [
    { n: '128', cap: 'Users' },
    { n: '94%', cap: 'Uptime' },
    { n: '12', cap: 'Teams' },
  ];
  return (
    <Frame>
      <div className="flex h-full flex-col justify-center gap-2 px-3">
        {/* Banner — accent bar with title + subtitle */}
        <div className="fa-pop rounded-md bg-brand-500 px-2 py-1.5 text-white">
          <p className="text-[9px] font-semibold leading-tight">Launch plan</p>
          <p className="text-[7px] leading-tight text-brand-50">Q3 rollout overview</p>
        </div>
        {/* Stat row — three KPI cards */}
        <div className="flex gap-1.5">
          {stats.map((s, i) => (
            <div
              key={s.cap}
              className="fa-pop flex flex-1 flex-col items-center rounded-md border border-slate-200 bg-white py-1"
              style={{ animationDelay: `${0.4 + i * 0.3}s` }}
            >
              <span className="text-[11px] font-bold leading-none text-brand-600">{s.n}</span>
              <span className="mt-0.5 text-[6px] font-medium uppercase tracking-wide text-slate-400">
                {s.cap}
              </span>
            </div>
          ))}
        </div>
      </div>
    </Frame>
  );
}
