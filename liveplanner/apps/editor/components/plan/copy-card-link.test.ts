import { afterEach, describe, expect, it, vi } from 'vitest';
import { copyCardLink, LINK_COPIED, LINK_NOT_COPIED } from './copy-card-link';

// docs/specs/026-plan/plan-board.md "Its address": Copy Link says what happened either way.
describe('copyCardLink', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('copies the link and says so', async () => {
    const writeText = vi.fn(() => Promise.resolve());
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    const notify = vi.fn();
    copyCardLink('https://x/project/p#t=t&item=i', notify);
    await vi.waitFor(() => expect(notify).toHaveBeenCalledWith(LINK_COPIED));
    expect(writeText).toHaveBeenCalledWith('https://x/project/p#t=t&item=i');
  });

  it('says when the browser refuses', async () => {
    vi.stubGlobal('navigator', { clipboard: { writeText: () => Promise.reject(new Error('no')) } });
    const notify = vi.fn();
    copyCardLink('link', notify);
    await vi.waitFor(() => expect(notify).toHaveBeenCalledWith(LINK_NOT_COPIED));
  });

  it('says when there is no clipboard, or no navigator, and tolerates no toast', () => {
    vi.stubGlobal('navigator', {});
    const notify = vi.fn();
    copyCardLink('link', notify);
    expect(notify).toHaveBeenCalledWith(LINK_NOT_COPIED);
    vi.stubGlobal('navigator', undefined);
    copyCardLink('link', notify);
    expect(notify).toHaveBeenCalledTimes(2);
    expect(() => copyCardLink('link', undefined)).not.toThrow();
  });
});
