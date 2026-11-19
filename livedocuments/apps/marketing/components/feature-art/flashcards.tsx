// Feature art for flashcards (docs/specs/019-marketing/marketing-site.md,
// docs/specs/007-editor/flashcards.md): Contents on the left, its header adding up the whole talk ("6 cards · about
// 15 min") and each row its card's speaking time, the Conference Talk template's cards in order; on the right the
// stack as the editor shows it, the card in front with its title, its writing and its footer (Previous, "Card 2 of 6",
// Next and the clock with its time), the cards still to come peeking out below. Built on ./page-kit so it reads in
// light and in dark.

import {
  at,
  INK,
  INK_SOFT,
  Page,
  Panel,
  SKY,
} from '@liveworkspace/marketing-site/components/feature-art/page-kit';
import { Frame } from '@liveworkspace/marketing-site/components/feature-art/shared';

// The Conference Talk template's first four cards and their times; with Close and Questions (2 min) and What It Means
// for You (2 min) below the fold they add up to the header's 15 minutes.
const CARDS: [string, string][] = [
  ['Opening', '2 min'],
  ['The Problem', '3 min'],
  ['What We Tried', '3 min'],
  ['What Worked', '3 min'],
];

export function FlashcardStackArt() {
  // The card in front, 5:3.
  const x = 150;
  const y = 9;
  const w = 125;
  const h = 75;
  return (
    <Frame canvas>
      <svg viewBox="0 0 300 96" className="absolute inset-0 h-full w-full">
        {/* Contents: the whole talk in its header, each card's time on its row. */}
        <Panel x={14} y={9} w={116} h={78}>
          <text x="21" y="20" fontSize="5.4" fontWeight="700" className={INK} fill="#1e293b">
            Contents
          </text>
          <text x="123" y="20" textAnchor="end" fontSize="4.2" className={INK_SOFT} fill="#64748b">
            6 cards · about 15 min
          </text>
          {CARDS.map(([name, time], i) => {
            const ry = 26 + i * 14.5;
            const on = i === 1;
            return (
              <g key={name}>
                {on ? (
                  <rect
                    className="fa-e-in fill-sky-50 dark:fill-sky-950"
                    style={at(0.3)}
                    x="17"
                    y={ry}
                    width="110"
                    height="13"
                    rx="2.4"
                    fill="#f0f9ff"
                  />
                ) : null}
                {/* The card's live picture: a 5:3 thumbnail with its title and a line. */}
                <rect
                  className="fill-white stroke-slate-200 dark:fill-slate-800 dark:stroke-slate-600"
                  x="21"
                  y={ry + 2.5}
                  width="13"
                  height="8"
                  rx="0.8"
                  fill="#ffffff"
                  stroke="#e2e8f0"
                  strokeWidth="0.5"
                />
                <rect
                  className="fill-slate-400 dark:fill-slate-400"
                  x="22.6"
                  y={ry + 4.2}
                  width="6"
                  height="1"
                  fill="#94a3b8"
                />
                <rect
                  className="fill-slate-200 dark:fill-slate-600"
                  x="22.6"
                  y={ry + 6.6}
                  width="9"
                  height="0.8"
                  fill="#e2e8f0"
                />
                <text
                  x="39"
                  y={ry + 8.3}
                  fontSize="4.2"
                  fontWeight="600"
                  className={INK_SOFT}
                  fill="#64748b"
                >
                  {i + 1}
                </text>
                <text
                  x="45"
                  y={ry + 8.3}
                  fontSize="4.6"
                  fontWeight={on ? 700 : 500}
                  className={on ? 'fill-sky-700 dark:fill-sky-300' : INK}
                  fill={on ? '#0369a1' : '#1e293b'}
                >
                  {name}
                </text>
                <text
                  x="123"
                  y={ry + 8.3}
                  textAnchor="end"
                  fontSize="4"
                  className={INK_SOFT}
                  fill="#64748b"
                >
                  {time}
                </text>
              </g>
            );
          })}
        </Panel>

        {/* The cards still to come, each lower and narrower than the one before. */}
        {[3, 2, 1].map((d) => (
          <rect
            key={d}
            className="fill-slate-100 stroke-slate-200 dark:fill-slate-700 dark:stroke-slate-600"
            x={x + d * 4}
            y={y + d * 2.4}
            width={w - d * 8}
            height={h}
            rx="1.6"
            fill="#f1f5f9"
            stroke="#e2e8f0"
            strokeWidth="0.6"
            opacity={1 - d * 0.15}
          />
        ))}
        {/* The card in front: the one Contents has open. */}
        <g>
          <Page x={x} y={y} w={w} h={h}>
            <text x={x + 9} y={y + 14} fontSize="7" fontWeight="700" className={INK} fill="#1e293b">
              The Problem
            </text>
            <text x={x + 9} y={y + 24} fontSize="4.3" className={INK} fill="#334155">
              Every team builds its own sign-up form.
            </text>
            <text x={x + 9} y={y + 30} fontSize="4.3" className={INK} fill="#334155">
              Last year that was nine of them.
            </text>
            {['Two weeks lost a launch', 'Nine ways to reset a password'].map((t, i) => (
              <g key={t}>
                <circle cx={x + 11} cy={y + 39.6 + i * 7} r="1" fill={SKY} />
                <text x={x + 15} y={y + 41 + i * 7} fontSize="4.3" className={INK} fill="#334155">
                  {t}
                </text>
              </g>
            ))}
            {/* The footer in its bottom-right margin: Previous, the place, Next, then the card's speaking time. */}
            <g className={INK_SOFT} fill="#64748b" fontSize="3.9">
              <path
                d={`M${x + 58} ${y + h - 8.6}l-1.6 1.6 1.6 1.6`}
                fill="none"
                className="stroke-slate-400"
                stroke="#94a3b8"
                strokeWidth="0.7"
                strokeLinecap="round"
              />
              <text x={x + 61} y={y + h - 5.6}>
                Card 2 of 6
              </text>
              <path
                d={`M${x + 83} ${y + h - 8.6}l1.6 1.6-1.6 1.6`}
                fill="none"
                className="stroke-slate-400"
                stroke="#94a3b8"
                strokeWidth="0.7"
                strokeLinecap="round"
              />
              <circle
                cx={x + 92}
                cy={y + h - 7}
                r="1.9"
                fill="none"
                className="stroke-slate-400"
                stroke="#94a3b8"
                strokeWidth="0.6"
              />
              <path
                d={`M${x + 92} ${y + h - 8}v1h0.9`}
                fill="none"
                className="stroke-slate-400"
                stroke="#94a3b8"
                strokeWidth="0.5"
                strokeLinecap="round"
              />
              <text x={x + 95.5} y={y + h - 5.6}>
                3 min
              </text>
            </g>
          </Page>
        </g>
      </svg>
    </Frame>
  );
}
