import { describe, expect, it } from 'vitest';
import { answer, helpPath, scopeOf, withHelpHeaders, type HelpManifest } from './help-scope';

// liveworkspace/docs/specs/016-help/help-centre.md "Addresses, canonicals and the old paths".

const manifest: HelpManifest = {
  articles: {
    'tabs/using-tabs': ['livediagram', 'liveplanner'],
    'plan/boards': ['liveplanner'],
  },
  categories: { tabs: ['livediagram', 'liveplanner'], plan: ['liveplanner'] },
  redirects: [
    { from: 'canvas/links', to: 'canvas', apps: ['livedocuments'] },
    { from: 'self-hosting/*', to: '' },
    { from: 'tabs/add-to-project', to: 'tabs/using-tabs#more', apps: ['liveplanner'] },
    { from: 'policies/terms', to: 'https://www.liveworkspace.app/terms' },
  ],
  origins: {
    livediagram: 'https://www.livediagram.app',
    liveplanner: 'https://www.liveplanner.app',
    livedocuments: 'https://www.livedocuments.app',
    livedesign: 'https://www.livedesign.app',
    livehuddle: 'https://www.livehuddle.app',
    all: 'https://www.liveworkspace.app',
  },
};

const req = (app?: string) =>
  new Request('https://x.test/', app ? { headers: { 'x-help-app': app } } : undefined);

describe('the help Worker', () => {
  it('takes the scope from the router, else All Apps', () => {
    expect(scopeOf(req('liveplanner'))).toBe('liveplanner');
    expect(scopeOf(req('LiveDesign'))).toBe('livedesign');
    expect(scopeOf(req('liveworkspace'))).toBe('all');
    expect(scopeOf(req())).toBe('all');
  });

  it('strips /help only where it is kept', () => {
    expect(helpPath('/help')).toBe('/');
    expect(helpPath('/help/tabs/')).toBe('/tabs/');
    expect(helpPath('/tabs/')).toBe('/tabs/');
  });

  it("serves the scope's file for a page that applies", () => {
    expect(answer(manifest, 'livediagram', '/tabs/using-tabs/', '')).toEqual({
      kind: 'asset',
      path: '/livediagram/tabs/using-tabs/',
    });
    expect(answer(manifest, 'all', '/help/plan/boards/', '')).toEqual({
      kind: 'asset',
      path: '/all/plan/boards/',
    });
  });

  it('answers 308 to the canonical address for a page outside the scope, keeping the query', () => {
    expect(answer(manifest, 'livedesign', '/tabs/using-tabs/', '?q=x')).toEqual({
      kind: 'redirect',
      location: 'https://www.liveworkspace.app/help/tabs/using-tabs/?q=x',
    });
    expect(answer(manifest, 'livediagram', '/plan/', '')).toEqual({
      kind: 'redirect',
      location: 'https://www.liveplanner.app/help/plan/',
    });
  });

  it('keeps a staging page on staging', () => {
    expect(answer(manifest, 'livedesign', '/tabs/using-tabs/', '', { staging: true })).toEqual({
      kind: 'redirect',
      location: 'https://staging.liveworkspace.app/help/tabs/using-tabs/',
    });
  });

  it('moves an old path on the same address, an app-limited one only on its app', () => {
    expect(answer(manifest, 'livedocuments', '/canvas/links/', '')).toEqual({
      kind: 'redirect',
      location: '/canvas/',
    });
    expect(answer(manifest, 'livediagram', '/canvas/links/', '').kind).toBe('asset');
    expect(answer(manifest, 'all', '/help/self-hosting/docker/', '')).toEqual({
      kind: 'redirect',
      location: '/help/',
    });
  });

  it('keeps a fragment after the query, and leaves for an absolute address', () => {
    expect(answer(manifest, 'liveplanner', '/tabs/add-to-project/', '?q=a')).toEqual({
      kind: 'redirect',
      location: '/tabs/using-tabs/?q=a#more',
    });
    expect(answer(manifest, 'livediagram', '/policies/terms/', '')).toEqual({
      kind: 'redirect',
      location: 'https://www.liveworkspace.app/terms',
    });
  });

  it('sets the security headers and varies on the app header', () => {
    const out = withHelpHeaders(new Response('ok', { headers: { Vary: 'Accept-Encoding' } }));
    expect(out.headers.get('x-frame-options')).toBe('DENY');
    expect(out.headers.get('content-security-policy')).toContain("require-trusted-types-for 'script'");
    expect(out.headers.get('vary')).toBe('Accept-Encoding, x-help-app');
  });
});
