// Feature art for the isometric view (docs/specs/019-marketing/marketing-site.md): the canvas tilted
// into 3D. Built on ./page-kit so it reads in light and in dark.

import { Frame } from './shared';
import {
  at,
  EMERALD,
  INK,
  INK_SOFT,
  SKY,
  SKY_DEEP,
  VIOLET,
} from './page-kit';

// One plane of the tilted canvas: a rhombus centred on (110, y).
function Plane({
  y,
  className,
  fill,
  stroke,
}: {
  y: number;
  className: string;
  fill: string;
  stroke: string;
}) {
  return (
    <path
      className={className}
      d={`M64 ${y} L150 ${y + 17} L236 ${y} L150 ${y - 17} Z`}
      fill={fill}
      stroke={stroke}
      strokeWidth="0.8"
      strokeLinejoin="round"
    />
  );
}

// A box standing on the plane, drawn as a solid: top face, left side, right side.
function IsoBox({ cx, cy, color }: { cx: number; cy: number; color: string }) {
  const w = 10;
  const h = 5.2;
  const lift = 7;
  return (
    <g strokeLinejoin="round">
      <path
        d={`M${cx - w} ${cy - lift} L${cx} ${cy - lift + h} L${cx} ${cy + h} L${cx - w} ${cy} Z`}
        fill={color}
        fillOpacity="0.75"
      />
      <path
        d={`M${cx} ${cy - lift + h} L${cx + w} ${cy - lift} L${cx + w} ${cy} L${cx} ${cy + h} Z`}
        fill={color}
        fillOpacity="0.55"
      />
      <path
        d={`M${cx - w} ${cy - lift} L${cx} ${cy - lift + h} L${cx + w} ${cy - lift} L${cx} ${cy - lift - h} Z`}
        fill={color}
      />
    </g>
  );
}

/** Tilt the canvas into 3D: the layers lifted apart, each still holding its shapes, and the orbit control. */
export function IsometricArt() {
  return (
    <Frame canvas>
      <svg viewBox="0 0 300 96" className="absolute inset-0 h-full w-full">
        {/* The guides that tie the layers to one another. */}
        <path
          className="stroke-slate-300 dark:stroke-slate-600"
          d="M64 34V74M236 34V74M150 17V57"
          stroke="#cbd5e1"
          strokeWidth="0.6"
          strokeDasharray="1.6 1.6"
        />
        <g className="fa-e-float" style={at(0.8)}>
          <Plane
            y={72}
            className="fill-slate-100 stroke-slate-300 dark:fill-slate-800 dark:stroke-slate-600"
            fill="#f1f5f9"
            stroke="#cbd5e1"
          />
          <IsoBox cx={118} cy={76} color="#94a3b8" />
        </g>
        <g className="fa-e-float" style={at(0.4)}>
          <Plane
            y={54}
            className="fill-sky-50/90 dark:fill-sky-950/90"
            fill="#f0f9ff"
            stroke="#7dd3fc"
          />
          <IsoBox cx={186} cy={56} color={VIOLET} />
        </g>
        <g className="fa-e-float" style={at(0)}>
          <Plane
            y={36}
            className="fill-white/95 dark:fill-slate-900/95"
            fill="#ffffff"
            stroke={SKY}
          />
          <IsoBox cx={128} cy={36} color={SKY} />
          <IsoBox cx={168} cy={41} color={EMERALD} />
          <path d="M135 40.5 L159 45" stroke={SKY_DEEP} strokeWidth="0.9" strokeLinecap="round" />
        </g>
        {/* Layer names, as the Layers panel calls them. */}
        {[
          ['Notes', 36],
          ['Flow', 54],
          ['Base', 72],
        ].map(([name, y]) => (
          <text
            key={name}
            x="248"
            y={Number(y) + 1.5}
            fontSize="4.2"
            fontWeight="600"
            className={INK_SOFT}
            fill="#64748b"
          >
            {name}
          </text>
        ))}
        {/* The orbit control, from the zoom cluster. */}
        <g>
          <rect
            className="fill-white stroke-slate-200 dark:fill-slate-900 dark:stroke-slate-700"
            x="12"
            y="10"
            width="40"
            height="11"
            rx="5.5"
            fill="#ffffff"
            stroke="#e2e8f0"
            strokeWidth="0.7"
          />
          <ellipse cx="20" cy="15.5" rx="4" ry="2" fill="none" stroke={SKY} strokeWidth="0.8" />
          <circle cx="23.5" cy="14.6" r="1" fill={SKY} />
          <text x="27" y="17.1" fontSize="4.4" fontWeight="700" className={INK} fill="#1e293b">
            Isometric
          </text>
        </g>
      </svg>
    </Frame>
  );
}
