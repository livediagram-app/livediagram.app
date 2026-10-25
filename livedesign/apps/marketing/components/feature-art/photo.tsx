// Feature art for photo pages (docs/specs/019-marketing/marketing-site.md,
// docs/specs/031-photo/photo-pages.md): the layer stack beside the picture it makes, adjustments and
// filters, selecting and retouching, and a PSD out with its layers kept. Each is a small mock of the
// real surface, built on ./page-kit so it reads in light and in dark.

import type { CSSProperties } from 'react';
import { Frame } from '@liveworkspace/marketing-site/components/feature-art/shared';
import {
  AMBER,
  at,
  EMERALD,
  INK,
  INK_SOFT,
  Page,
  Panel,
  ROSE,
  SKY,
  VIOLET,
} from '@liveworkspace/marketing-site/components/feature-art/page-kit';

// A landscape picture in miniature: a sky, a sun and two hills, clipped to its page. `warm` lays a
// warming adjustment over it.
function Picture({
  id,
  x,
  y,
  w,
  h,
  warm = false,
  mono = false,
}: {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  warm?: boolean;
  mono?: boolean;
}) {
  return (
    <g>
      <defs>
        <linearGradient id={`${id}-sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={mono ? '#94a3b8' : '#7dd3fc'} />
          <stop offset="1" stopColor={mono ? '#e2e8f0' : '#e0f2fe'} />
        </linearGradient>
        <clipPath id={`${id}-clip`}>
          <rect x={x} y={y} width={w} height={h} rx="1.6" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${id}-clip)`}>
        <rect x={x} y={y} width={w} height={h} fill={`url(#${id}-sky)`} />
        <circle
          cx={x + w * 0.7}
          cy={y + h * 0.36}
          r={h * 0.15}
          fill={mono ? '#f1f5f9' : '#fde047'}
        />
        <path
          d={`M${x} ${y + h * 0.72} C${x + w * 0.2} ${y + h * 0.5} ${x + w * 0.4} ${y + h * 0.58} ${x + w * 0.55} ${y + h * 0.66} S${x + w * 0.85} ${y + h * 0.54} ${x + w} ${y + h * 0.62} V${y + h} H${x} Z`}
          fill={mono ? '#64748b' : '#4ade80'}
        />
        <path
          d={`M${x} ${y + h * 0.88} C${x + w * 0.3} ${y + h * 0.74} ${x + w * 0.6} ${y + h * 0.8} ${x + w} ${y + h * 0.84} V${y + h} H${x} Z`}
          fill={mono ? '#334155' : '#15803d'}
        />
        {warm ? <rect x={x} y={y} width={w} height={h} fill={AMBER} fillOpacity="0.22" /> : null}
      </g>
    </g>
  );
}

// An eye, as the Layers panel shows a layer that is visible.
function Eye({ x, y }: { x: number; y: number }) {
  return (
    <g className="stroke-slate-400 dark:stroke-slate-500" stroke="#94a3b8" fill="none">
      <path d={`M${x} ${y}c2-2.8 7-2.8 9 0c-2 2.8-7 2.8-9 0z`} strokeWidth="0.7" />
      <circle cx={x + 4.5} cy={y} r="1" strokeWidth="0.7" />
    </g>
  );
}

/** Layers: the picture and the Layers panel beside it, a glow layer set to Screen landing on top. */
export function PhotoLayersArt() {
  const layers: { name: string; note: string; swatch: string; style?: CSSProperties }[] = [
    { name: 'Glow', note: 'Screen · 80%', swatch: AMBER, style: at(0.6) },
    { name: 'Hills', note: 'Mask', swatch: EMERALD },
    { name: 'Sky', note: 'Normal', swatch: SKY },
  ];
  return (
    <Frame canvas>
      <svg viewBox="0 0 300 96" className="absolute inset-0 h-full w-full">
        <Page x={34} y={14} w={104} h={68}>
          <Picture id="pl" x={34} y={14} w={104} h={68} />
          {/* The glow layer, screened over the sun. */}
          <circle
            className="fa-e-in"
            style={at(0.6)}
            cx={34 + 104 * 0.7}
            cy={14 + 68 * 0.36}
            r="18"
            fill="#fef3c7"
            fillOpacity="0.55"
          />
        </Page>
        <Panel x={156} y={8} w={110} h={80} title="Layers">
          {layers.map((layer, i) => {
            const y = 17 + i * 21;
            return (
              <g
                key={layer.name}
                className={layer.style ? 'fa-e-in' : undefined}
                style={layer.style}
              >
                <rect
                  className={
                    i === 0
                      ? 'fill-amber-50 stroke-amber-200 dark:fill-amber-500/10 dark:stroke-amber-500/40'
                      : 'fill-slate-50 stroke-slate-200 dark:fill-slate-800 dark:stroke-slate-700'
                  }
                  x="161"
                  y={y}
                  width="100"
                  height="17"
                  rx="2.6"
                  fill={i === 0 ? '#fffbeb' : '#f8fafc'}
                  stroke={i === 0 ? '#fde68a' : '#e2e8f0'}
                  strokeWidth="0.6"
                />
                <rect x="165" y={y + 3} width="11" height="11" rx="1.6" fill={layer.swatch} />
                {layer.name === 'Hills' ? (
                  // Its mask, beside it: white where it shows, black where it hides.
                  <g>
                    <rect x="178" y={y + 3} width="11" height="11" rx="1.6" fill="#0f172a" />
                    <path d={`M178 ${y + 10}q5.5-5 11 -2v6h-11z`} fill="#ffffff" />
                  </g>
                ) : null}
                <text
                  x={layer.name === 'Hills' ? 193 : 180}
                  y={y + 7.8}
                  fontSize="4.8"
                  fontWeight="700"
                  className={INK}
                  fill="#1e293b"
                >
                  {layer.name}
                </text>
                <text
                  x={layer.name === 'Hills' ? 193 : 180}
                  y={y + 13.4}
                  fontSize="3.8"
                  className={INK_SOFT}
                  fill="#64748b"
                >
                  {layer.note}
                </text>
                <Eye x={248} y={y + 8.5} />
              </g>
            );
          })}
        </Panel>
      </svg>
    </Frame>
  );
}

/** Adjust: the Adjust tab's tiles, Black & White chosen, and the picture before and after it. */
export function PhotoAdjustArt() {
  const tiles = [
    { name: 'Levels', tone: SKY },
    { name: 'Curves', tone: VIOLET },
    { name: 'Hue/Sat', tone: ROSE },
    { name: 'Warmth', tone: AMBER },
    { name: 'B & W', tone: '#475569', active: true },
    { name: 'Vibrance', tone: EMERALD },
  ];
  return (
    <Frame canvas>
      <svg viewBox="0 0 300 96" className="absolute inset-0 h-full w-full">
        <Page x={30} y={14} w={104} h={68}>
          <g className="fa-c-before">
            <Picture id="pa-before" x={30} y={14} w={104} h={68} />
          </g>
          <g className="fa-c-after">
            <Picture id="pa-after" x={30} y={14} w={104} h={68} mono />
          </g>
        </Page>
        <Panel x={152} y={8} w={118} h={80} title="Adjust">
          <text
            x="264"
            y="17.5"
            textAnchor="end"
            fontSize="3.8"
            className={INK_SOFT}
            fill="#64748b"
          >
            16 adjustments · 44 filters
          </text>
          {tiles.map((tile, i) => {
            const tx = 158 + (i % 3) * 36;
            const ty = 24 + Math.floor(i / 3) * 31;
            return (
              <g key={tile.name}>
                <rect
                  className={tile.active ? 'fa-d-ring' : undefined}
                  x={tx}
                  y={ty}
                  width="33"
                  height="20"
                  rx="2.4"
                  fill={tile.tone}
                  fillOpacity="0.2"
                  stroke={tile.active ? tile.tone : 'none'}
                  strokeWidth="0.9"
                />
                <circle cx={tx + 16.5} cy={ty + 10} r="5" fill={tile.tone} fillOpacity="0.75" />
                <text
                  x={tx + 16.5}
                  y={ty + 26.5}
                  textAnchor="middle"
                  fontSize="3.8"
                  fontWeight="600"
                  className={INK_SOFT}
                  fill="#64748b"
                >
                  {tile.name}
                </text>
              </g>
            );
          })}
        </Panel>
      </svg>
    </Frame>
  );
}

/** Retouch: the tools down the side, the subject selected, a blemish healed away under the brush. */
export function PhotoRetouchArt() {
  const tools = [SKY, VIOLET, ROSE, EMERALD, AMBER];
  return (
    <Frame canvas>
      <svg viewBox="0 0 300 96" className="absolute inset-0 h-full w-full">
        {/* The photo tools, the heal tool chosen. */}
        <Panel x={46} y={14} w={16} h={68}>
          {tools.map((c, i) => (
            <rect
              key={c}
              x="49.5"
              y={18 + i * 12.5}
              width="9"
              height="9"
              rx="2"
              fill={c}
              fillOpacity={i === 2 ? 0.9 : 0.25}
            />
          ))}
        </Panel>
        <Page x={74} y={10} w={152} h={76}>
          <Picture id="pr" x={74} y={10} w={152} h={76} />
          {/* A blemish on the sky, healed away. */}
          <g className="fa-c-before">
            <circle cx="112" cy="30" r="3.2" fill="#78716c" fillOpacity="0.7" />
          </g>
          {/* The subject (the sun), selected: marching ants. */}
          <circle
            className="fa-e-draw"
            style={{ ...at(0), '--e-len': 76 } as CSSProperties}
            cx={74 + 152 * 0.7}
            cy={10 + 76 * 0.36}
            r="12"
            fill="none"
            stroke="#0f172a"
            strokeWidth="0.7"
          />
        </Page>
        {/* The brush, a ring the size of its tip, over the blemish. */}
        <circle cx="112" cy="30" r="6.5" fill="none" stroke="#ffffff" strokeWidth="0.9" />
        <circle cx="112" cy="30" r="6.5" fill="none" stroke="#0f172a" strokeWidth="0.4" />
        <g transform="translate(232 18)">
          {['Spot Heal', 'Clone Stamp', 'Subject', 'Remove Background'].map((label, i) => (
            <text
              key={label}
              y={i * 15 + 8}
              fontSize="4.4"
              fontWeight={i === 0 ? 700 : 500}
              className={i === 0 ? INK : INK_SOFT}
              fill={i === 0 ? '#1e293b' : '#64748b'}
            >
              {label}
            </text>
          ))}
        </g>
      </svg>
    </Frame>
  );
}

/** PSD in and out: the photo's export panel set to PSD, the layers listed as kept, and the file it makes. */
export function PhotoPsdArt() {
  return (
    <Frame canvas>
      <svg viewBox="0 0 300 96" className="absolute inset-0 h-full w-full">
        <Page x={30} y={20} w={78} h={52}>
          <Picture id="pp" x={30} y={20} w={78} h={52} warm />
        </Page>
        <Panel x={122} y={8} w={96} h={80} title="Export photo">
          <rect
            className="fill-slate-100 dark:fill-slate-800"
            x="127"
            y="19"
            width="86"
            height="11"
            rx="3"
            fill="#f1f5f9"
          />
          <rect
            className="fill-white dark:fill-slate-700"
            x="190"
            y="20"
            width="22"
            height="9"
            rx="2.4"
            fill="#ffffff"
          />
          {['PNG', 'JPEG', 'WebP', 'PSD'].map((f, i) => (
            <text
              key={f}
              x={137.5 + i * 21.5}
              y={26.2}
              textAnchor="middle"
              fontSize="4.2"
              fontWeight="700"
              className={i === 3 ? INK : INK_SOFT}
              fill={i === 3 ? '#1e293b' : '#64748b'}
            >
              {f}
            </text>
          ))}
          {[
            ['Layers', 'Kept, 4'],
            ['Masks', 'Kept'],
            ['Blend modes', 'Kept'],
          ].map(([k, v], i) => (
            <g key={k}>
              <text x="127" y={41 + i * 9} fontSize="4.4" className={INK_SOFT} fill="#64748b">
                {k}
              </text>
              <text
                x="213"
                y={41 + i * 9}
                textAnchor="end"
                fontSize="4.4"
                fontWeight="600"
                className={INK}
                fill="#1e293b"
              >
                {v}
              </text>
            </g>
          ))}
          <rect x="127" y="69" width="86" height="12" rx="3" fill={SKY} />
          <text x="170" y="76.8" textAnchor="middle" fontSize="4.8" fontWeight="700" fill="#ffffff">
            Export PSD
          </text>
        </Panel>
        {/* The file it makes. */}
        <g className="fa-e-pop" style={at(1.4)}>
          <path
            className="fill-white stroke-slate-200 dark:fill-slate-800 dark:stroke-slate-600"
            d="M236 30h16l6 6v26h-22z"
            fill="#ffffff"
            stroke="#e2e8f0"
            strokeWidth="0.8"
          />
          <path className="fill-slate-100 dark:fill-slate-700" d="M252 30v6h6z" fill="#f1f5f9" />
          <rect x="233" y="46" width="18" height="8" rx="1.6" fill={VIOLET} />
          <text x="242" y="51.8" textAnchor="middle" fontSize="4.4" fontWeight="800" fill="#ffffff">
            PSD
          </text>
          <text
            x="247"
            y="68"
            textAnchor="middle"
            fontSize="3.6"
            className={INK_SOFT}
            fill="#64748b"
          >
            4 layers
          </text>
        </g>
      </svg>
    </Frame>
  );
}
