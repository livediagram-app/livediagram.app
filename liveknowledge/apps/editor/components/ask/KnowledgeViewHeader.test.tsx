// @vitest-environment jsdom

// The header Ask and AI Knowledge share (docs/specs/030-knowledgebase/blueprints/ask-ui.md "The frame", WI-1337): the
// view's name and its one line stand in one column with one left edge, the name over the line, and the view's buttons
// after that column in the row, so the line never sits beside the name on a baseline of its own.
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { KnowledgeViewHeader } from './KnowledgeViewFrame';

afterEach(cleanup);

describe('KnowledgeViewHeader', () => {
  it('stacks the name over its line in one column, the buttons beside the column', () => {
    render(
      <KnowledgeViewHeader title="AI Knowledge" about="What agents know of this knowledgebase.">
        <button type="button">AI Settings</button>
      </KnowledgeViewHeader>,
    );
    const title = screen.getByRole('heading', { level: 1, name: 'AI Knowledge' });
    const about = screen.getByText('What agents know of this knowledgebase.');
    const column = title.parentElement!;
    expect(column.hasAttribute('data-view-heading')).toBe(true);
    expect(about.parentElement).toBe(column);
    expect([...column.children]).toEqual([title, about]);
    expect(column.className.split(' ')).toEqual(
      expect.arrayContaining(['flex', 'flex-col', 'justify-center', 'min-w-0', 'flex-1']),
    );
    // Neither line is indented against the other: one left edge.
    for (const line of [title, about]) expect(line.className).not.toMatch(/\b(ml|pl|mx|px)-/);
    // The line shows where there is room for it, as before.
    expect(about.className.split(' ')).toEqual(expect.arrayContaining(['hidden', 'lg:block']));
    const buttons = screen.getByRole('button', { name: 'AI Settings' }).parentElement!;
    expect(buttons.parentElement).toBe(column.parentElement);
    expect(column.compareDocumentPosition(buttons) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
