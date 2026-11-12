import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SIGNED_IN_HINTS } from './app-session';

// Every product keeps its own auth cookies. All apps run on localhost in development, and cookies ignore the port,
// so two products sharing a name sign each other out. livehuddle was forked from livediagram and kept `ld_` until
// it became `lh_`; this fails the next fork that repeats it.

const ROOT = resolve(__dirname, '../../../../..');

/** The names used by more than one product, as `name: [products]`. */
function sharedNames(byProduct: Record<string, string>): Record<string, string[]> {
  const owners = new Map<string, string[]>();
  for (const [product, name] of Object.entries(byProduct)) {
    owners.set(name, [...(owners.get(name) ?? []), product]);
  }
  return Object.fromEntries([...owners].filter(([, products]) => products.length > 1));
}

/** The cookie name a product's api declares as `const <constant> = '<name>'` in its auth routes. */
function apiCookie(product: string, constant: 'PKCE_COOKIE' | 'REFRESH_COOKIE'): string {
  const source = readFileSync(resolve(ROOT, product, 'apps/api/src/routes/auth.ts'), 'utf8');
  const found = source.split('\n').find((line) => line.startsWith(`const ${constant} = '`));
  if (!found) throw new Error(`${product}: no ${constant} in apps/api/src/routes/auth.ts`);
  return found.slice(found.indexOf("'") + 1, found.lastIndexOf("'"));
}

const hints = Object.fromEntries(Object.entries(SIGNED_IN_HINTS).map(([app, name]) => [app, name]));
const pkce = Object.fromEntries(
  Object.keys(hints).map((app) => [app, apiCookie(app, 'PKCE_COOKIE')]),
);
const refresh = Object.fromEntries(
  Object.keys(hints).map((app) => [app, apiCookie(app, 'REFRESH_COOKIE')]),
);

describe('every product has its own auth cookies', () => {
  it('covers all five products', () => {
    expect(Object.keys(hints).sort()).toEqual(
      ['livedesign', 'livediagram', 'livedocuments', 'livehuddle', 'liveplanner'].sort(),
    );
  });

  it('gives each product its own signed-in hint cookie', () => {
    expect(sharedNames(hints)).toEqual({});
  });

  it('gives each product its own refresh cookie', () => {
    expect(sharedNames(refresh)).toEqual({});
  });

  it('gives each product its own PKCE cookie', () => {
    expect(sharedNames(pkce)).toEqual({});
  });

  it('keeps a product to one prefix across its hint, refresh and PKCE cookies', () => {
    for (const app of Object.keys(hints)) {
      const names = [hints[app], refresh[app], pkce[app]].map(String);
      const prefixes = new Set(names.map((n) => n.split('_')[0]));
      expect({ app, prefixes: prefixes.size }).toEqual({ app, prefixes: 1 });
    }
  });

  it('fails when two products share a name', () => {
    expect(
      sharedNames({
        livediagram: 'ld_signed_in',
        livehuddle: 'ld_signed_in',
        liveplanner: 'lp_signed_in',
      }),
    ).toEqual({
      ld_signed_in: ['livediagram', 'livehuddle'],
    });
    expect(sharedNames({ a: 'x_refresh', b: 'y_refresh' })).toEqual({});
  });
});
