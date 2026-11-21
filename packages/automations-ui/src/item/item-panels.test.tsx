// @vitest-environment jsdom
// Each shared kind's panel on its own (blueprint item-ui.md "Panels"): its fields, what it hands back, and how it
// shows a thing the rule names that the item no longer has, or an item with nothing to pick.
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setFallbackAutomationsKit } from '../kit-context';
import { RuleContextProvider } from '../rule-context';
import { buildOutline } from './outline';
import { AddTabPanel, ItemEmailPanel, summarisePanel } from './panels/action-panels';
import {
  TabConditionPanel,
  WeekdayConditionPanel,
  WhoConditionPanel,
  textConditionPanel,
} from './panels/condition-panels';
import { RevertSnapshotPanel, TakeSnapshotPanel } from './panels/snapshot-panels';
import {
  EditedPanel,
  ItemIncomingPanel,
  NotEditedPanel,
  TabTriggerPanel,
  startsWhenPanel,
} from './panels/trigger-panels';
import { ITEM, KINDS, SNAPSHOTS, itemClient, itemKit } from './test/item-fixtures';
import type { ItemSnapshots, ItemUiOutline, ItemView } from './types';

const idle = { status: 'idle' as const, list: [] };

function outlineOf(
  over: { item?: ItemView; snapshots?: Partial<ItemSnapshots> } = {},
): ItemUiOutline {
  return buildOutline({
    kinds: KINDS,
    item: over.item ?? ITEM,
    templates: [
      { id: 'retro', name: 'Retrospective', picture: <span data-tab-picture="retro" /> },
      { id: 'kanban', name: 'Kanban' },
    ],
    snapshots: {
      status: 'ready',
      list: SNAPSHOTS,
      ask: vi.fn(),
      retry: vi.fn(),
      ...over.snapshots,
    },
    connections: idle,
  });
}

// A panel under the rule it belongs to: the Text condition and Summarise read its trigger.
const under = (trigger: string, panel: ReactNode) => (
  <RuleContextProvider
    value={{
      body: {
        name: 'x',
        trigger: { kind: trigger },
        conditions: [],
        steps: [],
        chain: false,
        timeZone: 'UTC',
      },
      incoming: trigger === 'incoming_webhook',
      ruleId: null,
      hook: undefined,
      now: 0,
    }}
  >
    {panel}
  </RuleContextProvider>
);

const select = (name: string) => screen.getByRole<HTMLSelectElement>('combobox', { name });
const optionsOf = (name: string) => [...select(name).options].map((o) => o.textContent);
const pressed = () =>
  screen
    .getAllByRole('button')
    .filter((b) => b.getAttribute('aria-pressed') === 'true')
    .map((b) => b.textContent);

beforeEach(() => {
  setFallbackAutomationsKit(itemKit(itemClient()).kit);
});
afterEach(() => {
  cleanup();
  setFallbackAutomationsKit(null);
});

describe('the triggers’ panels', () => {
  it('Edited, Then Quiet: how long, and one tab or any', () => {
    const onChange = vi.fn();
    const outline = outlineOf();
    const view = render(
      <EditedPanel
        trigger={{ kind: 'edited', minutes: 30 }}
        onChange={onChange}
        outline={outline}
        timeZone="UTC"
        conditions={0}
      />,
    );
    expect(optionsOf('After')).toEqual([
      '5 minutes',
      '15 minutes',
      '30 minutes',
      '1 hour',
      '4 hours',
      '24 hours',
    ]);
    fireEvent.change(select('After'), { target: { value: '240' } });
    expect(onChange).toHaveBeenLastCalledWith({ kind: 'edited', minutes: 240 });
    expect(optionsOf('On')).toEqual(['Any Tab', 'Roadmap', 'Notes']);
    fireEvent.change(select('On'), { target: { value: 't2' } });
    expect(onChange).toHaveBeenLastCalledWith({ kind: 'edited', minutes: 30, tab: 't2' });
    // A figure off the list (an agent's, a file's) stays as its own choice; a tab that went stays, marked.
    view.rerender(
      <EditedPanel
        trigger={{ kind: 'edited', minutes: 45, tab: 't-gone' }}
        onChange={onChange}
        outline={outline}
        timeZone="UTC"
        conditions={0}
      />,
    );
    expect(optionsOf('After')).toContain('45 minutes');
    expect(select('After').value).toBe('45');
    expect(optionsOf('On')).toEqual(['Any Tab', 'A tab (No Longer Here)', 'Roadmap', 'Notes']);
    fireEvent.change(select('On'), { target: { value: '' } });
    expect(onChange).toHaveBeenLastCalledWith({ kind: 'edited', minutes: 45 });
  });

  it('Not Edited For: days kept in range, a time, and whose time zone', () => {
    const onChange = vi.fn();
    render(
      <NotEditedPanel
        trigger={{ kind: 'not_edited', days: 30, at: '09:00' }}
        onChange={onChange}
        outline={outlineOf()}
        timeZone="Europe/London"
        conditions={0}
      />,
    );
    const days = screen.getByRole('spinbutton', { name: 'Days' });
    fireEvent.change(days, { target: { value: '900' } });
    expect(onChange).toHaveBeenLastCalledWith({ kind: 'not_edited', days: 365, at: '09:00' });
    fireEvent.change(days, { target: { value: '' } });
    expect(onChange).toHaveBeenLastCalledWith({ kind: 'not_edited', days: 1, at: '09:00' });
    fireEvent.change(select('At'), { target: { value: '17:15' } });
    expect(onChange).toHaveBeenLastCalledWith({ kind: 'not_edited', days: 30, at: '17:15' });
    expect(
      screen.getByText(/Times are Europe\/London\. Checked daily at this time\./),
    ).toBeTruthy();
  });

  it('a comment trigger: any tab or one; a trigger with nothing to set says when it starts', () => {
    const onChange = vi.fn();
    render(
      <TabTriggerPanel
        trigger={{ kind: 'comment_added' }}
        onChange={onChange}
        outline={outlineOf()}
        timeZone="UTC"
        conditions={0}
      />,
    );
    expect(select('On').value).toBe('');
    fireEvent.change(select('On'), { target: { value: 't1' } });
    expect(onChange).toHaveBeenLastCalledWith({ kind: 'comment_added', tab: 't1' });
    cleanup();
    const Starts = startsWhenPanel('Starts when a tab is added.');
    render(
      <Starts
        trigger={{ kind: 'tab_added' }}
        onChange={onChange}
        outline={outlineOf()}
        timeZone="UTC"
        conditions={0}
      />,
    );
    expect(screen.getByText('Starts when a tab is added.')).toBeTruthy();
  });

  it('Incoming Webhook: says to save first, before the rule has an address', () => {
    render(
      under(
        'incoming_webhook',
        <ItemIncomingPanel
          trigger={{ kind: 'incoming_webhook' }}
          onChange={() => {}}
          outline={outlineOf()}
          timeZone="UTC"
          conditions={0}
        />,
      ),
    );
    expect(document.body.textContent).toMatch(/[Ss]ave/);
  });
});

describe('the conditions’ panels', () => {
  it('Tab: is or is not, the tabs as chips, one that went kept until unpicked', () => {
    const onChange = vi.fn();
    render(
      <TabConditionPanel
        condition={{ kind: 'tab', tabs: ['t1', 't-gone'] }}
        onChange={onChange}
        outline={outlineOf()}
      />,
    );
    expect(pressed()).toEqual(['Roadmap', 'No Longer Here']);
    fireEvent.click(screen.getByRole('button', { name: 'No Longer Here' }));
    expect(onChange).toHaveBeenLastCalledWith({ kind: 'tab', tabs: ['t1'] });
    fireEvent.change(select('Match'), { target: { value: 'not' } });
    expect(onChange).toHaveBeenLastCalledWith({ kind: 'tab', tabs: ['t1', 't-gone'], not: true });
    cleanup();
    render(
      <TabConditionPanel
        condition={{ kind: 'tab', tabs: [] }}
        onChange={onChange}
        outline={outlineOf({ item: { ...ITEM, tabs: [] } })}
      />,
    );
    expect(screen.getByText('This document has no tabs yet.')).toBeTruthy();
  });

  it('Who Did It: roles and people, each group keeping the other’s picks', () => {
    const onChange = vi.fn();
    render(
      <WhoConditionPanel
        condition={{
          kind: 'who',
          who: [{ role: 'editor' }, { person: 'p1' }, { person: 'p-gone' }],
        }}
        onChange={onChange}
        outline={outlineOf()}
      />,
    );
    expect(pressed()).toEqual(['An Editor', 'Ana Costa', 'Someone No Longer Here']);
    fireEvent.click(screen.getByRole('button', { name: 'An Agent' }));
    expect(onChange).toHaveBeenLastCalledWith({
      kind: 'who',
      who: [{ role: 'editor' }, { role: 'agent' }, { person: 'p1' }, { person: 'p-gone' }],
    });
    fireEvent.click(screen.getByRole('button', { name: 'Kai Park' }));
    expect(onChange).toHaveBeenLastCalledWith({
      kind: 'who',
      who: [{ role: 'editor' }, { person: 'p1' }, { person: 'p-gone' }, { person: 'p2' }],
    });
    fireEvent.change(select('Match'), { target: { value: 'not' } });
    expect(onChange.mock.calls.at(-1)![0]).toMatchObject({ not: true });
    cleanup();
    render(
      <WhoConditionPanel
        condition={{ kind: 'who', who: [] }}
        onChange={onChange}
        outline={outlineOf({ item: { ...ITEM, people: [] } })}
      />,
    );
    expect(screen.getByText('No one in this document yet.')).toBeTruthy();
  });

  it('Day of Week: seven days, Monday first, handed back in order', () => {
    const onChange = vi.fn();
    render(
      <WeekdayConditionPanel
        condition={{ kind: 'weekday', days: [1, 5] }}
        onChange={onChange}
        outline={outlineOf()}
      />,
    );
    expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual([
      'Mon',
      'Tue',
      'Wed',
      'Thu',
      'Fri',
      'Sat',
      'Sun',
    ]);
    fireEvent.click(screen.getByRole('button', { name: 'Sun' }));
    expect(onChange).toHaveBeenLastCalledWith({ kind: 'weekday', days: [0, 1, 5] });
  });

  it('Text: the values this trigger gives, its own first, and a webhook’s field by its path', () => {
    const Text = textConditionPanel(KINDS);
    const onChange = vi.fn();
    const condition = {
      kind: 'text' as const,
      value: 'comment',
      op: 'contains' as const,
      text: '',
    };
    const view = render(
      under(
        'comment_added',
        <Text condition={condition} onChange={onChange} outline={outlineOf()} />,
      ),
    );
    expect(optionsOf('Value')[0]).toBe('Comment');
    expect(select('Value').value).toBe('comment');
    fireEvent.change(select('Match'), { target: { value: 'not_contains' } });
    expect(onChange).toHaveBeenLastCalledWith({ ...condition, op: 'not_contains' });
    fireEvent.change(screen.getByRole('textbox', { name: 'Text' }), {
      target: { value: 'urgent' },
    });
    expect(onChange).toHaveBeenLastCalledWith({ ...condition, text: 'urgent' });
    // Under a trigger that gives no comment, the value is to pick again.
    view.rerender(
      under('scheduled', <Text condition={condition} onChange={onChange} outline={outlineOf()} />),
    );
    expect(select('Value').value).toBe('');
    expect(optionsOf('Value')[0]).toBe('Pick a value');
    expect(screen.getByText(/does not give that value/)).toBeTruthy();
    fireEvent.change(select('Value'), { target: { value: 'item.name' } });
    expect(onChange).toHaveBeenLastCalledWith({ ...condition, value: 'item.name' });
    // An Incoming Webhook rule reads a field of the call's body.
    view.rerender(
      under(
        'incoming_webhook',
        <Text
          condition={{ ...condition, value: 'item.name' }}
          onChange={onChange}
          outline={outlineOf()}
        />,
      ),
    );
    expect(optionsOf('Value').at(-1)).toBe('Webhook Field');
    fireEvent.change(select('Value'), {
      target: { value: select('Value').options[select('Value').options.length - 1]!.value },
    });
    expect(onChange).toHaveBeenLastCalledWith({ ...condition, value: 'webhook.' });
    view.rerender(
      under(
        'incoming_webhook',
        <Text
          condition={{ ...condition, value: 'webhook.status' }}
          onChange={onChange}
          outline={outlineOf()}
        />,
      ),
    );
    const field = screen.getByRole<HTMLInputElement>('textbox', { name: 'Field' });
    expect(field.value).toBe('status');
    fireEvent.change(field, { target: { value: ' build.branch ' } });
    expect(onChange).toHaveBeenLastCalledWith({ ...condition, value: 'webhook.build.branch' });
    // Outside a builder (no rule round it) it still draws.
    cleanup();
    render(<Text condition={condition} onChange={onChange} outline={outlineOf()} />);
    expect(select('Value').value).toBe('');
  });
});

describe('the steps’ panels', () => {
  const base = { invalidPath: null, branch: false, personless: false };

  it('Take Snapshot: a name, with Insert a Value, marked when the api refuses it', () => {
    const onChange = vi.fn();
    const view = render(
      <TakeSnapshotPanel
        action={{ kind: 'take_snapshot', name: 'Nightly' }}
        onChange={onChange}
        outline={outlineOf()}
        {...base}
      />,
    );
    const name = screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Name' });
    fireEvent.change(name, { target: { value: 'Week of {{now.date}}' } });
    expect(onChange).toHaveBeenLastCalledWith({
      kind: 'take_snapshot',
      name: 'Week of {{now.date}}',
    });
    expect(screen.getByRole('button', { name: 'Insert a Value into Name' })).toBeTruthy();
    expect(name.getAttribute('aria-invalid')).toBeNull();
    view.rerender(
      <TakeSnapshotPanel
        action={{ kind: 'take_snapshot', name: '' }}
        onChange={onChange}
        outline={outlineOf()}
        {...base}
        invalidPath="name"
      />,
    );
    expect(screen.getByRole('textbox', { name: 'Name' }).getAttribute('aria-invalid')).toBe('true');
  });

  it('Revert to Snapshot: asks for the list, picks by name, and says what a revert does', () => {
    const onChange = vi.fn();
    const ask = vi.fn();
    render(
      <RevertSnapshotPanel
        action={{ kind: 'revert_snapshot', snapshot: '' }}
        onChange={onChange}
        outline={outlineOf({ snapshots: { ask } })}
        {...base}
      />,
    );
    expect(ask).toHaveBeenCalledTimes(1);
    const options = optionsOf('Snapshot');
    expect(options[0]).toBe('Pick a snapshot');
    expect(options[1]).toBe('Clean board · Kept by a Rule');
    expect(options[2]).toMatch(/^Snapshot of /);
    fireEvent.change(select('Snapshot'), { target: { value: 's1' } });
    expect(onChange).toHaveBeenLastCalledWith({
      kind: 'revert_snapshot',
      snapshot: 's1',
      name: 'Clean board',
    });
    const warning = screen
      .getByText('This Replaces Everyone’s Work')
      .closest('div')!.parentElement!;
    expect(warning.textContent).toMatch(/whole document goes back to this snapshot for everyone/);
    expect(warning.textContent).toMatch(/safety snapshot is taken first/);
    expect(warning.textContent).toMatch(/kept, beside the latest five, while a rule names it/);
    expect(screen.getByText('Nothing follows this step: it ends the rule.')).toBeTruthy();
  });

  it('Revert to Snapshot: a snapshot that went, the wait, a failed read and an item with none', () => {
    const retry = vi.fn();
    const panel = (snapshots: Partial<ItemSnapshots>, snapshot = '') => (
      <RevertSnapshotPanel
        action={{ kind: 'revert_snapshot', snapshot, ...(snapshot ? { name: 'Old board' } : {}) }}
        onChange={() => {}}
        outline={outlineOf({ snapshots })}
        {...base}
        invalidPath={snapshot ? 'snapshot' : null}
      />
    );
    const view = render(panel({}, 's-gone'));
    expect(optionsOf('Snapshot')[0]).toBe('Old board (No Longer Here)');
    expect(select('Snapshot').getAttribute('aria-invalid')).toBe('true');
    view.rerender(panel({ status: 'loading', list: [] }, 's-gone'));
    expect(optionsOf('Snapshot')).toEqual(['Loading snapshots…']);
    expect(select('Snapshot').disabled).toBe(true);
    view.rerender(panel({ status: 'error', list: [], retry }));
    expect(screen.getByText(/Couldn’t load this document’s snapshots/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Try Again' }));
    expect(retry).toHaveBeenCalledTimes(1);
    view.rerender(panel({ status: 'ready', list: [] }));
    expect(screen.getByRole('status').textContent).toBe(
      'No snapshots yet. Take a snapshot first, in History. Then pick it here.',
    );
    expect(screen.queryByRole('combobox')).toBeNull();
    expect(screen.getByText('This Replaces Everyone’s Work')).toBeTruthy();
  });

  it('Send Email: the owner, whoever started it where someone did, a person, or addresses', () => {
    const onChange = vi.fn();
    const email = {
      kind: 'email' as const,
      to: { owner: true as const },
      subject: 'Hi',
      body: 'There',
    };
    const view = render(
      <ItemEmailPanel action={email} onChange={onChange} outline={outlineOf()} {...base} />,
    );
    expect(optionsOf('To')).toEqual([
      'The Owner',
      'Whoever Started the Rule',
      'Email Addresses',
      'Ana Costa',
      'Kai Park',
    ]);
    fireEvent.change(select('To'), { target: { value: 'person:p2' } });
    expect(onChange).toHaveBeenLastCalledWith({ ...email, to: { person: 'p2' } });
    fireEvent.change(select('To'), { target: { value: 'addresses' } });
    expect(onChange).toHaveBeenLastCalledWith({ ...email, to: { addresses: [] } });
    fireEvent.change(screen.getByRole('textbox', { name: 'Subject' }), { target: { value: 'Yo' } });
    expect(onChange).toHaveBeenLastCalledWith({ ...email, subject: 'Yo' });
    fireEvent.change(screen.getByRole('textbox', { name: 'Message' }), {
      target: { value: 'Body' },
    });
    expect(onChange).toHaveBeenLastCalledWith({ ...email, body: 'Body' });
    expect(screen.getByText(/Sent with a link to this document/)).toBeTruthy();
    // Nobody behind the trigger: whoever started it is not offered; a person who went is kept, marked.
    view.rerender(
      <ItemEmailPanel
        action={{ ...email, to: { person: 'p-gone' } }}
        onChange={onChange}
        outline={outlineOf()}
        {...base}
        personless
        invalidPath="to"
      />,
    );
    expect(optionsOf('To')).toEqual([
      'The Owner',
      'Email Addresses',
      'Someone (No Longer Here)',
      'Ana Costa',
      'Kai Park',
    ]);
    expect(select('To').getAttribute('aria-invalid')).toBe('true');
    // Typed-in addresses show their field, and stay as To changes nothing else.
    view.rerender(
      <ItemEmailPanel
        action={{ ...email, to: { addresses: ['a@example.test'] } }}
        onChange={onChange}
        outline={outlineOf({ item: { ...ITEM, people: [] } })}
        {...base}
      />,
    );
    expect(select('To').value).toBe('addresses');
    expect(document.body.textContent).toContain('a@example.test');
    expect(within(select('To')).queryByRole('group')).toBeNull();
  });

  it('Add a Tab from a Template: a template with its picture, and a name', () => {
    const onChange = vi.fn();
    const tab = { kind: 'add_tab' as const, template: 'retro', name: 'Retro' };
    const view = render(
      <AddTabPanel action={tab} onChange={onChange} outline={outlineOf()} {...base} />,
    );
    expect(optionsOf('Template')).toEqual(['Retrospective', 'Kanban']);
    expect(
      document.querySelector('[data-tab-template-picture] [data-tab-picture="retro"]'),
    ).toBeTruthy();
    fireEvent.change(select('Template'), { target: { value: 'kanban' } });
    expect(onChange).toHaveBeenLastCalledWith({ ...tab, template: 'kanban' });
    fireEvent.change(screen.getByRole('textbox', { name: 'Name' }), {
      target: { value: 'Retro {{now.date}}' },
    });
    expect(onChange).toHaveBeenLastCalledWith({ ...tab, name: 'Retro {{now.date}}' });
    view.rerender(
      <AddTabPanel
        action={{ ...tab, template: 'gone' }}
        onChange={onChange}
        outline={outlineOf()}
        {...base}
        invalidPath="template"
      />,
    );
    expect(optionsOf('Template')[0]).toBe('A template (No Longer Here)');
    expect(document.querySelector('[data-tab-template-picture]')).toBeNull();
    view.rerender(
      <AddTabPanel
        action={{ ...tab, template: '' }}
        onChange={onChange}
        outline={outlineOf()}
        {...base}
      />,
    );
    expect(optionsOf('Template')[0]).toBe('Pick a template');
    view.rerender(
      <AddTabPanel
        action={{ ...tab, template: '' }}
        onChange={onChange}
        outline={{ ...outlineOf(), templates: [] }}
        {...base}
      />,
    );
    expect(screen.getByText('This document has no templates to add a tab from.')).toBeTruthy();
  });

  it('Summarise with AI: the whole item, one tab, or the run’s tab where the trigger is about one', () => {
    const Summarise = summarisePanel(KINDS);
    const onChange = vi.fn();
    const ai = { kind: 'ai' as const, task: 'summarise' as const };
    const view = render(
      under(
        'comment_added',
        <Summarise action={ai} onChange={onChange} outline={outlineOf()} {...base} />,
      ),
    );
    expect(optionsOf('Read')).toEqual([
      'The Whole Document',
      'The Tab the Rule Runs On',
      'Roadmap',
      'Notes',
    ]);
    fireEvent.change(select('Read'), { target: { value: 'run' } });
    expect(onChange).toHaveBeenLastCalledWith({ ...ai, tab: 'run' });
    fireEvent.change(select('Read'), { target: { value: 't1' } });
    expect(onChange).toHaveBeenLastCalledWith({ ...ai, tab: 't1' });
    expect(screen.getByText(/The summary becomes the value/).textContent).toContain('AI Summary');
    // A trigger about no tab: the run's tab is offered only while the rule still says so.
    view.rerender(
      under(
        'scheduled',
        <Summarise action={ai} onChange={onChange} outline={outlineOf()} {...base} />,
      ),
    );
    expect(optionsOf('Read')).toEqual(['The Whole Document', 'Roadmap', 'Notes']);
    view.rerender(
      under(
        'scheduled',
        <Summarise
          action={{ ...ai, tab: 'run' }}
          onChange={onChange}
          outline={outlineOf()}
          {...base}
        />,
      ),
    );
    expect(optionsOf('Read')).toContain('The Tab the Rule Runs On');
    fireEvent.change(select('Read'), { target: { value: '' } });
    expect(onChange).toHaveBeenLastCalledWith(ai);
    // A tab that went stays, marked; an item with no tab offers the whole of it.
    view.rerender(
      under(
        'scheduled',
        <Summarise
          action={{ ...ai, tab: 't-gone' }}
          onChange={onChange}
          outline={outlineOf({ item: { ...ITEM, tabs: [] } })}
          {...base}
        />,
      ),
    );
    expect(optionsOf('Read')).toEqual(['The Whole Document', 'A tab (No Longer Here)']);
    cleanup();
    render(
      <Summarise
        action={ai}
        onChange={onChange}
        outline={outlineOf({ item: { ...ITEM, tabs: [] } })}
        {...base}
      />,
    );
    expect(optionsOf('Read')).toEqual(['The Whole Document']);
  });
});

describe('the read behind Revert to Snapshot', () => {
  it('reads the snapshots once when a panel first shows, and again on Try Again', async () => {
    const fakes = itemKit(itemClient());
    fakes.snapshots.mockRejectedValueOnce(new Error('offline'));
    setFallbackAutomationsKit(fakes.kit);
    function Panel() {
      const outline = fakes.kit.useOutline() as ItemUiOutline;
      return (
        <RevertSnapshotPanel
          action={{ kind: 'revert_snapshot', snapshot: '' }}
          onChange={() => {}}
          outline={outline}
          invalidPath={null}
          branch={false}
          personless={false}
        />
      );
    }
    render(<Panel />);
    fireEvent.click(await screen.findByRole('button', { name: 'Try Again' }));
    await waitFor(() => expect(select('Snapshot').disabled).toBe(false));
    expect(fakes.snapshots).toHaveBeenCalledTimes(2);
    expect(optionsOf('Snapshot')).toHaveLength(3);
  });
});
