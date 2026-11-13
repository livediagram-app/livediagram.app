// @vitest-environment jsdom
// docs/specs/026-plan/automations.md "The Automations screen": on a phone the Rules filters are a full-width search,
// then the trigger select beside an All / On / Off segmented control, all 40 px; a wide screen keeps one compact row.
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AUTOMATION_TRIGGER_KINDS } from '@liveplanner/items';
import { RuleFilters } from './RuleFilters';
import { filterTriggerKinds } from './trigger-groups';

afterEach(cleanup);

function draw(phone: boolean) {
  const props = {
    onQuery: vi.fn(),
    onTrigger: vi.fn(),
    onOn: vi.fn(),
  };
  render(
    <RuleFilters
      phone={phone}
      kinds={AUTOMATION_TRIGGER_KINDS}
      query=""
      trigger="all"
      on="all"
      {...props}
    />,
  );
  return props;
}

describe('RuleFilters', () => {
  it('lays a phone out as a full-width search over the select and the segmented On / Off', () => {
    const props = draw(true);
    const root = document.querySelector('[data-rule-filters="phone"]')!;
    const [searchRow, filterRow] = [...root.children] as HTMLElement[];
    const search = within(searchRow!).getByRole('textbox', { name: 'Find a rule' });
    expect(search.className).toContain('h-10');
    expect(search.className).toContain('text-[14px]');
    expect(search.className).toContain('focus:ring-2');
    const select = within(filterRow!).getByRole('combobox', { name: 'Trigger' });
    expect(select.className).toContain('h-10');
    expect(select.parentElement!.className).toContain('flex-1');
    const group = within(filterRow!).getByRole('radiogroup', { name: 'On or off' });
    expect(group.className).toContain('h-10');
    expect(
      within(group)
        .getAllByRole('radio')
        .map((r) => r.textContent),
    ).toEqual(['All', 'On', 'Off']);
    expect(within(group).getByRole('radio', { name: 'All' }).getAttribute('aria-checked')).toBe(
      'true',
    );
    fireEvent.click(within(group).getByRole('radio', { name: 'Off' }));
    expect(props.onOn).toHaveBeenCalledWith('off');
    fireEvent.change(select, { target: { value: 'manual' } });
    expect(props.onTrigger).toHaveBeenCalledWith('manual');
    fireEvent.change(search, { target: { value: 'bug' } });
    expect(props.onQuery).toHaveBeenCalledWith('bug');
  });

  it('keeps one compact row of fields on a wide screen', () => {
    const props = draw(false);
    expect(document.querySelector('[data-rule-filters="row"]')).toBeTruthy();
    expect(screen.queryByRole('radiogroup')).toBeNull();
    // The search stands as tall as the selects beside it (32 px), from its own size, not retyped classes.
    const search = screen.getByRole('textbox', { name: 'Find a rule' });
    expect(search.className).toContain('h-8');
    expect(search.className).toContain('text-[13px]');
    for (const name of ['Trigger', 'On or off'])
      expect(screen.getByRole('combobox', { name }).className).toContain('h-8');
    fireEvent.change(screen.getByRole('combobox', { name: 'On or off' }), {
      target: { value: 'on' },
    });
    expect(props.onOn).toHaveBeenCalledWith('on');
  });

  it('lists the triggers it is given', () => {
    render(
      <RuleFilters
        phone={false}
        kinds={['card_moved', 'manual']}
        query=""
        trigger="all"
        on="all"
        onQuery={vi.fn()}
        onTrigger={vi.fn()}
        onOn={vi.fn()}
      />,
    );
    const select = screen.getByRole('combobox', { name: 'Trigger' });
    expect([...select.querySelectorAll('option')].map((o) => o.textContent)).toEqual([
      'All Triggers',
      'Card Moved',
      'Run from a Card',
    ]);
  });
});

describe('filterTriggerKinds', () => {
  const github = [
    'pull_request_opened',
    'pull_request_merged',
    'pull_request_closed',
    'pull_request_checks',
  ] as const;

  it('leaves out GitHub’s triggers where the plan cannot use them', () => {
    const kinds = filterTriggerKinds(false, new Set());
    for (const k of github) expect(kinds).not.toContain(k);
    expect(kinds).toContain('card_moved');
    expect(kinds).toContain('incoming_webhook');
  });

  it('lists one a rule is already on, and all of them where GitHub is on', () => {
    const kinds = filterTriggerKinds(false, new Set(['pull_request_merged']));
    expect(kinds.filter((k) => (github as readonly string[]).includes(k))).toEqual([
      'pull_request_merged',
    ]);
    expect(filterTriggerKinds(true, new Set())).toEqual(AUTOMATION_TRIGGER_KINDS);
  });
});
