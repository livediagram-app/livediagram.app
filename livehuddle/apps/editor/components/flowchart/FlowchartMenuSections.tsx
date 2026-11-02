'use client';

// The Flowchart menu category (docs/specs/009-elements/flowchart.md "The Flowchart menu"): a flyout row
// holding Chart (Add Lane, Tidy Flowchart), Step Type (on a step) and Direction, each a closed accordion
// around an option list (a bordered box, one full-width row per choice), the way the Mind Map row is built. Everything but Step Type acts
// on the selected step's or lane's whole chart.
import type { ComponentProps } from 'react';
import {
  FLOWCHART_DIRECTIONS,
  FLOWCHART_DIRECTION_LABEL,
  FLOWCHART_STEP_LABEL,
  FLOWCHART_STEP_TYPES,
  type FlowchartDirection,
  type FlowchartStepType,
} from '@livehuddle/document';
import { Glyph, lucideGlyph } from '@livehuddle/ui';
import { lucideRoute, lucideShapes, lucideWorkflow } from '@liveworkspace/icons/lucide';
import { OptionRows } from '@liveworkspace/workbench/components/primitives/OptionRows';
import { MenuAccordionSection } from '@liveworkspace/workbench/components/primitives/PortalMenu';
import { MenuFlyoutSection } from '@liveworkspace/workbench/components/primitives/MenuFlyoutSection';
import { MENU_ICON_PX } from '@/components/palette/context-menu-icons';
import { DataMenuGlyph } from '@/components/palette/context-menu-rows';
import { STEP_TYPE_GLYPH } from '@/components/flowchart/step-type-glyphs';

const ChartGlyph = lucideGlyph(lucideWorkflow, MENU_ICON_PX);
const StepTypeGlyph = lucideGlyph(lucideShapes, MENU_ICON_PX);
const DirectionGlyph = lucideGlyph(lucideRoute, MENU_ICON_PX);

export type FlowchartMenuHandlers = {
  // The selected step's type; absent on a lane.
  stepType?: FlowchartStepType;
  direction: FlowchartDirection;
  onSetStepType: (type: FlowchartStepType) => void;
  onSetDirection: (direction: FlowchartDirection) => void;
  onAddLane: () => void;
  onTidy: () => void;
};

type ChartAction = 'lane' | 'tidy';
type SectionProps = { open: boolean; onToggle: () => void; flush?: boolean };

const CHART_ICON: Record<ChartAction, React.ReactNode> = {
  lane: (
    <Glyph size={16} units={16}>
      <rect x="1.5" y="2.5" width="13" height="5" rx="0.5" />
      <rect x="1.5" y="8.5" width="13" height="5" rx="0.5" />
      <path d="M4.5 2.5v11" />
    </Glyph>
  ),
  tidy: (
    <Glyph size={16} units={16}>
      <rect x="5" y="1.5" width="6" height="3" rx="0.5" />
      <rect x="5" y="6.5" width="6" height="3" rx="0.5" />
      <rect x="5" y="11.5" width="6" height="3" rx="0.5" />
      <path d="M8 4.5v2M8 9.5v2" />
    </Glyph>
  ),
};

const DIRECTION_ICON: Record<FlowchartDirection, React.ReactNode> = {
  down: (
    <Glyph size={16} units={16}>
      <path d="M8 2v11M4.5 9.5 8 13l3.5-3.5" />
    </Glyph>
  ),
  right: (
    <Glyph size={16} units={16}>
      <path d="M2 8h11M9.5 4.5 13 8l-3.5 3.5" />
    </Glyph>
  ),
};

export function FlowchartMenuSections({
  stepType,
  direction,
  onSetStepType,
  onSetDirection,
  onAddLane,
  onTidy,
  sectionProps,
  flyoutProps,
}: FlowchartMenuHandlers & {
  sectionProps: (id: string) => SectionProps;
  // The Flowchart category's own row: open state and placement, as the host gives every flyout.
  flyoutProps: Omit<ComponentProps<typeof MenuFlyoutSection>, 'title' | 'icon' | 'children'>;
}) {
  const actions: Record<ChartAction, () => void> = { lane: onAddLane, tidy: onTidy };
  const chartRows: { id: ChartAction; label: string }[] = [
    { id: 'lane', label: 'Add Lane' },
    { id: 'tidy', label: 'Tidy Flowchart' },
  ];
  return (
    <MenuFlyoutSection title="Flowchart" icon={<DataMenuGlyph />} {...flyoutProps}>
      <MenuAccordionSection
        title="Chart"
        icon={<ChartGlyph />}
        {...sectionProps('flowchart-chart')}
      >
        <OptionRows
          kind="action"
          label="Chart"
          className="mx-3 my-1.5"
          rows={chartRows.map((r) => ({ ...r, icon: CHART_ICON[r.id] }))}
          onPick={(id) => actions[id as ChartAction]()}
        />
      </MenuAccordionSection>
      {stepType ? (
        <MenuAccordionSection
          title="Step Type"
          icon={<StepTypeGlyph />}
          {...sectionProps('flowchart-step-type')}
        >
          <OptionRows
            kind="single"
            label="Step Type"
            className="mx-3 my-1.5"
            selected={stepType}
            rows={FLOWCHART_STEP_TYPES.map((t) => ({
              id: t,
              label: FLOWCHART_STEP_LABEL[t],
              icon: STEP_TYPE_GLYPH[t],
            }))}
            onPick={(id) => onSetStepType(id as FlowchartStepType)}
          />
        </MenuAccordionSection>
      ) : null}
      <MenuAccordionSection
        title="Direction"
        icon={<DirectionGlyph />}
        {...sectionProps('flowchart-direction')}
      >
        <OptionRows
          kind="single"
          label="Direction"
          className="mx-3 my-1.5"
          selected={direction}
          rows={FLOWCHART_DIRECTIONS.map((d) => ({
            id: d,
            label: FLOWCHART_DIRECTION_LABEL[d],
            icon: DIRECTION_ICON[d],
          }))}
          onPick={(id) => onSetDirection(id as FlowchartDirection)}
        />
      </MenuAccordionSection>
    </MenuFlyoutSection>
  );
}
