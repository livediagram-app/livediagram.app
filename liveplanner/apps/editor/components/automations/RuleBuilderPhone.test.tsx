// @vitest-environment jsdom
// docs/specs/026-plan/automations.md "The rule builder on a phone": the rule drawer over the rules, its header, its
// pinned foot with Rule Details, the step drawer a pick opens and Done closes, and Discard Changes? before any way out
// of a changed rule. A wide screen keeps the builder in place of the list, no drawers.
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { PlanProvider, type PlanContextValue } from '@/components/plan/PlanContext';
import { AutomationsDialog } from './AutomationsDialog';
import type { AutomationsTarget } from './AutomationsContext';
import { forgetAutomations } from './use-automations';
import { ANA, outline, rule, run } from './test-fixtures';

const client = vi.hoisted(() => ({
  listAutomations: vi.fn(),
  createRule: vi.fn(),
  updateRule: vi.fn(),
  toggleRule: vi.fn(),
  duplicateRule: vi.fn(),
  deleteRule: vi.fn(),
  testRule: vi.fn(),
  runRule: vi.fn(),
  listRuns: vi.fn(),
}));
vi.mock('./automations-client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./automations-client')>()),
  ...client,
}));
vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
vi.mock('@/hooks/ui/useToast', () => ({
  useToast: () => ({ info: vi.fn(), success: vi.fn(), error: vi.fn(), warn: vi.fn() }),
}));

const SCOPE = { ownerId: 'o1', projectId: 'p1', shareCode: null };
const o = outline();
const plan = {
  types: o.types,
  statusNames: o.statuses,
  people: o.people,
  items: o.items,
  self: ANA,
  openItem: vi.fn(),
  planTabs: () => [],
} as unknown as PlanContextValue;

let shown: AutomationsTarget = { view: 'rules' };
function Harness({ initial }: { initial: AutomationsTarget }) {
  const [target, setTarget] = useState(initial);
  const go = (next: AutomationsTarget) => {
    shown = next;
    setTarget(next);
  };
  return (
    <PlanProvider value={plan}>
      <AutomationsDialog scope={SCOPE} target={target} onTarget={go} onClose={() => {}} />
    </PlanProvider>
  );
}

const stub = (wide: boolean) =>
  vi.stubGlobal(
    'matchMedia',
    (q: string) =>
      ({
        matches: wide ? q.includes('min-width') : false,
        media: q,
        addEventListener: () => {},
        removeEventListener: () => {},
      }) as unknown as MediaQueryList,
  );

beforeEach(() => {
  forgetAutomations();
  vi.clearAllMocks();
  client.listAutomations.mockResolvedValue({ rules: [rule()], runsToday: 1, runsPerDay: 1000 });
  client.listRuns.mockResolvedValue({ runs: [run()] });
  stub(false);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const drawer = () => document.querySelector('[data-rule-drawer]');

describe('the rule builder on a phone', () => {
  it('opens a rule in a drawer over the rules, with the phone header and the pinned foot', async () => {
    render(<Harness initial={{ view: 'rule', ruleId: 'r1' }} />);
    await screen.findByRole('textbox', { name: 'Rule name' });
    expect(drawer()).toBeTruthy();
    expect(screen.getByRole('dialog', { name: 'Edit Rule' })).toBeTruthy();
    // The rules stay behind it.
    expect(screen.getByRole('tab', { name: 'Rules · 1' })).toBeTruthy();
    const header = document.querySelector('[data-rule-header="phone"]')!;
    expect(header.querySelector('button')!.textContent).toContain('Automations');
    expect(screen.getByRole('switch', { name: 'On' })).toBeTruthy();
    expect(header.textContent).toContain('Edited by Ana Costa');
    // The name is a title on its own line that never breaks.
    const name = screen.getByRole('textbox', { name: 'Rule name' });
    expect(name.tagName).toBe('TEXTAREA');
    fireEvent.change(name, { target: { value: 'Two\nlines' } });
    expect(name).toHaveProperty('value', 'Two lines');
    const enter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    name.dispatchEvent(enter);
    expect(enter.defaultPrevented).toBe(true);
    // Rule Details pinned in the foot, closed, above Test on a Card and Save Rule.
    const foot = document.querySelector('[data-rule-foot]')!;
    expect(foot.querySelector('[data-rule-details="foot"]')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Rule Details' }).getAttribute('aria-expanded')).toBe(
      'false',
    );
    expect(foot.textContent).toContain('Test on a Card');
    expect(foot.textContent).toContain('Save Rule');
  });

  it('reads Saved for a saved rule with nothing changed', async () => {
    render(<Harness initial={{ view: 'rule', ruleId: 'r1' }} />);
    await screen.findByRole('textbox', { name: 'Rule name' });
    expect(screen.getByRole('status').textContent).toBe('Saved');
    expect(screen.queryByRole('button', { name: 'Save Rule' })).toBeNull();
  });

  it('shows a new rule Off and Not Saved', async () => {
    render(<Harness initial={{ view: 'rule', ruleId: null }} />);
    await screen.findByRole('textbox', { name: 'Rule name' });
    expect(screen.getByRole('dialog', { name: 'New Rule' })).toBeTruthy();
    expect(screen.getByText('Not Saved')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Save Rule' })).toBeTruthy();
  });

  it('opens a picked step in its own drawer, and Done closes it', async () => {
    render(<Harness initial={{ view: 'rule', ruleId: 'r1' }} />);
    await screen.findByRole('textbox', { name: 'Rule name' });
    // Nothing opens until a step is picked.
    expect(document.querySelector('[data-step-drawer]')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'When' }));
    expect(document.querySelector('[data-step-drawer]')).toBeTruthy();
    const when = screen.getByRole('dialog', { name: 'When' });
    // The drawer's own Done, at its foot (a column named Done may stand among its fields).
    fireEvent.click(within(when).getAllByRole('button', { name: 'Done' }).at(-1)!);
    expect(document.querySelector('[data-step-drawer]')).toBeNull();
    // An action too, closed by its close this time.
    fireEvent.click(screen.getAllByRole('button', { name: 'Then' })[0]!);
    expect(document.querySelector('[data-step-drawer]')).toBeTruthy();
    const step = document.querySelector('[data-step-drawer]')!.closest('[role="dialog"]')!;
    fireEvent.click(step.querySelector('button[aria-label="Close"]')!);
    expect(document.querySelector('[data-step-drawer]')).toBeNull();
  });

  it('asks Discard Changes? before Escape or Back leaves a changed rule, and stays open meanwhile', async () => {
    render(<Harness initial={{ view: 'rule', ruleId: 'r1' }} />);
    const name = await screen.findByRole('textbox', { name: 'Rule name' });
    fireEvent.change(name, { target: { value: 'Changed' } });
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.getByText('Discard Changes?')).toBeTruthy();
    expect(drawer()).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Keep Editing' }));
    expect(screen.getByRole('textbox', { name: 'Rule name' })).toHaveProperty('value', 'Changed');
    fireEvent.click(screen.getByRole('button', { name: /Automations/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Discard Changes' }));
    expect(drawer()).toBeNull();
    expect(shown).toEqual({ view: 'rules' });
  });

  it('goes back at once when nothing changed', async () => {
    render(<Harness initial={{ view: 'rule', ruleId: 'r1' }} />);
    await screen.findByRole('textbox', { name: 'Rule name' });
    await act(async () => {
      fireEvent.keyDown(document, { key: 'Escape' });
    });
    expect(screen.queryByText('Discard Changes?')).toBeNull();
    expect(shown).toEqual({ view: 'rules' });
  });
});

describe('the rule builder on a wide screen', () => {
  it('stands in place of the list, with no drawers', async () => {
    stub(true);
    render(<Harness initial={{ view: 'rule', ruleId: 'r1' }} />);
    await screen.findByRole('textbox', { name: 'Rule name' });
    expect(drawer()).toBeNull();
    expect(document.querySelector('[data-rule-header="phone"]')).toBeNull();
    expect(screen.queryByRole('tab', { name: 'Rules · 1' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'When' }));
    expect(document.querySelector('[data-step-drawer]')).toBeNull();
    expect(document.querySelector('[data-step-panel]')).toBeTruthy();
  });
});
