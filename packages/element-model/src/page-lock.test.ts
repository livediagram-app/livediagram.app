import { describe, expect, it } from 'vitest';
import { elementsOnLockedPages, guardLockedPages as guard, hasLockedPage } from './page-lock';
import type { Element, ShapeElement } from './element';

// Each pages product's pages-mode spec, "Locking a page". Pages laid out in a row, as a product's layout puts them.
type Page = { id: string; orientation: 'portrait'; locked?: boolean };
const layOutPages = (list: readonly Page[]) =>
  list.map((p, i) => ({ ...p, rect: { x: i * 700, y: 0, width: 600, height: 840 } }));
const guardLockedPages = (prev: Element[], next: Element[], before: Page[], after: Page[]) =>
  guard(layOutPages, prev, next, before, after);
const pages: Page[] = [
  { id: 'a', orientation: 'portrait', locked: true },
  { id: 'b', orientation: 'portrait' },
];
const [pa, pb] = layOutPages(pages);
const box = (id: string, x: number, y: number): ShapeElement => ({
  id,
  type: 'shape',
  shape: 'square',
  x,
  y,
  width: 40,
  height: 40,
});
const onA = box('on-a', pa!.rect.x + 100, pa!.rect.y + 100);
const onB = box('on-b', pb!.rect.x + 100, pb!.rect.y + 100);

describe('page lock', () => {
  it('knows which elements a locked page holds', () => {
    expect(hasLockedPage(pages)).toBe(true);
    expect([...elementsOnLockedPages([onA, onB], layOutPages(pages))]).toEqual(['on-a']);
  });

  it('keeps a new element off a locked page, and lets one onto an open page', () => {
    const added = box('new', pa!.rect.x + 300, pa!.rect.y + 300);
    const r = guardLockedPages([onB], [onB, added], pages, pages);
    expect(r).toEqual({ elements: [onB], blocked: true });
    const open = box('ok', pb!.rect.x + 300, pb!.rect.y + 300);
    expect(guardLockedPages([onB], [onB, open], pages, pages).blocked).toBe(false);
  });

  it('puts back an element moved onto a locked page', () => {
    const moved = { ...onB, x: pa!.rect.x + 200, y: pa!.rect.y + 200 } as Element;
    const r = guardLockedPages([onB], [moved], pages, pages);
    expect(r.elements).toEqual([onB]);
    expect(r.blocked).toBe(true);
  });

  it('keeps an element on a locked page where it is, its look free to change', () => {
    const moved = { ...onA, x: onA.x + 10, fillColor: '#ff0000' };
    const [back] = guardLockedPages([onA, onB], [moved, onB], pages, pages).elements;
    expect(back).toMatchObject({ x: onA.x, fillColor: '#ff0000' });
    // A re-colour alone (a theme) and a cascade delete pass.
    const recoloured = { ...onA, fillColor: '#00ff00' };
    expect(guardLockedPages([onA], [recoloured], pages, pages).blocked).toBe(false);
    expect(guardLockedPages([onA, onB], [onB], pages, pages)).toEqual({
      elements: [onB],
      blocked: false,
    });
  });

  it('lets the pages’ own changes through: a lock toggled, a page added', () => {
    const unlocked = pages.map((p) => ({ ...p, locked: undefined }));
    const changed = { ...onA, x: onA.x + 10 } as Element;
    expect(guardLockedPages([onA], [changed], pages, unlocked).blocked).toBe(false);
    const more = [...pages, { id: 'c', orientation: 'portrait' as const }];
    expect(guardLockedPages([onA], [changed], pages, more).blocked).toBe(false);
    expect(guardLockedPages([onA], [changed], unlocked, unlocked).blocked).toBe(false);
  });
});
