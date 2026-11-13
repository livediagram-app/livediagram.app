// @vitest-environment jsdom
// docs/specs/026-plan/automations.md "Triggers", "Conditions", "Actions", "Values": each step's panel, picking from
// the plan's own columns, types, fields and people, and the Preview on a real card.
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useState } from 'react';
import type { AutomationRuleBody } from '@liveplanner/items';
import { newRuleBody, type RulePart } from './rule-draft';
import { StepPanel, faultWithin } from './StepPanel';
import { outline, pickStep } from './test-fixtures';

afterEach(cleanup);

let latest: AutomationRuleBody;
function Panel({
  body,
  part,
  o = outline(),
  fault = null,
}: {
  body: AutomationRuleBody;
  part: RulePart | null;
  o?: ReturnType<typeof outline>;
  fault?: string | null;
}) {
  const [b, setB] = useState(body);
  return (
    <StepPanel
      body={b}
      part={part}
      onChange={(next) => {
        latest = next;
        setB(next);
      }}
      outline={o}
      faultPath={fault}
      person="Ana Costa"
      now={Date.UTC(2026, 10, 11)}
      timeZone="Europe/London"
    />
  );
}
const body = (over: Partial<AutomationRuleBody> = {}) => ({
  ...newRuleBody('Wrap Up', 'UTC'),
  ...over,
});
const pick = (name: string, value: string) =>
  fireEvent.change(screen.getByRole('combobox', { name }), { target: { value } });

describe('StepPanel', () => {
  it('says to pick a step when none is', () => {
    render(<Panel body={body()} part={null} />);
    expect(screen.getByText(/Pick a step/)).toBeTruthy();
  });

  it('switches the trigger and narrows each kind', () => {
    render(<Panel body={body()} part={{ part: 'trigger' }} />);
    pick('In Column', 'done');
    expect(latest.trigger).toEqual({ kind: 'card_created', status: 'done' });
    pick('In Column', '');
    expect(latest.trigger).toEqual({ kind: 'card_created' });
    pickStep('form_response');
    pick('Form', 't-form');
    expect(latest.trigger).toEqual({ kind: 'form_response', formTab: 't-form' });
    pick('Form', '');
    pickStep('card_moved');
    fireEvent.click(screen.getAllByRole('button', { name: 'Done' })[1]!);
    fireEvent.click(screen.getAllByRole('button', { name: 'To Do' })[0]!);
    expect(latest.trigger).toEqual({ kind: 'card_moved', to: ['done'], from: ['todo'] });
    pickStep('field_changed');
    expect(latest.trigger.kind).toBe('field_changed');
    fireEvent.click(screen.getByRole('button', { name: 'Due Date' }));
    pickStep('comment_added');
    expect(screen.getByText(/Automation’s own comments start nothing/)).toBeTruthy();
    pickStep('manual');
    expect(screen.getByText(/listed under Run Rule/)).toBeTruthy();
  });

  it('leaves out of Set Field and Clear Field the fields no write changes, unless a step holds one', () => {
    const [first, ...rest] = outline().types;
    const o = outline({
      types: [
        {
          ...first!,
          fields: [...first!.fields, 'f-votes', 'f-spent', 'f-score'],
          custom: [
            ...(first!.custom ?? []),
            { id: 'f-votes', label: 'Votes', kind: 'votes' },
            { id: 'f-spent', label: 'Time Spent', kind: 'duration', timeSpent: true },
            { id: 'f-score', label: 'Score', kind: 'calculated', calculation: 'childCount' },
          ],
        },
        ...rest,
      ],
    });
    const names = (name: string) =>
      [...screen.getByRole('combobox', { name }).querySelectorAll('option')].map(
        (x) => x.textContent,
      );
    const set = render(
      <Panel
        o={o}
        body={body({ steps: [{ kind: 'set_field', field: 'title', value: { from: 'due' } }] })}
        part={{ part: 'step', index: 0 }}
      />,
    );
    for (const list of [names('Field'), names('From Field')])
      for (const gone of ['Votes', 'Time Spent', 'Score']) expect(list).not.toContain(gone);
    expect(names('Field')).toContain('Title');
    set.unmount();
    const clear = render(
      <Panel
        o={o}
        body={body({ steps: [{ kind: 'clear_field', field: 'due' }] })}
        part={{ part: 'step', index: 0 }}
      />,
    );
    expect(names('Field')).not.toContain('Votes');
    clear.unmount();
    // A step saved on one before still reads as what it holds.
    render(
      <Panel
        o={o}
        body={body({ steps: [{ kind: 'set_field', field: 'f-votes', value: { text: '5' } }] })}
        part={{ part: 'step', index: 0 }}
      />,
    );
    expect(names('Field')).toContain('Votes');
    expect(names('Field')).not.toContain('Score');
  });

  it('sets Priority and a Choice field to one of their values, picked, never typed', () => {
    const [first, ...rest] = outline().types;
    const o = outline({
      types: [
        {
          ...first!,
          fields: [...first!.fields, 'f-size'],
          custom: [
            ...(first!.custom ?? []),
            { id: 'f-size', label: 'Size', kind: 'choice', options: ['S', 'M', 'L'] },
          ],
        },
        ...rest,
      ],
    });
    render(
      <Panel
        o={o}
        body={body({ steps: [{ kind: 'set_field', field: 'title', value: { text: 'Hi' } }] })}
        part={{ part: 'step', index: 0 }}
      />,
    );
    // Flagged and Checklist have their own actions.
    const fieldNames = [
      ...screen.getByRole('combobox', { name: 'Field' }).querySelectorAll('option'),
    ];
    expect(fieldNames.map((f) => f.textContent)).not.toContain('Flagged');
    expect(fieldNames.map((f) => f.value)).not.toContain('checklist');
    pick('Field', 'priority');
    expect(latest.steps[0]).toEqual({
      kind: 'set_field',
      field: 'priority',
      value: { text: 'urgent' },
    });
    expect(screen.queryByRole('textbox', { name: 'Text' })).toBeNull();
    const setTo = screen.getByRole('combobox', { name: 'Set To' });
    expect([...setTo.querySelectorAll('option')].map((x) => x.textContent)).toEqual([
      'A Choice',
      'Another Field’s Value',
    ]);
    const choice = screen.getByRole('combobox', { name: 'Choice' });
    expect([...choice.querySelectorAll('option')].map((x) => x.textContent)).toEqual([
      'Urgent',
      'High',
      'Medium',
      'Low',
    ]);
    pick('Choice', 'high');
    expect(latest.steps[0]).toMatchObject({ value: { text: 'high' } });
    pick('Set To', 'from');
    pick('Set To', 'text');
    expect(latest.steps[0]).toMatchObject({ value: { text: 'urgent' } });
    pick('Field', 'f-size');
    expect(latest.steps[0]).toMatchObject({ field: 'f-size', value: { text: 'S' } });
    pick('Choice', 'L');
    expect(latest.steps[0]).toMatchObject({ value: { text: 'L' } });
    // Back on a free field, text again.
    pick('Field', 'title');
    expect(screen.getByRole('textbox', { name: 'Text' })).toBeTruthy();
  });

  it('sets the Assignee and a Person field to one of the plan’s people, and a Checkbox to Yes or No', () => {
    const [first, ...rest] = outline().types;
    const o = outline({
      types: [
        {
          ...first!,
          fields: [...first!.fields, 'f-who', 'f-ok'],
          custom: [
            ...(first!.custom ?? []),
            { id: 'f-who', label: 'Reviewer', kind: 'person' },
            { id: 'f-ok', label: 'Signed Off', kind: 'checkbox' },
          ],
        },
        ...rest,
      ],
    });
    const people = o.people;
    render(
      <Panel
        o={o}
        body={body({ steps: [{ kind: 'set_field', field: 'title', value: { text: 'Hi' } }] })}
        part={{ part: 'step', index: 0 }}
      />,
    );
    pick('Field', 'assignee');
    // Kept by id, shown by name, as Assign's pick is; never typed.
    expect(latest.steps[0]).toEqual({
      kind: 'set_field',
      field: 'assignee',
      value: { text: people[0]!.id },
    });
    expect(screen.queryByRole('textbox', { name: 'Text' })).toBeNull();
    const setTo = screen.getByRole('combobox', { name: 'Set To' });
    expect([...setTo.querySelectorAll('option')].map((x) => x.textContent)).toEqual([
      'A Person',
      'Another Field’s Value',
    ]);
    const person = screen.getByRole('combobox', { name: 'Person' });
    expect([...person.querySelectorAll('option')].map((x) => x.textContent)).toEqual(
      people.map((p) => p.name),
    );
    pick('Person', people[1]!.id);
    expect(latest.steps[0]).toMatchObject({ value: { text: people[1]!.id } });
    pick('Field', 'f-who');
    expect(latest.steps[0]).toMatchObject({ field: 'f-who', value: { text: people[1]!.id } });
    pick('Field', 'f-ok');
    expect(latest.steps[0]).toMatchObject({ field: 'f-ok', value: { text: 'true' } });
    const yesNo = screen.getByRole('combobox', { name: 'Value' });
    expect([...yesNo.querySelectorAll('option')].map((x) => x.textContent)).toEqual(['Yes', 'No']);
    expect(
      [...screen.getByRole('combobox', { name: 'Set To' }).querySelectorAll('option')][0]!
        .textContent,
    ).toBe('Yes or No');
    pick('Value', 'false');
    expect(latest.steps[0]).toMatchObject({ value: { text: 'false' } });
  });

  it('shows a person picked who has left in words, and a name an agent wrote as it is', () => {
    const steps = (text: string): AutomationRuleBody['steps'] => [
      { kind: 'set_field', field: 'assignee', value: { text } },
    ];
    render(<Panel body={body({ steps: steps('user_left') })} part={{ part: 'step', index: 0 }} />);
    expect(screen.getByRole('option', { name: 'Someone No Longer Here' })).toBeTruthy();
    expect(screen.queryByText(/user_left/)).toBeNull();
    cleanup();
    const name = outline().people[0]!.name.toUpperCase();
    render(<Panel body={body({ steps: steps(name) })} part={{ part: 'step', index: 0 }} />);
    expect(screen.getByRole('option', { name })).toBeTruthy();
    cleanup();
    render(<Panel body={body({ steps: steps('') })} part={{ part: 'step', index: 0 }} />);
    expect(screen.getByRole('option', { name: 'Pick a person' })).toBeTruthy();
  });

  it('keeps a choice field’s text that is no choice, and a number it was saved with, shown', () => {
    render(
      <Panel
        body={body({
          steps: [{ kind: 'set_field', field: 'priority', value: { text: '{{card.priority}}' } }],
        })}
        part={{ part: 'step', index: 0 }}
      />,
    );
    expect(screen.getByRole('option', { name: '{{card.priority}}' })).toBeTruthy();
    cleanup();
    render(
      <Panel
        body={body({ steps: [{ kind: 'set_field', field: 'priority', value: { number: 2 } }] })}
        part={{ part: 'step', index: 0 }}
      />,
    );
    expect(screen.getByRole('combobox', { name: 'Set To' })).toBe(
      screen.getByDisplayValue('A Number'),
    );
    cleanup();
    render(
      <Panel
        body={body({
          steps: [{ kind: 'set_field', field: 'priority', value: { date: { today: 1 } } }],
        })}
        part={{ part: 'step', index: 0 }}
      />,
    );
    expect(screen.getByRole('combobox', { name: 'Set To' })).toBe(
      screen.getByDisplayValue('A Day'),
    );
  });

  it('leaves out of Field Changed the fields no write changes', () => {
    const [first, ...rest] = outline().types;
    const timed = {
      ...first!,
      fields: [...first!.fields, 'f-time', 'f-left'],
      custom: [
        ...(first!.custom ?? []),
        { id: 'f-time', label: 'Time Spent', kind: 'duration' as const, timeSpent: true },
        { id: 'f-left', label: 'Time Left', kind: 'duration' as const },
      ],
    };
    render(
      <Panel
        body={body({ trigger: { kind: 'field_changed', fields: ['f-left'] } })}
        part={{ part: 'trigger' }}
        o={outline({ types: [timed, ...rest] })}
      />,
    );
    expect(screen.getByRole('button', { name: 'Time Left' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Time Spent' })).toBeNull();
  });

  it('names a field Field Changed never hears that the rule holds, never as gone', () => {
    const [first, ...rest] = outline().types;
    const timed = {
      ...first!,
      fields: [...first!.fields, 'f-time'],
      custom: [
        ...(first!.custom ?? []),
        { id: 'f-time', label: 'Time Spent', kind: 'duration' as const, timeSpent: true },
      ],
    };
    render(
      <Panel
        body={body({ trigger: { kind: 'field_changed', fields: ['f-time', 'f-lost'] } })}
        part={{ part: 'trigger' }}
        o={outline({ types: [timed, ...rest] })}
      />,
    );
    expect(screen.getByRole('button', { name: 'Time Spent', pressed: true })).toBeTruthy();
    expect(screen.getAllByRole('button', { name: 'A field no longer here' })).toHaveLength(1);
  });

  it('edits the type, column and who conditions, is and is not', () => {
    render(
      <Panel
        body={body({ conditions: [{ kind: 'type', types: [] }] })}
        part={{ part: 'condition', index: 0 }}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Idea' }));
    pick('Match', 'not');
    expect(latest.conditions[0]).toEqual({ kind: 'type', types: ['idea'], not: true });
    pick('Match', 'is');
    expect(latest.conditions[0]).toEqual({ kind: 'type', types: ['idea'] });
    pick('Condition', 'column');
    fireEvent.click(screen.getByRole('button', { name: 'In Progress' }));
    expect(latest.conditions[0]).toMatchObject({ kind: 'column', statuses: ['todo', 'doing'] });
    pick('Condition', 'who');
    fireEvent.click(screen.getByRole('button', { name: 'An Agent' }));
    fireEvent.click(screen.getByRole('button', { name: 'Marco Ruiz' }));
    expect(latest.conditions[0]).toEqual({
      kind: 'who',
      who: [{ role: 'editor' }, { role: 'agent' }, { person: 'u-marco' }],
    });
    pick('Match', 'not');
    expect(latest.conditions[0]).toMatchObject({ not: true });
  });

  it('edits a field condition by what the field holds', () => {
    render(
      <Panel
        body={body({ conditions: [{ kind: 'field', field: 'due', op: 'not_empty' }] })}
        part={{ part: 'condition', index: 0 }}
      />,
    );
    pick('Compare', 'before');
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Today, shifted by' }), {
      target: { value: '-2' },
    });
    expect(latest.conditions[0]).toEqual({
      kind: 'field',
      field: 'due',
      op: 'before',
      value: { today: -2 },
    });
    pick('Field', 'title');
    pick('Compare', 'contains');
    fireEvent.change(screen.getByRole('textbox', { name: 'Value' }), {
      target: { value: 'launch' },
    });
    expect(latest.conditions[0]).toEqual({
      kind: 'field',
      field: 'title',
      op: 'contains',
      value: 'launch',
    });
    pick('Compare', 'empty');
    expect(latest.conditions[0]).toEqual({ kind: 'field', field: 'title', op: 'empty' });
    pick('Field', 'estimate');
    pick('Compare', 'more_than');
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Value' }), { target: { value: '3' } });
    expect(latest.conditions[0]).toMatchObject({ op: 'more_than', value: 3 });
  });

  it('picks a saved filter, or says there is none', () => {
    render(
      <Panel
        body={body({ conditions: [{ kind: 'saved_filter', tab: '', filter: '' }] })}
        part={{ part: 'condition', index: 0 }}
      />,
    );
    pick('Saved Filter', 't-board\u0000f1');
    expect(latest.conditions[0]).toEqual({ kind: 'saved_filter', tab: 't-board', filter: 'f1' });
    cleanup();
    render(
      <Panel
        body={body({ conditions: [{ kind: 'saved_filter', tab: '', filter: '' }] })}
        part={{ part: 'condition', index: 0 }}
        o={outline({ boards: [] })}
      />,
    );
    expect(screen.getByText(/No board in this plan has a saved filter/)).toBeTruthy();
  });

  it('edits each action kind', () => {
    render(
      <Panel
        body={body({ steps: [{ kind: 'move', status: 'gone' }] })}
        part={{ part: 'step', index: 0 }}
      />,
    );
    expect(screen.getByRole('option', { name: 'A column no longer here' })).toBeTruthy();
    pick('Column', 'done');
    expect(latest.steps[0]).toEqual({ kind: 'move', status: 'done' });
    pickStep('set_field');
    // A new Set Field starts on Priority, at its first value; a free field takes a number or a day.
    expect(latest.steps[0]).toEqual({
      kind: 'set_field',
      field: 'priority',
      value: { text: 'urgent' },
    });
    pick('Field', 'estimate');
    pick('Set To', 'number');
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Number' }), {
      target: { value: '5' },
    });
    expect(latest.steps[0]).toMatchObject({ kind: 'set_field', value: { number: 5 } });
    pick('Set To', 'date');
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Today, shifted by' }), {
      target: { value: '7' },
    });
    expect(latest.steps[0]).toMatchObject({ value: { date: { today: 7 } } });
    pick('Set To', 'from');
    pick('From Field', 'due');
    expect(latest.steps[0]).toMatchObject({ value: { from: 'due' } });
    pick('Set To', 'text');
    fireEvent.change(screen.getByRole('textbox', { name: 'Text' }), { target: { value: 'Hi' } });
    pick('Field', 'title');
    expect(latest.steps[0]).toEqual({ kind: 'set_field', field: 'title', value: { text: 'Hi' } });
    pickStep('clear_field');
    pick('Field', 'labels');
    expect(latest.steps[0]).toEqual({ kind: 'clear_field', field: 'labels' });
    pickStep('assign');
    pick('Assign To', 'person:u-ana');
    expect(latest.steps[0]).toEqual({ kind: 'assign', to: { person: 'u-ana' } });
    pick('Assign To', 'nobody');
    expect(latest.steps[0]).toEqual({ kind: 'assign', to: { nobody: true } });
    pickStep('add_label');
    fireEvent.change(screen.getByRole('combobox', { name: 'Label' }), {
      target: { value: 'urgent' },
    });
    expect(latest.steps[0]).toEqual({ kind: 'add_label', label: 'urgent' });
    pickStep('archive');
    expect(screen.getByText(/Archives the card/)).toBeTruthy();
    pickStep('create_card');
    fireEvent.change(screen.getByRole('textbox', { name: 'Title' }), {
      target: { value: 'Follow up' },
    });
    pick('Column', 'doing');
    fireEvent.click(screen.getByRole('button', { name: 'Labels' }));
    pick('Card Type', 'idea');
    expect(latest.steps[0]).toMatchObject({
      kind: 'create_card',
      type: 'idea',
      title: 'Follow up',
      status: 'doing',
      copy: ['labels'],
    });
    pick('Column', '');
    expect(latest.steps[0]).not.toHaveProperty('status');
  });

  it('writes a comment with values and previews it on a real card', () => {
    render(
      <Panel
        body={body({ steps: [{ kind: 'comment', text: 'Shipped by ' }] })}
        part={{ part: 'step', index: 0 }}
      />,
    );
    const area = screen.getByRole('textbox', { name: 'Comment' }) as HTMLTextAreaElement;
    area.setSelectionRange(11, 11);
    fireEvent.click(screen.getByRole('button', { name: 'Insert a Value into Comment' }));
    fireEvent.click(screen.getByRole('option', { name: /^Who Did It/ }));
    expect(latest.steps[0]).toEqual({ kind: 'comment', text: 'Shipped by {{person}}' });
    expect(document.querySelector('[data-step-preview]')!.textContent).toContain(
      'Shipped by Ana Costa',
    );
    expect(screen.getByText(/Preview on #48 Publish pricing page/)).toBeTruthy();
  });

  it('writes an email to a person, and marks the part a refusal names', () => {
    render(
      <Panel
        body={body({ steps: [{ kind: 'email', to: { assignee: true }, subject: '', body: '' }] })}
        part={{ part: 'step', index: 0 }}
        fault="steps.0.subject"
      />,
    );
    expect(screen.getByRole('textbox', { name: 'Subject' }).getAttribute('aria-invalid')).toBe(
      'true',
    );
    pick('To', 'trigger');
    fireEvent.change(screen.getByRole('textbox', { name: 'Message' }), {
      target: { value: 'Look' },
    });
    expect(latest.steps[0]).toEqual({
      kind: 'email',
      to: { trigger: true },
      subject: '',
      body: 'Look',
    });
  });

  it('opens an If / Else and an action inside it', () => {
    const ifBody = body({
      steps: [{ kind: 'if', conditions: [], then: [{ kind: 'flag' }], else: [] }],
    });
    render(<Panel body={ifBody} part={{ part: 'step', index: 0 }} />);
    expect(screen.getByText(/Its conditions decide/)).toBeTruthy();
    cleanup();
    render(<Panel body={ifBody} part={{ part: 'branch', step: 0, side: 'then', index: 0 }} />);
    pickStep('unflag');
    expect(latest.steps[0]).toMatchObject({ then: [{ kind: 'unflag' }] });
  });

  it('finds a refusal inside a part', () => {
    expect(faultWithin({ part: 'step', index: 2 }, 'steps.2.text')).toBe('text');
    expect(faultWithin({ part: 'step', index: 2 }, 'steps.2')).toBe('');
    expect(faultWithin({ part: 'step', index: 2 }, 'steps.3')).toBeNull();
    expect(faultWithin({ part: 'step', index: 2 }, null)).toBeNull();
  });
});
