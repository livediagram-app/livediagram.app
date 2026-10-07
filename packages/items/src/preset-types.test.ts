import { describe, expect, it } from 'vitest';
import { ITEM_TYPES } from './item-types';
import { presetSetup } from './presets';
import { PRESET_CARD_TYPES, presetTypesToAdd } from './preset-types';
import { validateItemTypeCatalogue } from './type-catalogue';

// docs/specs/026-plan/plan-mode.md "The palette": a preset board brings its card types.
describe('preset card types', () => {
  it('are valid card types', () => {
    const checked = validateItemTypeCatalogue({
      version: 1,
      types: [...ITEM_TYPES, ...PRESET_CARD_TYPES],
    });
    expect(checked.ok).toBe(true);
  });

  it('a Bug Triage board names Bug and a Sprint board Story', () => {
    expect(presetSetup('bug-triage').addTypes).toContain('bug');
    expect(presetSetup('sprint').addTypes).toContain('story');
  });

  it('adds only those the document lacks', () => {
    expect(presetTypesToAdd(['bug', 'task'], ITEM_TYPES).map((t) => t.id)).toEqual(['bug']);
    const withBug = [...ITEM_TYPES, { ...PRESET_CARD_TYPES[0]!, label: 'Defect' }];
    expect(presetTypesToAdd(['bug'], withBug)).toEqual([]);
    expect(presetTypesToAdd(undefined, ITEM_TYPES)).toEqual([]);
  });
});
