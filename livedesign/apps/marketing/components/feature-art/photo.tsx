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
            const y = 21 + i * 20;
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
    { name: 'Exposure', tone: ROSE },
    { name: 'Photo Filter', tone: AMBER },
    { name: 'Black & White', tone: '#475569', active: true },
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
  // Five of the tool rail's groups in its order (lib/photo-editor/tool-state.ts TOOL_GROUPS): Marquee, Lasso,
  // Smart Select (Magic Wand), Brush and Heal (Spot Heal, chosen), each drawn in a 9-unit box at its slot.
  const tools: { name: string; d: string; dashed?: boolean }[] = [
    { name: 'Marquee', d: 'M1.5 1.5h6v6h-6z', dashed: true },
    {
      name: 'Lasso',
      d: 'M4.5 1.6c2.4 0 3.6 1.1 3.6 2.4s-1.6 2.3-3.6 2.3S1 5.3 1 4s1.1-2.4 3.5-2.4zM3.2 6.2c-.3 1.2.2 1.8 1 2.2',
    },
    { name: 'Magic Wand', d: 'M1.4 7.8 5.6 3.6M6.4 1v1.4M7.8 2.4h1.2M6.4 4.2v1.2M8.2 4.6l-.8-.8' },
    {
      name: 'Brush',
      d: 'M8 1 4.4 4.8M3.8 5.4c-1.2 0-2 .8-2 2.1 0 .4-.2.6-.6.8 1.6.4 3.6 0 3.6-1.6z',
    },
    {
      name: 'Spot Heal',
      d: 'M2.2 5.8 5.8 2.2a1.4 1.4 0 0 1 2 2L4.2 7.8a1.4 1.4 0 0 1-2-2zM4.3 4.4h.01M5 5h.01',
    },
  ];
  return (
    <Frame canvas>
      <svg viewBox="0 0 300 96" className="absolute inset-0 h-full w-full">
        {/* The photo tools, Spot Heal chosen. */}
        <Panel x={46} y={14} w={16} h={68}>
          {tools.map((t, i) => (
            <g key={t.name}>
              {i === 4 ? (
                <rect
                  className="fill-brand-100 dark:fill-brand-500/25"
                  x="48.5"
                  y={17 + i * 12.5}
                  width="11"
                  height="11"
                  rx="2"
                  fill="#ffe4e6"
                />
              ) : null}
              <path
                className={
                  i === 4
                    ? 'stroke-brand-700 dark:stroke-brand-200'
                    : 'stroke-slate-500 dark:stroke-slate-400'
                }
                transform={`translate(49.5 ${18 + i * 12.5})`}
                d={t.d}
                fill="none"
                stroke="#64748b"
                strokeWidth="0.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray={t.dashed ? '1.4 1' : undefined}
              />
            </g>
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

/** PSD in and out: the photo's export panel set to PSD, and the file it makes with its layers kept. */
export function PhotoPsdArt() {
  return (
    <Frame canvas>
      <svg viewBox="0 0 300 96" className="absolute inset-0 h-full w-full">
        <Page x={30} y={20} w={78} h={52}>
          <Picture id="pp" x={30} y={20} w={78} h={52} warm />
        </Page>
        {/* The Export Tab dialog's Photo panel (apps/live PhotoExportPanel): the back bar with its Photo chip,
            the format cards with PSD chosen, the size it saves at, and Download. */}
        <Panel x={122} y={8} w={96} h={80} title="Export Tab">
          <rect
            className="fill-white stroke-slate-200 dark:fill-slate-800 dark:stroke-slate-700"
            x="127"
            y="20"
            width="86"
            height="10"
            rx="2.5"
            fill="#ffffff"
            stroke="#e2e8f0"
            strokeWidth="0.6"
          />
          <path
            className="stroke-slate-400"
            d="M132.4 23.2 L130.6 25 L132.4 26.8"
            fill="none"
            stroke="#94a3b8"
            strokeWidth="0.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <text x="135.5" y="26.6" fontSize="4.2" fontWeight="600" className={INK} fill="#1e293b">
            All formats
          </text>
          <rect
            className="fill-slate-100 dark:fill-slate-700"
            x="194"
            y="22"
            width="17"
            height="6"
            rx="1.5"
            fill="#f1f5f9"
          />
          <text
            x="202.5"
            y="26.3"
            textAnchor="middle"
            fontSize="3.8"
            fontWeight="700"
            className={INK_SOFT}
            fill="#64748b"
          >
            Photo
          </text>
          {['PNG', 'JPEG', 'WebP', 'PSD'].map((f, i) => {
            const on = i === 3;
            const fx = 127 + (i % 2) * 44;
            const fy = 33 + Math.floor(i / 2) * 12;
            return (
              <g key={f}>
                <rect
                  className={
                    on
                      ? 'fill-brand-50 stroke-brand-500 dark:fill-brand-500/15'
                      : 'fill-white stroke-slate-200 dark:fill-slate-900 dark:stroke-slate-700'
                  }
                  x={fx}
                  y={fy}
                  width="42"
                  height="10"
                  rx="2"
                  fill={on ? '#fff1f2' : '#ffffff'}
                  stroke={on ? '#f43f5e' : '#e2e8f0'}
                  strokeWidth="0.7"
                />
                <text
                  x={fx + 4}
                  y={fy + 6.6}
                  fontSize="4.4"
                  fontWeight="700"
                  className={INK}
                  fill="#1e293b"
                >
                  {f}
                </text>
              </g>
            );
          })}
          <text x="127" y="65" fontSize="3.8" className={INK_SOFT} fill="#64748b">
            1600 x 1200 px, at its pixel size.
          </text>
          <rect
            className="fill-brand-700 dark:fill-brand-600"
            x="181"
            y="70"
            width="32"
            height="11"
            rx="3"
            fill="#be123c"
          />
          <text x="197" y="77.3" textAnchor="middle" fontSize="4.6" fontWeight="700" fill="#ffffff">
            Download
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
