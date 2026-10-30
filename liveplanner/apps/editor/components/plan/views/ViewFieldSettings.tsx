'use client';

// A view's fields by role (docs/specs/026-plan/plan-views.md "Dates", "Count By"), as its cog's Settings and its
// element menu's View flyout both list them: the Date field a chart reads for each of its dates, and what Cards by
// Field adds up. Each an option list, the built-in first; the model's setters make the one element edit.
import { OptionRows } from '../OptionRows';
import { PlanTypeGlyph } from '../plan-type-glyph';
import { InfoNote, MenuGroup } from '@/components/palette/plan-menu-parts';
import type { planViewSettingsModel } from './plan-view-settings';

type Model = ReturnType<typeof planViewSettingsModel>;

// The Date fields for each of the view's dates: one list for a calendar, Starts On then Due On for a Gantt chart.
export function ViewDateOptions({ m }: { m: Model }) {
  const one = m.dateRoles.length === 1;
  // Only the built-ins to pick from: say where another comes from.
  const onlyBuiltIn = m.dateRoles.every((r) => r.options.length <= 1);
  const lists = m.dateRoles.map((r) => (
    <OptionRows
      key={r.role}
      kind="single"
      label={r.title}
      className="mx-3 my-1.5"
      selected={r.selected}
      rows={r.options.map((o) => ({
        id: o.id,
        label: o.label,
        icon: <PlanTypeGlyph glyph="calendar" size={16} />,
      }))}
      onPick={(id) => m.setDate(r.role, id)}
    />
  ));
  return (
    <>
      <InfoNote>
        {onlyBuiltIn
          ? 'The date field this chart reads. Add a Date field to a card type to chart it here.'
          : 'The date field this chart reads.'}
      </InfoNote>
      {one
        ? lists
        : m.dateRoles.map((r, i) => (
            <MenuGroup key={r.role} title={r.title}>
              {lists[i]}
            </MenuGroup>
          ))}
    </>
  );
}

// Count By: cards, or the sum of Estimate or a Number field.
export function ViewMeasureOptions({ m }: { m: Model }) {
  return (
    <>
      <InfoNote>What each bar adds up: its cards, or their total of a number field.</InfoNote>
      <OptionRows
        kind="single"
        label="Count By"
        className="mx-3 my-1.5"
        selected={m.measure}
        rows={m.measures.map((o) => ({
          id: o.id,
          label: o.label,
          icon: <PlanTypeGlyph glyph={o.id === 'cards' ? 'item' : 'cube'} size={16} />,
        }))}
        onPick={m.setMeasure}
      />
    </>
  );
}
