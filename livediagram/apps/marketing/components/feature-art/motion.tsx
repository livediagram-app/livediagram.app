// Feature illustrations for motion (docs/specs/008-canvas/canvas-and-palette.md "Animated
// elements" and the animated background patterns). Each scene is a small working diagram whose
// motion carries meaning, a status, a direction, a mood. Motion is pure CSS (fa-* and fa-d-* in
// app/feature-art/content.css), so it survives the static export and settles to a still frame
// under prefers-reduced-motion, as the editor's own animations do. Shared marks: ./canvas-marks.
import type { CSSProperties, ReactNode } from 'react';
import {
  ARROW,
  INK,
  INK_TEXT,
  SHADOW,
  Scene,
  TEXT_BODY,
  TEXT_MUTED,
} from '@liveworkspace/marketing-site/components/feature-art/canvas-marks';
import { Frame } from '@liveworkspace/marketing-site/components/feature-art/shared';

// Living backgrounds live in ./motion-background and the Animated icon set in ./motion-icons.
export { LivingBackgroundArt } from './motion-background';
export { AnimatedIconsArt } from './motion-icons';

// A chip naming the animation a shape wears, under the shape.
function Tag({ x, y, children }: { x: number; y: number; children: ReactNode }) {
  return (
    <g>
      <rect
        className="fill-white stroke-slate-200 dark:fill-slate-900 dark:stroke-slate-700"
        x={x - 15}
        y={y}
        width="30"
        height="10"
        rx="5"
        strokeWidth="0.7"
      />
      <text
        className={TEXT_BODY}
        x={x}
        y={y + 6.8}
        fontSize="5.4"
        fontWeight="600"
        textAnchor="middle"
      >
        {children}
      </text>
    </g>
  );
}

// Animated shapes: a little system whose status is told by motion. The API pulses for attention,
// the queue glows while it works, and the status light blinks green.
export function AnimatedShapesArt() {
  return (
    <Frame canvas>
      <Scene>
        {/* Connectors. */}
        <g className={ARROW} strokeWidth="1.1" fill="none">
          <path d="M106 40 H130" />
          <path d="M194 40 H218" />
        </g>
        <g className="fill-(--art-arrow)">
          <path d="M135 40 l-4.5 -2.6 v5.2z" />
          <path d="M223 40 l-4.5 -2.6 v5.2z" />
        </g>
        {/* Pulse: an attention ring spreading from the API. */}
        <rect
          className="fa-ripple stroke-pink-500"
          x="54"
          y="27"
          width="52"
          height="26"
          rx="7"
          fill="none"
          strokeWidth="2"
        />
        <rect
          className="fill-(--art-ink-fill) stroke-pink-500"
          x="54"
          y="27"
          width="52"
          height="26"
          rx="7"
          strokeWidth="1.6"
        />
        <circle cx="66" cy="40" r="3" fill="#ec4899" />
        <text className={INK_TEXT} x="74" y="42.6" fontSize="7.4" fontWeight="700">
          API
        </text>
        <Tag x={80} y={62}>
          Pulse
        </Tag>
        {/* Glow: a soft halo breathing round the queue. */}
        <rect
          className="fa-glow"
          x="134"
          y="24"
          width="64"
          height="32"
          rx="10"
          fill="#8b5cf6"
          style={{ filter: 'blur(5px)' }}
        />
        <rect
          className="fill-(--art-ink-fill) stroke-violet-500"
          x="138"
          y="27"
          width="56"
          height="26"
          rx="7"
          strokeWidth="1.6"
        />
        {[0, 1, 2].map((i) => (
          <rect
            key={i}
            x={147 + i * 7}
            y="35"
            width="5"
            height="10"
            rx="1.2"
            fill="#8b5cf6"
            fillOpacity={0.35 + i * 0.25}
          />
        ))}
        <text className={INK_TEXT} x="171" y="42.6" fontSize="7.4" fontWeight="700">
          Jobs
        </text>
        <Tag x={166} y={62}>
          Glow
        </Tag>
        {/* Blink: the status light. */}
        <rect className={INK} x="226" y="27" width="52" height="26" rx="7" strokeWidth="1.4" />
        <circle cx="239" cy="40" r="5" fill="#22c55e" fillOpacity="0.22" />
        <circle className="fa-pulse" cx="239" cy="40" r="3" fill="#22c55e" />
        <text className={INK_TEXT} x="248" y="42.6" fontSize="7.4" fontWeight="700">
          Live
        </text>
        <Tag x={252} y={62}>
          Blink
        </Tag>
      </Scene>
    </Frame>
  );
}

// One stage of the pipeline: a themed box with a glyph and a name.
function Stage({ x, label, children }: { x: number; label: string; children: ReactNode }) {
  return (
    <g>
      <g className={SHADOW}>
        <rect className={INK} x={x} y="30" width="54" height="30" rx="7" strokeWidth="1.4" />
      </g>
      <g
        className="text-(--art-ink-stroke)"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {children}
      </g>
      <text
        className={INK_TEXT}
        x={x + 27}
        y="54"
        fontSize="6.4"
        fontWeight="700"
        textAnchor="middle"
      >
        {label}
      </text>
    </g>
  );
}

// Flowing arrows: a data pipeline that reads its own direction, three connectors in three of the
// flow styles, marching dashes, travelling dots and a signal packet racing the line.
export function FlowingArrowsArt() {
  return (
    <Frame canvas>
      <Scene>
        <Stage x={14} label="Events">
          <path d="M33 37 l3 4 3 -6 3 8 3 -4" />
        </Stage>
        <Stage x={104} label="Transform">
          <circle cx="131" cy="40" r="3.4" />
          <path d="M131 34.5v1.6M131 43.9v1.6M125.5 40h1.6M134.9 40h1.6" />
        </Stage>
        <Stage x={194} label="Warehouse">
          <ellipse cx="221" cy="36" rx="5" ry="1.8" />
          <path d="M216 36v7a5 1.8 0 0 0 10 0v-7" />
        </Stage>
        {/* Marching dashes. */}
        <path
          className="fa-flow stroke-(--art-arrow)"
          d="M68 45 H98"
          strokeWidth="1.8"
          strokeLinecap="round"
          fill="none"
        />
        <path className="fill-(--art-arrow)" d="M103 45 l-5 -3 v6z" />
        {/* Travelling dots. */}
        <path
          className="fa-d-dots stroke-sky-500 dark:stroke-sky-400"
          d="M158 45 H188"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeDasharray="0.01 6"
          fill="none"
        />
        <path className="fill-sky-500 dark:fill-sky-400" d="M193 45 l-5 -3 v6z" />
        {/* The packet, over a quiet line. */}
        <path
          className="stroke-(--art-arrow)"
          strokeOpacity="0.3"
          d="M248 45 H282"
          strokeWidth="1.6"
          fill="none"
        />
        <circle
          className="fa-d-packet fill-pink-500"
          style={{ '--dx': '30px' } as CSSProperties}
          cx="250"
          cy="45"
          r="2.8"
        />
        <path className="fill-(--art-arrow)" d="M287 45 l-5 -3 v6z" />
        <g>
          {[
            [83, 'Dashes'],
            [173, 'Dots'],
            [266, 'Signal'],
          ].map(([x, label]) => (
            <text
              key={label}
              className={TEXT_MUTED}
              x={x as number}
              y="75"
              fontSize="5.6"
              fontWeight="600"
              textAnchor="middle"
            >
              {label}
            </text>
          ))}
        </g>
      </Scene>
    </Frame>
  );
}
