// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import {
  POPULAR_TEMPLATE_KINDS,
  TEMPLATES,
  templateCategory,
  type TemplateCategory,
} from '@livediagram/templates';
import { TemplatePickerBrowse, type ShelfCategory } from './TemplatePickerBrowse';

// The whiteboard tile and the `?browse=` collections on the template shelf
// (docs/specs/023-whiteboard/whiteboard.md "Creating one", docs/specs/007-editor/new-document-route.md).

globalThis.ResizeObserver ??= class {
  observe() {}
  disconnect() {}
  unobserve() {}
} as unknown as typeof ResizeObserver;
Element.prototype.scrollIntoView ??= () => {};
Element.prototype.scrollTo ??= () => {};

const byKind = (kind: string) => TEMPLATES.find((t) => t.kind === kind)!;
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
      popularTemplates={popular}
      categoryTemplates={categoryTemplates}
      whiteboardTemplate={byKind('whiteboard')}
      templateKind="blank"
      onTemplateCommit={onCommit}
    />
  );
}

const stage = () => screen.getAllByRole('heading', { level: 3 })[0]!;

describe('the whiteboard tile', () => {
  it('closes the category tiles, last, three across so the grid fills three rows', () => {
    const commit = vi.fn();
    render(<Shelf onCommit={commit} />);
    const tiles = screen.getAllByRole('button', { name: /Browse .* templates/ })[0]!.closest('ul')!;
    expect(tiles.className).toContain('sm:grid-cols-3');
    expect(tiles.children).toHaveLength(9);
    const last = tiles.lastElementChild!;
    expect(last.textContent).toContain('Whiteboard');
    expect(last.textContent).toContain('Free drawing without distractions');
    fireEvent.click(screen.getByRole('button', { name: /^Start a whiteboard/ }));
    expect(commit).toHaveBeenCalledWith('whiteboard');
  });

  it('is never on a shelf', () => {
    render(<Shelf initial="design" />);
    expect(stage().textContent).toContain('Design');
    expect(screen.getAllByText('Whiteboard')).toHaveLength(1);
  });
});

describe('a ?browse= collection', () => {
  it('opens as the open shelf, with no tile of its own, and leaves once another opens', () => {
    render(<Shelf initial="brainstorm" />);
    expect(stage().textContent).toContain('Brainstorm');
    for (const title of ['Mind map', 'Tree mind map', 'Affinity map', 'Event storming']) {
      expect(screen.getAllByText(title).length).toBeGreaterThan(0);
    }
    expect(screen.queryByRole('button', { name: 'Browse Brainstorm templates' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Browse Popular templates' }));
    expect(stage().textContent).toContain('Popular');
    expect(screen.queryByRole('button', { name: 'Browse Brainstorm templates' })).toBeNull();
  });
});
