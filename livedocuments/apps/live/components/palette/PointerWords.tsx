// A palette blurb or description that names a mouse action ("Double-click to look underneath"), said the touch
// screen's way there ("Double-tap to look underneath"), as the flyout's own hint is (docs/specs/008-canvas/
// canvas-and-palette.md): both are rendered and CSS shows the one for the pointer in use, so nothing waits on a
// media-query hook and a hybrid device follows the pointer it has.

// A click, said as a tap, keeping the word's case: whole words only, so "clickable" stays as it is.
const CLICK_WORDS: [RegExp, string][] = [
  [/\bDouble-click\b/g, 'Double-tap'],
  [/\bdouble-click\b/g, 'double-tap'],
  [/\bClick\b/g, 'Tap'],
  [/\bclick\b/g, 'tap'],
  [/\bclicks\b/g, 'taps'],
];

export function touchWording(text: string): string {
  return CLICK_WORDS.reduce((out, [word, tap]) => out.replace(word, tap), text);
}

export function PointerWords({ text }: { text: string }) {
  const touch = touchWording(text);
  if (touch === text) return <>{text}</>;
  return (
    <>
      <span className="pointer-coarse:hidden">{text}</span>
      <span className="hidden pointer-coarse:inline">{touch}</span>
    </>
  );
}
