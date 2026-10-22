// Feature illustrations: the technology icons and the ready-made components, split from ./content.
// Shared marks live in ./canvas-marks; ./shared holds Frame.

import type { ReactNode } from 'react';
import { HAIRLINE, INK, INK_TEXT, SHADOW, Scene, Selection, TEXT_STRONG } from './canvas-marks';
import { Glyph, ICON_PATHS } from './content-parts';
import { Frame } from './shared';

// A full-colour technology tile: the brand's own square, its mark in white, its name under it.
function TechTile({
  x,
  label,
  color,
  children,
}: {
  x: number;
  label: string;
  color: string;
  children: ReactNode;
}) {
  return (
    <g>
      <g className={SHADOW}>
        <rect x={x} y="28" width="28" height="28" rx="6" fill={color} />
      </g>
      {children}
      <text
        className={TEXT_STRONG}
        x={x + 14}
        y="68"
        fontSize="6.2"
        fontWeight="600"
        textAnchor="middle"
      >
        {label}
      </text>
    </g>
  );
}

// Technology icons: an architecture drawn with brand-accurate tiles, each landing labelled with
// its product name, traffic flowing along the connectors.
export function TechIconsArt() {
  const link = (x1: number, x2: number) => (
    <g key={x1}>
      <path className={HAIRLINE} d={`M${x1} 42 H${x2}`} strokeWidth="1.4" />
      <path
        className="fa-d-dots stroke-(--art-arrow)"
        d={`M${x1} 42 H${x2 - 2}`}
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray="0.01 6"
        fill="none"
      />
      <path className="fill-(--art-arrow)" d={`M${x2 + 3} 42 l-4.5 -2.6 v5.2z`} />
    </g>
  );
  return (
    <Frame canvas>
      <Scene>
        {/* People, as a themed icon. */}
        <g>
          <circle className={INK} cx="36" cy="42" r="14" strokeWidth="1.3" />
          <Glyph x={28} y={34} size={16} className="text-(--art-ink-stroke)">
            {ICON_PATHS.user}
          </Glyph>
          <text
            className={TEXT_STRONG}
            x="36"
            y="68"
            fontSize="6.2"
            fontWeight="600"
            textAnchor="middle"
          >
            Users
          </text>
        </g>
        {link(52, 76)}
        <TechTile x={80} label="Cloudflare" color="#f38020">
          <path
            d="M88 49h13.5a3.5 3.5 0 0 0 .4-7 5.4 5.4 0 0 0-10.4-1.2A3.6 3.6 0 0 0 88 49z"
            fill="#fff"
          />
        </TechTile>
        {link(110, 134)}
        <TechTile x={138} label="Lambda" color="#ed7100">
          <text x="152" y="47.5" fontSize="15" fontWeight="700" fill="#fff" textAnchor="middle">
            λ
          </text>
        </TechTile>
        {link(168, 192)}
        <TechTile x={196} label="PostgreSQL" color="#336791">
          <Glyph x={202} y={34} size={16} className="text-white">
            {ICON_PATHS.database}
          </Glyph>
        </TechTile>
        {link(226, 250)}
        <TechTile x={254} label="Redis" color="#dc382d">
          <g fill="#fff">
            <path d="M268 35.5 l7 3 -7 3 -7 -3z" />
            <path d="M261 42 l7 3 7 -3 v2 l-7 3 -7 -3z" opacity="0.85" />
            <path d="M261 46.5 l7 3 7 -3 v2 l-7 3 -7 -3z" opacity="0.7" />
          </g>
        </TechTile>
      </Scene>
    </Frame>
  );
}

// A small trend line for a KPI card.
function Spark({ x, y, points, color }: { x: number; y: number; points: number[]; color: string }) {
  const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x + i * 6} ${y - p}`).join(' ');
  return (
    <path
      d={d}
      fill="none"
      stroke={color}
      strokeWidth="1.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );
}

// Ready-made components (docs/specs/008-canvas/canvas-and-palette.md): a Stat row, selected as
// the one element it is, beside numbered Process steps, both themed and editable in place.
export function ComponentsArt() {
  const stats = [
    { n: '2,480', cap: 'Sign-ups', up: '+12%', points: [2, 4, 3, 6, 8, 9] },
    { n: '94%', cap: 'Uptime', up: '+0.4%', points: [6, 5, 7, 6, 8, 8] },
    { n: '38', cap: 'Teams', up: '+6', points: [1, 2, 4, 4, 6, 9] },
  ];
  const steps = ['Plan', 'Build', 'Ship'];
  return (
    <Frame canvas>
      <Scene>
        {/* The Stat row: one element of three KPI cards. */}
        {stats.map((s, i) => {
          const x = 16 + i * 52;
          return (
            <g key={s.cap} className={SHADOW}>
              <rect className={INK} x={x} y="26" width="47" height="46" rx="5" strokeWidth="1.1" />
              <text
                className={INK_TEXT}
                x={x + 6}
                y="36.5"
                fontSize="5.4"
                fontWeight="600"
                opacity="0.75"
              >
                {s.cap.toUpperCase()}
              </text>
              <text className={INK_TEXT} x={x + 6} y="50" fontSize="11" fontWeight="800">
                {s.n}
              </text>
              <text
                x={x + 6}
                y="60"
                fontSize="5.4"
                fontWeight="600"
                className="fill-emerald-600 dark:fill-emerald-400"
              >
                ▲ {s.up}
              </text>
              <Spark x={x + 9} y={68} points={s.points} color="#10b981" />
            </g>
          );
        })}
        <Selection x={13} y={23} w={158} h={52} className="fa-d-ring" />
        <g className="fa-d-ring">
          <rect
            className="fill-brand-500 dark:fill-brand-400"
            x="13"
            y="11"
            width="34"
            height="9.5"
            rx="2.5"
          />
          <text x="30" y="17.9" fontSize="5.6" fontWeight="600" fill="#fff" textAnchor="middle">
            Stat row
          </text>
        </g>
        {/* Process steps. */}
        <path
          className="stroke-(--art-ink-stroke)"
          d="M206 44 H264"
          strokeWidth="1.4"
          strokeDasharray="2.5 2.5"
        />
        {steps.map((label, i) => {
          const cx = 200 + i * 35;
          const done = i < 2;
          return (
            <g key={label}>
              <circle
                className={done ? 'fill-(--art-ink-stroke) stroke-(--art-ink-stroke)' : INK}
                cx={cx}
                cy="44"
                r="10"
                strokeWidth="1.4"
              />
              <text
                className={done ? '' : INK_TEXT}
                fill={done ? '#fff' : undefined}
                x={cx}
                y="47"
                fontSize="8"
                fontWeight="800"
                textAnchor="middle"
              >
                {i + 1}
              </text>
              <text
                className={INK_TEXT}
                x={cx}
                y="65"
                fontSize="6.4"
                fontWeight="600"
                textAnchor="middle"
              >
                {label}
              </text>
            </g>
          );
        })}
      </Scene>
    </Frame>
  );
}
