import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// The teams pages moved into the Explorer (liveworkspace/docs/specs/010-site/site.md "Your account"). Every old address
// redirects permanently, so the links in invitation emails already sent keep landing.
const rules = readFileSync(fileURLToPath(new URL('../public/_redirects', import.meta.url)), 'utf8')
  .split('\n')
  .filter((line) => line.trim() && !line.startsWith('#'))
  .map((line) => line.trim().split(/\s+/));
const ruleFor = (from: string) => rules.find(([source]) => source === from);

describe('the old teams addresses', () => {
  it.each([
    ['/account/teams', '/explorer/invites'],
    ['/account/teams/', '/explorer/invites'],
    ['/account/teams/:id', '/explorer/team?id=:id'],
    ['/account/teams/:id/', '/explorer/team?id=:id'],
  ])('%s goes to %s, permanently', (from, to) => {
    expect(ruleFor(from)).toEqual([from, to, '301']);
  });

  it('comes before any rule that could catch them', () => {
    const at = rules.findIndex(([source]) => source === '/account/teams');
    expect(at).toBeGreaterThanOrEqual(0);
    expect(rules.slice(0, at).some(([source]) => source?.startsWith('/account'))).toBe(false);
  });
});
