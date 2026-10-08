'use client';

// A Gantt chart's settings in its element menu (docs/specs/026-plan/plan-views.md "Card types", "Swimlanes"): a
// View flyout holding two collapsible rows, Card Types (a tile per type with Start and Due, and a note saying why
// the rest are missing) and Swimlanes (the board's grid), then, while the chart has its own row order, a Sort by
// Date action that clears it (plan-views.md "Row order").
// Each change is one element edit, through PlanContext.
import type { ComponentProps } from 'react';
import type { ShapeElement } from '@livediagram/document';
import { PlanIcon } from '@livediagram/ui';
import { MenuFlyoutSection } from '@/components/primitives/MenuFlyoutSection';
import { MenuAccordionSection, MenuActionRow } from '@/components/primitives/PortalMenu';
import { PlanTypeGlyph } from '@/components/plan/plan-type-glyph';
import { usePlan } from '@/components/plan/PlanContext';
import { track } from '@/lib/telemetry';
import {
  GANTT_DEFAULT_TYPES,
  breakdownGroupingOf,
  viewChosenTypes,
  viewEligibleTypes,
  viewNeeds,
  viewShownTypes,
  readPlanViewSettings,
} from '@livediagram/items';
import { InfoNote, SwimlaneTiles, TypeToggleTiles } from './plan-menu-parts';

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
  // The old Parent grouping reads as the Parent field (legacy-parent).
  const settings = element.planView ? readPlanViewSettings(element.planView) : undefined;
  if (!plan || !plan.canEdit || !settings) return null;
  const view = settings.view;
  const gantt = view === 'gantt';
  const eligible = viewEligibleTypes(view, plan.types);
  const eligibleIds = new Set(eligible.map((t) => t.id));
  const chosen = viewChosenTypes(view, settings, plan.types);
  const shown = plan.types.filter((t) => viewShownTypes(view, settings, plan.types).includes(t.id));
  const grouping = view === 'workload' ? breakdownGroupingOf(settings) : null;
  return (
    <MenuFlyoutSection title="View" icon={<PlanIcon size={16} />} {...flyoutProps}>
      <MenuAccordionSection
        title="Card Types"
        icon={<PlanIcon size={16} />}
        {...sectionProps('plan-view-types')}
      >
        <ViewTypesNote needs={viewNeeds(view)} />
        <TypeToggleTiles
          types={eligible}
          selected={chosen.filter((id) => eligibleIds.has(id))}
          onChange={(picked) => {
            const { types: _types, ...rest } = settings;
            // A named type that has lost a field the view needs is not listed, but the view keeps naming it (it
            // comes back when the type has it again): the toggle keeps it alongside what was picked.
            const kept = chosen.filter((id) => !eligibleIds.has(id));
            const next = [...picked, ...kept];
            // The default is dropped rather than stored: Project alone for a Gantt chart, every type otherwise.
            const isDefault = gantt
              ? next.length === GANTT_DEFAULT_TYPES.length &&
                next.every((t) => GANTT_DEFAULT_TYPES.includes(t))
              : eligible.every((t) => next.includes(t.id)) && kept.length === 0;
            plan.updateView(element.id, isDefault ? rest : { ...rest, types: next });
            if (gantt) track('Plan', 'Changed', 'GanttTypes');
            else track('Plan', 'Changed', 'ViewTypes');
          }}
        />
      </MenuAccordionSection>
      {grouping ? (
        <MenuAccordionSection
          title="Group By"
          icon={<PlanIcon size={16} />}
          {...sectionProps('plan-view-grouping')}
        >
          <InfoNote>The field this chart gives a bar to each value of.</InfoNote>
          <SwimlaneTiles
            by={grouping.by}
            field={grouping.field}
            types={shown}
            allTypes={plan.types}
            noNone
            onPick={(by, field) => {
              const { swimlaneBy: _by, swimlaneField: _field, ...rest } = settings;
              plan.updateView(
                element.id,
                by === 'assignee'
                  ? rest
                  : { ...rest, swimlaneBy: by, ...(field ? { swimlaneField: field } : {}) },
              );
              track('Plan', 'Changed', 'ViewGrouping');
            }}
          />
        </MenuAccordionSection>
      ) : null}
      {gantt ? (
        <MenuAccordionSection
          title="Swimlanes"
          icon={<PlanIcon size={16} />}
          {...sectionProps('plan-view-swimlanes')}
        >
          <SwimlaneTiles
            by={settings.swimlaneBy ?? 'none'}
            field={settings.swimlaneField}
            types={shown}
            allTypes={plan.types}
            onPick={(by, field) => {
              const { swimlaneBy: _by, swimlaneField: _field, ...rest } = settings;
              plan.updateView(
                element.id,
                by === 'none'
                  ? rest
                  : { ...rest, swimlaneBy: by, ...(field ? { swimlaneField: field } : {}) },
              );
              track('Plan', 'Changed', 'GanttSwimlanes');
            }}
          />
        </MenuAccordionSection>
      ) : null}
      {gantt && settings.rowOrder ? (
        <MenuActionRow
          label="Sort by Date"
          icon={<PlanTypeGlyph glyph="calendar" size={16} />}
          onClick={() => {
            const { rowOrder: _order, ...rest } = settings;
            plan.updateView(element.id, rest);
            track('Plan', 'Changed', 'GanttRowOrder');
          }}
        />
      ) : null}
    </MenuFlyoutSection>
  );
}

const NEED_LABELS: Record<string, string> = {
  start: 'Start',
  due: 'Due',
  priority: 'Priority',
  assignee: 'Assignee',
  estimate: 'Estimate',
  votes: 'Votes',
};

// Which card types the view charts, and why some are missing: the view reads fields a type must offer.
function ViewTypesNote({ needs }: { needs: readonly string[] }) {
  if (needs.length === 0) return <InfoNote>The card types this view charts.</InfoNote>;
  const names = needs.map((f) => NEED_LABELS[f] ?? f);
  const list = names.length === 1 ? `a ${names[0]} field` : `${names.join(' and ')} fields`;
  return <InfoNote>The card types this view charts; only those with {list} are listed.</InfoNote>;
}
