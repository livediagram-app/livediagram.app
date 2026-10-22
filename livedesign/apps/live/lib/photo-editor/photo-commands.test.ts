import { describe, expect, it } from 'vitest';
import { photoCommandItems, runPhotoCommand } from './photo-commands';
import { photoDialogs } from './photo-dialog-store';
import { harness, photoOf, solid } from './photo-test-utils';
import type { PhotoEditorView } from '@/hooks/editor/usePhotoEditor';

const viewOf = (h: ReturnType<typeof harness>, canEdit = true) =>
  ({
    session: h.s,
    ctx: h.ctx,
    canEdit,
    toast: (m: string) => h.toasts.push(m),
  }) as unknown as PhotoEditorView;

describe('photo commands', () => {
  it('names each Photo:, and ids are unique', () => {
    const items = photoCommandItems();
    expect(items.every((i) => i.name.startsWith('Photo: '))).toBe(true);
    expect(new Set(items.map((i) => i.id)).size).toBe(items.length);
    expect(items.some((i) => i.name === 'Photo: Gaussian Blur')).toBe(true);
    expect(items.some((i) => i.name === 'Photo: Image Size')).toBe(true);
  });

  it('runs a command, opens a filter, and leaves other ids alone', () => {
    const h = harness(photoOf(2, 1), { a: solid(2, 1, [1, 2, 3, 255]) });
    expect(runPhotoCommand('zen', viewOf(h))).toBe(false);
    expect(runPhotoCommand('photo:flip-h', viewOf(h))).toBe(true);
    expect(h.commits.at(-1)?.label ?? 'pending').not.toBe('');
    runPhotoCommand('photo:filter:gaussian-blur', viewOf(h));
    expect(photoDialogs.get()).toEqual({ kind: 'filter', id: 'gaussian-blur' });
    photoDialogs.close();
    // A session that may not edit runs nothing.
    expect(runPhotoCommand('photo:new-layer', viewOf(h, false))).toBe(true);
    expect(h.s.photo.layers).toHaveLength(1);
  });
});
