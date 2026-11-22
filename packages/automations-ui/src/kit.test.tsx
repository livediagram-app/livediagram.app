// @vitest-environment jsdom
// The seam (blueprint ui.md "The kit"): the screen, the builder and the pickers drawn from a kit that is not
// liveplanner's. Two triggers, two actions of its own, no branch, a subject that is a tab. It renders the rules,
// builds a rule and saves it, tests it, shows a run, holds Connections as a tab, and keeps a rule's unsaved changes
// across Add a Connection….
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AutomationsTarget } from './AutomationsContext';
import { AutomationsDialog } from './AutomationsDialog';
import { AutomationRefusal } from './automations-client';
import type { AutomationsView } from './kit';
import { AutomationsKitProvider, useAutomationsScreen } from './kit-context';
import { RulesList } from './RulesList';
import { fakeClient, fakeKit, fakeRule, OUTLINE, SCOPE, type FakeClient } from './test/fake-kit';
import { forgetAutomations } from './use-automations';

const toast = vi.hoisted(() => ({ info: vi.fn(), success: vi.fn(), error: vi.fn() }));
vi.mock('@liveworkspace/workbench/hooks/ui/useToast', () => ({ useToast: () => toast }));
// The Connections tab's list is the index's own (settings-ui): here, a mark of what it was handed.
vi.mock('@liveworkspace/settings-ui/connections', () => ({
  Connections: ({ itemId, app, share }: { itemId: string; app: string; share: unknown }) => (
    <div data-testid="connections">
      {app}:{itemId}:{JSON.stringify(share)}
    </div>
  ),
}));

// Where the screen is, as the harness draws it.
const shown = (): AutomationsTarget =>
  JSON.parse(screen.getByTestId('target').textContent) as AutomationsTarget;
function Screen({
  client,
  initial = { view: 'rules' },
  views,
  signedIn = true,
  scope = SCOPE,
}: {
  client: FakeClient;
  initial?: AutomationsTarget;
  views?: readonly AutomationsView[];
  signedIn?: boolean;
  scope?: typeof SCOPE | (Omit<typeof SCOPE, 'shareCode'> & { shareCode: string });
}) {
  const [kit] = useState(() => fakeKit(client, {}, views).kit);
  const [target, setTarget] = useState(initial);
  return (
    <AutomationsKitProvider kit={kit}>
      <pre data-testid="target">{JSON.stringify(target)}</pre>
      <AutomationsDialog
        scope={scope}
        target={target}
        onTarget={setTarget}
        onClose={() => {}}
        signedIn={signedIn}
      />
    </AutomationsKitProvider>
  );
}

const cards = () => [...document.querySelectorAll<HTMLElement>('[data-step-card]')];
const tile = (key: string) => document.querySelector<HTMLElement>(`[data-picker-tile="${key}"]`)!;

// A wide screen: the builder beside its steps, the rules as rows (jsdom has no matchMedia, which reads as a phone).
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

beforeEach(() => {
  forgetAutomations();
  vi.clearAllMocks();
  wide();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('the screen over an app’s kit', () => {
  it('lists the rules in the app’s words, under its own line', async () => {
    render(<Screen client={fakeClient()} />);
    expect(await screen.findByText('Nightly Snapshot')).toBeTruthy();
    expect(screen.getByText('Rules this Space runs for you.')).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Rules · 1' }).getAttribute('aria-selected')).toBe(
      'true',
    );
    const row = document.querySelector('[data-rule-row="r1"]')!;
    expect(row.querySelector('[data-rule-sentence]')!.textContent).toBe('Whentab_addedthen1 steps');
    // The Rules list's Trigger filter names the app's kinds.
    expect(
      within(screen.getByRole('combobox', { name: 'Trigger' }))
        .getAllByRole('option')
        .map((o) => o.textContent),
    ).toEqual(['All Triggers', 'Tab Added', 'Scheduled']);
  });

  it('shows the app’s empty state, its help and its templates, and opens one filled in', async () => {
    const client = fakeClient([]);
    render(<Screen client={client} />);
    expect(await screen.findByText('A rule watches this Space.')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'How Rules Work' })).toBeTruthy();
    fireEvent.click(document.querySelector('[data-template="nightly"]')!);
    expect(shown()).toEqual({ view: 'rule', ruleId: null, template: 'nightly' });
    expect(await screen.findByRole('textbox', { name: 'Rule name' })).toHaveProperty(
      'value',
      'Nightly Snapshot',
    );
    // What the template left to pick is marked in the app's words.
    expect(document.querySelector('[data-pick]')!.textContent).toContain('Pick a snapshot');
  });

  it('builds a rule from the app’s kinds, saves it and reports it', async () => {
    const client = fakeClient();
    const { track } = fakeKit(client);
    render(<Screen client={client} />);
    await screen.findByText('Nightly Snapshot');
    fireEvent.click(screen.getByRole('button', { name: /New Rule/ }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Blank Rule' }));
    const name = await screen.findByRole<HTMLInputElement>('textbox', { name: 'Rule name' });
    expect(name.value).toBe('New Rule');
    // A new rule starts on the app's first trigger; its tile picker offers the app's two.
    expect(cards()[0]!.textContent).toContain('tab_added');
    fireEvent.click(document.querySelector('[data-change-step]')!);
    expect(tile('tab_added')).toBeTruthy();
    fireEvent.click(tile('scheduled'));
    expect(cards()[0]!.textContent).toContain('scheduled');
    // The shared Scheduled panel, and the app's label over a time rule's conditions.
    expect(screen.getByText(/^Times are /)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Add Condition/ }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Tab' }));
    expect(cards()[1]!.textContent).toContain('For tabs where');
    expect(document.querySelector('[data-condition-panel]')!.textContent).toBe(OUTLINE.tabs[0]);
    // Add an Action: the app's groups and tiles; no branch button, since the kit has none.
    expect(screen.queryByRole('button', { name: /For Related/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Add Action/ }));
    expect(screen.getByRole('region', { name: 'Snapshots' })).toBeTruthy();
    fireEvent.click(tile('take_snapshot'));
    const field = screen.getByLabelText<HTMLInputElement>('Snapshot Name');
    // The trigger is a time with nobody behind it: the app's panel is told.
    expect(field.dataset.personless).toBe('true');
    fireEvent.change(field, { target: { value: 'Clean board' } });
    fireEvent.change(name, { target: { value: 'Tidy Up' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save Rule' }));
    });
    expect(client.create).toHaveBeenCalledTimes(1);
    const [scope, body] = client.create.mock.calls[0]!;
    expect(scope).toEqual(SCOPE);
    expect(body).toMatchObject({
      name: 'Tidy Up',
      trigger: { kind: 'scheduled', every: 'weekday', at: '09:00' },
      conditions: [{ kind: 'tab', tabs: ['Roadmap'] }],
      steps: [{ kind: 'take_snapshot', name: 'Clean board' }],
      chain: false,
    });
    expect(toast.success).toHaveBeenCalledWith('Saved Tidy Up');
    // The saved rule is the one open now.
    expect(shown()).toMatchObject({ view: 'rule', ruleId: 'r2' });
    void track;
  });

  it('tests the rule as it stands, with nothing to pick, and shows what it would do', async () => {
    const client = fakeClient();
    render(<Screen client={client} initial={{ view: 'rule', ruleId: 'r1' }} />);
    await screen.findByRole('textbox', { name: 'Rule name' });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Test Rule' }));
    });
    expect(client.test).toHaveBeenCalledTimes(1);
    expect(client.test.mock.calls[0]![2]).toBeNull();
    const dialog = screen.getByRole('dialog', { name: 'Test Rule' });
    expect(within(dialog).getByText(/A test changes nothing/)).toBeTruthy();
    expect(within(dialog).getByText('Would take a snapshot “Nightly”')).toBeTruthy();
    await act(async () => {
      fireEvent.click(within(dialog).getByRole('button', { name: 'Test Again' }));
    });
    expect(client.test).toHaveBeenCalledTimes(2);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Done' }));
    expect(screen.queryByRole('dialog', { name: 'Test Rule' })).toBeNull();
  });

  it('says a test that failed, and hands a refusal naming a step to the builder', async () => {
    const client = fakeClient();
    client.test.mockRejectedValueOnce(new Error('offline'));
    render(<Screen client={client} initial={{ view: 'rule', ruleId: 'r1' }} />);
    await screen.findByRole('textbox', { name: 'Rule name' });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Test Rule' }));
    });
    expect(screen.getByRole('alert').textContent).toMatch(/The test didn’t run/);
    client.test.mockRejectedValueOnce(
      new AutomationRefusal(400, {
        error: 'automation_invalid',
        path: 'steps.0.name',
        message: 'steps.0.name must name one',
      }),
    );
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Test Again' }));
    });
    // The test closes, and the step at fault says why.
    expect(screen.queryByRole('dialog', { name: 'Test Rule' })).toBeNull();
    expect(document.querySelector('[data-step-card][data-fault]')!.textContent).toContain(
      'Pick one.',
    );
  });

  it('shows a run on the Audit Trail, under the app’s subject', async () => {
    const client = fakeClient();
    render(<Screen client={client} />);
    await screen.findByText('Nightly Snapshot');
    fireEvent.click(screen.getByRole('tab', { name: 'Audit Trail' }));
    await screen.findByText('Roadmap');
    const row = document.querySelector<HTMLElement>('[data-run-row="run1"]')!;
    expect(client.runs).toHaveBeenCalledWith(SCOPE, expect.objectContaining({ limit: 200 }));
    expect(screen.getByText('Tab')).toBeTruthy();
    expect(within(row).getByText('Roadmap')).toBeTruthy();
    expect(row.querySelector('[data-run-result="done"]')).toBeTruthy();
    fireEvent.click(within(row).getByRole('button', { name: /Expand run/ }));
    expect(within(row).getByText('Would take a snapshot “Nightly”')).toBeTruthy();
    // The kit offers no way to what a run was about: no link.
    expect(within(row).queryByRole('button', { name: /Open/ })).toBeNull();
  });
});

describe('Connections', () => {
  it('is a tab of the screen, on the item’s connections', async () => {
    render(<Screen client={fakeClient()} scope={{ ...SCOPE, shareCode: 'abc' }} />);
    await screen.findByText('Nightly Snapshot');
    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual([
      'Rules · 1',
      'Audit Trail',
      'Templates',
      'Connections',
    ]);
    fireEvent.click(screen.getByRole('tab', { name: 'Connections' }));
    expect(shown()).toEqual({ view: 'connections' });
    // Under the same header and tabs, in the tab's own panel.
    const panel = screen.getByRole('tabpanel', { name: 'Connections' });
    expect((await within(panel).findByTestId('connections')).textContent).toBe(
      'livehuddle:i1:{"code":"abc"}',
    );
    expect(screen.getByRole('heading', { name: 'Automations' })).toBeTruthy();
    // Opened by its tab, there is no rule to go back to.
    expect(screen.queryByRole('button', { name: 'Back to Rule' })).toBeNull();
  });

  it('asks a guest to sign in', async () => {
    render(<Screen client={fakeClient()} initial={{ view: 'connections' }} signedIn={false} />);
    expect(await screen.findByText('Sign In to See Connections')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Sign In' }).getAttribute('href')).toBe('/sign-in/');
    expect(screen.queryByTestId('connections')).toBeNull();
  });

  it('Add a Connection… keeps the rule as it stands, and Back to Rule opens it on the same step', async () => {
    const client = fakeClient();
    render(<Screen client={client} />);
    await screen.findByText('Nightly Snapshot');
    fireEvent.click(screen.getByRole('button', { name: /New Rule/ }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Blank Rule' }));
    const name = await screen.findByRole<HTMLInputElement>('textbox', { name: 'Rule name' });
    fireEvent.change(name, { target: { value: 'Tell the Team' } });
    fireEvent.click(screen.getByRole('button', { name: /Add Action/ }));
    fireEvent.click(tile('notify_slack'));
    // The message step's panel picks a connection by name.
    const picker = await screen.findByRole('combobox', { name: 'Connection' });
    await waitFor(() =>
      expect(within(picker).getByRole('option', { name: 'Launch Channel' })).toBeTruthy(),
    );
    fireEvent.change(screen.getByRole('textbox', { name: 'Message' }), {
      target: { value: 'Shipped it' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add a Connection…' }));
    // The Connections tab, with no Discard Changes?: the rule is kept, not left.
    expect(screen.queryByText('Discard Changes?')).toBeNull();
    expect(shown()).toEqual({ view: 'connections' });
    expect(await screen.findByTestId('connections')).toBeTruthy();
    expect(screen.getByRole('status').textContent).toContain('“Tell the Team” is kept');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Back to Rule' }));
    });
    // The builder again: the name, the step and its unsaved message as they were left, the step's panel open.
    expect(
      await screen.findByRole<HTMLInputElement>('textbox', { name: 'Rule name' }),
    ).toHaveProperty('value', 'Tell the Team');
    expect(screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Message' }).value).toBe(
      'Shipped it',
    );
    expect(cards()).toHaveLength(2);
    expect(cards()[1]!.dataset.selected).toBe('true');
    expect(client.create).not.toHaveBeenCalled();
    // Still unsaved: leaving it now asks first.
    fireEvent.click(screen.getByRole('button', { name: 'Automations' }));
    expect(screen.getByText('Discard Changes?')).toBeTruthy();
  });

  it('asks before a rule kept there is left for anything but itself, and drops it on Discard', async () => {
    const client = fakeClient();
    render(<Screen client={client} initial={{ view: 'rule', ruleId: 'r1' }} />);
    const name = await screen.findByRole<HTMLInputElement>('textbox', { name: 'Rule name' });
    fireEvent.change(name, { target: { value: 'Renamed' } });
    fireEvent.click(screen.getByRole('button', { name: /Add Action/ }));
    fireEvent.click(tile('notify_webhook'));
    fireEvent.click(await screen.findByRole('button', { name: 'Add a Connection…' }));
    expect(screen.getByRole('status').textContent).toContain('“Renamed” is kept');
    fireEvent.click(screen.getByRole('tab', { name: 'Audit Trail' }));
    expect(screen.getByText('Discard Changes?')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Keep Editing' }));
    expect(shown()).toEqual({ view: 'connections' });
    fireEvent.click(screen.getByRole('tab', { name: 'Audit Trail' }));
    fireEvent.click(screen.getByRole('button', { name: 'Discard Changes' }));
    expect(shown()).toEqual({ view: 'runs' });
    // Gone for good: Connections no longer offers the way back.
    fireEvent.click(screen.getByRole('tab', { name: 'Connections' }));
    expect(screen.queryByRole('button', { name: 'Back to Rule' })).toBeNull();
  });

  it('opens from Fix Connection on a rule a connection paused', async () => {
    const client = fakeClient([
      fakeRule({
        enabled: false,
        paused: { reason: 'Launch Channel is gone', at: 1, webhook: 'w1' },
      }),
    ]);
    render(<Screen client={client} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Fix Connection' }));
    expect(shown()).toEqual({ view: 'connections' });
  });
  it('offers Take Over Rule on a rule paused on a step in another app’s lost access', async () => {
    const client = fakeClient([
      fakeRule({
        enabled: false,
        paused: { reason: 'Stopped: no access to “Launch Board”', at: 1 },
      }),
    ]);
    render(<Screen client={client} />);
    await screen.findByRole('button', { name: 'Take Over Rule' });
    expect(screen.queryByRole('button', { name: 'Resume' })).toBeNull();
    // The Audit Trail on its runs says the same, with the same way back.
    fireEvent.click(screen.getByRole('tab', { name: 'Audit Trail' }));
    fireEvent.change(screen.getByRole('combobox', { name: 'Rule' }), { target: { value: 'r1' } });
    const banner = document.querySelector<HTMLElement>('[data-run-paused]')!;
    expect(banner.textContent).toContain('Stopped: no access to “Launch Board”');
    fireEvent.click(within(banner).getByRole('button', { name: 'Take Over Rule' }));
    // Saved as the person's own (the save stamps them as its author), then turned back on.
    await waitFor(() => expect(client.toggle).toHaveBeenCalledWith(expect.anything(), 'r1', true));
    expect(client.update).toHaveBeenCalledWith(
      expect.anything(),
      'r1',
      expect.objectContaining({ name: 'Nightly Snapshot' }),
    );
  });
});

describe('what a kit may add', () => {
  function Hub({ arrival, onBack }: { arrival: unknown; onBack: () => void }) {
    return (
      <section aria-label="Hub">
        <p>Hub says {String(arrival)}</p>
        <button type="button" onClick={onBack}>
          Back
        </button>
      </section>
    );
  }
  const button: AutomationsView = {
    id: 'hub',
    useOn: () => true,
    Button: ({ onOpen, footer }) => (
      <button type="button" data-footer={footer ? '' : undefined} onClick={onOpen}>
        Hub
      </button>
    ),
    View: Hub,
    heroClassName: 'hub-hero',
  };

  it('draws a view of its own from a button beside New Rule, in the screen’s place', async () => {
    render(<Screen client={fakeClient()} views={[button]} />);
    await screen.findByText('Nightly Snapshot');
    expect(document.querySelector('.hub-hero')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Hub' }));
    expect(shown()).toEqual({ view: 'view', id: 'hub' });
    expect(screen.getByText('Hub says undefined')).toBeTruthy();
    expect(screen.queryByRole('tablist')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(shown()).toEqual({ view: 'rules' });
  });

  it('draws a view as a tab after Connections, and leaves out one that is off', async () => {
    const tab: AutomationsView = { id: 'hub', useOn: () => true, tab: 'Hub', View: Hub };
    const off: AutomationsView = { id: 'lab', useOn: () => false, tab: 'Lab', View: Hub };
    render(<Screen client={fakeClient()} views={[tab, off]} />);
    await screen.findByText('Nightly Snapshot');
    expect(screen.queryByRole('tab', { name: 'Lab' })).toBeNull();
    fireEvent.click(screen.getByRole('tab', { name: 'Hub' }));
    expect(shown()).toEqual({ view: 'view', id: 'hub' });
    expect(
      within(screen.getByRole('tabpanel', { name: 'Hub' })).getByText(/Hub says/),
    ).toBeTruthy();
  });

  it('opens a view with what its opener hands it, from the app’s own parts', async () => {
    function Opener() {
      const screenNow = useAutomationsScreen();
      return (
        <button type="button" onClick={() => screenNow?.openView('hub', 'connected')}>
          Open Hub
        </button>
      );
    }
    const client = fakeClient();
    function WithProvider() {
      const [kit] = useState(
        () =>
          fakeKit(
            client,
            {
              Provider: ({ children }) => (
                <>
                  <Opener />
                  {children}
                </>
              ),
            },
            [button],
          ).kit,
      );
      const [target, setTarget] = useState<AutomationsTarget>({ view: 'rules' });
      return (
        <AutomationsKitProvider kit={kit}>
          <pre data-testid="target">{JSON.stringify(target)}</pre>
          <AutomationsDialog
            scope={SCOPE}
            target={target}
            onTarget={setTarget}
            onClose={() => {}}
          />
        </AutomationsKitProvider>
      );
    }
    render(<WithProvider />);
    await screen.findByText('Nightly Snapshot');
    fireEvent.click(screen.getByRole('button', { name: 'Open Hub' }));
    expect(shown()).toEqual({ view: 'view', id: 'hub', arrival: 'connected' });
    expect(screen.getByText('Hub says connected')).toBeTruthy();
  });

  it('offers no Run Rule where the kit has none, and reads the list’s own word of what a rule needs', async () => {
    const client = fakeClient([fakeRule({ trigger: { kind: 'manual' }, attention: ['a tab'] })]);
    render(<Screen client={client} />);
    await screen.findByText('Nightly Snapshot');
    const row = document.querySelector<HTMLElement>('[data-rule-row="r1"]')!;
    expect(row.querySelector('[data-rule-run]')).toBeNull();
    expect(row.querySelector('[data-rule-needs]')!.textContent).toBe('Needs Attention: 1 gone');
    fireEvent.click(within(row).getByRole('button', { name: 'More for Nightly Snapshot' }));
    expect(screen.getAllByRole('menuitem').map((m) => m.textContent)).toEqual([
      'Edit',
      'Duplicate',
      'Audit Trail',
      'Delete',
    ]);
    expect(client.run).not.toHaveBeenCalled();
  });

  it('ends the rule on a step nothing may follow', async () => {
    render(<Screen client={fakeClient()} initial={{ view: 'rule', ruleId: 'r1' }} />);
    await screen.findByRole('textbox', { name: 'Rule name' });
    fireEvent.click(screen.getByRole('button', { name: /Add Action/ }));
    fireEvent.click(tile('revert_snapshot'));
    // Its panel is the kit's note; nothing more is added after it.
    expect(screen.getByText('Puts the Space back. Nothing follows it.')).toBeTruthy();
    // Nothing more is added, and each button says why: still focusable, described by the reason.
    for (const name of [/Add Action/, /If \/ Else/]) {
      const button = screen.getByRole('button', { name });
      expect(button.getAttribute('aria-disabled')).toBe('true');
      const why = document.getElementById(
        button.getAttribute('aria-describedby')!.split(' ').at(-1)!,
      )!;
      expect(why.textContent).toBe('Revert to Snapshot is a rule’s last step');
      fireEvent.click(button);
    }
    expect(screen.queryByRole('dialog', { name: /Add an Action/ })).toBeNull();
    expect(cards().filter((c) => c.textContent?.includes('If / Else'))).toHaveLength(0);
    // It never moves up, and the step before it never moves down past it.
    fireEvent.click(screen.getByRole('button', { name: 'More for Step revert_snapshot' }));
    expect(screen.getByRole('menuitem', { name: 'Move Up' }).getAttribute('aria-disabled')).toBe(
      'true',
    );
  });
});

describe('Change the Action', () => {
  const tiles = () =>
    [...document.querySelectorAll<HTMLElement>('[data-picker-tile]')].map(
      (t) => t.dataset.pickerTile,
    );
  const addOffers = () => {
    fireEvent.click(screen.getByRole('button', { name: /Add Action/ }));
    const keys = tiles();
    const picker = screen.getByRole('dialog', { name: /Add an Action/ });
    fireEvent.click(within(picker).getAllByRole('button', { name: 'Close' })[0]!);
    return keys;
  };

  it('offers exactly what Add Action offers at the step’s place, a last step’s kind only to the last step', async () => {
    render(<Screen client={fakeClient()} initial={{ view: 'rule', ruleId: 'r1' }} />);
    await screen.findByRole('textbox', { name: 'Rule name' });
    const offered = addOffers();
    expect(offered).toEqual(
      expect.arrayContaining(['take_snapshot', 'revert_snapshot', 'wait', 'notify_slack']),
    );
    // A step with one after it may not become one nothing follows.
    fireEvent.click(screen.getByRole('button', { name: /Add Action/ }));
    fireEvent.click(tile('take_snapshot'));
    fireEvent.click(cards()[1]!.querySelector('button')!);
    fireEvent.click(document.querySelector('[data-change-step]')!);
    expect(tiles()).toEqual(offered.filter((k) => k !== 'revert_snapshot'));
    fireEvent.click(tile('take_snapshot'));
    // The last step: its change offers the same as Add Action, Wait and the messages among them.
    fireEvent.click(cards()[2]!.querySelector('button')!);
    fireEvent.click(document.querySelector('[data-change-step]')!);
    expect(screen.getByRole('dialog', { name: /Change the Action/ })).toBeTruthy();
    expect(tiles()).toEqual(offered);
    fireEvent.click(tile('wait'));
    expect(cards()[2]!.querySelector('[data-step-card] button')!.textContent).toBe('Then');
    expect(screen.getByRole('region', { name: /Wait step/ })).toBeTruthy();
  });

  it('turns a message step into any action, not only another tool', async () => {
    render(<Screen client={fakeClient()} initial={{ view: 'rule', ruleId: 'r1' }} />);
    await screen.findByRole('textbox', { name: 'Rule name' });
    const offered = addOffers();
    fireEvent.click(screen.getByRole('button', { name: /Add Action/ }));
    fireEvent.click(tile('notify_slack'));
    fireEvent.click(document.querySelector('[data-change-step]')!);
    expect(tiles()).toEqual(offered);
    fireEvent.click(tile('revert_snapshot'));
    expect(cards()[2]!.textContent).toContain('revert_snapshot');
  });
});

describe('a steady kit', () => {
  it('does not draw the rules again while the screen above them changes', async () => {
    // The kit is one object for the screen's life (kit.ts): a row reads it from context, so nothing but a change
    // to the rules themselves draws the list again.
    const client = fakeClient();
    const { kit } = fakeKit(client);
    let draws = 0;
    const counted = {
      ...kit,
      sentence: {
        ...kit.sentence,
        rule: (...args: Parameters<typeof kit.sentence.rule>) => {
          draws += 1;
          return kit.sentence.rule(...args);
        },
      },
    };
    const rules = [fakeRule()];
    const actionsFor = () => ({
      onOpen: () => {},
      onToggle: () => {},
      onDuplicate: () => {},
      onRunLog: () => {},
      onDelete: () => {},
    });
    const busy = new Set<string>();
    const list = (
      <RulesList
        rules={rules}
        outline={OUTLINE}
        now={0}
        phone={false}
        busyIds={busy}
        actionsFor={actionsFor}
      />
    );
    function Above() {
      const [n, setN] = useState(0);
      return (
        <AutomationsKitProvider kit={counted}>
          <button type="button" onClick={() => setN(n + 1)}>
            Unrelated {n}
          </button>
          {list}
        </AutomationsKitProvider>
      );
    }
    render(<Above />);
    expect(draws).toBe(1);
    fireEvent.click(screen.getByRole('button', { name: /Unrelated/ }));
    fireEvent.click(screen.getByRole('button', { name: /Unrelated/ }));
    expect(draws).toBe(1);
  });
});

describe('across the phone breakpoint', () => {
  // A screen whose width the test turns: matchMedia's lists read it live and hear the turn.
  function turnable() {
    let isWide = true;
    const heard = new Set<() => void>();
    vi.stubGlobal(
      'matchMedia',
      (query: string) =>
        ({
          get matches() {
            return query.includes('min-width') ? isWide : false;
          },
          media: query,
          addEventListener: (_: string, cb: () => void) => heard.add(cb),
          removeEventListener: (_: string, cb: () => void) => heard.delete(cb),
        }) as unknown as MediaQueryList,
    );
    return (wideNow: boolean) =>
      act(() => {
        isWide = wideNow;
        for (const cb of [...heard]) cb();
      });
  }

  it('keeps a new rule’s unsaved changes as the builder moves into the drawer and back', async () => {
    const turn = turnable();
    const client = fakeClient();
    render(<Screen client={client} />);
    await screen.findByText('Nightly Snapshot');
    fireEvent.click(screen.getByRole('button', { name: /New Rule/ }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Blank Rule' }));
    const name = await screen.findByRole<HTMLInputElement>('textbox', { name: 'Rule name' });
    fireEvent.change(name, { target: { value: 'Carried Across' } });
    fireEvent.click(screen.getByRole('button', { name: /Add Action/ }));
    fireEvent.click(tile('take_snapshot'));
    fireEvent.change(screen.getByLabelText('Snapshot Name'), { target: { value: 'Before' } });
    turn(false);
    expect(await screen.findByRole('dialog', { name: 'New Rule' })).toBeTruthy();
    expect(screen.getByRole<HTMLInputElement>('textbox', { name: 'Rule name' }).value).toBe(
      'Carried Across',
    );
    expect(cards()).toHaveLength(2);
    // Onto the phone, the step's sheet stays shut.
    expect(document.querySelector('[data-step-drawer]')).toBeNull();
    turn(true);
    expect(screen.queryByRole('dialog', { name: 'New Rule' })).toBeNull();
    expect(screen.getByRole<HTMLInputElement>('textbox', { name: 'Rule name' }).value).toBe(
      'Carried Across',
    );
    fireEvent.click(cards()[1]!.querySelector('button')!);
    expect(screen.getByLabelText<HTMLInputElement>('Snapshot Name').value).toBe('Before');
    // Still unsaved: leaving asks first.
    fireEvent.click(screen.getByRole('button', { name: 'Automations' }));
    expect(screen.getByText('Discard Changes?')).toBeTruthy();
    expect(client.create).not.toHaveBeenCalled();
  });

  it('keeps a saved rule’s unsaved rename across the switch', async () => {
    const turn = turnable();
    render(<Screen client={fakeClient()} initial={{ view: 'rule', ruleId: 'r1' }} />);
    const name = await screen.findByRole<HTMLInputElement>('textbox', { name: 'Rule name' });
    fireEvent.change(name, { target: { value: 'Renamed' } });
    turn(false);
    expect(await screen.findByRole('dialog', { name: 'Edit Rule' })).toBeTruthy();
    expect(screen.getByRole<HTMLInputElement>('textbox', { name: 'Rule name' }).value).toBe(
      'Renamed',
    );
  });
});

describe('on a phone', () => {
  beforeEach(() => vi.unstubAllGlobals());

  it('opens the builder as a drawer over the rules, a step’s fields in a sheet of their own', async () => {
    const client = fakeClient();
    render(<Screen client={client} initial={{ view: 'rule', ruleId: 'r1' }} />);
    expect(await screen.findByRole('dialog', { name: 'Edit Rule' })).toBeTruthy();
    // The rules stay behind it, each with its trigger alone.
    expect(document.querySelector('[data-rule-sentence]')!.textContent).toBe('Whentab_added');
    expect(document.querySelector('[data-rule-header="phone"]')).toBeTruthy();
    // The foot's test wears the kit's name for it.
    expect(
      within(document.querySelector<HTMLElement>('[data-rule-foot]')!).getByRole('button', {
        name: 'Test Rule',
      }),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Then' }));
    const sheet = document.querySelector<HTMLElement>('[data-step-drawer]')!;
    expect(within(sheet).getByLabelText('Snapshot Name')).toHaveProperty('value', 'Nightly');
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
  });
});
