// The infrastructure panels' rules (docs/specs/020-import-export/blueprints/infrastructure-import.md "The panels'
// rules"): which files a run reads, when the update cannot run, where a dropped file goes, and what a row says.

import { describe, expect, it } from 'vitest';
import {
  baseName,
  entriesFromSources,
  entriesToFiles,
  entryStateLabel,
  matchDropped,
  newEntries,
  replaceEntry,
  toggleRemoved,
  updateBlocked,
} from './infra-files';

const SOURCES = {
  files: [
    { name: 'apps/api/wrangler.toml', format: 'wrangler', hash: 'h1', text: 'name = "api"' },
    { name: 'compose.yml', format: 'compose', hash: 'h2' },
  ],
};

describe('the infrastructure panels’ entries', () => {
  it('reads a remembered file as Kept, or Needed without its text', () => {
    const [api, compose] = entriesFromSources(SOURCES);
    expect(api).toMatchObject({
      name: 'apps/api/wrangler.toml',
      state: 'kept',
      text: 'name = "api"',
    });
    expect(compose).toMatchObject({ name: 'compose.yml', state: 'needed', format: 'compose' });
    expect(compose!.text).toBeUndefined();
    expect(api!.id).not.toBe(compose!.id);
  });

  it('reads the files that have text and are not removed, and blocks an update on a Needed one', () => {
    const entries = entriesFromSources(SOURCES);
    expect(entriesToFiles(entries)).toEqual([
      { name: 'apps/api/wrangler.toml', text: 'name = "api"' },
    ]);
    expect(updateBlocked(entries)).toBe(true);
    const removed = [entries[0]!, toggleRemoved(entries[1]!)];
    expect(updateBlocked(removed)).toBe(false);
    // None left: nothing to update from.
    expect(
      updateBlocked(removed.map(toggleRemoved).map((e, i) => (i === 0 ? toggleRemoved(e) : e))),
    ).toBe(true);
    expect(updateBlocked([])).toBe(true);
  });

  it('replaces a text, and Remove then Keep brings the row back as it was', () => {
    const [api, compose] = entriesFromSources(SOURCES);
    expect(replaceEntry(compose!, 'services: {}')).toMatchObject({
      state: 'replaced',
      text: 'services: {}',
    });
    const [added] = newEntries([{ name: 'main.tf', text: 'a' }]);
    expect(replaceEntry(added!, 'b')).toMatchObject({ state: 'new', text: 'b' });
    const gone = toggleRemoved(compose!);
    expect(gone).toMatchObject({ state: 'removed', was: 'needed' });
    expect(entriesToFiles([gone])).toEqual([]);
    expect(toggleRemoved(gone)).toEqual(compose);
    // A row with no state to go back to keeps its file.
    const { was: _was, ...bare } = toggleRemoved(api!);
    expect(toggleRemoved(bare).state).toBe('kept');
  });

  it('puts a dropped file on the row of the same name, else adds it', () => {
    const entries = entriesFromSources(SOURCES);
    const next = matchDropped(entries, [
      { name: 'wrangler.toml', text: 'name = "api2"' },
      { name: 'compose.yml', text: 'services:\n  a: {}' },
      { name: 'main.tf', text: 'resource "a" "b" {}' },
    ]);
    expect(next.map((e) => [e.name, e.state, e.text])).toEqual([
      ['apps/api/wrangler.toml', 'replaced', 'name = "api2"'],
      ['compose.yml', 'replaced', 'services:\n  a: {}'],
      ['main.tf', 'new', 'resource "a" "b" {}'],
    ]);
    // A removed row is not replaced: the file is added beside it.
    const removed = matchDropped(
      [toggleRemoved(entries[1]!)],
      [{ name: 'compose.yml', text: 'x' }],
    );
    expect(removed.map((e) => e.state)).toEqual(['removed', 'new']);
  });

  it('names each state in words', () => {
    const [api, compose] = entriesFromSources(SOURCES);
    expect(entryStateLabel(api!, false)).toBe('Kept');
    expect(entryStateLabel(compose!, false)).toBe('Needed');
    expect(entryStateLabel(replaceEntry(api!, 'x'), false)).toBe('Replaced');
    expect(entryStateLabel(replaceEntry(api!, 'x'), true)).toBe('No changes');
    expect(entryStateLabel(toggleRemoved(api!), false)).toBe('Removed');
    expect(entryStateLabel(newEntries([{ name: 'a', text: 'b' }])[0]!, false)).toBe('New');
    expect(baseName('a/b/c.tf')).toBe('c.tf');
    expect(baseName('c.tf')).toBe('c.tf');
  });
});
