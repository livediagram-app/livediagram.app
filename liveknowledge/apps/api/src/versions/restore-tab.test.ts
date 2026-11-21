import { describe, expect, it } from 'vitest';
import type { Element, Page, Tab } from '@liveknowledge/document';
import { parseVersionBody, restoredTab, restoreRoomOps, sameContent } from './restore-tab';

// What a restore writes and sends (docs/specs/006-document/version-history.md "Restore"; blueprint VH14, VH16).

const box = (id: string, extra: Record<string, unknown> = {}): Element => ({
  id,
  type: 'shape',
  shape: 'square',
  x: 0,
  y: 0,
  width: 10,
  height: 10,
  ...extra,
});
const slide = (id: string): Page => ({ id, orientation: 'landscape', kind: 'slide' });
const tab = (fields: Partial<Tab> = {}): Tab => ({
  id: 't1',
  name: 'Now',
  elements: [box('a')],
  ...fields,
});

describe('parseVersionBody', () => {
  it('reads a stored body and refuses what is not one', () => {
    expect(parseVersionBody(JSON.stringify({ elements: [box('a')] }))?.elements).toHaveLength(1);
    expect(parseVersionBody('{"elements": 3}')).toBeNull();
    expect(parseVersionBody('null')).toBeNull();
    expect(parseVersionBody('{')).toBeNull();
  });

  it('never hands back a draft a version was copied with', () => {
    const body = parseVersionBody(
      JSON.stringify({
        elements: [],
        articles: {
          f1: { blocks: [{ id: 'b1', type: 'paragraph', runs: [{ text: 'Saved' }] }] },
          draft: { blocks: [{ id: 'b1', type: 'paragraph', runs: [{ text: 'Secret draft' }] }] },
        },
        draft: { by: 'Priya', at: 1, base: {} },
      }),
    );
    expect(body).not.toBeNull();
    expect(JSON.stringify(body)).not.toContain('Secret draft');
    expect(body).not.toHaveProperty('draft');
    expect(Object.keys(body?.articles ?? {})).toEqual(['f1']);
  });
});

describe('restoredTab', () => {
  it("keeps the tab's own fields and the current conversation on shared elements", () => {
    const thread = { id: 'th', comments: [] };
    const stored = tab({
      locked: true,
      elements: [box('a', { commentThread: thread }), box('b')],
    });
    const body = {
      elements: [box('a', { label: 'old', action: { kind: 'x' } }), box('c')],
      locked: false,
      folder: 'f',
    } as unknown as Parameters<typeof restoredTab>[1];
    const next = restoredTab(stored, body);
    expect(next).toMatchObject({ id: 't1', name: 'Now' });
    // A lock is not in liveknowledge: neither the stored tab's nor the version's survives a restore.
    expect(next).not.toHaveProperty('locked');
    expect(next).not.toHaveProperty('folder');
    expect(next.elements.map((e) => e.id)).toEqual(['a', 'c']);
    expect(next.elements[0]).toMatchObject({ label: 'old', commentThread: thread });
    expect(next.elements[0]).not.toHaveProperty('action');
  });

  it('leaves an unlocked tab unlocked', () => {
    const next = restoredTab(tab(), { elements: [box('a')], locked: true });
    expect(next.locked).toBeFalsy();
  });
});

describe('sameContent', () => {
  it("ignores the tab's own fields and sees content", () => {
    expect(sameContent(tab(), tab({ name: 'Other', locked: true }))).toBe(true);
    expect(sameContent(tab(), tab({ elements: [box('b')] }))).toBe(false);
    expect(sameContent(tab(), tab({ pattern: 'dots' } as Partial<Tab>))).toBe(false);
  });
});

describe('restoreRoomOps', () => {
  it('sends nothing for element-only changes', () => {
    expect(restoreRoomOps(tab(), tab({ elements: [box('b')] }))).toEqual([]);
  });

  it('patches, clears and steps the pages', () => {
    const before = tab({ pattern: 'dots', pages: [slide('s1')] } as Partial<Tab>);
    const after = tab({ pages: [slide('s1'), slide('s2')] });
    const [op] = restoreRoomOps(before, after);
    expect(op).toMatchObject({ kind: 'tab-meta', tabId: 't1', clear: ['pattern'] });
    expect((op as { patch: Record<string, unknown> }).patch.pages).toHaveLength(2);
    expect((op as { pageSteps: unknown[] }).pageSteps.length).toBeGreaterThan(0);
  });

  it('patches without steps when the pages are the same', () => {
    const [op] = restoreRoomOps(tab(), tab({ pattern: 'grid' } as Partial<Tab>));
    expect(op).toEqual({ kind: 'tab-meta', tabId: 't1', patch: { pattern: 'grid' } });
  });
});
