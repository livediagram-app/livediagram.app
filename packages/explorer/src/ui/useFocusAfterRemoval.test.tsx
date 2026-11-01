import { act, render, screen } from '@testing-library/react';
import { useMemo, useRef, useState } from 'react';
import { describe, expect, it } from 'vitest';
import { rowKeyOf, rowKeys, useFocusAfterRemoval } from './useFocusAfterRemoval';

type Row = { id: string };

// A list like the Explorer's: folder rows, then item rows, each with a link and a ⋯; `shown` stands in for the
// windowing, which takes rows off screen while they stay in the list.
function List({
  folders,
  items,
  shown,
}: {
  folders: Row[];
  items: Row[];
  shown?: (id: string) => boolean;
}) {
  const ref = useRef<HTMLUListElement>(null);
  useFocusAfterRemoval(
    ref,
    useMemo(() => rowKeys(folders, items), [folders, items]),
  );
  return (
    <ul ref={ref}>
      {folders.map((f) => (
        <li key={f.id} data-folder-row={f.id}>
          <a href={`#${f.id}`}>{f.id}</a>
          <button type="button">Menu for {f.id}</button>
        </li>
      ))}
      {items
        .filter((i) => shown?.(i.id) ?? true)
        .map((i) => (
          <li key={i.id} data-item-row={i.id}>
            <a href={`#${i.id}`}>{i.id}</a>
            <button type="button">Menu for {i.id}</button>
          </li>
        ))}
    </ul>
  );
}

let remove!: (id: string) => void;
let hide!: (id: string) => void;

function Harness({ initial }: { initial: string[] }) {
  const [items, setItems] = useState(() => initial.map((id) => ({ id })));
  const [hidden, setHidden] = useState<string[]>([]);
  remove = (id) => setItems((now) => now.filter((i) => i.id !== id));
  hide = (id) => setHidden((now) => [...now, id]);
  return <List folders={[{ id: 'f1' }]} items={items} shown={(id) => !hidden.includes(id)} />;
}

const menu = (id: string) => screen.getByRole('button', { name: `Menu for ${id}` });

describe('useFocusAfterRemoval', () => {
  it('keys rows by kind, folders first', () => {
    expect(rowKeys([{ id: 'a' }], [{ id: 'b' }, { id: 'c' }])).toEqual(['f:a', 'i:b', 'i:c']);
    const li = document.createElement('li');
    li.setAttribute('data-trash-row', 'x');
    expect(rowKeyOf(li)).toBe('i:x');
    expect(rowKeyOf(document.createElement('li'))).toBeNull();
  });

  it('moves focus to the same control on the next row when the focused row leaves', () => {
    render(<Harness initial={['a', 'b', 'c']} />);
    menu('b').focus();
    act(() => remove('b'));
    // Not the page's body: the ⋯ of the row that took its place.
    expect(document.activeElement).toBe(menu('c'));
  });

  it('moves to the row before when the last row leaves', () => {
    render(<Harness initial={['a', 'b', 'c']} />);
    screen.getByRole('link', { name: 'c' }).focus();
    act(() => remove('c'));
    expect(document.activeElement).toBe(screen.getByRole('link', { name: 'b' }));
  });

  it('leaves focus alone when it is somewhere else, or the row only went off screen', () => {
    render(
      <>
        <button type="button">Elsewhere</button>
        <Harness initial={['a', 'b', 'c']} />
      </>,
    );
    menu('a').focus();
    screen.getByRole('button', { name: 'Elsewhere' }).focus();
    act(() => remove('a'));
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Elsewhere' }));

    // Windowed out: still in the list, so focus is not pulled back to a row on screen.
    menu('b').focus();
    act(() => hide('b'));
    expect(document.activeElement).toBe(document.body);
  });
});
