import { describe, expect, it } from 'vitest';
import { inspectViewLink, wantsInspect, withInspect } from './inspect-link';

// docs/specs/007-editor/wireframe-pages.md "A link that opens with Inspect".
describe('the inspect parameter', () => {
  it('asks for Inspect when present, unless it says no', () => {
    expect(wantsInspect('?s=abc&inspect')).toBe(true);
    expect(wantsInspect('?s=abc&inspect=1')).toBe(true);
    expect(wantsInspect('?inspect=0')).toBe(false);
    expect(wantsInspect('?inspect=false')).toBe(false);
    expect(wantsInspect('?s=abc')).toBe(false);
    expect(wantsInspect('')).toBe(false);
  });

  it('adds itself once, keeping the rest of an absolute link', () => {
    expect(withInspect('https://www.livedesign.app/design/shared?s=abc')).toBe(
      'https://www.livedesign.app/design/shared?s=abc&inspect=1',
    );
    expect(withInspect('https://x.test/d?inspect&s=a#t')).toBe('https://x.test/d?inspect=1&s=a#t');
  });

  it('keeps a relative link relative', () => {
    expect(withInspect('/design/shared?s=abc')).toBe('/design/shared?s=abc&inspect=1');
  });
});

describe('the Viewer link Copy Inspect Link hands over', () => {
  const NOW = 1_000;
  const link = (code: string, extra: Record<string, unknown> = {}) => ({
    code,
    level: 'view',
    tabId: null as string | null,
    expiresAt: null as number | null,
    ...extra,
  });

  it('prefers the whole design over this tab', () => {
    const links = [link('tab', { tabId: 't1' }), link('all')];
    expect(inspectViewLink(links, 't1', NOW)?.code).toBe('all');
  });

  it("falls back to this tab's link, never another tab's", () => {
    expect(inspectViewLink([link('tab', { tabId: 't1' })], 't1', NOW)?.code).toBe('tab');
    expect(inspectViewLink([link('tab', { tabId: 't2' })], 't1', NOW)).toBeNull();
  });

  it('never hands over an edit link, a public link or one that has run out', () => {
    const links = [
      link('edit', { level: 'edit' }),
      link('public', { public: true }),
      link('old', { expiresAt: NOW }),
    ];
    expect(inspectViewLink(links, 't1', NOW)).toBeNull();
    expect(inspectViewLink([link('live', { expiresAt: NOW + 1 })], 't1', NOW)?.code).toBe('live');
  });
});
