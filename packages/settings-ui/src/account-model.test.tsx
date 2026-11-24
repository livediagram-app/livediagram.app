import { describe, expect, it, vi } from 'vitest';
import { accountCategories, type CallSpaceChoice } from './account-model';

// The Account section's API Tokens (liveworkspace/docs/specs/010-site/site.md "Settings"): drawn in the panel where the host
// hands them in (every host with an account), and left out where it doesn't (a guest, a workbench).
const base = { all: {}, set: () => {} };
const tokensOf = (section: Parameters<typeof accountCategories>[0]) =>
  accountCategories(section).find((c) => c.id === 'tokens');

describe('accountCategories, API Tokens', () => {
  it('draws the host’s own tokens in the panel when it has them', () => {
    const render = () => null;
    const row = tokensOf({ ...base, renderTokens: render })?.rows[0];
    expect(row).toMatchObject({ kind: 'custom', key: 'apiTokens', label: 'API Tokens' });
    expect(row?.kind === 'custom' && row.render).toBe(render);
  });

  it('leaves the category out where the host hands none in', () => {
    expect(tokensOf(base)).toBeUndefined();
  });
});

// Its Your Data (liveworkspace/docs/specs/003-accounts/data-export.md "Settings"): the same, the last of the rail's
// Account, before the Developers' API Tokens.
const dataOf = (section: Parameters<typeof accountCategories>[0]) =>
  accountCategories(section).find((c) => c.id === 'data');

describe('accountCategories, Your Data', () => {
  it('draws the host’s own downloads in the panel when it has them, after Accessibility', () => {
    const render = () => null;
    const section = {
      ...base,
      renderTokens: render,
      renderDataExport: render,
    };
    const row = dataOf(section)?.rows[0];
    expect(row).toMatchObject({ kind: 'custom', key: 'dataExport', label: 'Your Data' });
    expect(row?.kind === 'custom' && row.render).toBe(render);
    const ids = accountCategories(section).map((c) => c.id);
    expect(ids).toEqual(['notifications', 'privacy', 'accessibility', 'data', 'tokens']);
  });

  it('leaves the category out where the host hands none in', () => {
    expect(dataOf(base)).toBeUndefined();
  });
});

// Settings › Calls (liveworkspace/docs/specs/004-index/item-calls.md "Your Calls Space"): Calls Open In, after
// Accessibility, where the host can list the person's Spaces; its choice read from and written to `all`.
describe('accountCategories, Calls', () => {
  it('draws Calls Open In over the `all` scope, after Accessibility', () => {
    const set = vi.fn();
    const renderCalls = vi.fn((_choice: CallSpaceChoice) => null);
    const section = {
      all: { callSpace: 'lh_room' },
      set,
      renderCalls,
      renderDataExport: () => null,
    };
    const categories = accountCategories(section);
    expect(categories.map((c) => c.id)).toEqual([
      'notifications',
      'privacy',
      'accessibility',
      'calls',
      'data',
    ]);
    const row = categories.find((c) => c.id === 'calls')?.rows[0];
    expect(row).toMatchObject({ kind: 'custom', key: 'callSpace', label: 'Calls Open In' });
    if (row?.kind === 'custom') row.render();
    const choice = renderCalls.mock.calls[0]![0];
    expect(choice.value).toBe('lh_room');
    choice.onChange(null);
    expect(set).toHaveBeenCalledWith('callSpace', null);
    choice.onChange('lh_other');
    expect(set).toHaveBeenCalledWith('callSpace', 'lh_other');
  });

  it('reads anything but a Space id as Default, and lists no category without the host’s Spaces', () => {
    const renderCalls = vi.fn((_choice: CallSpaceChoice) => null);
    const row = accountCategories({ all: { callSpace: true }, set: () => {}, renderCalls }).find(
      (c) => c.id === 'calls',
    )?.rows[0];
    if (row?.kind === 'custom') row.render();
    expect(renderCalls.mock.calls[0]![0]).toMatchObject({ value: null });
    expect(accountCategories(base).map((c) => c.id)).not.toContain('calls');
  });
});

// Webhooks left Settings (liveworkspace/docs/specs/004-index/webhooks.md): they are set per document now.
describe('accountCategories, no Webhooks', () => {
  it('lists no Webhooks category, whatever the host hands in', () => {
    const render = () => null;
    const section = { ...base, renderTokens: render, renderDataExport: render };
    expect(accountCategories(section).map((c) => c.id)).not.toContain('webhooks');
  });
});
