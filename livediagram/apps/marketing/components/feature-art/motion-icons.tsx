// The Animated icons card for motion (./motion, docs/specs/008-canvas/canvas-and-palette.md "Animated
// elements"): the Animated set's tiles, each glyph moving in place. Motion is pure CSS (fa-* and
// fa-d-* in app/feature-art/content.css).
import type { ReactNode } from 'react';
import {
  ARROW,
  INK,
  INK_TEXT,
  PANEL,
  SHADOW,
  Scene,
  TEXT_BODY,
  TEXT_MUTED,
} from '@liveworkspace/marketing-site/components/feature-art/canvas-marks';
import { Frame } from '@liveworkspace/marketing-site/components/feature-art/shared';

// One tile of the Animated set: its glyph moving in place, its name under it.
function IconTile({
  x,
  label,
  picked = false,
  children,
}: {
  x: number;
  label: string;
  picked?: boolean;
  children: ReactNode;
}) {
  return (
    <g>
      <rect
        className={
          picked
            ? 'fill-brand-50 stroke-brand-500 dark:fill-brand-500/15 dark:stroke-brand-400'
            : 'fill-transparent stroke-slate-200 dark:stroke-slate-700'
        }
        x={x}
        y="36"
        width="24"
        height="22"
        rx="4"
        strokeWidth={picked ? 1.2 : 0.7}
      />
      <svg x={x + 5} y="40" width="14" height="14" viewBox="0 0 24 24" overflow="visible">
        {children}
      </svg>
      <text
        className={picked ? 'fill-brand-600 dark:fill-brand-300' : TEXT_MUTED}
        x={x + 12}
        y="66"
        fontSize="5"
        fontWeight="600"
        textAnchor="middle"
      >
        {label}
      </text>
    </g>
  );
}

const GLYPH = 'stroke-sky-600 dark:stroke-sky-300';

// Animated icons: the Icons picker on its Animated set, every glyph moving in place, and the gear
// dropped onto the canvas turning inside a build step.
export function AnimatedIconsArt() {
  return (
    <Frame canvas>
      <Scene>
        <g className={SHADOW}>
          <rect className={PANEL} x="12" y="12" width="148" height="64" rx="6" strokeWidth="0.8" />
        </g>
        {['All', 'Animated', 'Tech'].map((chip, i) => {
          const on = chip === 'Animated';
          const x = [20, 38, 74][i]!;
          const w = [14, 32, 20][i]!;
          return (
            <g key={chip}>
              <rect
                className={on ? 'fill-brand-500' : 'fill-slate-100 dark:fill-slate-800'}
                x={x}
                y="20"
                width={w}
                height="10"
                rx="5"
              />
              <text
                className={on ? '' : TEXT_BODY}
                fill={on ? '#fff' : undefined}
                x={x + w / 2}
                y="26.8"
                fontSize="5.4"
                fontWeight="600"
                textAnchor="middle"
              >
                {chip}
              </text>
            </g>
          );
        })}
        <IconTile x={20} label="Spinner">
          <path
            className={`fa-spin-cont ${GLYPH}`}
            d="M12 3a9 9 0 1 1-7 3.3"
            fill="none"
            strokeWidth="2.6"
            strokeLinecap="round"
          />
        </IconTile>
        <IconTile x={48} label="Gear" picked>
          <g className={`fa-spin-cont ${GLYPH}`} strokeWidth="2" fill="none">
            {Array.from({ length: 8 }, (_, i) => (
              <line
                key={i}
                x1="12"
                y1="2.5"
                x2="12"
                y2="5.5"
                transform={`rotate(${i * 45} 12 12)`}
              />
            ))}
            <circle cx="12" cy="12" r="6" />
            <circle cx="12" cy="12" r="2.4" />
          </g>
        </IconTile>
        <IconTile x={76} label="Heart">
          <path
            className="fa-beat"
            d="M12 20.5S4 14.5 4 9a3.6 3.6 0 0 1 8-2.6A3.6 3.6 0 0 1 20 9c0 5.5-8 11.5-8 11.5Z"
            fill="#f43f5e"
          />
        </IconTile>
        <IconTile x={104} label="Signal">
          <g className={GLYPH} fill="none" strokeWidth="2.2" strokeLinecap="round">
            <circle
              cx="12"
              cy="18"
              r="1.8"
              className="fill-sky-600 dark:fill-sky-300"
              stroke="none"
            />
            <path className="fa-pulse" d="M7.5 14a6 6 0 0 1 9 0" />
            <path
              className="fa-pulse"
              style={{ animationDelay: '0.4s' }}
              d="M4.5 10.5a10.5 10.5 0 0 1 15 0"
            />
          </g>
        </IconTile>
        <IconTile x={132} label="Bell">
          <g className={GLYPH} fill="none" strokeWidth="2" strokeLinejoin="round">
            <path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15Z" />
            <path className="fa-pulse" d="M10 20.5a2 2 0 0 0 4 0" />
            <path
              className="fa-pulse"
              style={{ animationDelay: '0.5s' }}
              d="M20.5 6.5a5 5 0 0 1 1.5 3.5M3.5 6.5A5 5 0 0 0 2 10"
              strokeLinecap="round"
            />
          </g>
        </IconTile>
        {/* On the canvas: the gear turning inside the build step. */}
        <path
          className={ARROW}
          d="M164 44 H186"
          strokeWidth="1.1"
          strokeDasharray="2.5 2.5"
          fill="none"
        />
        <path className="fill-(--art-arrow)" d="M191 44 l-5 -3 v6z" />
        <g className={SHADOW}>
          <rect className={INK} x="196" y="28" width="88" height="32" rx="7" strokeWidth="1.4" />
        </g>
        <svg x="204" y="35" width="18" height="18" viewBox="0 0 24 24" overflow="visible">
          <g className="fa-spin-cont stroke-(--art-ink-stroke)" strokeWidth="2" fill="none">
            {Array.from({ length: 8 }, (_, i) => (
              <line
                key={i}
                x1="12"
                y1="2.5"
                x2="12"
                y2="5.5"
                transform={`rotate(${i * 45} 12 12)`}
              />
            ))}
            <circle cx="12" cy="12" r="6" />
            <circle cx="12" cy="12" r="2.4" />
          </g>
        </svg>
        <text className={INK_TEXT} x="227" y="42" fontSize="6.8" fontWeight="700">
          Build
        </text>
        <text className={INK_TEXT} opacity="0.6" x="227" y="50.5" fontSize="5.4" fontWeight="500">
          running · 2m
        </text>
      </Scene>
    </Frame>
  );
}
