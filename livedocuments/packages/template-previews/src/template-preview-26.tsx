import type { ReactElement, ReactNode } from 'react';
import type { TemplateKind } from '@livedocuments/templates';
import { pv } from '@liveworkspace/template-previews/motion';
import { FILL_BOX } from '@liveworkspace/template-previews/story-parts';

// Group 26: the flashcard stacks (docs/specs/007-editor/flashcards.md "Making flashcards"): Conference Talk, Wedding
// Toast, Product Pitch and School Presentation. Each draws its stack as the editor shows it: the card in front (its title and lines, its
// "1 of n" footer) and the cards still to come peeking out below it, deeper for a longer stack, with a mark of its own.
// Hover story: the front card's lines write themselves and its mark arrives.
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

// The mark's arrival: a little rise, once the lines are written.
const ARRIVE = { ...FILL_BOX, ...pv({ '--pv-from-y': '2px', '--pv-at': '1100ms' }) };

export function templatePreviewGroup26(kind: TemplateKind): ReactElement | null {
  switch (kind) {
    case 'talk-flashcards':
      // Six cards; a small clock, the talk's time.
      return Stack({
        count: 6,
        title: 20,
        lines: [38, 34, 38, 22],
        mark: (
          <g className="pv-arrive" opacity="0" style={ARRIVE}>
            <circle
              cx="56"
              cy="10"
              r="3.2"
              fill="white"
              stroke="var(--color-brand-500)"
              strokeWidth="0.8"
            />
            <path
              d="M56 8.2 V10 L57.4 11"
              fill="none"
              stroke="var(--color-brand-500)"
              strokeWidth="0.7"
            />
          </g>
        ),
      });
    case 'wedding-toast':
      // Five cards; a heart, the toast.
      return Stack({
        count: 5,
        title: 14,
        lines: [36, 38, 26],
        mark: (
          <path
            className="pv-arrive"
            opacity="0"
            style={ARRIVE}
            d="M56 12.6 C53 10.4 53 7.8 54.6 7.6 C55.4 7.5 56 8.2 56 8.8 C56 8.2 56.6 7.5 57.4 7.6 C59 7.8 59 10.4 56 12.6 Z"
            fill="rgb(244 63 94)"
          />
        ),
      });
    case 'pitch-flashcards':
      // Five cards; an arrow going up, the traction.
      return Stack({
        count: 5,
        title: 17,
        lines: [30, 38, 34],
        mark: (
          <path
            className="pv-arrive"
            opacity="0"
            style={ARRIVE}
            d="M53 12 L56 8.6 L58.2 10.6 L60 8 M57.8 8 H60 V10.2"
            fill="none"
            stroke="rgb(16 185 129)"
            strokeWidth="0.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ),
      });
    case 'class-presentation':
      // Five cards; a raindrop, the water cycle the talk is about.
      return Stack({
        count: 5,
        title: 22,
        lines: [36, 30, 38],
        mark: (
          <path
            className="pv-arrive"
            opacity="0"
            style={ARRIVE}
            d="M56 7 C57.6 9.2 58.6 10.6 58.6 11.8 C58.6 13.2 57.4 14.2 56 14.2 C54.6 14.2 53.4 13.2 53.4 11.8 C53.4 10.6 54.4 9.2 56 7 Z"
            fill="rgb(56 189 248)"
          />
        ),
      });
    default:
      return null;
  }
}
