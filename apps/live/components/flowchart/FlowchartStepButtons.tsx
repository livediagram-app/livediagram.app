'use client';

// A flowchart step's toolbar group (docs/specs/009-elements/flowchart.md): Add Step and Add Branch,
// the one-click homes for Tab and Enter, then an Editor's Step Type and (on a laned chart) Lane menus.
import {
  FLOWCHART_STEP_LABEL,
  FLOWCHART_STEP_TYPES,
  type FlowchartStepType,
} from '@livediagram/document';
import {
  FLOWCHART_NEXT_OPTION,
  FLOWCHART_PARALLEL_OPTION,
} from '@/components/canvas/quick-connect-options';
import { Divider, PopoverButton } from '@/components/canvas/SelectionPopoverButton';
import { noFocusSteal, ToolbarDropdown } from '@/components/rich-text/ToolbarDropdown';
import { STEP_TYPE_GLYPH } from '@/components/flowchart/step-type-glyphs';

export type FlowchartStepToolbar = {
  onAddStep: () => void;
  onAddBranch: () => void;
  // An Editor's: changing a step's type reshapes the chart.
  stepType?: FlowchartStepType;
  onSetStepType?: (type: FlowchartStepType) => void;
  // An Editor's, on a chart with lanes: the chart's lanes by title, and the step's.
  lanes?: readonly { id: string; title: string }[];
  laneId?: string;
  onMoveToLane?: (laneId: string) => void;
};

const OPTION_ROW = 'flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-xs transition';
const OPTION_ON = 'bg-brand-50 text-brand-700 dark:bg-brand-500/20 dark:text-brand-100';
const OPTION_OFF = 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800';

export function FlowchartStepButtons({
  onAddStep,
  onAddBranch,
  stepType,
  onSetStepType,
  lanes,
  laneId,
  onMoveToLane,
}: FlowchartStepToolbar) {
  return (
    <>
      <PopoverButton
        label={FLOWCHART_NEXT_OPTION.label}
        description={FLOWCHART_NEXT_OPTION.description}
        onClick={onAddStep}
      >
        {FLOWCHART_NEXT_OPTION.icon}
      </PopoverButton>
      <PopoverButton
        label={FLOWCHART_PARALLEL_OPTION.label}
        description={FLOWCHART_PARALLEL_OPTION.description}
        onClick={onAddBranch}
      >
        {FLOWCHART_PARALLEL_OPTION.icon}
      </PopoverButton>
      {stepType && onSetStepType ? (
        <ToolbarDropdown
          label="Step Type"
          description="What this step is: a Process, a Decision, an Input / Output and more."
          menuClassName="min-w-[11rem]"
          trigger={STEP_TYPE_GLYPH[stepType]}
        >
          {FLOWCHART_STEP_TYPES.map((t) => (
            <button
              key={t}
              type="button"
              role="option"
              aria-selected={stepType === t}
              onMouseDown={noFocusSteal}
              onClick={() => onSetStepType(t)}
              className={`${OPTION_ROW} ${stepType === t ? OPTION_ON : OPTION_OFF}`}
            >
              {STEP_TYPE_GLYPH[t]}
              {FLOWCHART_STEP_LABEL[t]}
            </button>
          ))}
        </ToolbarDropdown>
      ) : null}
      {lanes && lanes.length > 0 && onMoveToLane ? (
        <ToolbarDropdown
          label="Lane"
          description="Move this step into another lane."
          menuClassName="min-w-[9rem]"
          trigger={
            <span className="max-w-[7rem] truncate px-1 text-xs font-medium">
              {lanes.find((l) => l.id === laneId)?.title ?? lanes[0]!.title}
            </span>
          }
        >
          {lanes.map((lane, i) => {
            const on = (laneId ?? lanes[0]!.id) === lane.id;
            return (
              <button
                key={lane.id}
                type="button"
                role="option"
                aria-selected={on}
                onMouseDown={noFocusSteal}
                onClick={() => onMoveToLane(lane.id)}
                className={`${OPTION_ROW} ${on ? OPTION_ON : OPTION_OFF}`}
              >
                {lane.title || `Lane ${i + 1}`}
              </button>
            );
          })}
        </ToolbarDropdown>
      ) : null}
      <Divider />
    </>
  );
}
