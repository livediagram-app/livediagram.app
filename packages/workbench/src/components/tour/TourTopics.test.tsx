// @vitest-environment jsdom
// A tour's start panel body (livediagram docs/specs/007-editor/watch-it-built.md "The start panel"): the heading, its
// line, and one row per topic, each a button in order that picks it, with a Done tick once taken.
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TourTopics } from './TourTopics';

afterEach(cleanup);

const topics = [
  { id: 'basics', title: 'The Basics', line: 'Add shapes.', meta: '25 s', taken: true },
  { id: 'look', title: 'Look and Feel', line: 'A new look.', taken: false },
] as const;

describe('TourTopics', () => {
  it('shows the heading, its line and a row per topic, Done only on a taken one', () => {
    render(<TourTopics heading="What would you like to learn?" line="Short replays." topics={topics} onPick={() => {}} />);
    expect(screen.getByRole('heading', { name: 'What would you like to learn?' })).toBeTruthy();
    expect(screen.getByText('Short replays.')).toBeTruthy();
    const rows = screen.getAllByRole('button');
    expect(rows.map((r) => r.getAttribute('data-tour-topic'))).toEqual(['basics', 'look']);
    expect(rows[0]!.textContent).toContain('Done');
    expect(rows[0]!.textContent).toContain('25 s');
    expect(rows[1]!.textContent).not.toContain('Done');
  });

  it('carries each id in the attribute asked for', () => {
    render(<TourTopics heading="H" line="L" topics={topics} onPick={() => {}} idAttribute="data-tour-track" />);
    expect(screen.getAllByRole('button').map((r) => r.getAttribute('data-tour-track'))).toEqual(['basics', 'look']);
  });

  it('picks a topic by its row, a taken one too', () => {
    const onPick = vi.fn();
    render(<TourTopics heading="H" line="L" topics={topics} onPick={onPick} />);
    fireEvent.click(screen.getByRole('button', { name: /Look and Feel/ }));
    fireEvent.click(screen.getByRole('button', { name: /The Basics/ }));
    expect(onPick.mock.calls).toEqual([['look'], ['basics']]);
  });
});
