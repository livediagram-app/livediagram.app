// Feature illustrations — motion scenes (spec/09 "Animated elements" +
// animated background patterns). Split from FeatureArt.tsx; see ./shared
// for Frame + colour constants. Motion is pure CSS (fa-* classes +
// keyframes in globals.css) so it survives the static export and settles
// to a still frame under prefers-reduced-motion — the same contract the
// real editor's animations honour.
import type { ReactNode } from 'react';
import { BLUE_FILL, BLUE_STROKE, Frame, SKY } from './shared';

// Animated shapes: a looping animation on a boxed element to convey flow,
// signal status, or draw the eye. One demo each for Pulse / Glow / Blink.
export function AnimatedShapesArt() {
  return (
    <Frame canvas>
      <div className="flex h-full items-center justify-around px-3">
        {/* Pulse — an expanding ring in the element's accent. */}
        <div className="flex flex-col items-center gap-1.5">
          <svg width="46" height="46" viewBox="0 0 46 46" className="overflow-visible">
            <circle
              className="fa-ripple"
              cx="23"
              cy="23"
              r="11"
              fill="none"
              stroke={SKY}
              strokeWidth="2"
            />
            <circle cx="23" cy="23" r="11" fill={BLUE_FILL} stroke={BLUE_STROKE} strokeWidth="2" />
          </svg>
          <span className="text-[8px] font-medium text-slate-500">Pulse</span>
        </div>
        {/* Glow — a soft halo breathing around the element. */}
        <div className="flex flex-col items-center gap-1.5">
          <svg width="46" height="46" viewBox="0 0 46 46" className="overflow-visible">
            <rect
              className="fa-glow"
              x="10"
              y="14"
              width="26"
              height="18"
              rx="5"
              fill={SKY}
              style={{ filter: 'blur(3px)' }}
            />
            <rect
              x="12"
              y="15"
              width="22"
              height="16"
              rx="4"
              fill={BLUE_FILL}
              stroke={BLUE_STROKE}
              strokeWidth="2"
            />
          </svg>
          <span className="text-[8px] font-medium text-slate-500">Glow</span>
        </div>
        {/* Blink — a status breathe, the "status LED" pattern. */}
        <div className="flex flex-col items-center gap-1.5">
          <svg width="46" height="46" viewBox="0 0 46 46" className="overflow-visible">
            <circle cx="23" cy="23" r="7" fill="#dcfce7" stroke="#16a34a" strokeWidth="2" />
            <circle className="fa-pulse" cx="23" cy="23" r="3.5" fill="#22c55e" />
          </svg>
          <span className="text-[8px] font-medium text-slate-500">Blink</span>
        </div>
      </div>
    </Frame>
  );
}

// Flowing arrows: a connector whose dashes march along its path to show the
// direction of flow in a data / process diagram.
export function FlowingArrowsArt() {
  return (
    <Frame canvas>
      <svg viewBox="0 0 220 96" className="absolute inset-0 h-full w-full">
        <rect
          x="20"
          y="37"
          width="46"
          height="22"
          rx="5"
          fill={BLUE_FILL}
          stroke={BLUE_STROKE}
          strokeWidth="2"
        />
        <rect
          x="154"
          y="37"
          width="46"
          height="22"
          rx="5"
          fill={BLUE_FILL}
          stroke={BLUE_STROKE}
          strokeWidth="2"
        />
        {/* faint static rail under the marching dashes */}
        <line x1="66" y1="48" x2="148" y2="48" stroke="#d8dee8" strokeWidth="2" />
        <line
          className="fa-flow"
          x1="66"
          y1="48"
          x2="148"
          y2="48"
          stroke={BLUE_STROKE}
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <path d="M154 48 l-8 -4.5 v9 z" fill={BLUE_STROKE} />
      </svg>
      <span className="absolute bottom-1.5 right-2 rounded bg-white/90 px-1.5 py-0.5 text-[8px] font-medium text-slate-500 shadow-sm">
        flow
      </span>
    </Frame>
  );
}

// Living backgrounds: the animated canvas patterns (Flow / Drift / Aurora /
// Ripple / Ribbons) that bring the canvas to life with soft ambient motion,
// theme-matched and reduced-motion safe. Shown here as Drift's rising motes
// behind a faint diagram.
export function LivingBackgroundArt() {
  const motes = [
    { left: '14%', size: 5, delay: '0s' },
    { left: '30%', size: 3, delay: '1.4s' },
    { left: '46%', size: 6, delay: '0.7s' },
    { left: '62%', size: 3, delay: '2.1s' },
    { left: '78%', size: 5, delay: '1.1s' },
    { left: '88%', size: 4, delay: '2.6s' },
  ];
  return (
    <Frame canvas>
      {motes.map((m, i) => (
        <span
          key={i}
          className="fa-drift absolute bottom-2 rounded-full"
          style={{
            left: m.left,
            width: m.size,
            height: m.size,
            backgroundColor: SKY,
            animationDelay: m.delay,
          }}
        />
      ))}
      {/* a faint diagram sitting on the living backdrop */}
      <svg viewBox="0 0 220 96" className="absolute inset-0 h-full w-full">
        <g opacity="0.85">
          <rect
            x="76"
            y="34"
            width="68"
            height="30"
            rx="6"
            fill="white"
            stroke={BLUE_STROKE}
            strokeWidth="2"
          />
        </g>
      </svg>
      <span className="absolute bottom-1.5 right-2 rounded bg-white/90 px-1.5 py-0.5 text-[8px] font-medium text-slate-500 shadow-sm">
        living backdrop
      </span>
    </Frame>
  );
}

// Animated icons: ordinary glyphs that animate (Spinner, Gear, Heartbeat,
// Signal) — picked from the Animated chip of the Icons palette.
export function AnimatedIconsArt() {
  return (
    <Frame>
      <div className="flex h-full items-center justify-center gap-3">
        <IconTile label="Spinner">
          <path
            className="fa-spin-cont"
            d="M12 3 a9 9 0 1 1 -7 3.3"
            fill="none"
            stroke={BLUE_STROKE}
            strokeWidth="2.4"
            strokeLinecap="round"
          />
        </IconTile>
        <IconTile label="Gear">
          <g className="fa-spin-cont" stroke={BLUE_STROKE} strokeWidth="1.8" fill="none">
            {Array.from({ length: 8 }).map((_, i) => (
              <line key={i} x1="12" y1="2.5" x2="12" y2="5.5" transform={`rotate(${i * 45} 12 12)`} />
            ))}
            <circle cx="12" cy="12" r="6" />
            <circle cx="12" cy="12" r="2.4" />
          </g>
        </IconTile>
        <IconTile label="Heartbeat">
          <path
            className="fa-beat"
            d="M12 20.5 C 12 20.5 4 14.5 4 9 A 3.6 3.6 0 0 1 12 6.4 A 3.6 3.6 0 0 1 20 9 C 20 14.5 12 20.5 12 20.5 Z"
            fill="#f43f5e"
          />
        </IconTile>
        <IconTile label="Signal">
          <g fill="none" stroke={SKY} strokeWidth="2" strokeLinecap="round">
            <circle cx="12" cy="18" r="1.6" fill={SKY} stroke="none" />
            <path className="fa-pulse" d="M7.5 14 a6 6 0 0 1 9 0" style={{ animationDelay: '0s' }} />
            <path
              className="fa-pulse"
              d="M4.5 10.5 a10.5 10.5 0 0 1 15 0"
              style={{ animationDelay: '0.4s' }}
            />
          </g>
        </IconTile>
      </div>
    </Frame>
  );
}

function IconTile({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 bg-white">
        <svg width="22" height="22" viewBox="0 0 24 24" className="overflow-visible">
          {children}
        </svg>
      </div>
      <span className="text-[7px] font-medium text-slate-500">{label}</span>
    </div>
  );
}
