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
import { standardColours } from '@liveplanner/project';
import { ANA, NOW, outline, rule, run } from './test-fixtures';

const track = vi.hoisted(() => vi.fn());
vi.mock('@/lib/telemetry', () => ({ track }));
const toast = vi.hoisted(() => ({ info: vi.fn(), success: vi.fn(), error: vi.fn() }));
vi.mock('@/hooks/ui/useToast', () => ({ useToast: () => toast }));

const api = { save: vi.fn(), toggle: vi.fn(), test: vi.fn() };
type Saved = ReturnType<typeof rule>;
function Builder({
  saved = rule(),
  initial = saved ?? rule(),
  phone = true,
}: {
  saved?: Saved | null;
  initial?: Saved;
  phone?: boolean;
}) {
  return (
    <RuleBuilder
      rule={saved}
      initial={initial}
      outline={outline()}
      api={api}
      person="Ana Costa"
      now={NOW}
      phone={phone}
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
    fireEvent.click(screen.getByRole('switch', { name: 'Rule On' }));
    await waitFor(() => expect(api.toggle).toHaveBeenCalledWith('r1', false));
    expect(track).toHaveBeenCalledWith('Plan', 'Toggled', 'AutomationOff');
    api.toggle.mockRejectedValueOnce(new Error('offline'));
    fireEvent.click(screen.getByRole('switch', { name: 'Rule On' }));
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

  // busy-buttons.md: a focused Save Rule that turned `disabled` dropped the keyboard to the dialog, away from the
  // refusal beside it or the toast.
  it('keeps the keyboard on Save Rule while it saves and once saved, on a wide screen', async () => {
    let settle: (r: Saved) => void = () => {};
    api.save.mockReturnValueOnce(new Promise<Saved>((r) => (settle = r)));
    render(<Builder phone={false} />);
    fireEvent.change(screen.getByRole('textbox', { name: 'Rule name' }), {
      target: { value: 'Renamed' },
    });
    const save = screen.getByRole('button', { name: 'Save Rule' });
    save.focus();
    fireEvent.click(save);
    const saving = screen.getByRole('button', { name: 'Saving…' });
    expect(saving).toBe(save);
    expect(saving.hasAttribute('disabled')).toBe(false);
    expect(saving.getAttribute('aria-busy')).toBe('true');
    expect(document.activeElement).toBe(saving);
    settle(rule({ name: 'Renamed' }));
    await waitFor(() => expect(toast.success).toHaveBeenCalled());
    // Saved with nothing changed: unavailable, still focused, and a press does nothing.
    const done = screen.getByRole('button', { name: 'Save Rule' });
    expect(done.getAttribute('aria-disabled')).toBe('true');
    expect(done.hasAttribute('disabled')).toBe(false);
    expect(document.activeElement).toBe(done);
    fireEvent.click(done);
    expect(api.save).toHaveBeenCalledTimes(1);
  });

  it('hands the keyboard to Saved when a save on a phone swaps the button for it', async () => {
    api.save.mockResolvedValueOnce(rule({ name: 'Renamed' }));
    render(<Builder />);
    fireEvent.change(screen.getByRole('textbox', { name: 'Rule name' }), {
      target: { value: 'Renamed' },
    });
    const save = screen.getByRole('button', { name: 'Save Rule' });
    save.focus();
    fireEvent.click(save);
    // Focus fell to the page with the old button; Saved, taking its place, takes it.
    const saved = await screen.findByRole('status');
    expect(saved.textContent).toBe('Saved');
    expect(document.activeElement).toBe(saved);
  });

  it('names the rule’s switch for what it turns on, not for its state', () => {
    render(<Builder saved={rule({ enabled: false })} phone={false} />);
    const off = screen.getByRole('switch', { name: 'Rule On' });
    expect(off.getAttribute('aria-checked')).toBe('false');
  });

  it('says a step’s refusal in words, without the path the api names', async () => {
    render(<Builder saved={null} initial={rule({ steps: [{ kind: 'comment', text: '' }] })} />);
    api.save.mockRejectedValueOnce(
      new AutomationRefusal(400, {
        error: 'automation_invalid',
        path: 'steps.0.text',
        message: 'steps.0.text must be text of 1 to 2000 characters',
      }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Save Rule' }));
    expect(await screen.findAllByText('Must be text of 1 to 2000 characters.')).not.toHaveLength(0);
    expect(screen.queryByText(/steps\.0/)).toBeNull();
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

  it('rings the card in focus in Test on a Card, not just a faint wash', async () => {
    render(<Builder />);
    fireEvent.click(screen.getByRole('button', { name: 'Test on a Card' }));
    const card = await screen.findByRole('button', { name: /Publish pricing page/ });
    // Slate 100 on white alone was about 1.1:1, short of the 3:1 a focus indicator needs.
    expect(card.className).toContain('focus-visible:ring-2');
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

  it('starts Set Colour on the standard Red, so the field and the picker name it alike', () => {
    const start = defaultAction('set_colour', outline());
    if (start.kind !== 'set_colour' || !start.colour) throw new Error('no colour');
    const red = standardColours('strong', 'light').find((c) => c.name === 'red')!;
    expect(start.colour).toBe(red.hex.toLowerCase());
    // The old start, an earlier Plan red, showed in the picker as a custom "#dc2626" swatch.
    expect(start.colour).not.toBe('#dc2626');
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
