// @vitest-environment jsdom

// The meta row's Add Cover (docs/specs/030-knowledgebase/page-surface.md "The cover"), its maker pills
// (verification.md "Made by a person or an agent") and its labelled buttons' lack of tooltips (page-surface.md "What a
// page looks like", owner 2026-11-23).
import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { pageTrust } from '@/lib/knowledge/page-trust';
import { renderInEditor } from '@/components/ask/test-chrome';
import { PageMetaRowView } from './PageMetaRow';
import { SuggestedEditsPillView } from './suggestions/SuggestedEditsPill';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

const NOW = Date.UTC(2026, 10, 21, 12);
const never = pageTrust(undefined, 90, NOW);
const nameOf = (id: string | undefined) => (id === 'u1' ? 'Priya Shah' : undefined);

describe('the meta row’s Add Cover', () => {
  it('stands after the reading time for whoever may add a cover, and shows the row alone', () => {
    const { container, unmount } = renderInEditor(
      <PageMetaRowView
        minutes={3}
        trust={never}
        now={NOW}
        verifiedBy={undefined}
        changedSinceVerified={false}
        addCover
      />,
    );
    const row = container.querySelector('[data-page-meta]')!;
    const parts = [...row.children].map((c) => c.textContent);
    expect(parts).toEqual(['3 min read', '·Add Cover']);
    // An empty page with no cover still shows the row, Add Cover alone.
    unmount();
    const empty = renderInEditor(
      <PageMetaRowView
        trust={never}
        now={NOW}
        verifiedBy={undefined}
        changedSinceVerified={false}
        addCover
      />,
    ).container.querySelector('[data-page-meta]')!;
    expect(empty.className.split(' ')).not.toContain('hidden');
    expect(empty.textContent).toMatch(/^Add Cover/);
    fireEvent.click(screen.getByRole('button', { name: /Add Cover/ }));
    expect(screen.getByRole('button', { name: 'Choose a Picture' })).toBeTruthy();
  });

  it('is not there for anyone else', () => {
    renderInEditor(
      <PageMetaRowView
        minutes={3}
        trust={never}
        now={NOW}
        verifiedBy={undefined}
        changedSinceVerified={false}
      />,
    );
    expect(screen.queryByRole('button', { name: /Add Cover/ })).toBeNull();
  });
});

describe('the meta row’s maker pills', () => {
  it('shows who made and last edited the page, each with its card on a press', () => {
    const { container } = renderInEditor(
      <PageMetaRowView
        minutes={2}
        trust={never}
        now={NOW}
        verifiedBy={undefined}
        changedSinceVerified={false}
        nameOf={nameOf}
        makers={{
          created: { by: 'u1', at: Date.UTC(2026, 10, 12), kind: 'human' },
          updated: { by: 'u1', at: NOW - 3_600_000, kind: 'ai', agent: 'Claude', via: 'mcp' },
        }}
      />,
    );
    const pills = [...container.querySelectorAll('[data-page-maker]')];
    expect(pills.map((p) => [p.textContent, p.getAttribute('data-maker-kind')])).toEqual([
      ['Human Generated', 'human'],
      ['AI Edited', 'ai'],
    ]);
    fireEvent.click(pills[0]!);
    expect(screen.getByRole('dialog', { name: 'Human Generated' }).textContent).toContain(
      'Created by Priya Shah on 12 Nov',
    );
    fireEvent.click(pills[1]!);
    expect(screen.getByRole('dialog', { name: 'AI Edited' }).textContent).toContain(
      'Last edited by Claude for Priya Shah through MCP, 1 hour ago',
    );
    // Neutral grey: never the accent, never a state colour.
    for (const p of pills) expect(p.className).not.toMatch(/(bg|text)-(brand|amber|red|green)-/);
  });

  // A phone has no hover: a tap (a click) opens the pill's card as a popover, and Escape closes it.
  it("opens a pill's card on a tap, as a keyboard-reachable button", () => {
    renderInEditor(
      <PageMetaRowView
        minutes={2}
        trust={never}
        now={NOW}
        verifiedBy={undefined}
        changedSinceVerified={false}
        nameOf={nameOf}
        makers={{
          created: { by: 'u1', at: NOW - 3_600_000, kind: 'ai', agent: 'Claude', via: 'mcp' },
        }}
      />,
    );
    const pill = screen.getByRole('button', { name: 'AI Generated' });
    expect(pill.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(pill);
    expect(pill.getAttribute('aria-expanded')).toBe('true');
    const card = screen.getByRole('dialog', { name: 'AI Generated' });
    expect(card.textContent).toContain('Created by Claude for Priya Shah through MCP');
    fireEvent.keyDown(document.activeElement ?? card, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'AI Generated' })).toBeNull();
    expect(pill.getAttribute('aria-expanded')).toBe('false');
  });

  it('shows neither for a page with no stamps', () => {
    const { container } = renderInEditor(
      <PageMetaRowView
        minutes={2}
        trust={never}
        now={NOW}
        verifiedBy={undefined}
        changedSinceVerified={false}
        makers={{}}
      />,
    );
    expect(container.querySelector('[data-page-makers]')).toBeNull();
  });
});

// Owner 2026-11-23: "remove the tooltips from add cover, icon, label, verify etc they get in the way and aren't
// needed". A deliberate exception to tooltips on every control, for the row's labelled buttons alone.
describe('the meta row’s labelled buttons', () => {
  it('carry no tooltip or hover card, on hover or focus', () => {
    const { container } = renderInEditor(
      <>
        <PageMetaRowView
          minutes={3}
          trust={never}
          now={NOW}
          verifiedBy={undefined}
          changedSinceVerified={false}
          nameOf={nameOf}
          addCover
          addIcon
          addLabel
          verify={{ again: false, period: 'in 90 days', becomesOwner: false, onVerify: () => {} }}
          makers={{ created: { by: 'u1', at: NOW - 3_600_000, kind: 'human' } }}
        />
        <SuggestedEditsPillView count={2} open={false} onOpen={() => {}} />
      </>,
    );
    const buttons = [...container.querySelectorAll('button')];
    expect(buttons.map((b) => b.textContent)).toEqual([
      'Add Cover',
      'Add Icon',
      'Add Label',
      'Verify',
      'Human Generated',
      '2 Suggested Edits',
    ]);
    vi.useFakeTimers();
    try {
      for (const button of buttons) {
        expect(button.getAttribute('aria-describedby')).toBeNull();
        fireEvent.pointerEnter(button);
        fireEvent.mouseEnter(button);
        fireEvent.focus(button);
        vi.advanceTimersByTime(2_000);
        expect(document.querySelector('[role="tooltip"]')).toBeNull();
        fireEvent.pointerLeave(button);
        fireEvent.mouseLeave(button);
        fireEvent.blur(button);
      }
    } finally {
      vi.useRealTimers();
    }
  });
});
