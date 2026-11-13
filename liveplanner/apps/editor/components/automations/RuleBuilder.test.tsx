// @vitest-environment jsdom
// docs/specs/026-plan/automations.md "The rule builder": the On / Off chip, a save that fails or names a taken name,
// Rule Details, Test on a Card's failures, Any Field…, and each kind's first form.
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ACTION_KINDS, CONDITION_KINDS, defaultAction, defaultCondition } from './step-defaults';
import { RuleBuilder } from './RuleBuilder';
import { AutomationRefusal } from './automations-client';
import { ValueTextField, ValueChipsText, insertValue } from './ValueInsert';
import { lastRunWords, meterWords, runWhen, runsWords, tookWords } from './run-words';
import { RunsMeter } from './RunsMeter';
import type { CustomFieldDef } from '@liveplanner/items';
import { ANA, NOW, outline, rule, run } from './test-fixtures';

const track = vi.hoisted(() => vi.fn());
vi.mock('@/lib/telemetry', () => ({ track }));
const toast = vi.hoisted(() => ({ info: vi.fn(), success: vi.fn(), error: vi.fn() }));
vi.mock('@/hooks/ui/useToast', () => ({ useToast: () => toast }));

const api = { save: vi.fn(), toggle: vi.fn(), test: vi.fn() };
function Builder({ saved = rule() as ReturnType<typeof rule> | null }) {
  return (
    <RuleBuilder
      rule={saved}
      initial={saved ?? rule()}
      outline={outline()}
      api={api}
      person="Ana Costa"
      now={NOW}
      phone
      onBack={() => {}}
      onSaved={() => {}}
      onDirty={() => {}}
      timeZone="Europe/London"
      scope={{ projectId: 'p1', shareCode: null }}
    />
  );
}

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

describe('RuleBuilder', () => {
  it('turns the saved rule on and off from its chip, and toasts a refusal', async () => {
    api.toggle.mockResolvedValueOnce(rule({ enabled: false }));
    render(<Builder />);
    fireEvent.click(screen.getByRole('switch', { name: 'On' }));
    await waitFor(() => expect(api.toggle).toHaveBeenCalledWith('r1', false));
    expect(track).toHaveBeenCalledWith('Plan', 'Toggled', 'AutomationOff');
    api.toggle.mockRejectedValueOnce(new Error('offline'));
    fireEvent.click(screen.getByRole('switch', { name: 'On' }));
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
  });

  it('shows a new rule Off, and says when a save fails or the name is taken', async () => {
    render(<Builder saved={null} />);
    expect(screen.getByText('Off')).toBeTruthy();
    expect(screen.getByText('Not Saved')).toBeTruthy();
    api.save.mockRejectedValueOnce(new Error('offline'));
    fireEvent.click(screen.getByRole('button', { name: 'Save Rule' }));
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('didn’t save')),
    );
    api.save.mockRejectedValueOnce(new AutomationRefusal(409, { error: 'automation_name_taken' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save Rule' }));
    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent',
      expect.stringContaining('Another rule'),
    );
    expect(screen.getByRole('textbox', { name: 'Rule name' }).getAttribute('aria-invalid')).toBe(
      'true',
    );
    api.save.mockRejectedValueOnce(new AutomationRefusal(409, { error: 'automation_rules_full' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save Rule' }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('50 rules'));
  });

  it('opens Rule Details to let a rule’s changes trigger others', () => {
    api.save.mockResolvedValue(rule({ chain: true }));
    render(<Builder />);
    fireEvent.click(screen.getByRole('button', { name: 'Rule Details' }));
    fireEvent.click(
      screen.getByRole('switch', { name: /Let this rule’s changes trigger other rules/ }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Save Rule' }));
    expect(api.save).toHaveBeenCalledWith('r1', expect.objectContaining({ chain: true }));
  });

  it('marks the step a test refused, and says when a test did not run', async () => {
    render(<Builder saved={rule({ steps: [{ kind: 'comment', text: '{{x}}' }] })} />);
    api.test.mockRejectedValueOnce(
      new AutomationRefusal(400, { error: 'automation_value_unknown', path: 'steps.0.text' }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Test on a Card' }));
    fireEvent.click(await screen.findByRole('button', { name: /Publish pricing page/ }));
    await waitFor(() => expect(document.querySelector('[data-fault]')).toBeTruthy());
    api.test.mockRejectedValueOnce(new Error('offline'));
    fireEvent.click(screen.getByRole('button', { name: 'Test on a Card' }));
    fireEvent.click(await screen.findByRole('button', { name: /Publish pricing page/ }));
    expect(await screen.findByText(/The test didn’t run/)).toBeTruthy();
    api.test.mockResolvedValueOnce({ run: run() });
    fireEvent.click(screen.getByRole('button', { name: 'Another Card' }));
    fireEvent.click(await screen.findByRole('button', { name: /Publish pricing page/ }));
    expect(await screen.findByText('Removed the label blocked')).toBeTruthy();
  });
});

describe('ValueTextField', () => {
  it('inserts a field by its name from Any Field…, and keeps one line one line', () => {
    const onChange = vi.fn();
    render(
      <ValueTextField
        label="Subject"
        value="Hi "
        multiline={false}
        onChange={onChange}
        fields={[{ id: 'f1', name: 'Completed On' }]}
      />,
    );
    (
      screen.getByRole('textbox', { name: 'Subject' }) as unknown as HTMLTextAreaElement
    ).setSelectionRange(3, 3);
    fireEvent.click(screen.getByRole('button', { name: 'Insert a Value into Subject' }));
    fireEvent.click(screen.getByRole('option', { name: /^Completed On/ }));
    expect(onChange).toHaveBeenLastCalledWith('Hi {{card.field.Completed On}}');
    fireEvent.change(screen.getByRole('textbox', { name: 'Subject' }), {
      target: { value: 'a\nb' },
    });
    expect(onChange).toHaveBeenLastCalledWith('a b');
    const enter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    screen.getByRole('textbox', { name: 'Subject' }).dispatchEvent(enter);
    expect(enter.defaultPrevented).toBe(true);
    expect(insertValue('ab', 1, 2, 'rule')).toEqual({ text: 'a{{rule}}', caret: 9 });
    render(<ValueChipsText text="By {{ person }}" />);
    expect(screen.getByText('person')).toBeTruthy();
  });
});

describe('the words', () => {
  it('reads runs, times and the meter', () => {
    expect(lastRunWords(null, NOW)).toBe('Never');
    expect(lastRunWords(NOW - 4 * 60_000, NOW)).toBe('4 min ago');
    expect(runsWords(1)).toBe('1 run');
    expect(runsWords(1200)).toBe('1,200 runs');
    expect(tookWords(38)).toBe('38 ms');
    expect(tookWords(1200)).toBe('1.2 s');
    expect(runWhen(NOW - 86_400_000, NOW)).toBe('Yesterday');
    expect(runWhen(NOW - 5 * 86_400_000, NOW)).toMatch(/Nov/);
    expect(meterWords(142, 1000)).toBe('142 of 1,000');
    render(<RunsMeter used={1000} max={1000} stacked />);
    render(<RunsMeter used={0} max={0} />);
    expect(screen.getAllByRole('meter')).toHaveLength(2);
  });

  it('starts every kind from the plan, and from nothing in an empty one', () => {
    const empty = { types: [], columns: [], labels: [], boards: [] };
    for (const k of ACTION_KINDS) {
      expect(defaultAction(k, outline()).kind).toBe(k);
      expect(defaultAction(k, empty).kind).toBe(k);
    }
    for (const k of CONDITION_KINDS) {
      expect(defaultCondition(k, outline()).kind).toBe(k);
      expect(defaultCondition(k, empty).kind).toBe(k);
    }
    expect(defaultCondition('saved_filter', outline())).toEqual({
      kind: 'saved_filter',
      tab: 't-board',
      filter: 'f1',
    });
  });

  it('starts Set Field on a fixed-value field on its first value, past Flagged, on a plan without Priority', () => {
    const typeOf = (custom: CustomFieldDef) => ({
      id: 't',
      label: 'T',
      newTitle: 'New',
      glyph: 'item' as const,
      color: '#000',
      fields: ['flagged', custom.id],
      custom: [custom],
    });
    const set = (custom: CustomFieldDef) =>
      defaultAction('set_field', outline({ types: [typeOf(custom)] }));
    expect(set({ id: 'owner', label: 'Owner', kind: 'person' })).toEqual({
      kind: 'set_field',
      field: 'owner',
      value: { text: ANA.id },
    });
    expect(set({ id: 'size', label: 'Size', kind: 'choice', options: ['S', 'M'] })).toEqual({
      kind: 'set_field',
      field: 'size',
      value: { text: 'S' },
    });
    expect(set({ id: 'done', label: 'Done', kind: 'checkbox' })).toEqual({
      kind: 'set_field',
      field: 'done',
      value: { text: 'true' },
    });
    expect(set({ id: 'note', label: 'Note', kind: 'text' })).toEqual({
      kind: 'set_field',
      field: 'note',
      value: { text: '' },
    });
  });
});
