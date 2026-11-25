// Connect as tabs' words (connected-tabs.md "Linked from a Send to"): the row for every way two files stand, and
// what is said after a link that left a file without its tab.
import { describe, expect, it } from 'vitest';
import {
  linkTabsCopy,
  linkTabsView,
  linkedTabsNotice,
  type LinkTabsState,
} from './link-tabs-words';

const names = { source: 'Retro', target: ' ' };
type Side = 'connected' | 'can' | 'cannot';
const ready = (source: Side, target: Side): LinkTabsState => ({ kind: 'ready', source, target });

describe('linkTabsView and linkTabsCopy', () => {
  it('offers both ways for a new, loading or unread destination', () => {
    for (const kind of ['new', 'loading', 'failed'] as const) {
      expect(linkTabsView({ kind })).toBe('offer');
      expect(linkTabsCopy({ kind }, names).line).toBe(
        'Retro and Untitled each get a tab that opens the other.',
      );
    }
    expect(linkTabsCopy(ready('can', 'can'), names).line).toContain('each get a tab');
  });

  it('says which side alone gets a tab', () => {
    expect(linkTabsCopy(ready('cannot', 'can'), names).line).toBe(
      'Only Untitled gets a tab: you can’t change Retro’s tabs.',
    );
    expect(linkTabsCopy(ready('can', 'cannot'), names).line).toBe(
      'Only Retro gets a tab: you can’t change Untitled’s tabs.',
    );
    expect(linkTabsCopy(ready('connected', 'can'), names).line).toBe(
      'Untitled gets a tab that opens Retro, which has one already.',
    );
    expect(linkTabsCopy(ready('can', 'connected'), names).line).toBe(
      'Retro gets a tab that opens Untitled, which has one already.',
    );
  });

  it('shows files already connected, and why nothing can be done', () => {
    expect(linkTabsView(ready('connected', 'connected'))).toBe('connected');
    expect(linkTabsCopy(ready('connected', 'connected'), names)).toEqual({
      title: 'Connected as tabs',
      line: 'Retro and Untitled already open each other.',
    });
    expect(linkTabsCopy(ready('connected', 'cannot'), names).line).toBe(
      'Retro already has a tab for Untitled.',
    );
    expect(linkTabsCopy(ready('cannot', 'connected'), names).line).toBe(
      'Untitled already has a tab for Retro.',
    );
    expect(linkTabsView(ready('cannot', 'cannot'))).toBe('blocked');
    expect(linkTabsCopy(ready('cannot', 'cannot'), names).line).toBe(
      'You can’t change the tabs of either file.',
    );
  });
});

describe('linkedTabsNotice', () => {
  const n = { source: 'Retro', target: 'Sprint' };
  it('is silent when both files hold their tab', () => {
    expect(linkedTabsNotice({ source: 'made', target: 'connected' }, n)).toBeNull();
  });

  it('says why one file went without', () => {
    expect(linkedTabsNotice({ source: 'made', target: 'cannot' }, n)).toEqual({
      tone: 'info',
      message: 'Connected one way: only Retro got a tab, as you can’t change Sprint’s tabs.',
    });
    expect(linkedTabsNotice({ source: 'full', target: 'made' }, n)?.message).toBe(
      'Connected one way: Retro holds as many connected tabs as it may.',
    );
    expect(linkedTabsNotice({ source: 'made', target: 'unreached' }, n)?.message).toBe(
      'Connected one way: Sprint could not be reached just now.',
    );
  });

  it('says when neither did', () => {
    expect(linkedTabsNotice({ source: 'cannot', target: 'cannot' }, n)?.tone).toBe('info');
    expect(linkedTabsNotice({ source: 'unreached', target: 'cannot' }, n)).toEqual({
      tone: 'warning',
      message: 'Retro and Sprint could not be connected as tabs just now.',
    });
  });
});
