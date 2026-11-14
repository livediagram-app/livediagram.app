// @vitest-environment jsdom
// docs/specs/026-plan/automations.md "The rule builder": Card Moved's panel picks Card Types above From and To, which
// then list only the columns those types use; an old rule with no types lists every column; a deleted type shows gone.
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useState } from 'react';
import type { AutomationRuleBody, AutomationTrigger, ItemTypeDef } from '@liveplanner/items';
import { newRuleBody } from './rule-draft';
import { StepPanel } from './StepPanel';
import { outline } from './test-fixtures';

afterEach(cleanup);

const type = (id: string, label: string, statuses: string[]): ItemTypeDef => ({
  id,
  label,
  newTitle: label,
  glyph: 'item',
  color: '#000',
  fields: ['title'],
  statuses,
});
const statuses = new Map([
  ['todo', 'To Do'],
  ['triage', 'Triage'],
  ['doing', 'In Progress'],
  ['done', 'Done'],
]);
const PLAN = outline({
  types: [type('bug', 'Bug', ['triage', 'done']), type('task', 'Task', ['todo', 'doing', 'done'])],
  statuses,
  columns: [...statuses].map(([status, name]) => ({ status, name })),
});

let latest: AutomationRuleBody;
function Panel({ trigger }: { trigger: AutomationTrigger }) {
  const [b, setB] = useState({ ...newRuleBody('R', 'UTC'), trigger });
  return (
    <StepPanel
      body={b}
      part={{ part: 'trigger' }}
      onChange={(next) => {
        latest = next;
        setB(next);
      }}
      outline={PLAN}
      faultPath={null}
      person="Ana Costa"
      now={Date.UTC(2026, 10, 11)}
      timeZone="Europe/London"
    />
  );
}
const group = (name: string) => within(screen.getByRole('group', { name }));
const chips = (name: string) =>
  group(name)
    .getAllByRole('button')
    .map((b) => b.textContent);

describe('Card Moved’s Card Types', () => {
  it('lists every column with no type picked, as an old rule reads', () => {
    render(<Panel trigger={{ kind: 'card_moved', to: ['doing'] }} />);
    expect(chips('Card Types')).toEqual(['Bug', 'Task']);
    expect(screen.getByText('None picked: any card type.')).toBeTruthy();
    expect(chips('From')).toEqual(['To Do', 'Triage', 'In Progress', 'Done']);
    expect(chips('To')).toEqual(['To Do', 'Triage', 'In Progress', 'Done']);
  });

  it('narrows From and To to the picked types’ columns, dropping a pick no type uses', () => {
    render(<Panel trigger={{ kind: 'card_moved', from: ['todo'], to: ['doing', 'done'] }} />);
    fireEvent.click(group('Card Types').getByRole('button', { name: 'Bug' }));
    expect(latest.trigger).toEqual({ kind: 'card_moved', types: ['bug'], from: [], to: ['done'] });
    expect(chips('From')).toEqual(['Triage', 'Done']);
    expect(chips('To')).toEqual(['Triage', 'Done']);
    fireEvent.click(group('Card Types').getByRole('button', { name: 'Task' }));
    expect(chips('From')).toEqual(['To Do', 'Triage', 'In Progress', 'Done']);
    fireEvent.click(group('Card Types').getByRole('button', { name: 'Bug' }));
    fireEvent.click(group('Card Types').getByRole('button', { name: 'Task' }));
    expect(latest.trigger).toEqual({ kind: 'card_moved', from: [], to: ['done'] });
  });

  // Work Tracker 855: a type whose statuses changed since stops using a picked column the plan still has. It shows by
  // its name, picked, with a note; only a column the plan deleted reads as gone.
  it('shows a picked column the picked types stopped using by its name, with a note, and a deleted one as gone', () => {
    render(
      <Panel
        trigger={{ kind: 'card_moved', types: ['bug'], from: ['doing'], to: ['done', 'qa'] }}
      />,
    );
    expect(chips('From')).toEqual(['Triage', 'Done', 'In Progress']);
    const kept = group('From').getByRole('button', { name: 'In Progress' });
    expect(kept.getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByText("The picked card types don't use In Progress.")).toBeTruthy();
    expect(chips('To')).toEqual(['Triage', 'Done', 'A column no longer here']);
    expect(screen.getAllByText(/The picked card types don't use/)).toHaveLength(1);
    // Unpicked, it leaves the list and the note goes.
    fireEvent.click(kept);
    expect(chips('From')).toEqual(['Triage', 'Done']);
    expect(screen.queryByText(/The picked card types don't use/)).toBeNull();
  });

  it('shows a deleted card type as gone, picked, so it can be unpicked', () => {
    render(<Panel trigger={{ kind: 'card_moved', types: ['epic'] }} />);
    const gone = group('Card Types').getByRole('button', { name: 'A card type no longer here' });
    expect(gone.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(gone);
    expect(latest.trigger).toEqual({ kind: 'card_moved' });
  });
});
