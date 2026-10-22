import { afterEach, describe, expect, it, vi } from 'vitest';
import { PROJECT_FORMAT, parseBuildId } from '@liveplanner/api-schema';
import {
  EDITOR_BUILD_ID,
  isStaleBuild,
  noteServerBuild,
  serverBuild,
  newVersionAvailable,
  noteServerProjectFormat,
  resetServerReleaseForTests,
  serverProjectFormat,
  subscribeServerRelease,
} from './server-release';

// docs/specs/016-platform/new-version-prompt.md "When the prompt shows".
afterEach(() => resetServerReleaseForTests());

describe('the server project format', () => {
  it('starts unknown, with nothing newer', () => {
    expect(serverProjectFormat()).toBeNull();
    expect(newVersionAvailable()).toBe(false);
  });

  it('offers a new version only when the server is ahead of this editor', () => {
    noteServerProjectFormat(String(PROJECT_FORMAT));
    expect(newVersionAvailable()).toBe(false);
    noteServerProjectFormat(PROJECT_FORMAT - 1);
    expect(newVersionAvailable()).toBe(false);
    noteServerProjectFormat(String(PROJECT_FORMAT + 1));
    expect(newVersionAvailable()).toBe(true);
  });

  it('keeps the highest number heard and tells listeners only when it rises', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeServerRelease(listener);
    noteServerProjectFormat(PROJECT_FORMAT + 1);
    noteServerProjectFormat(PROJECT_FORMAT);
    noteServerProjectFormat(PROJECT_FORMAT + 1);
    expect(serverProjectFormat()).toBe(PROJECT_FORMAT + 1);
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    noteServerProjectFormat(PROJECT_FORMAT + 2);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('ignores anything that is not a format number', () => {
    for (const junk of [null, undefined, '', 'two', -3, 0, 2.5, {}]) noteServerProjectFormat(junk);
    expect(serverProjectFormat()).toBeNull();
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
