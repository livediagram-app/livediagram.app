import { describe, expect, it } from 'vitest';
import { createShape } from './shape-factory';
import { migrateIncomingTab } from './stored-tab';
import { elementValidationIssue, isValidTab } from './validate';
import { inkKindOf } from './page-ink-rules';
import { dropMalformedIds, ELEMENT_KEY_MAX } from './malformed-ids';
import type { Element, Tab } from './index';

// Catalogue keys are text (docs/specs/010-palette/technology-icons.md).
const icon = (fields: Record<string, unknown>) =>
  ({ ...createShape('icon', 0, 0), ...fields }) as unknown as Element;

describe('dropMalformedIds', () => {
  it('keeps text keys, an unknown one included, and hands the same array back', () => {
    const els = [icon({ iconId: 'emoji-rocket' }), icon({ iconId: 'not-in-any-catalogue' })];
    expect(dropMalformedIds(els)).toBe(els);
  });

  it.each([[[]], [{}], [5], [null], ['x'.repeat(ELEMENT_KEY_MAX + 1)]])(
    'drops a key that is not one (%j)',
    (bad) => {
      for (const field of ['iconId', 'stickerId', 'flowchartId']) {
        const [out] = dropMalformedIds([icon({ [field]: bad })]);
        expect(field in out!).toBe(false);
      }
    },
  );
});

describe('a malformed key on the way in', () => {
  it('is refused by validation', () => {
    expect(elementValidationIssue(icon({ iconId: [] }))?.field).toBe('iconId');
    expect(elementValidationIssue(icon({ stickerId: 3 }))?.field).toBe('stickerId');
    expect(elementValidationIssue(icon({ iconId: 'lucide-star' }))).toBeNull();
  });

  it('is dropped by the incoming-tab migration, so the canvas can read the icon', () => {
    const tab = migrateIncomingTab({ id: 't', name: 'T', elements: [icon({ iconId: [] })] }) as Tab;
    expect(isValidTab(tab)).toBe(true);
    // The canvas's page re-inking read an emoji icon by its id's prefix, and threw on a list.
    expect(() => inkKindOf(tab.elements[0]!)).not.toThrow();
  });
});
