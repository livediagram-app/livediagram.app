// Feature art for the landing page's infographics section (docs/specs/019-marketing/marketing-site.md,
// docs/specs/007-editor/illustrate-pages.md). Small stills drawn from the same primitives as every
// other art block: pages in a row, a page built from a layout, backgrounds, a diagram laid out into
// pages, and pages leaving as a PDF.

import { BLUE_STROKE, Frame, INK_FILL, INK_STROKE, SKY } from './shared';

const SLATE_FILL = '#eef2f7';
const SLATE_STROKE = '#cbd5e1';
const PAGE = 'fill-(--art-paper) dark:stroke-slate-700';

// A sheet: white paper with the faint shadow edge every page in the editor has.
function Sheet({
  x,
  y,
  w,
  h,
  fill = '#fff',
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  fill?: string;
}) {
  return (
    <rect
      className={fill === '#fff' ? PAGE : undefined}
      x={x}
      y={y}
      width={w}
      height={h}
      rx="2"
      fill={fill}
      stroke={SLATE_STROKE}
      strokeWidth="1.2"
    />
  );
}

// A title bar and two lines of text at the top of a sheet.
function Heading({ x, y, w }: { x: number; y: number; w: number }) {
  return (
    <g>
      <rect
        className="fill-(--art-ink-stroke)"
        x={x}
        y={y}
        width={w * 0.6}
        height="4"
        rx="2"
        fill={INK_STROKE}
      />
      <rect
        className="fill-(--art-ink-fill)"
        x={x}
        y={y + 7}
        width={w * 0.85}
        height="2.5"
        rx="1.25"
        fill={SLATE_FILL}
      />
    </g>
  );
}

/** Three pages in a row: A4 portrait, a landscape slide, a square post. */
export function IllustratePagesArt() {
  return (
    <Frame canvas>
      <svg viewBox="0 0 220 96" className="absolute inset-0 h-full w-full">
        <Sheet x={22} y={14} w={48} h={68} />
        <Heading x={28} y={21} w={36} />
        <g className="fill-(--art-ink-stroke)" fill={INK_STROKE}>
          <rect x="30" y="58" width="6" height="16" rx="1" />
          <rect x="40" y="50" width="6" height="24" rx="1" />
          <rect x="50" y="42" width="6" height="32" rx="1" />
        </g>
        <Sheet x={80} y={28} w={70} h={40} />
        <Heading x={86} y={34} w={58} />
        <circle
          className="stroke-(--art-ink-stroke)"
          cx="132"
          cy="56"
          r="7"
          fill="none"
          stroke={SKY}
          strokeWidth="3"
        />
        <rect
          className="fill-(--art-ink-fill)"
          x="86"
          y="50"
          width="30"
          height="12"
          rx="2"
          fill={INK_FILL}
        />
        <Sheet x={160} y={28} w={40} h={40} />
        <Heading x={165} y={34} w={30} />
        <rect
          className="fill-(--art-ink-fill)"
          x="165"
          y="48"
          width="30"
          height="14"
          rx="2"
          fill={INK_FILL}
        />
      </svg>
    </Frame>
  );
}

/** A page built from a layout: a title, a row of stat cards, a chart. */
export function InfographicLayoutArt() {
  return (
    <Frame canvas>
      <svg viewBox="0 0 220 96" className="absolute inset-0 h-full w-full">
        <Sheet x={78} y={8} w={64} h={82} />
        <Heading x={85} y={15} w={50} />
        <g
          className="fill-(--art-ink-fill) stroke-(--art-ink-stroke)"
          fill={INK_FILL}
          stroke={INK_STROKE}
          strokeWidth="1"
        >
          <rect x="85" y="31" width="15" height="12" rx="2" />
          <rect x="102.5" y="31" width="15" height="12" rx="2" />
          <rect x="120" y="31" width="15" height="12" rx="2" />
        </g>
        <g className="fill-(--art-ink-stroke)" fill={INK_STROKE}>
          <rect x="89" y="68" width="7" height="14" rx="1" />
          <rect x="100" y="61" width="7" height="21" rx="1" />
          <rect x="111" y="55" width="7" height="27" rx="1" />
          <rect x="122" y="49" width="7" height="33" rx="1" />
        </g>
        {/* The layout picker beside it, one tile chosen. */}
        <g>
          <rect
            className={PAGE}
            x="156"
            y="20"
            width="18"
            height="24"
            rx="2"
            fill="#fff"
            stroke={BLUE_STROKE}
            strokeWidth="1.8"
          />
          <rect
            className={PAGE}
            x="178"
            y="20"
            width="18"
            height="24"
            rx="2"
            fill="#fff"
            stroke={SLATE_STROKE}
            strokeWidth="1.2"
          />
          <rect
            className={PAGE}
            x="156"
            y="50"
            width="18"
            height="24"
            rx="2"
            fill="#fff"
            stroke={SLATE_STROKE}
            strokeWidth="1.2"
          />
          <rect
            className={PAGE}
            x="178"
            y="50"
            width="18"
            height="24"
            rx="2"
            fill="#fff"
            stroke={SLATE_STROKE}
            strokeWidth="1.2"
          />
          <rect x="159" y="24" width="12" height="2.5" rx="1" fill={INK_STROKE} />
          <rect x="159" y="30" width="12" height="5" rx="1" fill={INK_FILL} />
        </g>
      </svg>
    </Frame>
  );
}

/** Pages painted three ways: a theme tint, a gradient with dots, a dark page with light ink. */
export function IllustrateBackgroundsArt() {
  return (
    <Frame canvas>
      <svg viewBox="0 0 220 96" className="absolute inset-0 h-full w-full">
        <defs>
          <linearGradient id="ig-dusk" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#fde68a" />
            <stop offset="1" stopColor="#fca5a5" />
          </linearGradient>
          <pattern id="ig-dots" width="6" height="6" patternUnits="userSpaceOnUse">
            <circle cx="3" cy="3" r="0.8" fill="#0f172a" fillOpacity="0.18" />
          </pattern>
        </defs>
        <Sheet x={30} y={14} w={44} h={64} fill="#e0f2fe" />
        <Heading x={36} y={22} w={32} />
        <rect x="88" y="14" width="44" height="64" rx="2" fill="url(#ig-dusk)" />
        <rect x="88" y="14" width="44" height="64" rx="2" fill="url(#ig-dots)" />
        <rect x="94" y="22" width="20" height="4" rx="2" fill="#7c2d12" />
        <rect x="146" y="14" width="44" height="64" rx="2" fill="#0f172a" />
        <rect x="152" y="22" width="20" height="4" rx="2" fill="#f8fafc" />
        <rect x="152" y="29" width="28" height="2.5" rx="1.25" fill="#94a3b8" />
        <rect
          x="152"
          y="44"
          width="32"
          height="22"
          rx="2"
          fill="none"
          stroke="#7dd3fc"
          strokeWidth="1.2"
        />
      </svg>
    </Frame>
  );
}

/** A diagram on the loose, laid out onto pages of its own. */
export function IllustrateIntoPagesArt() {
  return (
    <Frame canvas>
      <svg viewBox="0 0 220 96" className="absolute inset-0 h-full w-full">
        <g
          className="fill-(--art-ink-fill) stroke-(--art-ink-stroke)"
          fill={INK_FILL}
          stroke={INK_STROKE}
          strokeWidth="1.2"
        >
          <rect x="12" y="20" width="22" height="10" rx="3" />
          <rect x="40" y="38" width="22" height="10" rx="3" />
          <rect x="12" y="62" width="22" height="10" rx="3" />
        </g>
        <path
          className="stroke-(--art-arrow)"
          d="M23 30v32M34 25l6 13"
          stroke="#334155"
          strokeWidth="1"
          fill="none"
        />
        <path
          className="stroke-(--art-arrow)"
          d="M76 48h18M89 43l5 5-5 5"
          stroke="#334155"
          strokeWidth="1.5"
          fill="none"
          strokeLinecap="round"
        />
        <Sheet x={106} y={16} w={44} h={62} />
        <g fill={INK_FILL} stroke={INK_STROKE} strokeWidth="1.2">
          <rect x="114" y="26" width="16" height="7" rx="2" />
          <rect x="130" y="40" width="14" height="7" rx="2" />
          <rect x="114" y="56" width="16" height="7" rx="2" />
        </g>
        <Sheet x={160} y={26} w={48} h={42} />
        <g fill={INK_FILL} stroke={INK_STROKE} strokeWidth="1.2">
          <circle cx="184" cy="47" r="6" />
          <rect x="166" y="34" width="12" height="6" rx="2" />
          <rect x="190" y="54" width="12" height="6" rx="2" />
        </g>
      </svg>
    </Frame>
  );
}

/** Pages leaving as one PDF, a page apiece. */
export function IllustrateExportArt() {
  return (
    <Frame canvas>
      <svg viewBox="0 0 220 96" className="absolute inset-0 h-full w-full">
        <Sheet x={24} y={18} w={36} h={52} />
        <Heading x={29} y={24} w={26} />
        <Sheet x={66} y={18} w={36} h={52} />
        <Heading x={71} y={24} w={26} />
        <path
          className="stroke-(--art-arrow)"
          d="M112 44h22M129 39l5 5-5 5"
          stroke="#334155"
          strokeWidth="1.5"
          fill="none"
          strokeLinecap="round"
        />
        <rect
          className={PAGE}
          x="152"
          y="20"
          width="40"
          height="54"
          rx="2"
          fill="#fff"
          stroke={SLATE_STROKE}
          strokeWidth="1.2"
        />
        <rect
          className={PAGE}
          x="148"
          y="16"
          width="40"
          height="54"
          rx="2"
          fill="#fff"
          stroke={SLATE_STROKE}
          strokeWidth="1.2"
        />
        <rect x="156" y="52" width="24" height="12" rx="2" fill="#ef4444" />
        <text x="168" y="61" textAnchor="middle" fontSize="8" fontWeight="700" fill="#fff">
          PDF
        </text>
        <Heading x={153} y={23} w={30} />
      </svg>
    </Frame>
  );
}
