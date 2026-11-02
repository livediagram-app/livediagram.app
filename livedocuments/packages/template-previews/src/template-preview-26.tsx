import type { ReactElement, ReactNode } from 'react';
import type { TemplateKind } from '@livedocuments/templates';
import { pv } from '@liveworkspace/template-previews/motion';
import { FILL_BOX } from '@liveworkspace/template-previews/story-parts';

// Group 26: the flashcard stacks (docs/specs/007-editor/flashcards.md "Making flashcards"): Conference Talk, Wedding
// Toast, Product Pitch and School Presentation. Each draws its stack as the editor shows it: the card in front (its title and lines, its
// "1 of n" footer) and the cards still to come peeking out below it, deeper for a longer stack, with a mark of its own.
// Each stack's mark sits on a tinted badge at rest, so the four read apart without a hover. Hover story: the front
// card's lines write themselves and its badge swells.
// Static SVG preview tiles, one branch per TemplateKind; TemplatePreview chains the groups with ??.

const INK = 'rgb(15 23 42)';
const MUTED = 'rgb(148 163 184)';
const LINE = 'rgb(203 213 225)';
const BEHIND = 'rgb(241 245 249)';

// The card in front, 5:3.
const FRONT = { x: 13, y: 4, width: 50, height: 30 };

// A stack of `count` cards: the ones behind, then the front card with its title, lines and footer, then the mark.
function Stack({
  count,
  title,
  lines,
  mark,
}: {
  count: number;
  title: number;
  lines: readonly number[];
  mark: ReactNode;
}) {
  const behind = Math.min(count - 1, 4);
  return (
    <svg width="80" height="50" viewBox="0 0 80 50" aria-hidden>
      {Array.from({ length: behind }, (_, i) => behind - i).map((d) => (
        <rect
          key={d}
          x={FRONT.x + d * 1.6}
          y={FRONT.y + d * 2.2}
          width={FRONT.width - d * 3.2}
          height={FRONT.height}
          rx="1.6"
          fill={BEHIND}
          stroke={MUTED}
          strokeWidth="0.3"
          opacity={1 - d * 0.12}
        />
      ))}
      <rect {...FRONT} rx="1.6" fill="white" stroke={MUTED} strokeWidth="0.35" />
      <rect x="17" y="8" width={title} height="2.6" rx="0.8" fill={INK} />
      {lines.map((w, i) => (
        <rect
          key={i}
          className="pv-grow-x"
          x="17"
          y={13.2 + i * 2.8}
          width={w}
          height="1.2"
          rx="0.6"
          fill={LINE}
          style={pv({ '--pv-at': `${300 + i * 180}ms` })}
        />
      ))}
      <rect x="49" y="30.4" width="10" height="1" rx="0.5" fill={MUTED} />
      {mark}
    </svg>
  );
}

// The mark's badge: a tinted disc in the front card's top right with the mark's glyph on it, centred on (57, 9).
// Drawn at rest, so the four stacks tell apart without a hover; on hover it swells once the lines are written.
const BADGE_EDGE = 'rgb(226 232 240)';

function Badge({ tint, children }: { tint: string; children: ReactNode }) {
  return (
    <g className="pv-pulse" style={{ ...FILL_BOX, ...pv({ '--pv-at': '1100ms' }) }}>
      <circle cx="57" cy="9.2" r="5" fill={tint} stroke={BADGE_EDGE} strokeWidth="0.3" />
      {children}
    </g>
  );
}

export function templatePreviewGroup26(kind: TemplateKind): ReactElement | null {
  switch (kind) {
    case 'talk-flashcards':
      // Six cards; a small clock, the talk's time.
      return Stack({
        count: 6,
        title: 20,
        lines: [38, 34, 38, 22],
        mark: (
          <Badge tint="rgb(224 231 255)">
            <circle
              cx="57"
              cy="9"
              r="2.8"
              fill="white"
              stroke="var(--color-brand-500)"
              strokeWidth="0.8"
            />
            <path
              d="M57 7.4 V9 L58.3 9.9"
              fill="none"
              stroke="var(--color-brand-500)"
              strokeWidth="0.7"
              strokeLinecap="round"
            />
          </Badge>
        ),
      });
    case 'wedding-toast':
      // Five cards; a heart, the toast.
      return Stack({
        count: 5,
        title: 14,
        lines: [36, 38, 26],
        mark: (
          <Badge tint="rgb(255 228 230)">
            <path
              d="M57 11.8 C54 9.6 54 7 55.6 6.8 C56.4 6.7 57 7.4 57 8 C57 7.4 57.6 6.7 58.4 6.8 C60 7 60 9.6 57 11.8 Z"
              fill="rgb(244 63 94)"
            />
          </Badge>
        ),
      });
    case 'pitch-flashcards':
      // Five cards; an arrow going up, the traction.
      return Stack({
        count: 5,
        title: 17,
        lines: [30, 38, 34],
        mark: (
          <Badge tint="rgb(209 250 229)">
            <path
              d="M53.8 11 L56.4 8 L58.2 9.6 L60.2 7 M58.4 7 H60.2 V8.8"
              fill="none"
              stroke="rgb(5 150 105)"
              strokeWidth="0.9"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Badge>
        ),
      });
    case 'class-presentation':
      // Five cards; a raindrop, the water cycle the talk is about.
      return Stack({
        count: 5,
        title: 22,
        lines: [36, 30, 38],
        mark: (
          <Badge tint="rgb(224 242 254)">
            <path
              d="M57 6 C58.5 8 59.5 9.2 59.5 10.4 C59.5 11.7 58.4 12.6 57 12.6 C55.6 12.6 54.5 11.7 54.5 10.4 C54.5 9.2 55.5 8 57 6 Z"
              fill="rgb(14 165 233)"
            />
          </Badge>
        ),
      });
    default:
      return null;
  }
}
