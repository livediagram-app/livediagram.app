import { FONT, TEAMMATE, at } from '@/components/art-tokens';
import { CursorMark } from '@/components/hero-cursor';

// The Logos window (docs/specs/019-marketing/marketing-site.md "Story beats"): a logo page in
// Pages (docs/specs/007-editor/logo-pages.md). The square artboard lands with its construction
// guides, one petal is drawn and Mirror draws its twin, the dot and the wordmark land, then a
// teammate opens the Logo Kit beside it and the mark appears at icon sizes. Every piece plays at
// its own --d (hero-scenes/pages.css).

const SKY = '#0ea5e9';
const VIOLET = '#8b5cf6';
const INK = '#1e293b';
const MUTED = '#64748b';
const GUIDE = '#38bdf8';

const BOARD = 230;

// The mark, in the board's own units: two mirrored petals round a dot.
function petal(cx: number, cy: number) {
  return `M${cx} ${cy + 54} C${cx - 52} ${cy + 24} ${cx - 46} ${cy - 36} ${cx} ${cy - 54}`;
}

function Board({ x, y }: { x: number; y: number }) {
  const cx = x + BOARD / 2;
  const cy = y + 100;
  const d = petal(cx, cy);
  return (
    <g>
      <text x={x} y={y - 8} fontFamily={FONT} fontSize="9" fontWeight="600" fill={MUTED}>
        Logo
      </text>
      <rect
        className="hm-pop"
        style={at(0.2)}
        x={x}
        y={y}
        width={BOARD}
        height={BOARD}
        rx="4"
        fill="#ffffff"
        stroke="#e2e8f0"
      />
      {/* The construction guides: safe area, centre line, diagonals and keyline circles. */}
      <g
        className="hm-fade"
        style={at(0.6)}
        fill="none"
        stroke={GUIDE}
        strokeOpacity="0.5"
        strokeWidth="0.8"
      >
        <rect x={x + 23} y={y + 23} width={BOARD - 46} height={BOARD - 46} strokeDasharray="3 3" />
        <line x1={x} y1={cy} x2={x + BOARD} y2={cy} />
        <line x1={x} y1={y} x2={x + BOARD} y2={y + BOARD} />
        <line x1={x + BOARD} y1={y} x2={x} y2={y + BOARD} />
        <circle cx={cx} cy={cy} r="72" />
        <circle cx={cx} cy={cy} r="42" />
      </g>
      {/* The mirror axis. */}
      <line
        className="hm-fade"
        style={at(1)}
        x1={cx}
        y1={y}
        x2={cx}
        y2={y + BOARD}
        stroke={VIOLET}
        strokeOpacity="0.7"
        strokeWidth="1.2"
      />
      {/* One petal drawn, its twin drawn with it. */}
      <path
        className="hm-draw"
        style={at(1.4, { '--len': 140, '--dur': '1.2s' })}
        d={d}
        fill="none"
        stroke={SKY}
        strokeWidth="12"
        strokeLinecap="round"
      />
      <g transform={`translate(${2 * cx} 0) scale(-1 1)`}>
        <path
          className="hm-draw"
          style={at(1.4, { '--len': 140, '--dur': '1.2s' })}
          d={d}
          fill="none"
          stroke={SKY}
          strokeWidth="12"
          strokeLinecap="round"
        />
      </g>
      <circle className="hm-pop" style={at(2.8)} cx={cx} cy={cy} r="14" fill={VIOLET} />
      <text
        className="hm-type"
        style={at(3.3, { '--steps': 5 })}
        x={cx}
        y={y + BOARD - 22}
        textAnchor="middle"
        fontFamily={FONT}
        fontSize="20"
        fontWeight="800"
        letterSpacing="5"
        fill={INK}
      >
        BLOOM
      </text>
    </g>
  );
}

// The finished mark at a size, for the kit's icon tiles.
function Mark({ x, y, size, dark }: { x: number; y: number; size: number; dark?: boolean }) {
  const s = size / 150;
  const cx = 75;
  const cy = 75;
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={size}
        height={size}
        rx={size * 0.22}
        fill={dark ? '#0f172a' : '#ffffff'}
        stroke={dark ? '#334155' : '#e2e8f0'}
      />
      <g transform={`translate(${x} ${y}) scale(${s})`}>
        <path d={petal(cx, cy)} fill="none" stroke={SKY} strokeWidth="14" strokeLinecap="round" />
        <path
          d={petal(cx, cy)}
          transform={`translate(${2 * cx} 0) scale(-1 1)`}
          fill="none"
          stroke={SKY}
          strokeWidth="14"
          strokeLinecap="round"
        />
        <circle cx={cx} cy={cy} r="16" fill={VIOLET} />
      </g>
    </g>
  );
}

function Kit({ x, y }: { x: number; y: number }) {
  const files = [
    ['logo.svg', 'Vector'],
    ['PNG', '16 to 1024 px'],
    ['favicon.ico', 'Tab icon'],
  ] as const;
  return (
    <g className="hm-pop" style={at(4.6)}>
      <rect x={x} y={y} width="190" height="150" rx="8" fill="#ffffff" stroke="#e2e8f0" />
      <text x={x + 14} y={y + 24} fontFamily={FONT} fontSize="12" fontWeight="700" fill={INK}>
        Logo Kit
      </text>
      {files.map(([file, note], i) => (
        <g key={file} className="hm-fade" style={at(5 + i * 0.25)}>
          <rect
            x={x + 14}
            y={y + 36 + i * 26}
            width="162"
            height="20"
            rx="4"
            fill="#f8fafc"
            stroke="#e2e8f0"
          />
          <text
            x={x + 22}
            y={y + 50 + i * 26}
            fontFamily={FONT}
            fontSize="9.5"
            fontWeight="700"
            fill={INK}
          >
            {file}
          </text>
          <text
            x={x + 168}
            y={y + 50 + i * 26}
            textAnchor="end"
            fontFamily={FONT}
            fontSize="8.5"
            fill={MUTED}
          >
            {note}
          </text>
        </g>
      ))}
      <rect x={x + 14} y={y + 116} width="162" height="22" rx="5" fill={SKY} />
      <text
        x={x + 95}
        y={y + 131}
        textAnchor="middle"
        fontFamily={FONT}
        fontSize="10"
        fontWeight="700"
        fill="#ffffff"
      >
        Download .zip
      </text>
    </g>
  );
}

export function LogoBoard() {
  const board = { x: 60, y: -30 };
  const kit = { x: 340, y: -10 };
  const icons = { x: 345, y: 160 };
  return (
    <>
      <Board x={board.x} y={board.y} />
      <Kit x={kit.x} y={kit.y} />
      <g className="hm-pop" style={at(6)}>
        <Mark x={icons.x} y={icons.y} size={64} />
        <Mark x={icons.x + 76} y={icons.y + 12} size={44} dark />
        <Mark x={icons.x + 132} y={icons.y + 22} size={26} />
      </g>
      {/* The teammate who opened the kit. */}
      <g
        className="hm-cursor"
        style={at(4.2, {
          '--sx': '640px',
          '--sy': '60px',
          '--cx': `${kit.x + 120}px`,
          '--cy': `${kit.y + 124}px`,
        })}
      >
        <CursorMark colour={TEAMMATE} label="JR" />
      </g>
    </>
  );
}
