import { describe, expect, it } from 'vitest';
import type { Element } from '@liveknowledge/document';
import { resolveEditorCapabilities } from './editor-capabilities';

// docs/specs/013-workspace/share-roles.md "What a Participant changes", as the editor renders it.
const box = { x: 0, y: 0, width: 10, height: 10 };
const sticky = (extra: Record<string, unknown> = {}) =>
  ({ id: 's', type: 'sticky', ...box, ...extra }) as Element;
const shape = (extra: Record<string, unknown> = {}) =>
  ({ id: 'h', type: 'shape', shape: 'rectangle', ...box, ...extra }) as unknown as Element;

describe('resolveEditorCapabilities', () => {
  it('gives an Editor everything', () => {
    const can = resolveEditorCapabilities('edit');
    expect(can.takePart && can.writeArticle && can.editPages).toBe(true);
    expect(can.writeText(shape()) && can.writeText(shape({ locked: true }))).toBe(true);
    // Find and replace: an Editor replaces anywhere it finds.
    expect(can.replace).toBe('any');
  });

  // Locks the role in as capabilities are added: every flag and every per-element check is false for a Viewer.
  it('gives a Viewer nothing at all, whatever the element', () => {
    const can = resolveEditorCapabilities('view');
    const els = [sticky(), shape(), shape({ shape: 'circle' })];
    for (const [key, value] of Object.entries(can)) {
      if (key === 'level') continue;
      if (typeof value === 'function') {
        for (const el of els) expect(value(el), key).toBe(false);
      } else expect(value, key).toBe(false);
    }
  });

  // docs/specs/030-knowledgebase/knowledgebases-and-pages.md "Share roles": a Participant comments, and that is all.
  it('lets a Participant comment, and nothing else: no writing, no page tree, no replace', () => {
    const can = resolveEditorCapabilities('participate');
    expect(can.takePart).toBe(true);
    for (const [key, value] of Object.entries(can)) {
      if (key === 'level' || key === 'takePart') continue;
      if (typeof value === 'function') {
        for (const el of [sticky(), shape()]) expect(value(el), key).toBe(false);
      } else expect(value, key).toBe(false);
    }
  });

  // One row a role: writing on a page, changing the page tree, commenting.
  it.each([
    ['edit', true, true, true],
    ['participate', false, false, true],
    ['view', false, false, false],
  ] as const)(
    '%s: writes %s, edits the page tree %s, comments %s',
    (level, writes, tree, comments) => {
      const can = resolveEditorCapabilities(level);
      expect(can.writeArticle).toBe(writes);
      expect(can.editPages).toBe(tree);
      expect(can.takePart).toBe(comments);
    },
  );

  // Nothing that adds, moves, resizes, restyles or removes an element is a capability at all, so no gesture can
  // open one by accident.
  it('holds no flag beyond these', () => {
    expect(Object.keys(resolveEditorCapabilities('participate')).sort()).toEqual([
      'editPages',
      'level',
      'replace',
      'takePart',
      'writeArticle',
      'writeText',
    ]);
  });
});
