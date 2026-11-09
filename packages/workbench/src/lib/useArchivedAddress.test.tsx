// @vitest-environment jsdom
import { writeThisBrowser } from '@liveworkspace/explorer/this-browser';
import { render, screen } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useArchivedAddress } from './useArchivedAddress';

afterEach(() => {
  window.localStorage.clear();
  window.history.replaceState(null, '', '/');
});

const item = (id: string, archivedAt: number | null) => ({
  id,
  title: id,
  createdAt: 1,
  updatedAt: 1,
  lastOpenedAt: null,
  trashedAt: null,
  favourite: false,
  archivedAt,
});

function Probe({ idOf }: { idOf: (path: string) => string | null }) {
  const { id, here } = useArchivedAddress('liveplanner', idOf);
  return <p>{`${id ?? 'none'} ${here ? 'archived' : 'open'}`}</p>;
}

const lastSegment = (path: string) => path.split('/').at(-1) || null;

describe('the address an editor opens', () => {
  it('names no file at build time', () => {
    expect(renderToString(<Probe idOf={lastSegment} />)).toContain('none open');
  });

  it('reads the address’s file and whether this browser holds it archived', () => {
    writeThisBrowser('liveplanner', [item('p1', 5)]);
    window.history.replaceState(null, '', '/project/p1');
    render(<Probe idOf={lastSegment} />);
    expect(screen.getByText('p1 archived')).toBeTruthy();
  });

  it('reads the address once per mount', () => {
    writeThisBrowser('liveplanner', [item('p2', null)]);
    window.history.replaceState(null, '', '/project/p2');
    const idOf = vi.fn(lastSegment);
    const { rerender } = render(<Probe idOf={idOf} />);
    rerender(<Probe idOf={idOf} />);
    expect(screen.getByText('p2 open')).toBeTruthy();
    expect(idOf).toHaveBeenCalledTimes(1);
  });
});
