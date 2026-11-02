// The first-run welcome's manifest (liveworkspace/docs/specs/004-index/one-explorer.md "First run"): what liveworkspace.app's
// Explorer offers a person with nothing yet, written beside the catalogue as @livehuddle/templates/welcome.json so the
// Explorer reads a small static file instead of the catalogue and its pictures. This test is the generator and its
// guard: run with WELCOME_WRITE=1 to write it; without, it fails when the file has drifted from the catalogue.
import { readFileSync, writeFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  POPULAR_TEMPLATE_KINDS,
  TEMPLATES,
  isBlankTemplate,
  templateCreateHref,
  BLANK_TEMPLATE_FOR_MODE,
  type TemplateKind,
} from '@livehuddle/templates';
import { EDITOR_MODES } from '@livehuddle/document';
import { TemplatePreview } from './template-preview';

const FILE = new URL('../../templates/welcome.json', import.meta.url);
const WELCOME_TEMPLATES_MAX = 8;
const WELCOME_BLANKS_MAX = 5;
const BLANKS: readonly TemplateKind[] = EDITOR_MODES.map((mode) => BLANK_TEMPLATE_FOR_MODE[mode]);
const FAN: readonly TemplateKind[] = ['flowchart', 'mindmap', 'retrospective'];

function start(kind: TemplateKind) {
  const t = TEMPLATES.find((d) => d.kind === kind);
  if (!t) throw new Error(`no template ${kind}`);
  return {
    id: kind,
    name: t.title,
    description: t.description,
    href: templateCreateHref(kind),
    svg: renderToStaticMarkup(createElement(TemplatePreview, { kind })),
  };
}

export function welcomeManifest() {
  return {
    app: 'livehuddle',
    pillFree: 'Free and open source',
    startBlankHref: '/new?start=blank',
    allTemplatesHref: '/new',
    searchHref: '/new?q=',
    fan: FAN,
    blanks: BLANKS.slice(0, WELCOME_BLANKS_MAX).map(start),
    popular: POPULAR_TEMPLATE_KINDS.filter((k) => !isBlankTemplate(k))
      .slice(0, WELCOME_TEMPLATES_MAX)
      .map(start),
  };
}

describe('the welcome manifest', () => {
  it('matches the catalogue (WELCOME_WRITE=1 writes it)', () => {
    const text = `${JSON.stringify(welcomeManifest(), null, 2)}\n`;
    if (process.env.WELCOME_WRITE === '1') writeFileSync(FILE, text);
    expect(readFileSync(FILE, 'utf8')).toBe(text);
  });

  it('draws every start, and fans only what it offers', () => {
    const m = welcomeManifest();
    const all = [...m.blanks, ...m.popular];
    for (const s of all) expect(s.svg).toMatch(/^<svg/);
    for (const id of m.fan) expect(all.map((s) => s.id)).toContain(id);
  });
});
