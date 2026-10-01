import { afterEach, describe, expect, it, vi } from 'vitest';
import { DOCUMENT_FORMAT } from '@livediagram/api-schema';
import {
  newVersionAvailable,
  noteServerDocumentFormat,
  resetDocumentFormatForTests,
  serverDocumentFormat,
  subscribeDocumentFormat,
} from './document-format';

// docs/specs/016-platform/new-version-prompt.md "When the prompt shows".
afterEach(() => resetDocumentFormatForTests());

describe('the server document format', () => {
  it('starts unknown, with nothing newer', () => {
    expect(serverDocumentFormat()).toBeNull();
    expect(newVersionAvailable()).toBe(false);
  });

  it('offers a new version only when the server is ahead of this editor', () => {
    noteServerDocumentFormat(String(DOCUMENT_FORMAT));
    expect(newVersionAvailable()).toBe(false);
    noteServerDocumentFormat(DOCUMENT_FORMAT - 1);
    expect(newVersionAvailable()).toBe(false);
    noteServerDocumentFormat(String(DOCUMENT_FORMAT + 1));
    expect(newVersionAvailable()).toBe(true);
  });

  it('keeps the highest number heard and tells listeners only when it rises', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeDocumentFormat(listener);
    noteServerDocumentFormat(DOCUMENT_FORMAT + 1);
    noteServerDocumentFormat(DOCUMENT_FORMAT);
    noteServerDocumentFormat(DOCUMENT_FORMAT + 1);
    expect(serverDocumentFormat()).toBe(DOCUMENT_FORMAT + 1);
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    noteServerDocumentFormat(DOCUMENT_FORMAT + 2);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('ignores anything that is not a format number', () => {
    for (const junk of [null, undefined, '', 'two', -3, 0, 2.5, {}]) noteServerDocumentFormat(junk);
    expect(serverDocumentFormat()).toBeNull();
  });
});
