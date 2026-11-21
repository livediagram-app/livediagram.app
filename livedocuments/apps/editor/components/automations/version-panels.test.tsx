// @vitest-environment jsdom
// docs/specs/013-workspace/automations.md "The screen": Name This Version takes the tab (the run's, where the
// trigger has one, or a chosen one) and a name; Restore a Version takes a tab, then one of that tab's named versions,
// read from Version History, saving the fields its reference declares (VERSION_REF), with its loading, empty, failed
// and gone states.
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { VersionSummary } from '@livedocuments/api-schema';
import { KINDS, VERSION_REF } from '@livedocuments/document/automations';
import {
  buildOutline,
  type ItemUiOutline,
  type ItemView,
} from '@liveworkspace/automations-ui/item';
import { setFallbackAutomationsKit } from '@liveworkspace/automations-ui/kit-context';
import { RuleContextProvider } from '@liveworkspace/automations-ui/rule-context';

const list =
  vi.fn<(who: unknown, documentId: string, tabId: string) => Promise<VersionSummary[]>>();
vi.mock('@/lib/api/versions', () => ({
  apiListVersions: (who: unknown, documentId: string, tabId: string) =>
    list(who, documentId, tabId),
}));

const { DOCUMENT_AUTOMATIONS_KIT } = await import('./document-kit');
const { NameVersionPanel, RestoreVersionPanel, versionLabel } = await import('./version-panels');
const { namedOnly } = await import('./use-named-versions');

const ITEM: ItemView = {
  id: 'd1',
  name: 'Handbook',
  tabs: [
    { id: 't1', name: 'Letter' },
    { id: 't2', name: 'Deck' },
  ],
  currentTabId: 't1',
  people: [],
  shareCode: 'sc1',
  signedIn: true,
  openTab: () => {},
};

const outline = (item: ItemView = ITEM): ItemUiOutline =>
  buildOutline({
    kinds: KINDS,
    item,
    templates: [],
    snapshots: { status: 'idle', list: [], ask: () => {}, retry: () => {} },
    connections: { status: 'idle', list: [] },
  });

const version = (id: string, name: string | null, createdAt: number): VersionSummary => ({
  id,
  tabId: 't1',
  rev: 1,
  kind: 'manual',
  name,
  author: null,
  savedAt: createdAt,
  createdAt,
  bytes: 10,
  elementCount: 3,
});

// A panel under a rule with this trigger: Name This Version reads whether the run has a tab.
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
      incoming: false,
      ruleId: null,
      hook: undefined,
      now: 0,
    }}
  >
    {panel}
  </RuleContextProvider>
);

const base = { invalidPath: null, branch: false, personless: false };
const select = (name: string) => screen.getByRole<HTMLSelectElement>('combobox', { name });
const optionsOf = (name: string) => [...select(name).options].map((o) => o.textContent);

beforeEach(() => {
  setFallbackAutomationsKit(DOCUMENT_AUTOMATIONS_KIT);
  list.mockReset();
});
afterEach(() => {
  cleanup();
  setFallbackAutomationsKit(null);
});

describe('Name This Version’s panel', () => {
  it('offers the run’s tab where the trigger has one, and every tab', () => {
    const onChange = vi.fn();
    render(
      under(
        'version_restored',
        <NameVersionPanel
          action={{ kind: 'name_version', tab: 'run', name: 'Week of {{now.date}}' }}
          onChange={onChange}
          outline={outline()}
          {...base}
        />,
      ),
    );
    expect(optionsOf('Tab')).toEqual(['The Tab the Rule Runs On', 'Letter', 'Deck']);
    expect(select('Tab').getAttribute('aria-invalid')).toBeNull();
    fireEvent.change(select('Tab'), { target: { value: 't2' } });
    expect(onChange).toHaveBeenLastCalledWith({
      kind: 'name_version',
      tab: 't2',
      name: 'Week of {{now.date}}',
    });
    expect(screen.getByRole('textbox', { name: 'Name' })).toBeTruthy();
  });

  it('asks for a tab where the trigger has none, and keeps a gone tab until another is picked', () => {
    const { rerender } = render(
      under(
        'scheduled',
        <NameVersionPanel
          action={{ kind: 'name_version', tab: '', name: 'Week' }}
          onChange={() => {}}
          outline={outline()}
          {...base}
        />,
      ),
    );
    expect(optionsOf('Tab')).toEqual(['Pick a tab', 'Letter', 'Deck']);
    rerender(
      under(
        'scheduled',
        <NameVersionPanel
          action={{ kind: 'name_version', tab: 'run', name: 'Week' }}
          onChange={() => {}}
          outline={outline()}
          {...base}
        />,
      ),
    );
    // Kept while the step says so, and marked: a scheduled run has no tab to name.
    expect(optionsOf('Tab')).toEqual(['The Tab the Rule Runs On', 'Letter', 'Deck']);
    expect(select('Tab').getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByText(/the run has none to name: pick one/)).toBeTruthy();
    rerender(
      under(
        'scheduled',
        <NameVersionPanel
          action={{ kind: 'name_version', tab: 't9', name: 'Week' }}
          onChange={() => {}}
          outline={outline()}
          {...base}
        />,
      ),
    );
    expect(optionsOf('Tab')).toEqual(['A tab (No Longer Here)', 'Letter', 'Deck']);
  });

  it('changes the name, and marks a name the api refused', () => {
    const onChange = vi.fn();
    render(
      under(
        'manual',
        <NameVersionPanel
          action={{ kind: 'name_version', tab: 't1', name: '' }}
          onChange={onChange}
          outline={outline()}
          {...base}
          invalidPath="name"
        />,
      ),
    );
    const name = screen.getByRole('textbox', { name: 'Name' });
    expect(name.getAttribute('aria-invalid')).toBe('true');
    fireEvent.change(name, { target: { value: 'Reviewed' } });
    expect(onChange).toHaveBeenLastCalledWith({
      kind: 'name_version',
      tab: 't1',
      name: 'Reviewed',
    });
  });
});

describe('Restore a Version’s panel', () => {
  const draw = (action: Record<string, unknown>, onChange = vi.fn(), item = ITEM) =>
    render(
      <RestoreVersionPanel
        action={{ kind: 'restore_version', tab: '', version: '', ...action }}
        onChange={onChange}
        outline={outline(item)}
        {...base}
      />,
    );

  it('picks a tab first, reading nothing until one is picked; a new tab clears the version', () => {
    const onChange = vi.fn();
    draw({}, onChange);
    expect(optionsOf('Tab')).toEqual(['Pick a tab', 'Letter', 'Deck']);
    expect(screen.queryByRole('combobox', { name: 'Version' })).toBeNull();
    expect(list).not.toHaveBeenCalled();
    fireEvent.change(select('Tab'), { target: { value: 't2' } });
    expect(onChange).toHaveBeenLastCalledWith({ kind: 'restore_version', tab: 't2', version: '' });
  });

  it('lists the tab’s named versions alone, newest first, and saves the one picked with its name', async () => {
    list.mockResolvedValue([
      version('v1', 'Form letter', 100),
      version('v2', null, 300),
      version('v3', 'Signed off', 200),
    ]);
    const onChange = vi.fn();
    draw({ tab: 't1' }, onChange);
    expect(optionsOf('Version')).toEqual(['Loading versions…']);
    expect(select('Version').disabled).toBe(true);
    await act(async () => {});
    expect(list).toHaveBeenCalledExactlyOnceWith({ ownerId: '', shareCode: 'sc1' }, 'd1', 't1');
    const options = optionsOf('Version');
    expect(options[0]).toBe('Pick a version');
    expect(options[1]).toMatch(/^Signed off · /);
    expect(options[2]).toMatch(/^Form letter · /);
    expect(options).toHaveLength(3);
    fireEvent.change(select('Version'), { target: { value: 'v1' } });
    const saved = onChange.mock.lastCall![0] as Record<string, unknown>;
    expect(saved).toEqual({
      kind: 'restore_version',
      tab: 't1',
      version: 'v1',
      name: 'Form letter',
    });
    // The field the app's own reference declares holds the version, so a copy leaves it to pick.
    expect(saved[VERSION_REF.field]).toBe('v1');
  });

  it('says when the tab has no named versions yet', async () => {
    list.mockResolvedValue([version('v2', null, 300)]);
    draw({ tab: 't1' });
    await act(async () => {});
    // Said once in the live region and once on show.
    expect(screen.getAllByText('No named versions yet').length).toBeGreaterThan(0);
    expect(screen.getByRole('status').textContent).toMatch(
      /Name a version of this tab in Version History first/,
    );
  });

  it('keeps a version unnamed or gone since, until another is picked', async () => {
    list.mockResolvedValue([version('v3', 'Signed off', 200)]);
    draw({ tab: 't1', version: 'v1', name: 'Form letter' });
    await act(async () => {});
    expect(optionsOf('Version')[0]).toBe('Form letter (No Longer Here)');
    expect(select('Version').value).toBe('v1');
  });

  it('offers Try Again after a failed read, and reads again', async () => {
    list.mockRejectedValueOnce(new Error('offline'));
    list.mockResolvedValueOnce([version('v3', 'Signed off', 200)]);
    draw({ tab: 't1' });
    await act(async () => {});
    expect(screen.getByText(/Couldn’t load this tab’s versions/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Try Again' }));
    await act(async () => {});
    expect(list).toHaveBeenCalledTimes(2);
    expect(optionsOf('Version')[1]).toMatch(/^Signed off · /);
  });

  it('says so when its tab is gone, and reads nothing for it', () => {
    draw({ tab: 't9', version: 'v1', name: 'Form letter' });
    expect(optionsOf('Tab')[0]).toBe('A tab (No Longer Here)');
    expect(
      screen.getByText(/“Form letter” was a version of a tab this document no longer has/),
    ).toBeTruthy();
    expect(list).not.toHaveBeenCalled();
  });

  it('reads a new tab’s versions when the tab changes, never showing the last tab’s', async () => {
    list.mockResolvedValueOnce([version('v3', 'Signed off', 200)]);
    const view = draw({ tab: 't1' });
    await act(async () => {});
    list.mockResolvedValueOnce([version('v7', 'Deck v1', 50)]);
    view.rerender(
      <RestoreVersionPanel
        action={{ kind: 'restore_version', tab: 't2', version: '' }}
        onChange={() => {}}
        outline={outline()}
        {...base}
      />,
    );
    expect(optionsOf('Version')).toEqual(['Loading versions…']);
    await act(async () => {});
    expect(list).toHaveBeenLastCalledWith({ ownerId: '', shareCode: 'sc1' }, 'd1', 't2');
    expect(optionsOf('Version')[1]).toMatch(/^Deck v1 · /);
  });
});

describe('the version words', () => {
  it('keeps the named ones newest first, and labels one with its day', () => {
    expect(
      namedOnly([version('a', 'A', 1), version('b', null, 3), version('c', 'C', 2)]).map(
        (v) => v.id,
      ),
    ).toEqual(['c', 'a']);
    expect(
      versionLabel({ id: 'a', name: 'Form letter', createdAt: Date.UTC(2026, 10, 3) }, 'en-GB'),
    ).toBe('Form letter · 3 Nov');
  });
});
