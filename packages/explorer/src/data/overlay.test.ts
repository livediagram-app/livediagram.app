import { describe, expect, it, vi } from 'vitest';
import { makeItem } from '../test/fakeClient';
import { createItemOverlay } from './overlay';

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
