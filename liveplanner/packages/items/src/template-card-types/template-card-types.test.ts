// The Plan templates' own card types (docs/specs/026-plan/plan-templates.md "Card types a template makes").
import { describe, expect, it } from 'vitest';
import { BOARD_CARD_TYPES, READY_MADE_CARD_TYPES, boardCardType } from '../brought-types';
import { CARD_TEMPLATES_BYTES, cardTemplatesBytes, readCardTemplates } from '../card-templates';
import { validateItemTypeCatalogue, ITEM_TYPE_CATALOGUE_VERSION } from '../type-catalogue';
import type { ItemTypeDef } from '../item-types';
import { TEMPLATE_CARD_TYPES } from '.';

const prefixOf = (id: string) => id.slice(0, id.indexOf('-'));
const byTemplate = new Map<string, ItemTypeDef[]>();
for (const t of TEMPLATE_CARD_TYPES)
  byTemplate.set(prefixOf(t.id), [...(byTemplate.get(prefixOf(t.id)) ?? []), t]);

describe('the templates’ own card types', () => {
  it('are each a template’s own, apart from every ready-made type, by id and by name', () => {
    const ids = TEMPLATE_CARD_TYPES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const t of TEMPLATE_CARD_TYPES) {
      expect(t.id, t.id).toMatch(/^[a-z]+-[a-z-]+$/);
      expect(
        READY_MADE_CARD_TYPES.some((r) => r.id === t.id),
        t.id,
      ).toBe(false);
      expect(boardCardType(t.id)).toBe(t);
    }
    expect(BOARD_CARD_TYPES).toHaveLength(
      READY_MADE_CARD_TYPES.length + TEMPLATE_CARD_TYPES.length,
    );
  });

  it('make a catalogue a project takes, for each template, with names unique in it', () => {
    for (const [prefix, types] of byTemplate) {
      const labels = types.map((t) => t.label.toLowerCase());
      expect(new Set(labels).size, prefix).toBe(labels.length);
      const checked = validateItemTypeCatalogue({ version: ITEM_TYPE_CATALOGUE_VERSION, types });
      expect(checked.ok, `${prefix}: ${checked.ok ? '' : checked.reason}`).toBe(true);
    }
  });

  it('link only to their own template’s types', () => {
    for (const t of TEMPLATE_CARD_TYPES)
      for (const f of t.custom ?? [])
        if (f.kind === 'card')
          expect(prefixOf(f.linkType!), `${t.id} ${f.id}`).toBe(prefixOf(t.id));
  });

  it('each hold at least one card template a type accepts, with no title', () => {
    for (const t of TEMPLATE_CARD_TYPES) {
      expect(t.templates?.length, t.id).toBeGreaterThan(0);
      expect(readCardTemplates(t.templates, t, t.id, 'refuse'), t.id).toEqual(t.templates);
      for (const tp of t.templates!) {
        expect(tp.fields['title'], `${t.id} ${tp.name}`).toBeUndefined();
        expect(Object.keys(tp.fields).length, `${t.id} ${tp.name}`).toBeGreaterThan(0);
      }
    }
    for (const [prefix, types] of byTemplate)
      expect(cardTemplatesBytes(types), prefix).toBeLessThan(CARD_TEMPLATES_BYTES);
  });

  it('offer comments, last', () => {
    for (const t of TEMPLATE_CARD_TYPES) expect(t.fields.at(-1), t.id).toBe('comments');
  });
});
