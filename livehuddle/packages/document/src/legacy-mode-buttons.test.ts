import { describe, expect, it } from 'vitest';
import type { Element } from './index';
import { migrateLegacyModeButtons } from './legacy-mode-buttons';
import { migrateIncomingElements } from './stored-tab';
import { isValidElement } from './validate';

const button = (over: Record<string, unknown> = {}) =>
  ({
    id: 'b',
    type: 'shape',
    shape: 'mode-button',
    x: 0,
    y: 0,
    width: 160,
    height: 44,
    ...over,
  }) as Element;

// docs/specs/008-canvas/highlighter.md "Not a selection mode": the marker is a Draw tile now. The Laser, the
// Spotlight and Isometric left too (docs/specs/002-project-scope/not-in-livehuddle.md).
describe('migrateLegacyModeButtons', () => {
  it('drops a stored Highlighter mode, leaving a default-mode button', () => {
    const [out] = migrateLegacyModeButtons([button({ mode: 'highlighter' })]);
    expect(out).toEqual(button());
  });

  // docs/specs/009-elements/mode-button.md "Only Avatar": the Select, Hand, Eraser and Format buttons load as Avatar.
  it.each(['laser', 'spotlight', 'isometric', 'select', 'pan', 'eraser', 'format'])(
    'drops a stored %s mode the same way',
    (mode) => {
      const [out] = migrateLegacyModeButtons([button({ mode })]);
      expect(out).toEqual(button());
      expect(isValidElement(migrateIncomingElements([button({ mode })])[0])).toBe(true);
    },
  );

  it('keeps an Avatar button and a button with no mode', () => {
    const els = [button({ mode: 'avatar' }), button({ id: 'c' })];
    expect(migrateLegacyModeButtons(els)).toBe(els);
  });

  it('runs at the stored-element entry point, so the button validates', () => {
    expect(isValidElement(button({ mode: 'highlighter' }))).toBe(false);
    const [out] = migrateIncomingElements([button({ mode: 'highlighter' })]);
    expect(isValidElement(out)).toBe(true);
  });
});
