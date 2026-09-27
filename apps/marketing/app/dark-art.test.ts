import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  DEFAULT_SCHEME_DARK,
  THEMES,
  defaultArrowLabelColor,
  defaultArrowStrokeColor,
  defaultFillColor,
  defaultStrokeColor,
  defaultTextColor,
  unpaintedShapeInk,
  type BoxedElement,
  type CanvasSurface,
  type ThemeDefinition,
} from '@livediagram/diagram';
import { describe, expect, it } from 'vitest';

// Every diagram in the mock-ups is drawn as the editor draws it on the Default theme
// (docs/specs/004-interface-design/appearance.md, docs/specs/019-marketing/marketing-site.md).
// The art keeps those colours as CSS custom properties (app/hero-animations.css), so these hold
// each one to what packages/diagram itself returns rather than letting a copy drift.

const APP = fileURLToPath(new URL('..', import.meta.url));
const read = (path: string) => readFileSync(`${APP}${path}`, 'utf8');
const css = read('app/hero-animations.css');

/** `#rrggbb` for a hex or an `rgb(r g b)` colour, so both notations compare. */
function hex(colour: string): string {
  const rgb = colour.match(/^rgb\((\d+)[ ,]+(\d+)[ ,]+(\d+)\)$/);
  if (!rgb) return colour.toLowerCase();
  return `#${rgb
    .slice(1)
    .map((n) => Number(n).toString(16).padStart(2, '0'))
    .join('')}`;
}

function artProperty(selector: ':root' | '.dark', name: string): string {
  const escaped = selector.replace('.', '\\.');
  const block = css.match(new RegExp(`(?:^|\\n)${escaped} \\{([\\s\\S]*?)\\}`))?.[1] ?? '';
  const match = block.match(new RegExp(`--${name}: (#[0-9a-f]{6});`));
  if (!match?.[1]) throw new Error(`--${name} not set under ${selector}`);
  return match[1];
}

function element(type: BoxedElement['type']): BoxedElement {
  return { id: '', type, x: 0, y: 0, width: 0, height: 0 } as BoxedElement;
}

function theme(id: string): ThemeDefinition {
  const found = THEMES.find((t) => t.id === id);
  if (!found) throw new Error(`theme ${id} not found`);
  return found;
}

function expectDefaultScheme(
  selector: ':root' | '.dark',
  surface: CanvasSurface,
  scheme: ThemeDefinition,
) {
  const ink = unpaintedShapeInk(surface);
  expect(artProperty(selector, 'art-paper')).toBe(hex(scheme.backgroundColor));
  expect(artProperty(selector, 'art-grid')).toBe(hex(scheme.patternColor));
  expect(artProperty(selector, 'art-ink-fill')).toBe(hex(ink.fill));
  expect(artProperty(selector, 'art-ink-stroke')).toBe(hex(ink.stroke));
  expect(artProperty(selector, 'art-ink-text')).toBe(hex(ink.text));
  expect(artProperty(selector, 'art-ink-shade')).toBe(
    hex(defaultFillColor(element('annotation'), surface)),
  );
  expect(artProperty(selector, 'art-text')).toBe(hex(defaultTextColor(element('text'), surface)));
  expect(artProperty(selector, 'art-arrow')).toBe(hex(defaultArrowStrokeColor(surface)));
  expect(artProperty(selector, 'art-arrow-label')).toBe(hex(defaultArrowLabelColor({}, surface)));
  expect(artProperty(selector, 'art-table-line')).toBe(
    hex(defaultStrokeColor(element('table'), surface)),
  );
}

function expectPick(selector: ':root' | '.dark', id: string) {
  const pick = theme(id);
  expect(artProperty(selector, 'art-pick-paper')).toBe(hex(pick.backgroundColor));
  expect(artProperty(selector, 'art-pick-grid')).toBe(hex(pick.patternColor));
  expect(artProperty(selector, 'art-pick-fill')).toBe(hex(pick.elementFill ?? ''));
  expect(artProperty(selector, 'art-pick-stroke')).toBe(hex(pick.elementStroke ?? ''));
  expect(artProperty(selector, 'art-pick-text')).toBe(hex(pick.elementText ?? ''));
}

describe('mock-up palette, dark half', () => {
  it('is the Default scheme dark half and the ink it gives unpainted elements', () => {
    expectDefaultScheme('.dark', 'dark', DEFAULT_SCHEME_DARK);
  });

  it('recolours the hero flowchart to Pine', () => {
    expectPick('.dark', 'pine');
  });
});

describe('hero window veil', () => {
  it('fades to the dark page colour in dark appearance', () => {
    const pageDark = read('app/layout.tsx').match(/<body[^>]*\b(dark:bg-slate-\d+)/)?.[1];
    const veil = read('components/HeroIllustration.tsx').match(
      /className=\{`pointer-events-none absolute inset-0 z-20 ([^`$]*)/,
    )?.[1];
    expect(pageDark).toBeTruthy();
    expect(veil?.split(' ')).toContain(pageDark);
  });
});
