import { describe, expect, it } from 'vitest';
import { upgradeLegacyLinks } from './legacy-links';

describe('upgradeLegacyLinks', () => {
  it('upgrades an element link written before the rename', () => {
    const tab = {
      id: 't',
      kind: 'diagram',
      elements: [{ id: 'e', link: { kind: 'diagram', diagramId: 'd1', name: 'Roadmap' } }],
    };
    expect(upgradeLegacyLinks(tab)).toEqual({
      id: 't',
      kind: 'diagram',
      elements: [{ id: 'e', link: { kind: 'project', projectId: 'd1', name: 'Roadmap' } }],
    });
  });

  it('upgrades links at any depth, such as table cells', () => {
    const table = {
      cells: [[{ text: 'a', link: { name: 'X', diagramId: 'd2', kind: 'diagram' } }]],
    };
    expect(upgradeLegacyLinks(table)).toEqual({
      cells: [[{ text: 'a', link: { kind: 'project', projectId: 'd2', name: 'X' } }]],
    });
  });

  it('never touches the tab kind or other kinds', () => {
    const tab = {
      kind: 'diagram',
      elements: [
        { link: { kind: 'tab', tabId: 't2' } },
        { link: { kind: 'url', url: 'https://x' } },
      ],
    };
    expect(upgradeLegacyLinks(tab)).toEqual(tab);
  });

  it('returns the same reference when there is nothing to upgrade', () => {
    const tab = {
      kind: 'diagram',
      elements: [{ link: { kind: 'project', projectId: 'd', name: 'n' } }],
    };
    expect(upgradeLegacyLinks(tab)).toBe(tab);
  });

  it('leaves primitives and null alone', () => {
    expect(upgradeLegacyLinks(null)).toBeNull();
    expect(upgradeLegacyLinks('diagram')).toBe('diagram');
  });
});

describe('upgradeLegacyLinks, the half-renamed form', () => {
  it('heals a link whose key was renamed but whose kind was not', () => {
    expect(upgradeLegacyLinks({ link: { kind: 'diagram', projectId: 'd', name: 'N' } })).toEqual({
      link: { kind: 'project', projectId: 'd', name: 'N' },
    });
  });
  it('still leaves a tab kind alone', () => {
    const tab = { kind: 'diagram', name: 'Tab 1' };
    expect(upgradeLegacyLinks(tab)).toBe(tab);
  });
});
