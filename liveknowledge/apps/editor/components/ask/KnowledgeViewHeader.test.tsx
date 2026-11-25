// @vitest-environment jsdom

// The header Ask and Insights share (docs/specs/030-knowledgebase/blueprints/ask-ui.md "The frame", WI-1337): the
// view's name and its one line stand in one column with one left edge, the name over the line, and the view's buttons
// after that column in the row, so the line never sits beside the name on a baseline of its own.
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { UiScaleProvider } from '@liveworkspace/workbench/components/providers/ui-scale';
import { toolbarTopClearancePx } from '@/lib/canvas-chrome';
import { resetKnowledgeViewTrail, showKnowledgeView } from '@/lib/knowledge-ask/knowledge-view';
import { KnowledgeViewHeader } from './KnowledgeViewFrame';

const viewport = vi.hoisted(() => ({ phone: false }));
vi.mock('@liveworkspace/workbench/hooks/ui/useIsMobileViewport', () => ({
  useIsMobileViewport: () => viewport.phone,
}));

afterEach(() => {
  cleanup();
  viewport.phone = false;
  resetKnowledgeViewTrail();
  window.history.replaceState(null, '', '/');
});

describe('KnowledgeViewHeader', () => {
  it('stacks the name over its line in one column, the buttons beside the column', () => {
    render(
      <KnowledgeViewHeader title="Insights" about="What agents know of this knowledgebase.">
        <button type="button">AI Settings</button>
      </KnowledgeViewHeader>,
    );
    const title = screen.getByRole('heading', { level: 1, name: 'Insights' });
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

// Work Tracker 1467: the header is the page tree's head's height, its logo where the head's is, and a back chevron
// leads the name.
describe('KnowledgeViewHeader, in line with Pages', () => {
  const row = () => document.querySelector<HTMLElement>('[data-knowledge-top-row="view"]')!;

  it('is as tall as the page tree head on a desktop, at the toolbar scale', () => {
    const scales = { panels: 1, toolbar: 1.15, cornerButtons: 1 };
    render(
      <UiScaleProvider value={scales}>
        <KnowledgeViewHeader title="Ask" about="Answers." />
      </UiScaleProvider>,
    );
    expect(row().style.height).toBe(`${Math.round(toolbarTopClearancePx(1.15))}px`);
    expect(row().style.height).toBe('75px');
  });

  it('keeps the top row height on a phone', () => {
    viewport.phone = true;
    render(<KnowledgeViewHeader title="Ask" about="Answers." />);
    expect(row().style.height).toBe('var(--knowledge-top-row)');
  });

  it('leads the name with a chevron back to the view before, or Pages', () => {
    window.history.replaceState(null, '', '/document/d1?view=ask');
    render(<KnowledgeViewHeader title="Ask" about="Answers." />);
    const back = screen.getByRole('button', { name: 'Back to Pages' });
    const title = screen.getByRole('heading', { level: 1, name: 'Ask' });
    expect(back.compareDocumentPosition(title) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    fireEvent.click(back);
    expect(window.location.search).toBe('');
  });

  it('names the view it goes back to', async () => {
    window.history.replaceState(null, '', '/document/d1?view=insights');
    render(<KnowledgeViewHeader title="Connect MCP" about="Connect an AI app." />);
    act(() => showKnowledgeView('connect'));
    expect(await screen.findByRole('button', { name: 'Back to Insights' })).toBeTruthy();
  });
});
