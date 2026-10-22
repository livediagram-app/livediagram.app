'use client';

// A Gantt chart's settings in its element menu (docs/specs/026-plan/plan-views.md "Card types", "Swimlanes"): a
// View flyout holding two collapsible rows, Card Types (a tile per type with Start and Due, and a note saying why
// the rest are missing) and Swimlanes (the board's grid), then, while the chart has its own row order, a Sort by
// Date action that clears it (plan-views.md "Row order").
// Each change is one element edit, through PlanContext.
import type { ComponentProps } from 'react';
import type { ShapeElement } from '@liveplanner/project';
import { PlanIcon } from '@liveplanner/ui';
import { MenuFlyoutSection } from '@/components/primitives/MenuFlyoutSection';
import { MenuAccordionSection, MenuActionRow } from '@/components/primitives/PortalMenu';
import { PlanTypeGlyph } from '@/components/plan/plan-type-glyph';
import { usePlan } from '@/components/plan/PlanContext';
import { InfoNote, SwimlaneOptions, CardTypeOptions } from './plan-menu-parts';
import { planViewSettingsModel, viewTypesNote } from '@/components/plan/views/plan-view-settings';

type FlyoutProps = Omit<ComponentProps<typeof MenuFlyoutSection>, 'title' | 'icon' | 'children'>;
type SectionProps = { open: boolean; onToggle: () => void; flush?: boolean };

export function PlanViewMenuSection({
  element,
  flyoutProps,
  sectionProps,
}: {
  element: ShapeElement;
  flyoutProps: FlyoutProps;
  // Each row's open state, from the menu scaffold, so it survives the menu retargeting.
  sectionProps: (id: string) => SectionProps;
}) {
  const plan = usePlan();
  if (!plan || !plan.canEdit || !element.planView) return null;
  const m = planViewSettingsModel(plan, element.id, element.planView);
  return (
    <MenuFlyoutSection title="View" icon={<PlanIcon size={16} />} {...flyoutProps}>
      <MenuAccordionSection
        title="Card Types"
        icon={<PlanIcon size={16} />}
        {...sectionProps('plan-view-types')}
      >
        <InfoNote>{viewTypesNote(m.needs)}</InfoNote>
        <CardTypeOptions types={m.eligible} selected={m.selected} onChange={m.setTypes} />
      </MenuAccordionSection>
      {m.grouping ? (
        <MenuAccordionSection
          title="Group By"
          icon={<PlanIcon size={16} />}
          {...sectionProps('plan-view-grouping')}
        >
          <InfoNote>The field this chart gives a bar to each value of.</InfoNote>
          <SwimlaneOptions
            by={m.grouping.by}
            field={m.grouping.field}
            types={m.shown}
            allTypes={plan.types}
            noNone
            onPick={m.setGrouping}
          />
        </MenuAccordionSection>
      ) : null}
      {m.gantt ? (
        <MenuAccordionSection
          title="Swimlanes"
          icon={<PlanIcon size={16} />}
          {...sectionProps('plan-view-swimlanes')}
        >
          <SwimlaneOptions
            by={m.settings.swimlaneBy ?? 'none'}
            field={m.settings.swimlaneField}
            types={m.shown}
            allTypes={plan.types}
            onPick={m.setSwimlanes}
          />
        </MenuAccordionSection>
      ) : null}
      {m.gantt && m.settings.rowOrder ? (
        <MenuActionRow
          label="Sort by Date"
          icon={<PlanTypeGlyph glyph="calendar" size={16} />}
          onClick={m.sortByDate}
        />
      ) : null}
    </MenuFlyoutSection>
  );
}
