import { FONT, TEAMMATE, YOU, at } from '@/components/art-tokens';
import { CursorMark } from '@/components/hero-cursor';

// The Photos window (docs/specs/019-marketing/marketing-site.md "Story beats"): a photo page in
// Pages (docs/specs/031-photo/photo-pages.md). The picture builds up layer by layer (the sky, the
// hills, the sun) while each lands as a row in the Layers panel beside it; you select the sun, a
// warming adjustment layer goes on top, and a teammate exports the photo as a PSD with its layers
// kept. Every piece plays at its own --d (hero-scenes/pages.css).

const INK = '#1e293b';
const MUTED = '#64748b';
const LINE = '#e2e8f0';
const SKY = '#0ea5e9';
const AMBER = '#f59e0b';

const PHOTO = { w: 300, h: 200 } as const;

// The layer stack, top first, as the Layers panel lists it.
const LAYERS = [
  { name: 'Warm', note: 'Photo Filter', d: 3.6, swatch: AMBER, adjustment: true },
  { name: 'Sun', note: 'Screen', d: 1.6, swatch: '#fde047' },
  { name: 'Hills', note: 'Mask', d: 1.1, swatch: '#15803d' },
  { name: 'Sky', note: 'Normal', d: 0.6, swatch: '#38bdf8' },
] as const;

function Photo({ x, y }: { x: number; y: number }) {
  const sun = { cx: x + 206, cy: y + 78 };
  return (
    <g>
      <text x={x} y={y - 8} fontFamily={FONT} fontSize="9" fontWeight="600" fill={MUTED}>
        Photo · 1600 x 1067
      </text>
      <defs>
        <linearGradient id="hp-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7dd3fc" />
          <stop offset="1" stopColor="#e0f2fe" />
        </linearGradient>
        <clipPath id="hp-clip">
          <rect x={x} y={y} width={PHOTO.w} height={PHOTO.h} rx="4" />
        </clipPath>
      </defs>
      <rect
        className="hm-pop"
        style={at(0.2)}
        x={x}
        y={y}
        width={PHOTO.w}
        height={PHOTO.h}
        rx="4"
        fill="#ffffff"
        stroke={LINE}
      />
      <g clipPath="url(#hp-clip)">
        <rect
          className="hm-fade"
          style={at(0.6)}
          x={x}
          y={y}
          width={PHOTO.w}
          height={PHOTO.h}
          fill="url(#hp-sky)"
        />
        <circle className="hm-pop" style={at(1.6)} cx={sun.cx} cy={sun.cy} r="26" fill="#fde047" />
        <g className="hm-fade" style={at(1.1)}>
          <path
            d={`M${x} ${y + 150} C${x + 60} ${y + 104} ${x + 110} ${y + 118} ${x + 160} ${y + 136} S${x + 250} ${y + 112} ${x + PHOTO.w} ${y + 128} V${y + PHOTO.h} H${x} Z`}
            fill="#4ade80"
          />
          <path
            d={`M${x} ${y + 176} C${x + 80} ${y + 150} ${x + 170} ${y + 158} ${x + PHOTO.w} ${y + 168} V${y + PHOTO.h} H${x} Z`}
            fill="#15803d"
          />
        </g>
        {/* The warming adjustment layer, over everything. */}
        <rect
          className="hm-fade"
          style={at(3.6)}
          x={x}
          y={y}
          width={PHOTO.w}
          height={PHOTO.h}
          fill={AMBER}
          fillOpacity="0.22"
        />
      </g>
      {/* Your selection round the sun, its marching ants for a moment. */}
      <circle
        className="hm-select"
        style={at(2.4)}
        cx={sun.cx}
        cy={sun.cy}
        r="32"
        fill="none"
        stroke={INK}
        strokeWidth="1.4"
        strokeDasharray="5 4"
      />
    </g>
  );
}

function LayersPanel({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <g className="hm-pop" style={at(0.4)}>
        <rect x={x} y={y} width="200" height="232" rx="8" fill="#ffffff" stroke={LINE} />
        {['Layers', 'Adjust', 'History'].map((tab, i) => (
          <text
            key={tab}
            x={x + 14 + i * 52}
            y={y + 22}
            fontFamily={FONT}
            fontSize="10"
            fontWeight={i === 0 ? 700 : 500}
            fill={i === 0 ? INK : MUTED}
          >
            {tab}
          </text>
        ))}
        <rect x={x + 14} y={y + 27} width="34" height="2" rx="1" fill={SKY} />
        <line x1={x} x2={x + 200} y1={y + 34} y2={y + 34} stroke={LINE} />
      </g>
      {LAYERS.map((layer, i) => {
        const ry = y + 44 + i * 34;
        return (
          <g key={layer.name} className="hm-pop" style={at(layer.d)}>
            <rect
              x={x + 10}
              y={ry}
              width="180"
              height="28"
              rx="5"
              fill={i === 0 ? '#fffbeb' : '#f8fafc'}
              stroke={i === 0 ? '#fde68a' : LINE}
            />
            <rect
              x={x + 18}
              y={ry + 5}
              width="18"
              height="18"
              rx="3"
              fill={layer.swatch}
              fillOpacity={'adjustment' in layer ? 0.5 : 1}
            />
            <text
              x={x + 44}
              y={ry + 13}
              fontFamily={FONT}
              fontSize="9.5"
              fontWeight="700"
              fill={INK}
            >
              {layer.name}
            </text>
            <text x={x + 44} y={ry + 23} fontFamily={FONT} fontSize="8" fill={MUTED}>
              {layer.note}
            </text>
            {/* Its eye: shown. */}
            <path
              d={`M${x + 166} ${ry + 14}c3-4.5 11-4.5 14 0c-3 4.5-11 4.5-14 0z`}
              fill="none"
              stroke={MUTED}
              strokeWidth="1.2"
            />
            <circle cx={x + 173} cy={ry + 14} r="1.8" fill={MUTED} />
          </g>
        );
      })}
      {/* Export, as a PSD with its layers kept. */}
      <g className="hm-pop" style={at(4.8)}>
        <rect x={x + 10} y={y + 186} width="180" height="34" rx="6" fill={SKY} />
        <text
          x={x + 100}
          y={y + 207}
          textAnchor="middle"
          fontFamily={FONT}
          fontSize="10"
          fontWeight="700"
          fill="#ffffff"
        >
          Export PSD, layers kept
        </text>
      </g>
    </g>
  );
}

export function PhotoBoard() {
  const photo = { x: 40, y: -10 };
  const panel = { x: 370, y: -30 };
  return (
    <>
      <Photo x={photo.x} y={photo.y} />
      <LayersPanel x={panel.x} y={panel.y} />
      {/* You, selecting the sun. */}
      <g
        className="hm-cursor"
        style={at(1.9, {
          '--sx': `${photo.x - 40}px`,
          '--sy': '300px',
          '--cx': `${photo.x + 236}px`,
          '--cy': `${photo.y + 104}px`,
        })}
      >
        <CursorMark colour={YOU} label="TM" />
      </g>
      {/* The teammate, exporting it. */}
      <g
        className="hm-cursor"
        style={at(5.2, {
          '--sx': '640px',
          '--sy': '300px',
          '--cx': `${panel.x + 150}px`,
          '--cy': `${panel.y + 206}px`,
        })}
      >
        <CursorMark colour={TEAMMATE} label="JR" />
      </g>
    </>
  );
}
