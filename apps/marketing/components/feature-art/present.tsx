// Feature art for presenting and running the room (docs/specs/019-marketing/marketing-site.md,
// docs/specs/012-collaboration/presentation-mode.md, facilitator.md, bring-focus.md): slides cut
// from a diagram, one deck drawn from several tabs, the presenter's own notes, a deck that plays on
// your screen alone. Each is a small mock of the real surface, built on ./page-kit so it reads in
// light and in dark. The room tools (3D, the facilitator, Bring Focus) live in ./room.

import type { CSSProperties } from 'react';
import { Frame } from './shared';
import {
  AMBER,
  at,
  Cursor,
  EMERALD,
  INK,
  INK_SOFT,
  Panel,
  ROSE,
  Screen,
  SKY,
  SKY_DEEP,
  VIOLET,
} from './page-kit';

// A shape on the canvas in the Default scheme's colours, with its label.
function Shape({ x, y, w = 26, label }: { x: number; y: number; w?: number; label: string }) {
  return (
    <g>
      <rect
        className="fill-(--art-ink-fill) stroke-(--art-ink-stroke)"
        x={x}
        y={y}
        width={w}
        height="12"
        rx="3.4"
        fill="#f0f9ff"
        stroke={SKY}
        strokeWidth="1"
      />
      <text
        className="fill-(--art-ink-text)"
        x={x + w / 2}
        y={y + 7.8}
        textAnchor="middle"
        fontSize="4.6"
        fontWeight="700"
        fill="#075985"
      >
        {label}
      </text>
    </g>
  );
}

// An arrow on the canvas, head included.
function Arrow({ d, head }: { d: string; head: string }) {
  return (
    <g
      className="stroke-(--art-arrow)"
      stroke="#334155"
      strokeWidth="0.9"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={d} />
      <path d={head} />
    </g>
  );
}

// A slide in miniature: a dark 16:9 card with a title bar and two boxes.
function SlideThumb({
  x,
  y,
  w = 26,
  accent = SKY,
}: {
  x: number;
  y: number;
  w?: number;
  accent?: string;
}) {
  const h = (w * 9) / 16;
  return (
    <g>
      <rect
        className="dark:stroke-slate-600"
        x={x}
        y={y}
        width={w}
        height={h}
        rx="1.6"
        fill="#0b1220"
        stroke="#1e293b"
        strokeWidth="0.5"
      />
      <rect
        x={x + w * 0.12}
        y={y + h * 0.18}
        width={w * 0.4}
        height={h * 0.12}
        rx="0.6"
        fill="#ffffff"
        fillOpacity="0.85"
      />
      <rect
        x={x + w * 0.12}
        y={y + h * 0.45}
        width={w * 0.3}
        height={h * 0.34}
        rx="0.8"
        fill={accent}
        fillOpacity="0.9"
      />
      <rect
        x={x + w * 0.52}
        y={y + h * 0.45}
        width={w * 0.3}
        height={h * 0.34}
        rx="0.8"
        fill={accent}
        fillOpacity="0.45"
      />
    </g>
  );
}

/** Slides made from what you drew: a selection on the canvas becomes the deck's newest slide. */
export function SlideDeckArt() {
  return (
    <Frame canvas>
      <svg viewBox="0 0 300 96" className="absolute inset-0 h-full w-full">
        <g transform="translate(16 0)">
          <Shape x={14} y={20} label="Plan" />
          <Shape x={58} y={20} label="Build" />
          <Shape x={58} y={56} label="Ship" />
          <Arrow d="M40 26h17" head="M54 23.5l3 2.5-3 2.5" />
          <Arrow d="M71 32v23" head="M68.5 52l2.5 3 2.5-3" />

          {/* The selection: a marquee round Build and Ship, and the action it offers. */}
          <g className="fa-e-in" style={at(0)}>
            <rect
              x="52"
              y="15"
              width="38"
              height="58"
              rx="2"
              fill={SKY}
              fillOpacity="0.06"
              stroke={SKY}
              strokeWidth="0.8"
              strokeDasharray="2.4 1.6"
            />
            {[
              [52, 15],
              [90, 15],
              [52, 73],
              [90, 73],
            ].map(([cx, cy]) => (
              <rect
                key={`${cx}-${cy}`}
                className="fill-white dark:fill-slate-900"
                x={cx! - 1.6}
                y={cy! - 1.6}
                width="3.2"
                height="3.2"
                fill="#ffffff"
                stroke={SKY}
                strokeWidth="0.7"
              />
            ))}
          </g>
          <g className="fa-e-pop" style={at(0.7)}>
            <rect x="104" y="40" width="30" height="10" rx="5" fill={SKY} />
            <text
              x="119"
              y="46.6"
              textAnchor="middle"
              fontSize="4.4"
              fontWeight="700"
              fill="#ffffff"
            >
              Add slide
            </text>
          </g>
        </g>
        <g transform="translate(78 0)">
          {/* The Slide Deck panel, the new slide arriving third. */}
          <Panel x={136} y={8} w={70} h={80} title="Slide deck">
            {[
              ['Overview', '3 shapes'],
              ['The flow', '4 shapes'],
              ['Build, Ship', '2 shapes'],
            ].map(([name, detail], i) => (
              <g
                key={name}
                className={i === 2 ? 'fa-e-pop' : undefined}
                style={i === 2 ? at(1.3) : undefined}
              >
                {i === 2 ? (
                  <rect
                    className="fill-sky-50 dark:fill-sky-950"
                    x="139"
                    y={18.5 + i * 22}
                    width="64"
                    height="20"
                    rx="2.4"
                    fill="#f0f9ff"
                    stroke={SKY}
                    strokeWidth="0.7"
                  />
                ) : null}
                <text
                  x="143"
                  y={27 + i * 22}
                  fontSize="4"
                  fontWeight="700"
                  className={INK_SOFT}
                  fill="#64748b"
                >
                  {i + 1}
                </text>
                <SlideThumb x={148} y={21 + i * 22} w={26} />
                <text
                  x="177"
                  y={27 + i * 22}
                  fontSize="4.2"
                  fontWeight="600"
                  className={INK}
                  fill="#1e293b"
                >
                  {name}
                </text>
                <text x="177" y={32 + i * 22} fontSize="3.6" className={INK_SOFT} fill="#64748b">
                  {detail}
                </text>
              </g>
            ))}
          </Panel>
        </g>
      </svg>
    </Frame>
  );
}

/** One deck across every tab: the deck's rows, each from its own tab, one being dragged into place. */
export function FullScreenSlideArt() {
  const rows: {
    title: string;
    tab: string;
    color: string;
    hidden?: boolean;
    style?: CSSProperties;
    moving?: boolean;
    shapes: number;
  }[] = [
    { title: 'System overview', tab: 'Architecture', color: SKY, shapes: 9 },
    {
      title: 'Q3 roadmap',
      shapes: 6,
      tab: 'Roadmap',
      color: EMERALD,
      moving: true,
      style: { ...at(0.4), '--e-y': '17px' } as CSSProperties,
    },
    {
      title: 'Data flow',
      shapes: 5,
      tab: 'Architecture',
      color: SKY,
      moving: true,
      style: { ...at(0.4), '--e-y': '-17px' } as CSSProperties,
    },
    { title: 'Open risks', tab: 'Risks', color: ROSE, hidden: true, shapes: 4 },
  ];
  return (
    <Frame canvas>
      <svg viewBox="0 0 300 96" className="absolute inset-0 h-full w-full">
        <Panel x={30} y={6} w={240} h={86} title="Slide deck">
          <text x="264" y="15.5" textAnchor="end" fontSize="4" className={INK_SOFT} fill="#64748b">
            4 slides, 3 tabs
          </text>
          {rows.map((row, i) => {
            const y = 19 + i * 17;
            return (
              <g
                key={row.title}
                className={row.moving ? 'fa-e-move' : undefined}
                style={row.style}
                opacity={row.hidden ? 0.45 : 1}
              >
                {/* The row lifted while it moves: a card with its own shadow. */}
                <rect
                  className="fill-white stroke-slate-200 dark:fill-slate-900 dark:stroke-slate-700"
                  x="34"
                  y={y}
                  width="232"
                  height="15"
                  rx="2.6"
                  fill="#ffffff"
                  stroke="#e2e8f0"
                  strokeWidth="0.6"
                />
                <g className="fill-slate-300 dark:fill-slate-600" fill="#cbd5e1">
                  {[0, 1, 2].map((r) =>
                    [0, 1].map((c) => (
                      <circle key={`${r}${c}`} cx={39 + c * 2} cy={y + 4.6 + r * 2.8} r="0.6" />
                    )),
                  )}
                </g>
                <SlideThumb x={45} y={y + 2.5} w={17.5} accent={row.color} />
                <text
                  x="67"
                  y={y + 9.4}
                  fontSize="4.8"
                  fontWeight="600"
                  className={INK}
                  fill="#1e293b"
                >
                  {row.title}
                </text>
                <text x="150" y={y + 9.2} fontSize="3.8" className={INK_SOFT} fill="#64748b">
                  {row.shapes} shapes
                </text>
                {/* The tab it comes from, in that tab's colour. */}
                <rect
                  x={214}
                  y={y + 4}
                  width={row.tab.length * 2.6 + 7}
                  height="7"
                  rx="3.5"
                  fill={row.color}
                  fillOpacity="0.15"
                />
                <circle cx="217.5" cy={y + 7.5} r="1.3" fill={row.color} />
                <text x="220.5" y={y + 9} fontSize="3.8" fontWeight="600" fill={row.color}>
                  {row.tab}
                </text>
                {row.hidden ? (
                  <path
                    d={`M252 ${y + 7.5}c2-3 7-3 9 0c-2 3-7 3-9 0zM252 ${y + 11}l9-7`}
                    fill="none"
                    className="stroke-slate-400"
                    stroke="#94a3b8"
                    strokeWidth="0.7"
                  />
                ) : null}
              </g>
            );
          })}
        </Panel>
        <g className="fa-e-move" style={{ ...at(0.4), '--e-y': '17px' } as CSSProperties}>
          <Cursor x={124} y={42} color={SKY_DEEP} />
        </g>
      </svg>
    </Frame>
  );
}

/** Notes only you open: presenting full screen, the notes opened from the corner for you alone. */
export function PresenterNotesArt() {
  return (
    <Frame>
      <svg viewBox="0 0 300 96" className="absolute inset-0 h-full w-full">
        <Screen x={10} y={7} w={280} h={82} />
        {/* The slide, filling the screen. */}
        <text x="24" y="25" fontSize="3.6" fontWeight="700" letterSpacing="0.4" fill="#7dd3fc">
          QUARTERLY REVIEW
        </text>
        <text x="24" y="35" fontSize="8.4" fontWeight="800" fill="#ffffff">
          Q3 at a glance
        </text>
        <g fill={SKY}>
          {[10, 16, 13, 24, 31].map((h, i) => (
            <rect
              key={i}
              x={26 + i * 19}
              y={76 - h}
              width="12"
              height={h}
              rx="1.4"
              fillOpacity={i === 4 ? 1 : 0.4}
            />
          ))}
        </g>
        <path d="M24 76.5h96" stroke="#ffffff" strokeOpacity="0.15" strokeWidth="0.6" />

        <g transform="translate(80 0)">
          {/* The HUD: notes, position, controls. */}
          <rect x="150" y="78" width="52" height="8" rx="4" fill="#ffffff" fillOpacity="0.08" />
          <rect x="151" y="79" width="19" height="6" rx="3" fill={SKY} />
          <text
            x="160.5"
            y="83.3"
            textAnchor="middle"
            fontSize="3.6"
            fontWeight="700"
            fill="#ffffff"
          >
            Notes
          </text>
          <text
            x="186"
            y="83.3"
            textAnchor="middle"
            fontSize="3.8"
            fontWeight="600"
            fill="#ffffff"
            fillOpacity="0.75"
          >
            3 / 12
          </text>
        </g>
        <g transform="translate(76 0)">
          {/* The notes, opened from the HUD. */}
          <g className="fa-e-in" style={at(0.5)}>
            <rect x="112" y="16" width="90" height="56" rx="4" fill="#ffffff" />
            <circle cx="119" cy="23.5" r="2" fill={AMBER} />
            <text x="124" y="25" fontSize="4.6" fontWeight="700" fill="#1e293b">
              Speaker notes
            </text>
            <text x="194" y="25" textAnchor="end" fontSize="3.6" fill="#94a3b8">
              only you
            </text>
            <path d="M118 29.5h78" stroke="#e2e8f0" strokeWidth="0.5" />
            {['Open on the 48% jump.', 'Credit the platform team.', 'Pause for questions.'].map(
              (line, i) => (
                <g key={line}>
                  <circle cx="120" cy={37 + i * 8.5} r="0.9" fill={SKY} />
                  <text x="123.5" y={38.4 + i * 8.5} fontSize="4.2" fill="#334155">
                    {line}
                  </text>
                </g>
              ),
            )}
            <path d="M160 72l3 3.5 3-3.5z" fill="#ffffff" />
          </g>
        </g>
      </svg>
    </Frame>
  );
}

/** Your screen, not everyone else's: you present full screen; your teammates keep editing. */
export function PresentLocallyArt() {
  return (
    <Frame canvas>
      <svg viewBox="0 0 300 96" className="absolute inset-0 h-full w-full">
        <g transform="translate(16 0)">
          {/* You: the deck, full screen. */}
          <text x="16" y="14" fontSize="4.6" fontWeight="700" className={INK} fill="#1e293b">
            You
          </text>
          <g>
            <rect x="31" y="9.5" width="28" height="7" rx="3.5" fill={ROSE} fillOpacity="0.14" />
            <circle className="fa-pulse" cx="35" cy="13" r="1.4" fill={ROSE} />
            <text x="38" y="14.5" fontSize="3.8" fontWeight="700" fill={ROSE}>
              Presenting
            </text>
          </g>
          <Screen x={14} y={20} w={92} h={62} />
          <text x="22" y="34" fontSize="3.2" fontWeight="700" letterSpacing="0.4" fill="#7dd3fc">
            LAUNCH PLAN
          </text>
          <text x="22" y="42" fontSize="6.4" fontWeight="800" fill="#ffffff">
            Ship by Friday
          </text>
          <rect x="22" y="50" width="34" height="18" rx="2" fill={SKY} fillOpacity="0.9" />
          <rect x="60" y="50" width="38" height="18" rx="2" fill={SKY} fillOpacity="0.35" />
          <text x="96" y="78" textAnchor="end" fontSize="3.6" fill="#ffffff" fillOpacity="0.6">
            2 / 9
          </text>
        </g>
        <g transform="translate(52 0)">
          {/* Everyone else: the canvas as it was, still being worked on. */}
          <text x="116" y="14" fontSize="4.6" fontWeight="700" className={INK} fill="#1e293b">
            Everyone else
          </text>
          <rect
            className="stroke-slate-200 dark:stroke-slate-700"
            x="114"
            y="20"
            width="92"
            height="62"
            rx="5"
            fill="none"
            stroke="#e2e8f0"
            strokeWidth="0.8"
          />
          <Shape x={122} y={30} label="Brief" w={28} />
          <Shape x={170} y={30} label="Design" w={28} />
          <Shape x={146} y={60} label="Launch" w={28} />
          <Arrow d="M150 36h19" head="M166 33.5l3 2.5-3 2.5" />
          <Arrow d="M184 42c0 12-8 18-10 18" head="M177 57.5l-3 2.5 3.5 1.5" />
          {/* A teammate's edit, mid-flight: the shape they hold, their cursor moving it. */}
          <rect
            x="145"
            y="59"
            width="30"
            height="14"
            rx="4"
            fill="none"
            stroke={VIOLET}
            strokeWidth="0.8"
          />
          <g
            className="fa-e-move"
            style={{ ...at(0), '--e-x': '-10px', '--e-y': '4px' } as CSSProperties}
          >
            <Cursor x={170} y={66} color={VIOLET} name="Sam" />
          </g>
          <g
            className="fa-e-move"
            style={{ ...at(1.2), '--e-x': '12px', '--e-y': '-6px' } as CSSProperties}
          >
            <Cursor x={126} y={46} color={EMERALD} name="Ana" />
          </g>
        </g>
      </svg>
    </Frame>
  );
}
