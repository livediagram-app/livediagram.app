import { describe, expect, it } from 'vitest';
import { mayEditPage, readLensLocked } from './page-edit-roles';

// docs/specs/030-knowledgebase/editing.md "Share roles": an Editor edits; a Participant, a Viewer and a link read.

const editor = { isReadOnly: false, participating: false, connected: false, loaded: true };

describe('who edits a page', () => {
  it('is an Editor, on a loaded page of its own', () => {
    expect(mayEditPage(editor)).toBe(true);
    expect(mayEditPage({ ...editor, loaded: false })).toBe(false);
    expect(mayEditPage({ ...editor, connected: true })).toBe(false);
  });

  it('is never a Participant, a Viewer or a view link', () => {
    expect(mayEditPage({ ...editor, participating: true })).toBe(false);
    // A Viewer and a view link are both read-only sessions.
    expect(mayEditPage({ ...editor, isReadOnly: true })).toBe(false);
  });

  it('locks the read lens only for someone who could otherwise change the page', () => {
    expect(readLensLocked(editor)).toBe(true);
    expect(readLensLocked({ isReadOnly: true, participating: false })).toBe(false);
    expect(readLensLocked({ isReadOnly: false, participating: true })).toBe(false);
  });
});
