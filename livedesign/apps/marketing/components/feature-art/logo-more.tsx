// The Logos section's other card art: the logo layouts a page starts from, and wireframe pages.
// Same vocabulary as ./logo and ./pages (page-kit's paper, the fa-e-* loops in
// app/feature-art/pages.css); under reduced motion each shows its finished frame.

import type { CSSProperties } from 'react';
import { Frame, MONO } from '@liveworkspace/marketing-site/components/feature-art/shared';
import {
  at,
  INK,
  INK_SOFT,
  LINE,
  Lines,
  Page,
  SKY,
  VIOLET,
  AMBER,
  EMERALD,
  ROSE,
} from '@liveworkspace/marketing-site/components/feature-art/page-kit';

// Four small artboards, each a different kind of logo layout: an emblem, a monogram, a lockup and a
// wordmark, landing in turn as the layout picker deals them.
const BOARDS = [
  { x: 22, label: 'Emblem' },
  { x: 92, label: 'Monogram' },
  { x: 162, label: 'Lockup' },
  { x: 232, label: 'Wordmark' },
] as const;
const SIZE = 50;
const TOP = 18;

/** Logo layouts: four ready-made marks on square artboards, the picked one ringed. */
export function LogoLayoutsArt() {
  return (
    <Frame canvas>
      <svg viewBox="0 0 300 96" className="absolute inset-0 h-full w-full">
        {BOARDS.map(({ x, label }, i) => {
          const cx = x + SIZE / 2;
          const cy = TOP + SIZE / 2;
          return (
            <g key={label} className="fa-e-pop" style={at(0.2 + i * 0.35)}>
              <Page x={x} y={TOP} w={SIZE} h={SIZE}>
                {i === 0 ? (
                  <>
                    <circle cx={cx} cy={cy - 3} r="13" fill="none" stroke={SKY} strokeWidth="3" />
                    <path d={`M${cx - 7} ${cy + 1}l7-10 7 10z`} fill={VIOLET} />
                  </>
                ) : null}
                {i === 1 ? (
                  <>
                    <rect x={cx - 13} y={cy - 16} width="26" height="26" rx="7" fill={VIOLET} />
                    <text
                      x={cx}
                      y={cy + 2.5}
                      textAnchor="middle"
                      fontSize="14"
                      fontWeight="800"
                      fill="#ffffff"
                    >
                      A
                    </text>
                  </>
                ) : null}
                {i === 2 ? (
                  <>
                    <circle cx={x + 13} cy={cy - 3} r="6" fill={AMBER} />
                    <rect x={x + 22} y={cy - 7} width="20" height="3.6" rx="1.8" fill={SKY} />
                    <rect x={x + 22} y={cy - 1} width="14" height="2.4" rx="1.2" fill="#94a3b8" />
                  </>
                ) : null}
                {i === 3 ? (
                  <text
                    className={INK}
                    x={cx}
                    y={cy + 1}
                    textAnchor="middle"
                    fontSize="9"
                    fontWeight="800"
                    letterSpacing="0.8"
                    fill="#1e293b"
                  >
                    north
                  </text>
                ) : null}
              </Page>
              <text
                x={cx}
                y={TOP + SIZE + 9}
                textAnchor="middle"
                fontSize="4.6"
                fontWeight="600"
                className={INK_SOFT}
                fill="#64748b"
              >
                {label}
              </text>
            </g>
          );
        })}
        {/* The picked layout, ringed as the picker rings its choice. */}
        <rect
          className="fa-e-in"
          style={at(1.9)}
          x={BOARDS[1].x - 3}
          y={TOP - 3}
          width={SIZE + 6}
          height={SIZE + 6}
          rx="4"
          fill="none"
          stroke={SKY}
          strokeWidth="1.2"
        />
      </svg>
    </Frame>
  );
}

// A wireframe block: the grey fill a wireframe draws a placeholder in.
const BLOCK = 'fill-slate-200 dark:fill-slate-600';

/** Wireframe pages: a phone screen and a browser page, their blocks landing, a tap joining them. */
export function WireframePagesArt() {
  return (
    <Frame canvas>
      <svg viewBox="0 0 300 96" className="absolute inset-0 h-full w-full">
        {/* The phone: its frame, a header bar, a picture, rows and a button. */}
        <g className="fa-e-in" style={at(0.2)}>
          <rect
            className="fill-white stroke-slate-300 dark:fill-slate-800 dark:stroke-slate-500"
            x="40"
            y="8"
            width="46"
            height="82"
            rx="7"
            fill="#ffffff"
            stroke="#cbd5e1"
            strokeWidth="1"
          />
          <rect className={BLOCK} x="57" y="12" width="12" height="2" rx="1" fill="#e2e8f0" />
        </g>
        <rect
          className={`fa-e-pop ${BLOCK}`}
          style={at(0.6)}
          x="45"
          y="19"
          width="36"
          height="22"
          rx="2"
          fill="#e2e8f0"
        />
        <g className="fa-e-in" style={at(0.9)}>
          <Lines x={45} y={46} w={36} count={4} gap={5} />
        </g>
        <rect
          className="fa-e-pop"
          style={at(1.3)}
          x="45"
          y="72"
          width="36"
          height="9"
          rx="4.5"
          fill={SKY}
        />

        {/* The tap from the phone's button to the page it opens, as a wireframe flow links screens. */}
        <path
          className="fa-e-draw stroke-slate-400 dark:stroke-slate-500"
          style={{ ...at(1.7), '--e-len': 80 } as CSSProperties}
          d="M86 76 C 110 76 108 48 128 48"
          fill="none"
          stroke="#94a3b8"
          strokeWidth="1"
          strokeDasharray="2.5 2"
        />

        {/* The browser page: its bar and dots, a hero block, three cards. */}
        <g className="fa-e-in" style={at(2.1)}>
          <Page x={130} y={14} w={140} h={70} />
          <rect className={LINE} x="130" y="14" width="140" height="8" rx="1.6" fill="#e2e8f0" />
          {[136, 141, 146].map((cx) => (
            <circle key={cx} cx={cx} cy="18" r="1.3" fill="#94a3b8" />
          ))}
        </g>
        <rect
          className={`fa-e-pop ${BLOCK}`}
          style={at(2.5)}
          x="138"
          y="28"
          width="124"
          height="22"
          rx="2"
          fill="#e2e8f0"
        />
        <text
          className={`fa-e-in ${INK}`}
          style={at(2.7)}
          x="200"
          y="41"
          textAnchor="middle"
          fontSize="6"
          fontWeight="700"
          fill="#1e293b"
        >
          Plan your trip
        </text>
        {[138, 181, 224].map((x, i) => (
          <g key={x} className="fa-e-pop" style={at(3 + i * 0.2)}>
            <rect className={BLOCK} x={x} y="56" width="38" height="22" rx="2" fill="#e2e8f0" />
            <rect
              x={x + 4}
              y="70"
              width="16"
              height="3"
              rx="1.5"
              fill={i === 1 ? EMERALD : '#94a3b8'}
            />
          </g>
        ))}
      </svg>
    </Frame>
  );
}

// A measured gap: a red line with its distance in a pill, as Inspect draws spacing on the canvas.
// Inspect's measured lines and their pills (apps/live/components/canvas/inspect/InspectOverlay.tsx INSPECT_LINE_COLOUR).
const MEASURE = '#e5484d';

function Gap({
  x1,
  y1,
  x2,
  y2,
  value,
  delay,
}: {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  value: string;
  delay: number;
}) {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  return (
    <g className="fa-e-in" style={at(delay)}>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={MEASURE} strokeWidth="0.9" />
      <rect x={mx - 6} y={my - 3.5} width="12" height="7" rx="3.5" fill={MEASURE} />
      <text x={mx} y={my + 2} textAnchor="middle" fontSize="4.6" fontWeight="700" fill="#ffffff">
        {value}
      </text>
    </g>
  );
}

// The panel's values, as the Inspect panel lists them (apps/live/components/panels/inspect/InspectPanel.tsx):
// Layout's size, then Colours with a swatch. The button is 345 by 48 points on a 393-point phone, 24 in from
// each side, and filled in the theme's sky.
const INSPECT_LAYOUT = [
  { name: 'W', value: '345' },
  { name: 'H', value: '48' },
] as const;
const INSPECT_COLOURS = [
  { name: 'Fill', value: '#0EA5E9', swatch: SKY },
  { name: 'Border', value: 'None', swatch: null },
] as const;

/** A section heading in the Inspect panel: small, upper case, muted. */
function InspectHeading({ x, y, children }: { x: number; y: number; children: string }) {
  return (
    <text
      className={INK_SOFT}
      x={x}
      y={y}
      fontSize="3.8"
      fontWeight="700"
      letterSpacing="0.4"
      fill="#64748b"
    >
      {children.toUpperCase()}
    </text>
  );
}

/** One copyable value: a slate cell with its name small above the value in mono. */
function InspectCell({
  x,
  y,
  name,
  value,
  swatch,
}: {
  x: number;
  y: number;
  name: string;
  value: string;
  swatch?: string | null;
}) {
  const tx = swatch === undefined ? x + 3 : x + 11;
  return (
    <g>
      <rect
        className="fill-slate-50 dark:fill-slate-700/60"
        x={x}
        y={y}
        width="55"
        height="12"
        rx="2"
        fill="#f8fafc"
      />
      {swatch !== undefined ? (
        <g>
          <rect
            className="stroke-slate-300 dark:stroke-slate-500"
            x={x + 2.5}
            y={y + 2.5}
            width="7"
            height="7"
            rx="1.2"
            fill={swatch ?? '#ffffff'}
            stroke="#cbd5e1"
            strokeWidth="0.5"
          />
          {swatch ? null : <path d={`M${x + 3} ${y + 9} l6 -6`} stroke={ROSE} strokeWidth="0.6" />}
        </g>
      ) : null}
      <text className={INK_SOFT} x={tx} y={y + 4.8} fontSize="3.4" fill="#64748b">
        {name}
      </text>
      <text
        className={INK}
        x={tx}
        y={y + 9.8}
        fontSize="4.4"
        fontWeight="600"
        fontFamily={MONO}
        fill="#1e293b"
      >
        {value}
      </text>
    </g>
  );
}

/** Inspect: a wireframe screen's button measured to its neighbours, and its values in the Inspect panel. */
export function InspectArt() {
  return (
    <Frame canvas>
      <svg viewBox="0 0 300 96" className="absolute inset-0 h-full w-full">
        {/* The phone and its Sign In screen: a heading, two fields, the button. */}
        <g className="fa-e-in" style={at(0.2)}>
          <rect
            className="fill-white stroke-slate-300 dark:fill-slate-800 dark:stroke-slate-500"
            x="40"
            y="6"
            width="62"
            height="86"
            rx="8"
            fill="#ffffff"
            stroke="#cbd5e1"
            strokeWidth="1"
          />
          <rect className={BLOCK} x="64" y="10" width="14" height="2" rx="1" fill="#e2e8f0" />
          <rect className={BLOCK} x="47" y="18" width="30" height="4" rx="1" fill="#e2e8f0" />
          <rect
            className="fill-white stroke-slate-300 dark:fill-slate-800 dark:stroke-slate-500"
            x="47"
            y="28"
            width="48"
            height="10"
            rx="2"
            fill="#ffffff"
            stroke="#cbd5e1"
            strokeWidth="0.8"
          />
          <rect
            className="fill-white stroke-slate-300 dark:fill-slate-800 dark:stroke-slate-500"
            x="47"
            y="42"
            width="48"
            height="10"
            rx="2"
            fill="#ffffff"
            stroke="#cbd5e1"
            strokeWidth="0.8"
          />
          <rect x="47" y="60" width="48" height="10" rx="5" fill={SKY} />
        </g>

        {/* The button selected for Inspect, then its spacing measured out to each side. */}
        <rect
          className="fa-e-pop stroke-brand-500"
          style={at(0.8)}
          x="45.5"
          y="58.5"
          width="51"
          height="13"
          rx="6.5"
          fill="none"
          strokeWidth="1"
        />
        <g className="fa-e-pop" style={at(0.9)}>
          <rect
            className="fill-brand-600"
            x="56"
            y="73.5"
            width="30"
            height="7"
            rx="2"
            fill="#e11d48"
          />
          <text x="71" y="78.6" textAnchor="middle" fontSize="4.4" fontWeight="600" fill="#ffffff">
            345 × 48
          </text>
        </g>
        <Gap x1={71} y1={52} x2={71} y2={60} value="16" delay={1.2} />
        <Gap x1={40} y1={65} x2={47} y2={65} value="24" delay={1.5} />
        <Gap x1={95} y1={65} x2={102} y2={65} value="24" delay={1.5} />

        {/* The Inspect panel: its title, Layout and Colours, then the Code buttons. */}
        <g className="fa-e-in" style={at(1.9)}>
          <rect
            className="fill-white stroke-slate-200 dark:fill-slate-800 dark:stroke-slate-600"
            x="130"
            y="6"
            width="134"
            height="84"
            rx="5"
            fill="#ffffff"
            stroke="#e2e8f0"
            strokeWidth="1"
          />
          <text className={INK} x="137" y="16" fontSize="6" fontWeight="700" fill="#1e293b">
            Inspect
          </text>
        </g>
        <g className="fa-e-in" style={at(2.2)}>
          <InspectHeading x={137} y={25}>
            Layout
          </InspectHeading>
          {INSPECT_LAYOUT.map((c, i) => (
            <InspectCell key={c.name} x={137 + i * 61} y={27.5} name={c.name} value={c.value} />
          ))}
        </g>
        <g className="fa-e-in" style={at(2.6)}>
          <InspectHeading x={137} y={47}>
            Colours
          </InspectHeading>
          {INSPECT_COLOURS.map((c, i) => (
            <InspectCell
              key={c.name}
              x={137 + i * 61}
              y={49.5}
              name={c.name}
              value={c.value}
              swatch={c.swatch}
            />
          ))}
        </g>
        <g className="fa-e-pop" style={at(3.2)}>
          <InspectHeading x={137} y={69}>
            Code
          </InspectHeading>
          {['Copy CSS', 'Copy Values'].map((label, i) => (
            <g key={label}>
              <rect
                className="fill-slate-900 dark:fill-slate-100"
                x={137 + i * 61}
                y="72"
                width="55"
                height="11"
                rx="2"
                fill="#0f172a"
              />
              <text
                className="fill-white dark:fill-slate-900"
                x={164.5 + i * 61}
                y="78.9"
                textAnchor="middle"
                fontSize="4.6"
                fontWeight="600"
                fill="#ffffff"
              >
                {label}
              </text>
            </g>
          ))}
        </g>
      </svg>
    </Frame>
  );
}
