// Feature art for presenting (docs/specs/019-marketing/marketing-site.md,
// docs/specs/012-collaboration/presentation-mode.md): the pages of several tabs in one running order,
// the presenter's own notes, and a presentation that plays on your screen alone. Each is a small mock of the real surface, built on ./page-kit so it reads in
// light and in dark.

import type { CSSProperties } from 'react';
import { Frame } from '@liveworkspace/marketing-site/components/feature-art/shared';
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
} from '@liveworkspace/marketing-site/components/feature-art/page-kit';

// A phone wireframe page on the canvas in miniature: its frame, a title bar, a picture and a button.
function PhoneScreen({ x, y, accent = SKY }: { x: number; y: number; accent?: string }) {
  return (
    <g>
      <rect
        className="fill-white stroke-slate-400 dark:fill-slate-800 dark:stroke-slate-500"
        x={x}
        y={y}
        width="22"
        height="40"
        rx="3.4"
        fill="#ffffff"
        stroke="#94a3b8"
        strokeWidth="0.8"
      />
      <rect
        className="fill-slate-300 dark:fill-slate-600"
        x={x + 4}
        y={y + 6}
        width="12"
        height="2"
        rx="1"
        fill="#cbd5e1"
      />
      <rect x={x + 4} y={y + 12} width="14" height="12" rx="1.4" fill={accent} fillOpacity="0.25" />
      <rect x={x + 4} y={y + 29} width="14" height="4" rx="2" fill={accent} />
    </g>
  );
}

// A page in miniature: a dark 16:9 card with a title bar and two boxes.
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

/** One running order across every tab: the pages' rows, each from its own tab, one being dragged into place. */
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
    { title: 'Bloom logo', tab: 'Logo', color: SKY, shapes: 4 },
    {
      title: 'Sign in',
      shapes: 7,
      tab: 'App screens',
      color: EMERALD,
      moving: true,
      style: { ...at(0.4), '--e-y': '17px' } as CSSProperties,
    },
    {
      title: 'Logo on a dark page',
      shapes: 3,
      tab: 'Logo',
      color: SKY,
      moving: true,
      style: { ...at(0.4), '--e-y': '-17px' } as CSSProperties,
    },
    { title: 'Old mark', tab: 'Logo', color: ROSE, hidden: true, shapes: 2 },
  ];
  return (
    <Frame canvas>
      <svg viewBox="0 0 300 96" className="absolute inset-0 h-full w-full">
        <Panel x={30} y={6} w={240} h={86} title="Slide Deck">
          <text x="264" y="15.5" textAnchor="end" fontSize="4" className={INK_SOFT} fill="#64748b">
            4 pages, 2 tabs
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
        {/* The page, filling the screen: the logo on its artboard. */}
        <text x="24" y="25" fontSize="3.6" fontWeight="700" letterSpacing="0.4" fill="#7dd3fc">
          BLOOM BRAND
        </text>
        <text x="24" y="35" fontSize="8.4" fontWeight="800" fill="#ffffff">
          The new mark
        </text>
        <circle cx="70" cy="60" r="13" fill="none" stroke={SKY} strokeWidth="4" />
        <circle cx="70" cy="60" r="5" fill={VIOLET} />

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
            {['Open on the mark alone.', 'Show it at icon size.', 'Pause for questions.'].map(
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
          {/* You: the design, full screen. */}
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
            APP SCREENS
          </text>
          <text x="22" y="42" fontSize="6.4" fontWeight="800" fill="#ffffff">
            The sign-in flow
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
          <PhoneScreen x={122} y={30} />
          <PhoneScreen x={149} y={30} accent={EMERALD} />
          <PhoneScreen x={176} y={30} accent={VIOLET} />
          {/* A teammate's edit, mid-flight: the screen they hold, their cursor on it. */}
          <rect
            x="174"
            y="28"
            width="26"
            height="44"
            rx="4.4"
            fill="none"
            stroke={VIOLET}
            strokeWidth="0.8"
          />
          <g
            className="fa-e-move"
            style={{ ...at(0), '--e-x': '-10px', '--e-y': '4px' } as CSSProperties}
          >
            <Cursor x={190} y={58} color={VIOLET} name="Sam" />
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
