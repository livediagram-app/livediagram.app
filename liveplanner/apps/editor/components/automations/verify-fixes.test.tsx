// @vitest-environment jsdom
// docs/specs/026-plan/automations.md: the details the browser check turned up. Automation's bolt (never a rule
// name's initials) wherever a change is stamped, a run's trigger line naming who once, and a column pick's hint
// only while nothing is picked.
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { GITHUB_PERSON, automationPerson } from '@liveplanner/items';
import { PersonDisc } from '@/components/plan/PersonDisc';
import { RunSteps } from './RunSteps';
import { ChipToggles } from './step-panels/panel-parts';

afterEach(cleanup);

describe('Automation stamps and run lines', () => {
  it('draws the bolt for a rule, and initials for a person', () => {
    const { container, rerender } = render(
      <PersonDisc person={automationPerson('Done Means Wrapped Up')} />,
    );
    expect(container.querySelector('[data-automation-disc]')).not.toBeNull();
    expect(container.textContent).toBe('');
    rerender(<PersonDisc person={{ id: 'u-ana', name: 'Ana Costa', color: '#be123c' }} />);
    expect(container.querySelector('[data-automation-disc]')).toBeNull();
    expect(container.textContent).toBe('AC');
    // GitHub's moves (github-pull-requests.md "GitHub rules"): its mark, never "GI".
    rerender(<PersonDisc person={GITHUB_PERSON} />);
    expect(container.querySelector('[data-github-disc]')).not.toBeNull();
    expect(container.textContent).toBe('');
  });

  it('names who triggered a run once, in bold', () => {
    const by = { id: 'u-ana', name: 'Ana Costa', color: '#be123c' };
    const { container } = render(
      <RunSteps steps={[{ kind: 'trigger', text: 'Ana Costa moved it from To Do to Done', by }]} />,
    );
    const line = container.querySelector('li')!;
    expect(line.textContent).toContain('Ana Costa moved it from To Do to Done');
    expect(line.textContent).not.toContain('Ana Costa Ana Costa');
    expect(screen.getByText('Ana Costa').className).toContain('font-semibold');
  });
});

describe('a column pick', () => {
  const columns = [
    { value: 'todo', label: 'To Do' },
    { value: 'done', label: 'Done' },
  ];
  it('says what none picked means only while none is picked', () => {
    const hint = 'None picked: to any column.';
    const { rerender } = render(
      <ChipToggles label="To" options={columns} value={[]} hint={hint} onChange={() => {}} />,
    );
    expect(screen.queryByText(hint)).not.toBeNull();
    rerender(
      <ChipToggles label="To" options={columns} value={['done']} hint={hint} onChange={() => {}} />,
    );
    expect(screen.queryByText(hint)).toBeNull();
  });
});
