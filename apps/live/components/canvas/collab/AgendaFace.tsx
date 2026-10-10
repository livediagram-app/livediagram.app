// The face of an Agenda (docs/specs/012-collaboration/agenda.md): the run of the session as a live stepper,
// each segment pressable. Pressing one starts the tab timer for that long,
// through the same entry point the Current Tab menu and the session button
// already use. Built in the behaviour elements' current look ("The face").

import {
  agendaTotalMinutes,
  clampAgendaMinutes,
  timerDisplayMs,
  type ShapeElement,
  type TabTimer,
} from '@livediagram/document';
import { useNow } from '@/hooks/ui/useNow';
import { CollabPanel, tint } from './collab-chrome';
import { CollabAccentScope } from './collab-accent';
import { AgendaStep, type StepState } from './agenda/AgendaStep';
import { EmptyRows, QA_ACCENT } from './qa/qa-parts';

// "1h 5m" / "45m". The number in the header is what tells you the plan doesn't
// fit before you start.
export function formatMinutes(total: number): string {
  if (total < 60) return `${total}m`;
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}

export function AgendaFace({
  element,
  label,
  textColor,
  surface,
  timer,
  canArrange = true,
  onPressItem,
}: {
  element: ShapeElement;
  label: string;
  textColor: string;
  // The card's own fill, for the accent scope.
  surface: string;
  // The tab's timer, or undefined when none is running. The agenda reads the
  // tab's clock rather than keeping one of its own, and ticks here rather than
  // in the canvas host, so only a canvas with a running agenda pays for it.
  timer: TabTimer | undefined;
  onPressItem?: (index: number) => void;
  // An Editor is told where segments are added; anyone else that the facilitator adds them.
  canArrange?: boolean;
}) {
  const items = element.agendaItems ?? [];
  const current = element.agendaCurrent;
  // 4x a second while a countdown runs, as the TimerWidget does; a paused or
  // absent timer is static, so nothing spins then.
  const running = timer?.running === true && current !== undefined;
  const now = useNow(running);
  const remainingMs = timer && current !== undefined ? timerDisplayMs(timer, now) : null;
  const total = agendaTotalMinutes(items);

  // How far through the session: the finished segments' minutes plus the
  // current one's elapsed time, over the total.
  let elapsed = 0;
  if (current !== undefined) {
    items.forEach((item, i) => {
      const m = clampAgendaMinutes(item.minutes);
      if (i < current) elapsed += m;
      else if (i === current && remainingMs !== null)
        elapsed += Math.max(0, m - remainingMs / 60_000);
    });
  }
  const progress = total > 0 ? Math.min(1, elapsed / total) : 0;
  const stateOf = (i: number): StepState =>
    current === undefined ? 'ahead' : i === current ? 'current' : i < current ? 'done' : 'ahead';

  return (
    <CollabAccentScope element={element} textColor={textColor} surface={surface}>
      <CollabPanel
        element={element}
        title={label.trim() || 'Agenda'}
        textColor={textColor}
        aside={items.length ? formatMinutes(total) : undefined}
      >
        {items.length === 0 ? (
          <EmptyRows textColor={textColor} title="No segments yet">
            {canArrange
              ? 'Add them from the element’s menu, under Segments.'
              : 'The facilitator adds the segments.'}
          </EmptyRows>
        ) : (
          <>
            <span
              className="-mt-1 h-1 shrink-0 overflow-hidden rounded-full"
              style={{ backgroundColor: tint(textColor, 0.08) }}
              aria-hidden
            >
              <span
                className="agenda-progress block h-full rounded-full"
                style={{ width: `${progress * 100}%`, backgroundColor: QA_ACCENT }}
              />
            </span>
            <ol className="flex flex-col">
              {items.map((item, i) => (
                <AgendaStep
                  key={`${i}-${item.label}`}
                  index={i}
                  label={item.label}
                  minutes={clampAgendaMinutes(item.minutes)}
                  state={stateOf(i)}
                  remainingMs={i === current ? remainingMs : null}
                  last={i === items.length - 1}
                  textColor={textColor}
                  onPress={onPressItem ? () => onPressItem(i) : undefined}
                />
              ))}
            </ol>
          </>
        )}
      </CollabPanel>
    </CollabAccentScope>
  );
}
