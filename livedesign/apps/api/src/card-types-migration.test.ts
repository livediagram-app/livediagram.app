import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { defaultCatalogue, validateItemTypeCatalogue } from '@livedesign/items';

// Migration 0090 (docs/specs/026-plan/item-types.md "The type catalogue"): a document made before card types started
// empty, with cards, is given the default types exactly as the code defines them, in their stored (validated) form.
describe('migration 0090', () => {
  it('stores exactly the default types', () => {
    const path = new URL('../migrations/0090_card_types_start_empty.sql', import.meta.url).href;
    const sql = readFileSync(fileURLToPath(path), 'utf8');
    const stored = /item_types = '([^']+)'/.exec(sql)?.[1];
    const valid = validateItemTypeCatalogue(defaultCatalogue());
    expect(valid.ok).toBe(true);
    expect(JSON.parse(stored ?? 'null')).toEqual(valid.ok ? valid.catalogue : null);
  });
});
