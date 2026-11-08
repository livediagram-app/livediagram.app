import { describe, expect, it } from 'vitest';
import { accountCategories } from './account-model';

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

// Its Webhooks (liveworkspace/docs/specs/004-index/webhooks.md): the same, beside API Tokens.
const webhooksOf = (section: Parameters<typeof accountCategories>[0]) =>
  accountCategories(section).find((c) => c.id === 'webhooks');

describe('accountCategories, Webhooks', () => {
  it('draws the host’s own webhooks in the panel when it has them, after API Tokens', () => {
    const render = () => null;
    const section = { ...base, renderTokens: render, renderWebhooks: render };
    const row = webhooksOf(section)?.rows[0];
    expect(row).toMatchObject({ kind: 'custom', key: 'webhooks', label: 'Webhooks' });
    expect(row?.kind === 'custom' && row.render).toBe(render);
    const ids = accountCategories(section).map((c) => c.id);
    expect(ids.indexOf('webhooks')).toBe(ids.indexOf('tokens') + 1);
  });

  it('leaves the category out where the host hands none in', () => {
    expect(webhooksOf(base)).toBeUndefined();
  });
});

// Its Your Data (liveworkspace/docs/specs/003-accounts/data-export.md "Settings"): the same, the last of the rail's
// Account, before the Developers' API Tokens and Webhooks.
const dataOf = (section: Parameters<typeof accountCategories>[0]) =>
  accountCategories(section).find((c) => c.id === 'data');

describe('accountCategories, Your Data', () => {
  it('draws the host’s own downloads in the panel when it has them, after Accessibility', () => {
    const render = () => null;
    const section = {
      ...base,
      renderWebhooks: render,
      renderDataExport: render,
    };
    const row = dataOf(section)?.rows[0];
    expect(row).toMatchObject({ kind: 'custom', key: 'dataExport', label: 'Your Data' });
    expect(row?.kind === 'custom' && row.render).toBe(render);
    const ids = accountCategories(section).map((c) => c.id);
    expect(ids).toEqual(['notifications', 'privacy', 'accessibility', 'data', 'webhooks']);
  });

  it('leaves the category out where the host hands none in', () => {
    expect(dataOf(base)).toBeUndefined();
  });
});
