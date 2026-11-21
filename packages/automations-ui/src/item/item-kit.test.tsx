// @vitest-environment jsdom
// The item kit on the screen (blueprint item-ui.md "Tests"): a kit built from a small registry (the kinds every app
// has, one trigger and one action of the app's own) draws the screen, words each rule, builds and saves a rule of
// every shared trigger and step (each body read as the api reads it), tests and runs a rule on a tab, shows a run's
// tab, says what a rule needs, and offers {{summary}} only after a Summarise step.
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { useMemo, useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readItemRule, type ItemRuleBody } from '@liveworkspace/automations/item';
import { AutomationsContext, type AutomationsTarget } from '../AutomationsContext';
import { AutomationsDialog } from '../AutomationsDialog';
import { AutomationRefusal } from '../automations-client';
import { AutomationsKitProvider } from '../kit-context';
import { forgetAutomations } from '../use-automations';
import type { ItemListedRule } from './client';
import { defineItemAutomationsKit } from './define-kit';
import { actionKeysOf } from './rule-reads';
import {
  ITEM,
  KINDS,
  SCOPE,
  itemClient,
  itemKit,
  itemRule,
  itemRun,
  openTab,
  refusedBodies,
  type ItemFakeClient,
  type ItemFakes,
} from './test/item-fixtures';
import type { ItemAutomationsKitInput, ItemView } from './types';

const toast = vi.hoisted(() => ({ info: vi.fn(), success: vi.fn(), error: vi.fn() }));
vi.mock('@liveworkspace/workbench/hooks/ui/useToast', () => ({ useToast: () => toast }));
vi.mock('@liveworkspace/settings-ui/connections', () => ({
  Connections: () => <div data-testid="connections" />,
}));

let fakes: ItemFakes;
const onClose = vi.fn();

function Screen({
  client,
  initial = { view: 'rules' },
  over,
  item,
}: {
  client: ItemFakeClient;
  initial?: AutomationsTarget;
  over?: Partial<ItemAutomationsKitInput>;
  item?: ItemView;
}) {
  const [made] = useState(() => (fakes = itemKit(client, over, item)));
  const [target, setTarget] = useState(initial);
  const access = useMemo(() => ({ scope: SCOPE, plumbing: made.plumbing, open: () => {} }), [made]);
  return (
    <AutomationsContext.Provider value={access}>
      <AutomationsKitProvider kit={made.kit}>
        <AutomationsDialog
          scope={SCOPE}
          target={target}
          onTarget={setTarget}
          onClose={onClose}
          signedIn
        />
      </AutomationsKitProvider>
    </AutomationsContext.Provider>
  );
}

const cards = () => [...document.querySelectorAll<HTMLElement>('[data-step-card]')];
const tile = (key: string) => document.querySelector<HTMLElement>(`[data-picker-tile="${key}"]`)!;
const row = (id: string) => document.querySelector<HTMLElement>(`[data-rule-row="${id}"]`)!;
const sentenceOf = (id: string) => row(id).querySelector('[data-rule-sentence]')!.textContent;

const wide = () =>
  vi.stubGlobal(
    'matchMedia',
    (query: string) =>
      ({
        matches: query.includes('min-width'),
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
      }) as unknown as MediaQueryList,
  );

/** A new blank rule, open in the builder (from the builder, by way of the list). */
async function blankRule() {
  const back = screen.queryByRole('navigation', { name: 'Breadcrumb' });
  if (back) fireEvent.click(within(back).getByRole('button', { name: 'Automations' }));
  // The header's New Rule menu, not a rule that happens to be named New Rule.
  const opener = screen
    .getAllByRole('button', { name: /New Rule/ })
    .find((b) => b.getAttribute('aria-haspopup') === 'menu' && !b.getAttribute('aria-label'))!;
  fireEvent.click(opener);
  fireEvent.click(screen.getByRole('menuitem', { name: 'Blank Rule' }));
  return screen.findByRole<HTMLInputElement>('textbox', { name: 'Rule name' });
}

function addAction(key: string) {
  fireEvent.click(screen.getByRole('button', { name: /Add Action/ }));
  fireEvent.click(tile(key));
}

async function save(client: ItemFakeClient): Promise<ItemRuleBody> {
  const before = client.create.mock.calls.length;
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Save Rule' }));
  });
  expect(client.create).toHaveBeenCalledTimes(before + 1);
  return client.create.mock.calls[before]![1] as ItemRuleBody;
}

beforeEach(() => {
  forgetAutomations();
  vi.clearAllMocks();
  refusedBodies.length = 0;
  wide();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('an item’s screen', () => {
  it('lists the rules in the registry’s words, under the item’s own line', async () => {
    render(<Screen client={itemClient()} />);
    expect(await screen.findByText('Nightly Snapshot')).toBeTruthy();
    expect(screen.getByText(/^Rules this document runs on its own/)).toBeTruthy();
    expect(sentenceOf('r1')).toBe(
      'WhenEdited, Then Quiet for 30 MinutesonRoadmapthenTake Snapshot “Nightly”',
    );
    // All Triggers lists the registry's kinds, group by group, the app's own among them.
    const options = within(screen.getByRole('combobox', { name: 'Trigger' }))
      .getAllByRole('option')
      .map((o) => o.textContent);
    expect(options.slice(0, 5)).toEqual([
      'All Triggers',
      'Tab Added',
      'Tab Removed',
      'Edited, Then Quiet',
      'Snapshot Taken',
    ]);
    expect(options).toContain('Poll Ended');
    expect(options.at(-1)).toBe('Incoming Webhook');
    // Nothing names a snapshot or a connection: neither list is read.
    expect(fakes.snapshots).not.toHaveBeenCalled();
    expect(fakes.listWebhooks).not.toHaveBeenCalled();
  });

  it('says what a rule can do here when there are none, and draws each template from its rule', async () => {
    render(<Screen client={itemClient([])} />);
    expect(
      await screen.findByText(
        'A rule watches this document and does the routine steps for you. Snapshot it every Friday, or tell Slack when it changes. Start from one below or build your own.',
      ),
    ).toBeTruthy();
    expect(screen.getByText('No rules yet')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'How Rules Work' })).toBeTruthy();
    // A template's picture: its trigger's half, then its last step's, the app's own vignette where the kind is its.
    const reset = document.querySelector('[data-template="reset-nightly"]')!;
    expect(reset.querySelectorAll('[data-template-half]')).toHaveLength(2);
    expect(reset.querySelector('[data-template-half="step"]')!.className).toContain('ats-late');
    const poll = document.querySelector('[data-template="poll-to-box"]')!;
    expect(
      poll.querySelector('[data-template-half="trigger"] [data-own-scene="poll_ended"]'),
    ).toBeTruthy();
    expect(
      poll.querySelector('[data-template-half="step"] [data-own-scene="clear_box"]'),
    ).toBeTruthy();
    fireEvent.click(reset);
    expect(await screen.findByRole('textbox', { name: 'Rule name' })).toHaveProperty(
      'value',
      'Reset Every Night',
    );
    expect(document.querySelector('[data-pick]')!.textContent).toContain('Pick a snapshot');
  });

  it('draws a template the app drew by hand, in the colour it named', async () => {
    render(
      <Screen
        client={itemClient([])}
        over={{
          templates: {
            list: fakes.input.templates.list,
            categories: fakes.input.templates.categories,
            tones: { 'reset-nightly': 'red' },
            scenes: { 'reset-nightly': () => <span data-hand-drawn="" /> },
          },
        }}
      />,
    );
    await screen.findByText('No rules yet');
    const reset = document.querySelector('[data-template="reset-nightly"]')!;
    expect(reset.querySelector('[data-hand-drawn]')).toBeTruthy();
    expect(reset.querySelector('[data-template-pair]')).toBeNull();
    expect(reset.innerHTML).toContain('from-red-50');
  });
});

describe('building a rule', () => {
  it('saves a rule of every trigger the registry holds, each as the api reads it', async () => {
    const client = itemClient();
    render(<Screen client={client} />);
    await screen.findByText('Nightly Snapshot');
    for (const def of KINDS.triggers) {
      await blankRule();
      // A new rule starts on Edited, Then Quiet.
      expect(cards()[0]!.textContent).toContain('Edited, Then Quiet for 30 Minutes');
      fireEvent.click(document.querySelector('[data-change-step]')!);
      fireEvent.click(tile(def.kind));
      // Every trigger's panel names it and says something: fields, or when it starts.
      const panel = document.querySelector('[data-step-panel]')!;
      expect(panel.textContent, def.kind).toContain(def.name);
      expect(panel.textContent.length, def.kind).toBeGreaterThan(def.name.length + 20);
      addAction('take_snapshot');
      const body = await save(client);
      expect(body.trigger.kind).toBe(def.kind);
      expect(readItemRule(body, KINDS), def.kind).toHaveProperty('body');
    }
    expect(refusedBodies).toEqual([]);
    expect(client.create).toHaveBeenCalledTimes(KINDS.triggers.length);
  }, 60_000);

  it('saves a rule of every step, each as the api reads it', async () => {
    const client = itemClient();
    render(<Screen client={client} />);
    await screen.findByText('Nightly Snapshot');
    const kinds: string[] = [];
    for (const key of actionKeysOf(KINDS)) {
      await blankRule();
      addAction(key);
      const panel = () => document.querySelector<HTMLElement>('[data-step-panel]')!;
      if (key === 'revert_snapshot') {
        // The snapshots are read as the panel shows, then one is picked by name.
        const select = await within(panel()).findByRole<HTMLSelectElement>('combobox', {
          name: 'Snapshot',
        });
        await waitFor(() => expect(select.disabled).toBe(false));
        fireEvent.change(select, { target: { value: 's1' } });
      }
      if (key.startsWith('notify_')) {
        const select = within(panel()).getByRole<HTMLSelectElement>('combobox', {
          name: 'Connection',
        });
        await waitFor(() => expect(select.disabled).toBe(false));
        fireEvent.change(select, {
          target: { value: select.options[select.options.length - 1]!.value },
        });
      }
      const body = await save(client);
      expect(readItemRule(body, KINDS), key).toHaveProperty('body');
      kinds.push(body.steps[0]!.kind);
    }
    expect(refusedBodies).toEqual([]);
    expect(kinds).toEqual([
      'take_snapshot',
      'revert_snapshot',
      'add_tab',
      'clear_box',
      'email',
      'wait',
      'notify',
      'notify',
      'notify',
      'ai',
    ]);
    // Revert names the snapshot it picked, and the list was read once for all of it.
    const revert = client.create.mock.calls[1]![1] as ItemRuleBody;
    expect(revert.steps[0]).toEqual({
      kind: 'revert_snapshot',
      snapshot: 's1',
      name: 'Clean board',
    });
    expect(fakes.snapshots).toHaveBeenCalledTimes(1);
    expect(fakes.snapshots).toHaveBeenCalledWith({ id: 'd1', shareCode: null });
    // Add a Tab starts on the first template, an email on the owner.
    expect((client.create.mock.calls[2]![1] as ItemRuleBody).steps[0]).toEqual({
      kind: 'add_tab',
      template: 'retro',
      name: 'Retrospective',
    });
    expect((client.create.mock.calls[4]![1] as ItemRuleBody).steps[0]).toMatchObject({
      to: { owner: true },
    });
  }, 60_000);

  it('saves each condition, starting Tab on the person’s tab, and leaves Who Did It out where nobody did', async () => {
    const client = itemClient();
    render(<Screen client={client} />);
    await screen.findByText('Nightly Snapshot');
    await blankRule();
    for (const name of ['Tab', 'Who Did It', 'Day of Week']) {
      fireEvent.click(screen.getByRole('button', { name: /Add Condition/ }));
      fireEvent.click(screen.getByRole('menuitem', { name }));
    }
    addAction('take_snapshot');
    const body = await save(client);
    expect(body.conditions).toEqual([
      { kind: 'tab', tabs: ['t2'] },
      { kind: 'who', who: [{ role: 'editor' }] },
      { kind: 'weekday', days: [1, 2, 3, 4, 5] },
    ]);
    expect(refusedBodies).toEqual([]);
    // A time has nobody behind it: Who Did It is not offered.
    await blankRule();
    fireEvent.click(document.querySelector('[data-change-step]')!);
    fireEvent.click(tile('scheduled'));
    fireEvent.click(screen.getByRole('button', { name: /Add Condition/ }));
    expect(screen.queryByRole('menuitem', { name: 'Who Did It' })).toBeNull();
    expect(screen.getByRole('menuitem', { name: 'Day of Week' })).toBeTruthy();
  });

  it('offers {{summary}} only in the steps after a Summarise step', async () => {
    const client = itemClient();
    render(<Screen client={client} />);
    await screen.findByText('Nightly Snapshot');
    await blankRule();
    const offered = () => {
      fireEvent.click(screen.getByRole('button', { name: 'Insert a Value into Name' }));
      const list = screen.getByRole('listbox', { name: 'Values' });
      // Each option reads its label, then the value as it is written.
      const labels = within(list)
        .getAllByRole('option')
        .map((o) => o.textContent.replace(/\{\{.*$/, ''));
      fireEvent.keyDown(list, { key: 'Escape' });
      return labels;
    };
    addAction('take_snapshot');
    expect(offered()).not.toContain('AI Summary');
    addAction('ai_summarise');
    expect(screen.getByText(/The summary becomes the value/)).toBeTruthy();
    addAction('take_snapshot');
    // The second Take Snapshot stands after the Summarise step: its Name may read the summary.
    const labels = offered();
    expect(labels).toContain('AI Summary');
    expect(labels).toContain('Document Name');
    fireEvent.click(screen.getByRole('button', { name: 'Insert a Value into Name' }));
    fireEvent.click(screen.getByRole('option', { name: /^AI Summary/ }));
    const body = await save(client);
    expect(body.steps.map((s) => s.kind)).toEqual(['take_snapshot', 'ai', 'take_snapshot']);
    expect(String(body.steps[2]!['name'])).toContain('{{summary}}');
    expect(refusedBodies).toEqual([]);
    // The first step, selected again, still does not offer it.
    fireEvent.click(cards()[1]!.querySelector('button')!);
    expect(offered()).not.toContain('AI Summary');
  });
});

describe('Test Rule', () => {
  it('asks which tab for a rule about one, on the person’s tab, then shows what it would do', async () => {
    const client = itemClient();
    render(<Screen client={client} initial={{ view: 'rule', ruleId: 'r1' }} />);
    await screen.findByRole('textbox', { name: 'Rule name' });
    fireEvent.click(screen.getByRole('button', { name: 'Test Rule' }));
    const ask = screen.getByRole('dialog', { name: 'Test Rule' });
    const select = within(ask).getByRole<HTMLSelectElement>('combobox', { name: 'Tab' });
    expect(select.value).toBe(ITEM.currentTabId);
    expect(client.test).not.toHaveBeenCalled();
    fireEvent.change(select, { target: { value: 't1' } });
    await act(async () => {
      fireEvent.click(within(ask).getByRole('button', { name: 'Test Rule' }));
    });
    expect(client.test).toHaveBeenCalledTimes(1);
    expect(client.test.mock.calls[0]![2]).toBe('t1');
    const result = screen.getByRole('dialog', { name: 'Test Rule' });
    expect(within(result).getByText('Roadmap')).toBeTruthy();
    expect(within(result).getByText('Would take a snapshot named “Nightly”')).toBeTruthy();
    // Another Tab goes back to the pick, on the tab just tried.
    fireEvent.click(within(result).getByRole('button', { name: 'Another Tab' }));
    expect(
      within(screen.getByRole('dialog', { name: 'Test Rule' })).getByRole<HTMLSelectElement>(
        'combobox',
        { name: 'Tab' },
      ).value,
    ).toBe('t1');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog', { name: 'Test Rule' })).toBeNull();
  });

  it('runs at once for a rule about no tab, and says so where the item has no tab', async () => {
    const client = itemClient([
      itemRule({ trigger: { kind: 'scheduled', every: 'day', at: '09:00' } }),
    ]);
    const view = render(<Screen client={client} initial={{ view: 'rule', ruleId: 'r1' }} />);
    await screen.findByRole('textbox', { name: 'Rule name' });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Test Rule' }));
    });
    expect(client.test).toHaveBeenCalledTimes(1);
    expect(client.test.mock.calls[0]![2]).toBeNull();
    view.unmount();
    forgetAutomations();
    render(
      <Screen
        client={itemClient()}
        initial={{ view: 'rule', ruleId: 'r1' }}
        item={{ ...ITEM, tabs: [], currentTabId: null }}
      />,
    );
    await screen.findByRole('textbox', { name: 'Rule name' });
    fireEvent.click(screen.getByRole('button', { name: 'Test Rule' }));
    const ask = screen.getByRole('dialog', { name: 'Test Rule' });
    expect(within(ask).getByRole('status').textContent).toMatch(/has no tabs yet/);
    expect(within(ask).getByRole<HTMLButtonElement>('button', { name: 'Test Rule' }).disabled).toBe(
      true,
    );
  });
});

describe('Run Rule', () => {
  const manual = (over: Partial<ItemListedRule> = {}) =>
    itemRule({ id: 'r2', name: 'Reset', trigger: { kind: 'manual' }, ...over });

  it('runs a Run by Hand rule from its row, and says it ran', async () => {
    const client = itemClient([itemRule(), manual()]);
    render(<Screen client={client} />);
    await screen.findByText('Reset');
    // Only the by-hand rule has the button.
    expect(row('r1').querySelector('[data-rule-run]')).toBeNull();
    await act(async () => {
      fireEvent.click(within(row('r2')).getByRole('button', { name: 'Run Rule: Reset' }));
    });
    expect(client.run).toHaveBeenCalledWith(SCOPE, 'r2', null);
    expect(toast.success).toHaveBeenCalledWith('Ran “Reset”');
    expect(fakes.track).toHaveBeenCalledWith('rule_run');
    // And from its menu.
    fireEvent.click(within(row('r2')).getByRole('button', { name: 'More for Reset' }));
    await act(async () => {
      fireEvent.click(screen.getByRole('menuitem', { name: 'Run Rule' }));
    });
    expect(client.run).toHaveBeenCalledTimes(2);
    fireEvent.click(within(row('r1')).getByRole('button', { name: 'More for Nightly Snapshot' }));
    expect(screen.queryByRole('menuitem', { name: 'Run Rule' })).toBeNull();
  });

  it('asks which tab only when the rule reads the run’s tab', async () => {
    const client = itemClient([manual({ steps: [{ kind: 'ai', task: 'summarise', tab: 'run' }] })]);
    render(<Screen client={client} />);
    await screen.findByText('Reset');
    fireEvent.click(within(row('r2')).getByRole('button', { name: 'Run Rule: Reset' }));
    const ask = screen.getByRole('dialog', { name: 'Run Rule' });
    expect(client.run).not.toHaveBeenCalled();
    expect(within(ask).getByRole<HTMLSelectElement>('combobox', { name: 'Tab' }).value).toBe('t2');
    await act(async () => {
      fireEvent.click(within(ask).getByRole('button', { name: 'Run Rule' }));
    });
    expect(client.run).toHaveBeenCalledWith(SCOPE, 'r2', 't2');
    expect(screen.queryByRole('dialog', { name: 'Run Rule' })).toBeNull();
    // Backing out runs nothing.
    fireEvent.click(within(row('r2')).getByRole('button', { name: 'Run Rule: Reset' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(client.run).toHaveBeenCalledTimes(1);
  });

  it('says a refused run, a failed one and one a Wait holds', async () => {
    const client = itemClient([manual()]);
    render(<Screen client={client} />);
    await screen.findByText('Reset');
    const press = () =>
      act(async () => {
        fireEvent.click(within(row('r2')).getByRole('button', { name: 'Run Rule: Reset' }));
      });
    client.run.mockRejectedValueOnce(
      new AutomationRefusal(429, { error: 'automation_budget_spent' }),
    );
    await press();
    expect(toast.error).toHaveBeenLastCalledWith(
      'This document has used today’s 1,000 runs. It runs again tomorrow.',
    );
    client.run.mockRejectedValueOnce(new Error('offline'));
    await press();
    expect(toast.error).toHaveBeenLastCalledWith(
      '“Reset” didn’t run. Check your connection and try again.',
    );
    client.run.mockResolvedValueOnce({
      run: itemRun({ result: 'failed', reason: 'The snapshot is gone' }),
    });
    await press();
    expect(toast.error).toHaveBeenLastCalledWith('The snapshot is gone');
    client.run.mockResolvedValueOnce({
      run: itemRun({ result: 'waiting', waitsUntil: Date.now() + 3_600_000 }),
    });
    await press();
    expect(toast.success.mock.calls.at(-1)![0]).toMatch(
      /^Ran “Reset” up to its Wait\. It goes on /,
    );
    client.run.mockResolvedValueOnce({ run: itemRun({ result: 'waiting' }) });
    await press();
    expect(toast.success).toHaveBeenLastCalledWith('Ran “Reset” up to its Wait.');
  });

  it('offers nothing on a by-hand rule that is off', async () => {
    render(<Screen client={itemClient([manual({ enabled: false })])} />);
    await screen.findByText('Reset');
    expect(row('r2').querySelector('[data-rule-run]')).toBeNull();
  });
});

describe('the Audit Trail', () => {
  it('shows a run’s tab under Tab, No tab for none, and opens the tab', async () => {
    render(<Screen client={itemClient()} />);
    await screen.findByText('Nightly Snapshot');
    fireEvent.click(screen.getByRole('tab', { name: 'Audit Trail' }));
    await screen.findByText('Roadmap');
    expect(screen.getByText('Tab')).toBeTruthy();
    const first = document.querySelector<HTMLElement>('[data-run-row="run1"]')!;
    const second = document.querySelector<HTMLElement>('[data-run-row="run2"]')!;
    expect(within(second).getByText('No tab')).toBeTruthy();
    fireEvent.click(within(first).getByRole('button', { name: /Expand run/ }));
    fireEvent.click(within(first).getByRole('button', { name: 'Open Tab' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(openTab).toHaveBeenCalledWith('t1');
    // A run about the item alone has nowhere to go.
    fireEvent.click(within(second).getByRole('button', { name: /Expand run/ }));
    expect(within(second).queryByRole('button', { name: 'Open Tab' })).toBeNull();
  });
});

describe('what a rule needs', () => {
  const needs = (id: string) => row(id).querySelector('[data-rule-needs]')?.textContent ?? null;

  it('marks a rule naming a snapshot or a connection the item lacks, reading each list once', async () => {
    const client = itemClient([
      itemRule(),
      itemRule({
        id: 'r2',
        name: 'Reset',
        steps: [{ kind: 'revert_snapshot', snapshot: 's-gone', name: 'Old board' }],
      }),
      itemRule({
        id: 'r3',
        name: 'Tell Slack',
        steps: [{ kind: 'notify', via: 'slack', webhook: 'w-gone', text: 'Hi' }],
      }),
      itemRule({
        id: 'r4',
        name: 'Kept',
        steps: [{ kind: 'revert_snapshot', snapshot: 's1', name: 'Clean board' }],
      }),
      itemRule({
        id: 'r5',
        name: 'Copied',
        trigger: { kind: 'edited', minutes: 30, tab: 't-gone' },
        steps: [{ kind: 'notify', via: 'slack', webhook: '', text: 'Hi' }],
        // The list's own word of it: the browser's reading stands in its place.
        attention: [{ kind: 'connection', id: '' }],
      }),
    ]);
    render(<Screen client={client} />);
    await screen.findByText('Reset');
    await waitFor(() => expect(needs('r2')).toBe('Needs Attention: A snapshot is gone'));
    await waitFor(() => expect(needs('r3')).toBe('Needs Attention: A connection is gone'));
    expect(needs('r1')).toBeNull();
    expect(needs('r4')).toBeNull();
    expect(needs('r5')).toBe('Needs Attention: A tab is gone · Pick a connection');
    // The sentence names a snapshot by the item's own name for it, and a gone one as gone.
    expect(sentenceOf('r4')).toContain('Revert to “Clean board”');
    expect(sentenceOf('r2')).toContain("Revert to “a snapshot that's gone”");
    expect(fakes.snapshots).toHaveBeenCalledTimes(1);
    expect(fakes.listWebhooks).toHaveBeenCalledTimes(1);
    expect(fakes.listWebhooks).toHaveBeenCalledWith('d1', null);
  });

  it('checks no connection for a guest, and asks with the share link the page holds', async () => {
    const rules = [
      itemRule({
        id: 'r3',
        name: 'Tell Slack',
        steps: [{ kind: 'notify', via: 'slack', webhook: 'w-gone', text: 'Hi' }],
      }),
    ];
    const view = render(<Screen client={itemClient(rules)} item={{ ...ITEM, signedIn: false }} />);
    await screen.findByText('Tell Slack');
    expect(fakes.listWebhooks).not.toHaveBeenCalled();
    expect(needs('r3')).toBeNull();
    view.unmount();
    forgetAutomations();
    render(<Screen client={itemClient(rules)} item={{ ...ITEM, shareCode: 'abc' }} />);
    await screen.findByText('Tell Slack');
    await waitFor(() => expect(fakes.listWebhooks).toHaveBeenCalledWith('d1', { code: 'abc' }));
  });

  it('reads the snapshots afresh each time the screen opens', async () => {
    const rules = [
      itemRule({ steps: [{ kind: 'revert_snapshot', snapshot: 's1', name: 'Clean board' }] }),
    ];
    function Reopen() {
      const [open, setOpen] = useState(true);
      const [made] = useState(() => (fakes = itemKit(itemClient(rules))));
      const access = useMemo(
        () => ({ scope: SCOPE, plumbing: made.plumbing, open: () => {} }),
        [made],
      );
      return (
        <AutomationsContext.Provider value={access}>
          <AutomationsKitProvider kit={made.kit}>
            <button type="button" onClick={() => setOpen((v) => !v)}>
              Toggle
            </button>
            {open ? (
              <AutomationsDialog
                scope={SCOPE}
                target={{ view: 'rules' }}
                onTarget={() => {}}
                onClose={() => {}}
                signedIn
              />
            ) : null}
          </AutomationsKitProvider>
        </AutomationsContext.Provider>
      );
    }
    render(<Reopen />);
    await screen.findByText('Nightly Snapshot');
    await waitFor(() => expect(fakes.snapshots).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole('button', { name: 'Toggle', hidden: true }));
    fireEvent.click(screen.getByRole('button', { name: 'Toggle', hidden: true }));
    await screen.findByText('Nightly Snapshot');
    await waitFor(() => expect(fakes.snapshots).toHaveBeenCalledTimes(2));
  });
});

describe('the kit itself', () => {
  it('refuses a shared kind handed in as the app’s own, a stray one, and an own kind with no picture', () => {
    const client = itemClient();
    const scene = () => null;
    expect(() => itemKit(client, { own: { triggers: { edited: { scene } } } })).toThrow(
      /"edited" is a shared trigger/,
    );
    expect(() => itemKit(client, { own: { triggers: { nope: { scene } } } })).toThrow(
      /names "nope"/,
    );
    expect(() => itemKit(client, { own: {} })).toThrow(/no picture for the trigger "poll_ended"/);
    expect(() => itemKit(client, { own: { triggers: { poll_ended: { scene } } } })).toThrow(
      /no picture for the action "clear_box"/,
    );
  });

  it('gives every shared kind a picture, an icon and a panel or a line', () => {
    const { kit } = itemKit(itemClient());
    for (const [kind, trigger] of Object.entries(kit.kinds.triggers)) {
      expect(trigger.Panel, kind).toBeTruthy();
      const { container } = render(<>{trigger.scene('changes')}</>);
      expect(container.firstElementChild!.getAttribute('aria-hidden'), kind).toBe('true');
      expect(container.firstElementChild!.childElementCount, kind).toBeGreaterThan(1);
      cleanup();
    }
    for (const [key, action] of Object.entries(kit.kinds.actions)) {
      const { container } = render(
        <>
          {action.scene('snapshots')}
          <action.glyph size={16} aria-hidden />
        </>,
      );
      expect(container.querySelectorAll('svg').length, key).toBeGreaterThan(0);
      if (!['wait', 'notify_slack', 'notify_teams', 'notify_webhook'].includes(key))
        expect(action.Panel ?? action.note, key).toBeTruthy();
      cleanup();
    }
    expect(kit.kinds.actions['clear_box']!.note).toBe('Empties the suggestion box.');
    expect(kit.kinds.actions['revert_snapshot']!.last).toBe(true);
    expect(kit.kinds.actions['ai_summarise']!.top).toBe(true);
    expect(kit.kinds.triggers['scheduled']).toMatchObject({ time: true, personless: true });
    expect(kit.kinds.conditions['who']!.personal).toBe(true);
    expect(kit.templates.scene('nope')).toBeNull();
    expect(kit.templates.build('nope', {}, 'UTC')).toBeNull();
    expect(kit.incoming.runsOn({ conditions: [], steps: [] } as never)).toMatch(/document alone/);
    expect(
      kit.incoming.runsOn({ conditions: [{ kind: 'tab', tabs: ['t1'] }], steps: [] } as never),
    ).toMatch(/should name one/);
    // From one comment trigger to another the tab it is kept to stays, while the item still has it.
    const outline = { item: ITEM } as never;
    const resolved = kit.kinds.triggers['thread_resolved']!;
    expect(resolved.fresh(outline, { kind: 'comment_added', tab: 't1' } as never)).toEqual({
      kind: 'thread_resolved',
      tab: 't1',
    });
    expect(resolved.fresh(outline, { kind: 'comment_added', tab: 't-gone' } as never)).toEqual({
      kind: 'thread_resolved',
    });
    expect(
      kit.kinds.triggers['tab_added']!.fresh(outline, { kind: 'edited', tab: 't1' } as never),
    ).toEqual({
      kind: 'tab_added',
    });
    // An app with no tab templates hands none in.
    const { tabTemplates: _none, ...bare } = itemKit(itemClient()).input;
    expect(defineItemAutomationsKit(bare).kinds.actions['add_tab']).toBeTruthy();
    expect(kit.sentence.pick('snapshot')).toBe('Pick a snapshot');
    expect(kit.sentence.gone('As it was', undefined)).toBe('As it was');
    expect(kit.audit.useRef()({ id: 't1', title: 'Roadmap' })).toBe('');
  });
});
