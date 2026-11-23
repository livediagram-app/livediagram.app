// Require Reading in the page's menu (docs/specs/030-knowledgebase/required-reading.md "Where it shows"; owner
// 2026-11-23: "require reading should be in the page context menu until enabled, not always shown"): who is offered
// it.
import { describe, expect, it } from 'vitest';
import type { PageReadingResponse } from '@liveknowledge/api-schema';
import { requireReadingOffered } from './reading-asked';
import type { PageReadingEntry } from './reading-store';

const OFF: PageReadingResponse = {
  required: null,
  mine: { asked: false },
  progress: null,
  sees: true,
  manages: true,
  email: true,
};
const ON: PageReadingResponse = {
  ...OFF,
  required: { audience: 'everyone', askedAt: 1, round: 1 },
  progress: { done: 0, total: 3 },
};
const entry = (status: PageReadingEntry['status'], reading: PageReadingResponse) => ({
  status,
  reading,
});

describe('Require Reading in the page menu', () => {
  it('is an Editor’s, on a page that is not Required Reading', () => {
    expect(requireReadingOffered(true, true, entry('ready', OFF))).toBe(true);
  });

  it('goes once the page is Required Reading, and comes back once it stops', () => {
    expect(requireReadingOffered(true, true, entry('ready', ON))).toBe(false);
    expect(requireReadingOffered(true, true, entry('ready', OFF))).toBe(true);
  });

  it('is offered on a page this session has not read yet', () => {
    expect(requireReadingOffered(true, true, entry('loading', { ...OFF, manages: false }))).toBe(
      true,
    );
    expect(requireReadingOffered(true, true, entry('failed', { ...OFF, manages: false }))).toBe(
      true,
    );
  });

  it('is never a Participant’s, a Viewer’s or a guest’s, nor where there is no room', () => {
    // Not an Editor of the whole knowledgebase (a Participant, a Viewer, a link).
    expect(requireReadingOffered(false, true, entry('ready', OFF))).toBe(false);
    // Signed out, Offline or an embed.
    expect(requireReadingOffered(true, false, entry('ready', OFF))).toBe(false);
    // The api said this person may not manage it.
    expect(requireReadingOffered(true, true, entry('ready', { ...OFF, manages: false }))).toBe(
      false,
    );
  });
});
