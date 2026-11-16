import { describe, expect, it } from 'vitest';
import { searchEntries } from './search';

// Search's entries (liveworkspace/docs/specs/004-index/one-explorer.md): an app's own help on its address, none in no
// app, where liveworkspace.app has no Explorer articles of its own.
describe('searchEntries', () => {
  it("lists the app's help articles on its address", () => {
    const help = searchEntries('livediagram', false).filter((e) => e.group === 'help');
    expect(help.length).toBeGreaterThan(0);
    expect(help.every((e) => e.href.startsWith('https://www.livediagram.app/help/'))).toBe(true);
    expect(help[0]!.hint).toBe('livediagram Help');
  });

  it("lists no one app's help in no app", () => {
    expect(searchEntries(null, false)).toEqual([]);
    expect(searchEntries(null, true).some((e) => e.group === 'help')).toBe(false);
  });
});
