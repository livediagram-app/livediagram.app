// One segment on the Agenda's stepper (docs/specs/012-collaboration/agenda.md "The face"). Done: a check and
// the name struck through, drawn back. Ahead: a hollow ring and its minutes,
// which turn into "Start" under the pointer, because pressing starts it.
// Current: a pulsing accent dot and an expanded, accent-lit row with the time
// left large and a bar draining as it runs.

import { Glyph } from '@livediagram/ui';
import { usePressWithoutDrag } from '@/hooks/ui/usePressWithoutDrag';
import { tint } from '../collab-chrome';
import { CheckGlyph, QA_ACCENT, QA_ACCENT_INK, QA_ON_ACCENT, stopPointer } from '../qa/qa-parts';

export type StepState = 'done' | 'current' | 'ahead';

function PlayGlyph() {
  return (
    <Glyph size={10} units={16}>
      <path d="M5 3.5v9l7-4.5z" fill="currentColor" />
    </Glyph>
  );
}

// "4:12": the time left on the current segment.
export function formatRemaining(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

export function AgendaStep({
  index,
  label,
  minutes,
  state,
  remainingMs,
  last,
  textColor,
  onPress,
}: {
  index: number;
  label: string;
  minutes: number;
  state: StepState;
  remainingMs: number | null;
  // No rail below the last step.
  last: boolean;
  textColor: string;
  onPress?: () => void;
}) {
  const press = usePressWithoutDrag(() => onPress?.());
  const name = label || `Segment ${index + 1}`;
  const current = state === 'current';
  const share =
    current && remainingMs !== null && minutes > 0
      ? Math.min(1, Math.max(0, remainingMs / (minutes * 60_000)))
      : 1;
  return (
    <li className="relative flex gap-2.5">
      {/* The rail and its marker. */}
      <span className="relative flex w-4 shrink-0 justify-center" aria-hidden>
        {last ? null : (
          <span
            className="absolute bottom-[-6px] top-5 w-[2px] rounded-full"
            style={{
              backgroundColor: state === 'done' ? tint(QA_ACCENT, 0.45) : tint(textColor, 0.1),
            }}
          />
        )}
        <span
          className={`relative mt-2 flex h-4 w-4 items-center justify-center rounded-full ${current ? 'qa-live' : ''}`}
          style={
            state === 'done'
              ? { backgroundColor: tint(QA_ACCENT, 0.2), color: QA_ACCENT_INK }
              : current
                ? { backgroundColor: QA_ACCENT, color: QA_ON_ACCENT }
                : { boxShadow: `inset 0 0 0 2px ${tint(textColor, 0.22)}` }
          }
        >
          {state === 'done' ? <CheckGlyph size={9} /> : null}
          {current ? <span className="h-1.5 w-1.5 rounded-full bg-current" /> : null}
        </span>
      </span>
      <button
        type="button"
        {...press}
        {...stopPointer}
        disabled={!onPress}
        aria-label={`Start ${name}, ${minutes} minutes`}
        aria-current={current ? 'step' : undefined}
        className="agenda-step group pointer-events-auto mb-1 flex min-w-0 flex-1 cursor-pointer flex-col rounded-xl px-2.5 py-1.5 text-left disabled:cursor-default"
        style={
          current
            ? {
                backgroundColor: tint(QA_ACCENT, 0.12),
                boxShadow: `inset 0 0 0 1px ${tint(QA_ACCENT, 0.35)}`,
              }
            : undefined
        }
      >
        <span className="flex items-baseline justify-between gap-2">
          <span
            className={`min-w-0 truncate text-[12px] leading-snug ${current ? 'font-semibold' : 'font-medium'} ${state === 'done' ? 'line-through opacity-45' : ''}`}
            style={{ color: textColor }}
          >
            {name}
          </span>
          {current ? (
            <span
              className="shrink-0 text-[15px] font-bold tabular-nums leading-none"
              style={{ color: QA_ACCENT_INK }}
            >
              {remainingMs !== null ? formatRemaining(remainingMs) : `${minutes}m`}
            </span>
          ) : (
            <span className="relative shrink-0 text-[10.5px] tabular-nums">
              <span
                className={`agenda-mins ${state === 'done' ? 'opacity-35' : 'opacity-55'}`}
                style={{ color: textColor }}
              >
                {minutes}m
              </span>
              {state === 'ahead' && onPress ? (
                <span
                  className="agenda-start absolute right-0 top-1/2 flex -translate-y-1/2 items-center gap-1 whitespace-nowrap font-semibold"
                  style={{ color: QA_ACCENT_INK }}
                >
                  <PlayGlyph /> Start
                </span>
              ) : null}
            </span>
          )}
        </span>
        {current ? (
          <span
            className="mt-1.5 h-1 overflow-hidden rounded-full"
            style={{ backgroundColor: tint(QA_ACCENT, 0.18) }}
          >
            <span
              className="agenda-drain block h-full rounded-full"
              style={{ width: `${share * 100}%`, backgroundColor: QA_ACCENT }}
            />
          </span>
        ) : null}
      </button>
    </li>
  );
}
