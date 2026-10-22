'use client';

// A visualisation's settings behind the cog in its header (docs/specs/026-plan/plan-views.md "Settings"), as a
// board's Board Settings and a Sheet's Sheet Settings: Card Types, then Group By (Cards by Field), Statuses (Cards by
// Field, Priority by Status), Swimlanes and Row Order (a Gantt chart). The same changes as its element menu's View
// flyout (planViewSettingsModel), so either does.
import { useState, type ReactNode } from 'react';
import type { PlanViewRef } from '@livedesign/document';
import { CompactEmptyState, lucideGlyph } from '@livedesign/ui';
import {
  lucideCalendar,
  lucideCircleDot,
  lucideGroup,
  lucideLayers,
} from '@livedesign/icons/lucide';
import { BoardSettingsSection } from '@/components/palette/PlanBoardMenuSection';
import { CardTypeOptions, InfoNote, SwimlaneOptions } from '@/components/palette/plan-menu-parts';
import { OptionRows } from '../OptionRows';
import { usePlan } from '../PlanContext';
import { PHASE_COLOURS } from './view-frame';
import { planViewSettingsModel, viewTypesNote } from './plan-view-settings';

const TypesGlyph = lucideGlyph(lucideLayers, 14);
const GroupGlyph = lucideGlyph(lucideGroup, 14);
const OrderGlyph = lucideGlyph(lucideCalendar, 14);
const StatusGlyph = lucideGlyph(lucideCircleDot, 14);

export function PlanViewSettingsPanel({
  elementId,
  stored,
  onClose,
  more,
}: {
  elementId: string;
  stored: PlanViewRef;
  onClose: () => void;
  // Sections after the chart's own, sharing its one-open-at-a-time (a Dashboard slot's Slot section).
  more?:
    ((section: (id: string) => { open: boolean; onToggle: () => void }) => ReactNode) | undefined;
}) {
  const plan = usePlan();
  // The setting most charts are about opens first: Cards by Field's field, else the card types.
  const [open, setOpen] = useState<string | null>(stored.view === 'workload' ? 'group' : 'types');
  if (!plan) return null;
  const m = planViewSettingsModel(plan, elementId, stored);
  // The panel's own Section, or a host's (`more`).
  const section = (id: string) => ({
    open: open === id,
    onToggle: () => setOpen((s) => (s === id ? null : id)),
  });
  return (
    <>
      {m.grouping ? (
        <BoardSettingsSection title="Group By" icon={<GroupGlyph />} {...section('group')}>
          <InfoNote>The field this chart gives a bar to each value of.</InfoNote>
          <SwimlaneOptions
            by={m.grouping.by}
            field={m.grouping.field}
            types={m.shown}
            allTypes={plan.types}
            noNone
            onPick={m.setGrouping}
          />
        </BoardSettingsSection>
      ) : null}
      <BoardSettingsSection title="Card Types" icon={<TypesGlyph />} {...section('types')}>
        <InfoNote>{viewTypesNote(m.needs)}</InfoNote>
        <CardTypeOptions types={m.eligible} selected={m.selected} onChange={m.setTypes} />
      </BoardSettingsSection>
      {m.takesStatuses ? (
        <BoardSettingsSection title="Statuses" icon={<StatusGlyph />} {...section('statuses')}>
          <InfoNote>The statuses this chart counts; a card in any other is left out.</InfoNote>
          {m.statusOptions.length ? (
            <OptionRows
              kind="multiple"
              label="Statuses"
              className="mx-3 my-1.5"
              selected={m.selectedStatuses}
              rows={m.statusOptions.map((o) => {
                const phase = plan.statusPhases.get(o.id);
                return {
                  id: o.id,
                  label: o.label,
                  icon: (
                    <span
                      aria-hidden
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: phase ? PHASE_COLOURS[phase] : PHASE_COLOURS.todo }}
                    />
                  ),
                };
              })}
              onPick={(id) => {
                const on = m.selectedStatuses.includes(id);
                // At least one status stays on: pressing the last one changes nothing.
                if (on && m.selectedStatuses.length <= 1) return;
                m.setStatuses(
                  m.statusOptions
                    .map((o) => o.id)
                    .filter((x) => (x === id ? !on : m.selectedStatuses.includes(x))),
                );
              }}
            />
          ) : (
            <CompactEmptyState
              size="small"
              icon={<StatusGlyph />}
              title="No statuses yet"
              description="Give a card a status and it shows up here to filter by."
            />
          )}
        </BoardSettingsSection>
      ) : null}
      {m.gantt ? (
        <BoardSettingsSection title="Swimlanes" icon={<GroupGlyph />} {...section('lanes')}>
          <SwimlaneOptions
            by={m.settings.swimlaneBy ?? 'none'}
            field={m.settings.swimlaneField}
            types={m.shown}
            allTypes={plan.types}
            onPick={m.setSwimlanes}
          />
        </BoardSettingsSection>
      ) : null}
      {m.gantt ? (
        <BoardSettingsSection title="Row Order" icon={<OrderGlyph />} {...section('order')}>
          <InfoNote>
            {m.settings.rowOrder
              ? 'Rows keep the order you dragged them into.'
              : 'Rows run by start date. Drag a row by its grip to place it yourself.'}
          </InfoNote>
          {m.settings.rowOrder ? (
            <div className="px-3 pb-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  m.sortByDate();
                  onClose();
                }}
                className="w-full cursor-pointer rounded-md border border-slate-200 px-3 py-1.5 text-[12px] font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Sort by Date
              </button>
            </div>
          ) : null}
        </BoardSettingsSection>
      ) : null}
      {more?.(section)}
    </>
  );
}
