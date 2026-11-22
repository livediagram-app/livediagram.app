// @vitest-environment jsdom
// docs/specs/013-workspace/automations.md "Steps of its own", "The screen": Set the Page Owner takes a person or
// whoever started the rule, and a page; Clear Verification and Always in Context take a page (the run's, where the
// trigger is about one, or a chosen one); Email the Page Owner writes to the run's page's owner. A gone page or
// person reads "(No Longer Here)" until another is picked.
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { KINDS } from '@liveknowledge/document/automations';
import {
  buildOutline,
  type ItemUiOutline,
  type ItemView,
} from '@liveworkspace/automations-ui/item';
import { setFallbackAutomationsKit } from '@liveworkspace/automations-ui/kit-context';
import { RuleContextProvider } from '@liveworkspace/automations-ui/rule-context';

const { DOCUMENT_AUTOMATIONS_KIT } = await import('./document-kit');
const { ClearVerificationPanel, ContextPanel, EmailOwnerPanel, SetOwnerPanel } =
  await import('./knowledge-panels');

const ITEM: ItemView = {
  id: 'd1',
  name: 'Handbook',
  tabs: [
    { id: 't1', name: 'Deploys' },
    { id: 't2', name: 'Holidays' },
  ],
  currentTabId: 't1',
  people: [
    { id: 'u1', name: 'Priya Shah' },
    { id: 'u2', name: 'Ana Costa' },
  ],
  shareCode: 'sc1',
  signedIn: true,
  openTab: () => {},
};

const outline = (): ItemUiOutline =>
  buildOutline({
    kinds: KINDS,
    item: ITEM,
    templates: [],
    snapshots: { status: 'idle', list: [], ask: () => {}, retry: () => {} },
    connections: { status: 'idle', list: [] },
  });

// A panel under a rule with this trigger: the panels read whether the run has a page.
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

beforeEach(() => setFallbackAutomationsKit(DOCUMENT_AUTOMATIONS_KIT));
afterEach(() => {
  cleanup();
  setFallbackAutomationsKit(null);
});

describe('Set the Page Owner’s panel', () => {
  it('offers whoever started the rule and the people, then the page, and saves each', () => {
    const onChange = vi.fn();
    render(
      under(
        'page_verified',
        <SetOwnerPanel
          action={{ kind: 'set_owner', tab: 'run', to: { trigger: true } }}
          onChange={onChange}
          outline={outline()}
          {...base}
        />,
      ),
    );
    expect(optionsOf('Owner')).toEqual(['Whoever Started the Rule', 'Priya Shah', 'Ana Costa']);
    expect(optionsOf('Page')).toEqual(['The Page the Rule Runs On', 'Deploys', 'Holidays']);
    fireEvent.change(select('Owner'), { target: { value: 'person:u2' } });
    expect(onChange).toHaveBeenLastCalledWith({
      kind: 'set_owner',
      tab: 'run',
      to: { person: 'u2' },
    });
    fireEvent.change(select('Page'), { target: { value: 't2' } });
    expect(onChange).toHaveBeenLastCalledWith({
      kind: 'set_owner',
      tab: 't2',
      to: { trigger: true },
    });
  });

  it('leaves out the starter where nobody is behind the trigger, and marks a person gone', () => {
    render(
      under(
        'review_due',
        <SetOwnerPanel
          action={{ kind: 'set_owner', tab: 't1', to: { person: 'gone' } }}
          onChange={() => {}}
          outline={outline()}
          {...base}
          personless
        />,
      ),
    );
    expect(optionsOf('Owner')[0]).toMatch(/No Longer Here/);
    expect(optionsOf('Owner')).not.toContain('Whoever Started the Rule');
  });
});

describe('the page a knowledge step works on', () => {
  it('asks for a page where the trigger has none, and keeps a gone page until another is picked', () => {
    const { rerender } = render(
      under(
        'scheduled',
        <ClearVerificationPanel
          action={{ kind: 'clear_verification', tab: '' }}
          onChange={() => {}}
          outline={outline()}
          {...base}
        />,
      ),
    );
    expect(optionsOf('Page')).toEqual(['Pick a page', 'Deploys', 'Holidays']);
    rerender(
      under(
        'scheduled',
        <ClearVerificationPanel
          action={{ kind: 'clear_verification', tab: 'run' }}
          onChange={() => {}}
          outline={outline()}
          {...base}
        />,
      ),
    );
    // Kept while the step says so, and marked: a scheduled run has no page.
    expect(select('Page').getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByText(/the run has none: pick one/)).toBeTruthy();
    rerender(
      under(
        'scheduled',
        <ClearVerificationPanel
          action={{ kind: 'clear_verification', tab: 'gone' }}
          onChange={() => {}}
          outline={outline()}
          {...base}
        />,
      ),
    );
    expect(optionsOf('Page')[0]).toBe('A page (No Longer Here)');
  });

  it('turns Always in Context on and off', () => {
    const onChange = vi.fn();
    render(
      under(
        'page_verified',
        <ContextPanel
          action={{ kind: 'context', tab: 'run', on: true }}
          onChange={onChange}
          outline={outline()}
          {...base}
        />,
      ),
    );
    expect(optionsOf('Do')).toEqual(['Add to Always in Context', 'Remove from Always in Context']);
    fireEvent.change(select('Do'), { target: { value: 'remove' } });
    expect(onChange).toHaveBeenLastCalledWith({ kind: 'context', tab: 'run', on: false });
  });
});

describe('Email the Page Owner’s panel', () => {
  it('writes to the run’s page’s owner, and says so where the trigger is about no page', () => {
    const action = { kind: 'email_owner', subject: 'Check', body: 'Please look' } as const;
    const { rerender } = render(
      under(
        'agent_changed',
        <EmailOwnerPanel action={action} onChange={() => {}} outline={outline()} {...base} />,
      ),
    );
    expect(screen.getByText('To the owner of the page the rule runs on.')).toBeTruthy();
    expect(screen.queryByText(/no page owner to email/)).toBeNull();
    rerender(
      under(
        'scheduled',
        <EmailOwnerPanel action={action} onChange={() => {}} outline={outline()} {...base} />,
      ),
    );
    expect(screen.getByText(/no page owner to email/)).toBeTruthy();
  });
});
