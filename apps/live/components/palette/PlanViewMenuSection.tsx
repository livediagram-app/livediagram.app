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
import { GANTT_DEFAULT_TYPES, ganttEligibleTypes, ganttTypesOf } from '@livediagram/items';
import { SwimlaneTiles, TypeToggleTiles } from './plan-menu-parts';

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
  const settings = element.planView;
  if (!plan || !plan.canEdit || settings?.view !== 'gantt') return null;
  const eligible = ganttEligibleTypes(plan.types);
  const eligibleIds = new Set(eligible.map((t) => t.id));
  return (
    <MenuFlyoutSection title="View" icon={<PlanIcon size={16} />} {...flyoutProps}>
      <MenuAccordionSection
        title="Card Types"
        icon={<PlanIcon size={16} />}
        {...sectionProps('plan-view-types')}
      >
        <GanttTypesNote />
        <TypeToggleTiles
          types={eligible}
          selected={ganttTypesOf(settings).filter((id) => eligibleIds.has(id))}
          onChange={(picked) => {
            const { types: _types, ...rest } = settings;
            // A named type that has lost Start or Due is not listed, but the chart keeps naming it (it comes back
            // when the type has both again): the toggle keeps it alongside what was picked.
            const kept = ganttTypesOf(settings).filter((id) => !eligibleIds.has(id));
            const next = [...picked, ...kept];
            // Project alone is the default: the setting is dropped rather than stored.
            const isDefault =
              next.length === GANTT_DEFAULT_TYPES.length &&
              next.every((t) => GANTT_DEFAULT_TYPES.includes(t));
            plan.updateView(element.id, isDefault ? rest : { ...rest, types: next });
            track('Plan', 'Changed', 'GanttTypes');
          }}
        />
      </MenuAccordionSection>
      <MenuAccordionSection
        title="Swimlanes"
        icon={<PlanIcon size={16} />}
        {...sectionProps('plan-view-swimlanes')}
      >
        <SwimlaneTiles
          by={settings.swimlaneBy ?? 'none'}
          field={settings.swimlaneField}
          types={plan.types}
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
      {settings.rowOrder ? (
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

// Why some card types are missing from the list: a Gantt chart draws a bar from Start to Due.
export function GanttTypesNote() {
  return (
    <p
      role="note"
      className="mx-3 mb-1 mt-1 flex gap-1.5 rounded-md bg-brand-50 px-2 py-1.5 text-[11px] leading-snug text-brand-800 dark:bg-brand-500/10 dark:text-brand-200"
    >
      <span
        aria-hidden
        className="mt-px flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border border-current text-[9px] font-bold"
      >
        <span className="text-optical-centre">i</span>
      </span>
      <span>Only card types with Start and Due fields show here.</span>
    </p>
  );
}
