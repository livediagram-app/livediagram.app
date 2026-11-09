// Every icon a layout or a template places is one the icon set draws (docs/specs/007-editor/pages-mode.md
// "Layouts"): an id the catalogue lacks renders as the framed question mark (PLACEHOLDER_ICON) for good.
import { beforeAll, describe, expect, it } from 'vitest';
import { PAGE_LAYOUTS, SLIDE_LAYOUTS, TEMPLATES, buildTemplate } from '@livedocuments/templates';
import { ensureIconCatalogs } from '@liveworkspace/workbench/lib/icon-registry';
import { getIcon, PLACEHOLDER_ICON } from './icons';

beforeAll(async () => {
  await ensureIconCatalogs();
});

/** Every `iconId` anywhere in the value (elements, their cards and rows), with where it was found. */
function iconIdsIn(value: unknown, at: string, out: string[][] = []): string[][] {
  if (Array.isArray(value)) value.forEach((v) => iconIdsIn(v, at, out));
  else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      if (k === 'iconId' && typeof v === 'string' && v !== '') out.push([at, v]);
      else iconIdsIn(v, at, out);
    }
  }
  return out;
}

const unknown = (found: string[][]) =>
  found.filter(([, id]) => getIcon(id) === PLACEHOLDER_ICON).map(([at, id]) => `${at}: ${id}`);

describe('icons in layouts and templates', () => {
  it('every page and slide layout places only icons the icon set has, wide and tall', () => {
    const found: string[][] = [];
    for (const box of [
      { x: 0, y: 0, width: 794, height: 1123, bleed: 40 },
      { x: 0, y: 0, width: 1280, height: 720, bleed: 40 },
    ]) {
      for (const l of [...PAGE_LAYOUTS, ...SLIDE_LAYOUTS]) iconIdsIn(l.build(box), l.id, found);
    }
    expect(found.length).toBeGreaterThan(0);
    expect(unknown(found)).toEqual([]);
  });

  it('every template places only icons the icon set has', () => {
    const found: string[][] = [];
    for (const { kind } of TEMPLATES) iconIdsIn(buildTemplate(kind, 0, 0), kind, found);
    expect(found.length).toBeGreaterThan(0);
    expect(unknown(found)).toEqual([]);
  });
});
