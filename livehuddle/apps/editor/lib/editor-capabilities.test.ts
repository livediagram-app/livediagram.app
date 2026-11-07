import { describe, expect, it } from 'vitest';
import type { Element } from '@livehuddle/document';
import { contentAddBlocked, resolveEditorCapabilities } from './editor-capabilities';

// docs/specs/013-workspace/share-roles.md "What a Participant changes", as the editor renders it.
const ME = 'a'.repeat(32);
const box = { x: 0, y: 0, width: 10, height: 10 };
const sticky = (extra: Record<string, unknown> = {}) =>
  ({ id: 's', type: 'sticky', ...box, ...extra }) as Element;
const shape = (extra: Record<string, unknown> = {}) =>
  ({ id: 'h', type: 'shape', shape: 'square', ...box, ...extra }) as unknown as Element;

describe('resolveEditorCapabilities', () => {
  it('gives an Editor everything', () => {
    const can = resolveEditorCapabilities({ level: 'edit', adderKey: null });
    expect(can.takePart && can.addContent).toBe(true);
    expect(can.remove(shape()) && can.move(shape()) && can.recolour(shape())).toBe(true);
  });

  // Locks the role in as capabilities are added: every flag and every per-element check is false for a Viewer.
  it('gives a Viewer nothing at all, whatever the element', () => {
    const can = resolveEditorCapabilities({ level: 'view', adderKey: ME });
    const els = [sticky(), sticky({ addedBy: ME }), shape(), shape({ shape: 'mind-node' })];
    for (const [key, value] of Object.entries(can)) {
      // Held walking is not a gesture: share-roles.md "Always walking" (its own test below).
      if (key === 'level' || key === 'alwaysWalks') continue;
      if (typeof value === 'function') {
        for (const el of els) expect(value(el), key).toBe(false);
      } else expect(value, key).toBe(false);
    }
  });

  it('gives a Viewer nothing', () => {
    const can = resolveEditorCapabilities({ level: 'view', adderKey: ME });
    expect(can.takePart || can.addContent).toBe(false);
    expect(
      can.writeText(sticky()) || can.move(sticky()) || can.remove(sticky({ addedBy: ME })),
    ).toBe(false);
  });

  // docs/specs/013-workspace/share-roles.md "A Participant walks": takes part, changes no content (its own earlier
  // stickies included), swings every door and always walks.
  it('gives a Participant no content gesture, with or without its key', () => {
    for (const adderKey of [ME, null]) {
      const can = resolveEditorCapabilities({ level: 'participate', adderKey });
      expect(can.takePart).toBe(true);
      expect(can.addContent).toBe(false);
      const text = { id: 'x', type: 'text', ...box, addedBy: ME } as Element;
      for (const el of [shape(), sticky(), sticky({ addedBy: ME }), text]) {
        expect(
          can.writeText(el) || can.move(el) || can.resize(el) || can.recolour(el) || can.remove(el),
        ).toBe(false);
      }
    }
  });

  // docs/specs/013-workspace/share-roles.md "Always walking": a Participant and a Viewer never leave; an Editor may.
  it('holds a Participant and a Viewer in Avatar mode, never an Editor', () => {
    expect(resolveEditorCapabilities({ level: 'participate', adderKey: ME }).alwaysWalks).toBe(
      true,
    );
    expect(resolveEditorCapabilities({ level: 'edit', adderKey: null }).alwaysWalks).toBe(false);
    expect(resolveEditorCapabilities({ level: 'view', adderKey: null }).alwaysWalks).toBe(true);
  });
});

// docs/specs/009-elements/room-builder.md "Opening and closing": an Editor and a Participant swing doors.
describe('swingDoor', () => {
  const door = (extra: Record<string, unknown> = {}) => shape({ shape: 'door', ...extra });

  it('lets an Editor swing any door', () => {
    const can = resolveEditorCapabilities({ level: 'edit', adderKey: null });
    expect(can.swingDoor(door()) && can.swingDoor(door({ locked: true }))).toBe(true);
  });

  // not-in-livehuddle.md "Element and Tab Locking": a door saved locked swings like any other.
  it('lets a Participant swing any door, one saved locked too, with or without a key', () => {
    for (const adderKey of [ME, null]) {
      const can = resolveEditorCapabilities({ level: 'participate', adderKey });
      expect(can.swingDoor(door())).toBe(true);
      expect(can.swingDoor(door({ locked: true }))).toBe(true);
    }
  });

  it('lets a Viewer swing none', () => {
    const can = resolveEditorCapabilities({ level: 'view', adderKey: ME });
    expect(can.swingDoor(door())).toBe(false);
  });
});

describe('contentAddBlocked', () => {
  const base = {
    participating: false,
    canAddContent: false,
    blocked: false,
    structureBlocked: true,
  };
  it('opens to a Participant that may add content', () => {
    expect(contentAddBlocked({ ...base, participating: true, canAddContent: true })).toBe(false);
  });
  it('keeps a Participant shut until it holds an adder key, and while the session guard holds', () => {
    expect(contentAddBlocked({ ...base, participating: true, canAddContent: false })).toBe(true);
    expect(
      contentAddBlocked({ ...base, participating: true, canAddContent: true, blocked: true }),
    ).toBe(true);
  });
  it('keeps a Viewer shut, and lets an Editor through on the structural guard', () => {
    expect(contentAddBlocked(base)).toBe(true);
    expect(contentAddBlocked({ ...base, structureBlocked: false })).toBe(false);
  });
});
