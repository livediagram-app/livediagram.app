// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Element } from '@livediagram/document';

const trackMock = vi.fn();
vi.mock('@/lib/telemetry', () => ({ track: (...args: unknown[]) => trackMock(...args) }));

import { useInlineIconMutators } from './useInlineIconMutators';

// Inline-icon telemetry (docs/specs/017-telemetry/telemetry.md Element·Added), driven with a commit that
// applies the mapper to a fixed element list.
function setup(elements: Element[]) {
  let current = elements;
  const commit = (map: (els: Element[]) => Element[]) => {
    current = map(current);
  };
  const { result } = renderHook(() =>
    useInlineIconMutators({ editsBlocked: false, commit, elements }),
  );
  return { mutators: result.current, get: () => current };
}

const shape = { id: 's', type: 'shape', shape: 'square', x: 0, y: 0, width: 100, height: 60 };
const iconEl = {
  id: 'i',
  type: 'shape',
  shape: 'icon',
  iconId: 'star',
  x: 200,
  y: 0,
  width: 40,
  height: 40,
};

beforeEach(() => trackMock.mockReset());

describe('useInlineIconMutators telemetry', () => {
  it('reports a palette line-art icon dropped onto a shape as Icon', () => {
    const { mutators } = setup([shape as Element]);
    mutators.dropIconOnElement('s', 'star', 'left');
    expect(trackMock.mock.calls).toEqual([['Element', 'Added', 'Icon']]);
  });

  it('reports a tech icon dropped onto a shape as TechIcon', () => {
    const { mutators } = setup([shape as Element]);
    mutators.dropIconOnElement('s', 'aws-s3', 'above');
    expect(trackMock.mock.calls).toEqual([['Element', 'Added', 'TechIcon']]);
  });

  it('does not count an existing icon element folded into a shape as a new icon', () => {
    const { mutators, get } = setup([shape as Element, iconEl as Element]);
    mutators.dropIconElementOnShape('i', 's', 'right');
    // The fold-in still happens: the standalone icon is gone, the shape has it.
    expect(get().map((e) => e.id)).toEqual(['s']);
    expect(get()[0]).toMatchObject({ iconId: 'star', iconPosition: 'right' });
    expect(trackMock).not.toHaveBeenCalled();
  });

  it('swaps an icon for one dropped from the palette, keeping its box and style', () => {
    const { mutators, get } = setup([{ ...iconEl, strokeColor: '#ff0000' } as Element]);
    mutators.dropIconOnElement('i', 'heart', 'left');
    expect(get()[0]).toMatchObject({ id: 'i', iconId: 'heart', x: 200, strokeColor: '#ff0000' });
    expect(trackMock.mock.calls).toEqual([['Element', 'Changed', 'IconSwapped']]);
  });

  it('swaps an icon for one dragged onto it, using the dragged one up', () => {
    const dragged = { ...iconEl, id: 'd', iconId: 'zap', x: 210 };
    const { mutators, get } = setup([iconEl as Element, dragged as Element]);
    mutators.dropIconElementOnShape('d', 'i', 'left');
    expect(get()).toEqual([{ ...iconEl, iconId: 'zap' }]);
  });
});
