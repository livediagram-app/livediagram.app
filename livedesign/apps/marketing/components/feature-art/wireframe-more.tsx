// The Logos section's wireframe and picture cards beyond the first screens (docs/specs/009-elements/components.md,
// docs/specs/009-elements/picture-crop-and-mask.md): a component's main redrawing its instances on every screen, and a
// picture cropped, masked and turned grey. Same vocabulary as ./logo-more and ./prototype (page-kit's colours, the
// fa-e-* loops in app/feature-art/pages.css); under reduced motion each shows its finished frame.

import { Frame } from '@liveworkspace/marketing-site/components/feature-art/shared';
import {
  at,
  INK,
  INK_SOFT,
  LINE,
  Lines,
  Panel,
  SKY,
  VIOLET,
} from '@liveworkspace/marketing-site/components/feature-art/page-kit';

const SCREEN = 'fill-white stroke-slate-300 dark:fill-slate-800 dark:stroke-slate-500';
const BLOCK = 'fill-slate-200 dark:fill-slate-600';

/** A phone screen with its own body, under the nav bar its instance draws. */
function Screen({ x, body }: { x: number; body: number }) {
  return (
    <g>
      <rect
        className={SCREEN}
        x={x}
        y="16"
        width="44"
        height="74"
        rx="6"
        fill="#ffffff"
        stroke="#cbd5e1"
        strokeWidth="1"
      />
      <rect className={BLOCK} x={x + 5} y="36" width="34" height={body} rx="2" fill="#e2e8f0" />
      <Lines x={x + 5} y={40 + body} w={34} count={3} gap={5} />
    </g>
  );
}

/** The nav bar a component draws: a logo dot, a title bar and a menu. */
function NavBar({ x, y, w }: { x: number; y: number; w: number }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height="10" rx="2" fill={VIOLET} fillOpacity="0.14" />
      <circle cx={x + 5} cy={y + 5} r="2.4" fill={VIOLET} />
      <rect x={x + 10} y={y + 4} width={w * 0.34} height="2" rx="1" fill={VIOLET} />
      <rect x={x + w - 8} y={y + 3} width="5" height="1" rx="0.5" fill={VIOLET} />
      <rect x={x + w - 8} y={y + 5} width="5" height="1" rx="0.5" fill={VIOLET} />
      <rect x={x + w - 8} y={y + 7} width="5" height="1" rx="0.5" fill={VIOLET} />
    </g>
  );
}

/** Components: the Nav Bar main in the palette's In This Design band, its instance redrawn on three screens. */
export function ComponentsArt() {
  const screens = [
    { x: 118, body: 18 },
    { x: 174, body: 12 },
    { x: 230, body: 24 },
  ];
  return (
    <Frame canvas>
      <svg viewBox="0 0 300 96" className="absolute inset-0 h-full w-full">
        {/* The palette's Components category, its In This Design band holding the main. */}
        <Panel x={12} y={12} w={88} h={72} title="Components" />
        <text x="18" y="31" fontSize="4.6" fontWeight="600" className={INK_SOFT} fill="#64748b">
          In This Design
        </text>
        <rect
          className="fill-slate-50 stroke-slate-200 dark:fill-slate-800 dark:stroke-slate-600"
          x="18"
          y="35"
          width="76"
          height="24"
          rx="3"
          fill="#f8fafc"
          stroke="#e2e8f0"
          strokeWidth="0.7"
        />
        <NavBar x={22} y={39} w={68} />
        <text x="22" y="56" fontSize="5" fontWeight="700" className={INK} fill="#1e293b">
          Nav Bar
        </text>
        <text x="18" y="70" fontSize="4.6" className={INK_SOFT} fill="#64748b">
          3 instances
        </text>
        {/* The edit to the main, a pulse leaving it for the screens. */}
        <rect
          className="fa-e-pop"
          style={at(0.4)}
          x="20.5"
          y="37.5"
          width="71"
          height="13"
          rx="3"
          fill="none"
          stroke={VIOLET}
          strokeWidth="1.1"
        />
        <path
          className="fa-e-in"
          style={at(0.7)}
          d="M100 44h12m-4-3 4 3-4 3"
          fill="none"
          stroke={VIOLET}
          strokeWidth="1"
          strokeDasharray="2.5 2"
        />

        {/* Three screens, each instance redrawing as the main changes. */}
        {screens.map((s, i) => (
          <g key={s.x}>
            <Screen x={s.x} body={s.body} />
            <g className="fa-e-pop" style={at(0.9 + i * 0.25)}>
              <NavBar x={s.x + 3} y={21} w={38} />
            </g>
          </g>
        ))}
      </svg>
    </Frame>
  );
}

// The picture every card here crops: a sky, a sun and a hill, drawn into the box it is clipped to.
type LandscapeProps = { x: number; y: number; w: number; h: number; mono?: boolean };

function Landscape({ x, y, w, h, mono = false }: LandscapeProps) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill={mono ? '#cbd5e1' : '#bae6fd'} />
      <circle
        cx={x + w * 0.68}
        cy={y + h * 0.32}
        r={h * 0.13}
        fill={mono ? '#f1f5f9' : '#fde047'}
      />
      <path
        d={`M${x} ${y + h * 0.7} C${x + w * 0.25} ${y + h * 0.48} ${x + w * 0.5} ${y + h * 0.6} ${x + w * 0.7} ${y + h * 0.64} S${x + w * 0.9} ${y + h * 0.56} ${x + w} ${y + h * 0.6} V${y + h} H${x} Z`}
        fill={mono ? '#64748b' : '#4ade80'}
      />
      <path
        d={`M${x} ${y + h * 0.88} C${x + w * 0.35} ${y + h * 0.76} ${x + w * 0.65} ${y + h * 0.82} ${x + w} ${y + h * 0.84} V${y + h} H${x} Z`}
        fill={mono ? '#334155' : '#15803d'}
      />
    </g>
  );
}

/** Crop and mask: the picture cropped with its handles, then cut to a Circle, an Arch in Greyscale and a Star. */
export function PictureMaskArt() {
  const star = (cx: number, cy: number, r: number) =>
    Array.from({ length: 10 }, (_, i) => {
      const a = (Math.PI / 5) * i - Math.PI / 2;
      const rr = i % 2 === 0 ? r : r * 0.4;
      return `${(cx + rr * Math.cos(a)).toFixed(2)} ${(cy + rr * Math.sin(a)).toFixed(2)}`;
    }).join(' L');
  const masks = [
    { label: 'Circle', clip: <circle cx="156" cy="44" r="20" /> },
    {
      label: 'Arch',
      clip: <path d="M190 64 V44 a20 20 0 0 1 40 0 V64 Z" />,
      mono: true,
    },
    { label: 'Star', clip: <path d={`M${star(264, 45, 22)} Z`} /> },
  ];
  return (
    <Frame canvas>
      <svg viewBox="0 0 300 96" className="absolute inset-0 h-full w-full">
        <defs>
          <clipPath id="pm-crop">
            <rect x="22" y="22" width="72" height="48" rx="1" />
          </clipPath>
          {masks.map((m) => (
            <clipPath key={m.label} id={`pm-${m.label}`}>
              {m.clip}
            </clipPath>
          ))}
        </defs>
        {/* The whole picture, faint, and the part the crop keeps. */}
        <g opacity="0.3">
          <Landscape x={12} y={14} w={96} h={64} />
        </g>
        <g clipPath="url(#pm-crop)">
          <Landscape x={12} y={14} w={96} h={64} />
        </g>
        <rect x="22" y="22" width="72" height="48" fill="none" stroke={SKY} strokeWidth="1" />
        {[
          [22, 22],
          [94, 22],
          [22, 70],
          [94, 70],
        ].map(([cx, cy]) => (
          <rect
            key={`${cx}-${cy}`}
            className="fill-white dark:fill-slate-900"
            x={cx! - 2.2}
            y={cy! - 2.2}
            width="4.4"
            height="4.4"
            rx="0.8"
            fill="#ffffff"
            stroke={SKY}
            strokeWidth="0.9"
          />
        ))}
        <text x="58" y="86" textAnchor="middle" fontSize="5.2" fontWeight="600" fill={SKY}>
          Crop Image
        </text>

        {/* The same picture cut to three of its masks, one in Greyscale. */}
        {masks.map((m, i) => {
          const x = 132 + i * 54;
          return (
            <g key={m.label} className="fa-e-pop" style={at(0.5 + i * 0.4)}>
              <g clipPath={`url(#pm-${m.label})`}>
                <Landscape x={x} y={18} w={48} h={50} mono={m.mono} />
              </g>
              <text
                x={x + 24}
                y="80"
                textAnchor="middle"
                fontSize="5"
                fontWeight="600"
                className={INK_SOFT}
                fill="#64748b"
              >
                {m.mono ? `${m.label} · Greyscale` : m.label}
              </text>
            </g>
          );
        })}
        <rect className={LINE} x="120" y="22" width="0.8" height="52" fill="#e2e8f0" />
      </svg>
    </Frame>
  );
}
