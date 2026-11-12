// @vitest-environment jsdom
// docs/specs/026-plan/automations.md "The Automations screen": on a phone the Rules filters are a full-width search,
// then the trigger select beside an All / On / Off segmented control, all 40 px; a wide screen keeps one compact row.
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RuleFilters } from './RuleFilters';

afterEach(cleanup);

function draw(phone: boolean) {
  const props = {
    onQuery: vi.fn(),
    onTrigger: vi.fn(),
    onOn: vi.fn(),
  };
  render(<RuleFilters phone={phone} query="" trigger="all" on="all" {...props} />);
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
    expect(screen.getByRole('textbox', { name: 'Find a rule' }).className).toContain('text-xs');
    fireEvent.change(screen.getByRole('combobox', { name: 'On or off' }), {
      target: { value: 'on' },
    });
    expect(props.onOn).toHaveBeenCalledWith('on');
  });
});
