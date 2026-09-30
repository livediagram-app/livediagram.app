import { describe, expect, it } from 'vitest';
import {
  QUIET_LANDING_ATTR,
  QUIET_LANDING_BOOT_SCRIPT,
  QUIET_LANDING_CSS,
} from './quiet-landing-boot';

// Runs the inline boot script against stub globals and reports whether it flagged <html>.
function flags(pathname: string, search: string): boolean {
  const attrs = new Set<string>();
  const documentStub = { documentElement: { setAttribute: (name: string) => attrs.add(name) } };
  new Function('location', 'document', QUIET_LANDING_BOOT_SCRIPT)(
    { pathname, search },
    documentStub,
  );
  return attrs.has(QUIET_LANDING_ATTR);
}

describe('quiet landing boot script (docs/specs/007-editor/new-document-route.md)', () => {
  it('flags the hero launch window landing, before the body paints', () => {
    expect(flags('/new', '?blank=1&welcome=1')).toBe(true);
    expect(flags('/new/', '?welcome=1&blank=1&via=Home.HeroCanvas')).toBe(true);
  });

  it('leaves every other page and /new URL alone', () => {
    expect(flags('/new', '?blank=1')).toBe(false);
    expect(flags('/new', '?welcome=1')).toBe(false);
    expect(flags('/new', '?template=kanban&welcome=1')).toBe(false);
    expect(flags('/document/abc', '?blank=1&welcome=1')).toBe(false);
  });

  it('hides the body and paints the canvas on <html> while flagged', () => {
    expect(QUIET_LANDING_CSS).toContain(`html[${QUIET_LANDING_ATTR}] body{visibility:hidden}`);
    expect(QUIET_LANDING_CSS).toContain('24px 24px');
  });
});
