// @vitest-environment jsdom
// docs/specs/026-plan/automations.md "Triggers", "Conditions", "Actions", "Values": each step's panel, picking from
// the plan's own columns, types, fields and people, and the Preview on a real card.
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useState } from 'react';
import type { AutomationRuleBody } from '@liveplanner/items';
import { newRuleBody, type RulePart } from './rule-draft';
import { StepPanel, faultWithin } from './StepPanel';
import { outline } from './test-fixtures';

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
    pick('Trigger', 'form_response');
    pick('Form', 't-form');
    expect(latest.trigger).toEqual({ kind: 'form_response', formTab: 't-form' });
    pick('Form', '');
    pick('Trigger', 'card_moved');
    fireEvent.click(screen.getAllByRole('button', { name: 'Done' })[1]!);
    fireEvent.click(screen.getAllByRole('button', { name: 'To Do' })[0]!);
    expect(latest.trigger).toEqual({ kind: 'card_moved', to: ['done'], from: ['todo'] });
    pick('Trigger', 'field_changed');
    expect(latest.trigger.kind).toBe('field_changed');
    fireEvent.click(screen.getByRole('button', { name: 'Due Date' }));
    pick('Trigger', 'comment_added');
    expect(screen.getByText(/Automation’s own comments start nothing/)).toBeTruthy();
    pick('Trigger', 'manual');
    expect(screen.getByText(/listed under Run Rule/)).toBeTruthy();
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
    pick('Action', 'set_field');
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
    pick('Action', 'clear_field');
    pick('Field', 'labels');
    expect(latest.steps[0]).toEqual({ kind: 'clear_field', field: 'labels' });
    pick('Action', 'assign');
    pick('Assign To', 'person:u-ana');
    expect(latest.steps[0]).toEqual({ kind: 'assign', to: { person: 'u-ana' } });
    pick('Assign To', 'nobody');
    expect(latest.steps[0]).toEqual({ kind: 'assign', to: { nobody: true } });
    pick('Action', 'add_label');
    fireEvent.change(screen.getByRole('combobox', { name: 'Label' }), {
      target: { value: 'urgent' },
    });
    expect(latest.steps[0]).toEqual({ kind: 'add_label', label: 'urgent' });
    pick('Action', 'archive');
    expect(screen.getByText(/Archives the card/)).toBeTruthy();
    pick('Action', 'create_card');
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
    fireEvent.click(screen.getByRole('button', { name: 'Who Did It' }));
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
    pick('Action', 'unflag');
    expect(latest.steps[0]).toMatchObject({ then: [{ kind: 'unflag' }] });
  });

  it('finds a refusal inside a part', () => {
    expect(faultWithin({ part: 'step', index: 2 }, 'steps.2.text')).toBe('text');
    expect(faultWithin({ part: 'step', index: 2 }, 'steps.2')).toBe('');
    expect(faultWithin({ part: 'step', index: 2 }, 'steps.3')).toBeNull();
    expect(faultWithin({ part: 'step', index: 2 }, null)).toBeNull();
  });
});
