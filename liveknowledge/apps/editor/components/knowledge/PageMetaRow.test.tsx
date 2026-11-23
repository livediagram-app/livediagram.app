// @vitest-environment jsdom

// The meta row's Add Cover (docs/specs/030-knowledgebase/page-surface.md "The cover") and its maker pills
// (verification.md "Made by a person or an agent").
import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { pageTrust } from '@/lib/knowledge/page-trust';
import { renderInEditor } from '@/components/ask/test-chrome';
import { PageMetaRowView } from './PageMetaRow';

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
    // The hover card's words ride a hidden copy the button is described by, not the row's text.
    const parts = [...row.children].map((c) => c.textContent?.replace(/Add a picture.*$/, ''));
    expect(parts).toEqual(['3 min read', '·Add Cover']);
    const button = screen.getByRole('button', { name: /Add Cover/ });
    expect(button.getAttribute('aria-describedby')).toBeTruthy();
    expect(
      document.getElementById(button.getAttribute('aria-describedby')!.split(' ').at(-1)!)
        ?.textContent,
    ).toBe('Add a picture or a gradient across the top of this page.');
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
  it('shows who made and last edited the page, each with its card', () => {
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
    const described = (el: Element) =>
      (el.getAttribute('aria-describedby') ?? '')
        .split(' ')
        .map((id) => document.getElementById(id)?.textContent)
        .join('');
    expect(described(pills[0]!)).toBe('Created by Priya Shah on 12 Nov');
    expect(described(pills[1]!)).toBe(
      'Last edited by Claude for Priya Shah through MCP, 1 hour ago',
    );
    // Neutral grey: never the accent, never a state colour.
    for (const p of pills) expect(p.className).not.toMatch(/(bg|text)-(brand|amber|red|green)-/);
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
