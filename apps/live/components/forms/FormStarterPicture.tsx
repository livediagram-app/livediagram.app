// A starter's picture on Start Planning (docs/specs/030-forms/forms.md "Starting a form"): the form drawn small from
// its own questions, its cover in the starter's colour, each question its prompt line and a hint of its control
// (a box, a paragraph, radio dots, checkboxes, stars), in the tab's own light or dark look.
import { formStarter, type QuestionType, type StarterId } from '@livediagram/forms';
import type { PlanPalette } from '@/components/plan/plan-palette';

const W = 160;
const H = 100;

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
          <path
            key={i}
            transform={`translate(${x + i * 9} ${y - 1}) scale(0.32)`}
            d="M12 2.5l2.94 5.96 6.58.96-4.76 4.64 1.12 6.55L12 17.52 6.12 20.61l1.12-6.55L2.48 9.42l6.58-.96z"
            fill={i < 4 ? accent : 'none'}
            stroke={i < 4 ? accent : line}
            strokeWidth={2.5}
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

export function FormStarterPicture({
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
    <svg viewBox={`0 0 ${W} ${H}`} className="h-full w-full" aria-hidden>
      <rect
        x={12}
        y={6}
        width={W - 24}
        height={H}
        rx={5}
        fill={palette.card}
        stroke={palette.border}
      />
      <path d={`M12 11a5 5 0 0 1 5-5h${W - 34}a5 5 0 0 1 5 5v5H12z`} fill={accent} />
      <rect x={20} y={21} width={52} height={3.5} rx={1.5} fill={palette.text} opacity={0.85} />
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
    </svg>
  );
}
