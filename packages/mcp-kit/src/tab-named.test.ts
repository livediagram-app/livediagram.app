import { describe, expect, it } from 'vitest';
import { refuseUnknownTab, tabIdNamed } from './tab-named';
import { ToolInputError } from './tool-result';

const TABS = [
  { id: 't1', name: 'Overview' },
  { id: 't2', name: 'Roadmap' },
  { id: 't3', name: 'Notes' },
  { id: 't4', name: 'notes ' },
];

describe('tabIdNamed', () => {
  it('reads an id as itself, even when a tab is named like it', () => {
    expect(tabIdNamed(TABS, 't2')).toBe('t2');
    expect(tabIdNamed([...TABS, { id: 't5', name: 't1' }], 't1')).toBe('t1');
  });

  it('reads a name one tab alone has, in any case', () => {
    expect(tabIdNamed(TABS, 'Roadmap')).toBe('t2');
    expect(tabIdNamed(TABS, ' overview ')).toBe('t1');
  });

  it('answers nothing for a name two tabs share, or one no tab has', () => {
    expect(tabIdNamed(TABS, 'Notes')).toBeUndefined();
    expect(tabIdNamed(TABS, 'Budget')).toBeUndefined();
  });
});

describe('refuseUnknownTab', () => {
  const tabs = [{ id: 't1', name: 'Plan' }];

  it('names the tabs when the file holds no such tab', async () => {
    const refused = refuseUnknownTab(async () => tabs, 'nope', 'design');
    await expect(refused).rejects.toBeInstanceOf(ToolInputError);
    await expect(refused).rejects.toThrow('No tab "nope" in this design. Tabs: Plan (t1).');
  });

  it('returns when the file holds the tab, or cannot be read, so the 404 stands', async () => {
    await expect(refuseUnknownTab(async () => tabs, 't1', 'design')).resolves.toBeUndefined();
    const gone = async () => {
      throw new Error('404');
    };
    await expect(refuseUnknownTab(gone, 't1', 'design')).resolves.toBeUndefined();
  });
});
