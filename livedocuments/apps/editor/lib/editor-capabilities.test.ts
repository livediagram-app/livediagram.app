import { describe, expect, it } from 'vitest';
import type { Element } from '@livedocuments/document';
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
    expect(can.takePart && can.writeArticle).toBe(true);
    expect(can.writeText(shape()) && can.writeText(shape({ locked: true }))).toBe(true);
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

  it('lets a Participant comment and write text, on anything not locked', () => {
    const can = resolveEditorCapabilities('participate');
    expect(can.takePart && can.writeArticle).toBe(true);
    expect(can.writeText(shape())).toBe(true);
    expect(can.writeText(sticky())).toBe(true);
    expect(can.writeText(shape({ locked: true }))).toBe(false);
  });

  // Text only: nothing that adds, moves, resizes, restyles or removes an element is a capability at all, so no
  // gesture can open one for a Participant by accident.
  it('holds no flag beyond the text ones', () => {
    expect(Object.keys(resolveEditorCapabilities('participate')).sort()).toEqual([
      'level',
      'takePart',
      'writeArticle',
      'writeText',
    ]);
  });
});
