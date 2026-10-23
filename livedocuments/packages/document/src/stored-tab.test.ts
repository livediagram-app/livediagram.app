import { describe, expect, it, vi } from 'vitest';
import { migrateIncomingElements, migrateIncomingTab, migrateStoredTab } from './stored-tab';
import type { Tab } from './index';

describe('migrateStoredTab', () => {
  it('returns the same tab when there is nothing to settle', () => {
    const tab: Tab = {
      id: 't',
      name: 'T',
      elements: [{ id: 'a', type: 'sticky', x: 0, y: 0, width: 1, height: 1 }],
    };
    expect(migrateStoredTab(tab)).toBe(tab);
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
