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
// whiteboard as a general tab that opens in Drawing.
describe('a stored whiteboard tab', () => {
  const whiteboard = () => ({
    id: 't',
    name: 'Board',
    kind: 'whiteboard',
    elements: [{ id: 's', type: 'shape', shape: 'circle', x: 0, y: 0, width: 1, height: 1 }],
  });

  it('opens in Drawing from storage', () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const out = migrateStoredTab(whiteboard() as unknown as Tab);
    expect(out.kind).toBe('diagram');
    expect(out.opensIn).toBe('draw');
    expect(out.elements[0]).toMatchObject({ penColour: 'ink', fillColor: 'transparent' });
  });

  it('opens in Drawing from outside (an api write, a peer, a file)', () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const out = migrateIncomingTab(whiteboard()) as Tab;
    expect(out.kind).toBe('diagram');
    expect(out.opensIn).toBe('draw');
  });
});

// Untrusted input (an api write, a realtime peer, a file, a paste) is migrated BEFORE it is validated, and the
// migrations' settle steps read an element's fields as their types. A malformed element must reach validation as it
// came, to be refused there, never throw: a step chip whose label was a number threw in settleChips, so a tab PUT
// answered 500 and a file import broke instead of being refused.
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
  const badStep = { ...box, id: 's', shape: 'step', label: 5 };

  it('hands a tab that a migration cannot read back as it came', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const tab = { id: 't', name: 'T', elements: [box, badStep] };
    expect(migrateIncomingTab(tab)).toBe(tab);
    expect(warn).toHaveBeenCalledWith('[migrate] incoming-unreadable', { elements: 2 });
    warn.mockRestore();
  });

  it('hands elements that a migration cannot read back as they came, non-objects dropped', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(migrateIncomingElements([box, badStep, 7])).toEqual([box, badStep]);
    warn.mockRestore();
  });

  it('still migrates input it can read', () => {
    const step = { ...badStep, label: '' };
    const [, settled] = migrateIncomingElements([box, step]);
    expect(settled).not.toBe(step);
    expect((settled as { label?: string }).label).toBe('1');
  });
});
