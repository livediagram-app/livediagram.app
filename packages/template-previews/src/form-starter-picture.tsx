// A starter's picture on Start Planning (docs/specs/030-forms/forms.md "Starting a form"): the form drawn small from
// its own questions, its cover in the starter's colour, each question its prompt line and a hint of its control
// (a box, a paragraph, radio dots, checkboxes, stars), in the tab's own light or dark look; a badge in its top right
// corner says where its responses go, a board or a sheet (none for Blank, which goes nowhere yet).
import { formStarter, type QuestionType, type StarterId } from '@livediagram/forms';
import { lucideSquareKanban, lucideTable } from '@livediagram/icons/lucide';
import { Prims } from '@livediagram/ui';
import { FILL_BOX } from './story-parts';
import type { PlanPalette } from '@livediagram/document';

const W = 160;
const H = 100;

// A five-pointed star round (cx, cy), its points absolute (the tiles' bounds check reads them as drawn).
function starPoints(cx: number, cy: number, r: number): string {
  return Array.from({ length: 10 }, (_, k) => {
    const a = -Math.PI / 2 + (k * Math.PI) / 5;
    const d = k % 2 === 0 ? r : r * 0.45;
    return `${(cx + d * Math.cos(a)).toFixed(2)},${(cy + d * Math.sin(a)).toFixed(2)}`;
  }).join(' ');
}

function Control({
  type,
  x,
  y,
  palette,
  accent,
}: {
  type: QuestionType;
  x: number;
  y: number;
  palette: PlanPalette;
  accent: string;
}) {
  const line = palette.border;
  if (type === 'rating')
    return (
      <g>
        {[0, 1, 2, 3, 4].map((i) => (
          <polygon
            key={i}
            points={starPoints(x + 3.5 + i * 9, y + 2.6, 3.6)}
            fill={i < 4 ? accent : 'none'}
            stroke={i < 4 ? accent : line}
            strokeWidth={0.8}
            strokeLinejoin="round"
          />
        ))}
      </g>
    );
  if (type === 'single' || type === 'multi')
    return (
      <g>
        {[0, 1].map((i) =>
          type === 'single' ? (
            <circle
              key={i}
              cx={x + 3 + i * 30}
              cy={y + 3}
              r={2.6}
              fill="none"
              stroke={i === 0 ? accent : line}
              strokeWidth={1.2}
            />
          ) : (
            <rect
              key={i}
              x={x + i * 30}
              y={y}
              width={5.5}
              height={5.5}
              rx={1}
              fill={i === 0 ? accent : 'none'}
              stroke={i === 0 ? accent : line}
              strokeWidth={1.2}
            />
          ),
        )}
        {[0, 1].map((i) => (
          <rect
            key={`l${i}`}
            x={x + 8 + i * 30}
            y={y + 2}
            width={16}
            height={2}
            rx={1}
            fill={line}
          />
        ))}
      </g>
    );
  if (type === 'checkbox')
    return (
      <rect x={x} y={y} width={6} height={6} rx={1} fill="none" stroke={accent} strokeWidth={1.2} />
    );
  const tall = type === 'paragraph';
  return (
    <rect
      x={x}
      y={y}
      width={W - 40}
      height={tall ? 10 : 6}
      rx={1.5}
      fill="none"
      stroke={line}
      strokeWidth={1}
    />
  );
}

// Where the starter's responses go: a board's or a sheet's icon on a disc in the picture's top right corner.
function DestinationBadge({ to, palette }: { to: 'board' | 'sheet'; palette: PlanPalette }) {
  const r = 12;
  const cx = W - 13;
  const cy = 16;
  return (
    <g data-starter-goes-to={to} className="pv-pulse" style={FILL_BOX}>
      <circle cx={cx} cy={cy} r={r} fill={palette.surface} stroke={palette.border} />
      <g
        transform={`translate(${cx - 7.2} ${cy - 7.2}) scale(0.6)`}
        fill="none"
        stroke={palette.text}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <Prims prims={to === 'board' ? lucideSquareKanban : lucideTable} />
      </g>
    </g>
  );
}

// The picture's drawing, in its own 160 by 100 units, for a caller's svg to hold (a template tile's 80 by 50 one).
export const FORM_STARTER_VIEWBOX = `0 0 ${160} ${100}`;

export function FormStarterPicture({
  starter,
  palette,
}: {
  starter: StarterId;
  palette: PlanPalette;
}) {
  return (
    <svg viewBox={FORM_STARTER_VIEWBOX} className="h-full w-full" aria-hidden>
      <FormStarterArt starter={starter} palette={palette} />
    </svg>
  );
}

export function FormStarterArt({
  starter: id,
  palette,
}: {
  starter: StarterId;
  palette: PlanPalette;
}) {
  const starter = formStarter(id);
  const accent = starter.accent;
  const questions = starter.sections.flatMap((s) => s.questions).slice(0, 3);
  // Each question's top, a paragraph taking more room.
  const tops = questions.reduce<number[]>(
    (acc, _q, i) => [
      ...acc,
      i === 0 ? 30 : acc[i - 1]! + (questions[i - 1]!.type === 'paragraph' ? 24 : 21),
    ],
    [],
  );
  return (
    <g>
      <rect
        x={12}
        y={6}
        width={W - 24}
        height={H - 8}
        rx={5}
        fill={palette.card}
        stroke={palette.border}
      />
      <path d={`M12 11A5 5 0 0 1 17 6H${W - 17}A5 5 0 0 1 ${W - 12} 11V16H12Z`} fill={accent} />
      {/* The heading; a template tile's hover story grows it in (preview-motion.css). */}
      <rect
        x={20}
        y={21}
        width={52}
        height={3.5}
        rx={1.5}
        fill={palette.text}
        opacity={0.85}
        className="pv-grow-x"
        style={{ ...FILL_BOX, transformOrigin: 'left center' }}
      />
      {questions.map((q, i) => {
        const top = tops[i]!;
        return (
          <g key={i}>
            <rect
              x={20}
              y={top}
              width={28 + ((i * 13) % 22)}
              height={2.5}
              rx={1.2}
              fill={palette.muted}
            />
            <Control type={q.type} x={20} y={top + 6} palette={palette} accent={accent} />
          </g>
        );
      })}
      {starter.respondsTo ? <DestinationBadge to={starter.respondsTo} palette={palette} /> : null}
    </g>
  );
}
