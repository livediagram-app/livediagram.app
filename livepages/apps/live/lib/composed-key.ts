// Characters a keyboard composes with Alt (docs/specs/008-canvas/canvas-and-palette.md "Labels", docs/specs/029-sheets/sheet.md
// "Keyboard"). A Mac's Option composes (⌥3 is £ on a UK layout, ⌥⇧2 is €); so does AltGr on Windows and Linux
// (€ is AltGr+E and @ is AltGr+Q on a German layout), which browsers report as Ctrl+Alt with the AltGraph state
// set. Either way the key is the character itself, and typing it must type, never run a Ctrl or Alt shortcut.

export type ComposedKeyLike = {
  key: string;
  code?: string;
  altKey: boolean;
  // A KeyboardEvent's own: AltGraph says the key was composed with AltGr.
  getModifierState?: (key: 'AltGraph') => boolean;
};

/** AltGr is held: the Ctrl a browser reports with it is not a Ctrl the person pressed. */
export const altGraphHeld = (e: ComposedKeyLike): boolean => !!e.getModifierState?.('AltGraph');

// The plain character a key's position types: `KeyD` is d, `Digit3` is 3; null for any other key.
function plainOf(code: string | undefined): string | null {
  if (!code) return null;
  if (/^Key[A-Z]$/.test(code)) return code.slice(3).toLowerCase();
  if (/^Digit[0-9]$/.test(code)) return code.slice(5);
  return null;
}

/** A character composed with Alt: AltGr, a character beyond ASCII, or one unlike its key's plain character. A bare
 *  Alt+letter (a menu chord) keeps its letter, so it is not one. */
export function composedWithAlt(e: ComposedKeyLike): boolean {
  if (!e.altKey || e.key.length !== 1) return false;
  if (altGraphHeld(e)) return true;
  if (e.key.charCodeAt(0) > 0x7e) return true;
  const plain = plainOf(e.code);
  return plain !== null && e.key.toLowerCase() !== plain;
}
