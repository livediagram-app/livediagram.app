// Feature art for flashcards (docs/specs/019-marketing/marketing-site.md,
// docs/specs/007-editor/flashcards.md): the stack as the editor shows it, the card in front with its
// title, lines and "Card 2 of 6" footer, the cards still to come peeking out below it, and the card
// before it turning away over the top. Built on ./page-kit so it reads in light and in dark.

import {
  INK,
  INK_SOFT,
  Lines,
  Page,
  SKY,
} from '@liveworkspace/marketing-site/components/feature-art/page-kit';
import { Frame } from '@liveworkspace/marketing-site/components/feature-art/shared';

export function FlashcardStackArt() {
  // The card in front, 5:3.
  const x = 98;
  const y = 18;
  const w = 104;
  const h = 62;
  return (
    <Frame canvas>
      <svg viewBox="0 0 300 96" className="absolute inset-0 h-full w-full">
        {/* The cards still to come, each lower and narrower than the one before. */}
        {[4, 3, 2, 1].map((d) => (
          <rect
            key={d}
            className="fill-slate-100 stroke-slate-200 dark:fill-slate-700 dark:stroke-slate-600"
            x={x + d * 3.5}
            y={y + d * 2.6}
            width={w - d * 7}
            height={h}
            rx="1.6"
            fill="#f1f5f9"
            stroke="#e2e8f0"
            strokeWidth="0.6"
            opacity={1 - d * 0.12}
          />
        ))}
        <Page x={x} y={y} w={w} h={h}>
          <text x={x + 8} y={y + 13} fontSize="6.4" fontWeight="700" className={INK} fill="#1e293b">
            The Problem
          </text>
          <Lines x={x + 8} y={y + 20} w={w - 16} count={3} />
          <g fill={SKY}>
            <circle cx={x + 9.5} cy={y + 37.6} r="1" />
            <circle cx={x + 9.5} cy={y + 42.6} r="1" />
          </g>
          <Lines x={x + 13} y={y + 36.8} w={w - 34} count={2} gap={5} />
          <text
            x={x + w - 8}
            y={y + h - 5}
            textAnchor="end"
            fontSize="3.6"
            className={INK_SOFT}
            fill="#64748b"
          >
            Card 2 of 6 · 45 sec
          </text>
        </Page>
        {/* The card before it, turning away over the top. */}
        <path
          className="fill-white stroke-slate-200 dark:fill-slate-800 dark:stroke-slate-600"
          d={`M${x} ${y} L${x + w} ${y} L${x + w - 8} ${y - 12} L${x + 8} ${y - 12} Z`}
          fill="#ffffff"
          stroke="#e2e8f0"
          strokeWidth="0.6"
          opacity="0.7"
        />
      </svg>
    </Frame>
  );
}
