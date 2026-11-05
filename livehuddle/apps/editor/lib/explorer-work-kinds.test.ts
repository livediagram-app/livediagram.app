// @vitest-environment jsdom
// Home's hero pictures livehuddle's Spaces (docs/specs/013-workspace/explorer-home.md "What it makes"): each tile is a
// link to `/new?template=<kind>`, so every kind it names must be one `/new` opens, never one that falls through to a
// Blank Space or the wizard.
import { WORK_KINDS, defaultTemplateHref } from '@liveworkspace/explorer';
import { TEMPLATES, isTemplateKind, templateCategory } from '@livehuddle/templates';
import { describe, expect, it } from 'vitest';
import { wizardBypassKind } from './new-document-params';

describe("livehuddle's kinds on Home's hero", () => {
  const kinds = WORK_KINDS.livehuddle;

  it('are four of its Spaces, every one in a catalogue category', () => {
    expect(kinds.map((k) => k.template)).toEqual([
      'virtual-office',
      'team-pod',
      'coworking-space',
      'all-hands-hall',
    ]);
    const spaces = TEMPLATES.filter((t) => templateCategory(t.kind) !== null).map((t) => t.kind);
    for (const k of kinds) expect(spaces, k.template).toContain(k.template);
  });

  it.each(kinds.map((k) => [k.label, k.template] as const))(
    '%s opens its own template through /new',
    (_label, template) => {
      expect(isTemplateKind(template)).toBe(true);
      const href = defaultTemplateHref('livehuddle')('livehuddle', template)!;
      const url = new URL(href, 'https://www.livehuddle.app');
      expect(url.pathname).toBe('/new');
      expect(wizardBypassKind(url.search)).toBe(template);
    },
  );
});
