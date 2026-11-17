// @vitest-environment jsdom
import { writeThisBrowser } from '@liveworkspace/explorer/this-browser';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  archivedByIndex,
  archivedChangeFolderHref,
  archivedInThisBrowser,
  arrivedArchived,
  forgetArchivedArrival,
  isArchivedLoadError,
  leaveArchivedItem,
  takeArchivedHandoff,
} from './archived';

afterEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  forgetArchivedArrival();
  vi.restoreAllMocks();
});

const item = (id: string, archivedAt: number | null) => ({
  id,
  title: id,
  createdAt: 1,
  updatedAt: 1,
  lastOpenedAt: null,
  trashedAt: null,
  archivedAt,
});

describe('archived files in an editor', () => {
  it('sends Change Folder to the Explorer’s Archived, naming the file', () => {
    expect(archivedChangeFolderHref('a b')).toBe('/explorer/archived?move=a%20b');
    expect(archivedChangeFolderHref('d1', 'https://x.app')).toBe(
      'https://x.app/explorer/archived?move=d1',
    );
  });

  it('reads this browser’s mark, and nothing for an address with no file', () => {
    writeThisBrowser('livedesign', [item('kept', 5), item('live', null)]);
    expect(archivedInThisBrowser('livedesign', 'kept')).toBe(true);
    expect(archivedInThisBrowser('livedesign', 'live')).toBe(false);
    expect(archivedInThisBrowser('livediagram', 'kept')).toBe(false);
    expect(archivedInThisBrowser('livedesign', null)).toBe(false);
  });

  it('reads the index’s refusal, and only `archived`', () => {
    const refusal = (id: string) => (id === 'a' ? 'archived' : id === 'n' ? 'not_found' : null);
    expect(archivedByIndex('a', refusal)).toBe(true);
    expect(archivedByIndex('n', refusal)).toBe(false);
    expect(archivedByIndex('x', refusal)).toBe(false);
    expect(archivedByIndex(null, refusal)).toBe(false);
  });

  it('tells the api’s `409 archived` from every other load failure', () => {
    expect(isArchivedLoadError({ status: 409, code: 'archived' })).toBe(true);
    expect(isArchivedLoadError({ status: 409, code: 'tab_busy' })).toBe(false);
    expect(isArchivedLoadError({ status: 404, code: 'archived' })).toBe(false);
    expect(isArchivedLoadError(new Error('offline'))).toBe(false);
    expect(isArchivedLoadError(null)).toBe(false);
    expect(isArchivedLoadError('archived')).toBe(false);
  });
});

// Archived is closed, so the open file, once archived, leaves for the Explorer (one-explorer.md "Archiving the open
// item"): the address names it for the Explorer page, and sessionStorage for a workbench frame's Explorer.
describe('leaving an archived open file for the Explorer', () => {
  it('names it on the Explorer’s address and hands it over for this page load', () => {
    const leave = vi.fn();
    leaveArchivedItem('livediagram', { id: 'd 1', title: 'Road & map' }, leave, 1_000);
    expect(leave).toHaveBeenCalledWith('/explorer?archived=d+1&title=Road+%26+map');
    expect(takeArchivedHandoff('livediagram', 2_000)).toEqual({ id: 'd 1', title: 'Road & map' });
    // Taken once.
    expect(takeArchivedHandoff('livediagram', 2_000)).toBeNull();
  });

  it('leaves the title off an untitled one, and keeps each app’s apart', () => {
    const leave = vi.fn();
    leaveArchivedItem('liveplanner', { id: 'p1', title: '' }, leave, 1_000);
    expect(leave).toHaveBeenCalledWith('/explorer?archived=p1');
    expect(takeArchivedHandoff('livedesign', 1_000)).toBeNull();
    expect(takeArchivedHandoff('liveplanner', 1_000)).toEqual({ id: 'p1', title: null });
  });

  it('goes to the address by default', () => {
    const assign = vi.fn();
    vi.spyOn(window, 'location', 'get').mockReturnValue({ assign } as unknown as Location);
    leaveArchivedItem('livedocuments', { id: 'x', title: 'X' });
    expect(assign).toHaveBeenCalledWith('/explorer?archived=x&title=X');
  });

  it('still leaves when storage is off', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('off');
    });
    const leave = vi.fn();
    leaveArchivedItem('livediagram', { id: 'd1', title: null }, leave, 1_000);
    expect(leave).toHaveBeenCalledWith('/explorer?archived=d1');
  });

  it('says nothing for a stale, future or broken handoff', () => {
    const key = 'livediagram:archived-open-item';
    window.sessionStorage.setItem(key, JSON.stringify({ id: 'd1', at: 1_000 }));
    expect(takeArchivedHandoff('livediagram', 40_000)).toBeNull();
    window.sessionStorage.setItem(key, JSON.stringify({ id: 'd1', at: 5_000 }));
    expect(takeArchivedHandoff('livediagram', 1_000)).toBeNull();
    window.sessionStorage.setItem(key, JSON.stringify({ at: 1_000 }));
    expect(takeArchivedHandoff('livediagram', 1_000)).toBeNull();
    window.sessionStorage.setItem(key, '{');
    expect(takeArchivedHandoff('livediagram', 1_000)).toBeNull();
    expect(takeArchivedHandoff('livediagram', 1_000)).toBeNull();
  });

  it('takes the arrival once per page load, so a remount says the same', () => {
    leaveArchivedItem('livediagram', { id: 'd1', title: 'Roadmap' }, () => {});
    expect(arrivedArchived('livediagram')).toEqual({ id: 'd1', title: 'Roadmap' });
    expect(arrivedArchived('livediagram')).toEqual({ id: 'd1', title: 'Roadmap' });
    expect(arrivedArchived('liveplanner')).toBeNull();
  });

  it('says nothing on the server', () => {
    vi.stubGlobal('window', undefined);
    try {
      expect(arrivedArchived('livediagram')).toBeNull();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
