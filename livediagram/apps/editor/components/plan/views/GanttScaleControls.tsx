'use client';

// The Gantt chart's header controls (docs/specs/026-plan/plan-views.md "Scale", "Scrolling the timeline"):
// Today, the window's steps, and the scale as a pressed one of Month, Quarter and Year.
import { GANTT_SCALES, GANTT_SCALE_LABELS } from '@livediagram/items';
import { ChevronLeftIcon, ChevronRightIcon } from '@livediagram/ui';
import { track } from '@/lib/telemetry';
import type { PlanPalette } from '../plan-palette';
import { ViewStepButton } from './view-frame';
import type { useGanttWindow } from './useGanttWindow';

export function GanttScaleControls({
  timeline,
  palette,
}: {
  timeline: ReturnType<typeof useGanttWindow>;
  palette: PlanPalette;
}) {
  return (
    <>
      <ViewStepButton label="Today" onPress={timeline.today} palette={palette}>
        Today
      </ViewStepButton>
      <ViewStepButton label="Earlier" onPress={() => timeline.step(-1)} palette={palette}>
        <ChevronLeftIcon size={14} />
      </ViewStepButton>
      <ViewStepButton label="Later" onPress={() => timeline.step(1)} palette={palette}>
        <ChevronRightIcon size={14} />
      </ViewStepButton>
      <span
        role="group"
        aria-label="Scale"
        className="ml-1 flex items-center gap-0.5 rounded-lg p-0.5"
        style={{ boxShadow: `inset 0 0 0 1px ${palette.border}` }}
      >
        {GANTT_SCALES.map((s) => (
          <ViewStepButton
            key={s}
            label={GANTT_SCALE_LABELS[s]}
            active={timeline.scale === s}
            palette={palette}
            onPress={() => {
              if (timeline.scale === s) return;
              timeline.setScale(s);
              track('Plan', 'Changed', 'GanttScale');
            }}
          >
            {GANTT_SCALE_LABELS[s]}
          </ViewStepButton>
        ))}
      </span>
    </>
  );
}
