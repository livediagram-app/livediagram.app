import { describe, expect, it } from 'vitest';
import { searchEntries } from './search';

// Search's entries (liveworkspace/docs/specs/004-index/one-explorer.md): an app's own help on its address, liveworkspace.app's
// own Explorer articles in no app.
describe('searchEntries', () => {
  it("lists the app's help articles on its address", () => {
    const help = searchEntries('livediagram', false).filter((e) => e.group === 'help');
    expect(help.length).toBeGreaterThan(0);
    expect(help.every((e) => e.href.startsWith('https://www.livediagram.app/help/'))).toBe(true);
    expect(help[0]!.hint).toBe('livediagram Help');
  });

  it("lists liveworkspace.app's own Explorer articles in no app, never one app's", () => {
    const help = searchEntries(null, false);
    expect(help.map((e) => e.href)).toEqual([
      '/help/explorer/',
      '/help/explorer/folders/',
      '/help/collaboration/teams/',
      '/help/collaboration/sharing/',
      '/help/account-and-data/signing-in/',
    ]);
    expect(help.every((e) => e.group === 'help' && e.hint === 'liveworkspace Help')).toBe(true);
    expect(new Set(help.map((e) => e.id)).size).toBe(help.length);
    expect(searchEntries(null, true).filter((e) => e.group === 'help')).toHaveLength(help.length);
  });
});
