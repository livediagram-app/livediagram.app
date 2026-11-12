// The living backgrounds card for motion (./motion, docs/specs/008-canvas/canvas-and-palette.md and the
// animated background patterns): the Aurora pattern drifting behind a diagram, with the Background
// picker. Motion is pure CSS (fa-* and fa-d-* in app/feature-art/content.css).
import type { CSSProperties } from 'react';
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

// Living backgrounds: the Aurora pattern, soft colour fields drifting behind a diagram, with the
// Background picker showing the pattern and its speed.
export function LivingBackgroundArt() {
  const fields = [
    { cx: 70, cy: 30, r: 46, color: '#38bdf8', ax: '26px', ay: '10px', delay: '0s' },
    { cx: 170, cy: 70, r: 50, color: '#a78bfa', ax: '-22px', ay: '-8px', delay: '-3s' },
    { cx: 250, cy: 26, r: 40, color: '#34d399', ax: '-18px', ay: '12px', delay: '-6s' },
  ];
  return (
    <Frame canvas>
      <Scene>
        <defs>
          <filter id="fa-d-aurora-blur" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="14" />
          </filter>
        </defs>
        <g filter="url(#fa-d-aurora-blur)" className="opacity-45 dark:opacity-35">
          {fields.map((f) => (
            <circle
              key={f.color}
              className="fa-d-aurora"
              style={{ '--ax': f.ax, '--ay': f.ay, animationDelay: f.delay } as CSSProperties}
              cx={f.cx}
              cy={f.cy}
              r={f.r}
              fill={f.color}
            />
          ))}
        </g>
        {/* A diagram on the living backdrop. */}
        <g className={SHADOW}>
          <rect className={INK} x="36" y="36" width="50" height="24" rx="6" strokeWidth="1.4" />
          <rect className={INK} x="122" y="36" width="50" height="24" rx="6" strokeWidth="1.4" />
        </g>
        <text
          className={INK_TEXT}
          x="61"
          y="50.5"
          fontSize="6.8"
          fontWeight="700"
          textAnchor="middle"
        >
          Idea
        </text>
        <text
          className={INK_TEXT}
          x="147"
          y="50.5"
          fontSize="6.8"
          fontWeight="700"
          textAnchor="middle"
        >
          Pitch
        </text>
        <path className={ARROW} d="M86 48 H117" strokeWidth="1.2" fill="none" />
        <path className="fill-(--art-arrow)" d="M122 48 l-5 -3 v6z" />
        {/* The Background picker, Aurora chosen, its speed slider. */}
        <g className={SHADOW}>
          <rect className={PANEL} x="196" y="14" width="90" height="68" rx="6" strokeWidth="0.8" />
        </g>
        <text
          className={TEXT_MUTED}
          x="204"
          y="25"
          fontSize="5.2"
          fontWeight="700"
          letterSpacing="0.5"
        >
          BACKGROUND
        </text>
        {['Flow', 'Drift', 'Aurora'].map((name, i) => {
          const x = 204 + i * 26;
          const on = name === 'Aurora';
          return (
            <g key={name}>
              <rect
                className={
                  on
                    ? 'stroke-brand-500 dark:stroke-brand-400'
                    : 'stroke-slate-200 dark:stroke-slate-700'
                }
                x={x}
                y="30"
                width="22"
                height="18"
                rx="3"
                fill={on ? 'url(#fa-d-aurora-swatch)' : 'transparent'}
                strokeWidth={on ? 1.3 : 0.7}
              />
              {name === 'Flow' ? (
                <path
                  className="stroke-slate-300 dark:stroke-slate-600"
                  d={`M${x + 3} 44 l8 -10 M${x + 9} 44 l8 -10 M${x + 15} 44 l5 -6`}
                  strokeWidth="1"
                />
              ) : null}
              {name === 'Drift' ? (
                <g className="fill-slate-300 dark:fill-slate-600">
                  <circle cx={x + 6} cy="42" r="1.4" />
                  <circle cx={x + 12} cy="36" r="1.1" />
                  <circle cx={x + 17} cy="41" r="1.6" />
                </g>
              ) : null}
              <text
                className={on ? 'fill-brand-600 dark:fill-brand-300' : TEXT_MUTED}
                x={x + 11}
                y="56"
                fontSize="5.2"
                fontWeight="600"
                textAnchor="middle"
              >
                {name}
              </text>
            </g>
          );
        })}
        <defs>
          <linearGradient id="fa-d-aurora-swatch" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#38bdf8" stopOpacity="0.55" />
            <stop offset="0.5" stopColor="#a78bfa" stopOpacity="0.55" />
            <stop offset="1" stopColor="#34d399" stopOpacity="0.55" />
          </linearGradient>
        </defs>
        <text className={TEXT_BODY} x="204" y="70" fontSize="5.2" fontWeight="600">
          Speed
        </text>
        <rect
          className="fill-slate-200 dark:fill-slate-700"
          x="226"
          y="67.5"
          width="52"
          height="2.5"
          rx="1.25"
        />
        <rect
          className="fill-brand-500 dark:fill-brand-400"
          x="226"
          y="67.5"
          width="22"
          height="2.5"
          rx="1.25"
        />
        <circle
          className="fill-white stroke-brand-500 dark:fill-slate-900 dark:stroke-brand-400"
          cx="248"
          cy="68.75"
          r="3"
          strokeWidth="1.2"
        />
      </Scene>
    </Frame>
  );
}
