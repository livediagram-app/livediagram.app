import { describe, expect, it, vi } from 'vitest';
import { makeItem } from '../test/fakeClient';
import { createItemOverlay, OVERLAY_BASE_MAX, OVERLAY_PLACEMENTS_MAX } from './overlay';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';

describe('createItemOverlay', () => {
  it('lays a patch over an item and keeps unpatched items as they are', () => {
    const overlay = createItemOverlay();
    const a = makeItem(1);
    const b = makeItem(2);
    overlay.patch(a.id, { title: 'Renamed' });
    expect(overlay.apply(a).title).toBe('Renamed');
    expect(overlay.apply(b)).toBe(b);
  });

  it('takes back only its own keys, so a later patch survives an earlier one failing', () => {
    const overlay = createItemOverlay();
    const a = makeItem(1);
    const undoRename = overlay.patch(a.id, { title: 'Renamed' });
    overlay.patch(a.id, { favourite: true });
    undoRename();
    const shown = overlay.apply(a);
    expect(shown.title).toBe('Item 1');
    expect(shown.favourite).toBe(true);
  });

  it('puts back the value an earlier patch had set', () => {
    const overlay = createItemOverlay();
    const a = makeItem(1);
    overlay.patch(a.id, { title: 'First' });
    const undo = overlay.patch(a.id, { title: 'Second' });
    undo();
    expect(overlay.apply(a).title).toBe('First');
  });

  it('keeps a later patch on the same key when an earlier one is refused, in either order', () => {
    const overlay = createItemOverlay();
    const a = makeItem(1);
    const undoB = overlay.patch(a.id, { title: 'B' });
    const undoC = overlay.patch(a.id, { title: 'C' });
    undoB();
    expect(overlay.apply(a).title).toBe('C');
    undoC();
    expect(overlay.apply(a)).toBe(a);

    const undoD = overlay.patch(a.id, { title: 'D' });
    const undoE = overlay.patch(a.id, { title: 'E' });
    undoE();
    expect(overlay.apply(a).title).toBe('D');
    undoD();
    expect(overlay.apply(a)).toBe(a);
  });

  it('takes a patch back once only', () => {
    const overlay = createItemOverlay();
    const a = makeItem(1);
    const undo = overlay.patch(a.id, { title: 'B' });
    undo();
    const v = overlay.version();
    undo();
    expect(overlay.version()).toBe(v);
  });

  it('retires a settled patch once a read that started after it lands', () => {
    const overlay = createItemOverlay();
    const a = makeItem(1);
    const handle = overlay.patch(a.id, { folderId: 'f1' });
    // A read that started before the index took it says nothing about it.
    const early = overlay.stamp();
    handle.settle();
    overlay.observe([a], early);
    expect(overlay.apply(a).folderId).toBe('f1');
    // One that started after it is the index's answer, whatever it says.
    const later = overlay.stamp();
    overlay.observe([{ ...a, folderId: 'f2' }], later);
    expect(overlay.apply(a).folderId).toBe('f2');
    // A list still holding the oldest copy shows the newest answer.
    expect(overlay.apply({ ...a, folderId: null }).folderId).toBe('f2');
  });

  it('never retires a patch the index has not taken yet', () => {
    const overlay = createItemOverlay();
    const a = makeItem(1);
    overlay.patch(a.id, { title: 'Pending' });
    overlay.observe([a], overlay.stamp());
    expect(overlay.apply(a).title).toBe('Pending');
  });

  it('keeps a newer patch over a retired older one (newest wins)', () => {
    const overlay = createItemOverlay();
    const a = makeItem(1);
    overlay.patch(a.id, { title: 'B' }).settle();
    const read = overlay.stamp();
    overlay.patch(a.id, { title: 'C' });
    overlay.observe([{ ...a, title: 'B' }], read);
    expect(overlay.apply(a).title).toBe('C');
  });

  it('drops a move into a folder once that folder is deleted', () => {
    const overlay = createItemOverlay();
    const a = makeItem(1);
    overlay.patch(a.id, { folderId: 'f1', teamId: null });
    overlay.patch(a.id, { favourite: true });
    overlay.dropFolder('f1');
    const shown = overlay.apply(a);
    expect(shown.folderId).toBeNull();
    expect(shown.favourite).toBe(true);
  });

  it('holds the latest word for at most OVERLAY_BASE_MAX items', () => {
    const overlay = createItemOverlay();
    const n = OVERLAY_BASE_MAX + 50;
    const items = Array.from({ length: n }, (_, i) => makeItem(i));
    for (const item of items) overlay.patch(item.id, { favourite: true }).settle();
    overlay.observe(items, overlay.stamp());
    expect(overlay.size()).toBe(OVERLAY_BASE_MAX);
  });

  it('observes a large read quickly', () => {
    const overlay = createItemOverlay();
    const items = Array.from({ length: 5000 }, (_, i) => makeItem(i));
    for (const item of items.slice(0, 400)) overlay.patch(item.id, { title: 'x' }).settle();
    const ms = cpuMsOf(() => {
      for (let r = 0; r < 20; r++) overlay.observe(items, overlay.stamp());
    });
    expect(ms).toBeLessThan(cpuBudgetMs(500));
  });

  it('names a read that raced a move: started after it was laid, before the index took it', () => {
    const overlay = createItemOverlay();
    const before = overlay.stamp();
    const move = overlay.patch('a', { folderId: 'f1' });
    const during = overlay.stamp();
    const listener = vi.fn();
    overlay.subscribe(listener);
    expect(overlay.raced(during)).toBe(false);
    move.settle();
    // Settling a move tells the lists, so a raced one reads again.
    expect(listener).toHaveBeenCalledTimes(1);
    const after = overlay.stamp();
    expect(overlay.raced(during)).toBe(true);
    expect(overlay.raced(before)).toBe(false);
    expect(overlay.raced(after)).toBe(false);
    // Settled twice: remembered once, said once.
    move.settle();
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('never calls a read raced by a change that does not move anything, nor after clear', () => {
    const overlay = createItemOverlay();
    const rename = overlay.patch('a', { title: 'x' });
    const during = overlay.stamp();
    rename.settle();
    expect(overlay.raced(during)).toBe(false);
    const trash = overlay.patch('a', { trashedAt: 5 });
    const later = overlay.stamp();
    trash.settle();
    expect(overlay.raced(later)).toBe(true);
    overlay.clear();
    expect(overlay.raced(later)).toBe(false);
  });

  it('remembers at most OVERLAY_PLACEMENTS_MAX moves', () => {
    const overlay = createItemOverlay();
    const first = overlay.patch('a', { folderId: 'f0' });
    const during = overlay.stamp();
    first.settle();
    for (let i = 0; i < OVERLAY_PLACEMENTS_MAX; i++)
      overlay.patch(`b${i}`, { gone: true }).settle();
    expect(overlay.raced(during)).toBe(false);
  });

  it('tells subscribers and bumps its version on every change', () => {
    const overlay = createItemOverlay();
    const listener = vi.fn();
    overlay.subscribe(listener);
    const v0 = overlay.version();
    const undo = overlay.patch('x', { favourite: true });
    undo();
    expect(listener).toHaveBeenCalledTimes(2);
    expect(overlay.version()).toBe(v0 + 2);
  });
});
