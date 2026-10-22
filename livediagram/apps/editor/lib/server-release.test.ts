import { afterEach, describe, expect, it, vi } from 'vitest';
import { DOCUMENT_FORMAT, parseBuildId } from '@livediagram/api-schema';
import {
  EDITOR_BUILD_ID,
  isStaleBuild,
  noteServerBuild,
  serverBuild,
  newVersionAvailable,
  noteServerDocumentFormat,
  resetServerReleaseForTests,
  serverDocumentFormat,
  subscribeServerRelease,
} from './server-release';

// docs/specs/016-platform/new-version-prompt.md "When the prompt shows".
afterEach(() => resetServerReleaseForTests());

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
    const unsubscribe = subscribeServerRelease(listener);
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

// docs/specs/016-platform/stale-builds.md "Knowing which build is live".
describe('the server build id', () => {
  it('is stale only when both ids are known and differ', () => {
    expect(isStaleBuild('a1', null)).toBe(false);
    expect(isStaleBuild(null, 'b2')).toBe(false);
    expect(isStaleBuild('a1', 'a1')).toBe(false);
    expect(isStaleBuild('a1', 'b2')).toBe(true);
  });

  it('keeps the latest id heard and tells listeners when it changes', () => {
    const listener = vi.fn();
    subscribeServerRelease(listener);
    noteServerBuild('b2');
    noteServerBuild('b2');
    noteServerBuild('c3');
    expect(serverBuild()).toBe('c3');
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('ignores anything that is not a build id', () => {
    for (const junk of [null, undefined, '', 'has space', 42]) noteServerBuild(junk);
    expect(serverBuild()).toBeNull();
  });

  it('reads this editor’s own id from the build', () => {
    expect(EDITOR_BUILD_ID).toBe(parseBuildId(process.env.NEXT_PUBLIC_BUILD_ID));
  });
});
