// A photo page's layers between two editors (docs/specs/031-photo/photo-store.md "Live sync"): the
// sender's change goes out as `photo` ops, never inside a whole-tab or tab-meta op, and the receiver's
// copy comes out the same.
import { describe, expect, it } from 'vitest';
import { newPhotoPage, withPhoto, type Tab } from '@livedesign/document';
import type { Photo } from '@livedesign/photo-engine';
import { applyRoomOpToTabs } from './room-op-apply';
import { mergeRemoteTab, tabBroadcastOps } from './tab-broadcast-ops';

const page = newPhotoPage('pg1', 640, 480);
const base: Tab = { id: 't1', name: 'Tab 1', elements: [], pages: [page] };
// Layer ids as the editor makes them: a parse drops any other.
const id = (n: number) => `ly-${n.toString(16).padStart(8, '0')}`;
const layer = (n: number, name = `L${n}`) => ({
  id: id(n),
  name,
  layerKind: 'pixel' as const,
  pixels: { tiles: { '0.0': 'b'.repeat(22) } },
});
const photo = (...layers: Photo['layers']): Photo => ({ width: 640, height: 480, layers });

describe('photo pages between editors', () => {
  it('sends a layer change as a photo op the receiver applies', () => {
    const before = withPhoto(base, 'pg1', photo(layer(1)));
    const after = withPhoto(base, 'pg1', photo(layer(1, 'Sky'), layer(2)));
    const ops = tabBroadcastOps(before, after);
    expect(ops.map((o) => o.kind)).toEqual(['photo']);
    const [received] = ops.reduce<Tab[]>((tabs, op) => applyRoomOpToTabs(tabs, op), [before]);
    expect(received!.photos?.pg1?.layers.map((l) => l.name)).toEqual(['Sky', 'L2']);
  });

  it('keeps photos out of a whole-tab op, sending them as photo ops after', () => {
    const after = withPhoto(base, 'pg1', photo(layer(1)));
    const ops = tabBroadcastOps(undefined, after);
    expect(ops[0]).toMatchObject({ kind: 'tab' });
    expect(JSON.stringify(ops[0])).not.toContain('"photos"');
    expect(ops.slice(1).every((o) => o.kind === 'photo')).toBe(true);
    const received = ops.reduce<Tab[]>((tabs, op) => applyRoomOpToTabs(tabs, op), []);
    expect(received[0]!.photos?.pg1?.layers.map((l) => l.id)).toEqual([id(1)]);
  });

  it('drops a photo op for a page the receiver no longer has', () => {
    const ops = tabBroadcastOps(
      withPhoto(base, 'pg1', photo()),
      withPhoto(base, 'pg1', photo(layer(1))),
    );
    const gone: Tab = { ...base, pages: [] };
    const [received] = ops.reduce<Tab[]>((tabs, op) => applyRoomOpToTabs(tabs, op), [gone]);
    expect(received!.photos?.pg1).toBeUndefined();
  });

  it("keeps the receiver's photos through a whole-tab merge", () => {
    const local = withPhoto(base, 'pg1', photo(layer(9, 'mine')));
    expect(mergeRemoteTab(local, base).photos).toBe(local.photos);
  });
});
