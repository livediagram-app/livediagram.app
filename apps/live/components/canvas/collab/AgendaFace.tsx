// The face of an Agenda (spec/127): the run of the session, with each segment
// pressable. Pressing one starts the tab timer for that long, through the same
// entry point the Current Tab menu and the session button already use.

import { useEffect, useState } from 'react';
import {
  agendaTotalMinutes,
  clampAgendaMinutes,
  timerDisplayMs,
  type ShapeElement,
  type TabTimer,
} from '@livediagram/diagram';
import { usePressWithoutDrag } from '@/hooks/ui/usePressWithoutDrag';
import { CollabEmpty, CollabPanel, tint } from './collab-chrome';

// "1h 5m" / "45m". The number in the header is what tells you the plan doesn't
// fit before you start.
export function formatMinutes(total: number): string {
  if (total < 60) return `${total}m`;
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}

// The live remaining time on the current segment, from the tab timer rather
// than a second clock of the agenda's own.
function formatRemaining(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

function AgendaRow({
  index,
  label,
  minutes,
  state,
  remainingMs,
  textColor,
  onPress,
}: {
  index: number;
  label: string;
  minutes: number;
  state: 'done' | 'current' | 'ahead';
  remainingMs: number | null;
  textColor: string;
  onPress?: () => void;
}) {
  const press = usePressWithoutDrag(() => onPress?.());
  return (
    <li>
      <button
        type="button"
        {...press}
        disabled={!onPress}
        aria-label={`Start ${label || `segment ${index + 1}`} — ${minutes} minutes`}
        aria-current={state === 'current' ? 'step' : undefined}
        className="pointer-events-auto flex w-full cursor-pointer items-baseline justify-between gap-2 rounded-md px-2 py-1.5 text-left transition hover:brightness-95 disabled:cursor-default"
        style={{
          backgroundColor: state === 'current' ? tint(textColor, 0.14) : 'transparent',
        }}
      >
        <span
          className={`min-w-0 truncate text-[11px] leading-snug ${
            state === 'done' ? 'line-through opacity-45' : ''
          } ${state === 'current' ? 'font-semibold' : ''}`}
          style={{ color: textColor }}
        >
          {label || `Segment ${index + 1}`}
        </span>
        <span
          className={`shrink-0 text-[10px] tabular-nums ${
            state === 'current' ? 'font-semibold opacity-90' : 'opacity-55'
          } ${state === 'done' ? 'opacity-40' : ''}`}
          style={{ color: textColor }}
        >
          {state === 'current' && remainingMs !== null
            ? formatRemaining(remainingMs)
            : `${minutes}m`}
        </span>
      </button>
    </li>
  );
}

export function AgendaFace({
  element,
  label,
  textColor,
  timer,
  onPressItem,
}: {
  element: ShapeElement;
  label: string;
  textColor: string;
  // The tab's timer, or undefined when none is running. The agenda reads the
  // tab's clock rather than keeping one of its own — and ticks here rather
  // than in the canvas host, so only a board with a running agenda pays for
  // the re-render.
  timer: TabTimer | undefined;
  onPressItem?: (index: number) => void;
}) {
  const items = element.agendaItems ?? [];
  const current = element.agendaCurrent;
  // Re-render 4x/sec while a countdown runs, exactly as the TimerWidget does.
  // A paused or absent timer is static, so nothing spins then.
  const [, setTick] = useState(0);
  const running = timer?.running === true && current !== undefined;
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setTick((n) => n + 1), 250);
    return () => clearInterval(id);
  }, [running]);
  const remainingMs = timer && current !== undefined ? timerDisplayMs(timer, Date.now()) : null;

  return (
    <CollabPanel
      title={label.trim() || 'Agenda'}
      textColor={textColor}
      aside={items.length ? formatMinutes(agendaTotalMinutes(items)) : undefined}
    >
      {items.length === 0 ? (
        <CollabEmpty textColor={textColor}>
          No segments yet. Add them from the element’s menu, under Segments.
        </CollabEmpty>
      ) : (
        <ul className="flex flex-col gap-1">
          {items.map((item, i) => (
            <AgendaRow
              key={`${i}-${item.label}`}
              index={i}
              label={item.label}
              minutes={clampAgendaMinutes(item.minutes)}
              state={
                current === undefined
                  ? 'ahead'
                  : i === current
                    ? 'current'
                    : i < current
                      ? 'done'
                      : 'ahead'
              }
              remainingMs={remainingMs}
              textColor={textColor}
              onPress={onPressItem ? () => onPressItem(i) : undefined}
            />
          ))}
        </ul>
      )}
    </CollabPanel>
  );
}
