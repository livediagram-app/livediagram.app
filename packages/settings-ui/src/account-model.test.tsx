import { describe, expect, it } from 'vitest';
import { accountCategories } from './account-model';

// The Account section's API Tokens (liveworkspace/docs/specs/010-site/site.md "Settings"): drawn in the panel where the host can make
// and revoke them, a link to them where it can't, and left out where it has neither.
const base = { all: {}, set: () => {} };
const tokensOf = (section: Parameters<typeof accountCategories>[0]) =>
  accountCategories(section).find((c) => c.id === 'tokens');

describe('accountCategories, API Tokens', () => {
  it('draws the host’s own tokens in the panel when it has them', () => {
    const render = () => null;
    const row = tokensOf({ ...base, renderTokens: render, tokensHref: '/elsewhere' })?.rows[0];
    expect(row).toMatchObject({ kind: 'custom', key: 'apiTokens', label: 'API Tokens' });
    expect(row?.kind === 'custom' && row.render).toBe(render);
  });

  it('links to the tokens where the host has none of its own, and leaves the category out with neither', () => {
    expect(tokensOf({ ...base, tokensHref: '/explorer?settings=tokens' })?.rows[0]).toMatchObject({
      kind: 'custom',
      key: 'apiTokens',
    });
    expect(tokensOf(base)).toBeUndefined();
  });
});

// Its Webhooks (liveworkspace/docs/specs/004-index/webhooks.md): the same, beside API Tokens.
const webhooksOf = (section: Parameters<typeof accountCategories>[0]) =>
  accountCategories(section).find((c) => c.id === 'webhooks');

describe('accountCategories, Webhooks', () => {
  it('draws the host’s own webhooks in the panel when it has them, after API Tokens', () => {
    const render = () => null;
    const section = { ...base, renderTokens: render, renderWebhooks: render, webhooksHref: '/x' };
    const row = webhooksOf(section)?.rows[0];
    expect(row).toMatchObject({ kind: 'custom', key: 'webhooks', label: 'Webhooks' });
    expect(row?.kind === 'custom' && row.render).toBe(render);
    const ids = accountCategories(section).map((c) => c.id);
    expect(ids.indexOf('webhooks')).toBe(ids.indexOf('tokens') + 1);
  });

  it('links to the webhooks where the host has none of its own, and leaves the category out with neither', () => {
    expect(
      webhooksOf({ ...base, webhooksHref: '/explorer?settings=webhooks' })?.rows[0],
    ).toMatchObject({
      kind: 'custom',
      key: 'webhooks',
    });
    expect(webhooksOf(base)).toBeUndefined();
  });
});

// Its Your Data (liveworkspace/docs/specs/003-accounts/data-export.md "Settings"): the same, after Webhooks.
const dataOf = (section: Parameters<typeof accountCategories>[0]) =>
  accountCategories(section).find((c) => c.id === 'data');

describe('accountCategories, Your Data', () => {
  it('draws the host’s own downloads in the panel when it has them, after Webhooks', () => {
    const render = () => null;
    const section = {
      ...base,
      renderWebhooks: render,
      renderDataExport: render,
      dataExportHref: '/x',
    };
    const row = dataOf(section)?.rows[0];
    expect(row).toMatchObject({ kind: 'custom', key: 'dataExport', label: 'Your Data' });
    expect(row?.kind === 'custom' && row.render).toBe(render);
    const ids = accountCategories(section).map((c) => c.id);
    expect(ids.indexOf('data')).toBe(ids.indexOf('webhooks') + 1);
  });

  it('links to them where the host has none of its own, and leaves the category out with neither', () => {
    expect(dataOf({ ...base, dataExportHref: '/explorer?settings=data' })?.rows[0]).toMatchObject({
      kind: 'custom',
      key: 'dataExport',
    });
    expect(dataOf(base)).toBeUndefined();
  });
});
