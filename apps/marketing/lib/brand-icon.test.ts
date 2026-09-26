import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { brandMarkSvg } from '@livediagram/ui';

// Each frontend ships its own app/icon.svg, because Next's icon file
// convention wants one per app (and help's is served under its basePath).
// So the mark exists as four static files plus the shared BRAND_MARK geometry
// in @livediagram/ui that the header logo and apple-icon.tsx render from.
// Nothing at runtime notices one of them drifting; this does.

const APPS = ['marketing', 'live', 'help', 'telemetry'] as const;

const iconSvg = (app: (typeof APPS)[number]) =>
  readFileSync(fileURLToPath(new URL(`../../${app}/app/icon.svg`, import.meta.url)), 'utf8');

// Formatting only: indentation between tags and the self-closing spacing.
const normalise = (svg: string) =>
  svg
    .replace(/>\s+</g, '><')
    .replace(/\s*\/>/g, '/>')
    .trim();

describe('brand icon', () => {
  it('ships the same app/icon.svg in every app', () => {
    const marketing = iconSvg('marketing');
    for (const app of APPS) expect(iconSvg(app), app).toBe(marketing);
  });

  it('draws the shared brand mark geometry', () => {
    expect(normalise(iconSvg('marketing'))).toBe(brandMarkSvg());
  });
});
