import { describe, expect, it } from 'vitest';
import { crossesPages, layOutIllustratePages, newLogoPage, pageIdAt, pageIdOf } from './index';
import type { Element } from './index';

// docs/specs/007-editor/illustrate-pages.md "Arrows stay on one page".
const pages = layOutIllustratePages([newLogoPage('a'), newLogoPage('b')]);
const centre = (i: number) => {
  const r = pages[i]!.rect;
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
};
const box = (id: string, at: { x: number; y: number }) =>
  ({
    id,
    type: 'shape',
    shape: 'square',
    x: at.x - 10,
    y: at.y - 10,
    width: 20,
    height: 20,
  }) as Element;

describe('the page an element is on', () => {
  it('is the page its centre lies on, else none', () => {
    expect(pageIdAt(centre(0), pages)).toBe('a');
    expect(pageIdAt(centre(1), pages)).toBe('b');
    expect(pageIdAt({ x: -1e6, y: -1e6 }, pages)).toBeNull();
    const els = [box('s', centre(1))];
    expect(pageIdOf(els[0]!, els, pages)).toBe('b');
  });

  it('reads an arrow by its resolved bounds', () => {
    const a = centre(0);
    const arrow = {
      id: 'x',
      type: 'arrow',
      from: { kind: 'free', x: a.x - 5, y: a.y },
      to: { kind: 'free', x: a.x + 5, y: a.y },
    } as Element;
    expect(pageIdOf(arrow, [arrow], pages)).toBe('a');
  });

  it('crosses only between two different pages', () => {
    expect(crossesPages('a', 'b')).toBe(true);
    expect(crossesPages('a', 'a')).toBe(false);
    expect(crossesPages('a', null)).toBe(false);
    expect(crossesPages(null, null)).toBe(false);
  });
});
