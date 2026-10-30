// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  copyElementText,
  readOnlyElementMenuFacts,
  readOnlyElementMenuItems,
  type ReadOnlyElementMenuFacts,
} from './read-only-element-menu';

const base: ReadOnlyElementMenuFacts = {
  takePart: false,
  commentsShown: true,
  attachments: true,
  hasComments: false,
  writeText: false,
  text: '',
  hasLink: false,
  hasNote: false,
};
const labels = (facts: Partial<ReadOnlyElementMenuFacts>) =>
  readOnlyElementMenuItems({ ...base, ...facts }).map((i) => i.label);

describe('readOnlyElementMenuItems', () => {
  it('gives a Viewer nothing on a bare element, so no menu opens', () => {
    expect(labels({})).toEqual([]);
  });

  it('lets a Viewer read a thread there is, never start one', () => {
    expect(labels({ hasComments: true })).toEqual(['Show Comments']);
  });

  it('lets a Participant add a comment anywhere, and view a thread there is', () => {
    expect(labels({ takePart: true })).toEqual(['Add Comment']);
    expect(labels({ takePart: true, hasComments: true })).toEqual(['View Comments']);
  });

  it('offers no comments where they are not shown (an embed)', () => {
    expect(labels({ takePart: true, hasComments: true, commentsShown: false })).toEqual([]);
  });

  it('offers Edit Text only where the session may write, as Add Text on an element with no words', () => {
    expect(labels({ writeText: true, text: 'Login' })).toEqual(['Edit Text', 'Copy Text']);
    expect(labels({ writeText: true })).toEqual(['Add Text']);
    expect(labels({ text: 'Login' })).toEqual(['Copy Text']);
  });

  it('opens a link and a note the element has, in the order of the rows', () => {
    expect(
      labels({ takePart: true, hasLink: true, hasNote: true, writeText: true, text: 'A' }),
    ).toEqual(['Add Comment', 'Edit Text', 'Open Link', 'View Note', 'Copy Text']);
  });

  it('attaches nothing to an arrow: only its words', () => {
    expect(
      labels({ attachments: false, takePart: true, hasLink: true, hasNote: true, text: 'yes' }),
    ).toEqual(['Copy Text']);
  });
});

describe('readOnlyElementMenuFacts', () => {
  const gates = { takePart: true, commentsShown: true, attachments: true, writeText: false };

  it('reads the words, link, note and thread an element carries', () => {
    expect(
      readOnlyElementMenuFacts(
        {
          label: '  Login ',
          link: { kind: 'url' },
          note: 'n',
          commentThread: { comments: [{}] },
        },
        gates,
      ),
    ).toEqual({ ...gates, text: 'Login', hasLink: true, hasNote: true, hasComments: true });
    expect(readOnlyElementMenuFacts({}, gates)).toEqual({
      ...gates,
      text: '',
      hasLink: false,
      hasNote: false,
      hasComments: false,
    });
  });

  it('gives an element that takes no attachments (an arrow) none, whatever it carries', () => {
    const facts = readOnlyElementMenuFacts(
      { label: 'yes', link: {}, note: 'n', commentThread: { comments: [{}] } },
      { ...gates, attachments: false },
    );
    expect([facts.hasLink, facts.hasNote, facts.hasComments, facts.text]).toEqual([
      false,
      false,
      false,
      'yes',
    ]);
  });
});

describe('copyElementText', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('writes the words to the clipboard', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    await expect(copyElementText('Login')).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith('Login');
  });

  it('says no where the page has no clipboard, or it refuses', async () => {
    vi.stubGlobal('navigator', {});
    await expect(copyElementText('x')).resolves.toBe(false);
    vi.stubGlobal('navigator', {
      clipboard: { writeText: vi.fn().mockRejectedValue(new Error()) },
    });
    await expect(copyElementText('x')).resolves.toBe(false);
  });
});
