import { describe, expect, it } from 'vitest';
import type { Element } from '@liveknowledge/document';
import { resolveEditorCapabilities, writesKnowledgebase } from './editor-capabilities';

// docs/specs/013-workspace/share-roles.md "What a Participant changes", as the editor renders it.
const box = { x: 0, y: 0, width: 10, height: 10 };
const sticky = (extra: Record<string, unknown> = {}) =>
  ({ id: 's', type: 'sticky', ...box, ...extra }) as Element;
const shape = (extra: Record<string, unknown> = {}) =>
  ({ id: 'h', type: 'shape', shape: 'rectangle', ...box, ...extra }) as unknown as Element;

describe('resolveEditorCapabilities', () => {
  it('gives an Editor everything', () => {
    const can = resolveEditorCapabilities('edit');
    expect(can.takePart && can.writeArticle && can.editPages && can.manageKnowledgebase).toBe(true);
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

  // docs/specs/030-knowledgebase/knowledgebases-and-pages.md "Share roles": a Participant is an Editor minus the
  // Knowledgebase Settings, the Knowledgebase Style and automations.
  it('lets a Participant do all an Editor does but manage the knowledgebase', () => {
    const editor = resolveEditorCapabilities('edit');
    const can = resolveEditorCapabilities('participate');
    expect(can.manageKnowledgebase).toBe(false);
    for (const [key, value] of Object.entries(can)) {
      if (key === 'level' || key === 'manageKnowledgebase') continue;
      const theirs = editor[key as keyof typeof editor];
      if (typeof value === 'function') {
        for (const el of [sticky(), shape()])
          expect(value(el), key).toBe((theirs as (e: Element) => boolean)(el));
      } else expect(value, key).toEqual(theirs);
    }
  });

  // One row a role: writing on a page, changing the page tree, commenting, managing the knowledgebase.
  it.each([
    ['edit', true, true, true, true],
    ['participate', true, true, true, false],
    ['view', false, false, false, false],
  ] as const)(
    '%s: writes %s, edits the page tree %s, comments %s, manages %s',
    (level, writes, tree, comments, manages) => {
      const can = resolveEditorCapabilities(level);
      expect(can.writeArticle).toBe(writes);
      expect(can.editPages).toBe(tree);
      expect(can.takePart).toBe(comments);
      expect(can.manageKnowledgebase).toBe(manages);
      expect(writesKnowledgebase(level)).toBe(writes);
    },
  );

  // Nothing that adds, moves, resizes, restyles or removes an element is a capability at all, so no gesture can
  // open one by accident.
  it('holds no flag beyond these', () => {
    expect(Object.keys(resolveEditorCapabilities('participate')).sort()).toEqual([
      'editPages',
      'level',
      'manageKnowledgebase',
      'replace',
      'takePart',
      'writeArticle',
      'writeText',
    ]);
  });
});
