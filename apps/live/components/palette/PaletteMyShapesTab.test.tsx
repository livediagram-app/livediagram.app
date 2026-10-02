// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ShapeLibrary } from '@livediagram/api-schema';
import { PaletteMyShapesTab, myShapesSections } from './PaletteMyShapesTab';

// docs/specs/013-workspace/shape-libraries.md "Using a library: the palette".

vi.mock('@/lib/shape-library-thumbnail', () => ({
  libraryItemThumbnail: vi.fn(async () => 'data:image/svg+xml;charset=utf-8,%3Csvg%2F%3E'),
}));
const item = (id: string, title: string) => ({ id, title, width: 10, height: 10, elements: [] });
const lib = (id: string, name: string, items: ReturnType<typeof item>[]): ShapeLibrary => ({
  id,
  ownerId: 'o',
  name,
  source: 'drawio',
  items,
  createdAt: 1,
  updatedAt: 1,
});
const libraries = [
  lib('l1', 'Team icons', [item('a', 'Server'), item('b', '')]),
  lib('l2', 'UML', [item('c', 'Class'), item('d', 'Server farm')]),
  lib('l3', 'Empty', []),
];
vi.mock('@/components/primitives/ShapeLibraryProvider', () => ({
  useShapeLibraries: () => ({ libraries }),
}));
afterEach(cleanup);

describe('myShapesSections', () => {
  it('keeps the order, names untitled shapes, and drops empty libraries', () => {
    expect(
      myShapesSections(libraries, '').map((s) => [s.library.name, s.shapes.map((x) => x.title)]),
    ).toEqual([
      ['Team icons', ['Server', 'Shape 2']],
      ['UML', ['Class', 'Server farm']],
    ]);
  });

  it('matches shape titles and library names, case-insensitively', () => {
    const titles = (q: string) =>
      myShapesSections(libraries, q).map((s) => [s.library.name, s.shapes.map((x) => x.title)]);
    expect(titles(' SERVER ')).toEqual([
      ['Team icons', ['Server']],
      ['UML', ['Server farm']],
    ]);
    expect(titles('uml')).toEqual([['UML', ['Class', 'Server farm']]]);
    expect(titles('nothing')).toEqual([]);
  });
});

describe('PaletteMyShapesTab', () => {
  it('shows a labelled section per library whose tiles place their shape', () => {
    const onInsert = vi.fn();
    render(<PaletteMyShapesTab onInsert={onInsert} />);
    const section = screen.getByRole('region', { name: 'UML' });
    fireEvent.click(within(section).getByRole('button', { name: 'Insert Class from UML' }));
    expect(onInsert).toHaveBeenCalledWith(item('c', 'Class'));
    expect(screen.getByRole('button', { name: 'Insert Shape 2 from Team icons' })).toBeTruthy();
  });

  it('filters as you type, and says when nothing matches', () => {
    render(<PaletteMyShapesTab onInsert={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Search my shapes'), {
      target: { value: 'zzz' },
    });
    expect(screen.getByText('No shapes match')).toBeTruthy();
  });

  it('carries the library and shape on a drag', () => {
    render(<PaletteMyShapesTab onInsert={vi.fn()} />);
    const setData = vi.fn();
    fireEvent.dragStart(screen.getByRole('button', { name: 'Insert Server from Team icons' }), {
      dataTransfer: { setData, effectAllowed: '' },
    });
    expect(setData).toHaveBeenCalledWith(
      'application/x-livediagram-library-shape',
      JSON.stringify({ libraryId: 'l1', itemId: 'a' }),
    );
  });
});
