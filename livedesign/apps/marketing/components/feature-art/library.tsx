// The Collaborate section's cards for what travels between apps (liveworkspace/docs/specs/006-media/libraries.md,
// the Live Embed element and charts linked to a liveplanner sheet): a selection saved to the Library and waiting in the
// palette, and a live view of another app's file beside a chart redrawn from its sheet. Built on page-kit so each
// reads in light and dark; motion is the fa-e-* loops in app/feature-art/pages.css, settled under reduced motion.

import { Frame } from '@liveworkspace/marketing-site/components/feature-art/shared';
import {
  at,
  EMERALD,
  INK,
  INK_SOFT,
  LINE,
  Page,
  Panel,
  ROSE,
  SKY,
  VIOLET,
} from '@liveworkspace/marketing-site/components/feature-art/page-kit';

const TILE = 'fill-slate-50 stroke-slate-200 dark:fill-slate-800 dark:stroke-slate-600';

/** A lock-up the Library keeps: a mark and a name bar, at the tile's scale. */
function Lockup({ x, y, colour }: { x: number; y: number; colour: string }) {
  return (
    <g>
      <circle cx={x + 6} cy={y + 6} r="4.5" fill={colour} />
      <rect x={x + 13} y={y + 4.6} width="14" height="2.8" rx="1.4" fill={colour} />
    </g>
  );
}

/** Save to Library: a selected lock-up on a page, saved, landing in the palette's Library under Personal and a team. */
export function LibraryArt() {
  const tiles = [
    { x: 182, y: 34, colour: SKY },
    { x: 222, y: 34, colour: EMERALD },
    { x: 182, y: 60, colour: ROSE },
  ];
  return (
    <Frame canvas>
      <svg viewBox="0 0 300 96" className="absolute inset-0 h-full w-full">
        {/* The selection on its page, and the Save to Library button beside it. */}
        <Page x={20} y={20} w={96} h={60} />
        <Lockup x={46} y={44} colour={VIOLET} />
        <rect
          x="40"
          y="38"
          width="40"
          height="24"
          rx="1"
          fill="none"
          stroke={SKY}
          strokeWidth="0.9"
          strokeDasharray="2 1.5"
        />
        <rect
          className="fill-white stroke-slate-200 dark:fill-slate-800 dark:stroke-slate-600"
          x="34"
          y="8"
          width="54"
          height="11"
          rx="5.5"
          fill="#ffffff"
          stroke="#e2e8f0"
          strokeWidth="0.8"
        />
        <text x="61" y="15" textAnchor="middle" fontSize="5" fontWeight="700" fill={VIOLET}>
          Save to Library
        </text>
        <path
          className="fa-e-in"
          style={at(0.4)}
          d="M120 50h40m-4-3 4 3-4 3"
          fill="none"
          stroke={VIOLET}
          strokeWidth="1"
          strokeDasharray="2.5 2"
        />

        {/* The palette's Library: Personal and the team's, its items in folders. */}
        <Panel x={170} y={6} w={112} h={84} title="Library" />
        <rect x="176" y="18" width="32" height="9" rx="4.5" fill={VIOLET} fillOpacity="0.15" />
        <text x="192" y="24.2" textAnchor="middle" fontSize="4.8" fontWeight="700" fill={VIOLET}>
          Personal
        </text>
        <text
          x="226"
          y="24.2"
          textAnchor="middle"
          fontSize="4.8"
          fontWeight="600"
          className={INK_SOFT}
          fill="#64748b"
        >
          Design Team
        </text>
        <text x="182" y="32" fontSize="4.4" fontWeight="600" className={INK_SOFT} fill="#64748b">
          Marks
        </text>
        {tiles.map((t) => (
          <g key={`${t.x}-${t.y}`}>
            <rect
              className={TILE}
              x={t.x}
              y={t.y}
              width="34"
              height="20"
              rx="2.5"
              fill="#f8fafc"
              stroke="#e2e8f0"
              strokeWidth="0.7"
            />
            <Lockup x={t.x + 3.5} y={t.y + 4} colour={t.colour} />
          </g>
        ))}
        {/* The item just saved, landing in the folder. */}
        <g className="fa-e-pop" style={at(0.9)}>
          <rect
            className="fill-white dark:fill-slate-800"
            x="222"
            y="60"
            width="34"
            height="20"
            rx="2.5"
            fill="#ffffff"
            stroke={VIOLET}
            strokeWidth="1"
          />
          <Lockup x={225.5} y={64} colour={VIOLET} />
        </g>
        <text x="182" y="86" fontSize="4.4" className={INK} fill="#1e293b">
          Click or drag to place
        </text>
      </svg>
    </Frame>
  );
}

/** Live Embed and a linked chart: another app's plan shown live on a page, and a chart redrawn from its sheet. */
export function LiveEmbedArt() {
  const columns = [
    { x: 34, cards: 3 },
    { x: 62, cards: 2 },
    { x: 90, cards: 1 },
  ];
  const sheet = [42, 28, 56];
  return (
    <Frame canvas>
      <svg viewBox="0 0 300 96" className="absolute inset-0 h-full w-full">
        {/* The Live Embed: a plan from another app, read-only and live. */}
        <Page x={24} y={10} w={98} h={74}>
          <text x="30" y="20" fontSize="5" fontWeight="700" className={INK} fill="#1e293b">
            Launch Plan
          </text>
          <g className="fa-e-blink">
            <circle cx="113" cy="18.4" r="1.8" fill={EMERALD} />
          </g>
          {columns.map((c) =>
            Array.from({ length: c.cards }, (_, i) => (
              <rect
                key={`${c.x}-${i}`}
                className="fill-slate-100 stroke-slate-200 dark:fill-slate-700 dark:stroke-slate-600"
                x={c.x - 4}
                y={26 + i * 15}
                width="24"
                height="12"
                rx="1.6"
                fill="#f1f5f9"
                stroke="#e2e8f0"
                strokeWidth="0.6"
              />
            )),
          )}
        </Page>
        <text
          x="73"
          y="92"
          textAnchor="middle"
          fontSize="4.8"
          fontWeight="600"
          className={INK_SOFT}
          fill="#64748b"
        >
          Live Embed
        </text>

        {/* The sheet's range, and the chart linked to it. */}
        <g>
          <rect
            className="fill-white stroke-slate-200 dark:fill-slate-800 dark:stroke-slate-600"
            x="140"
            y="22"
            width="40"
            height="44"
            rx="2"
            fill="#ffffff"
            stroke="#e2e8f0"
            strokeWidth="0.7"
          />
          {sheet.map((v, i) => (
            <g key={v}>
              <rect
                className={LINE}
                x="140"
                y={36 + i * 10}
                width="40"
                height="0.6"
                fill="#e2e8f0"
              />
              <rect
                className={LINE}
                x="145"
                y={30 + i * 10}
                width="12"
                height="2"
                rx="1"
                fill="#e2e8f0"
              />
              <text
                x="175"
                y={32 + i * 10}
                textAnchor="end"
                fontSize="4.6"
                className={INK}
                fill="#1e293b"
              >
                {v}
              </text>
            </g>
          ))}
          <text
            x="160"
            y="76"
            textAnchor="middle"
            fontSize="4.8"
            fontWeight="600"
            className={INK_SOFT}
            fill="#64748b"
          >
            Sheet
          </text>
        </g>
        <path
          className="fa-e-in"
          style={at(0.4)}
          d="M184 44h16m-4-3 4 3-4 3"
          fill="none"
          stroke={SKY}
          strokeWidth="1"
          strokeDasharray="2.5 2"
        />
        <Page x={206} y={14} w={72} h={62}>
          <rect className={LINE} x="212" y="68" width="60" height="0.8" fill="#e2e8f0" />
          {sheet.map((v, i) => (
            <rect
              key={v}
              className="fa-e-rise"
              style={at(0.6 + i * 0.2)}
              x={218 + i * 18}
              y={68 - v * 0.8}
              width="11"
              height={v * 0.8}
              rx="1"
              fill={SKY}
            />
          ))}
        </Page>
        <text
          x="242"
          y="86"
          textAnchor="middle"
          fontSize="4.8"
          fontWeight="600"
          className={INK_SOFT}
          fill="#64748b"
        >
          Bar Chart
        </text>
      </svg>
    </Frame>
  );
}
