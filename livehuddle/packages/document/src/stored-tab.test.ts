import { describe, expect, it, vi } from 'vitest';
import { migrateIncomingElements, migrateIncomingTab, migrateStoredTab } from './stored-tab';
import type { Tab } from './index';

// Every tab-level migration on the way in, in one call (docs/specs/011-theme/retired-schemes.md): the api's
// tab read, the thumbnail render, the offline store and a file import all run this.
describe('migrateStoredTab', () => {
  it('migrates a retired scheme and retired element fields in one pass', () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const tab = {
      id: 't',
      name: 'T',
      theme: 'charcoal',
      backgroundColor: '#2b2b33',
      patternColor: '#636373',
      elements: [
        {
          id: 'a',
          type: 'shape',
          shape: 'square',
          x: 0,
          y: 0,
          width: 1,
          height: 1,
          fillColor: '#2c2c33',
          groupId: 'g',
        },
      ],
    } as unknown as Tab;
    const out = migrateStoredTab(tab);
    expect(out.theme).toBe('brand');
    expect(out.elements[0]).not.toHaveProperty('fillColor');
    expect(out.elements[0]).not.toHaveProperty('groupId');
  });

  it('returns the same tab when there is nothing to migrate', () => {
    const tab: Tab = {
      id: 't',
      name: 'T',
      elements: [{ id: 'a', type: 'sticky', x: 0, y: 0, width: 1, height: 1 }],
    };
    expect(migrateStoredTab(tab)).toBe(tab);
  });
});

// docs/specs/007-editor/editor-modes.md "Existing whiteboards": every entry point reads a stored
// whiteboard as a general tab that opens in Draw.
describe('a stored whiteboard tab', () => {
  const whiteboard = () => ({
    id: 't',
    name: 'Board',
    kind: 'whiteboard',
    elements: [{ id: 's', type: 'shape', shape: 'circle', x: 0, y: 0, width: 1, height: 1 }],
  });

  it('opens in Draw from storage', () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const out = migrateStoredTab(whiteboard() as unknown as Tab);
    expect(out.kind).toBe('diagram');
    expect(out.opensIn).toBe('draw');
    expect(out.elements[0]).toMatchObject({ penColour: 'ink', fillColor: 'transparent' });
  });

  it('opens in Draw from outside (an api write, a peer, a file)', () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const out = migrateIncomingTab(whiteboard()) as Tab;
    expect(out.kind).toBe('diagram');
    expect(out.opensIn).toBe('draw');
  });
});

// Untrusted input (an api write, a realtime peer, a file, a paste) is migrated BEFORE it is validated, and the
// migrations read an element's fields. A malformed element must reach validation as it came, to be refused there,
// never throw: a step chip whose label was a number once threw in a settle step, so a tab PUT answered 500 and a file
// import broke instead of being refused. An element whose fields cannot be read stands in for any such throw.
describe('migrating untrusted input', () => {
  const box = {
    id: 'a',
    type: 'shape',
    shape: 'square',
    x: 0,
    y: 0,
    width: 10,
    height: 10,
    label: 'A',
  };
  const badStep = {
    id: 's',
    get type(): string {
      throw new Error('unreadable');
    },
  };

  it('hands a tab that a migration cannot read back as it came', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const tab = { id: 't', name: 'T', elements: [box, badStep] };
    expect(migrateIncomingTab(tab)).toBe(tab);
    expect(warn).toHaveBeenCalledWith('[migrate] incoming-unreadable', { elements: 2 });
    warn.mockRestore();
  });

  it('hands elements that a migration cannot read back as they came, non-objects dropped', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const out = migrateIncomingElements([box, badStep, 7]);
    expect(out).toHaveLength(2);
    expect(out[0]).toBe(box);
    expect(out[1]).toBe(badStep);
    warn.mockRestore();
  });

  // A stored step is a retired element (docs/specs/002-project-scope/not-in-livehuddle.md "The element engine",
  // part 3): nothing numbers it any more, so it reads back exactly as it came, an unreadable label and all.
  it('reads a stored step back as it came, its label unnumbered', () => {
    const step = { ...box, id: 's', shape: 'step', label: 5 };
    const [, read] = migrateIncomingElements([box, structuredClone(step)]);
    expect(read).toEqual(step);
  });
});
