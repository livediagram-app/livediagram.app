// @vitest-environment jsdom
// docs/specs/026-plan/item-types.md "Explicit mappings" (Work Tracker 843): Change Card Type's Map Fields names a
// source field of any type and the new type's field (or its Description) it fills, only fields that can take it, each
// target once; changing the type keeps the mappings it can.
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useState } from 'react';
import type { AutomationAction, ItemTypeDef } from '@liveplanner/items';
import { SetTypePanel } from './step-panels/CardActionPanels';
import { mapSources, mapTargets } from './step-panels/TypeFieldMapEditor';
import { outline } from './test-fixtures';

afterEach(cleanup);

const type = (id: string, label: string, custom: ItemTypeDef['custom']): ItemTypeDef => ({
  id,
  label,
  newTitle: label,
  glyph: 'item',
  color: '#000',
  fields: ['title', 'description', ...(custom ?? []).map((f) => f.id)],
  custom,
});
const IDEA = type('idea', 'Idea', [
  { id: 'f-solution', label: 'Solution', kind: 'longtext' },
  { id: 'f-size', label: 'Size', kind: 'number' },
]);
const WORK = type('work', 'Work Item', [
  { id: 'f-criteria', label: 'Acceptance Criteria', kind: 'longtext' },
  { id: 'f-notes', label: 'Notes', kind: 'text' },
]);
const BUG = type('bug', 'Bug', [{ id: 'f-notes', label: 'Notes', kind: 'text' }]);
const PLAN = outline({ types: [IDEA, WORK, BUG] });

let latest: AutomationAction;
function Panel({ start }: { start: AutomationAction & { kind: 'set_type' } }) {
  const [a, setA] = useState(start);
  return (
    <SetTypePanel
      action={a}
      outline={PLAN}
      onChange={(next) => {
        latest = next;
        setA(next as typeof a);
      }}
    />
  );
}
const options = (name: string) =>
  [...screen.getByLabelText<HTMLSelectElement>(name).options].map((o) => o.textContent);

describe('Map Fields', () => {
  it('lists sources by type and only the targets that can take them', () => {
    expect(mapSources(PLAN.types, 'work').map((s) => s.def.id)).toEqual([
      'f-solution',
      'f-size',
      'f-notes',
    ]);
    expect(mapTargets(WORK, IDEA.custom![0]).map((t) => t.id)).toEqual([
      'f-criteria',
      'f-notes',
      'description',
    ]);
    expect(mapTargets(WORK, IDEA.custom![1])).toEqual([]);
    expect(mapTargets(undefined, IDEA.custom![0])).toEqual([]);
  });

  it('adds, changes and removes a mapping, an old rule with none reading as before', () => {
    render(<Panel start={{ kind: 'set_type', type: 'work' }} />);
    expect(screen.getByRole('group', { name: 'Map Fields' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '+ Add Mapping' }));
    expect(latest).toEqual({
      kind: 'set_type',
      type: 'work',
      map: [{ from: 'f-solution', to: 'f-criteria' }],
    });
    expect(options('Mapping 1: Solution into')).toEqual([
      'Acceptance Criteria',
      'Notes',
      'Description',
    ]);
    fireEvent.change(screen.getByLabelText('Mapping 1: Solution into'), {
      target: { value: 'description' },
    });
    expect(latest).toMatchObject({ map: [{ from: 'f-solution', to: 'description' }] });
    // A second mapping takes a target the first doesn't fill.
    fireEvent.click(screen.getByRole('button', { name: '+ Add Mapping' }));
    expect(latest).toMatchObject({
      map: [
        { from: 'f-solution', to: 'description' },
        { from: 'f-solution', to: 'f-criteria' },
      ],
    });
    expect(options('Mapping 2: Solution into')).toEqual(['Acceptance Criteria', 'Notes']);
    // A source the target can't take moves it to the first free field that can.
    fireEvent.change(screen.getByLabelText('Mapping 2: from'), { target: { value: 'f-notes' } });
    expect(latest).toMatchObject({ map: [{}, { from: 'f-notes', to: 'f-criteria' }] });
    fireEvent.click(screen.getByRole('button', { name: 'Remove Mapping 1' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove Mapping 1' }));
    expect(latest).toEqual({ kind: 'set_type', type: 'work' });
  });

  it('keeps the mappings a new type can take when the type changes, and names a gone field', () => {
    render(
      <Panel
        start={{
          kind: 'set_type',
          type: 'work',
          map: [
            { from: 'f-solution', to: 'description' },
            { from: 'f-gone', to: 'f-criteria' },
          ],
        }}
      />,
    );
    expect(options('Mapping 2: from')[0]).toBe('A field no longer here');
    fireEvent.change(screen.getByLabelText('Card Type'), { target: { value: 'bug' } });
    expect(latest).toEqual({
      kind: 'set_type',
      type: 'bug',
      map: [{ from: 'f-solution', to: 'description' }],
    });
  });

  it('adds nothing when no source can fill a field of the new type', () => {
    render(<Panel start={{ kind: 'set_type', type: 'idea' }} />);
    // A Work Item's Acceptance Criteria can fill an Idea's Solution, so one is offered; a lone Number field has none.
    expect(screen.getByRole<HTMLButtonElement>('button', { name: '+ Add Mapping' }).disabled).toBe(
      false,
    );
    cleanup();
    const lone = outline({ types: [type('a', 'A', [{ id: 'f-n', label: 'N', kind: 'number' }])] });
    render(
      <SetTypePanel action={{ kind: 'set_type', type: 'a' }} outline={lone} onChange={() => {}} />,
    );
    expect(screen.getByRole<HTMLButtonElement>('button', { name: '+ Add Mapping' }).disabled).toBe(
      true,
    );
  });
});
