// @vitest-environment jsdom
// A browser save for a blob: an object URL on a temporary link, clicked, removed, and revoked a moment later
// (revoking at once aborts the save in some browsers).
import { afterEach, describe, expect, it, vi } from 'vitest';
import { downloadBlob } from './download-blob';

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('downloadBlob', () => {
  it('clicks a temporary link to the blob, then revokes its URL after a second', () => {
    vi.useFakeTimers();
    const create = vi.fn(() => 'blob:fake');
    const revoke = vi.fn();
    Object.assign(URL, { createObjectURL: create, revokeObjectURL: revoke });
    const clicked: { href: string; download: string; attached: boolean }[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      clicked.push({
        href: this.href,
        download: this.download,
        attached: document.body.contains(this),
      });
    });
    const blob = new Blob(['a,b'], { type: 'text/csv' });
    downloadBlob(blob, 'Sheet 1.csv');
    expect(create).toHaveBeenCalledWith(blob);
    expect(clicked).toEqual([{ href: 'blob:fake', download: 'Sheet 1.csv', attached: true }]);
    expect(document.querySelector('a')).toBeNull();
    expect(revoke).not.toHaveBeenCalled();
    vi.advanceTimersByTime(999);
    expect(revoke).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(revoke).toHaveBeenCalledWith('blob:fake');
  });
});
