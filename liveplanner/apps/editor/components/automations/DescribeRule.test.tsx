// @vitest-environment jsdom
// docs/specs/026-plan/automations.md "Describe a Rule": New Rule's row and the empty state's button, the dialog (the
// examples, the count, Ctrl / ⌘ Enter, busy while drafting, Cancel), a draft opening the builder unsaved and off with
// Drafted by AI and its picks marked, a refusal said in the api's fixed words, and Discard Changes? on leaving.
import './test-kit';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import type { AutomationDraftResponse } from '@liveplanner/api-schema';
import { PlanProvider, type PlanContextValue } from '@/components/plan/PlanContext';
import { AutomationsDialog } from '@liveworkspace/automations-ui/AutomationsDialog';
import type { AutomationsTarget } from '@liveworkspace/automations-ui/AutomationsContext';
import { AutomationRefusal } from './automations-client';
import { DESCRIBE_FAILED } from '@liveworkspace/automations-ui/DescribeRuleDialog';
import { DESCRIBE_EXAMPLES } from './plan-words';
import { forgetAutomations } from './use-automations';
import { ANA, outline, rule } from './test-fixtures';

// The source line is the workbench's (its own tests: packages/workbench WorkbenchAiSource.test.tsx); here, what the
// dialog hands it: the allowance and the last ask's key failure.
vi.mock('@liveworkspace/workbench/components/ai/WorkbenchAiSource', () => ({
  WorkbenchAiSource: ({
    allowance,
    failure,
    id,
  }: {
    allowance?: string;
    failure?: { kind: string } | null;
    id?: string;
  }) => (
    <p id={id} data-ai-source-stub={failure ? failure.kind : 'none'}>
      {allowance}
    </p>
  ),
}));

const client = vi.hoisted(() => ({
  listAutomations: vi.fn(),
  draftRule: vi.fn(),
  listRuns: vi.fn(),
}));
vi.mock('./automations-client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./automations-client')>()),
  ...client,
}));
const track = vi.hoisted(() => vi.fn());
vi.mock('@/lib/telemetry', () => ({ track }));
vi.mock('@liveworkspace/workbench/hooks/ui/useToast', () => ({
  useToast: () => ({ info: vi.fn(), success: vi.fn(), error: vi.fn(), warn: vi.fn() }),
}));
vi.mock('@liveworkspace/workbench/lib/index-client', () => ({
  indexClient: { listWebhooks: () => Promise.resolve({ webhooks: [] }) },
}));

const SCOPE = { ownerId: 'o1', itemId: 'p1', shareCode: null };
const o = outline();
const plan = {
  types: o.types,
  statusNames: o.statuses,
  statusPhases: o.phases,
  people: o.people,
  items: o.items,
  self: ANA,
  openItem: vi.fn(),
  planTabs: () => [],
} as unknown as PlanContextValue;

const DRAFT: AutomationDraftResponse = {
  rule: {
    name: 'Ship to Slack',
    trigger: { kind: 'card_moved', to: ['done'] },
    conditions: [],
    steps: [
      { kind: 'add_label', label: 'shipped' },
      { kind: 'notify', via: 'slack', webhook: '', text: 'Shipped {{card.title}}' },
    ],
    chain: false,
    timeZone: 'Europe/London',
  },
  picks: [{ path: 'steps.1', pick: 'webhook' }],
};

function Harness({ initial = { view: 'rules' } }: { initial?: AutomationsTarget }) {
  const [target, setTarget] = useState(initial);
  return (
    <PlanProvider value={plan}>
      <div data-view={target.view} />
      <AutomationsDialog
        scope={SCOPE}
        target={target}
        onTarget={setTarget}
        onClose={() => {}}
        signedIn
      />
    </PlanProvider>
  );
}

const box = () => screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Describe the rule' });
const draftButton = () => screen.getByRole('button', { name: /Draft Rule|Drafting/ });
const openFromMenu = async () => {
  fireEvent.click(await screen.findByRole('button', { name: /New Rule/ }));
  fireEvent.click(screen.getByRole('menuitem', { name: 'Describe a Rule' }));
};

beforeEach(() => {
  forgetAutomations();
  vi.clearAllMocks();
  client.listAutomations.mockResolvedValue({ rules: [rule()], runsToday: 0, runsPerDay: 1000 });
  client.listRuns.mockResolvedValue({ runs: [] });
});
afterEach(cleanup);

describe('where it starts', () => {
  it('is a row of New Rule’s menu', async () => {
    render(<Harness />);
    await openFromMenu();
    expect(screen.getByRole('dialog', { name: 'Describe a Rule' })).toBeTruthy();
    expect(track).toHaveBeenCalledWith('UI', 'Opened', 'AutomationDescribe');
    expect(document.activeElement).toBe(box());
  });

  it('rises as a sheet on a phone, with its grab handle', async () => {
    render(<Harness />);
    await openFromMenu();
    const dialog = screen.getByRole('dialog', { name: 'Describe a Rule' });
    expect(dialog.querySelector('[data-sheet-handle]')).toBeTruthy();
  });

  it('is a button of the empty Rules list', async () => {
    client.listAutomations.mockResolvedValue({ rules: [], runsToday: 0, runsPerDay: 1000 });
    render(<Harness />);
    await screen.findByText('No rules yet');
    fireEvent.click(screen.getByRole('button', { name: 'Describe a Rule' }));
    expect(screen.getByRole('dialog', { name: 'Describe a Rule' })).toBeTruthy();
  });
});

describe('the dialog', () => {
  it('fills the box from an example, counts it, and drafts only with words', async () => {
    render(<Harness />);
    await openFromMenu();
    expect(draftButton()).toHaveProperty('disabled', true);
    expect(screen.getByText('0 / 500')).toBeTruthy();
    // Try an Example sits above the box (owner, 2026-11-22), and an example puts the cursor in it.
    const examples = screen.getByRole('group', { name: 'Try an Example' });
    expect(examples.compareDocumentPosition(box()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: DESCRIBE_EXAMPLES[2]!.label }));
    expect(box().value).toBe(DESCRIBE_EXAMPLES[2]!.text);
    expect(document.activeElement).toBe(box());
    expect(screen.getByText(`${DESCRIBE_EXAMPLES[2]!.text.length} / 500`)).toBeTruthy();
    expect(draftButton()).toHaveProperty('disabled', false);
    expect(screen.getByText(/Counts toward this plan’s 100 AI steps a day/)).toBeTruthy();
    expect(box().getAttribute('aria-describedby')).toBe(
      document.querySelector('[data-ai-source-stub]')!.id,
    );
  });

  it('hands a failed key to the source line, and clears it on the next ask', async () => {
    client.draftRule.mockRejectedValueOnce(
      new AutomationRefusal(422, {
        error: 'ai_key_failed',
        message: 'Anthropic did not accept the key.',
        aiKey: { source: 'account', provider: 'anthropic', kind: 'bad-key' },
      }),
    );
    client.draftRule.mockReturnValueOnce(new Promise(() => {}));
    render(<Harness />);
    await openFromMenu();
    fireEvent.change(box(), { target: { value: 'Flag overdue cards' } });
    fireEvent.click(draftButton());
    expect((await screen.findByRole('alert')).textContent).toBe(
      'Anthropic did not accept the key.',
    );
    const line = () => document.querySelector('[data-ai-source-stub]')!;
    expect(line().getAttribute('data-ai-source-stub')).toBe('bad-key');
    fireEvent.click(draftButton());
    expect(line().getAttribute('data-ai-source-stub')).toBe('none');
  });

  it('opens the draft in the builder, unsaved, off and marked Drafted by AI', async () => {
    client.draftRule.mockResolvedValue(DRAFT);
    render(<Harness />);
    await openFromMenu();
    fireEvent.change(box(), { target: { value: '  Post shipped cards to Slack  ' } });
    fireEvent.keyDown(box(), { key: 'Enter', metaKey: true });
    await waitFor(() =>
      expect(client.draftRule).toHaveBeenCalledWith(
        SCOPE,
        'Post shipped cards to Slack',
        expect.any(String),
      ),
    );
    expect(await screen.findByRole('textbox', { name: 'Rule name' })).toHaveProperty(
      'value',
      'Ship to Slack',
    );
    expect(screen.queryByRole('dialog', { name: 'Describe a Rule' })).toBeNull();
    expect(document.querySelector('[data-drafted-note]')!.textContent).toContain('Drafted by AI.');
    expect(screen.queryByRole('switch', { name: /On|Off/ })).toBeNull();
    const marked = [...document.querySelectorAll('[data-pick]')].map((c) => c.textContent);
    expect(marked.some((t) => t?.includes('Pick a connection'))).toBe(true);
    expect(track).toHaveBeenCalledWith('Plan', 'Created', 'AutomationDraft');
  });

  it('asks Discard Changes? on leaving a draft', async () => {
    client.draftRule.mockResolvedValue(DRAFT);
    render(<Harness />);
    await openFromMenu();
    fireEvent.change(box(), { target: { value: 'Post shipped cards to Slack' } });
    fireEvent.click(draftButton());
    await screen.findByRole('textbox', { name: 'Rule name' });
    fireEvent.click(screen.getByRole('button', { name: 'Automations' }));
    expect(await screen.findByText('Discard Changes?')).toBeTruthy();
  });

  it('is busy while it drafts, and Cancel drops a late answer', async () => {
    let answer: (d: AutomationDraftResponse) => void = () => {};
    client.draftRule.mockReturnValue(new Promise((r) => (answer = r)));
    render(<Harness />);
    await openFromMenu();
    fireEvent.change(box(), { target: { value: 'Flag overdue cards' } });
    fireEvent.click(draftButton());
    await waitFor(() => expect(draftButton().getAttribute('aria-busy')).toBe('true'));
    expect(draftButton().textContent).toContain('Drafting…');
    expect(box().readOnly).toBe(true);
    // A second press while busy asks nothing more.
    fireEvent.keyDown(box(), { key: 'Enter', ctrlKey: true });
    expect(client.draftRule).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog', { name: 'Describe a Rule' })).toBeNull();
    await act(async () => answer(DRAFT));
    expect(screen.queryByRole('textbox', { name: 'Rule name' })).toBeNull();
  });

  it('says a refusal in the api’s words and keeps the text to change', async () => {
    client.draftRule.mockRejectedValue(
      new AutomationRefusal(422, {
        error: 'automation_draft_off_topic',
        message: 'That doesn’t read as a rule for this plan.',
      }),
    );
    render(<Harness />);
    await openFromMenu();
    fireEvent.change(box(), { target: { value: 'Tell me a joke' } });
    fireEvent.click(draftButton());
    expect((await screen.findByRole('alert')).textContent).toBe(
      'That doesn’t read as a rule for this plan.',
    );
    expect(box().value).toBe('Tell me a joke');
    expect(box().getAttribute('aria-invalid')).toBe('true');
    // Typing clears it.
    fireEvent.change(box(), { target: { value: 'Flag overdue cards' } });
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('says a failed call in its own words, never the error’s', async () => {
    client.draftRule.mockRejectedValue(new Error('TypeError: fetch failed at …'));
    render(<Harness />);
    await openFromMenu();
    fireEvent.change(box(), { target: { value: 'Flag overdue cards' } });
    fireEvent.click(draftButton());
    expect((await screen.findByRole('alert')).textContent).toBe(DESCRIBE_FAILED);
  });
});
