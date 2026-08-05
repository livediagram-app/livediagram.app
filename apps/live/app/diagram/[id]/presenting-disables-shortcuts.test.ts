import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// While a deck is running (spec/31) the overlay owns the keyboard. It consumes
// the keys it uses — arrows, space, N, Escape — but everything else propagates
// straight through to the editor's own shortcut surfaces, and that was a real
// bug: pressing G in front of a room armed a parallelogram on a canvas you
// cannot draw on, so the next click did something you never asked for.
//
// The fix is one derived flag threaded into every keyboard surface, rather
// than the overlay swallowing keys it does not understand. That way a surface
// added later is covered by the flag it already takes, and the overlay never
// has to know what the editor's key vocabulary is.
//
// This reads the wiring's OWN source for the same reason the palette census
// does: a list of surfaces typed into this file would agree with itself and
// prove nothing. What must not silently come back is `enabled:
// shortcutsEnabled`, which ignores the presentation.

const SOURCE = readFileSync(new URL('./useEditorState.ts', import.meta.url), 'utf8');

describe('presenting disables the editor keyboard', () => {
  it('derives one flag that accounts for the presentation', () => {
    expect(SOURCE).toMatch(/const keyboardEnabled = shortcutsEnabled && !presenting;/);
  });

  it('hands that flag to every keyboard surface, and the raw preference to none', () => {
    // Two surfaces take `enabled` today: the shortcut hook and the canvas a11y
    // traversal. Both must get the presentation-aware flag.
    //
    // The hook's own destructure (`const { enabled: shortcutsEnabled, … }`)
    // reads identically to a prop, so drop declaration lines before scanning —
    // otherwise this fails on the one line that is SUPPOSED to name the raw
    // preference.
    const passedProps = SOURCE.split('\n').filter((line) => !line.includes('const {'));
    const enabledSites = [...passedProps.join('\n').matchAll(/enabled: (\w+),/g)].map((m) => m[1]);
    expect(enabledSites.length).toBeGreaterThanOrEqual(2);
    expect(new Set(enabledSites)).toEqual(new Set(['keyboardEnabled']));
  });
});
