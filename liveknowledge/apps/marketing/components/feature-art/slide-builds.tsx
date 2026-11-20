// Feature art for builds (docs/specs/012-collaboration/presentation-mode.md "Setting builds up",
// docs/specs/019-marketing/marketing-site.md "Feature category pages"): on the left the slide page as an
// Editor sees it, each built point wearing its numbered badge, the third point selected with its menu's Build
// section open (None, Appear, Fade, Rise, then its step in Order); on the right the same slide presented, its points coming in
// one press at a time. Built on ./page-kit and the fa-e-* loop (app/feature-art/pages.css), so it reads in light and
// dark and settles to the finished slide under reduced motion.

import { Frame } from '@liveworkspace/marketing-site/components/feature-art/shared';
import {
  at,
  INK,
  INK_SOFT,
  Page,
  PageLabel,
  Panel,
  Screen,
  SKY,
} from '@liveworkspace/marketing-site/components/feature-art/page-kit';

const POINTS = ['Faster sign-up', 'One shared library', 'Live in every app'];

// The Build section's effect tiles (liveknowledge/apps/editor/components/palette/BuildTiles.tsx): None, Appear, Fade
// and Rise, each a tiny slide whose last line builds in that way. Fade is the one chosen.
const EFFECTS = ['None', 'Appear', 'Fade', 'Rise'];

// The chosen and resting looks of a tile or an Order step.
const ON = 'fill-sky-50 stroke-sky-500 dark:fill-sky-950 dark:stroke-sky-400';
const OFF = 'fill-white stroke-slate-200 dark:fill-slate-800 dark:stroke-slate-600';
const ON_TEXT = 'fill-sky-700 dark:fill-sky-300';

// The editor's build badge (liveknowledge/apps/editor/components/canvas/element-parts.tsx BuildBadge): a white disc
// ringed in the brand with brand digits in light, a pale brand disc with dark digits in dark, on the element's corner.
function BuildBadge({ cx, cy, step }: { cx: number; cy: number; step: number }) {
  return (
    <g>
      <circle
        className="fill-white stroke-brand-500/70 dark:fill-brand-200 dark:stroke-slate-950/40"
        cx={cx}
        cy={cy}
        r="3.8"
        fill="#ffffff"
        stroke="#f59e0b"
        strokeWidth="0.7"
      />
      <text
        className="fill-brand-700 dark:fill-slate-900"
        x={cx}
        y={cy + 1.5}
        textAnchor="middle"
        fontSize="4.2"
        fontWeight="700"
        fill="#b45309"
      >
        {step}
      </text>
    </g>
  );
}

/** Builds: each point of a slide numbered by its step, its effect chosen in Build, then brought in one press at a
 *  time while presenting. */
export function SlideBuildsArt() {
  return (
    <Frame canvas>
      <svg viewBox="0 0 300 96" className="absolute inset-0 h-full w-full">
        {/* The slide page being edited, on the canvas. */}
        <PageLabel x={12} y={11}>
          Slide 3
        </PageLabel>
        <Page x={12} y={15} w={104} h={58.5}>
          <text x="21" y="28" fontSize="6.6" fontWeight="800" className={INK} fill="#1e293b">
            Why now
          </text>
          {POINTS.map((point, i) => {
            const selected = i === 2;
            return (
              <g key={point}>
                <rect
                  className={
                    selected
                      ? 'fill-sky-50 stroke-sky-400 dark:fill-sky-950 dark:stroke-sky-500'
                      : 'fill-slate-50 stroke-slate-200 dark:fill-slate-700/60 dark:stroke-slate-600'
                  }
                  x="21"
                  y={34 + i * 12}
                  width="84"
                  height="9"
                  rx="2"
                  fill={selected ? '#f0f9ff' : '#f8fafc'}
                  stroke={selected ? '#38bdf8' : '#e2e8f0'}
                  strokeWidth="0.6"
                />
                <circle cx="26" cy={38.5 + i * 12} r="1.2" fill={SKY} />
                <text x="30" y={40.1 + i * 12} fontSize="4.6" className={INK_SOFT} fill="#475569">
                  {point}
                </text>
                <BuildBadge cx={21} cy={34 + i * 12} step={i + 1} />
              </g>
            );
          })}
        </Page>

        {/* Build, in the selected point's menu: the effect, then its step in Order. */}
        <Panel x={80} y={49} w={86} h={44}>
          <text x="85" y="57" fontSize="4.6" fontWeight="700" className={INK} fill="#1e293b">
            Build
          </text>
          {EFFECTS.map((label, i) => {
            const tx = 84 + i * 19.6;
            const on = label === 'Fade';
            return (
              <g key={label}>
                <rect
                  className={on ? ON : OFF}
                  x={tx}
                  y="60"
                  width="17.6"
                  height="11"
                  rx="1.6"
                  fill={on ? '#f0f9ff' : '#ffffff'}
                  stroke={on ? '#0ea5e9' : '#e2e8f0'}
                  strokeWidth="0.6"
                />
                <g className="fill-slate-400 dark:fill-slate-500" fill="#94a3b8">
                  <rect x={tx + 3.5} y="62.6" width="7" height="0.9" rx="0.45" />
                  <rect x={tx + 3.5} y="64.8" width="10.6" height="0.7" rx="0.35" opacity="0.6" />
                </g>
                {label === 'None' ? null : (
                  <rect
                    x={tx + 3.5}
                    y={label === 'Rise' ? 67.8 : 67}
                    width="8"
                    height="0.9"
                    rx="0.45"
                    fill={SKY}
                    opacity={label === 'Appear' ? 1 : 0.45}
                  />
                )}
                <text
                  x={tx + 8.8}
                  y="76"
                  textAnchor="middle"
                  fontSize="3.9"
                  fontWeight={on ? 700 : 500}
                  className={on ? ON_TEXT : INK_SOFT}
                  fill={on ? '#0369a1' : '#64748b'}
                >
                  {label}
                </text>
              </g>
            );
          })}
          <text x="85" y="86.2" fontSize="4" className={INK_SOFT} fill="#64748b">
            Order
          </text>
          {/* One tile per step the slide has. The selected point is the last step on its own, so BuildTiles
              offers no New step: it would be the step it already is. */}
          {['1', '2', '3'].map((step, i) => {
            const on = step === '3';
            const bx = 102 + i * 12;
            const bw = 10;
            return (
              <g key={step}>
                <rect
                  className={on ? ON : OFF}
                  x={bx}
                  y="81"
                  width={bw}
                  height="7.6"
                  rx="1.4"
                  fill={on ? '#f0f9ff' : '#ffffff'}
                  stroke={on ? '#0ea5e9' : '#e2e8f0'}
                  strokeWidth="0.6"
                />
                <text
                  x={bx + bw / 2}
                  y="86.2"
                  textAnchor="middle"
                  fontSize="3.9"
                  fontWeight={on ? 700 : 500}
                  className={on ? ON_TEXT : INK}
                  fill={on ? '#0369a1' : '#1e293b'}
                >
                  {step}
                </text>
              </g>
            );
          })}
        </Panel>

        {/* The same slide presented: the title first, then each point on its own press. */}
        <Screen x={172} y={10} w={116} h={72} />
        <text x="183" y="28" fontSize="7.4" fontWeight="800" fill="#ffffff">
          Why now
        </text>
        {POINTS.map((point, i) => (
          <g key={point} className="fa-e-in" style={at(0.5 + i)}>
            <circle cx="186" cy={39.5 + i * 10} r="1.4" fill={SKY} />
            <text x="191" y={41.3 + i * 10} fontSize="5.2" fill="#ffffff" fillOpacity="0.9">
              {point}
            </text>
          </g>
        ))}
        {/* The presenting bar: where the deck is. */}
        <rect x="252" y="71" width="30" height="7" rx="3.5" fill="#ffffff" fillOpacity="0.08" />
        <text
          x="267"
          y="75.8"
          textAnchor="middle"
          fontSize="3.8"
          fontWeight="600"
          fill="#ffffff"
          fillOpacity="0.75"
        >
          3 / 12
        </text>
      </svg>
    </Frame>
  );
}
