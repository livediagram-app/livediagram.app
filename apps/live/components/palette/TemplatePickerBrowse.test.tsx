// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { TEMPLATES, templateShelfTemplates, type TemplateShelf } from '@livediagram/templates';
import { TemplatePickerBrowse } from './TemplatePickerBrowse';

// jsdom has no ResizeObserver; the height-animated box only needs one to exist.
beforeAll(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});

const listed = TEMPLATES.filter((t) => !t.hidden);

function renderBrowse(openShelf: TemplateShelf | null) {
  const setOpenShelf = vi.fn();
  render(
    <TemplatePickerBrowse
      showIdentity={false}
      templateQuery=""
      setTemplateQuery={() => {}}
      templateFilter=""
      filteredTemplates={listed}
      openShelf={openShelf}
      setOpenShelf={setOpenShelf}
      blankTemplate={listed.find((t) => t.kind === 'blank')}
      whiteboardTemplate={listed.find((t) => t.kind === 'whiteboard')}
      shelfTemplates={(shelf) => templateShelfTemplates(shelf, listed)}
      templateKind="blank"
      onTemplateCommit={() => {}}
    />,
  );
  return { setOpenShelf };
}

describe('TemplatePickerBrowse', () => {
  it('opens on a collection as a drilled-in view (docs/specs/007-editor/new-document-route.md)', () => {
    const { setOpenShelf } = renderBrowse('brainstorm');
    expect(screen.getByText('Brainstorm')).toBeTruthy();
    for (const title of [
      'Mind map',
      'Tree mind map',
      'Bubble map',
      'Affinity map',
      'Event storming',
    ]) {
      expect(screen.getByText(title)).toBeTruthy();
    }
    expect(screen.queryByText('Kanban')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /All templates/ }));
    expect(setOpenShelf).toHaveBeenCalledWith(null);
  });

  it('still drills into a category', () => {
    renderBrowse('flowcharts');
    expect(screen.getByText('Flowcharts')).toBeTruthy();
    expect(screen.getByText('Swimlane flowchart')).toBeTruthy();
  });
});

// docs/specs/023-whiteboard/whiteboard.md "Creating one": Whiteboard is the last tile of the grid.
describe('TemplatePickerBrowse, the whiteboard tile', () => {
  it('comes last, after every category, with its own description', () => {
    renderBrowse(null);
    const grid = screen.getByText('Blank diagram').closest('.grid')!;
    const tiles = [...grid.children];
    const last = tiles[tiles.length - 1]!;
    expect(last.textContent).toContain('Whiteboard');
    expect(last.textContent).toContain('Free drawing without distractions');
    expect(tiles[1]!.textContent).not.toContain('Whiteboard');
  });
});
