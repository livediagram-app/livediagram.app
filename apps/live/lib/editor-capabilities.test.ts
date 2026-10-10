import { describe, expect, it } from 'vitest';
import type { Element } from '@livediagram/document';
import { resolveEditorCapabilities } from './editor-capabilities';

// docs/specs/013-workspace/share-roles.md "What a Participant changes", as the editor renders it.
const ME = 'a'.repeat(32);
const box = { x: 0, y: 0, width: 10, height: 10 };
const sticky = (extra: Record<string, unknown> = {}) =>
  ({ id: 's', type: 'sticky', ...box, ...extra }) as Element;
const shape = (extra: Record<string, unknown> = {}) =>
  ({ id: 'h', type: 'shape', shape: 'rectangle', ...box, ...extra }) as unknown as Element;

describe('resolveEditorCapabilities', () => {
  it('gives an Editor everything', () => {
    const can = resolveEditorCapabilities({ level: 'edit', adderKey: null });
    expect(can.takePart && can.addContent && can.planCards && can.sheetCells).toBe(true);
    expect(can.remove(shape()) && can.move(shape()) && can.recolour(shape())).toBe(true);
  });

  // Locks the role in as capabilities are added: every flag and every per-element check is false for a Viewer.
  it('gives a Viewer nothing at all, whatever the element', () => {
    const can = resolveEditorCapabilities({ level: 'view', adderKey: ME });
    const els = [sticky(), sticky({ addedBy: ME }), shape(), shape({ shape: 'mind-node' })];
    for (const [key, value] of Object.entries(can)) {
      if (key === 'level') continue;
      if (typeof value === 'function') {
        for (const el of els) expect((value as (e: Element) => boolean)(el), key).toBe(false);
      } else expect(value, key).toBe(false);
    }
  });

  it('gives a Viewer nothing', () => {
    const can = resolveEditorCapabilities({ level: 'view', adderKey: ME });
    expect(can.takePart || can.addContent || can.planCards || can.sheetCells).toBe(false);
    expect(
      can.writeText(sticky()) || can.move(sticky()) || can.remove(sticky({ addedBy: ME })),
    ).toBe(false);
  });

  it('lets a Participant write anywhere, move and recolour stickies, remove only its own', () => {
    const can = resolveEditorCapabilities({ level: 'participate', adderKey: ME });
    expect(can.takePart && can.addContent && can.planCards && can.sheetCells).toBe(true);
    expect(can.writeText(shape())).toBe(true);
    expect(can.writeText(shape({ locked: true }))).toBe(false);
    expect(can.writeText(shape({ shape: 'session-button', label: 'Poll' }))).toBe(false);
    expect(can.move(sticky())).toBe(true);
    expect(can.move(shape())).toBe(false);
    expect(can.move(shape({ shape: 'mind-node' }))).toBe(true);
    expect(can.resize(sticky())).toBe(true);
    expect(can.resize(shape())).toBe(false);
    expect(can.resize(shape({ addedBy: ME }))).toBe(true);
    expect(can.resize(sticky({ locked: true }))).toBe(false);
    const text = { id: 'x', type: 'text', ...box } as Element;
    expect(can.move(text) || can.resize(text)).toBe(false);
    expect(can.move({ ...text, addedBy: ME } as Element)).toBe(true);
    expect(can.recolour(sticky())).toBe(true);
    expect(can.recolour(shape())).toBe(false);
    expect(can.remove(sticky())).toBe(false);
    expect(can.remove(sticky({ addedBy: 'b'.repeat(32) }))).toBe(false);
    expect(can.remove(sticky({ addedBy: ME }))).toBe(true);
    expect(can.remove(shape({ shape: 'mind-node', addedBy: ME }))).toBe(true);
    expect(can.remove(shape({ shape: 'mind-node' }))).toBe(true);
    expect(can.remove(shape())).toBe(false);
    expect(can.remove(sticky({ addedBy: ME, locked: true }))).toBe(false);
  });

  it('adds nothing before the room has handed over its adder key', () => {
    const can = resolveEditorCapabilities({ level: 'participate', adderKey: null });
    expect(can.addContent).toBe(false);
    expect(can.remove(sticky({ addedBy: ME }))).toBe(false);
    expect(can.writeText(sticky())).toBe(true);
  });
});
