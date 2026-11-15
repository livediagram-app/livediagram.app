import { describe, expect, it, vi } from 'vitest';
import { copyFlaggedViewLink, type CopyFlaggedViewLinkInput } from './copy-flagged-view-link';
import { withPrototype } from './prototype-link';

// docs/specs/007-editor/wireframe-pages.md "Sharing a prototype": Copy Prototype Link (and Copy Inspect Link) hand
// over a link the session already holds, or the design's Viewer link; never a new one.
function input(overrides: Partial<CopyFlaggedViewLinkInput> = {}) {
  const toast = { success: vi.fn(), info: vi.fn(), error: vi.fn() };
  const value: CopyFlaggedViewLinkInput = {
    sessionShareCode: null,
    designId: 'd1',
    tabId: 't1',
    withFlag: withPrototype,
    shareAddress: (code) => `https://www.livedesign.app/design/shared?s=${code}`,
    listShareLinks: vi.fn(async () => ({ links: [] })),
    writeClipboard: vi.fn(async () => {}),
    openShare: vi.fn(),
    toast,
    copied: 'Copied a link that opens the prototype',
    makeFirst: 'Make a Viewer link, then copy the Prototype link.',
    now: 1_000,
    ...overrides,
  };
  return value;
}

describe('copyFlaggedViewLink', () => {
  it('copies a visitor’s own link with the flag, reading no links', async () => {
    const i = input({ sessionShareCode: 'visit' });
    expect(await copyFlaggedViewLink(i)).toBe(true);
    expect(i.writeClipboard).toHaveBeenCalledWith(
      'https://www.livedesign.app/design/shared?s=visit&prototype=1',
    );
    expect(i.listShareLinks).not.toHaveBeenCalled();
    expect(i.toast.success).toHaveBeenCalledWith('Copied a link that opens the prototype');
  });

  it('copies the design’s live Viewer link for whoever may share', async () => {
    const i = input({
      listShareLinks: vi.fn(async () => ({
        links: [
          { code: 'ed', level: 'edit', tabId: null, expiresAt: null },
          { code: 'vw', level: 'view', tabId: 't1', expiresAt: null },
        ],
      })),
    });
    expect(await copyFlaggedViewLink(i)).toBe(true);
    expect(i.writeClipboard).toHaveBeenCalledWith(
      'https://www.livedesign.app/design/shared?s=vw&prototype=1',
    );
  });

  it('opens Share to make a Viewer link when there is none', async () => {
    const i = input();
    expect(await copyFlaggedViewLink(i)).toBe(false);
    expect(i.openShare).toHaveBeenCalled();
    expect(i.toast.info).toHaveBeenCalledWith('Make a Viewer link, then copy the Prototype link.');
    expect(i.writeClipboard).not.toHaveBeenCalled();
  });

  it('says so when the links cannot be read or the clipboard refuses', async () => {
    const unread = input({ listShareLinks: vi.fn(async () => Promise.reject(new Error('x'))) });
    expect(await copyFlaggedViewLink(unread)).toBe(false);
    expect(unread.toast.error).toHaveBeenCalledWith('Couldn’t read the design’s links. Try again.');

    const refused = input({
      sessionShareCode: 'visit',
      writeClipboard: vi.fn(async () => Promise.reject(new Error('denied'))),
    });
    expect(await copyFlaggedViewLink(refused)).toBe(false);
    expect(refused.toast.error).toHaveBeenCalledWith('Couldn’t copy the link. Try again.');
  });

  it('copies nothing for a design with neither a visitor’s link nor an id', async () => {
    const i = input({ designId: null });
    expect(await copyFlaggedViewLink(i)).toBe(false);
    expect(i.writeClipboard).not.toHaveBeenCalled();
    expect(i.openShare).not.toHaveBeenCalled();
  });
});
