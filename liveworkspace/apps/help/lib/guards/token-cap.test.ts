import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { MAX_API_TOKENS_PER_ACCOUNT } from '@liveworkspace/api-schema/api-tokens';

// The articles that state the API token cap say the accounts Worker's own number (liveworkspace/docs/specs/
// 003-accounts/accounts.md "API tokens"), so a change to the cap fails here until the help says it too. The pages
// stay plain prose for search; this test is what ties them to the constant.
const PAGES: Record<string, string[]> = {
  'account-and-data/connect-ai-mcp/page.mdx': [
    `You can have ${MAX_API_TOKENS_PER_ACCOUNT} tokens that haven't expired`,
  ],
  'account-and-data/connect-ai-mcp/ai-clients/page.mdx': [
    `you can have ${MAX_API_TOKENS_PER_ACCOUNT} unexpired tokens`,
  ],
  'developers/errors-and-rate-limits/page.mdx': [
    `creating a ${MAX_API_TOKENS_PER_ACCOUNT + 1}st token answers \`token_limit_reached\``,
    `You can hold up to **${MAX_API_TOKENS_PER_ACCOUNT}** live tokens at once`,
    `Asking for a ${MAX_API_TOKENS_PER_ACCOUNT + 1}st returns \`409 token_limit_reached\``,
  ],
};

const read = (page: string) => readFileSync(new URL(`../../app/${page}`, import.meta.url), 'utf8');

describe('the API token cap in the help centre', () => {
  it('is the constant the accounts Worker counts against', () => {
    expect(MAX_API_TOKENS_PER_ACCOUNT).toBe(20);
  });

  for (const [page, lines] of Object.entries(PAGES)) {
    it(`${page} says it`, () => {
      const text = read(page);
      for (const line of lines) expect(text).toContain(line);
    });
  }

  it('never says ten', () => {
    for (const page of Object.keys(PAGES))
      expect(read(page)).not.toMatch(/ten (unexpired|live) tokens/);
  });
});
