import { describe, expect, it } from 'vitest';
import { withDraftMade, type ArticleBlock, type Tab } from '@liveknowledge/document';
import {
  agentChangeDetail,
  draftDiffersOnce,
  draftStatus,
  editorsPhrase,
  modifierName,
} from './page-edit-text';

// docs/specs/030-knowledgebase/blueprints/editing.md "Presentation and UX".

const para = (text: string): ArticleBlock => ({ id: 'a', type: 'paragraph', runs: [{ text }] });
const page = (): Tab => ({
  id: 't1',
  name: 'P',
  elements: [],
  pages: [{ id: 'p1', orientation: 'portrait', kind: 'article', flow: 'art-1' }],
  articles: { 'art-1': { blocks: [para('Saved')] } },
});
const HOUR = 3_600_000;

describe('the words', () => {
  it('names the people editing', () => {
    expect(editorsPhrase([])).toBe('');
    expect(editorsPhrase(['Priya'])).toBe('Priya');
    expect(editorsPhrase(['Priya', 'Sam'])).toBe('Priya and Sam');
    expect(editorsPhrase(['Priya', 'Sam', 'Ana'])).toBe('Priya and 2 others');
  });

  it('says nothing while the draft is the saved page', () => {
    expect(draftStatus(page(), { me: 'Sam', since: 0, now: 0 })).toBe('');
    const same = withDraftMade(page(), { blocks: [para('Saved')] }, 'Sam', 5);
    expect(draftStatus(same, { me: 'Sam', since: 0, now: 10 })).toBe('');
  });

  it("says Unsaved changes for this session's, and whose a left draft is", () => {
    const tab = withDraftMade(page(), { blocks: [para('Mine')] }, 'Sam', 10 * HOUR);
    expect(draftStatus(tab, { me: 'Sam', since: 9 * HOUR, now: 10 * HOUR })).toBe(
      'Unsaved changes',
    );
    expect(draftStatus(tab, { me: 'Ana', since: 9 * HOUR, now: 12 * HOUR })).toMatch(
      /^Unsaved changes from Sam, 2 hours ago$/,
    );
    expect(draftStatus(tab, { me: 'Sam', since: 11 * HOUR, now: 12 * HOUR })).toMatch(
      /^Unsaved changes from you, 2 hours ago$/,
    );
    expect(draftDiffersOnce(tab)).toBe(true);
  });

  it("says what an agent's change means, and the platform's modifier", () => {
    expect(agentChangeDetail(1)).toBe('1 block changed. Saving keeps your changes and theirs.');
    expect(agentChangeDetail(3)).toBe('3 blocks changed. Saving keeps your changes and theirs.');
    expect(modifierName('MacIntel')).toBe('Cmd');
    expect(modifierName('iPhone')).toBe('Cmd');
    expect(modifierName('Win32')).toBe('Ctrl');
    expect(modifierName(undefined)).toBe('Ctrl');
  });
});
