// Feature art for running the room (docs/specs/019-marketing/marketing-site.md,
// docs/specs/012-collaboration/facilitator.md): the canvas tilted into 3D, the
// facilitator's baton. Split out of ./present (the deck cards) by subject; built
// on ./page-kit so each reads in light and in dark.

import { Frame } from '@liveworkspace/marketing-site/components/feature-art/shared';
import {
  AMBER,
  at,
  EMERALD,
  INK,
  INK_SOFT,
  Panel,
  ROSE,
  SKY,
  VIOLET,
} from '@liveworkspace/marketing-site/components/feature-art/page-kit';

// A person in the room, as the presence stack draws them.
function Avatar({
  cx,
  cy,
  initials,
  color,
  r = 5.4,
}: {
  cx: number;
  cy: number;
  initials: string;
  color: string;
  r?: number;
}) {
  return (
    <g>
      <circle
        className="stroke-white dark:stroke-slate-900"
        cx={cx}
        cy={cy}
        r={r}
        fill={color}
        stroke="#ffffff"
        strokeWidth="1"
      />
      <text
        x={cx}
        y={cy + 1.6}
        textAnchor="middle"
        fontSize={r * 0.82}
        fontWeight="700"
        fill="#ffffff"
      >
        {initials}
      </text>
    </g>
  );
}

// The session controls: the timer and its buttons, live for the holder and locked for the rest.
function SessionControls({ x, w, live }: { x: number; w: number; live: boolean }) {
  const dim = live ? 1 : 0.4;
  return (
    <Panel x={x} y={34} w={w} h={52}>
      <text
        x={x + 6}
        y={43}
        fontSize="4"
        fontWeight="700"
        letterSpacing="0.3"
        className={INK_SOFT}
        fill="#64748b"
      >
        TIMER
      </text>
      <g opacity={dim}>
        <g className={live ? 'fa-swap-a' : undefined}>
          <text
            x={x + 6}
            y={58}
            fontSize="12"
            fontWeight="800"
            className={INK}
            fill="#1e293b"
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            04:59
          </text>
        </g>
        {live ? (
          <g className="fa-swap-b">
            <text
              x={x + 6}
              y={58}
              fontSize="12"
              fontWeight="800"
              className={INK}
              fill="#1e293b"
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              04:58
            </text>
          </g>
        ) : null}
        {/* Pause and restart. */}
        <circle cx={x + 11} cy={72} r="5" fill={live ? SKY : '#94a3b8'} />
        <path
          d={`M${x + 9.6} ${69.6}v4.8M${x + 12.4} ${69.6}v4.8`}
          stroke="#ffffff"
          strokeWidth="1"
          strokeLinecap="round"
        />
        <circle
          className="stroke-slate-300 dark:stroke-slate-600"
          cx={x + 24}
          cy={72}
          r="5"
          fill="none"
          stroke="#cbd5e1"
          strokeWidth="0.8"
        />
        <path
          className="stroke-slate-500 dark:stroke-slate-300"
          d={`M${x + 22} ${70.6}a2.4 2.4 0 1 0 2.4-1.4`}
          fill="none"
          stroke="#64748b"
          strokeWidth="0.8"
          strokeLinecap="round"
        />
      </g>
      {live ? null : (
        <g>
          <rect
            className="fill-slate-100 dark:fill-slate-800"
            x={x + w - 28}
            y={38}
            width="24"
            height="9"
            rx="4.5"
            fill="#f1f5f9"
          />
          <rect
            x={x + w - 24.5}
            y={42}
            width="4.4"
            height="3.4"
            rx="0.6"
            className="fill-slate-500 dark:fill-slate-300"
            fill="#64748b"
          />
          <path
            className="stroke-slate-500 dark:stroke-slate-300"
            d={`M${x + w - 23.6} ${42}v-1a1.3 1.3 0 0 1 2.6 0v1`}
            fill="none"
            stroke="#64748b"
            strokeWidth="0.6"
          />
          <text
            x={x + w - 18.5}
            y={44.8}
            fontSize="3.6"
            fontWeight="600"
            className={INK_SOFT}
            fill="#64748b"
          >
            Locked
          </text>
        </g>
      )}
    </Panel>
  );
}

/** One person runs the room: the facilitator holds the baton, and the session tools answer to them. */
export function FacilitatorArt() {
  return (
    <Frame canvas>
      <svg viewBox="0 0 300 96" className="absolute inset-0 h-full w-full">
        {/* The facilitator, the baton on their avatar. */}
        <Avatar cx={22} cy={18} initials="MC" color={SKY} r={6.4} />
        <circle
          cx="27"
          cy="12.6"
          r="3"
          fill={AMBER}
          className="stroke-white dark:stroke-slate-900"
          stroke="#ffffff"
          strokeWidth="0.8"
        />
        <path
          d="M27 10.9l.5 1.1 1.2.1-.9.8.3 1.2-1.1-.6-1.1.6.3-1.2-.9-.8 1.2-.1z"
          fill="#ffffff"
        />
        <text x="32" y="17" fontSize="4.8" fontWeight="700" className={INK} fill="#1e293b">
          Maya
        </text>
        <text x="32" y="23" fontSize="3.8" fontWeight="600" fill={AMBER}>
          Facilitator
        </text>

        {/* Everyone else in the room. */}
        <Avatar cx={164} cy={18} initials="SK" color={VIOLET} />
        <Avatar cx={173} cy={18} initials="AN" color={EMERALD} />
        <Avatar cx={182} cy={18} initials="JR" color={ROSE} />
        <text x="193" y="19.5" fontSize="4.4" fontWeight="600" className={INK_SOFT} fill="#64748b">
          Everyone else
        </text>

        <SessionControls x={14} w={132} live />
        <SessionControls x={154} w={132} live={false} />
        <circle
          className="fa-e-ring"
          style={at(0)}
          cx="25"
          cy="72"
          r="5"
          fill="none"
          stroke={SKY}
          strokeWidth="0.8"
        />
      </svg>
    </Frame>
  );
}
