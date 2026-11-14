// @vitest-environment jsdom
// What a browser pass over Automations found (docs/specs/026-plan/automations.md "The rule builder", "The Automations
// screen"): a Link Cards card the plan lost reads as gone, not as nothing picked; a panel's Change reads "Change
// Trigger" or "Change Action" and what it changes, never the field's label alone; each step card's button is told
// apart by what the step does; and an Audit Trail row opens from a click anywhere on it, its chevron naming its run.
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { AutomationRuleBody } from '@liveplanner/items';
import { newRuleBody, type RulePart } from './rule-draft';
import { StepPanel } from './StepPanel';
import { StepCard } from './StepCard';
import { RunRow } from './RunRow';
import { NOW, card, outline, run } from './test-fixtures';

afterEach(cleanup);

function Panel({ body, part }: { body: AutomationRuleBody; part: RulePart }) {
  return (
    <StepPanel
      body={body}
      part={part}
      onChange={() => {}}
      outline={outline()}
      faultPath={null}
      person="Ana Costa"
      now={NOW}
      timeZone="Europe/London"
    />
  );
}

const described = (el: HTMLElement) =>
  (el.getAttribute('aria-describedby') ?? '')
    .split(' ')
    .map((id) => document.getElementById(id)?.textContent ?? '')
    .join(' ');

describe('Link Cards to a card the plan no longer has', () => {
  const linkTo = (card: string) => ({
    ...newRuleBody('R', 'UTC'),
    trigger: { kind: 'manual' as const },
    steps: [{ kind: 'link_card' as const, field: 'parent', to: { card } }],
  });

  it('says the card is gone, offers Change and keeps the field', () => {
    render(<Panel body={linkTo('i-deleted')} part={{ part: 'step', index: 0 }} />);
    expect(screen.getByText('A card no longer here')).toBeTruthy();
    expect(screen.queryByText('No card picked')).toBeNull();
    const change = screen.getByRole('button', { name: 'Change Card' });
    expect(change.textContent).toBe('Change');
    expect(described(change)).toBe('A card no longer here');
  });

  it('still says No card picked, with Pick a Card, when none was ever picked', () => {
    render(<Panel body={linkTo('')} part={{ part: 'step', index: 0 }} />);
    expect(screen.getByText('No card picked')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Pick a Card' })).toBeTruthy();
  });

  // Work Tracker 788 (spec "Conditions"): a card in the Trash is gone to a rule, and the finder never offers one.
  it('reads a card in the Trash as gone, and leaves it out of the finder', () => {
    const trashed = card(49, 'Old launch notes', { status: 'trash', trashedFrom: 'todo' });
    const items = new Map([...outline().items, [trashed.id, trashed]]);
    render(
      <StepPanel
        body={linkTo(trashed.id)}
        part={{ part: 'step', index: 0 }}
        onChange={() => {}}
        outline={outline({ items })}
        faultPath={null}
        person="Ana Costa"
        now={NOW}
        timeZone="Europe/London"
      />,
    );
    expect(screen.getByText('A card no longer here')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Change Card' }));
    expect(screen.getByText('Publish pricing page')).toBeTruthy();
    expect(screen.queryByText('Old launch notes')).toBeNull();
  });

  it('names a card it has by number and title', () => {
    render(<Panel body={linkTo('i48')} part={{ part: 'step', index: 0 }} />);
    expect(described(screen.getByRole('button', { name: 'Change Card' }))).toBe(
      '#48Publish pricing page',
    );
  });
});

describe('Change in the Trigger and Action fields', () => {
  it('reads Change Trigger, described by the trigger, not the label Trigger', () => {
    render(
      <Panel
        body={{ ...newRuleBody('R', 'UTC'), trigger: { kind: 'card_moved', to: ['done'] } }}
        part={{ part: 'trigger' }}
      />,
    );
    const change = screen.getByRole('button', { name: 'Change Trigger' });
    expect(change.textContent).toBe('Change');
    expect(described(change)).toBe('Card Moved');
    expect(screen.queryByRole('button', { name: 'Trigger' })).toBeNull();
  });

  it('reads Change Action, described by the action', () => {
    render(
      <Panel
        body={{ ...newRuleBody('R', 'UTC'), steps: [{ kind: 'flag' }] }}
        part={{ part: 'step', index: 0 }}
      />,
    );
    const change = screen.getByRole('button', { name: 'Change Action' });
    expect(described(change)).toBe('Flag');
    expect(screen.queryByRole('button', { name: 'Action' })).toBeNull();
  });
});

describe('a step card', () => {
  it('is named by its kind and described by what it does', () => {
    render(
      <>
        <StepCard tone="action" label="Then" selected={false} onSelect={() => {}}>
          Assign Ana Costa
        </StepCard>
        <StepCard tone="action" label="Then" selected={false} onSelect={() => {}}>
          Set Priority High
        </StepCard>
      </>,
    );
    const [a, b] = screen.getAllByRole('button', { name: 'Then' });
    expect(described(a!)).toBe('Assign Ana Costa');
    expect(described(b!)).toBe('Set Priority High');
  });
});

describe('an Audit Trail row', () => {
  it('names its run on the chevron, and its hit area covers the row', () => {
    render(
      <ul>
        <RunRow run={run()} now={NOW} phone={false} />
      </ul>,
    );
    const chevron = screen.getByRole('button', { name: /^Expand run: / });
    expect(chevron.getAttribute('aria-label')).toMatch(/^Expand run: .+, #\d+$/);
    // The chevron's ::after spreads over its row, which holds it (so a click anywhere on the row opens it).
    expect(chevron.className).toMatch(/after:absolute/);
    expect(chevron.className).toMatch(/after:inset-0/);
    expect(chevron.className).not.toMatch(/(^|\s)relative(\s|$)/);
    expect(chevron.parentElement!.parentElement!.className).toMatch(/(^|\s)relative(\s|$)/);
    fireEvent.click(chevron);
    expect(
      screen.getByRole('button', { name: /^Collapse run: / }).getAttribute('aria-expanded'),
    ).toBe('true');
  });
});
