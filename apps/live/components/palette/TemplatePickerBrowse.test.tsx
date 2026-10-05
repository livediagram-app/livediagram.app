// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import {
  POPULAR_TEMPLATE_KINDS,
  TEMPLATES,
  templateCategory,
  type TemplateCategory,
} from '@livediagram/templates';
import { TemplatePickerBrowse, type ShelfCategory } from './TemplatePickerBrowse';
import type { TemplateModeFilter } from './useTemplateModeFilter';

// The whiteboard tile on the template shelf
// (docs/specs/023-draw-mode/draw-mode.md "Creating one", docs/specs/007-editor/new-document-route.md).

globalThis.ResizeObserver ??= class {
  observe() {}
  disconnect() {}
  unobserve() {}
} as unknown as typeof ResizeObserver;
Element.prototype.scrollIntoView ??= () => {};
Element.prototype.scrollTo ??= () => {};

const byKind = (kind: string) => TEMPLATES.find((t) => t.kind === kind)!;
// The mode filter at All: every template shows.
const ALL_MODES: TemplateModeFilter = {
  choice: 'all',
  options: ['all', 'diagram', 'draw', 'illustrate'],
  choose: () => {},
  shows: () => true,
  offered: () => true,
  counts: { all: 0, diagram: 0, draw: 0, illustrate: 0 },
};
const popular = POPULAR_TEMPLATE_KINDS.map(byKind);
const categoryTemplates = (c: TemplateCategory) =>
  TEMPLATES.filter((t) => t.kind !== 'blank' && templateCategory(t.kind) === c);

function Shelf({
  initial = null,
  onCommit = vi.fn(),
}: {
  initial?: ShelfCategory | null;
  onCommit?: (kind: string) => void;
}) {
  const [open, setOpen] = useState<ShelfCategory | null>(initial);
  return (
    <TemplatePickerBrowse
      showIdentity={false}
      templateQuery=""
      setTemplateQuery={() => {}}
      templateFilter=""
      filteredTemplates={[]}
      openCategory={open}
      setOpenCategory={setOpen}
      shelfExpanded={false}
      setShelfExpanded={() => {}}
      popularTemplates={popular}
      categoryTemplates={categoryTemplates}
      templateKind="blank"
      onTemplateCommit={onCommit}
      modeFilter={ALL_MODES}
    />
  );
}

const stage = () => screen.getAllByRole('heading', { level: 3 })[0]!;

// The blanks are not in a category (docs/specs/007-editor/templates-by-mode.md "Three blanks",
// docs/specs/023-draw-mode/draw-mode.md "Creating one"): Popular cards, never a category tile or on a
// category shelf.
describe('the blanks', () => {
  it('are cards on Popular, not category tiles', () => {
    const commit = vi.fn();
    render(<Shelf onCommit={commit} />);
    const tiles = screen.getAllByRole('button', { name: /Browse .* templates/ })[0]!.closest('ul')!;
    expect(tiles.children).toHaveLength(8);
    expect(stage().textContent).toContain('Popular');
    for (const title of ['Blank Whiteboard', 'Blank Illustration']) {
      expect(tiles.textContent).not.toContain(title);
      expect(screen.getAllByText(title)).toHaveLength(1);
    }
  });

  it('are on no category shelf', () => {
    render(<Shelf initial="design" />);
    expect(stage().textContent).toContain('Design');
    expect(screen.queryByText('Blank Whiteboard')).toBeNull();
    expect(screen.queryByText('Blank Illustration')).toBeNull();
  });
});
