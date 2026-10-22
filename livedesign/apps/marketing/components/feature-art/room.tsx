// Feature art for running the room (docs/specs/019-marketing/marketing-site.md,
// docs/specs/012-collaboration/facilitator.md, bring-focus.md): the canvas tilted into 3D, the
// facilitator's baton and Bring Focus. Split out of ./present (the deck cards) by subject; built
// on ./page-kit so each reads in light and in dark.

import { Frame } from './shared';
import {
  AMBER,
  at,
  Cursor,
  EMERALD,
  INK,
  INK_SOFT,
  Lines,
  Panel,
  ROSE,
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
        {/* Pause and restart, then the vote. */}
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
        <rect
          x={x + 34}
          y={67}
          width={w - 40}
          height="10"
          rx="5"
          fill={live ? VIOLET : '#94a3b8'}
        />
        <text
          x={x + 34 + (w - 40) / 2}
          y={73.4}
          textAnchor="middle"
          fontSize="4.4"
          fontWeight="700"
          fill="#ffffff"
        >
          Start vote
        </text>
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

/** Ask the room to look here: Bring Focus pressed, and each teammate offered the jump. */
export function BringFocusArt() {
  return (
    <Frame canvas>
      <svg viewBox="0 0 300 96" className="absolute inset-0 h-full w-full">
        <g transform="translate(40 0)">
          {/* The rings the invitation sends out. */}
          <rect
            className="fa-e-ring"
            style={at(0)}
            x="84"
            y="38"
            width="52"
            height="16"
            rx="8"
            fill="none"
            stroke={SKY}
            strokeWidth="0.9"
          />
          <rect
            className="fa-e-ring"
            style={at(1.2)}
            x="84"
            y="38"
            width="52"
            height="16"
            rx="8"
            fill="none"
            stroke={SKY}
            strokeWidth="0.9"
          />

          {/* The Bring Focus element, pressed. */}
          <rect x="84" y="38" width="52" height="16" rx="8" fill={SKY} />
          <circle cx="94" cy="46" r="3.6" fill="none" stroke="#ffffff" strokeWidth="0.9" />
          <circle cx="94" cy="46" r="1.1" fill="#ffffff" />
          <path
            d="M94 41.2v1.6M94 49.2v1.6M89.2 46h1.6M97.2 46h1.6"
            stroke="#ffffff"
            strokeWidth="0.8"
            strokeLinecap="round"
          />
          <text x="101" y="47.8" fontSize="5" fontWeight="700" fill="#ffffff">
            Look here
          </text>
          <Cursor x={113} y={52} color={SKY_DEEP} name="Maya" />
        </g>
        {/* Two teammates, each somewhere else on the canvas, asked rather than dragged. */}
        {[
          { x: 16, y: 14, who: 'SK', color: VIOLET, d: 0.7 },
          { x: 224, y: 50, who: 'AN', color: EMERALD, d: 1.1 },
        ].map((t) => (
          <g key={t.who}>
            <rect
              className="stroke-slate-300 dark:stroke-slate-600"
              x={t.x}
              y={t.y}
              width="60"
              height="34"
              rx="4"
              fill="none"
              stroke="#cbd5e1"
              strokeWidth="0.7"
              strokeDasharray="2 1.6"
            />
            <g className="fa-e-in" style={at(t.d)}>
              <Panel x={t.x + 4} y={t.y + 6} w={52} h={22}>
                <Avatar cx={t.x + 11} cy={t.y + 13.5} initials={t.who} color={t.color} r={3.6} />
                <text
                  x={t.x + 17}
                  y={t.y + 15}
                  fontSize="3.8"
                  fontWeight="600"
                  className={INK}
                  fill="#1e293b"
                >
                  Maya asks you
                </text>
                <text
                  x={t.x + 17}
                  y={t.y + 19.5}
                  fontSize="3.8"
                  className={INK_SOFT}
                  fill="#64748b"
                >
                  to look here
                </text>
                <rect x={t.x + 34} y={t.y + 21} width="19" height="5.4" rx="2.7" fill={SKY} />
                <text
                  x={t.x + 43.5}
                  y={t.y + 24.8}
                  textAnchor="middle"
                  fontSize="3.4"
                  fontWeight="700"
                  fill="#ffffff"
                >
                  Go there
                </text>
              </Panel>
            </g>
          </g>
        ))}
        <Lines x={20} y={58} w={44} count={2} gap={4} />
        <Lines x={232} y={20} w={44} count={2} gap={4} />
      </svg>
    </Frame>
  );
}
