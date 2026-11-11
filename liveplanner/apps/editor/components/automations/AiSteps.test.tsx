// @vitest-environment jsdom
// docs/specs/026-plan/automations.md "AI actions": the AI group in Add Action, each AI action's card and panel with its
// "Uses AI" line, its first form, and its line in a run with the sparkle.
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import type { AutomationAi, AutomationRuleBody, ItemTypeDef } from '@liveplanner/items';
import { addAction, canAddAi, canDuplicate, newRuleBody } from './rule-draft';
import { RuleSteps, type StepsActions } from './RuleSteps';
import { RunSteps } from './RunSteps';
import { StepPanel } from './StepPanel';
import { ADD_NAMES, defaultStep, isAiKind } from './step-defaults';
import { summaryFields } from './step-panels/AiStepPanel';
import { outline } from './test-fixtures';

afterEach(cleanup);

const summarise: AutomationAi = { kind: 'ai', task: 'summarise' };
const body = (over: Partial<AutomationRuleBody> = {}): AutomationRuleBody => ({
  ...newRuleBody('R', 'UTC'),
  ...over,
});
const actions = (): StepsActions => ({
  select: vi.fn(),
  edit: vi.fn(),
  addCondition: vi.fn(),
  addAction: vi.fn(),
  addIfElse: vi.fn(),
  addBranch: vi.fn(),
});
const NOTES: ItemTypeDef = {
  id: 'story',
  label: 'Story',
  newTitle: 'New story',
  glyph: 'task',
  color: '#16a34a',
  fields: ['title', 'status', 'f-notes', 'f-line', 'f-n'],
  custom: [
    { id: 'f-notes', label: 'Notes', kind: 'longtext' },
    { id: 'f-line', label: 'Line', kind: 'text' },
    { id: 'f-n', label: 'Count', kind: 'number' },
  ],
};
const withNotes = () => {
  const o = outline();
  return { ...o, types: [...o.types, NOTES] };
};

describe('Add Action', () => {
  it('offers the AI actions under their own heading at the top level, three a rule', () => {
    const a = actions();
    render(
      <RuleSteps body={body()} outline={outline()} selected={null} fault={null} actions={a} />,
    );
    fireEvent.click(screen.getAllByRole('button', { name: 'Add Action' }).at(-1)!);
    expect(screen.getByText('100 a day per plan')).toBeTruthy();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Triage' }));
    expect(a.addAction).toHaveBeenCalledWith('ai_triage');
    cleanup();
    render(
      <RuleSteps
        body={body({ steps: [summarise, summarise, summarise] })}
        outline={outline()}
        selected={null}
        fault={null}
        actions={actions()}
      />,
    );
    fireEvent.click(screen.getAllByRole('button', { name: 'Add Action' }).at(-1)!);
    expect(screen.queryByRole('menuitem', { name: 'Summarise Card' })).toBeNull();
  });

  it('starts each AI action in its first form, at the top level only', () => {
    expect(defaultStep('ai_summarise', outline())).toEqual(summarise);
    expect(defaultStep('ai_card_type', outline())).toEqual({ kind: 'ai', task: 'card_type', set: true });
    expect(defaultStep('ai_triage', outline())).toEqual({
      kind: 'ai',
      task: 'triage',
      priority: true,
      labels: true,
    });
    expect(isAiKind('move')).toBe(false);
    expect(ADD_NAMES.ai_card_type).toBe('Suggest Card Type');
    const holder = body({
      steps: [{ kind: 'if', conditions: [], then: [], else: [] }],
    });
    expect(addAction(holder, summarise, { step: 0, side: 'then' }).body.steps).toHaveLength(2);
    const three = body({ steps: [summarise, summarise, summarise] });
    expect(canAddAi(three)).toBe(false);
    expect(canDuplicate(three, { part: 'step', index: 0 })).toBe(false);
    expect(canDuplicate(body({ steps: [summarise] }), { part: 'step', index: 0 })).toBe(true);
  });

  it('draws an AI action’s card with its chip and what it counts toward', () => {
    render(
      <RuleSteps
        body={body({ steps: [{ kind: 'ai', task: 'card_type', set: true }] })}
        outline={outline()}
        selected={null}
        fault={null}
        actions={actions()}
      />,
    );
    expect(screen.getByText('Suggest and Set Card Type')).toBeTruthy();
    expect(screen.getByText('Uses AI: counts toward 100 a day')).toBeTruthy();
  });
});

let latest: AutomationRuleBody;
function Panel({ start, o = withNotes() }: { start: AutomationAi; o?: ReturnType<typeof outline> }) {
  const [b, setB] = useState(body({ steps: [start] }));
  return (
    <StepPanel
      body={b}
      part={{ part: 'step', index: 0 }}
      onChange={(next) => {
        latest = next;
        setB(next);
      }}
      outline={o}
      faultPath={null}
      person="Ana Costa"
      now={Date.UTC(2026, 10, 11)}
      timeZone="Europe/London"
    />
  );
}
const pick = (name: string, value: string) =>
  fireEvent.change(screen.getByRole('combobox', { name }), { target: { value } });

describe('the AI panels', () => {
  it('writes a summary to a comment or one of the plan’s text fields', () => {
    expect(summaryFields(withNotes()).map((f) => f.name)).toEqual(['Notes', 'Line']);
    render(<Panel start={summarise} />);
    expect(screen.getByText(/Uses AI: counts toward this plan’s 100 AI steps a day/)).toBeTruthy();
    pick('Where It Goes', 'f-notes');
    expect(latest.steps[0]).toEqual({ kind: 'ai', task: 'summarise', field: 'f-notes' });
    pick('Where It Goes', '');
    expect(latest.steps[0]).toEqual(summarise);
  });

  it('keeps a field the plan lost, named as gone', () => {
    render(<Panel start={{ kind: 'ai', task: 'summarise', field: 'f-gone' }} />);
    expect(screen.getByRole('option', { name: 'f-gone (gone)' })).toBeTruthy();
  });

  it('sets the suggested type or comments it', () => {
    render(<Panel start={{ kind: 'ai', task: 'card_type', set: false }} />);
    pick('With the Suggestion', 'set');
    expect(latest.steps[0]).toEqual({ kind: 'ai', task: 'card_type', set: true });
  });

  it('triages the priority, the labels or both, never neither', () => {
    render(<Panel start={{ kind: 'ai', task: 'triage', priority: true, labels: true }} />);
    expect(screen.getByText(/only from those this plan/)).toBeTruthy();
    const sets = within(screen.getByRole('group', { name: 'What It Sets' }));
    fireEvent.click(sets.getByRole('button', { name: /Priority/ }));
    expect(latest.steps[0]).toMatchObject({ priority: false, labels: true });
    fireEvent.click(sets.getByRole('button', { name: /Labels/ }));
    expect(latest.steps[0]).toMatchObject({ priority: false, labels: true });
    expect(screen.getByText(/only from those this plan/)).toBeTruthy();
    fireEvent.click(sets.getByRole('button', { name: /Priority/ }));
    fireEvent.click(sets.getByRole('button', { name: /Labels/ }));
    expect(latest.steps[0]).toMatchObject({ priority: true, labels: false });
    expect(screen.queryByText(/only from those this plan/)).toBeNull();
  });
});

describe('a run', () => {
  it('marks an AI step’s line with the sparkle, said Generated by AI', () => {
    render(
      <RunSteps
        steps={[
          { kind: 'trigger', text: 'moved the card to Done' },
          { kind: 'action', ok: true, text: 'Summarised the card into a comment', ai: true },
          { kind: 'action', ok: true, text: 'Flag' },
        ]}
      />,
    );
    expect(screen.getAllByText(/Generated by AI/)).toHaveLength(1);
  });
});
